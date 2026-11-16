//Player choices bound by the rules (Doctrine: buttons, no values): equip / unequip, attune, prepare a spell.
//Pure: each takes the stored character and returns the changed field, or the reason it is not allowed.
//Items in use bring their actions (equipping a weapon gives its attack): itemActions rebuilds them after any inventory change.

import {CharacterAction, GrantSource, ICharacter, InventoryEntry} from "../interfaces/DB/Character"
import {classes} from "../data/loader"
import {subclasses} from "../data/loader"
import {spells} from "../data/loader"
import {ENEquipmentSlot, Item} from "../types/book/items"
import {items} from "../data/loader"
import {entryActions, entryEquipment, entryType} from "./items"

export type Outcome<T> = { ok: true; value: T } | { ok: false; reason: string }

const refuse = (reason: string): Outcome<never> => ({ok: false, reason})
const sourceKey = (source: GrantSource) => source.type === 'custom' ? 'custom' : `${source.type}:${source.id}`
const itemOf = (entry: InventoryEntry) => (items as Record<string, Item>)[entry.item]

//item types used straight from the pack: a potion is drunk, a scroll read, ammo loaded — no slot needed
const usedFromPack = ['potion', 'scroll', 'consumable', 'ammo']

//the actions list with item-sourced actions rebuilt from the inventory: equipped items and usable consumables, once per item + base
//(a +1 longsword and a +1 dagger are two weapons); class / spell / feature / monster / custom actions are kept as they are
export function itemActions(character: Pick<ICharacter, 'actions'>, inventory: InventoryEntry[]): CharacterAction[] {
  const kept = character.actions.filter((action) => action.from.type !== 'item')
  const inUse = new Map(inventory.filter((entry) => entry.quantity > 0 && (entry.equipped || usedFromPack.includes(entryType(entry) ?? '')))
    .map((entry) => [`${entry.item}:${entry.base ?? ''}`, entry]))
  const stamped = [...inUse.values()].flatMap((entry) => entryActions(entry)
    .map((action): CharacterAction => ({...action, from: {type: 'item', id: entry.item}})))
  return [...kept, ...stamped]
}

//put an entry into its slot (given or the item's own); whatever sat there goes back to the bag
export function equip(character: ICharacter, entryId: string, slot?: ENEquipmentSlot): Outcome<InventoryEntry[]> {
  const entry = character.inventory.find((candidate) => candidate.id === entryId)
  if (!entry) return refuse('Предмет в инвентаре не найден')
  const equipment = entryEquipment(entry)
  const target = slot ?? equipment?.defaultSlot
  if (!target) return refuse('Этот предмет нельзя надеть')
  if (slot && equipment && ![equipment.defaultSlot, ...(equipment.allowedSlots ?? [])].includes(slot)) return refuse('Этот предмет нельзя надеть в этот слот')
  return {ok: true, value: character.inventory.map((candidate) => candidate.id === entry.id ? {...candidate, equipped: target}
    : candidate.equipped === target ? {...candidate, equipped: undefined} : candidate)}
}

export function unequip(character: ICharacter, entryId: string): Outcome<InventoryEntry[]> {
  const entry = character.inventory.find((candidate) => candidate.id === entryId)
  if (!entry?.equipped) return refuse('Предмет не экипирован')
  return {ok: true, value: character.inventory.map((candidate) => candidate.id === entryId ? {...candidate, equipped: undefined} : candidate)}
}

//attune within the evaluated limit; only items that require attunement
export function attune(character: ICharacter, entryId: string, attuned: boolean, limit: number): Outcome<InventoryEntry[]> {
  const entry = character.inventory.find((candidate) => candidate.id === entryId)
  if (!entry) return refuse('Предмет в инвентаре не найден')
  if (attuned && !itemOf(entry)?.attunement) return refuse('Этот предмет не требует настройки')
  if (attuned && character.inventory.filter((candidate) => candidate.attuned && candidate.id !== entryId).length >= limit) return refuse(`Настроено максимум предметов: ${limit}`)
  return {ok: true, value: character.inventory.map((candidate) => candidate.id === entryId ? {...candidate, attuned} : candidate)}
}

//prepared-spell limit per class caster source (class / subclass), from its table column at the current level
export function preparedLimits(character: ICharacter): Record<string, { limit: number; prepared: number }> {
  const result: Record<string, { limit: number; prepared: number }> = {}
  for (const entry of character.classes) {
    const characterClass = (classes as Record<string, typeof classes[keyof typeof classes]>)[entry.class]
    const subclass = entry.subclass ? (subclasses as Record<string, typeof subclasses[keyof typeof subclasses]>)[entry.subclass] : undefined
    const casting = characterClass?.spellcasting ?? subclass?.spellcasting
    if (!casting) continue
    const table = {...characterClass.table, ...(subclass?.table ?? {})} as Record<string, { values: number[] }>
    const key = characterClass.spellcasting ? `class:${entry.class}` : `subclass:${entry.subclass}`
    const prepared = character.spellcasting.spells.filter((spell) => sourceKey(spell.from) === key && spell.prepared && !spell.alwaysPrepared
      && ((spells as Record<string, { level: number }>)[spell.spell]?.level ?? 0) > 0).length
    result[key] = {limit: table[casting.preparedColumn]?.values[entry.level - 1] ?? 0, prepared}
  }
  return result
}

//prepare / unprepare one class spell entry within that class's prepared count; always-prepared ones are fixed
export function setPrepared(character: ICharacter, spellId: string, source: string, prepared: boolean): Outcome<ICharacter['spellcasting']['spells']> {
  const index = character.spellcasting.spells.findIndex((entry) => entry.spell === spellId && sourceKey(entry.from) === source)
  if (index < 0) return refuse('Заклинание не найдено')
  const entry = character.spellcasting.spells[index]
  if (entry.alwaysPrepared) return refuse('Это заклинание подготовлено всегда')
  if (((spells as Record<string, { level: number }>)[spellId]?.level ?? 0) === 0) return refuse('Заговоры не подготавливаются')
  if (prepared && !entry.prepared) {
    const limit = preparedLimits(character)[source]
    if (limit && limit.prepared >= limit.limit) return refuse(`Подготовлено максимум: ${limit.limit}`)
  }
  return {ok: true, value: character.spellcasting.spells.map((candidate, position) => position === index ? {...candidate, prepared} : candidate)}
}

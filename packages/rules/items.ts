//What an inventory entry is in play: a magic item built on a base («Оружие +1» on a longsword) reads as that base plus its bonus.
//Pure: names, slots, attacks and armor of an entry from its two ids (item + base); the rulebook is never copied into the entry.
import {InventoryEntry} from "../interfaces/DB/Character"
import {Action} from "../interfaces/pure/Action"
import {Formula} from "../types/internal/Formula"
import {BaseItem, Item} from "../types/book/items"
import {ItemId, items} from "../data/loader"
import {Armor, ENArmorClass} from "../types/book/items"
import {armor} from "../data/loader"
import {basicWeapon} from "../data/loader"
import {ammo} from "../data/loader"
import {BaseKind, MagicItem} from "../types/book/items"

type Entry = Pick<InventoryEntry, 'item' | 'base'>

const registry = items as Record<string, Item | undefined>
const armorOfClass = (armorClass: ENArmorClass) => Object.values(armor).filter((piece: Armor) => piece.armorClass === armorClass).map((piece) => piece.id as ItemId)

//every mundane item a «любой …» requirement admits
const kindMembers: Record<BaseKind, ItemId[]> = {
  weapon: Object.keys(basicWeapon) as ItemId[],
  meleeWeapon: Object.values(basicWeapon).filter((weapon) => weapon.equipment?.properties?.includes('melee')).map((weapon) => weapon.id as ItemId),
  ammo: Object.keys(ammo) as ItemId[],
  lightArmor: armorOfClass('lightArmor'),
  mediumArmor: armorOfClass('mediumArmor'),
  heavyArmor: armorOfClass('heavyArmor')
}

//tiered «+N» families read as the base's own name: «Длинный меч +1»; anything else as «Пылающий язык (длинный меч)»
const plusFamilies = ['weaponPlus', 'armorPlus', 'shieldPlus', 'ammunitionPlus']

export const itemOf = (id: string) => registry[id]
const magicOf = (id: string) => registry[id] as MagicItem | undefined

//the bases a magic item may be built on, empty for an item that needs none
export function baseChoices(itemId: string): ItemId[] {
  const magic = magicOf(itemId)
  if (!magic) return []
  return [...new Set([...(magic.baseItems ?? []) as ItemId[], ...(magic.baseKinds ?? []).flatMap((kind) => kindMembers[kind])])]
}

//the entry's item and its base, the base only when it is one the item admits
export function entryParts(entry: Entry): { item?: Item; base?: Item } {
  const item = itemOf(entry.item)
  const base = entry.base && baseChoices(entry.item).includes(entry.base) ? itemOf(entry.base) : undefined
  return {item, base}
}

//«Длинный меч +1», «Пылающий язык (длинный меч)», or the item's own name
export function entryName(entry: Entry): string {
  const {item, base} = entryParts(entry)
  if (!item) return entry.item
  if (!base) return item.name
  const magic = item as MagicItem
  const plus = magic.bonus?.attack ?? magic.bonus?.armorClass
  return plusFamilies.includes(magic.variantOf ?? '') && plus ? `${base.name} +${plus}` : `${item.name} (${base.name.toLowerCase()})`
}

//slots and properties: the item's own, else its base's
export const entryEquipment = (entry: Entry): BaseItem['equipment'] => {
  const {item, base} = entryParts(entry)
  return item?.equipment ?? base?.equipment
}

//kind for pack use: magic arrows are ammo like their base
export const entryType = (entry: Entry) => {
  const {item, base} = entryParts(entry)
  return base?.type ?? item?.type
}

//+N into a damage formula: inside the first typed group «(1d8 + mod + 1)[slashing]», else at the end
const addToDamage = (damage: Formula, bonus: number) =>
  (damage.includes(')[') ? damage.replace(')[', ` + ${bonus})[`) : `${damage} + ${bonus}`) as Formula

//the base's attacks with the magic bonus stamped in (static text, Doctrine), then the item's own actions; ids stay unique per pair
export function entryActions(entry: Entry): Action[] {
  const {item, base} = entryParts(entry)
  const own = (item as { actions?: Action[] } | undefined)?.actions ?? []
  if (!item || !base) return own
  const magic = item as MagicItem
  const plus = plusFamilies.includes(magic.variantOf ?? '') ? magic.bonus?.attack : undefined
  const fromBase = ((base as { actions?: Action[] }).actions ?? []).map((action): Action => {
    const stamped = {...action, id: `${action.id}:${item.id}`, name: plus ? `${action.name} +${plus}` : `${action.name} (${item.name})`}
    if ('attack' in stamped && stamped.attack && magic.bonus?.attack) stamped.attack = `${stamped.attack} + ${magic.bonus.attack}` as Formula
    if ('damage' in stamped && stamped.damage && magic.bonus?.damage) stamped.damage = addToDamage(stamped.damage, magic.bonus.damage)
    return stamped
  })
  return [...fromBase, ...own]
}

//the armor an entry is when worn: its AC formula (own or the base's) and the magic bonus on top
export function entryArmor(entry: Entry): { AC: Formula; armorClass: ENArmorClass; bonus: number } | undefined {
  const {item, base} = entryParts(entry)
  const piece = [item, base].find((part): part is Armor => !!part && 'AC' in part)
  if (!piece) return undefined
  return {AC: piece.AC, armorClass: piece.armorClass, bonus: (item as MagicItem).bonus?.armorClass ?? 0}
}

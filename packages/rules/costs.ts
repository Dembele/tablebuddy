//What a request may spend and how a verdict spends it (Doctrine: the player picks the cost, the DM validates, nothing else changes).
//Pure: options from the stored character, affordability checks, the spent fields; rests restore to evaluated maxima.

import {CharacterAction, CharacterSpell, EvaluatedCharacter, GrantSource, ICharacter, InventoryEntry, SlotLevel} from "../interfaces/DB/Character"
import {HitDice} from "../types/Character"
import {spells} from "../data/loader"
import {entryName, entryParts, entryType} from "./items"
import {ammo as ammoList} from "../data/loader"

export type Cost =
  | { kind: 'none' }
  | { kind: 'slot'; level: SlotLevel }
  | { kind: 'pactSlot' }
  | { kind: 'freeCast'; spell: string; source: string }
  | { kind: 'resource'; name: string; source: string }
  | { kind: 'charges'; entryId: string; amount: number }
  | { kind: 'item'; entryId: string }                                                                                   //one of a consumable stack
  | { kind: 'hitDie'; die: HitDice }

//a cost the player can pick; `slot` = the level a spell is cast at (upcast formula)
export interface CostOption {
  cost: Cost
  label: string
  slot?: SlotLevel
}

export type Changes = Array<{ path: string; value: unknown }>

//what cost options read: satisfied by the stored character and by its evaluated snapshot alike (the sheet computes options on the server)
export interface Affordable {
  spellcasting: {
    slots: Partial<Record<SlotLevel, { current: number } | undefined>>
    pactSlots?: { level: SlotLevel; current: number }
    spells: Array<Pick<CharacterSpell, 'spell' | 'from' | 'freeCast'>>
  }
  inventory: InventoryEntry[]
  resources: Array<{ name: string; from: GrantSource; current: number }>
  hitDice: { current: Record<HitDice, number> }
}

//two costs name the same spending
export const sameCost = (left: Cost, right: Cost) => JSON.stringify(left) === JSON.stringify(right)

export const sourceKey = (source: GrantSource) => source.type === 'custom' ? 'custom' : `${source.type}:${source.id}`
const spellLevel = (id: string) => (spells as Record<string, { level: number } | undefined>)[id]?.level ?? 0

//what an entry's weapon fires: an ammo id («arrow»), 'self' for a dart, nothing for other items
function firedAmmo(entry: InventoryEntry): string | undefined {
  const {item, base} = entryParts(entry)
  const weapon = base ?? item
  const fired = weapon?.type === 'weapon' ? (weapon as { ammo?: unknown }).ammo : undefined
  return typeof fired === 'string' ? fired : undefined
}

//the mundane ammo an entry is (magic arrows count as their base)
const ammoId = (entry: InventoryEntry) => entryType(entry) === 'ammo' ? entry.base ?? entry.item : undefined

//everything the character could spend on this action right now; an empty list = nothing affordable
export function costOptions(character: Affordable, action: Pick<CharacterAction, 'spell' | 'from'>): CostOption[] {
  const {spellcasting} = character
  const source = sourceKey(action.from)

  if (action.spell) {
    const level = spellLevel(action.spell)
    if (level === 0) return [{cost: {kind: 'none'}, label: 'Заговор — без затрат'}]
    const options: CostOption[] = []
    const entry = spellcasting.spells.find((candidate) => candidate.spell === action.spell && sourceKey(candidate.from) === source)
    if (entry?.freeCast?.available) options.push({cost: {kind: 'freeCast', spell: action.spell, source}, label: 'Бесплатное сотворение', slot: level as SlotLevel})
    for (let slotLevel = level; slotLevel <= 9; slotLevel++) {
      const slot = spellcasting.slots[slotLevel as SlotLevel]
      if (slot && slot.current > 0) options.push({cost: {kind: 'slot', level: slotLevel as SlotLevel}, label: `Ячейка ${slotLevel} ур. (осталось ${slot.current})`, slot: slotLevel as SlotLevel})
    }
    const pact = spellcasting.pactSlots
    if (pact && pact.current > 0 && pact.level >= level) options.push({cost: {kind: 'pactSlot'}, label: `Ячейка договора ${pact.level} ур. (осталось ${pact.current})`, slot: pact.level})
    return options
  }

  if (action.from.type === 'item') {
    const itemId = action.from.id
    const options: CostOption[] = []
    const owned = character.inventory.filter((candidate) => candidate.item === itemId)
    const fired = new Set(owned.map(firedAmmo).filter((ammo) => ammo !== undefined))
    //an ammunition weapon spends one piece of what it fires; a dart spends itself
    for (const entry of character.inventory.filter((candidate) => candidate.quantity > 0)) {
      const ammo = ammoId(entry)
      if (ammo && fired.has(ammo)) options.push({cost: {kind: 'item', entryId: entry.id}, label: `${entryName(entry)} (осталось ${entry.quantity})`})
      if (fired.has('self') && entry.item === itemId) options.push({cost: {kind: 'item', entryId: entry.id}, label: `Метнуть (осталось ${entry.quantity})`})
    }
    if (fired.size && !options.length) return [{cost: {kind: 'none'}, label: 'Нет боеприпасов — на усмотрение ГМ'}]
    for (const entry of owned) {
      if ((entry.charges ?? 0) > 0) options.push({cost: {kind: 'charges', entryId: entry.id, amount: 1}, label: `Заряд (осталось ${entry.charges})`})
      if (['potion', 'scroll', 'consumable', 'ammo'].includes(entryType(entry) ?? '') && entry.quantity > 0) options.push({cost: {kind: 'item', entryId: entry.id}, label: `Израсходовать (осталось ${entry.quantity})`})
    }
    return options.length ? options : [{cost: {kind: 'none'}, label: 'Без затрат'}]
  }

  //features: the source's own pools, or nothing (the DM sees which was picked)
  const pools = character.resources.filter((resource) => sourceKey(resource.from) === source && resource.current > 0)
    .map((resource) => ({cost: {kind: 'resource', name: resource.name, source} as Cost, label: `${resource.name} (осталось ${resource.current})`}))
  return [...pools, {cost: {kind: 'none'}, label: 'Без затрат'}]
}

//hit die spending for a short-rest heal roll
export const hitDieOptions = (character: Pick<Affordable, 'hitDice'>): CostOption[] =>
  (Object.entries(character.hitDice.current) as Array<[HitDice, number]>).filter(([, count]) => count > 0)
    .map(([die, count]) => ({cost: {kind: 'hitDie', die}, label: `Кость хитов к${die} (осталось ${count})`}))

//fields a verdict writes to spend these costs, or why it cannot (spent elsewhere since the request)
export function spend(character: ICharacter, costs: Cost[]): { ok: true; changes: Changes } | { ok: false; reason: string } {
  const draft = structuredClone(character)
  for (const cost of costs) {
    switch (cost.kind) {
      case 'none': break
      case 'slot': {
        const slot = draft.spellcasting.slots[cost.level]
        if (!slot || slot.current < 1) return {ok: false, reason: `Нет ячеек ${cost.level} уровня`}
        slot.current -= 1
        break
      }
      case 'pactSlot': {
        const pact = draft.spellcasting.pactSlots
        if (!pact || pact.current < 1) return {ok: false, reason: 'Нет ячеек договора'}
        pact.current -= 1
        break
      }
      case 'freeCast': {
        const entry = draft.spellcasting.spells.find((candidate) => candidate.spell === cost.spell && sourceKey(candidate.from) === cost.source)
        if (!entry?.freeCast?.available) return {ok: false, reason: 'Бесплатное сотворение уже потрачено'}
        entry.freeCast.available = false
        break
      }
      case 'resource': {
        const resource = draft.resources.find((candidate) => candidate.name === cost.name && sourceKey(candidate.from) === cost.source)
        if (!resource || resource.current < 1) return {ok: false, reason: `Нет ресурса: ${cost.name}`}
        resource.current -= 1
        break
      }
      case 'charges': {
        const entry = draft.inventory.find((candidate) => candidate.id === cost.entryId)
        if (!entry || (entry.charges ?? 0) < cost.amount) return {ok: false, reason: 'Не хватает зарядов'}
        entry.charges = (entry.charges ?? 0) - cost.amount
        break
      }
      case 'item': {
        const entry = draft.inventory.find((candidate) => candidate.id === cost.entryId)
        if (!entry || entry.quantity < 1) return {ok: false, reason: 'Предмет закончился'}
        entry.quantity -= 1
        if (ammoId(entry)) entry.spent = (entry.spent ?? 0) + 1                                                           //fired ammo waits to be picked up, so an empty quiver stays listed
        else if (entry.quantity === 0) draft.inventory = draft.inventory.filter((candidate) => candidate.id !== entry.id)
        break
      }
      case 'hitDie': {
        if (draft.hitDice.current[cost.die] < 1) return {ok: false, reason: `Нет костей хитов к${cost.die}`}
        draft.hitDice.current[cost.die] -= 1
        break
      }
    }
  }
  return {ok: true, changes: changedFields(character, draft)}
}

//fired ammo that can come back: 2024 — half, rounded down (needles never), per stack
export function recoverable(character: Pick<ICharacter, 'inventory'>): Array<{ entryId: string; name: string; spent: number; back: number }> {
  return character.inventory.flatMap((entry) => {
    const ammo = ammoId(entry)
    if (!ammo || !entry.spent) return []
    const share = (ammoList as Record<string, { ammo: { recoverable?: number } } | undefined>)[ammo]?.ammo.recoverable ?? 0.5
    return [{entryId: entry.id, name: entryName(entry), spent: entry.spent, back: Math.floor(entry.spent * share)}]
  })
}

//the pick-up the DM ruled on: found = the recoverable part returns; either way the count starts over and empty stacks go
export function recover(character: ICharacter, found: boolean): Changes {
  const draft = structuredClone(character)
  const back = new Map(recoverable(character).map((entry) => [entry.entryId, entry.back]))
  draft.inventory = draft.inventory.flatMap((entry) => {
    if (!back.has(entry.id)) return [entry]
    const {spent: _counted, ...rest} = entry
    const quantity = entry.quantity + (found ? back.get(entry.id)! : 0)
    return quantity > 0 ? [{...rest, quantity}] : []
  })
  return changedFields(character, draft)
}

//a rest the DM allowed: pools and slots back to their evaluated maxima (long rest: also HP, all hit dice, death saves)
export function rest(character: ICharacter, evaluated: EvaluatedCharacter, kind: 'short' | 'long'): Changes {
  const draft = structuredClone(character)
  const resets = kind === 'long' ? ['shortRest', 'longRest', 'turnStart'] : ['shortRest', 'turnStart']
  draft.resources.forEach((resource, index) => {
    if (resets.includes(resource.resetsOn)) resource.current = evaluated.resources[index]?.max ?? resource.current
  })
  for (const entry of draft.spellcasting.spells) if (entry.freeCast && resets.includes(entry.freeCast.resetsOn)) entry.freeCast.available = true
  if (draft.spellcasting.pactSlots && evaluated.spellcasting.pactSlots) draft.spellcasting.pactSlots.current = evaluated.spellcasting.pactSlots.max
  if (kind === 'long') {
    for (const [level, slot] of Object.entries(draft.spellcasting.slots)) {
      const max = evaluated.spellcasting.slots[level as unknown as SlotLevel]?.max
      if (slot && max !== undefined) slot.current = max
    }
    draft.hitPoints.current = evaluated.hitPoints.max
    draft.hitPoints.temp = 0
    draft.hitDice.current = {...draft.hitDice.max}
    draft.deathSavingThrows = {...draft.deathSavingThrows, success: 0, failure: 0, isStable: false}
  }
  return changedFields(character, draft)
}

//top-level fields that differ, as whole values (one setProperty each)
function changedFields(before: ICharacter, after: ICharacter): Changes {
  const fields = ['spellcasting', 'resources', 'inventory', 'hitDice', 'hitPoints', 'deathSavingThrows'] as const
  return fields.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])).map((field) => ({path: field, value: after[field]}))
}

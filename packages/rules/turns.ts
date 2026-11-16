//Initiative order (Doctrine: every change is a DM press; the list is display state, no game logic reads it). Pure:
//each function returns the next order, or a refusal as a string. The backend stores it, clients only draw it.

import {TurnEntry, TurnOrder} from "../interfaces/shared/TurnOrder"

export const emptyTurnOrder = (): TurnOrder => ({round: 1, current: null, entries: []})

const maxEntries = 80
const maxName = 60

//a typed or rolled initiative: a number within reason, one decimal kept so the DM can break ties (15.5)
export function cleanInitiative(value: unknown): number | null | string {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -50 || value > 99) return 'Инициатива — число от −50 до 99'
  return Math.round(value * 10) / 10
}

//whatever was stored, as a valid order (older documents kept another shape)
export function readTurnOrder(stored: unknown): TurnOrder {
  const raw = (stored ?? {}) as Partial<TurnOrder>
  const entries = (Array.isArray(raw.entries) ? raw.entries : []).flatMap((entry): TurnEntry[] => {
    if (!entry || typeof entry.id !== 'string') return []
    const initiative = cleanInitiative(entry.initiative)
    return [{
      id: entry.id, initiative: typeof initiative === 'string' ? null : initiative, hidden: !!entry.hidden,
      ...(entry.characterId ? {characterId: String(entry.characterId)} : {}), ...(entry.name ? {name: String(entry.name)} : {})
    }]
  })
  const current = typeof raw.current === 'string' && entries.some((entry) => entry.id === raw.current) ? raw.current : null
  return {round: Number.isInteger(raw.round) && (raw.round as number) > 0 ? raw.round as number : 1, current, entries}
}

//turn sequence: highest initiative first, unset ones last, ties in the order they were added
export function ordered(entries: TurnEntry[]): TurnEntry[] {
  return entries.map((entry, index) => ({entry, index}))
    .sort((left, right) => (right.entry.initiative ?? -Infinity) - (left.entry.initiative ?? -Infinity) || left.index - right.index)
    .map(({entry}) => entry)
}

//new lines, or new numbers for characters already listed (one line per character)
export function addEntries(order: TurnOrder, additions: TurnEntry[]): TurnOrder | string {
  const entries = [...order.entries]
  for (const addition of additions) {
    const initiative = cleanInitiative(addition.initiative)
    if (typeof initiative === 'string') return initiative
    const listed = addition.characterId ? entries.findIndex((entry) => entry.characterId === addition.characterId) : -1
    if (listed !== -1) {
      if (initiative !== null) entries[listed] = {...entries[listed], initiative}
      continue
    }
    const name = addition.name?.trim().slice(0, maxName)
    if (!addition.characterId && !name) return 'Строке нужно имя'
    entries.push({id: addition.id, initiative, hidden: !!addition.hidden, ...(addition.characterId ? {characterId: addition.characterId} : {name})})
  }
  if (entries.length > maxEntries) return `В порядке ходов не больше ${maxEntries} строк`
  return {...order, entries}
}

//one line changed: its number and / or its eye switch
export function patchEntry(order: TurnOrder, entryId: string, patch: { initiative?: unknown; hidden?: unknown }): TurnOrder | string {
  const entry = order.entries.find((candidate) => candidate.id === entryId)
  if (!entry) return 'Строка не найдена'
  const next = {...entry}
  if ('initiative' in patch) {
    const initiative = cleanInitiative(patch.initiative)
    if (typeof initiative === 'string') return initiative
    next.initiative = initiative
  }
  if (typeof patch.hidden === 'boolean') next.hidden = patch.hidden
  return {...order, entries: order.entries.map((candidate) => candidate.id === entryId ? next : candidate)}
}

//lines taken out; when the current one goes, the turn passes to whoever followed it
export function removeEntries(order: TurnOrder, gone: (entry: TurnEntry) => boolean): TurnOrder {
  const entries = order.entries.filter((entry) => !gone(entry))
  if (entries.length === order.entries.length) return order
  if (!entries.length) return emptyTurnOrder()
  if (!order.current || entries.some((entry) => entry.id === order.current)) return {...order, entries}
  const sequence = ordered(order.entries)
  const position = sequence.findIndex((entry) => entry.id === order.current)
  const follower = [...sequence.slice(position + 1), ...sequence.slice(0, position)].find((entry) => !gone(entry))
  return {...order, entries, current: follower?.id ?? null}
}

//next / previous turn; past the end starts a new round, back from the first returns to the round before
export function step(order: TurnOrder, direction: 1 | -1): TurnOrder {
  const sequence = ordered(order.entries)
  if (!sequence.length) return order
  const position = sequence.findIndex((entry) => entry.id === order.current)
  if (position === -1) return {...order, current: sequence[0].id}
  const target = position + direction
  if (target >= sequence.length) return {...order, current: sequence[0].id, round: order.round + 1}
  if (target < 0) return order.round > 1 ? {...order, current: sequence[sequence.length - 1].id, round: order.round - 1} : order
  return {...order, current: sequence[target].id}
}

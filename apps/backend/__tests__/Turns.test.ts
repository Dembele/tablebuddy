//Initiative order (rules/turns): sequence, one line per character, stepping through rounds, removal, stored-shape repair.
import {addEntries, emptyTurnOrder, ordered, patchEntry, readTurnOrder, removeEntries, step} from "@backend/deps/rules/turns"
import {TurnEntry, TurnOrder} from "@backend/deps/interfaces/shared/TurnOrder"

const line = (id: string, initiative: number | null, characterId = id): TurnEntry => ({id, characterId, initiative, hidden: false})

function built(...entries: TurnEntry[]): TurnOrder {
  const order = addEntries(emptyTurnOrder(), entries)
  if (typeof order === 'string') throw new Error(order)
  return order
}

describe('Turns', () => {
  test('highest initiative first, ties in the order added, unset last', () => {
    const order = built(line('fighter', 12), line('goblin', null), line('wizard', 17), line('rogue', 12))
    expect(ordered(order.entries).map((entry) => entry.id)).toEqual(['wizard', 'fighter', 'rogue', 'goblin'])
  })

  test('a listed character only takes the new number; a free line needs a name', () => {
    const order = built(line('fighter', 12))
    const again = addEntries(order, [{id: 'other', characterId: 'fighter', initiative: 19, hidden: false}])
    if (typeof again === 'string') throw new Error(again)
    expect(again.entries).toEqual([{id: 'fighter', characterId: 'fighter', initiative: 19, hidden: false}])
    expect(typeof addEntries(order, [{id: 'trap', initiative: 20, hidden: true}])).toBe('string')
    const withTrap = addEntries(order, [{id: 'trap', name: ' Ловушка ', initiative: 20, hidden: true}])
    if (typeof withTrap === 'string') throw new Error(withTrap)
    expect(withTrap.entries[1]).toEqual({id: 'trap', name: 'Ловушка', initiative: 20, hidden: true})
  })

  test('stepping walks the sequence, wraps into the next round and back', () => {
    let order = built(line('fighter', 12), line('wizard', 17))
    order = step(order, 1)
    expect(order).toMatchObject({current: 'wizard', round: 1})
    expect(step(order, -1)).toMatchObject({current: 'wizard', round: 1})                                               //nothing before the first turn of round 1
    order = step(order, 1)
    expect(order).toMatchObject({current: 'fighter', round: 1})
    order = step(order, 1)
    expect(order).toMatchObject({current: 'wizard', round: 2})
    expect(step(order, -1)).toMatchObject({current: 'fighter', round: 1})
    expect(step(emptyTurnOrder(), 1)).toEqual(emptyTurnOrder())
  })

  test('numbers are checked and rounded to one decimal; the eye switch flips', () => {
    const order = built(line('fighter', 12))
    expect(typeof patchEntry(order, 'fighter', {initiative: 1000})).toBe('string')
    expect(typeof patchEntry(order, 'nobody', {initiative: 3})).toBe('string')
    const patched = patchEntry(order, 'fighter', {initiative: 15.54, hidden: true})
    if (typeof patched === 'string') throw new Error(patched)
    expect(patched.entries[0]).toMatchObject({initiative: 15.5, hidden: true})
  })

  test('removing the current line passes the turn on; an emptied list starts over', () => {
    const order = step(step(built(line('fighter', 12), line('wizard', 17), line('goblin', 5)), 1), 1)                  //fighter's turn
    const without = removeEntries(order, (entry) => entry.id === 'fighter')
    expect(without).toMatchObject({current: 'goblin', round: 1})
    expect(removeEntries(order, (entry) => entry.id === 'nobody')).toBe(order)
    expect(removeEntries(order, () => true)).toEqual(emptyTurnOrder())
  })

  test('a stored order of another shape reads as a valid one', () => {
    expect(readTurnOrder(undefined)).toEqual(emptyTurnOrder())
    expect(readTurnOrder({currentTurn: 0, round: 1, entries: [{entity: 'x', initiative: 3}]})).toEqual(emptyTurnOrder())
    expect(readTurnOrder({round: 3, current: 'gone', entries: [{id: 'fighter', characterId: 'fighter', initiative: 12, hidden: false}]}))
      .toEqual({round: 3, current: null, entries: [line('fighter', 12)]})
  })
})

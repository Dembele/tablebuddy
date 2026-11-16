//Initiative procedures (events/turn) against a stub room: only the DM changes the list, every change is broadcast whole.
import {registerTurnEvents} from "@backend/events/turn/turnEvents"
import {GameHub} from "@backend/events/main"
import {emptyTurnOrder} from "@backend/deps/rules/turns"
import {TurnOrder} from "@backend/deps/interfaces/shared/TurnOrder"

type Sent = { to: 'all' | 'self'; event: string; payload: unknown }
type Procedure = (context: Record<string, unknown>) => Promise<unknown>

describe('TurnEvents', () => {
  const procedures: Record<string, Procedure> = {}
  registerTurnEvents({procedure: (name: string, handler: Procedure) => { procedures[name] = handler }} as unknown as GameHub)

  const room = {
    turnOrder: emptyTurnOrder() as TurnOrder,
    hasCharacter: (characterId: string) => ['fighter', 'wizard'].includes(characterId)
  }

  //run one procedure as the DM or a player; what it sent, in order
  async function call(name: string, data: unknown, role: 'ГМ' | 'Игрок' = 'ГМ'): Promise<Sent[]> {
    const sent: Sent[] = []
    await procedures[name]({
      data, room, user: {_id: 'user', username: 'tester', role},
      $all: (event: string, payload: unknown) => sent.push({to: 'all', event, payload}),
      $self: (event: string, payload: unknown) => sent.push({to: 'self', event, payload})
    })
    return sent
  }

  test('a player changes nothing and is told so', async () => {
    const sent = await call('turn-add', {characterIds: ['fighter']}, 'Игрок')
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({to: 'self', event: 'system-message'})
    expect(room.turnOrder.entries).toHaveLength(0)
    expect((await call('turn-step', {direction: 1}, 'Игрок'))[0].to).toBe('self')
    expect((await call('turn-clear', undefined, 'Игрок'))[0].to).toBe('self')
  })

  test('the DM adds campaign characters (strangers skipped) and a free line; everyone gets the list', async () => {
    const sent = await call('turn-add', {characterIds: ['fighter', 'stranger', 'wizard'], initiative: 11})
    expect(sent).toEqual([{to: 'all', event: 'turn-order', payload: {turnOrder: room.turnOrder}}])
    expect(room.turnOrder.entries.map((entry) => entry.characterId)).toEqual(['fighter', 'wizard'])
    await call('turn-add', {custom: {name: 'Ловушка', hidden: true}, initiative: 20})
    expect(room.turnOrder.entries[2]).toMatchObject({name: 'Ловушка', initiative: 20, hidden: true})
    expect((await call('turn-add', {characterIds: ['stranger']}))[0].to).toBe('self')
  })

  test('numbers, the eye switch, stepping, removal and clearing', async () => {
    const wizard = room.turnOrder.entries.find((entry) => entry.characterId === 'wizard')!
    await call('turn-patch', {entryId: wizard.id, initiative: 18})
    expect((await call('turn-patch', {entryId: wizard.id, initiative: 500}))[0]).toMatchObject({to: 'self', event: 'system-message'})
    await call('turn-step', {direction: 1})
    expect(room.turnOrder.current).toBe(room.turnOrder.entries.find((entry) => entry.name === 'Ловушка')!.id)
    await call('turn-step', {direction: 1})
    expect(room.turnOrder.current).toBe(wizard.id)
    await call('turn-remove', {entryId: wizard.id})
    expect(room.turnOrder.entries).toHaveLength(2)
    expect(room.turnOrder.current).toBe(room.turnOrder.entries.find((entry) => entry.characterId === 'fighter')!.id)
    const sent = await call('turn-clear', undefined)
    expect(sent[0]).toMatchObject({to: 'all', event: 'turn-order'})
    expect(room.turnOrder).toEqual(emptyTurnOrder())
  })
})

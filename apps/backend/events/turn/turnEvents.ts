//Initiative order procedures (rules/turns): the DM's list — add, number, hide, remove, next / previous turn, clear.
//Display state only (Doctrine): nothing reads it, nothing ticks; every change is a DM press, broadcast whole to the room.
import {randomUUID} from "node:crypto"
import {BroadcastUtils, CampaignRoom, GameHub} from "@backend/events/main"
import {characterManager} from "@backend/services/CharacterManager"
import {evaluator} from "@backend/services/Evaluator"
import {TurnEntry, TurnOrder} from "@backend/deps/interfaces/shared/TurnOrder"
import {addEntries, emptyTurnOrder, patchEntry, removeEntries, step} from "@backend/deps/rules/turns"

const denied = {message: {type: 'system' as const, content: 'Порядок ходов ведёт ГМ'}}
const refusal = (content: string) => ({message: {type: 'system' as const, content}})

//keep the new order and show it to everyone; a string is a refusal for the DM alone
function commit(room: CampaignRoom, next: TurnOrder | string, {$all, $self}: Pick<BroadcastUtils, '$all' | '$self'>) {
  if (typeof next === 'string') return $self('system-message', refusal(next))
  if (next !== room.turnOrder) room.turnOrder = next
  $all('turn-order', {turnOrder: room.turnOrder})
}

export function registerTurnEvents(hub: GameHub) {
  //characters of this campaign (one line each; listed ones only take the number) and / or one free line
  hub.procedure('turn-add', async ({data, user, room, $all, $self}) => {
    if (user.role !== 'ГМ') return $self('system-message', denied)
    const initiative = data.initiative ?? null
    const additions: TurnEntry[] = (data.characterIds ?? []).map(String).filter(characterId => room.hasCharacter(characterId))
      .map(characterId => ({id: randomUUID(), characterId, initiative, hidden: false}))
    if (data.custom) additions.push({id: randomUUID(), name: String(data.custom.name ?? ''), initiative, hidden: !!data.custom.hidden})
    if (!additions.length) return $self('system-message', refusal('Некого добавить в порядок ходов'))
    commit(room, addEntries(room.turnOrder, additions), {$all, $self})
  })

  hub.procedure('turn-patch', async ({data, user, room, $all, $self}) => {
    if (user.role !== 'ГМ') return $self('system-message', denied)
    const patch = {...('initiative' in data ? {initiative: data.initiative} : {}), ...('hidden' in data ? {hidden: data.hidden} : {})}
    commit(room, patchEntry(room.turnOrder, data.entryId, patch), {$all, $self})
  })

  hub.procedure('turn-remove', async ({data, user, room, $all, $self}) => {
    if (user.role !== 'ГМ') return $self('system-message', denied)
    commit(room, removeEntries(room.turnOrder, entry => entry.id === data.entryId), {$all, $self})
  })

  hub.procedure('turn-step', async ({data, user, room, $all, $self}) => {
    if (user.role !== 'ГМ') return $self('system-message', denied)
    commit(room, step(room.turnOrder, data.direction === -1 ? -1 : 1), {$all, $self})
  })

  //the DM's own roll for the lines without a number (or the named ones): the engine rolls each sheet's initiative, the list shows it
  hub.procedure('turn-roll', async ({data, user, room, $all, $self}) => {
    if (user.role !== 'ГМ') return $self('system-message', denied)
    const wanted = data.entryIds
    let order = room.turnOrder
    for (const entry of order.entries) {
      if (!entry.characterId || (wanted ? !wanted.includes(entry.id) : entry.initiative !== null)) continue
      const character = await characterManager.getOrCreateCharacter(entry.characterId)
      const rolled = patchEntry(order, entry.id, {initiative: evaluator.eval('initiative', {character, rollType: 'initiative'}).total})
      if (typeof rolled !== 'string') order = rolled
    }
    commit(room, order, {$all, $self})
  })

  hub.procedure('turn-clear', async ({user, room, $all, $self}) => {
    if (user.role !== 'ГМ') return $self('system-message', denied)
    commit(room, emptyTurnOrder(), {$all, $self})
  })
}

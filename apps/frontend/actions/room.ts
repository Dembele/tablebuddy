'use server'
//Game room access: a one-time socket ticket from the backend (session-checked) and where the browser reaches the socket.
import api from "@frontend/_util/api"
import type {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import type {SubjectChoice} from "@frontend/components/Room/RequestButton"
import {getEvaluatedCharacter} from "@frontend/actions/characters"
import {actionChoices, castChoices, hitDieChoices} from "@frontend/_util/requestChoices"
import {sourceKey} from "@frontend/deps/rules/costs"
import {spellOf} from "@frontend/_util/rulebook"
import {sellPrice} from "@frontend/deps/rules/shop"
import {entryName} from "@frontend/deps/rules/items"

export interface RoomAccess {
  ticket: string
  url: string | null                                                                                                    //SOCKET_PUBLIC_URL when set, else the browser derives it (store/room.ts)
  port: string
}

//what the room's action panel cannot work out in the browser (the rulebook stays on the server): cost choices per action,
//the spell list with printed names, hit dice left. Read from the backend's own snapshot, so access is checked there.
export interface PanelSpell { key: string; spell: string; name: string; level: number; ready: boolean; choices: SubjectChoice[] }
export interface PanelChoices {
  actions: Record<string, SubjectChoice[]>                                                                              //by action id; spell actions are listed under spells instead
  spells: PanelSpell[]
  hitDice: SubjectChoice[]
}

export async function panelChoices(characterId: string): Promise<{ data: PanelChoices | null; message: string }> {
  const {data: character, message} = await getEvaluatedCharacter(characterId)
  if (!character) return {data: null, message}
  const spellcast = (entry: EvaluatedCharacter['spellcasting']['spells'][number]) =>
    character.actions.find((action) => action.spell === entry.spell && sourceKey(action.from) === sourceKey(entry.from))
  return {
    message,
    data: {
      actions: Object.fromEntries(character.actions.filter((action) => !action.spell).map((action) => [action.id, actionChoices(character, action)])),
      spells: character.spellcasting.spells.map((entry, index) => {
        const action = spellcast(entry)                                                                                 //the spell's own roll when it has one, a plain cast otherwise
        const level = spellOf(entry.spell)?.level ?? 0
        return {
          key: `${entry.spell}-${index}`, spell: entry.spell, name: spellOf(entry.spell)?.name ?? entry.spell, level,
          ready: level === 0 || entry.prepared || !!entry.alwaysPrepared,
          choices: action ? actionChoices(character, action) : castChoices(character, entry)
        }
      }),
      hitDice: hitDieChoices(character)
    }
  }
}

export async function roomAccess(campaignId: string): Promise<{ data: RoomAccess | null; message: string }> {
  const {data, message} = await api<{ ticket: string }>('post', `/campaign/${campaignId}/socket-ticket`)
  if (!data) return {data: null, message}
  return {data: {ticket: data.ticket, url: process.env.SOCKET_PUBLIC_URL ?? null, port: process.env.BACKEND_PORT ?? '4000'}, message}
}

//what the shop pays for each unequipped mundane item of a character (half its price, treasure the full price; rules/shop) — the prices stay on the server
export interface SellOffer { entryId: string; name: string; quantity: number; each: number }

export async function sellOffers(characterId: string): Promise<{ data: SellOffer[] | null; message: string }> {
  const {data: character, message} = await getEvaluatedCharacter(characterId)
  if (!character) return {data: null, message}
  return {
    message,
    data: character.inventory.flatMap((entry) => {
      const each = entry.base || entry.equipped ? null : sellPrice(entry.item)
      return each && entry.quantity > 0 ? [{entryId: entry.id, name: entryName(entry), quantity: entry.quantity, each}] : []
    })
  }
}

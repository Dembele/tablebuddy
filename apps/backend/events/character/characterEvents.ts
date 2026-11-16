//Character socket procedures: the same rule-bound choices as REST (rules/choices), for the game room;
//plus the DM's quick controls (rules/adjust) — the DM's direct input, no validation beyond sane numbers (Doctrine).
import {GameHub} from "@backend/events/main"
import {characterManager} from "@backend/services/CharacterManager"
import {equip, itemActions, unequip} from "@backend/deps/rules/choices"
import {adjust} from "@backend/deps/rules/adjust"
import {UserSafe} from "@backend/deps/interfaces/DB/User"
import {ICharacter} from "@backend/deps/interfaces/DB/Character"

//DM: anything; player: owner or listed in usableBy
const mayAccess = (user: UserSafe, character: Pick<ICharacter, 'owner' | 'usableBy'>) =>
  user.role === 'ГМ' || String(character.owner) === String(user._id) || character.usableBy.some(id => String(id) === String(user._id))

export function registerCharacterEvents(hub: GameHub) {
  //DM: damage / heal / temp HP / conditions / death saves on a character of this campaign; the sheet broadcasts itself
  hub.procedure('adjust', async ({data, user, room, $self}) => {
    if (user.role !== 'ГМ') return $self('system-message', {message: {type: 'system', content: 'Недостаточно прав'}})
    const live = await characterManager.getOrCreateCharacter(String(data.characterId))
    if (String(live.pureData.campaign) !== room.campaignId.toString()) return $self('system-message', {message: {type: 'system', content: 'Персонаж из другой кампании'}})
    const changes = adjust(live.evaluatedData, data.adjustment)
    if (typeof changes === 'string') return $self('system-message', {message: {type: 'system', content: changes}})
    for (const change of changes) await live.setProperty(change.path, change.value)
  })

  hub.procedure("revalidate-char", async ({data, $all}) => {
    const updated = await characterManager.revalidateCharacter(data.characterId)
    $all('update-character', {character: updated.evaluatedData})
  })

  hub.procedure('equip', async ({data, user, $all, $self}) => {
    const live = await characterManager.getOrCreateCharacter(data.characterId)
    if (!mayAccess(user, live.pureData)) return $self('system-message', {message: {type: 'system', content: 'Этот персонаж вам недоступен'}})
    const outcome = equip(structuredClone(live.pureData) as ICharacter, data.entryId, data.slot)
    if (!outcome.ok) return $self('system-message', {message: {type: 'system', content: outcome.reason}})
    await live.setProperty('inventory', outcome.value)
    $all('update-character', {character: await live.setProperty('actions', itemActions(live.pureData as ICharacter, outcome.value))})
  })

  hub.procedure("unequip", async ({data, user, $all, $self}) => {
    const live = await characterManager.getOrCreateCharacter(data.characterId)
    if (!mayAccess(user, live.pureData)) return $self('system-message', {message: {type: 'system', content: 'Этот персонаж вам недоступен'}})
    const outcome = unequip(structuredClone(live.pureData) as ICharacter, data.entryId)
    if (!outcome.ok) return $self('system-message', {message: {type: 'system', content: outcome.reason}})
    await live.setProperty('inventory', outcome.value)
    $all('update-character', {character: await live.setProperty('actions', itemActions(live.pureData as ICharacter, outcome.value))})
  })
}

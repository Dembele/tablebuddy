//Request queue (Doctrine): a request is checked against what the character has and rolled at once (dice go to the DM only);
//the DM's verdict spends the picked costs (allow / fail) and posts the result, or drops it all (deny). Results are never applied.
import {randomUUID} from "node:crypto"
import {GameHub} from "@backend/events/main"
import {characterManager} from "@backend/services/CharacterManager"
import {CharacterAPI} from "@backend/services/Character"
import {evaluator} from "@backend/services/Evaluator"
import {rollAction} from "@backend/services/ActionRoller"
import {getIntroduce, handleMessage} from "@backend/events/_utils/handleMessage"
import {RollContent} from "@backend/deps/interfaces/DB/Chat"
import {ICharacter} from "@backend/deps/interfaces/DB/Character"
import {UserSafe} from "@backend/deps/interfaces/DB/User"
import {ActionRequest, RequestSubject} from "@backend/deps/interfaces/shared/ActionRequest"
import {Cost, CostOption, costOptions, hitDieOptions, recover, recoverable, rest, sameCost, sourceKey, spend} from "@backend/deps/rules/costs"
import {RollType, rollTypeToTitleMap} from "@backend/deps/types/internal/RollType"
import {spells} from "@backend/deps/data/loader"
import {itemActions} from "@backend/deps/rules/choices"

type Prepared = Pick<ActionRequest, 'title' | 'costLabel' | 'warnings' | 'content'>

const mayAccess = (user: UserSafe, character: Pick<ICharacter, 'owner' | 'usableBy'>) =>
  user.role === 'ГМ' || String(character.owner) === String(user._id) || character.usableBy.some(id => String(id) === String(user._id))

const spellInfo = (id: string) => (spells as Record<string, { name: string; level: number } | undefined>)[id]
const restTitle = {short: 'Короткий отдых', long: 'Продолжительный отдых'} as const
const checkPrefixes = ['skill.', 'save.', 'initiative']

//a spell the character may not cast as is: the DM sees the warning and decides
function spellWarnings(character: CharacterAPI, spell: string, source: string, cost: Cost): string[] {
  if ((spellInfo(spell)?.level ?? 0) === 0 || cost.kind === 'freeCast') return []
  const entry = character.pureData.spellcasting.spells.find(candidate => candidate.spell === spell && sourceKey(candidate.from) === source)
  return entry && !entry.prepared && !entry.alwaysPrepared ? ['Заклинание не подготовлено'] : []
}

//the picked option among those the character actually has, or why not
function pickOption(options: CostOption[], cost: Cost): CostOption | string {
  return options.find(option => sameCost(option.cost, cost)) ?? 'Эта цена сейчас недоступна'
}

//what the request asks, checked and rolled now; a string = refusal
export function prepare(character: CharacterAPI, subject: RequestSubject): Prepared | string {
  switch (subject.kind) {
    case 'action': {
      const action = character.pureData.actions.find(candidate => candidate.id === subject.actionId)
      if (!action) return 'Действие не найдено'
      const option = pickOption(costOptions(character.pureData, action), subject.cost)
      if (typeof option === 'string') return option
      const source = sourceKey(action.from)
      return {
        title: action.name, costLabel: option.label,
        warnings: action.spell ? spellWarnings(character, action.spell, source, subject.cost) : [],
        content: rollAction(action, character, option.slot)
      }
    }
    case 'cast': {
      const info = spellInfo(subject.spell)
      if (!info) return 'Заклинание не найдено'
      const source = sourceKey(subject.from)
      const known = character.pureData.spellcasting.spells.some(entry => entry.spell === subject.spell && sourceKey(entry.from) === source)
      if (!known) return 'Персонаж не знает этого заклинания'
      const option = pickOption(costOptions(character.pureData, {spell: subject.spell, from: subject.from}), subject.cost)
      if (typeof option === 'string') return option
      return {title: info.name, costLabel: option.label, warnings: spellWarnings(character, subject.spell, source, subject.cost), content: {title: info.name, rolls: []}}
    }
    case 'check': {
      if (!(subject.rollType in rollTypeToTitleMap) || !checkPrefixes.some(prefix => subject.rollType.startsWith(prefix))) return 'Неизвестная проверка'
      const rollType: RollType = subject.rollType
      return {
        title: rollTypeToTitleMap[rollType], warnings: [],
        content: {rollType, rolls: [{label: 'roll', output: evaluator.eval(rollType, {character, rollType})}]}
      }
    }
    case 'hitDie': {
      const option = pickOption(hitDieOptions(character.pureData), {kind: 'hitDie', die: subject.die})
      if (typeof option === 'string') return option
      const rollType = `hitDie.${subject.die}` as RollType
      return {title: 'Кость хитов', costLabel: option.label, warnings: [], content: {rollType, rolls: [{label: 'roll', output: evaluator.eval(rollType, {character, rollType})}]}}
    }
    case 'rest':
      if (subject.rest !== 'short' && subject.rest !== 'long') return 'Неизвестный отдых'
      return {title: restTitle[subject.rest], warnings: [], content: {rest: subject.rest, rolls: []}}
    case 'resource': {
      if (typeof subject.name !== 'string' || !subject.from) return 'Неизвестный ресурс'
      const source = sourceKey(subject.from)
      const pool = character.pureData.resources.find((resource) => resource.name === subject.name && sourceKey(resource.from) === source)
      if (!pool) return 'Ресурс не найден'
      if (pool.current < 1) return `${pool.name}: использования закончились`
      return {title: pool.name, costLabel: `${pool.name} (осталось ${pool.current})`, warnings: [], content: {rolls: []}}
    }
    case 'recover': {
      const found = recoverable(character.pureData)
      if (!found.length) return 'Нечего собирать: выстрелов не было'
      return {title: 'Сбор боеприпасов', costLabel: found.map((entry) => `${entry.name}: +${entry.back} из ${entry.spent}`).join(', '), warnings: [], content: {rolls: []}}
    }
    case 'formula': {
      if (typeof subject.formula !== 'string' || !subject.formula.trim()) return 'Пустая формула'
      return {title: subject.formula, warnings: [], content: {formula: subject.formula, rolls: [{label: 'roll', output: evaluator.eval(subject.formula, {character})}]}}
    }
    default:
      return 'Неизвестный запрос'
  }
}

//what the verdict spends for this subject
export const costsOf = (subject: RequestSubject): Cost[] =>
  subject.kind === 'action' || subject.kind === 'cast' ? [subject.cost]
    : subject.kind === 'hitDie' ? [{kind: 'hitDie', die: subject.die}]
      : subject.kind === 'resource' ? [{kind: 'resource', name: subject.name, source: sourceKey(subject.from)}]
      : []

export function registerRequestEvents(hub: GameHub) {
  hub.procedure('request', async ({data, user, room, $self, $requests}) => {
    const character = await characterManager.getOrCreateCharacter(data.characterId)
    if (!mayAccess(user, character.pureData)) return $self('system-message', {message: {type: 'system', content: 'Этот персонаж вам недоступен'}})
    if (String(character.pureData.campaign) !== room.campaignId.toString()) return $self('system-message', {message: {type: 'system', content: 'Персонаж из другой кампании'}})

    const prepared = prepare(character, data.subject)
    if (typeof prepared === 'string') return $self('system-message', {message: {type: 'system', content: prepared}})

    const request: ActionRequest = {
      id: randomUUID(),
      characterId: String(character._id),
      character: {name: character.name, avatar: character.avatar},
      requester: {id: user._id.toString(), username: user.username, role: user.role},
      subject: data.subject,
      createdAt: Date.now(),
      ...prepared
    }
    room.requests.set(request.id, request)
    $requests()
  })

  hub.procedure('cancel-request', async ({data, user, room, $requests}) => {
    const request = room.requests.get(data.requestId)
    if (!request || (user.role !== 'ГМ' && request.requester.id !== user._id.toString())) return
    room.requests.delete(request.id)
    $requests()
  })

  hub.procedure('verdict', async ({data, user, campaign, room, $all, $self, $player, $requests}) => {
    if (user.role !== 'ГМ') return $self('system-message', {message: {type: 'system', content: 'Решает только ГМ'}})
    const request = room.requests.get(data.requestId)
    if (!request) return $self('system-message', {message: {type: 'system', content: 'Запрос уже решён'}})
    room.requests.delete(request.id)

    if (data.verdict !== 'deny') {
      const character = await characterManager.getOrCreateCharacter(request.characterId)
      const spent = spend(character.pureData as ICharacter, costsOf(request.subject))
      if (!spent.ok) {
        const notice = {message: {type: 'system' as const, content: `«${request.title}»: ${spent.reason} — запрос снят`}}
        $self('system-message', notice)
        $player(request.requester.id, 'system-message', notice)
        return $requests()
      }
      for (const change of spent.changes) await character.setProperty(change.path, change.value)
      if (spent.changes.some(change => change.path === 'inventory'))                                                  //a stack used up takes its action along
        await character.setProperty('actions', itemActions(character.pureData as ICharacter, (character.pureData as ICharacter).inventory))
      if (request.subject.kind === 'recover') {                                                                      //fail = searched and found nothing
        for (const change of recover(character.pureData as ICharacter, data.verdict === 'allow')) await character.setProperty(change.path, change.value)
      }
      if (request.subject.kind === 'rest' && data.verdict === 'allow') {
        for (const change of rest(character.pureData as ICharacter, character.evaluatedData, request.subject.rest)) await character.setProperty(change.path, change.value)
      }

      const content: RollContent = {...request.content, rolls: request.content?.rolls ?? [], title: request.title, cost: request.costLabel, failed: data.verdict === 'fail'}
      const message = await handleMessage({
        type: 'roll',
        campaignId: campaign._id.toString(),
        sender: {_id: request.requester.id, username: request.requester.username, role: request.requester.role},
        introduceAsCharacter: getIntroduce(character),
        content
      })
      room.addMessage(message)
      $all('chat-message', {message})
    }
    $requests()
  })
}

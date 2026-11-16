'use client'
//Action panel of the game room (Doctrine: players act through buttons): everything a character can ask the DM for without leaving
//the map, most used first: cantrips, attacks, abilities with their pools, saves, skills, leveled spells, items, rests, a free roll. Shows the selected token one may play, else the picked or own
//character. Numbers come from the room's live snapshot; cost choices and spell names from the server (actions/room.panelChoices).
import {ReactNode, useEffect, useState} from "react"
import {FaCircleInfo, FaRegFileLines} from "react-icons/fa6"
import {useRoomStore} from "@frontend/store/room"
import {useGameUI} from "@frontend/components/Game/GameUI"
import {mayControl} from "@frontend/components/Game/Canvas/geometry"
import {PanelChoices, panelChoices} from "@frontend/actions/room"
import type {CharacterAction, EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import {attributeMap} from "@frontend/deps/types/Attribute"
import {skillAttributeMap, skillMap} from "@frontend/deps/types/Skill"
import {resetMap} from "@frontend/deps/types/Reset"
import {typedKeys} from "@frontend/deps/_util/translationMap"
import {attributeShort, signed} from "@frontend/_util/labels"
import RequestButton from "@frontend/components/Room/RequestButton"
import ActionSummary from "@frontend/components/Room/ActionSummary"
import {ConditionBadges} from "@frontend/components/Game/ConditionIcons"
import {Health} from "@frontend/components/Game/Panels"
import Avatar from "@frontend/components/UI/Avatar"
import IconButton from "@frontend/components/UI/IconButton"

const skills = typedKeys(skillMap).sort((a, b) => skillMap[a].localeCompare(skillMap[b]))

//initiative, and the death save while down
function Checks({character}: { character: EvaluatedCharacter }) {
  const id = String(character._id)
  const initiative = character.initiative.value + (character.initiative.proficiency ? character.proficiency : 0)
  return (
    <div className="actions__grid actions__grid--two">
      <RequestButton characterId={id} className="tb-ask" choices={[{label: 'Инициатива', subject: {kind: 'check', rollType: 'initiative'}}]}><span>Инициатива</span><b>{signed(initiative)}</b></RequestButton>
      {character.hitPoints.current <= 0 && (
        <RequestButton characterId={id} className="tb-ask" choices={[{label: 'Спасбросок от смерти', subject: {kind: 'check', rollType: 'save.death'}}]}><span>От смерти</span><b>к20</b></RequestButton>
      )}
    </div>
  )
}

function Saves({character}: { character: EvaluatedCharacter }) {
  const id = String(character._id)
  return (
    <details className="tb-section" open>
      <summary><span className="tb-eyebrow">Спасброски</span></summary>
      <div className="actions__grid">
        {typedKeys(attributeMap).map((attribute) => {
          const save = character.savingThrows[attribute]
          return (
            <RequestButton key={attribute} characterId={id} className={`tb-ask ${save.proficiency ? 'is-proficient' : ''}`} title={`Спасбросок: ${attributeMap[attribute]}`}
                           choices={[{label: attributeMap[attribute], subject: {kind: 'check', rollType: `save.${attribute}`}}]}>
              <span>{attributeShort(attribute)}</span><b>{signed(save.value + (save.proficiency ? character.proficiency : 0))}</b>
            </RequestButton>
          )
        })}
      </div>
    </details>
  )
}

function Skills({character}: { character: EvaluatedCharacter }) {
  const id = String(character._id)
  return (
    <details className="tb-section" open>
      <summary><span className="tb-eyebrow">Навыки</span></summary>
      <div className="actions__grid actions__grid--two">
        {skills.map((skill) => {
          const {value, proficiency, expertise} = character.skills[skill]
          const bonus = value + (expertise ? 2 * character.proficiency : proficiency ? character.proficiency : 0)
          return (
            <RequestButton key={skill} characterId={id} className={`tb-ask ${proficiency || expertise ? 'is-proficient' : ''}`}
                           title={`${skillMap[skill]} (${attributeShort(skillAttributeMap[skill])})${expertise ? ' · компетентность' : proficiency ? ' · владение' : ''}`}
                           choices={[{label: skillMap[skill], subject: {kind: 'check', rollType: `skill.${skill}`}}]}>
              <span className="text-truncate">{skillMap[skill]}</span><b>{signed(bonus)}</b>
            </RequestButton>
          )
        })}
      </div>
    </details>
  )
}

//one titled group of stamped non-spell actions; children sit under the list (the abilities' pools)
function ActionGroup({title, actions, characterId, choices, children}: { title: string; actions: CharacterAction[]; characterId: string; choices: PanelChoices | null; children?: ReactNode }) {
  if (!actions.length && !children) return null
  return (
    <details className="tb-section" open>
      <summary><span className="tb-eyebrow">{title}</span></summary>
      {actions.map((action) => (
        <div key={action.id} className="actions__item">
          <RequestButton characterId={characterId} choices={choices?.actions[action.id] ?? []} loading={!choices} className="btn btn-sm btn-outline-primary py-0">{action.name}</RequestButton>
          <div className="actions__summary"><ActionSummary action={action}/></div>
        </div>
      ))}
      {children}
    </details>
  )
}

//cantrips (cast at will, so on top) or the leveled spells with their slots
function Spells({character, choices, leveled}: { character: EvaluatedCharacter; choices: PanelChoices | null; leveled: boolean }) {
  const {open} = useGameUI()
  const [all, setAll] = useState(false)
  const {spellcasting} = character
  const id = String(character._id)
  const slots = leveled ? Object.entries(spellcasting.slots).flatMap(([level, slot]) => slot?.max ? [{level, ...slot}] : []) : []
  const pact = leveled ? spellcasting.pactSlots : undefined
  const ofRange = (choices?.spells ?? []).filter((spell) => (spell.level > 0) === leveled)
  if (!ofRange.length && !slots.length && !pact) return null
  const list = ofRange.filter((spell) => all || spell.ready)
  const levels = [...new Set(list.map((spell) => spell.level))].sort((a, b) => a - b)
  const unready = ofRange.filter((spell) => !spell.ready).length

  return (
    <details className="tb-section" open>
      <summary><span className="tb-eyebrow">{leveled ? 'Заклинания' : 'Заговоры'}</span></summary>
      {(slots.length > 0 || pact) && (
        <div className="d-flex flex-wrap gap-1 mb-1">
          {slots.map((slot) => <span key={slot.level} className={`tb-chip ${slot.current ? 'tb-chip--accent' : 'is-spent'}`} title={`Ячейки ${slot.level} уровня`}>{slot.level} ур. {slot.current}/{slot.max}</span>)}
          {pact && <span className={`tb-chip ${pact.current ? 'tb-chip--info' : 'is-spent'}`} title="Магия договора">договор {pact.level} ур. {pact.current}/{pact.max}</span>}
        </div>
      )}
      {!choices && <div className="text-muted">Загрузка заклинаний…</div>}
      {levels.map((level) => (
        <div key={level} className="mb-1">
          {leveled && <div className="text-muted">{level} уровень</div>}
          {list.filter((spell) => spell.level === level).map((spell) => {
            const rolled = character.actions.find((action) => action.spell === spell.spell)
            return (
              <div key={spell.key} className="actions__item">
                <div className="d-flex align-items-center gap-1">
                  <RequestButton characterId={id} choices={spell.choices} title="Сотворить" className={`btn btn-sm py-0 ${spell.ready ? 'btn-outline-primary' : 'btn-outline-secondary'}`}>{spell.name}</RequestButton>
                  {!spell.ready && <span className="tb-chip">не подготовлено</span>}
                  <IconButton size="sm" className="ms-auto" label="Описание в справочнике" icon={<FaCircleInfo/>} onClick={() => open(`/compendium/spells/${spell.spell}`, spell.name)}/>
                </div>
                {rolled && <div className="actions__summary"><ActionSummary action={rolled}/></div>}
              </div>
            )
          })}
        </div>
      ))}
      {unready > 0 && <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setAll((current) => !current)}>{all ? 'Только подготовленные' : `Показать неподготовленные (${unready})`}</button>}
    </details>
  )
}

function FreeRoll({characterId}: { characterId: string }) {
  const request = useRoomStore((state) => state.request)
  const connected = useRoomStore((state) => state.connected)
  const [formula, setFormula] = useState('')
  const roll = () => {
    if (!formula.trim()) return
    request(characterId, {kind: 'formula', formula: formula.trim()})
    setFormula('')
  }
  return (
    <div className="d-flex gap-1">
      <input className="form-control form-control-sm" placeholder="Свободный бросок: 2d6+3" value={formula} aria-label="Формула свободного броска"
             onChange={(event) => setFormula(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && roll()}/>
      <button type="button" className="btn btn-sm btn-outline-primary" disabled={!connected || !formula.trim()} onClick={roll}>Бросить</button>
    </div>
  )
}

//whose panel it is: a selected token one may play, else the picked character, else the player's first own one (DM: by selection / pick)
export function useActiveCharacter() {
  const user = useRoomStore((state) => state.user)
  const characters = useRoomStore((state) => state.characters)
  const selected = useRoomStore((state) => state.selected)
  const {actor} = useGameUI()
  const isDM = user?.role === 'ГМ'
  const own = user && !isDM ? Object.values(characters).filter((character) => !character.isTemplate && mayControl(user, character)).sort((a, b) => a.name.localeCompare(b.name)) : []
  const fromSelection = user ? selected.find((id) => characters[id] && mayControl(user, characters[id])) : undefined
  const activeId = fromSelection ?? (actor && characters[actor] ? actor : undefined) ?? (own[0] ? String(own[0]._id) : undefined)
  return {user, isDM, own, fromSelection, activeId, character: activeId ? characters[activeId] : undefined}
}

export default function ActionPanel() {
  const {act, open} = useGameUI()
  const {user, isDM, own, fromSelection, activeId, character} = useActiveCharacter()
  const [loaded, setLoaded] = useState<{ id: string; data: PanelChoices } | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  //choices follow the sheet: asked again whenever the room pushes a new snapshot of this character
  useEffect(() => {
    if (!activeId) return
    let stale = false
    const timer = setTimeout(async () => {
      const {data, message} = await panelChoices(activeId)
      if (stale) return
      setFailure(data ? null : message)
      if (data) setLoaded({id: activeId, data})
    }, 200)
    return () => { stale = true; clearTimeout(timer) }
  }, [activeId, character])

  if (!user) return null
  if (!character || !activeId) {
    return <div className="tb-empty">{isDM ? 'Выберите фишку на карте или нажмите кубик в «Отряде» — здесь появятся действия этого персонажа.' : 'У вас пока нет персонажа в этой кампании. Создайте его в разделе «Персонажи».'}</div>
  }
  const choices = loaded?.id === activeId ? loaded.data : null
  const plain = character.actions.filter((action) => !action.spell)
  const attacks = plain.filter((action) => 'attack' in action && !!action.attack)                                       //weapons, unarmed, monster attacks
  const items = plain.filter((action) => !attacks.includes(action) && action.from.type === 'item')                     //potions, scrolls, wands
  const abilities = plain.filter((action) => !attacks.includes(action) && !items.includes(action))
  const fired = character.inventory.reduce((total, entry) => total + (entry.spent ?? 0), 0)                             //ammo waiting to be picked up

  return (
    <div className="actions">
      <div className="actions__hero">
        <Avatar name={character.name} src={character.avatar}/>
        <div className="tb-row__main">
          <div className="d-flex align-items-center gap-1">
            <span className="tb-row__title tb-title fs-6">{character.name}</span>
            {character.conditions.length > 0 && <span className="d-inline-flex gap-1"><ConditionBadges conditions={character.conditions} size={16} limit={6}/></span>}
          </div>
          <Health character={character}/>
        </div>
        <IconButton label="Лист поверх комнаты" icon={<FaRegFileLines/>} onClick={() => open(`/characters/${activeId}`, character.name)}/>
      </div>
      {own.length > 1 && !fromSelection && (
        <select className="form-select form-select-sm" value={activeId} onChange={(event) => act(event.target.value)} aria-label="Чьи действия">
          {own.map((entry) => <option key={String(entry._id)} value={String(entry._id)}>{entry.name}</option>)}
        </select>
      )}
      {failure && <div className="alert alert-warning mb-0">{failure}</div>}

      <Checks character={character}/>
      <Spells character={character} choices={choices} leveled={false}/>
      <ActionGroup title="Атаки" actions={attacks} characterId={activeId} choices={choices}/>
      <ActionGroup title="Умения" actions={abilities} characterId={activeId} choices={choices}>
        {character.resources.length > 0 && (
          <div className="d-flex flex-wrap gap-1 mt-1">
            {character.resources.map((resource, index) => (
              <RequestButton key={`${resource.name}-${index}`} characterId={activeId} className="btn btn-sm btn-outline-secondary py-0"
                             choices={resource.current > 0 ? [{label: resource.name, subject: {kind: 'resource', name: resource.name, from: resource.from}}] : []}
                             title={resource.current > 0 ? `Потратить одно использование (решает ГМ) · ${resetMap[resource.resetsOn]}` : `Закончилось · ${resetMap[resource.resetsOn]}`}>
                {resource.name} {resource.current}/{resource.max}
              </RequestButton>
            ))}
          </div>
        )}
      </ActionGroup>
      <Saves character={character}/>
      <Skills character={character}/>
      <Spells character={character} choices={choices} leveled/>
      <ActionGroup title="Предметы" actions={items} characterId={activeId} choices={choices}/>

      <details className="tb-section" open>
        <summary><span className="tb-eyebrow">Отдых</span></summary>
        <div className="d-flex flex-wrap gap-1">
          <RequestButton characterId={activeId} choices={choices?.hitDice ?? []} loading={!choices} className="btn btn-sm btn-outline-secondary py-0">Кость хитов</RequestButton>
          <RequestButton characterId={activeId} choices={[{label: 'Короткий отдых', subject: {kind: 'rest', rest: 'short'}}]} className="btn btn-sm btn-outline-success py-0">Короткий отдых</RequestButton>
          <RequestButton characterId={activeId} choices={[{label: 'Продолжительный отдых', subject: {kind: 'rest', rest: 'long'}}]} className="btn btn-sm btn-outline-success py-0">Продолжительный отдых</RequestButton>
        {fired > 0 && <RequestButton characterId={activeId} choices={[{label: 'Собрать боеприпасы', subject: {kind: 'recover'}}]} className="btn btn-sm btn-outline-secondary py-0" title="После боя: вернётся половина выпущенного, если ГМ позволит">Собрать боеприпасы ({fired})</RequestButton>}
        </div>
      </details>

      <FreeRoll characterId={activeId}/>
    </div>
  )
}

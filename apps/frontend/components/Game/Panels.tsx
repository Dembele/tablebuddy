'use client'
//Game room side panels: chat (pending requests pinned on top, then messages + rolls, DM /roll), party (sheets in the drawer, actions,
//DM placement by click or drag, template copies, bestiary picker), selected-token card over the map.
import {DragEvent, FormEvent, useEffect, useRef, useState} from "react"
import {useRoomStore} from "@frontend/store/room"
import {LogEntry, RequestCard} from "@frontend/components/Room/RoomDock"
import {mayControl, playerSees} from "@frontend/components/Game/Canvas/geometry"
import type {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import QuickControls from "@frontend/components/Room/QuickControls"
import {DragPayload, dragType, useGameUI} from "@frontend/components/Game/GameUI"
import {createFromMonster} from "@frontend/actions/characters"
import {creatureTypeMap} from "@frontend/deps/types/Race"
import {ConditionBadges, DeathSaves} from "@frontend/components/Game/ConditionIcons"
import {FaCheck, FaDiceD20, FaEye, FaEyeSlash, FaLocationDot, FaPaperPlane, FaPlus, FaRegClone, FaRegFileLines, FaRegTrashCan, FaUpDownLeftRight, FaXmark} from "react-icons/fa6"
import {GiCrossedSwords} from "react-icons/gi"
import Avatar from "@frontend/components/UI/Avatar"
import IconButton from "@frontend/components/UI/IconButton"

//hit points as a thin bar + numbers, for those who play the character
export function Health({character}: { character: Pick<EvaluatedCharacter, 'hitPoints' | 'armorClass' | 'deathSavingThrows'> }) {
  const {current, max, temp} = character.hitPoints
  const share = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0
  return (
    <div className="tb-row__sub">
      <div className="d-flex align-items-center gap-2">
        <span>Хиты <b className="text-body">{current}/{max}</b>{temp ? <span className="text-info"> +{temp}</span> : null}</span>
        <span>КД <b className="text-body">{character.armorClass}</b></span>
        {current <= 0 && <DeathSaves saves={character.deathSavingThrows} size={11}/>}
      </div>
      <div className={`tb-meter mt-1 ${share <= 0.25 ? 'is-critical' : share <= 0.5 ? 'is-hurt' : ''}`}><span style={{width: `${share * 100}%`}}/></div>
    </div>
  )
}

//one tab for the whole loop: requests wait on top (the DM rules them there), their results land in the log below
export function ChatPanel() {
  const messages = useRoomStore((state) => state.messages)
  const requests = useRoomStore((state) => state.requests)
  const connected = useRoomStore((state) => state.connected)
  const isDM = useRoomStore((state) => state.user?.role === 'ГМ')
  const emit = useRoomStore((state) => state.emit)
  const [text, setText] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => { bottom.current?.scrollIntoView({block: 'end'}) }, [messages.length])                                  //braces: newer Chromium returns a Promise from scrollIntoView, and an effect may only return a cleanup

  const send = (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim()) return
    emit('chat-message', {message: text.trim()})
    setText('')
  }

  return (
    <div className="chat">
      {requests.length > 0 && (
        <div className="chat__pending">
          <div className="tb-eyebrow mb-1">{isDM ? 'Ждут вашего решения' : 'Ваши запросы ждут ГМ'} · {requests.length}</div>
          {requests.map((request) => <RequestCard key={request.id} request={request} isDM={isDM}/>)}
        </div>
      )}
      <div className="chat__log">
        {messages.map((message) => <LogEntry key={String(message._id)} message={message}/>)}
        {messages.length === 0 && <div className="tb-empty">Здесь появятся сообщения и броски. {isDM ? 'Бросок ГМ: /roll 2d6+3.' : 'Броски — кнопками во вкладке «Действия».'}</div>}
        <div ref={bottom}/>
      </div>
      <form onSubmit={send} className="chat__form">
        <input className="form-control form-control-sm" value={text} onChange={(event) => setText(event.target.value)}
               placeholder={isDM ? 'Сообщение или /roll 2d6' : 'Сообщение'} maxLength={2000} aria-label="Сообщение в чат"/>
        <button type="submit" className="btn btn-sm btn-primary d-inline-flex align-items-center" disabled={!connected || !text.trim()} title="Отправить" aria-label="Отправить"><FaPaperPlane/></button>
      </form>
    </div>
  )
}

const startDrag = (event: DragEvent, payload: DragPayload) => {
  event.dataTransfer.setData(dragType, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = 'copy'
}

//DM: search the bestiary; drag a monster onto the map (its template is made on the first drop) or add it to the campaign with +
function BestiaryPicker() {
  const {monsters, campaignId} = useGameUI()
  const characters = useRoomStore((state) => state.characters)
  const notify = useRoomStore((state) => state.notify)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const needle = query.trim().toLowerCase()
  const found = needle ? monsters.filter((monster) => monster.name.toLowerCase().includes(needle)).slice(0, 30) : []
  const inCampaign = (monsterId: string) => Object.values(characters).some((character) => character.monster === monsterId && character.isTemplate)

  const add = async (monsterId: string) => {
    setAdding(monsterId)
    const {data, message} = await createFromMonster(campaignId, monsterId)
    setAdding(null)
    if (!data) notify(message)
  }

  return (
    <div className="mb-2">
      <input className="form-control form-control-sm" placeholder="Бестиарий: найти монстра…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Поиск в бестиарии"/>
      {found.length > 0 && (
        <div className="border rounded mt-1 overflow-auto" style={{maxHeight: 220}}>
          {found.map((monster) => (
            <div key={monster.id} draggable onDragStart={(event) => startDrag(event, {kind: 'monster', id: monster.id})} title="Перетащите на карту" className="tb-row" style={{cursor: 'grab'}}>
              <div className="tb-row__main">
                <div className="tb-row__title">{monster.name}</div>
                <div className="tb-row__sub">{creatureTypeMap[monster.type as keyof typeof creatureTypeMap] ?? monster.type} · опасность {monster.rating}</div>
              </div>
              {inCampaign(monster.id)
                ? <span className="tb-chip tb-chip--success" title="Шаблон уже в кампании"><FaCheck aria-hidden/>в кампании</span>
                : <IconButton size="sm" label="Добавить шаблон в кампанию" icon={<FaPlus/>} disabled={adding === monster.id} onClick={() => void add(monster.id)}/>}
            </div>
          ))}
        </div>
      )}
      {needle && !found.length && <div className="text-muted small mt-1">В бестиарии такого нет.</div>}
    </div>
  )
}

export function PartyPanel() {
  const characters = useRoomStore((state) => state.characters)
  const tokens = useRoomStore((state) => state.tokens)
  const user = useRoomStore((state) => state.user)
  const map = useRoomStore((state) => state.map)
  const placing = useRoomStore((state) => state.placing)
  const selected = useRoomStore((state) => state.selected)
  const setPlacing = useRoomStore((state) => state.setPlacing)
  const setSelected = useRoomStore((state) => state.setSelected)
  const emit = useRoomStore((state) => state.emit)
  const {open, act} = useGameUI()
  if (!user) return null
  const isDM = user.role === 'ГМ'
  const copyCount = (templateId: string) => Object.values(characters).filter((character) => String(character.templateSource ?? '') === templateId).length
  //distinct entries only: template copies live on the map (double-click a token for its sheet), the template row counts them
  const list = Object.values(characters).filter((character) => !character.templateSource && playerSees(user, character, tokens[String(character._id)], map))
    .sort((a, b) => Number(b.isTemplate) - Number(a.isTemplate) || Number(a.isNPC) - Number(b.isNPC) || a.name.localeCompare(b.name, undefined, {numeric: true}))

  return (
    <div className="p-2 overflow-auto h-100">
      {placing && (
        <div className="tb-toast mb-2">
          <span className="flex-grow-1">{characters[placing]?.isTemplate ? 'Кликайте по карте — каждый клик ставит новую копию.' : 'Кликните по карте, чтобы поставить фишку.'}</span>
          <button type="button" className="btn btn-sm btn-outline-secondary py-0" onClick={() => setPlacing(null)}>{characters[placing]?.isTemplate ? 'Готово' : 'Отмена'}</button>
        </div>
      )}
      {isDM && <BestiaryPicker/>}
      {isDM && map && <div className="tb-eyebrow mb-1">Перетащите строку на карту</div>}
      {list.map((character) => {
        const id = String(character._id)
        const onMap = !!tokens[id]
        const own = mayControl(user, character)
        const [PlaceIcon, placeLabel] = character.isTemplate ? [FaRegClone, 'Копии на карту: каждый клик — копия'] as const : onMap ? [FaUpDownLeftRight, 'Переставить на карте'] as const : [FaLocationDot, 'Поставить на карту'] as const
        return (
          <div key={id} className={`tb-row ${placing === id || selected.includes(id) ? 'is-active' : ''}`}
               draggable={isDM && !!map} onDragStart={(event) => startDrag(event, {kind: 'character', id})} style={isDM && map ? {cursor: 'grab'} : undefined}>
            <Avatar name={character.name} src={character.avatar}/>
            <div className="tb-row__main">
              <div className="d-flex align-items-center gap-1">
                <button type="button" className="btn btn-link p-0 text-reset text-decoration-none tb-row__title" disabled={!onMap} title={onMap ? 'Выбрать фишку на карте' : 'Фишки на карте нет'} onClick={() => setSelected([id])}>{character.name}</button>
                {character.isTemplate ? <span className="tb-chip tb-chip--info">шаблон</span> : character.isNPC && <span className="tb-chip">НИП</span>}
                {character.conditions.length > 0 && <span className="d-inline-flex gap-1"><ConditionBadges conditions={character.conditions} size={16} limit={5}/></span>}
              </div>
              {own && !character.isTemplate && <Health character={character}/>}
            </div>
            {own && !character.isTemplate && <IconButton size="sm" label="Действия и броски" icon={<FaDiceD20/>} onClick={() => act(id)}/>}
            {own && <IconButton size="sm" label="Лист поверх комнаты" icon={<FaRegFileLines/>} onClick={() => open(`/characters/${id}`, character.name)}/>}
            {isDM && map && <IconButton size="sm" label={placeLabel} icon={<PlaceIcon/>} active={placing === id} onClick={() => setPlacing(placing === id ? null : id)}/>}
            {isDM && character.isTemplate && copyCount(id) > 0 && (
              <button type="button" className="btn btn-sm btn-outline-danger py-0 px-1 d-inline-flex align-items-center gap-1" title="Убрать с карт и удалить все копии" aria-label="Удалить все копии"
                      onClick={() => emit('remove-copies', {templateId: id})}><FaRegTrashCan/>{copyCount(id)}</button>
            )}
            {isDM && onMap && !character.isTemplate && <IconButton size="sm" tone="danger" label="Убрать с карты" icon={<FaXmark/>} onClick={() => emit('remove-token', {characterId: id})}/>}
          </div>
        )
      })}
      {list.length === 0 && <div className="tb-empty">{isDM ? 'В кампании пока нет персонажей. Игроки создают их в разделе «Персонажи», монстров добавляет поиск выше.' : 'Персонажей пока нет — создайте своего в разделе «Персонажи».'}</div>}
    </div>
  )
}

//over the map: who is selected, their numbers for those who play them, DM show / hide, initiative and quick controls (HP, conditions)
export function SelectionCard() {
  const selected = useRoomStore((state) => state.selected)
  const characters = useRoomStore((state) => state.characters)
  const tokens = useRoomStore((state) => state.tokens)
  const user = useRoomStore((state) => state.user)
  const emit = useRoomStore((state) => state.emit)
  const setSelected = useRoomStore((state) => state.setSelected)
  const listed = useRoomStore((state) => state.turnOrder.entries)
  const {open, act} = useGameUI()
  if (!user || selected.length === 0) return null
  const isDM = user.role === 'ГМ'
  const hidden = selected.every((id) => tokens[id] && !tokens[id].visible)
  const unlisted = selected.filter((id) => !listed.some((entry) => entry.characterId === id))

  return (
    <div className="room__selection tb-float">
      {selected.map((id) => {
        const character = characters[id]
        if (!character) return null
        const own = mayControl(user, character)
        return (
          <div key={id} className="d-flex align-items-center gap-2 mb-1">
            <Avatar name={character.name} src={character.avatar} size={28}/>
            <div className="tb-row__main">
              <div className="d-flex align-items-center gap-1">
                <span className="tb-row__title">{character.name}</span>
                {character.conditions.length > 0 && <span className="d-inline-flex gap-1"><ConditionBadges conditions={character.conditions} size={16} limit={5}/></span>}
              </div>
              {own && <Health character={character}/>}
            </div>
            {own && <IconButton size="sm" label="Действия и броски" icon={<FaDiceD20/>} onClick={() => act(id)}/>}
            {own && <IconButton size="sm" label="Лист поверх комнаты (или двойной клик по фишке)" icon={<FaRegFileLines/>} onClick={() => open(`/characters/${id}`, character.name)}/>}
            {isDM && <IconButton size="sm" tone="danger" label="Убрать с карты (копия шаблона удаляется вместе с фишкой)" icon={<FaRegTrashCan/>} onClick={() => emit('remove-token', {characterId: id})}/>}
          </div>
        )
      })}
      {isDM && <div className="border-top pt-2 mt-2"><QuickControls targets={selected.map((id) => characters[id]).filter(Boolean)}/></div>}
      <div className="d-flex flex-wrap gap-1 mt-2">
        {isDM && (
          <button type="button" className="btn btn-sm btn-outline-secondary py-0 d-inline-flex align-items-center gap-1" onClick={() => emit('toggle-tokens-visibility', {tokenIds: selected, visible: hidden})}>
            {hidden ? <><FaEye aria-hidden/>Показать игрокам</> : <><FaEyeSlash aria-hidden/>Скрыть от игроков</>}
          </button>
        )}
        {isDM && unlisted.length > 0 && (
          <button type="button" className="btn btn-sm btn-outline-secondary py-0 d-inline-flex align-items-center gap-1" title="Добавить в порядок ходов без числа — бросок или число потом"
                  onClick={() => emit('turn-add', {characterIds: unlisted})}><GiCrossedSwords aria-hidden/>В инициативу</button>
        )}
        <IconButton size="sm" className="ms-auto" label="Снять выбор" icon={<FaXmark/>} onClick={() => setSelected([])}/>
      </div>
    </div>
  )
}

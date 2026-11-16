'use client'
//Room cards and the floating dock: request cards (DM: dice + allow / fail / deny; player: own pending, cancel), log entries (chat lines,
//roll cards; the DM may put an initiative roll into the turn order), and the dock that shows both on site pages with a free roll.
import {useState} from "react"
import {FaChevronDown, FaChevronUp, FaXmark} from "react-icons/fa6"
import {GiCrossedSwords} from "react-icons/gi"
import type {ActionRequest} from "@frontend/deps/interfaces/shared/ActionRequest"
import type {FChatMessage, RollContent} from "@frontend/deps/interfaces/DB/Chat"
import {useRoom} from "@frontend/components/Room/RoomProvider"
import {useRoomStore} from "@frontend/store/room"
import {attributeMap} from "@frontend/deps/types/Attribute"
import RollBreakdown from "@frontend/components/Room/RollBreakdown"
import IconButton from "@frontend/components/UI/IconButton"

const rollLabels = {roll: 'бросок', attack: 'атака', damage: 'урон'} as const
const onSaveLabels: Record<string, string> = {half: 'половина урона', none: 'без урона', full: 'полный урон'}
//«14:05» today, «12.11 14:05» on an earlier day
const clock = (timestamp: unknown) => {
  const date = new Date(timestamp as string)
  if (Number.isNaN(date.getTime())) return ''
  const time = date.toLocaleTimeString('ru', {hour: '2-digit', minute: '2-digit'})
  return date.toDateString() === new Date().toDateString() ? time : `${date.toLocaleDateString('ru', {day: '2-digit', month: '2-digit'})} ${time}`
}

export function RollLines({content}: { content: RollContent }) {
  return (
    <>
      {content.rolls.map((roll, index) => (
        <div key={index} className="roll-card__roll">
          <span className="tb-eyebrow">{rollLabels[roll.label]}</span>
          <span className="roll-card__total">{roll.output.total}</span>
          <span className="roll-card__terms"><RollBreakdown output={roll.output}/></span>
        </div>
      ))}
      {content.save && <div className="roll-card__note">Спасбросок: {attributeMap[content.save.attribute]}, СЛ <b>{content.save.difficulty}</b>{content.save.onSave ? ` · при успехе: ${onSaveLabels[content.save.onSave] ?? content.save.onSave}` : ''}</div>}
      {content.hook?.split('\n').map((line) => <div key={line} className="roll-card__note text-warning">{line}</div>)}
    </>
  )
}

export function RequestCard({request, isDM}: { request: ActionRequest; isDM: boolean }) {
  const room = useRoom()!
  return (
    <div className="roll-card roll-card--request">
      <div className="roll-card__head">
        <span className="roll-card__who">{request.character.name}</span>
        <span className="roll-card__title">{request.title}</span>
      </div>
      <div className="roll-card__cost">{request.requester.username}{request.costLabel ? ` · ${request.costLabel}` : ''}</div>
      {request.warnings.map((warning) => <div key={warning} className="roll-card__note text-warning">⚠ {warning}</div>)}
      {isDM && request.content && <RollLines content={request.content}/>}
      {isDM ? (
        <div className="roll-card__verdict">
          <button type="button" className="btn btn-sm btn-success" title="Затраты списываются, результат уходит в чат" onClick={() => room.verdict(request.id, 'allow')}>Разрешить</button>
          <button type="button" className="btn btn-sm btn-warning" title="Затраты списываются, результат — провал" onClick={() => room.verdict(request.id, 'fail')}>Провал</button>
          <button type="button" className="btn btn-sm btn-outline-danger" title="Как будто не было: ничего не списано, ничего не показано" onClick={() => room.verdict(request.id, 'deny')}>Отклонить</button>
        </div>
      ) : (
        <div className="roll-card__foot">
          <span className="text-muted me-auto">ждёт решения ГМ</span>
          <button type="button" className="btn btn-sm btn-outline-secondary py-0" onClick={() => room.cancel(request.id)}>Отменить</button>
        </div>
      )}
    </div>
  )
}

//DM: an initiative roll from the log into the turn order — the DM's press, not an automatic effect (Doctrine)
function ToTurnOrder({characterId, total}: { characterId: string; total: number }) {
  const isDM = useRoomStore((state) => state.user?.role === 'ГМ')
  const emit = useRoomStore((state) => state.emit)
  const listed = useRoomStore((state) => state.turnOrder.entries.find((entry) => entry.characterId === characterId)?.initiative)
  if (!isDM) return null
  if (listed === total) return <span className="tb-chip tb-chip--success"><GiCrossedSwords aria-hidden/>в порядке ходов</span>
  return (
    <button type="button" className="btn btn-sm btn-outline-primary py-0 d-inline-flex align-items-center gap-1"
            onClick={() => emit('turn-add', {characterIds: [characterId], initiative: total})}><GiCrossedSwords aria-hidden/>В порядок ходов: {total}</button>
  )
}

export function LogEntry({message}: { message: FChatMessage }) {
  const time = clock(message.timestamp)
  if (typeof message.content === 'string') {
    return (
      <div className="chat-msg">
        <span className={`chat-msg__who ${message.sender?.role === 'ГМ' ? 'is-dm' : ''}`}>{message.sender?.username}</span>
        {message.content}
        {time && <span className="chat-msg__time">{time}</span>}
      </div>
    )
  }
  const content = message.content
  const actor = message.introduceAsCharacter
  return (
    <div className={`roll-card ${content.failed ? 'is-failed' : ''}`}>
      <div className="roll-card__head">
        <span className="roll-card__who">{actor?.name ?? message.sender?.username}</span>
        <span className="roll-card__title">{content.title ?? content.action?.name ?? content.formula}</span>
        {content.failed && <span className="tb-chip tb-chip--warning">провал</span>}
        {content.rest && <span className="tb-chip tb-chip--success">отдых применён</span>}
        {time && <span className="chat-msg__time ms-auto">{time}</span>}
      </div>
      {content.cost && <div className="roll-card__cost">{content.cost}</div>}
      <RollLines content={content}/>
      {content.rollType === 'initiative' && actor && content.rolls[0] && !content.failed && (
        <div className="roll-card__foot"><ToTurnOrder characterId={String(actor._id)} total={content.rolls[0].output.total}/></div>
      )}
    </div>
  )
}

export default function RoomDock({characterId}: { characterId?: string }) {
  const room = useRoom()
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<'requests' | 'log'>('requests')
  const [formula, setFormula] = useState('')
  if (!room) return null

  const rollFree = () => {
    if (!characterId || !formula.trim()) return
    room.request(characterId, {kind: 'formula', formula: formula.trim()})
    setFormula('')
  }
  const show = (next: 'requests' | 'log') => { setTab(next); setOpen(true) }

  return (
    <div className="room-dock tb-float">
      <div className="room-dock__head">
        <span className={`tb-dot ${room.connected ? 'is-on' : ''}`} title={room.connected ? 'В комнате кампании' : 'Нет соединения с комнатой'}/>
        <div className="tb-tabs flex-grow-1">
          <button type="button" className={open && tab === 'requests' ? 'is-active' : ''} onClick={() => show('requests')}>
            Запросы{room.requests.length > 0 && <span className="tb-count">{room.requests.length}</span>}
          </button>
          <button type="button" className={open && tab === 'log' ? 'is-active' : ''} onClick={() => show('log')}>Журнал</button>
        </div>
        <IconButton size="sm" label={open ? 'Свернуть' : 'Развернуть'} icon={open ? <FaChevronDown/> : <FaChevronUp/>} onClick={() => setOpen((current) => !current)}/>
      </div>
      {room.notices.map((notice, index) => (
        <div key={index} className="tb-toast m-2 mt-0">
          <span className="flex-grow-1">{notice}</span>
          <IconButton size="sm" label="Закрыть" icon={<FaXmark/>} onClick={() => room.dismissNotice(index)}/>
        </div>
      ))}
      {open && (
        <div className="room-dock__body">
          {tab === 'requests' && (
            room.requests.length ? room.requests.map((request) => <RequestCard key={request.id} request={request} isDM={room.isDM}/>)
              : <div className="tb-empty">{room.isDM ? 'Запросов нет. Когда игрок нажмёт кнопку на листе, бросок появится здесь.' : 'Нет запросов в ожидании. Нажмите навык, действие или заклинание на листе.'}</div>
          )}
          {tab === 'log' && (
            room.messages.length ? [...room.messages].reverse().map((message) => <LogEntry key={String(message._id)} message={message}/>)
              : <div className="tb-empty">Журнал пуст.</div>
          )}
        </div>
      )}
      {open && characterId && (
        <div className="room-dock__foot">
          <input className="form-control form-control-sm" placeholder="Свободный бросок: 2d6+3" value={formula} aria-label="Формула свободного броска"
                 onChange={(event) => setFormula(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && rollFree()}/>
          <button type="button" className="btn btn-sm btn-outline-primary" disabled={!room.connected || !formula.trim()} onClick={rollFree}>Бросить</button>
        </div>
      )}
    </div>
  )
}

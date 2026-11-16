'use client'
//Initiative order over the map (rules/turns): who acts when, whose turn it is, the round. The DM keeps it by hand — adds the selected
//tokens or a free line, types or rolls numbers, steps through turns, hides lines; players only read it (lines of NPCs they cannot
//see on the map, and hidden lines, are left out for them). Display only: nothing reads the list, nothing ticks.
import {FormEvent, useState} from "react"
import {FaBackwardStep, FaDiceD20, FaEye, FaEyeSlash, FaForwardStep, FaPlus, FaXmark} from "react-icons/fa6"
import {useRoomStore} from "@frontend/store/room"
import {ordered} from "@frontend/deps/rules/turns"
import type {TurnEntry} from "@frontend/deps/interfaces/shared/TurnOrder"
import {mayControl, playerSees} from "@frontend/components/Game/Canvas/geometry"
import Avatar from "@frontend/components/UI/Avatar"
import IconButton from "@frontend/components/UI/IconButton"

//the DM's number cell: typed, sent on Enter or when focus leaves; empty = not rolled yet
function InitiativeInput({entry}: { entry: TurnEntry }) {
  const emit = useRoomStore((state) => state.emit)
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const typed = draft.trim().replace(',', '.')
    const initiative = typed === '' ? null : Number(typed)
    setDraft(null)
    if (initiative !== entry.initiative && (initiative === null || Number.isFinite(initiative))) emit('turn-patch', {entryId: entry.id, initiative})
  }
  return (
    <input className="tracker__init" inputMode="decimal" aria-label="Инициатива" placeholder="—" value={draft ?? (entry.initiative ?? '')}
           onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}/>
  )
}

export default function TurnTracker({onClose}: { onClose: () => void }) {
  const turnOrder = useRoomStore((state) => state.turnOrder)
  const characters = useRoomStore((state) => state.characters)
  const tokens = useRoomStore((state) => state.tokens)
  const map = useRoomStore((state) => state.map)
  const user = useRoomStore((state) => state.user)
  const selected = useRoomStore((state) => state.selected)
  const setSelected = useRoomStore((state) => state.setSelected)
  const emit = useRoomStore((state) => state.emit)
  const [lineName, setLineName] = useState<string | null>(null)                                                         //DM: free line being typed
  const [confirmClear, setConfirmClear] = useState(false)
  if (!user) return null
  const isDM = user.role === 'ГМ'

  const shown = (entry: TurnEntry) => {
    if (isDM) return true
    if (entry.hidden) return false
    const character = entry.characterId ? characters[entry.characterId] : undefined
    return entry.characterId ? !!character && playerSees(user, character, tokens[entry.characterId], map) : true
  }
  const sequence = ordered(turnOrder.entries)
  const visible = sequence.filter(shown)
  const current = sequence.find((entry) => entry.id === turnOrder.current)
  const unlisted = selected.filter((id) => characters[id] && !turnOrder.entries.some((entry) => entry.characterId === id))
  const unrolled = turnOrder.entries.filter((entry) => entry.characterId && entry.initiative === null).length

  const addLine = (event: FormEvent) => {
    event.preventDefault()
    if (lineName?.trim()) emit('turn-add', {custom: {name: lineName.trim()}})
    setLineName(null)
  }

  return (
    <section className="tracker tb-float" aria-label="Порядок ходов">
      <div className="tracker__head">
        <span className="tracker__round">{turnOrder.current ? `Раунд ${turnOrder.round}` : 'Инициатива'}</span>
        {isDM && <IconButton size="sm" label="Предыдущий ход" icon={<FaBackwardStep/>} disabled={!turnOrder.current} onClick={() => emit('turn-step', {direction: -1})}/>}
        {isDM && (
          <button type="button" className="btn btn-sm btn-primary py-0 d-inline-flex align-items-center gap-1" disabled={!sequence.length} onClick={() => emit('turn-step', {direction: 1})}>
            <FaForwardStep aria-hidden/>{turnOrder.current ? 'Дальше' : 'Начать'}
          </button>
        )}
        <IconButton size="sm" label="Свернуть порядок ходов" icon={<FaXmark/>} onClick={onClose}/>
      </div>

      {visible.length > 0 ? (
        <ol className="tracker__list">
          {visible.map((entry) => {
            const character = entry.characterId ? characters[entry.characterId] : undefined
            const name = character?.name ?? entry.name ?? 'Нет на столе'
            const onMap = !!entry.characterId && !!tokens[entry.characterId]
            const number = isDM || !character?.isNPC || mayControl(user, character) ? entry.initiative : null             //NPC numbers are the DM's
            return (
              <li key={entry.id} className={`tracker__row ${entry.id === turnOrder.current ? 'is-current' : ''} ${entry.hidden ? 'is-hidden' : ''}`} aria-current={entry.id === turnOrder.current || undefined}>
                {isDM ? <InitiativeInput entry={entry}/> : <span className="tracker__init">{number ?? '·'}</span>}
                <Avatar name={name} src={character?.avatar}/>
                <button type="button" className="tracker__name" disabled={!onMap} title={onMap ? 'Выбрать фишку на карте' : name} onClick={() => entry.characterId && setSelected([entry.characterId])}>{name}</button>
                {isDM && (
                  <span className="d-inline-flex">
                    <IconButton size="sm" label={entry.hidden ? 'Строка скрыта от игроков — показать' : 'Скрыть строку от игроков'} icon={entry.hidden ? <FaEyeSlash/> : <FaEye/>}
                                onClick={() => emit('turn-patch', {entryId: entry.id, hidden: !entry.hidden})}/>
                    <IconButton size="sm" tone="danger" label="Убрать из порядка ходов" icon={<FaXmark/>} onClick={() => emit('turn-remove', {entryId: entry.id})}/>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="tb-empty">{isDM ? 'Список пуст. Выберите фишки на карте и добавьте их, или внесите бросок инициативы из чата.' : 'Бой не идёт.'}</div>
      )}
      {!isDM && current && !shown(current) && <div className="px-2 pb-2 text-muted">Сейчас ходит кто-то, кого вы не видите.</div>}

      {isDM && (
        <div className="tracker__foot">
          {lineName !== null ? (
            <form onSubmit={addLine} className="d-flex gap-1 w-100">
              <input autoFocus className="form-control form-control-sm" placeholder="Ловушка, логово, подкрепление…" maxLength={60} value={lineName} aria-label="Имя строки"
                     onChange={(event) => setLineName(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && setLineName(null)}/>
              <button type="submit" className="btn btn-sm btn-primary" disabled={!lineName.trim()}>Добавить</button>
            </form>
          ) : (
            <>
              <button type="button" className="btn btn-sm btn-outline-secondary py-0 d-inline-flex align-items-center gap-1" disabled={!unlisted.length} title={unlisted.length ? 'Добавить выбранные фишки' : 'Сначала выберите фишки на карте'}
                      onClick={() => emit('turn-add', {characterIds: unlisted})}><FaPlus aria-hidden/>Выбранные{unlisted.length ? ` (${unlisted.length})` : ''}</button>
              <button type="button" className="btn btn-sm btn-outline-secondary py-0 d-inline-flex align-items-center gap-1" onClick={() => setLineName('')}><FaPlus aria-hidden/>Строка</button>
              {unrolled > 0 && (
                <button type="button" className="btn btn-sm btn-outline-secondary py-0 d-inline-flex align-items-center gap-1" title="Бросить инициативу всем, у кого нет числа; результат виден только в этом списке"
                        onClick={() => emit('turn-roll', {})}><FaDiceD20 aria-hidden/>Бросить ({unrolled})</button>
              )}
              {turnOrder.entries.length > 0 && (confirmClear ? (
                <span className="d-inline-flex gap-1 ms-auto">
                  <button type="button" className="btn btn-sm btn-danger py-0" onClick={() => { emit('turn-clear', undefined); setConfirmClear(false) }}>Очистить список</button>
                  <button type="button" className="btn btn-sm btn-outline-secondary py-0" onClick={() => setConfirmClear(false)}>Нет</button>
                </span>
              ) : (
                <button type="button" className="btn btn-sm btn-outline-danger py-0 ms-auto" onClick={() => setConfirmClear(true)}>Завершить бой</button>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  )
}

'use client'
//DM quick controls over the room socket (rules/adjust): damage / heal / temp HP for one or many selected, conditions, exhaustion
//and death saves for one. The backend writes and broadcasts the sheet; nothing here computes game state.
import {KeyboardEvent, useState} from "react"
import {useRoomStore} from "@frontend/store/room"
import type {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import type {Adjustment} from "@frontend/deps/rules/adjust"
import {conditionMap, ENCondition} from "@frontend/deps/types/Condition"
import {conditionIcons} from "@frontend/components/Game/ConditionIcons"

export type QuickTarget = Pick<EvaluatedCharacter, '_id' | 'name' | 'hitPoints' | 'conditions' | 'deathSavingThrows'>

const toggles = (Object.keys(conditionMap) as ENCondition[]).filter((condition) => condition !== 'exhaustion')

//three pips: click a pip to set the count to it (click the last lit one again to lower it)
function Pips({value, color, onChange, label}: { value: number; color: string; onChange: (value: number) => void; label: string }) {
  return (
    <span className="d-inline-flex gap-1 align-items-center" aria-label={label}>
      {[1, 2, 3].map((pip) => (
        <button key={pip} type="button" className={`btn btn-sm p-0 rounded-circle border border-${color} ${pip <= value ? `bg-${color}` : ''}`} style={{width: 14, height: 14}}
                title={`${label}: ${pip}`} onClick={() => onChange(pip === value ? pip - 1 : pip)}/>
      ))}
    </span>
  )
}

export default function QuickControls({targets}: { targets: QuickTarget[] }) {
  const emit = useRoomStore((state) => state.emit)
  const connected = useRoomStore((state) => state.connected)
  const [amount, setAmount] = useState('')
  if (!targets.length) return null
  const single = targets.length === 1 ? targets[0] : null
  const value = Number(amount)
  const valid = amount !== '' && Number.isInteger(value) && value >= 0

  const send = (adjustment: Adjustment, only?: QuickTarget) => {
    for (const target of only ? [only] : targets) emit('adjust', {characterId: target._id, adjustment})
  }
  const apply = (kind: 'damage' | 'heal' | 'setTemp' | 'setHitPoints') => {
    if (!valid) return
    if (kind === 'setTemp') send({kind, temp: value})
    else if (kind === 'setHitPoints') send({kind, current: value})
    else send({kind, amount: value})
    setAmount('')
  }
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') apply(event.shiftKey ? 'heal' : 'damage')
  }

  return (
    <div className="small d-flex flex-column gap-2">
      <div className="d-flex flex-wrap gap-1 align-items-center">
        <input type="number" min={0} inputMode="numeric" className="form-control form-control-sm" style={{width: 72}} value={amount} placeholder="0"
               onChange={(event) => setAmount(event.target.value)} onKeyDown={onKey} aria-label="Количество" title="Enter — урон, Shift+Enter — лечение"/>
        <button type="button" className="btn btn-sm btn-danger py-0" disabled={!valid || !connected} onClick={() => apply('damage')}>Урон</button>
        <button type="button" className="btn btn-sm btn-success py-0" disabled={!valid || !connected} onClick={() => apply('heal')}>Лечение</button>
        <button type="button" className="btn btn-sm btn-outline-info py-0" disabled={!valid || !connected} onClick={() => apply('setTemp')} title="Временные хиты не складываются: задаёт запас">Врем.</button>
        {single && <button type="button" className="btn btn-sm btn-outline-secondary py-0" disabled={!valid || !connected} onClick={() => apply('setHitPoints')} title="Задать текущие хиты">=</button>}
        {targets.length > 1 && <span className="text-muted">всем: {targets.length}</span>}
      </div>

      {single && (
        <>
          <div className="d-flex flex-wrap gap-1">
            {toggles.map((condition) => {
              const on = single.conditions.some((entry) => entry.condition === condition)
              const Icon = conditionIcons[condition]
              return (
                <button key={condition} type="button" disabled={!connected} className={`btn btn-sm py-0 px-1 d-inline-flex align-items-center gap-1 ${on ? 'btn-warning' : 'btn-outline-secondary'}`}
                        onClick={() => send({kind: 'condition', condition, on: !on})}><Icon aria-hidden/>{conditionMap[condition]}</button>
              )
            })}
          </div>
          <label className="d-flex align-items-center gap-2">
            Истощение
            <select className="form-select form-select-sm w-auto py-0" disabled={!connected} value={single.conditions.find((entry) => entry.condition === 'exhaustion')?.level ?? 0}
                    onChange={(event) => send({kind: 'exhaustion', level: Number(event.target.value)})}>
              {[0, 1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={level}>{level || 'нет'}</option>)}
            </select>
          </label>
          {single.hitPoints.current === 0 && (() => {
            const {success, failure, isStable} = single.deathSavingThrows
            const setSaves = (next: Partial<{ success: number; failure: number; isStable: boolean }>) => send({kind: 'deathSaves', success, failure, isStable, ...next})
            return (
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span>Спасброски от смерти:</span>
                <Pips value={success} color="success" label="Успехи" onChange={(next) => setSaves({success: next})}/>
                <Pips value={failure} color="danger" label="Провалы" onChange={(next) => setSaves({failure: next})}/>
                <label className="form-check mb-0"><input type="checkbox" className="form-check-input" checked={isStable} onChange={(event) => setSaves({isStable: event.target.checked})}/> стабилен</label>
                {(success || failure || isStable) ? <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setSaves({success: 0, failure: 0, isStable: false})}>сбросить</button> : null}
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}

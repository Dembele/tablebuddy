//What an action rolls, BG3-style, from the backend's preview: «атака +5 · урон 4–11 колющий · спасбросок Ловкость, СЛ 15».
//The formulas as written sit in the tooltip; the action's reminders (hooks: riders the DM applies) follow underneath. No rulebook imports: used by the sheet (server) and the room's action panel (client).
import type {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import {damageTypeMap} from "@frontend/deps/types/Damage"
import {attributeName, signed, span} from "@frontend/_util/labels"
import {actionReminders} from "@frontend/deps/types/Hook"

export default function ActionSummary({action}: { action: EvaluatedCharacter['actions'][number] }) {
  const {preview} = action
  const formulas = [
    'attack' in action && action.attack ? `атака: ${action.attack}` : null,
    'damage' in action && action.damage && action.damage !== '0' ? `урон: ${action.damage}` : null,
    'pureRoll' in action && action.pureRoll ? `бросок: ${action.pureRoll}` : null,
    'save' in action && action.save ? `СЛ: ${action.save.difficulty}` : null
  ].filter(Boolean).join('\n')
  const save = 'save' in action ? action.save : undefined
  const parts = preview ? [
    preview.attack !== undefined && <span key="attack">атака <b>{signed(preview.attack)}</b></span>,
    preview.damage && <span key="damage">урон <b>{span(preview.damage)}</b>{preview.damage.types.length ? ` ${preview.damage.types.map((type) => damageTypeMap[type] ?? type).join(' + ')}` : ''}</span>,
    preview.roll && <span key="roll">бросок <b>{span(preview.roll)}</b></span>,
    save && preview.dc !== undefined && <span key="save">спасбросок {attributeName(save.attribute)}, СЛ <b>{preview.dc}</b>{save.onSave === 'half' ? ', успех — половина' : ''}</span>
  ].filter(Boolean) : []

  const reminders = actionReminders(action.hook).map((text) => <div key={text} className="small text-warning">{text}</div>)

  if (!parts.length) return formulas || reminders.length ? (
    <>
      {formulas && <div className="text-muted font-monospace" style={{whiteSpace: 'pre-line'}}>{formulas}</div>}
      {reminders}
    </>
  ) : null
  return (
    <>
      <div className="text-muted" title={formulas}>
        {parts.map((part, index) => <span key={index}>{index ? ' · ' : ''}{part}</span>)}
      </div>
      {reminders}
    </>
  )
}

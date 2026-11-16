'use client'
//One builder question: pick exactly `count` options. Everything visible — descriptions inline, useless options shown disabled with why.
import {ReactNode, useState} from "react"
import type {Option, Question, RolledScore} from "@frontend/deps/builder/_index"
import ScoresInput from "@frontend/components/Character/builder/ScoresInput"

interface QuestionCardProps {
  question: Question
  answer: string[] | undefined
  problem?: string
  dropped?: string[]                                                                                                    //picks taken back because an earlier step made them pointless
  characterId: string
  onAnswer: (key: string, answer: string[]) => void
  onRolled: (rolled: RolledScore[]) => void
}

//rules text always shown; long text scrolls inside its box instead of hiding behind a toggle
const Description = ({text}: { text?: string }) => text
  ? <div className="description small text-light-emphasis mt-1 pe-1" style={{maxHeight: '12em', overflowY: 'auto'}}>{text}</div>
  : null

const Badges = ({option, recommended}: { option: Option; recommended: boolean }) => (
  <>
    {recommended && <span className="badge text-bg-info ms-2">рекомендовано</span>}
    {option.hint && <span className="small text-muted ms-2">{option.hint}</span>}
    {option.disabled && <span className="small text-muted ms-2">— {option.disabled}</span>}
    {option.warning && <div className="small text-warning">⚠ {option.warning}</div>}
  </>
)

export default function QuestionCard({question, answer = [], problem, dropped, characterId, onAnswer, onRolled}: QuestionCardProps) {
  const [search, setSearch] = useState('')
  const recommended = new Set(question.recommended ?? [])
  const done = answer.length === question.count

  const frame = (body: ReactNode) => (
    <div className={`card bg-dark mb-3 ${question.fixed ? '' : done && !problem ? 'border-success' : 'border-warning'}`}>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h3 className="h6 mb-0">{question.title}</h3>
          {!question.fixed && question.kind === 'pick' && <span className={`badge ${done ? 'text-bg-success' : 'text-bg-warning'}`}>{answer.length}/{question.count}</span>}
        </div>
        {question.description && <p className="small text-muted">{question.description}</p>}
        {dropped?.length ? <div className="text-warning small mb-2">Выбор снят, выберите заново: {dropped.join('; ')}</div> : null}
        {body}
        {problem && <div className="text-danger small mt-2">{problem}</div>}
      </div>
    </div>
  )

  if (question.kind === 'scores') {
    return frame(<ScoresInput question={question} answer={answer} characterId={characterId} onAnswer={(values) => onAnswer(question.key, values)} onRolled={onRolled}/>)
  }

  if (question.fixed) {
    const chosen = question.options.filter((option) => !option.disabled)
    return frame(chosen.map((option) => (
      <div key={option.id} className="mb-1"><span className="text-primary fw-bold">{option.name}</span><Badges option={option} recommended={false}/><Description text={option.description}/></div>
    )))
  }

  const single = question.count === 1
  const toggle = (id: string) => {
    if (single) return onAnswer(question.key, [id])
    if (answer.includes(id)) return onAnswer(question.key, answer.filter((value) => value !== id))
    if (answer.length < question.count) onAnswer(question.key, [...answer, id])
  }

  //short single choice without texts (methods, sizes, modes): a button group
  if (single && question.options.length <= 4 && question.options.every((option) => !option.description)) {
    return frame(
      <div className="d-flex flex-wrap gap-2">
        {question.options.map((option) => (
          <button key={option.id} type="button" disabled={!!option.disabled} onClick={() => toggle(option.id)}
                  className={`btn ${answer.includes(option.id) ? 'btn-primary' : 'btn-outline-primary'}`}>
            {option.name}{option.hint && <div className="small opacity-75">{option.hint}</div>}
          </button>
        ))}
      </div>
    )
  }

  const needle = search.trim().toLowerCase()
  const visible = question.options.filter((option) => !needle || option.name.toLowerCase().includes(needle) || answer.includes(option.id))

  return frame(
    <>
      {question.options.length > 12 && (
        <input className="form-control form-control-sm mb-2" placeholder="Поиск" value={search} onChange={(event) => setSearch(event.target.value)}/>
      )}
      <div className="list-group" style={{maxHeight: 560, overflowY: 'auto'}}>
        {visible.map((option) => {
          const checked = answer.includes(option.id)
          const blocked = (!!option.disabled && !checked) || (!single && !checked && answer.length >= question.count)
          return (
            <label key={option.id} className={`list-group-item bg-dark ${checked ? 'border-primary' : ''} ${option.disabled ? 'opacity-50' : 'list-group-item-action'}`}>
              <div className="d-flex gap-2 align-items-start">
                <input type={single ? 'radio' : 'checkbox'} className="form-check-input mt-1" name={question.key} checked={checked} disabled={blocked} onChange={() => toggle(option.id)}/>
                <div className="flex-grow-1">
                  <span className={checked ? 'text-primary fw-bold' : ''}>{option.name}</span>
                  <Badges option={option} recommended={recommended.has(option.id)}/>
                  <Description text={option.description}/>
                </div>
              </div>
            </label>
          )
        })}
      </div>
    </>
  )
}

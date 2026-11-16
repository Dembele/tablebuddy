'use client'
//Builder UI: answers kept here, every change re-plans on the server; steps = question groups; commit when nothing is missing.
//A pick an earlier step made pointless (the species already knows the cantrip, the new background gives the skill) is dropped and named.
import {useMemo, useRef, useState, useTransition} from "react"
import {useRouter} from "next/navigation"
import type {Answers, RolledScore} from "@frontend/deps/builder/_index"
import type {ICharacter} from "@frontend/deps/interfaces/DB/Character"
import {BuildMode, commitBuild, Plan, planBuild} from "@frontend/actions/builder"
import QuestionCard from "@frontend/components/Character/builder/QuestionCard"
import SummaryPanel from "@frontend/components/Character/builder/SummaryPanel"
import Spinner from "@frontend/components/UI/Spinner"

type Dropped = Record<string, string[]>                                                                                  //question key → «name — reason» of picks taken back

//answers without the picks the plan no longer accepts; questions not asked right now keep theirs
function prune(answers: Answers, plan: Plan): { answers: Answers; dropped: Dropped } {
  const next = {...answers}
  const dropped: Dropped = {}
  for (const question of plan.questions) {
    const answer = answers[question.key]
    if (question.kind !== 'pick' || question.fixed || !answer) continue
    const options = new Map(question.options.map((option) => [option.id, option]))
    const stale = answer.filter((id) => !options.has(id) || options.get(id)!.disabled)
    if (!stale.length) continue
    next[question.key] = answer.filter((id) => !stale.includes(id))
    dropped[question.key] = stale.map((id) => { const option = options.get(id); return option ? `${option.name} — ${option.disabled}` : id })
  }
  return {answers: next, dropped}
}

const groupNames: Record<string, string> = {abilities: 'Характеристики', race: 'Вид', background: 'Предыстория', class: 'Класс', equipment: 'Снаряжение', main: 'Выбор'}

interface BuilderWizardProps {
  mode: BuildMode
  id: string
  base: ICharacter
  initialPlan: Plan
}

export default function BuilderWizard({mode, id, base: initialBase, initialPlan}: BuilderWizardProps) {
  const [base, setBase] = useState(initialBase)
  const [answers, setAnswers] = useState<Answers>({})
  const [plan, setPlan] = useState(initialPlan)
  const [dropped, setDropped] = useState<Dropped>({})
  const [group, setGroup] = useState(initialPlan.questions[0]?.group ?? 'main')
  const [status, setStatus] = useState<string | null>(null)
  const [planning, startPlanning] = useTransition()
  const [saving, startSaving] = useTransition()
  const latest = useRef(0)
  const router = useRouter()

  //re-plans with the latest answers; only the newest request wins
  const replan = (character: ICharacter, next: Answers) => {
    const request = ++latest.current
    startPlanning(async () => {
      const updated = await planBuild(mode, character, next)
      if (request !== latest.current) return
      setPlan(updated)
      const pruned = prune(next, updated)                                                                               //a stale pick never counted, so the plan stands
      setDropped((current) => ({...current, ...pruned.dropped}))
      if (Object.keys(pruned.dropped).length) setAnswers(pruned.answers)
    })
  }

  const answer = (key: string, value: string[]) => {
    const next = {...answers, [key]: value}
    if (key === 'scores:method') delete next.scores //another method starts from its own values
    setAnswers(next)
    setDropped(({[key]: _answered, ...rest}) => rest)
    replan(base, next)
  }

  //the backend stored a roll: plan again on the character that has it
  const rolled = (scores: RolledScore[]) => {
    const next = {...base, rolledScores: scores}
    setBase(next)
    const nextAnswers = {...answers}
    delete nextAnswers.scores
    setAnswers(nextAnswers)
    replan(next, nextAnswers)
  }

  const groups = useMemo(() => [...new Set(plan.questions.map((question) => question.group))], [plan.questions])
  const missingIn = (name: string) => plan.questions.filter((question) => question.group === name && plan.missing.includes(question.key)).length
  const visible = plan.questions.filter((question) => question.group === group)
  const ready = plan.missing.length === 0 && plan.questions.length > 0

  const commit = () => startSaving(async () => {
    const result = await commitBuild(mode, id, answers)
    setStatus(result.message)
    if (result.ok) {
      router.push(`/characters/${id}`)
      router.refresh()
    }
  })

  return (
    <div className="row g-3">
      <div className="col-lg-8">
        <ul className="nav nav-tabs mb-3">
          {groups.map((name) => (
            <li key={name} className="nav-item">
              <button className={`nav-link ${name === group ? 'active' : ''}`} onClick={() => setGroup(name)}>
                {groupNames[name] ?? name}{missingIn(name) > 0 && <span className="badge text-bg-warning ms-1">{missingIn(name)}</span>}
              </button>
            </li>
          ))}
          {planning && <li className="nav-item ms-auto align-self-center"><Spinner/></li>}
        </ul>

        {visible.map((question) => (
          <QuestionCard key={question.key} question={question} answer={answers[question.key]} problem={plan.problems[question.key]} dropped={dropped[question.key]} characterId={id} onAnswer={answer} onRolled={rolled}/>
        ))}

        <div className="d-flex gap-2 align-items-center">
          {groups.indexOf(group) < groups.length - 1 && (
            <button className="btn btn-outline-light" onClick={() => setGroup(groups[groups.indexOf(group) + 1])}>Дальше</button>
          )}
          <button className="btn btn-primary ms-auto" disabled={!ready || saving || planning} onClick={commit}>
            {saving ? <Spinner/> : mode === 'creation' ? 'Создать персонажа' : 'Повысить уровень'}
          </button>
          {!ready && <span className="small text-muted">осталось ответить: {plan.missing.length}</span>}
          {status && <span className="small">{status}</span>}
        </div>
      </div>
      <div className="col-lg-4"><SummaryPanel summary={plan.summary} notes={plan.notes}/></div>
    </div>
  )
}

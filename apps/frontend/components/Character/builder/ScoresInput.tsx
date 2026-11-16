'use client'
//Base scores per method: point buy with +/− and prices, standard array and rolls assigned by swapping, a roll verdict vs 27 points.
//Totals include the origin bonus answered so far (question.bonuses). Values are emitted in attributeMap order.
import {useEffect, useState} from "react"
import type {Question, RolledScore} from "@frontend/deps/builder/_index"
import {pointBuyBudget, pointBuyCost, pointBuyEquivalent, standardArray} from "@frontend/deps/builder/questions"
import {rollScores} from "@frontend/actions/characters"
import Spinner from "@frontend/components/UI/Spinner"

interface ScoresInputProps {
  question: Question
  answer: string[]
  characterId: string
  onAnswer: (values: string[]) => void
  onRolled: (rolled: RolledScore[]) => void
}

const signed = (value: number) => (value >= 0 ? `+${value}` : `−${Math.abs(value)}`)
const modifier = (score: number) => Math.floor((score - 10) / 2)

//initial values per method: point buy from 8s, the array / roll sorted high to low
function initialValues(question: Question): number[] {
  if (question.method === 'pointBuy') return Array(6).fill(8)
  if (question.method === 'roll') return (question.rolled ?? []).map((score) => score.total).sort((a, b) => b - a)
  return [...standardArray]
}

//how a roll compares with the 27-point budget
function verdict(values: number[]): { tone: string; title: string; text: string } {
  const advantage = pointBuyEquivalent(values) - pointBuyBudget
  const legendary = values.filter((value) => value > 15).length
  if (legendary) return {tone: 'primary', title: 'ЛЕГЕНДАРНО!', text: `${legendary} × выше 15 — покупкой так не получить`}
  if (advantage > 10) return {tone: 'success', title: 'ИДЕАЛЬНЫЙ БРОСОК!', text: `На +${advantage} лучше стандартных 27`}
  if (advantage > 5) return {tone: 'success', title: 'ОТЛИЧНЫЙ РЕЗУЛЬТАТ', text: `На +${advantage} лучше стандартных 27`}
  if (advantage > 0) return {tone: 'info', title: 'ХОРОШО', text: `На +${advantage} лучше стандартных 27`}
  if (advantage === 0) return {tone: 'secondary', title: 'ТОЧНО В СТАНДАРТ', text: 'Ровно 27 очков, как при покупке'}
  if (advantage > -5) return {tone: 'warning', title: 'МОЖНО ЛУЧШЕ', text: `На ${-advantage} хуже стандартных 27`}
  if (advantage > -10) return {tone: 'danger', title: 'ПЛОХОВАТО', text: `На ${-advantage} хуже стандартных 27`}
  return {tone: 'dark', title: 'КАТАСТРОФА!', text: `На ${-advantage} хуже стандартных 27`}
}

export default function ScoresInput({question, answer, characterId, onAnswer, onRolled}: ScoresInputProps) {
  const method = question.method
  const values = answer.length === 6 ? answer.map(Number) : initialValues(question)
  const [rolling, setRolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  //the method's starting values count as the first answer, so the step is never blank
  useEffect(() => {
    if (answer.length !== 6 && values.length === 6) onAnswer(values.map(String))
  }, [answer.length, values.length]) //values are derived from the question; re-emit only when the answer is missing

  const emit = (next: number[]) => onAnswer(next.map(String))
  const swap = (from: number, to: number) => {
    const next = [...values]
    ;[next[from], next[to]] = [next[to], next[from]]
    emit(next)
  }
  const shuffle = () => emit([...values].map((value) => ({value, order: Math.random()})).sort((a, b) => a.order - b.order).map((entry) => entry.value))
  const spent = method === 'pointBuy' ? values.reduce((total, value) => total + (pointBuyCost[value] ?? 0), 0) : 0
  const step = (index: number, delta: number) => {
    const next = [...values]
    next[index] = values[index] + delta
    if (next[index] < 8 || next[index] > 15) return
    const cost = next.reduce((total, value) => total + pointBuyCost[value], 0)
    if (cost <= pointBuyBudget) emit(next)
  }

  const roll = async () => {
    setRolling(true)
    setError(null)
    try {
      const {data, message} = await rollScores(characterId)
      if (data) onRolled(data)
      else setError(message)
    } finally {
      setRolling(false)
    }
  }

  if (method === 'roll' && !question.rolled?.length) {
    return (
      <>
        <div className="alert alert-info">
          <div>Бросьте 4к6 и уберите наименьший куб — шесть раз. Это единственный способ получить больше стандартных 27 очков.</div>
          <div className="text-danger mt-1">Но можно бросить и сильно хуже (от 3 до 18). Бросок один — перебросить нельзя.</div>
        </div>
        {error && <div className="alert alert-danger py-1">{error}</div>}
        <button className="btn btn-primary" disabled={rolling} onClick={roll}>{rolling ? <><Spinner/> Трясём кубы…</> : 'Бросить кости'}</button>
      </>
    )
  }

  const rolledByTotal = new Map<number, RolledScore[]>()
  for (const score of question.rolled ?? []) rolledByTotal.set(score.total, [...(rolledByTotal.get(score.total) ?? []), score])
  const usedDice = new Map<number, number>()
  const diceFor = (total: number) => {
    const index = usedDice.get(total) ?? 0
    usedDice.set(total, index + 1)
    return rolledByTotal.get(total)?.[index]?.dice
  }
  const rollVerdict = method === 'roll' ? verdict(values) : null

  return (
    <>
      {method === 'pointBuy' && (
        <div className={`badge mb-2 ${spent === pointBuyBudget ? 'text-bg-success' : 'text-bg-warning'}`}>очки: {pointBuyBudget - spent} из {pointBuyBudget} осталось</div>
      )}
      {rollVerdict && <div className={`alert alert-${rollVerdict.tone} py-2`}><strong>{rollVerdict.title}</strong> {rollVerdict.text}</div>}
      {method !== 'pointBuy' && <button className="btn btn-sm btn-outline-primary mb-2" onClick={shuffle}>Распределить случайно</button>}

      <div className="row row-cols-2 row-cols-md-3 g-2">
        {question.options.map((option, index) => {
          const value = values[index]
          const bonus = question.bonuses?.[option.id] ?? 0
          const total = value + bonus
          const dice = method === 'roll' ? diceFor(value) : undefined
          const lowest = dice ? dice.indexOf(Math.min(...dice)) : -1
          return (
            <div key={option.id} className="col">
              <div className="card bg-dark h-100">
                <div className="card-body text-center py-2">
                  <div className="fw-bold">{option.name}</div>
                  {method === 'pointBuy' ? (
                    <div className="d-flex justify-content-center align-items-center gap-3 my-1">
                      <button className="btn btn-sm btn-outline-secondary" disabled={value <= 8} onClick={() => step(index, -1)}>−</button>
                      <span className="fs-4">{value}</span>
                      <button className="btn btn-sm btn-outline-secondary" disabled={value >= 15 || spent + (pointBuyCost[value + 1] ?? 99) - pointBuyCost[value] > pointBuyBudget}
                              onClick={() => step(index, 1)}>+</button>
                    </div>
                  ) : <div className="fs-4 my-1">{value}</div>}
                  {dice && (
                    <div className="small text-muted">
                      {dice.map((die, dieIndex) => <span key={dieIndex} className={`me-1 ${dieIndex === lowest ? 'text-decoration-line-through' : ''}`}>{die}</span>)}
                    </div>
                  )}
                  <div className="small">
                    итого <b>{total}</b> ({signed(modifier(total))}){bonus > 0 && <span className="text-success"> +{bonus} происхождение</span>}
                  </div>
                  {method === 'pointBuy' && <div className="small text-muted">цена {pointBuyCost[value]}</div>}
                  {method !== 'pointBuy' && (
                    <div className="d-flex flex-wrap justify-content-center gap-1 mt-1">
                      {question.options.map((other, otherIndex) => otherIndex !== index && (
                        <button key={other.id} className="btn btn-sm btn-outline-secondary py-0 px-1" title={`Поменять с: ${other.name}`} onClick={() => swap(index, otherIndex)}>
                          ⇄ {other.name.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

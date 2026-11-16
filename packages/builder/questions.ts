//Builder vocabulary: questions the walk asks, the answers it reads, the result it hands back. Plain data — serializable.

//one selectable answer; `warning` = an unmet prerequisite or cap the DM may still allow; `disabled` = picking it would do nothing
export interface Option {
  id: string
  name: string
  hint?: string
  description?: string
  warning?: string
  disabled?: string
}

export type ScoreMethod = 'standard' | 'pointBuy' | 'roll'
export type RolledScore = { total: number; dice: number[] }

export interface Question {
  key: string                                                                                                           //stable id: answers are keyed by it
  group: string                                                                                                         //wizard step it belongs to
  title: string
  description?: string
  kind: 'pick' | 'scores'                                                                                               //scores = six numbers in attributeMap order
  count: number                                                                                                         //exact number of options to pick
  options: Option[]
  recommended?: string[]
  method?: ScoreMethod                                                                                                  //scores only
  rolled?: RolledScore[]                                                                                                //scores with method 'roll': the stored roll
  bonuses?: Record<string, number>                                                                                      //scores only: origin bonus per attribute already answered
  fixed?: boolean                                                                                                       //nothing to decide: answered by the walk itself
}

export type Answers = Record<string, string[]>

//per-question error the UI shows next to it
export type Problems = Record<string, string>

export const standardArray = [15, 14, 13, 12, 10, 8]
export const pointBuyCost: Record<number, number> = {8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9}
export const pointBuyBudget = 27

//point-buy price of any score (below 8: −1 per point, above 15: the usual extended table) — compares a roll with the 27-point budget
const extendedCost: Record<number, number> = {16: 12, 17: 15, 18: 19}
export const pointBuyEquivalent = (values: number[]) =>
  values.reduce((total, value) => total + (value < 8 ? value - 8 : pointBuyCost[value] ?? extendedCost[value] ?? 19), 0)

const sameMultiset = (left: number[], right: number[]) => {
  const sort = (values: number[]) => [...values].sort((a, b) => a - b).join(',')
  return sort(left) === sort(right)
}

//why a scores answer is not acceptable for its method, or null
export function scoresProblem(method: ScoreMethod, values: number[], rolled?: RolledScore[]): string | null {
  if (values.length !== 6 || values.some((value) => !Number.isInteger(value))) return 'Нужно шесть целых чисел'
  if (method === 'standard') return sameMultiset(values, standardArray) ? null : 'Нужны значения 15, 14, 13, 12, 10, 8 — каждое по разу'
  if (method === 'roll') {
    if (!rolled?.length) return 'Сначала бросьте кости'
    return sameMultiset(values, rolled.map((score) => score.total)) ? null : 'Нужно распределить выпавшие значения'
  }
  if (values.some((value) => value < 8 || value > 15)) return 'При покупке значения от 8 до 15'
  const spent = values.reduce((total, value) => total + pointBuyCost[value], 0)
  return spent === pointBuyBudget ? null : `Потрачено ${spent} из ${pointBuyBudget} очков — нужно потратить все`
}

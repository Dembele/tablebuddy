//DM quick controls (Doctrine: results are applied by hand — this is that hand): damage / healing / temp HP, conditions, death saves.
//Pure: the stored paths a press changes, or a refusal. No side effects beyond the press itself (healing does not reset death saves).

import {EvaluatedCharacter} from "../interfaces/DB/Character"
import {conditionMap, ENCondition} from "../types/Condition"
import {Changes} from "./costs"

export type Adjustment =
  | { kind: 'damage'; amount: number }                                                                                  //temp HP first, then current, down to 0
  | { kind: 'heal'; amount: number }                                                                                    //current up to max; temp untouched
  | { kind: 'setHitPoints'; current: number }
  | { kind: 'setTemp'; temp: number }                                                                                   //temp HP do not stack: the DM sets the pool
  | { kind: 'condition'; condition: ENCondition; on: boolean }
  | { kind: 'exhaustion'; level: number }                                                                               //0 = none, 1–6
  | { kind: 'deathSaves'; success: number; failure: number; isStable: boolean }

type Adjustable = Pick<EvaluatedCharacter, 'hitPoints' | 'conditions'>

const whole = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max

export function adjust(character: Adjustable, adjustment: Adjustment): Changes | string {
  const {current, max} = character.hitPoints
  const temp = character.hitPoints.temp ?? 0
  switch (adjustment.kind) {
    case 'damage': {
      if (!whole(adjustment.amount, 0, 9999)) return 'Урон — целое число от 0'
      const absorbed = Math.min(temp, adjustment.amount)
      return [
        ...(absorbed ? [{path: 'hitPoints.temp', value: temp - absorbed}] : []),
        {path: 'hitPoints.current', value: Math.max(0, current - (adjustment.amount - absorbed))}
      ]
    }
    case 'heal':
      if (!whole(adjustment.amount, 0, 9999)) return 'Лечение — целое число от 0'
      return [{path: 'hitPoints.current', value: Math.min(max, current + adjustment.amount)}]
    case 'setHitPoints':
      if (!whole(adjustment.current, 0, max)) return `Хиты — от 0 до ${max}`
      return [{path: 'hitPoints.current', value: adjustment.current}]
    case 'setTemp':
      if (!whole(adjustment.temp, 0, 9999)) return 'Временные хиты — целое число от 0'
      return [{path: 'hitPoints.temp', value: adjustment.temp}]
    case 'condition': {
      if (!(adjustment.condition in conditionMap) || adjustment.condition === 'exhaustion') return 'Неизвестное состояние'
      const others = character.conditions.filter((entry) => entry.condition !== adjustment.condition)
      return [{path: 'conditions', value: adjustment.on ? [...others, {condition: adjustment.condition}] : others}]
    }
    case 'exhaustion': {
      if (!whole(adjustment.level, 0, 6)) return 'Истощение — от 0 до 6'
      const others = character.conditions.filter((entry) => entry.condition !== 'exhaustion')
      return [{path: 'conditions', value: adjustment.level ? [...others, {condition: 'exhaustion', level: adjustment.level}] : others}]
    }
    case 'deathSaves':
      if (!whole(adjustment.success, 0, 3) || !whole(adjustment.failure, 0, 3) || typeof adjustment.isStable !== 'boolean') return 'Спасброски от смерти — от 0 до 3'
      return [
        {path: 'deathSavingThrows.success', value: adjustment.success},
        {path: 'deathSavingThrows.failure', value: adjustment.failure},
        {path: 'deathSavingThrows.isStable', value: adjustment.isStable}
      ]
    default:
      return 'Неизвестное действие'
  }
}

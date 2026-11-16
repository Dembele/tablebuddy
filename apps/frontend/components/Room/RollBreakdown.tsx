'use client'
//What each number of a roll is, on demand: the terms as bare numbers (14 + 3 + 1×2); hover or click one and a bubble above it
//names it («мод. ЛОВ», «3к6 [5, 6, 5] рубящий»). Display only; the backend already computed everything.
import {ReactNode, useState} from "react"
import type {ExpressionToken, RollOutput} from "@frontend/deps/types/internal/Dice"
import {damageTypeMap} from "@frontend/deps/types/Damage"
import {ENAttribute} from "@frontend/deps/types/Attribute"
import {skillMap} from "@frontend/deps/types/Skill"

const short: Record<ENAttribute, string> = {strength: 'СИЛ', dexterity: 'ЛОВ', constitution: 'ТЕЛ', intelligence: 'ИНТ', wisdom: 'МДР', charisma: 'ХАР'}
const attribute = (key: string) => short[key as ENAttribute] ?? key
const dicePattern = /^\d*d\d+/
const piecePattern = /(\d*d\d+(?:k[hl]\d*)?|\{[^{}]+})/

//"{character.attributes.dexterity.modifier}" → «мод. ЛОВ»
export function referenceLabel(expr: string): string {
  const path = expr.replace(/^\{character\.|}$/g, '').split('.')
  const [root, key, field] = path
  switch (root) {
    case 'proficiency': return 'бонус мастерства'
    case 'attributes': return field === 'modifier' ? `мод. ${attribute(key)}` : attribute(key)
    case 'skills': return skillMap[key as keyof typeof skillMap] ?? key
    case 'savingThrows': return `спасбросок ${attribute(key)}`
    case 'initiative': return 'инициатива'
    case 'proficiencies': return 'владение (1 — да, 0 — нет)'
    case 'spellcasting': return key === 'attackBonus' ? 'бонус атаки заклинанием' : key === 'dcBonus' ? 'бонус СЛ' : 'заклинания'
    case 'deathSavingThrows': return 'бонус к спасброску от смерти'
    case 'hitDice': return 'кости хитов'
    case 'hitPoints': return 'хиты'
    case 'armorClass': return 'КД'
    default: return path[path.length - 1] ?? expr
  }
}

const functionLabels: Array<[string, string]> = [['@level', 'уровень'], ['@startingHitDie', 'начальная кость хитов'], ['@armor', 'доспех'], ['@shield', 'щит']]
const functionLabel = (expr: string) => functionLabels.find(([prefix]) => expr.startsWith(prefix))?.[1] ?? expr

//"2d6" → «2к6», "1d20kh1" → «к20 (лучший)»
function diceLabel(expr: string): string {
  const match = expr.match(/(\d*)d(\d+)(kh|kl)?/)
  if (!match) return expr
  const count = match[1] && match[1] !== '1' ? match[1] : ''
  return `${count}к${match[2]}${match[3] === 'kh' ? ' (лучший)' : match[3] === 'kl' ? ' (худший)' : ''}`
}

const diceOf = (token: ExpressionToken) => token.details.type === 'dice' ? token.details.data : []
const toneOf = (token: ExpressionToken) => {
  const kept = diceOf(token).filter((die) => die.isKept)
  return kept.some((die) => die.isCrit) ? 'text-success' : kept.some((die) => die.isCritFailure) ? 'text-danger' : 'text-warning'
}

//a number that names itself: bubble above on hover, pinned by a click, gone on blur
function Term({value, className, children}: { value: ReactNode; className: string; children: ReactNode }) {
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  return (
    <span className="position-relative d-inline-block">
      <button type="button" className={`btn btn-link p-0 border-0 fw-bold text-decoration-none ${className}`} style={{fontSize: 'inherit', lineHeight: 'inherit', borderBottom: '1px dotted'}}
              onClick={() => setPinned((current) => !current)} onBlur={() => setPinned(false)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        {value}
      </button>
      {(pinned || hovered) && (
        <span className="position-absolute bottom-100 start-50 translate-middle-x mb-1 px-2 py-1 rounded bg-black border border-secondary text-light text-nowrap small shadow"
              style={{zIndex: 1100, fontFamily: 'var(--bs-body-font-family)'}} role="tooltip">{children}</span>
      )}
    </span>
  )
}

//what a dice token was: «к20», «3к6 [5, 6, 5] рубящий», a group with its inner modifiers «(к6 2 + мод. СИЛ 3) дробящий»
function diceText(token: ExpressionToken, refs: Map<string, ExpressionToken>): string {
  const dice = diceOf(token)
  const rolled = dice.length > 1 ? ` [${dice.map((die) => die.isKept ? die.value : `~${die.value}`).join(', ')}]` : dice.length ? ` ${dice[0].value}` : ''
  const pieces = token.expr.split(piecePattern).filter((piece) => piece.trim())
  let diceShown = false
  const inner = pieces.map((piece) => {
    if (dicePattern.test(piece)) {
      const text = `${diceLabel(piece)}${diceShown ? '' : rolled}`
      diceShown = true
      return text
    }
    const ref = piece.startsWith('{') ? refs.get(piece) : undefined
    return ref ? `${referenceLabel(piece)} ${ref.value}` : piece.replace(/\*/g, '×').trim()
  }).join(' ')
  const type = token.damageType ? ` ${damageTypeMap[token.damageType]}` : ''
  const crit = dice.some((die) => die.isKept && die.isCrit) ? ' · крит!' : dice.some((die) => die.isKept && die.isCritFailure) ? ' · единица' : ''
  return `${pieces.length > 1 ? `(${inner})` : inner}${type}${crit}`
}

//the formula as numbers; each token is a Term, operators and literals stay plain
export default function RollBreakdown({output}: { output: RollOutput }) {
  const byId = new Map([...output.tokens.dices, ...output.tokens.refs, ...output.tokens.functions].map((token) => [token.id, token]))
  const refs = new Map(output.tokens.refs.map((token) => [token.expr, token]))
  const parts = output.tokenizedFormula.split(/(\$\d+)/).filter(Boolean)

  return (
    <span className="d-inline-flex flex-wrap align-items-baseline gap-1">
      {parts.map((part, index) => {
        const token = byId.get(part)
        if (!token) return <span key={index} className="text-secondary">{part.replace(/\*/g, '×').replace(/\s+/g, '')}</span>
        if (token.type === 'dice') return <Term key={index} value={token.value} className={toneOf(token)}>{diceText(token, refs)}</Term>
        const label = token.type === 'function' ? functionLabel(token.expr) : referenceLabel(token.expr)
        return <Term key={index} value={token.value} className="text-info">{label}</Term>
      })}
    </span>
  )
}

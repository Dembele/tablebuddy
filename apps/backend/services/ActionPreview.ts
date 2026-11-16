//BG3-style action summary for the sheet: attack bonus, damage range (every die at 1 … every die at its max), save DC.
//Computed here with the live sheet as context (Doctrine: the server computes, the client displays); never rolled, never stored.
import {ActionPreview, CharacterAction, EvaluatedCharacter} from "@backend/deps/interfaces/DB/Character"
import {ENDamageType} from "@backend/deps/types/Damage"
import {Formula} from "@backend/deps/types/internal/Formula"
import {evaluator} from "@backend/services/Evaluator"
import {pickFormula} from "@backend/services/ActionRoller"

const dicePattern = /(?<![\w.])(\d*)d(\d+)(?:kh(\d+)|kl(\d+))?/g
const typePattern = /\[([a-z_]+)\]/g

//every die replaced by a fixed value: 0 (bonus only), 1 (minimum) or its faces (maximum); kh/kl keep that many dice
const fixDice = (formula: string, at: 'zero' | 'min' | 'max') => formula.replace(dicePattern, (_match, count: string, faces: string, high?: string, low?: string) => {
  const kept = Number(high || low || count || 1)
  return at === 'zero' ? '0' : String(at === 'min' ? kept : kept * Number(faces))
})
const typesOf = (formula: string) => [...new Set([...formula.matchAll(typePattern)].map((match) => match[1] as ENDamageType))]
const untyped = (formula: string) => formula.replace(typePattern, '')

function range(formula: string, character: EvaluatedCharacter) {
  const at = (point: 'min' | 'max') => evaluator.eval(untyped(fixDice(formula, point)) as Formula, {character}).total
  const [low, high] = [at('min'), at('max')]
  return {min: Math.max(0, Math.min(low, high)), max: Math.max(0, low, high)}
}

//the summary of one action, or nothing when a formula cannot be read (the raw formula still shows)
export function previewAction(action: CharacterAction, character: EvaluatedCharacter): ActionPreview | undefined {
  try {
    const preview: ActionPreview = {}
    if ('attack' in action && action.attack) preview.attack = evaluator.eval(untyped(fixDice(action.attack, 'zero')) as Formula, {character}).total
    if ('damage' in action && action.damage && action.damage !== '0') {
      const damage = pickFormula(action, action.damage, character)
      preview.damage = {...range(damage, character), types: typesOf(damage)}
    }
    if ('pureRoll' in action && action.pureRoll) preview.roll = range(pickFormula(action, action.pureRoll, character), character)
    if ('save' in action && action.save) preview.dc = evaluator.eval(action.save.difficulty, {character}).total
    return preview
  } catch {
    return undefined
  }
}

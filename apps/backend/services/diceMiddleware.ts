import {RollContext} from "@backend/services/Evaluator"
import {ENAttribute} from "@backend/deps/types/Attribute"
import {ENSkill} from "@backend/deps/types/Skill"
import {functionRegistry} from '@backend/services/functionRegistry'
import {RollType, rollTypeToTitleMap} from "@backend/deps/types/internal/RollType"
import {HitDice} from "@backend/deps/types/Character"
import {typedKeys} from "@backend/deps/_util/translationMap"

type BonusPart =
  | string
  | number
  | { token: string }
  | { if: boolean; then: string | number }

const partToString = (part: BonusPart): string => {
  if (typeof part === "string") return part
  if (typeof part === "number") return String(part)
  if ("token" in part) return `{${part.token}}`
  if ("if" in part) return part.if ? String(part.then) : ""
  return ""
}

const composeFormula = (base: string, ...bonuses: BonusPart[]): string => {
  const parts = bonuses.map(partToString).filter(Boolean)
  return parts.length ? `${base} + ${parts.join(" + ")}` : base
}

type DiceMiddleware = (input: string, context: RollContext) => MiddlewareOutput
type MiddlewareOutput = {
  formula: string
  context: RollContext
}

const isSkillRoll = (rollType?: string): rollType is `skill.${ENSkill}` =>
  rollType?.startsWith('skill.') ?? false

const isSaveRoll = (rollType?: string): rollType is `save.${ENAttribute}` | 'save.death' =>
  rollType?.startsWith('save.') ?? false

const isRollType = (input: unknown): input is RollType => {
  return typeof input === 'string' && typedKeys(rollTypeToTitleMap).includes(input as RollType) //freaking TS
}

const saveMiddleware: DiceMiddleware = (formula, context) => {
  if (!isSaveRoll(context.rollType) || !context.character) return {formula, context}

  return {formula, context}
}

// Middleware for skill checks
const skillMiddleware: DiceMiddleware = (formula, context) => {
  if (!isSkillRoll(context.rollType) || !context.character) return {formula, context}

  return {formula, context}
}

//we need to return both formula and updated context here
const formulaInjectorMiddleware: DiceMiddleware = (formula, context): MiddlewareOutput => {
  if (!isRollType(formula as RollType)) return {formula, context}

  const rollType = formula as RollType
  const c = context.character!
  if (!c) throw new Error("Character required")

  // ── Initiative ────────────────────────────────────────────────────────────
  if (rollType === "initiative") {
    return {
      formula: composeFormula("1d20", "{character.initiative.value}", {
        if: c.initiative.proficiency,
        then: "{character.proficiency}"
      }),
      context: { ...context, rollType }
    }
  }

  // ── Death Save ───────────────────────────────────────────────────────────
  if (rollType === "save.death") {
    return {
      formula: composeFormula("1d20", "{character.deathSavingThrows.value}"),
      context: { ...context, rollType }
    }
  }

  // ── Saving Throws ─────────────────────────────────────────────────────────
  if (rollType.startsWith("save.")) {
    const attr = rollType.slice(5) as ENAttribute
    return {
      formula: composeFormula("1d20", `{character.savingThrows.${attr}.value}`, { // modifier by default, + flat bonuses
        if: c.savingThrows[attr].proficiency,
        then: "{character.proficiency}"
      }),
      context: { ...context, rollType }
    }
  }

  // ── Skill Checks ──────────────────────────────────────────────────────────
  if (rollType.startsWith("skill.")) {
    const skill = rollType.slice(6) as ENSkill
    const s = c.skills[skill]

    return {
      formula: composeFormula(
        "1d20",
        `{character.skills.${skill}.value}`, // flat bonuses
        { if: s.expertise, then: "{character.proficiency} * 2" },
        { if: s.proficiency && !s.expertise, then: "{character.proficiency}" }
      ),
      context: { ...context, rollType }
    }
  }

  // ── hitDie rolls ──────────────────────────────────────────────────────────
  if (rollType.startsWith("hitDie.")) {
    const die = rollType.slice(7) as HitDice

    return {
      formula: `1d${die}`,
      context: { ...context, rollType }
    }
  }

  throw new Error(`Inputted a key without mapping to a formula: ${formula}`)
}

// Middleware pipeline composer
export const composeMiddleware = (
  ...middlewares: DiceMiddleware[]
): ((input: string | RollType, context: RollContext) => MiddlewareOutput) => {
  return (initialInput, initialContext) => {
    let formula = initialInput
    let context = {...initialContext}

    for (const middleware of middlewares) {
      const result = middleware((formula || initialInput), context)

      formula = result.formula

      if (result.context) {
        context = {...context, ...result.context}
      }
    }

    return {formula, context}
  }
}

const functionMiddleware: DiceMiddleware = (formula, context) => {
  // Regex to match {functionName(param1, param2, etc)} – all params treated as strings
  const funcPattern = /{(\w+)\(([^)]*)\)}/g

  let modifiedFormula = formula
  let match

  while ((match = funcPattern.exec(formula)) !== null) {
    const funcName = match[1]
    const paramsStr = match[2].trim()

    if (!functionRegistry[funcName]) {
      throw new Error(`Unknown function in formula: ${funcName}`)
    }

    // Split params by comma, trim, and pass as strings
    const params = paramsStr ? paramsStr.split(',').map(param => param.trim()) : []

    try {
      const result = functionRegistry[funcName](context, ...params)
      // Substitute the full match with the result
      modifiedFormula = modifiedFormula.replace(match[0], result.toString())
    } catch (error) {
      throw new Error(`Function ${funcName} failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (context.log) console.log(`After function substitution: ${modifiedFormula}`)

  return {formula: modifiedFormula, context}
}

// Export the composed middleware pipeline
export const diceMiddleware = composeMiddleware(
  formulaInjectorMiddleware,
  functionMiddleware,
  skillMiddleware,
  saveMiddleware
)
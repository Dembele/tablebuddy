import { evaluate } from 'mathjs'
import {
  calculateDiceTotal,
  extractDiceExpressions,
  generateDiceRolls,
  normalizeFormula,
  substituteTokensWithValue,
  tokenizeFormula
} from "@backend/_util/diceUtils"
import { safeEvaluate } from "@backend/_util/safeEvaluate"
import { resolveReferences } from "@backend/_util/characterUtils"
import {DiceExpression, ExpressionToken, RollOutput, TokensOutput} from "@backend/deps/types/internal/Dice"
import { RollType } from "@backend/deps/types/internal/RollType"
import * as util from "node:util"
import { diceMiddleware } from "@backend/services/diceMiddleware"
import { EvaluatedCharacter, ICharacter } from "@backend/deps/interfaces/DB/Character"
import { CharacterAPI } from "@backend/services/Character"
import { functionRegistry } from "@backend/services/functionRegistry"

export interface RollContext {
  character?: CharacterAPI | ICharacter | EvaluatedCharacter
  targets?: Array<CharacterAPI | ICharacter | EvaluatedCharacter>
  distance?: number
  rollType?: RollType
  log?: boolean
}

class Evaluator {
  private tokens: TokensOutput = {
    dices: [],
    refs: [],
    functions: []
  }
  private depth = 0

  public eval(formula: string | RollType, context: RollContext = {}, depth?: number): RollOutput {
    this.reset()
    this.depth = depth ?? 0

    try {
      const {processedFormula, tokenizedFormula} = this.processRoll(formula, context)
      const total = evaluate(processedFormula)

      return {
        formula: processedFormula,
        total,
        tokens: this.tokens,
        tokenizedFormula
      }
    } catch (error) {
      throw this.createEvaluationError(error, formula)
    }
  }

  private reset(): void {
    this.tokens = { dices: [], refs: [], functions: [] }
  }

  private processRoll(formula: string, context: RollContext) {
    const {formula: preProcessedFormula, context: updateContext} = diceMiddleware(formula, context)
    const [processedFormula, tokenizedFormula] = this.processFormula(preProcessedFormula, updateContext)

    if (updateContext.log) {
      this.logProcess(formula, preProcessedFormula, processedFormula, tokenizedFormula)
    }

    return {processedFormula, tokenizedFormula}
  }

  private logProcess(
    originalFormula: string,
    preProcessedFormula: string,
    processedFormula: string,
    tokenizedFormula: string
  ): void {
    console.log(util.inspect(
      {
        depth: this.depth,
        formula: originalFormula,
        preProcessedFormula,
        processedFormula,
        tokenizedFormula,
        tokens: this.tokens
      },
      { depth: null, colors: true }
    ))
  }

  private createEvaluationError(error: unknown, formula: string): Error {
    const message = error instanceof Error ? error.message : String(error)
    return new Error(`Roll failed: ${message}, \n at: ${formula}`)
  }

  private processFormula(originalFormula: string, context: RollContext): [string, string] {
    const normalizedFormula = normalizeFormula(originalFormula)
    if (context.log) console.log("Normalized formula:", normalizedFormula)

    const [tokenizedFormula, tokens] = tokenizeFormula(normalizedFormula, context.log)

    const { diceTokens, refTokens, funcTokens } = this.categorizeTokens(tokens)
    const { evaluatedDiceTokens, allSubRefs, allSubFunctions } = this.processDiceTokens(diceTokens, context)
    const evaluatedRefTokens = this.processReferenceTokens(refTokens, context)
    const evaluatedFuncTokens = this.processFunctionTokens(funcTokens, context)

    let formula = this.substituteAndResolveTokens(
      tokenizedFormula,
      evaluatedDiceTokens,
      evaluatedFuncTokens,
      evaluatedRefTokens,
      context
    )

    this.tokens = {
      dices: evaluatedDiceTokens,
      refs: [...evaluatedRefTokens, ...allSubRefs],
      functions: [...evaluatedFuncTokens, ...allSubFunctions]
    }

    return [formula, tokenizedFormula]
  }

  private categorizeTokens(tokens: ExpressionToken[]) {
    return {
      diceTokens: tokens.filter(token => token.type === 'dice'),
      refTokens: tokens.filter(token => token.type === 'reference'),
      funcTokens: tokens.filter(token => token.type === 'function')
    }
  }

  private processDiceTokens(
    diceTokens: ExpressionToken[],
    context: RollContext
  ) {
    const allSubRefs: ExpressionToken[] = []
    const allSubFunctions: ExpressionToken[] = []
    const evaluatedDiceTokens: ExpressionToken[] = []

    for (const token of diceTokens) {
      const { value, details, subRefs, subFunctions } = this.processDiceExpression(token, context)

      allSubRefs.push(...subRefs)
      allSubFunctions.push(...subFunctions)

      evaluatedDiceTokens.push({
        ...token,
        value,
        details
      })
    }

    return { evaluatedDiceTokens, allSubRefs, allSubFunctions }
  }

  private processReferenceTokens(refTokens: ExpressionToken[], context: RollContext): ExpressionToken[] {
    return refTokens.map(token => ({
      ...token,
      value: safeEvaluate(resolveReferences(token.expr, context)).toString()
    }))
  }

  private processFunctionTokens(funcTokens: ExpressionToken[], context: RollContext): ExpressionToken[] {
    return funcTokens.map(token => this.evaluateFunctionToken(token, context))
  }

  private evaluateFunctionToken(token: ExpressionToken, context: RollContext): ExpressionToken {
    const { funcName, rawArgs } = this.parseFunctionExpression(token.expr)
    this.validateFunctionExists(funcName, token.expr)

    const resolvedArgs = this.resolveFunctionArguments(rawArgs, context)
    const funcValue = this.executeFunction(funcName, context, resolvedArgs, token.expr)

    return {
      ...token,
      value: funcValue,
      details: { type: 'function', data: resolvedArgs }
    }
  }

  private parseFunctionExpression(expr: string) {
    const funcNameMatch = expr.match(/^@(\w+)/)
    const funcName = funcNameMatch ? funcNameMatch[1] : ''
    const argsMatch = expr.match(/\(([^)]*)\)/)
    const rawArgsStr = argsMatch ? argsMatch[1].trim() : ''
    const rawArgs = rawArgsStr ? rawArgsStr.split(',').map(arg => arg.trim()) : []

    return { funcName, rawArgs }
  }

  private validateFunctionExists(funcName: string, expr: string): void {
    if (!funcName || !functionRegistry[funcName]) {
      throw new Error(`Unknown function: ${expr}`)
    }
  }

  private resolveFunctionArguments(rawArgs: string[], context: RollContext): string[] {
    return rawArgs.map(arg => {
      if (!arg) return ''
      const resolvedRef = resolveReferences(arg, context)
      return safeEvaluate(resolvedRef).toString()
    })
  }

  private executeFunction(
    funcName: string,
    context: RollContext,
    args: string[],
    expr: string
  ): string {
    try {
      const result = functionRegistry[funcName](context, ...args)
      return typeof result === 'number' ? result.toString() : String(result)
    } catch (err) {
      throw new Error(`Function ${expr} failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  private substituteAndResolveTokens(
    formula: string,
    diceTokens: ExpressionToken[],
    funcTokens: ExpressionToken[],
    refTokens: ExpressionToken[],
    context: RollContext
  ): string {
    let result = substituteTokensWithValue(formula, diceTokens)
    if (context.log) console.log('after dice sub', result)

    result = this.resolveIteratively(result, funcTokens, refTokens, context)
    return result
  }

  private resolveIteratively(
    formula: string,
    funcTokens: ExpressionToken[],
    refTokens: ExpressionToken[],
    context: RollContext
  ): string {
    let result = formula
    let iteration = 0
    const maxIterations = 10

    while (iteration++ < maxIterations) {
      const prevFormula = result

      result = substituteTokensWithValue(result, funcTokens)
      if (context.log) console.log(`Iteration ${iteration} after funcs:`, result)

      result = substituteTokensWithValue(result, refTokens)
      if (context.log) console.log(`Iteration ${iteration} after refs:`, result)

      if (result === prevFormula) break
    }

    if (iteration >= maxIterations) {
      throw new Error(`Loop exceeded in: ${formula}`)
    }

    return result
  }

  private processDiceExpression(
    token: ExpressionToken,
    context: RollContext
  ): { value: number; details: ExpressionToken['details']; subRefs: ExpressionToken[]; subFunctions: ExpressionToken[] } {
    const formula = token.expr
    const isSimpleDice = /^(\d*)d(\d+)(?:kh(\d+)|kl(\d+))?(?:\[([^\]]+)])?$/.test(formula)

    if (isSimpleDice) {
      return this.processSimpleDice(token, context)
    } else {
      return this.processComplexDice(token, context)
    }
  }

  private processSimpleDice(
    token: ExpressionToken,
    context: RollContext
  ): { value: number; details: ExpressionToken['details']; subRefs: ExpressionToken[]; subFunctions: ExpressionToken[] } {
    const formula = token.expr
    const diceExpressions = extractDiceExpressions(formula)
    const critSuccess = this.getCritSuccessThreshold(context)
    const critFailure = 1

    const details: ExpressionToken['details'] = { type: 'dice', data: [] }
    let processedFormula = formula

    for (const diceRoll of diceExpressions) {
      const total = this.rollDiceAndCalculateTotal(diceRoll, critSuccess, critFailure, details)
      processedFormula = processedFormula.replace(diceRoll.rollCall, total.toString())
    }

    token.damageType = diceExpressions[0]?.damageType ?? token.damageType                                              //inline "2d6[fire]", else the group's "(2d6)[fire]"

    return {
      value: Number(processedFormula),
      details,
      subRefs: [],
      subFunctions: []
    }
  }

  private processComplexDice(
    token: ExpressionToken,
    context: RollContext
  ): { value: number; details: ExpressionToken['details']; subRefs: ExpressionToken[]; subFunctions: ExpressionToken[] } {
    const subResult = this.eval(token.expr, context, this.depth + 1)
    const rolls = this.extractRollsFromSubResult(subResult)

    return {
      value: subResult.total,
      details: { type: 'dice', data: rolls },
      subRefs: subResult.tokens.refs,
      subFunctions: subResult.tokens.functions
    }
  }

  private getCritSuccessThreshold(context: RollContext): number {
    return context.rollType?.startsWith('attack') ? 20 - (context.character?.critThresholdMod || 0) : 20
  }

  private rollDiceAndCalculateTotal(
    diceRoll: DiceExpression,
    critSuccess: number,
    critFailure: number,
    details: ExpressionToken['details']
  ): number {
    if (details.type !== 'dice') {
      throw new Error(`Expected dice details, got ${details.type}, for formula: ${diceRoll.rollCall}`)
    }

    const allRolls = generateDiceRolls(diceRoll.rollCall)
    const { total, keptIndices } = calculateDiceTotal(
      allRolls,
      diceRoll.keepType,
      diceRoll.keepNumber
    )

    allRolls.forEach((roll, index) => {
      details.data.push({
        faces: roll.faces,
        value: roll.value,
        isCrit: roll.faces === 20 && roll.value >= critSuccess,
        isCritFailure: roll.faces === 20 && roll.value <= critFailure,
        isKept: keptIndices.has(index)
      })
    })

    return total
  }

  private extractRollsFromSubResult(subResult: RollOutput) {
    return subResult.tokens.dices.flatMap(dt =>
      dt.details.type === 'dice' ? dt.details.data.map(roll => {
        const { damageType, ...cleanRoll } = roll
        return cleanRoll
      }) : []
    )
  }
}

export const evaluator = new Evaluator()
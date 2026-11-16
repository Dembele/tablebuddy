import { DiceExpression, ExpressionToken, KeepType } from "@backend/deps/types/internal/Dice"
import { ENDamageType } from "@backend/deps/types/Damage"

// ===== DICE ROLL GENERATION =====
export const generateDiceRolls = (formula: string): Array<{ faces: number; value: number }> => {
  const cleanFormula = removeDamageType(formula)
  const diceMatches = extractDiceMatches(cleanFormula)

  if (diceMatches.length === 0) {
    throw new Error(`No valid dice rolls in: ${formula}`)
  }

  return diceMatches.flatMap(({ numberOfDice, faces }) =>
    Array.from({ length: numberOfDice }, () => ({
      faces,
      value: Math.floor(Math.random() * faces) + 1
    }))
  )
}

const removeDamageType = (formula: string): string => {
  return formula.replace(/\[[^\]]+]/, '')
}

const extractDiceMatches = (formula: string): Array<{ numberOfDice: number; faces: number }> => {
  const diceRegex = /(\d*)d(\d+)/g
  const matches: Array<{ numberOfDice: number; faces: number }> = []
  let match: RegExpExecArray | null

  while ((match = diceRegex.exec(formula)) !== null) {
    const numberOfDice = match[1] ? parseInt(match[1]) : 1
    const faces = parseInt(match[2])
    matches.push({ numberOfDice, faces })
  }

  return matches
}

// ===== DICE TOTAL CALCULATION =====
export const calculateDiceTotal = (
  rolls: Array<{ value: number }>,
  keepType: KeepType,
  keepNumber: number
): { total: number; keptIndices: Set<number> } => {
  if (!keepType || keepNumber <= 0) {
    return calculateTotalAllRolls(rolls)
  }

  return calculateTotalWithKeepLogic(rolls, keepType, keepNumber)
}

const calculateTotalAllRolls = (rolls: Array<{ value: number }>) => {
  const total = rolls.reduce((sum, roll) => sum + roll.value, 0)
  const keptIndices = new Set(rolls.map((_, index) => index))
  return { total, keptIndices }
}

const calculateTotalWithKeepLogic = (
  rolls: Array<{ value: number }>,
  keepType: KeepType,
  keepNumber: number
) => {
  const indexedRolls = rolls.map((roll, index) => ({ ...roll, index }))
  const sortedRolls = sortRollsByKeepType(indexedRolls, keepType)
  const keptIndices = getKeptIndices(sortedRolls, keepNumber)
  const total = calculateKeptTotal(sortedRolls, keepNumber)

  return { total, keptIndices }
}

const sortRollsByKeepType = (
  rolls: Array<{ value: number; index: number }>,
  keepType: KeepType
) => {
  return [...rolls].sort((a, b) =>
    keepType === 'highest' ? b.value - a.value : a.value - b.value
  )
}

const getKeptIndices = (
  sortedRolls: Array<{ value: number; index: number }>,
  keepNumber: number
) => {
  return new Set(sortedRolls.slice(0, keepNumber).map(roll => roll.index))
}

const calculateKeptTotal = (
  sortedRolls: Array<{ value: number; index: number }>,
  keepNumber: number
) => {
  return sortedRolls
    .slice(0, keepNumber)
    .reduce((sum, roll) => sum + roll.value, 0)
}

// ===== DICE EXPRESSION EXTRACTION =====
export function extractDiceExpressions(formula: string): DiceExpression[] {
  const dicePattern = /\b(\d*)d(\d+)(?:kh(\d+)|kl(\d+))?(?:\[([^\]]+)])?/g
  const expressions: DiceExpression[] = []
  let match: RegExpExecArray | null

  while ((match = dicePattern.exec(formula)) !== null) {
    const expression = createDiceExpressionFromMatch(match)
    expressions.push(expression)
  }

  return expressions
}

const createDiceExpressionFromMatch = (match: RegExpExecArray): DiceExpression => {
  const [rollCall, count, faces, khNumStr, klNumStr, damageTypeStr] = match

  const { keepType, keepNumber } = parseKeepModifiers(khNumStr, klNumStr)
  const damageType = parseDamageType(damageTypeStr)

  return {
    rollCall,
    count: Number(count),
    faces: Number(faces),
    diceRoll: match[0],
    keepType,
    keepNumber,
    damageType
  }
}

const parseKeepModifiers = (khNumStr: string, klNumStr: string) => {
  let keepType: KeepType = null
  let keepNumber = 0

  if (khNumStr) {
    keepType = 'highest'
    keepNumber = parseInt(khNumStr, 10)
  } else if (klNumStr) {
    keepType = 'lowest'
    keepNumber = parseInt(klNumStr, 10)
  }

  return { keepType, keepNumber }
}

const parseDamageType = (damageTypeStr: string): ENDamageType | undefined => {
  return damageTypeStr ? damageTypeStr as ENDamageType : undefined
}

// ===== FORMULA TOKENIZATION =====
export function tokenizeFormula(
  input: string,
  log = false
): [tokenizedString: string, tokens: ExpressionToken[]] {
  const normalizedInput = input.replace(/\s+/g, ' ').trim()
  const tokens: ExpressionToken[] = []
  let counter = { value: 1 }
  let result = normalizedInput

  result = tokenizeNestedExpressions(result, tokens, counter)
  result = tokenizeGroupedDiceExpressions(result, tokens, counter)
  result = tokenizeDiceExpressions(result, input, tokens, counter, log)
  result = tokenizeFunctions(result, input, tokens, counter, log)                                                    //before refs: a function resolves the refs in its own args
  result = tokenizeReferences(result, input, tokens, counter, log)

  return [result, tokens]
}

const createToken = (
  counter: { value: number },
  type: ExpressionToken['type'],
  expr: string
): ExpressionToken => ({
  id: `$${counter.value++}`,
  expr,
  type,
  value: 0,
  details: { type, data: [] }
})

const tokenizeNestedExpressions = (
  input: string,
  tokens: ExpressionToken[],
  counter: { value: number }
): string => {
  let result = input
  const nestedRegex = /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*})*})*}/g
  let match: RegExpExecArray | null

  while ((match = nestedRegex.exec(input)) !== null) {
    const expr = match[0]
    if (/^{[^{}]+}$/.test(expr)) continue

    tokens.push(createToken(counter, 'operator', expr))
    result = result.replace(expr, tokens[tokens.length - 1].id)
  }

  return result
}

const tokenizeGroupedDiceExpressions = (
  input: string,
  tokens: ExpressionToken[],
  counter: { value: number }
): string => {
  let result = input
  let pos = 0

  while (pos < result.length) {
    const groupInfo = findGroupedDiceExpression(result, pos)
    if (!groupInfo) break

    const { start, end, innerExpr, damageType } = groupInfo
    const token = createToken(counter, 'dice', innerExpr)

    if (damageType) {
      token.damageType = damageType
    }

    tokens.push(token)
    result = result.slice(0, start) + token.id + result.slice(end)
    pos = start + token.id.length
  }

  return result
}

const findGroupedDiceExpression = (
  input: string,
  startPos: number
): { start: number; end: number; innerExpr: string; damageType?: ENDamageType } | null => {
  const start = input.indexOf('(', startPos)
  if (start === -1) return null

  const { end: groupEnd, innerExpr } = findMatchingParentheses(input, start)
  if (groupEnd === -1) return null

  const { damageType, end: fullEnd } = parseDamageTypeFromGroup(input, groupEnd)
  if (!damageType) return null

  return { start, end: fullEnd, innerExpr, damageType }
}

const findMatchingParentheses = (input: string, start: number) => {
  let count = 1
  let end = start + 1

  for (; end < input.length; end++) {
    if (input[end] === '(') count++
    else if (input[end] === ')') {
      count--
      if (count === 0) break
    }
  }

  if (count !== 0) return { end: -1, innerExpr: '' }

  const innerExpr = input.slice(start + 1, end)
  return { end, innerExpr }
}

const parseDamageTypeFromGroup = (input: string, groupEnd: number) => {
  let damageType: ENDamageType | undefined
  let end = groupEnd + 1

  if (input[end] === '[') {
    const typeStart = end + 1
    const typeEnd = input.indexOf(']', typeStart)

    if (typeEnd !== -1) {
      damageType = input.slice(typeStart, typeEnd).trim() as ENDamageType
      end = typeEnd + 1
    }
  }

  return { damageType, end }
}

const tokenizeDiceExpressions = (
  result: string,
  originalInput: string,
  tokens: ExpressionToken[],
  counter: { value: number },
  log: boolean
): string => {
  const diceRegex = /\b(\d*)d(\d+)(?:kh(\d+)|kl(\d+))?(?:\[([^\]]+)])?/g
  let match: RegExpExecArray | null

  while ((match = diceRegex.exec(originalInput)) !== null) {
    const expr = match[0]
    if (result.includes(expr)) {
      tokens.push(createToken(counter, 'dice', expr))
      result = replaceAllOccurrences(result, expr, tokens[tokens.length - 1].id)
    }
  }

  if (log) console.log('dice extract', result)
  return result
}

const tokenizeReferences = (
  result: string,
  originalInput: string,
  tokens: ExpressionToken[],
  counter: { value: number },
  log: boolean
): string => {
  const referenceRegex = /{[^{}]+}/g
  let match: RegExpExecArray | null

  while ((match = referenceRegex.exec(originalInput)) !== null) {
    const expr = match[0]
    if (result.includes(expr)) {
      tokens.push(createToken(counter, 'reference', expr))
      result = replaceAllOccurrences(result, expr, tokens[tokens.length - 1].id)
    }
  }

  if (log) console.log('refs extract', result)
  return result
}

const tokenizeFunctions = (
  result: string,
  originalInput: string,
  tokens: ExpressionToken[],
  counter: { value: number },
  log: boolean
): string => {
  const functionRegex = /@(\w+)\s*\([^)]*\)/g
  let match: RegExpExecArray | null

  while ((match = functionRegex.exec(originalInput)) !== null) {
    const expr = match[0]
    if (result.includes(expr)) {
      tokens.push(createToken(counter, 'function', expr))
      result = replaceAllOccurrences(result, expr, tokens[tokens.length - 1].id)
    }
  }

  if (log) console.log('funcs extract', result)
  return result
}

const replaceAllOccurrences = (input: string, search: string, replacement: string): string => {
  return input.replace(new RegExp(escapeRegExp(search), 'g'), replacement)
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ===== TOKEN SUBSTITUTION =====
export function substituteTokensWithValue(formula: string, tokens: ExpressionToken[]): string {
  const tokenMap = createTokenValueMap(tokens)
  return substituteTokensInFormula(formula, tokens, tokenMap)
}

const createTokenValueMap = (tokens: ExpressionToken[]): Record<string, string> => {
  const tokenMap: Record<string, string> = {}

  tokens.forEach(token => {
    tokenMap[token.id] = token.value ? token.value.toString() : token.expr
  })

  return tokenMap
}

const substituteTokensInFormula = (
  formula: string,
  tokens: ExpressionToken[],
  tokenMap: Record<string, string>
): string => {
  let result = formula

  tokens.forEach(token => {
    result = result.replace(new RegExp(escapeRegExp(token.id), 'g'), tokenMap[token.id])
  })

  return result
}

// ===== FORMULA NORMALIZATION =====
export function normalizeFormula(formula: string): string {
  let result = ''
  let inQuotes = false
  let inBrackets = false

  for (let i = 0; i < formula.length; i++) {
    const char = formula[i]
    const { shouldPreserveSpace, newInQuotes, newInBrackets } = analyzeCharacterState(
      char, inQuotes, inBrackets, formula, i
    )

    inQuotes = newInQuotes
    inBrackets = newInBrackets

    if (shouldPreserveSpace) {
      result += char
    } else if (!/\s/.test(char)) {
      result += char
    }
  }

  return result
}

const analyzeCharacterState = (
  char: string,
  inQuotes: boolean,
  inBrackets: boolean,
  formula: string,
  index: number
) => {
  let newInQuotes = inQuotes
  let newInBrackets = inBrackets
  let shouldPreserveSpace = false

  if (char === '"' || char === "'") {
    newInQuotes = !inQuotes
    shouldPreserveSpace = true
  } else if (char === '[' && !inQuotes) {
    newInBrackets = true
    shouldPreserveSpace = true
  } else if (char === ']' && !inQuotes) {
    newInBrackets = false
    shouldPreserveSpace = true
  } else if (/\s/.test(char)) {
    shouldPreserveSpace = shouldPreserveWhitespace(formula, index, inQuotes, inBrackets)
  }

  return { shouldPreserveSpace, newInQuotes, newInBrackets }
}

const shouldPreserveWhitespace = (
  formula: string,
  index: number,
  inQuotes: boolean,
  inBrackets: boolean
): boolean => {
  if (inQuotes || inBrackets) return true

  if (index > 0 && index < formula.length - 1) {
    const prevChar = formula[index - 1]
    const nextChar = formula[index + 1]
    return /\w/.test(prevChar) && /\w/.test(nextChar)
  }

  return false
}
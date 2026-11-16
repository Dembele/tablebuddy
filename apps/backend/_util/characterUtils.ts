import { functionRegistry } from "@backend/services/functionRegistry"
import { safeEvaluate } from "@backend/_util/safeEvaluate"
import {RollContext} from "@backend/services/Evaluator"

// ===== MAIN REFERENCE RESOLUTION =====
export const resolveReferences = (formula: string, context: RollContext = {}): string => {
  let result = formula
  let iteration = 0

  if (context.log) console.log('Starting resolution:', { formula })

  while (iteration++ < 10) {
    const prev = result

    result = resolveBracedReferences(result, context)
    result = resolveFunctionCalls(result, context)

    if (context.log) console.log(`Iteration ${iteration}:`, { result })
    if (result === prev) break
  }

  if (iteration >= 10) throw new Error(`Circular reference in: ${formula}`)
  if (context.log) console.log('Final result:', { result })

  return result
}

const resolveBracedReferences = (input: string, context: RollContext): string => {
  return input.replace(/{[^{}]+}/g, (expr) => {
    const resolved = resolveSingleReference(expr, context)
    return shouldWrap(resolved) ? `(${resolved})` : resolved
  })
}

const resolveFunctionCalls = (input: string, context: RollContext): string => {
  return input.replace(/@(\w+)\s*\([^)]*\)/g, (full) => {
    return evaluateFunctionCall(full, context)
  })
}

const shouldWrap = (value: string): boolean => {
  return !/^(\(.*\)|-?\d*\.?\d+)$/.test(value) && /[+\-*/]/.test(value)
}

// ===== FUNCTION CALL EVALUATION =====
const evaluateFunctionCall = (functionCall: string, context: RollContext): string => {
  try {
    const { funcName, args } = parseFunctionCall(functionCall)
    const resolvedArgs = resolveFunctionArguments(args, context)
    return executeFunction(funcName, context, resolvedArgs)
  } catch (error) {
    throw new Error(`Failed to evaluate function in "${functionCall}": ${getErrorMessage(error)}`)
  }
}

const parseFunctionCall = (functionCall: string) => {
  const funcNameMatch = functionCall.match(/^@(\w+)/)
  const funcName = funcNameMatch ? funcNameMatch[1] : ''

  const parenStart = functionCall.indexOf('(')
  const parenEnd = functionCall.length - 1
  const argsStr = functionCall.substring(parenStart + 1, parenEnd)

  const args = argsStr ? argsStr.split(',').map(arg => arg.trim()) : []

  return { funcName, args }
}

const resolveFunctionArguments = (args: string[], context: RollContext): string[] => {
  return args.map(arg => {
    const resolvedRef = resolveReferences(arg, context)
    return safeEvaluate(resolvedRef).toString()
  })
}

const executeFunction = (
  funcName: string,
  context: RollContext,
  args: string[]
): string => {
  const fn = functionRegistry[funcName]
  if (!fn) {
    throw new Error(`Unknown function: @${funcName}`)
  }

  const result = fn(context, ...args)
  return String(result)
}

// ===== SINGLE REFERENCE RESOLUTION =====
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const getNestedValue = (obj: unknown, path: string[]): unknown => {
  return path.reduce((current, key) => {
    if (isRecord(current)) {
      return current[key]
    }

    if (Array.isArray(current) && current.includes(key)) {
      return key
    }

    return undefined
  }, obj)
}

export const resolveSingleReference = (expr: string, context: RollContext): string => {
  if (!/^{.+}$/.test(expr)) throw new Error(`Invalid format: ${expr}`)

  const path = expr.slice(1, -1).split('.')
  let value = getNestedValue(context, path)

  if (context.log) console.log({value})

  // Membership check on a list ({character.proficiencies.weaponProficiencies.dagger}): 1 when listed, 0 when not
  const lastKey = path[path.length - 1]
  const parentPath = path.slice(0, -1)
  const parent = getNestedValue(context, parentPath)

  if (Array.isArray(parent)) {
    return parent.includes(lastKey) ? '1' : '0'
  }

  // Only throw if value is still undefined after all resolution attempts
  if (value === undefined) throw new Error(`Undefined reference: ${expr}`)

  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }

  // If value is a string (formula), recursively fully resolve it
  if (typeof value === 'string') {
    value = resolveReferences(value, context)
  }

  return convertToMathValue(value).toString()
}

// Helper function to convert values to math-friendly numbers
const convertToMathValue = (value: unknown): string | number => {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^-?\d*\.?\d+$/.test(value)) return parseFloat(value)
  return String(value)
}

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error)
}
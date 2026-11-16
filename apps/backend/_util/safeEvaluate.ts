import {evaluate} from "mathjs"

export const safeEvaluate = (expr: string): string => {
  if (/^['"].*['"]$/.test(expr)) return expr; // String literals
  if (/^\[.*\]$/.test(expr)) return expr;     // Array literals
  if (expr === 'true' || expr === 'false') return expr; // Booleans
  if (/^-?\d+\.?\d*$/.test(expr)) return expr; // Numbers

  try {
    return /[+\-*/%^()]/.test(expr) ? evaluate(expr).toString() : expr;
  } catch (error) {
    throw new Error(`Evaluation failed for "${expr}": ${error instanceof Error ? error.message : String(error)}`);
  }
};
import {ENDamageType} from "../Damage"

export interface DiceRoll {
  faces: number;
  value: number;
  damageType?: ENDamageType;
  isCrit?: boolean;
  isCritFailure?: boolean;
  isKept: boolean;
}

export interface TokensOutput {
  dices: Array<ExpressionToken>
  refs: Array<ExpressionToken>
  functions: Array<ExpressionToken>
}

export interface ExpressionToken {
  id: string;
  expr: string;
  type: 'dice' | 'reference' | 'operator' | 'literal' | 'function';
  value: number | string;
  details:
    | { type: 'dice'; data: DiceRoll[] }  // Existing dice details
    | { type: 'function'; data: string[] }  // resolved args as strings
    | { type: 'reference' | 'operator' | 'literal'; data: never[] };  // Empty for others
  damageType?: ENDamageType
}

export interface RollOutput {
  formula: string;
  tokenizedFormula: string;
  total: number;
  tokens: TokensOutput;
}

export interface DiceExpression {
  rollCall: string
  count: number,
  faces: number;
  diceRoll: string;
  keepType: KeepType;
  keepNumber: number;
  damageType?: ENDamageType;
}

export type KeepType = 'highest' | 'lowest' | null;
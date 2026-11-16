import {DiceRoll, ExpressionToken, RollOutput, TokensOutput} from "@backend/deps/types/internal/Dice"

export const isDieToken = (token: ExpressionToken): token is ExpressionToken & {
  type: 'dice';
  details: { type: 'dice'; data: DiceRoll[] };
} => (
  token.type === 'dice' &&
  token.details.type === 'dice' &&
  Array.isArray(token.details.data) &&
  token.details.data.every(die => (
    die &&
    'value' in die &&
    'faces' in die
  ))
)


export interface DiceRollOutput extends RollOutput {
  tokens: TokensOutput & {
    dices: Array<ExpressionToken & {
      type: 'dice';
      details: { type: 'dice'; data: DiceRoll[] };
    }>
  }
}

export const expectDiceRoll = (output: RollOutput): DiceRollOutput => {
  if (output.tokens.dices.every(token => isDieToken(token))) {
    // This is safe because we validated every token
    return output as DiceRollOutput
  }
  throw new Error('Expected dice token but got another type')
}
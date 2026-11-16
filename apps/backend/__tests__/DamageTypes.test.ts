//Damage types survive tokenization for every typed group, dice-only groups included (they label the roll breakdown).
import {evaluator} from "@backend/services/Evaluator"
import {blankCharacter} from "@backend/__tests__/_util/characterFixture"

describe('DamageTypes', () => {
  test('each typed group keeps its type: with a modifier, dice only, flat', () => {
    const output = evaluator.eval('(3d6 + 6)[slashing] + (2d6)[poison]', {character: blankCharacter()})
    expect(output.tokens.dices.map((token) => token.damageType)).toEqual(['slashing', 'poison'])
    const single = evaluator.eval('(1d8)[fire]', {character: blankCharacter()})
    expect(single.tokens.dices[0].damageType).toBe('fire')
  })
})

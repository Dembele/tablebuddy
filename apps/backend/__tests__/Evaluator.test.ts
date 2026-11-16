import {evaluator} from "@backend/services/Evaluator"
import {expectDiceRoll} from "@backend/__tests__/_util/utilFunc"

describe('Evaluator Service', () => {
  describe('Basic Rolling Functionality', () => {
    test('should handle various dice notations', () => {
      const results = [
        expectDiceRoll(evaluator.eval("d6")),
        expectDiceRoll(evaluator.eval("3d6")),
        expectDiceRoll(evaluator.eval("2d20 + 2d6"))
      ]

      // Basic dice
      expect(results[0].tokens.dices.length).toBe(1)
      expect(results[0].tokens.dices[0].details.data[0].faces).toBe(6)
      expect(results[0].total).toBeGreaterThanOrEqual(1)
      expect(results[0].total).toBeLessThanOrEqual(6)

      // Multiple dice
      expect(results[1].tokens.dices[0].details.data).toHaveLength(3)
      expect(results[1].total).toBeGreaterThanOrEqual(3)
      expect(results[1].total).toBeLessThanOrEqual(18)

      // Mixed dice
      expect(results[2].tokens.dices[0].details.data).toHaveLength(2)
      expect(results[2].tokens.dices[1].details.data).toHaveLength(2)

    })

    test('should handle min/max rolls', () => {
      jest.spyOn(global.Math, 'random').mockReturnValue(0)
      const minResult = evaluator.eval("3d6")

      jest.spyOn(global.Math, 'random').mockReturnValue(0.999)
      const maxResult = evaluator.eval("3d6")

      expect(minResult.total).toBe(3)
      expect(maxResult.total).toBe(18)
      jest.spyOn(global.Math, 'random').mockRestore()
    })
  })

  describe('Advanced Rolling Features', () => {
    afterEach(() => {
      jest.spyOn(global.Math, 'random').mockRestore()
    })

    test('should handle keep highest/lowest', () => {
      jest.spyOn(global.Math, 'random')
        .mockReturnValueOnce(0.3) // 7 on d20 (0.3 * 20 = 6, but dice start at 1)
        .mockReturnValueOnce(0.8) // 17 on d20 (0.8 * 20 = 16)
        .mockReturnValueOnce(0.3) // 7 on d20
        .mockReturnValueOnce(0.8) // 17 on d20
      const khResult = evaluator.eval("4d20kh2")

      jest.spyOn(global.Math, 'random')
        .mockReturnValueOnce(0.3) // 7 on d20
        .mockReturnValueOnce(0.8) // 17 on d20
        .mockReturnValueOnce(0.3) // 7 on d20
        .mockReturnValueOnce(0.8) // 17 on d20
      const klResult = evaluator.eval("4d20kl2 + 14")

      // Math.random() returns 0-1, but dice rolls are 1-20
      // 0.3 * 20 = 6 → floor(6) + 1 = 7
      // 0.8 * 20 = 16 → floor(16) + 1 = 17
      expect(khResult.total).toBe(34) // 17 + 17 = 34
      expect(klResult.total).toBe(28) // 7 + 7 + 14 = 28
    })

    test('should handle mathematical operations', () => {
      jest.spyOn(global.Math, 'random').mockReturnValue(0.01) // All 1s (0.01 * 6 = 0.06 → floor(0.06) + 1 = 1)
      const result = evaluator.eval("3d6 + 2 + floor(5/2)")
      expect(result.total).toBe(7) // 1+1+1 + 2 + 2 = 7
    })
  })

  describe('Damage Type Handling', () => {
    test('should handle damage types in various configurations', () => {
      const results = [
        evaluator.eval("1d6[piercing]"),
        evaluator.eval("1d6[piercing] + 1d4 + 1d8[fire]"),
        evaluator.eval("2d6kh1[slashing]"),
        evaluator.eval("1d8[piercing] + 2d6kh1[fire] + 1d4[cold] + 1d10")
      ]

      // Single type
      expect(results[0].tokens.dices[0].damageType).toBe("piercing")

      // Mixed types
      expect(results[1].tokens.dices[0].damageType).toBe("piercing")
      expect(results[1].tokens.dices[1].damageType).toBeUndefined()
      expect(results[1].tokens.dices[2].damageType).toBe("fire")

      // Keep highest with type
      expect(results[2].tokens.dices[0].damageType).toBe("slashing")

      // Complex formula
      expect(results[3].tokens.dices[3].damageType).toBeUndefined()
    })
  })

  describe('Dice and character integration', () => {
    test('should handle wrapped die notation', async () => {
      jest.spyOn(global.Math, 'random').mockReturnValue(0.99) // d10 roll = 10
      const roll = expectDiceRoll(evaluator.eval('(1d10 + 4)[slashing]'))

      expect(roll.total).toBe(14)
      expect(roll.tokens.dices.length).toBe(1)
      expect(roll.tokens.dices[0].damageType).toEqual('slashing')
      expect(roll.tokens.dices[0].details.type).toEqual('dice')
      expect(roll.tokens.dices[0].details.data.length).toBe(1)
      expect(roll.tokens.dices[0].details.data[0].value).toBe(10)
      expect(roll.tokens.dices[0].details.data[0].faces).toBe(10)

      jest.spyOn(global.Math, 'random').mockRestore()
    })
  })

  describe('Error Handling', () => {
    test('should reject invalid formulas', () => {
      expect(() => evaluator.eval("invalid")).toThrow()
      expect(() => evaluator.eval("3d")).toThrow()
      expect(() => evaluator.eval("{character.missing}")).toThrow()
    })
  })
})
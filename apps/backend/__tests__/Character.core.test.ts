//Character sheet evaluation on default formulas: functions, proficiency, passive perception, HP, list refs, diffs.
import {evaluator} from "@backend/services/Evaluator"
import {CharacterAPI} from "@backend/services/Character"
import {typedKeys} from "@backend/deps/_util/translationMap"
import {testCharacter} from "@backend/__tests__/_util/characterFixture"

describe('Character sheet', () => {
  let character: CharacterAPI

  beforeEach(() => {
    character = testCharacter()
  })

  describe('Functions', () => {
    test('@level sums classes and filters by class id', async () => {
      await character.setProperty('classes', [{class: 'sorcerer', level: 5}, {class: 'barbarian', level: 1}])

      expect(evaluator.eval('@level()', {character}).total).toBe(6)
      expect(evaluator.eval('@level(sorcerer)', {character}).total).toBe(5)
      expect(evaluator.eval('@level(sorcerer) + @level(barbarian)', {character}).total).toBe(6)
      expect(evaluator.eval('@level(wizard)', {character}).total).toBe(0)
    })

    test('@startingHitDie reads the first class from the registry', async () => {
      expect(evaluator.eval('@startingHitDie()', {character}).total).toBe(0)
      await character.setProperty('classes', [{class: 'barbarian', level: 1}, {class: 'wizard', level: 1}])
      expect(evaluator.eval('@startingHitDie()', {character}).total).toBe(12)
    })
  })

  describe('Proficiency', () => {
    test.each([[1, 2], [4, 2], [5, 3], [9, 4], [13, 5], [17, 6], [20, 6]])('level %i -> +%i', async (level, bonus) => {
      await character.setProperty('classes', [{class: 'fighter', level}])
      expect(character.proficiency).toBe(bonus)
    })
  })

  describe('Passive perception', () => {
    test('adds proficiency, doubled with expertise', async () => {
      await character.setProperty('classes', [{class: 'rogue', level: 1}])
      await character.setProperty('attributes.wisdom.value', 14)
      expect(character.passivePerception).toBe(12)

      await character.setProperty('skills.perception.proficiency', true)
      expect(character.passivePerception).toBe(14)

      await character.setProperty('skills.perception.expertise', true)
      expect(character.passivePerception).toBe(16)
    })
  })

  describe('List references', () => {
    test('a listed id is 1, a missing one is 0', async () => {
      await character.setProperty('proficiencies.weaponProficiencies', ['dagger'])

      expect(evaluator.eval('{character.proficiencies.weaponProficiencies.dagger}', {character}).total).toBe(1)
      expect(evaluator.eval('{character.proficiencies.weaponProficiencies.longsword}', {character}).total).toBe(0)
      expect(evaluator.eval('1 + {character.proficiencies.toolProficiencies.thievesTools} * {character.proficiency}', {character}).total).toBe(1)
    })
  })

  describe('Diff', () => {
    test('returns only changed keys plus _id', async () => {
      const diff = await character.setProperty('classes', [{class: 'fighter', level: 5}])
      const keys = typedKeys(diff)

      expect(keys).toEqual(expect.arrayContaining(['_id', 'classes', 'proficiency']))
      expect(keys.length).toBeLessThan(typedKeys(character.evaluatedData).length)
    })
  })

  describe('Hit points', () => {
    const cases = [
      {classes: [{class: 'wizard', level: 1}], dice: {'6': 1}, con: 1, expected: 1, description: 'level 1 d6, CON -5: at least 1'},
      {classes: [{class: 'wizard', level: 2}], dice: {'6': 2}, con: 1, expected: 2, description: 'level 2 d6, CON -5: 1 per level'},
      {classes: [{class: 'wizard', level: 4}, {class: 'bard', level: 1}], dice: {'6': 4, '8': 1}, con: 10, expected: 23, description: 'd6 x4 + d8, CON +0: 6 + 3x4 + 5'},
      {classes: [{class: 'barbarian', level: 10}], dice: {'12': 10}, con: 16, expected: 105, description: 'level 10 d12, CON +3: 15 + 9x10'},
      {classes: [{class: 'sorcerer', level: 20}], dice: {'6': 20}, con: 1, expected: 20, description: 'level 20 d6, CON -5: 20'}
    ]

    test.each(cases)('$description', async ({classes, dice, con, expected}) => {
      await character.setProperty('classes', classes)
      await character.setProperty('attributes.constitution.value', con)
      for (const [die, count] of Object.entries(dice)) await character.setProperty(`hitDice.max.${die}`, count)

      expect(character.hitPoints.max).toBe(expected)
    })
  })
})

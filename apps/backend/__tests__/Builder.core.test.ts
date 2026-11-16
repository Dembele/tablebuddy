//Character builder (packages/builder) against the real rulebook: creation, level-ups, multiclass, and every class 1→20.
import {Answers, BuildResult, buildCreation, buildLevelUp, standardArray} from "@backend/deps/builder/_index"
import {ICharacter} from "@backend/deps/interfaces/DB/Character"
import {classes} from "@backend/deps/data/loader"
import {evaluateCharacter} from "@backend/services/Character"
import {blankCharacter} from "@backend/__tests__/_util/characterFixture"

type Build = (character: ICharacter, answers: Answers) => BuildResult

//answers every open question (given picks first, then recommended / warning-free options) until nothing is missing
function complete(build: Build, character: ICharacter, given: Answers = {}): BuildResult {
  const answers: Answers = {...given}
  let built = build(character, answers)
  for (let round = 0; round < 40 && built.missing.length; round++) {
    for (const key of built.missing) {
      if (given[key]) continue
      const question = built.questions.find((candidate) => candidate.key === key)!
      if (question.kind === 'scores') {
        answers[key] = standardArray.map(String)
        continue
      }
      const enabled = question.options.filter((option) => !option.disabled)
      const valid = new Set(enabled.map((option) => option.id))
      const recommended = (question.recommended ?? []).filter((id) => valid.has(id)).slice(0, question.count)
      const clean = enabled.filter((option) => !option.warning && !recommended.includes(option.id)).map((option) => option.id)
      const rest = enabled.map((option) => option.id).filter((id) => !recommended.includes(id) && !clean.includes(id))
      answers[key] = [...recommended, ...clean, ...rest].slice(0, question.count)
    }
    built = build(character, answers)
  }
  if (built.missing.length) throw new Error(`still missing: ${built.missing.join(', ')} ${JSON.stringify(built.problems)}`)
  return built
}

const create = (given: Answers) => complete(buildCreation, blankCharacter(), {'scores:method': ['standard'], ...given}).character
const levelUp = (character: ICharacter, classId: string, given: Answers = {}) => complete(buildLevelUp, character, {'levelUp:class': [classId], ...given}).character
const spellsOf = (character: ICharacter) => character.spellcasting.spells.map((entry) => entry.spell)

describe('Builder', () => {
  test('fighter: proficiencies, features, resources, equipment', () => {
    const character = create({race: ['human'], background: ['soldier'], class: ['fighter'], scores: ['15', '14', '13', '12', '10', '8'], 'equipment:class': ['0']})

    expect(character.classes).toEqual([{class: 'fighter', level: 1}])
    expect(character.savingThrows.strength.proficiency).toBe(true)
    expect(character.savingThrows.constitution.proficiency).toBe(true)
    expect(character.hitDice.max['10']).toBe(1)
    expect(character.proficiencies.weaponProficiencies).toEqual(expect.arrayContaining(['longsword', 'dagger']))
    expect(character.proficiencies.languageProficiencies.length).toBe(3)
    expect(character.features.map((instance) => instance.featureId)).toEqual(expect.arrayContaining(['fighterSecondWind', 'fighterWeaponMastery']))
    expect(character.resources.find((resource) => resource.name === 'Второе дыхание')?.max).toBe('2')
    expect(character.inventory.map((entry) => entry.item)).toEqual(expect.arrayContaining(['chainMail', 'greatsword']))
    expect(character.attributes.strength.value).toBeGreaterThanOrEqual(15)
    expect(character.hitPoints.current).toBeGreaterThanOrEqual(11)
  })

  test('wizard: spellbook, cantrips, prepared, slots; subclass at 3', () => {
    let character = create({race: ['highElf'], background: ['sage'], class: ['wizard']})
    expect(character.spellcasting.spellbook?.length).toBe(6)
    expect(spellsOf(character).length).toBeGreaterThanOrEqual(3 + 4)
    expect(character.spellcasting.slots[1]?.max).toBe('2')

    character = levelUp(character, 'wizard')
    expect(character.spellcasting.slots[1]?.max).toBe('3')
    expect(character.spellcasting.spellbook?.length).toBe(8)

    const atThree = complete(buildLevelUp, character, {'levelUp:class': ['wizard']})
    expect(atThree.questions.some((question) => question.key === 'class:wizard:3:subclass')).toBe(true)
    expect(atThree.character.classes[0].subclass).toBeDefined()
    expect(atThree.character.spellcasting.slots[2]?.max).toBe('2')
  })

  test('multiclass warns below 13 in a primary ability', () => {
    const fighter = create({race: ['human'], background: ['soldier'], class: ['fighter'], scores: ['15', '14', '13', '8', '12', '10']})
    const plan = buildLevelUp(fighter, {})
    const wizard = plan.questions[0].options.find((option) => option.id === 'wizard')
    expect(wizard?.warning).toBeDefined()
    expect(plan.questions[0].options.find((option) => option.id === 'fighter')?.warning).toBeUndefined()
  })

  test('warlock: invocations follow the column, pact slots', () => {
    let character = create({race: ['human'], background: ['acolyte'], class: ['warlock']})
    const invocations = () => character.features.find((instance) => instance.featureId === 'warlockEldritchInvocations')?.choices?.invocations ?? []
    expect([invocations()].flat().length).toBe(1)
    expect(character.spellcasting.pactSlots).toEqual({level: 1, max: '1', current: 1})

    character = levelUp(character, 'warlock')
    expect([invocations()].flat().length).toBe(3)
    expect(character.spellcasting.pactSlots?.max).toBe('2')
  })

  test('circle of the land: terrain spells at druid 3', () => {
    let character = create({race: ['human'], background: ['guide'], class: ['druid']})
    character = levelUp(character, 'druid')
    character = levelUp(character, 'druid', {'class:druid:3:subclass': ['land']})
    const terrain = character.features.find((instance) => instance.featureId === 'landCircleSpells')
    expect(terrain).toBeDefined()
    expect(spellsOf(character).filter((id) => character.spellcasting.spells.find((entry) => entry.spell === id)?.from.type === 'subclass').length).toBeGreaterThanOrEqual(3)
  })

  test('no wasted skill picks: owned skills are disabled, never picked twice', () => {
    const built = complete(buildCreation, blankCharacter(), {'scores:method': ['standard'], background: ['charlatan'], race: ['human'], class: ['rogue']})
    const skillQuestions = built.questions.filter((question) => !question.fixed && question.options.some((option) => option.id === 'deception') && /Proficiencies|skill/.test(question.key) && !/expertise/i.test(question.key))
    expect(skillQuestions.length).toBeGreaterThan(0)
    for (const question of skillQuestions) {
      expect(question.options.find((option) => option.id === 'deception')?.disabled).toBeDefined()
      expect(question.options.find((option) => option.id === 'sleightOfHand')?.disabled).toBeDefined()
    }
  })

  test('a cantrip the species already gives stays listed as disabled, not hidden (an old pick of it stays visible to untick)', () => {
    const built = complete(buildCreation, blankCharacter(), {'scores:method': ['standard'], background: ['entertainer'], race: ['rockGnome'], class: ['bard']})
    const cantrips = built.questions.find((question) => question.key.endsWith(':cantrips'))!
    expect(cantrips.options.find((option) => option.id === 'prestidigitation')?.disabled).toBe('уже известно')
  })

  test('rolled scores: method locked, values must be the roll', () => {
    const character = {...blankCharacter(), rolledScores: [16, 15, 12, 11, 9, 7].map((total) => ({total, dice: [total, 1, 1, 1]}))}
    const wrong = buildCreation(character, {'scores:method': ['roll'], scores: standardArray.map(String)})
    expect(wrong.questions.find((question) => question.key === 'scores:method')?.fixed).toBe(true)
    expect(wrong.problems.scores).toBeDefined()
    const right = buildCreation(character, {'scores:method': ['roll'], scores: ['7', '9', '11', '12', '15', '16']})
    expect(right.problems.scores).toBeUndefined()
    expect(right.character.attributes.charisma.value).toBe(16)
  })

  test('point buy must spend exactly 27', () => {
    const under = buildCreation(blankCharacter(), {'scores:method': ['pointBuy'], scores: ['8', '8', '8', '8', '8', '8']})
    expect(under.problems.scores).toBeDefined()
    const exact = buildCreation(blankCharacter(), {'scores:method': ['pointBuy'], scores: ['15', '15', '15', '8', '8', '8']})
    expect(exact.problems.scores).toBeUndefined()
  })

  describe('every class 1 → 20', () => {
    test.each(Object.keys(classes))('%s', (classId) => {
      let character = create({race: ['human'], background: ['soldier'], class: [classId]})
      for (let level = 2; level <= 20; level++) character = levelUp(character, classId)

      expect(character.classes[0].level).toBe(20)
      expect(character.classes[0].subclass).toBeDefined()
      expect(character.hitDice.max[classes[classId as keyof typeof classes].hitDie]).toBe(20)
      expect(() => evaluateCharacter(character)).not.toThrow()
    })
  })

  test('fighter 5 / wizard 3 multiclass slots', () => {
    let character = create({race: ['human'], background: ['sage'], class: ['fighter'], scores: ['15', '10', '13', '14', '12', '8']})
    for (let level = 2; level <= 5; level++) character = levelUp(character, 'fighter', {'class:fighter:3:subclass': ['champion']})
    for (let level = 1; level <= 3; level++) character = levelUp(character, 'wizard')

    expect(character.classes.map((entry) => `${entry.class}${entry.level}`)).toEqual(['fighter5', 'wizard3'])
    expect(character.spellcasting.slots[1]?.max).toBe('4')
    expect(character.spellcasting.slots[2]?.max).toBe('2')
    expect(character.savingThrows.intelligence.proficiency).toBe(false)
  })
})

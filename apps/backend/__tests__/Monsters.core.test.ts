//Monster stat blocks stamped onto a character (builder/monster): the sheet must show the printed numbers.
import {ICharacter} from "@backend/deps/interfaces/DB/Character"
import {stampMonster} from "@backend/deps/builder/monster"
import {getMonster, monsters} from "@backend/deps/data/loader"
import {costOptions} from "@backend/deps/rules/costs"
import {evaluateCharacter} from "@backend/services/Character"
import {blankCharacter} from "@backend/__tests__/_util/characterFixture"

const stamped = (id: keyof typeof monsters): ICharacter => ({...blankCharacter(), race: undefined, background: undefined, ...stampMonster(getMonster(id))})
const total = (value: number, proficiency: boolean, expertise: boolean, pb: number) => value + (expertise ? 2 * pb : proficiency ? pb : 0)

describe('Monsters', () => {
  test('goblin minion: printed AC, HP, initiative, stealth (expertise) and the dagger attack', () => {
    const goblin = evaluateCharacter(stamped('goblinMinion'))
    expect(goblin.armorClass).toBe(12)
    expect(goblin.hitPoints.max).toBe(7)
    expect(goblin.hitPoints.current).toBe(7)
    expect(goblin.initiative.value).toBe(2)
    expect(goblin.proficiency).toBe(2)
    expect(goblin.passivePerception).toBe(9)
    const stealth = goblin.skills.stealth
    expect(total(stealth.value, stealth.proficiency, stealth.expertise, goblin.proficiency)).toBe(6)
    expect(goblin.skills.stealth.expertise).toBe(true)
    expect(goblin.hitDice.max['6']).toBe(2)
    const dagger = goblin.actions.find((action) => action.id === 'goblinMinion_dagger')!
    expect(dagger.from).toEqual({type: 'monster', id: 'goblinMinion'})
    expect('attack' in dagger && dagger.attack).toBe('1d20 + 4')
    expect(goblin.inventory).toEqual([{id: 'dagger-0', item: 'dagger', quantity: 3}])
    expect(costOptions(goblin, dagger).map((option) => option.cost.kind)).toEqual(['none'])
  })

  test('every monster stamps and evaluates to its printed AC, HP, saves and skills', () => {
    for (const monster of Object.values(monsters)) {
      const sheet = evaluateCharacter(stamped(monster.id as keyof typeof monsters))
      expect(sheet.armorClass).toBe(monster.armorClass)
      expect(sheet.hitPoints.max).toBe(monster.hitPoints.average)
      for (const [attribute, printed] of Object.entries(monster.saves ?? {})) {
        const save = sheet.savingThrows[attribute as keyof typeof sheet.savingThrows]
        expect(total(save.value, save.proficiency, false, sheet.proficiency)).toBe(printed)
      }
      for (const [skill, printed] of Object.entries(monster.skills ?? {})) {
        const entry = sheet.skills[skill as keyof typeof sheet.skills]
        expect(total(entry.value, entry.proficiency, entry.expertise, sheet.proficiency)).toBe(printed)
      }
    }
  })
})

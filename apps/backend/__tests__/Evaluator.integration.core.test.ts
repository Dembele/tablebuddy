//Sheet rolls (saves, skills, initiative) and stamped action rolls (tiers, upcast, save DC) on an in-memory character.
import {evaluator} from "@backend/services/Evaluator"
import {CharacterAPI} from "@backend/services/Character"
import {rollAction} from "@backend/services/ActionRoller"
import {CharacterAction} from "@backend/deps/interfaces/DB/Character"
import {Formula} from "@backend/deps/types/internal/Formula"
import {testCharacter} from "@backend/__tests__/_util/characterFixture"

const F = (text: string) => text as Formula

describe('Evaluator - character rolls', () => {
  let character: CharacterAPI

  beforeEach(() => {
    character = testCharacter()
    jest.spyOn(global.Math, 'random').mockReturnValue(0.01) // every die rolls 1
  })

  afterEach(() => {
    jest.spyOn(global.Math, 'random').mockRestore()
  })

  describe('Sheet rolls', () => {
    test('saving throws with/without proficiency', async () => {
      await character.setProperty('classes', [{class: 'fighter', level: 3}])
      await character.setProperty('attributes.strength.value', 12)
      await character.setProperty('savingThrows.strength.proficiency', true)
      expect(evaluator.eval('save.strength', {character}).total).toBe(4) // 1 + 1 STR + 2 prof

      await character.setProperty('savingThrows.strength.proficiency', false)
      expect(evaluator.eval('save.strength', {character}).total).toBe(2) // 1 + 1 STR
    })

    test('initiative shorthand', async () => {
      await character.setProperty('attributes.dexterity.value', 12)
      expect(evaluator.eval('initiative', {character}).total).toBe(2) // 1 + 1 DEX
    })

    test('skills with/without proficiency and expertise', async () => {
      await character.setProperty('classes', [{class: 'rogue', level: 1}])
      await character.setProperty('attributes.dexterity.value', 12)
      expect(evaluator.eval('skill.acrobatics', {character}).total).toBe(2) // 1 + 1 DEX

      await character.setProperty('skills.acrobatics.proficiency', true)
      expect(evaluator.eval('skill.acrobatics', {character}).total).toBe(4) // + 2 prof

      await character.setProperty('skills.acrobatics.expertise', true)
      expect(evaluator.eval('skill.acrobatics', {character}).total).toBe(6) // + 4 expertise
    })
  })

  describe('Action rolls', () => {
    const fireBolt: CharacterAction = {
      id: 'fireBolt_1', name: 'Огненный снаряд', from: {type: 'class', id: 'wizard', level: 1}, spell: 'fireBolt',
      attack: F('1d20 + {character.attributes.intelligence.modifier} + {character.proficiency}'),
      damage: F('(1d10)[fire]'),
      tiers: {5: F('(2d10)[fire]'), 11: F('(3d10)[fire]'), 17: F('(4d10)[fire]')}
    }

    test('attack + damage, spell tier picked by character level', async () => {
      await character.setProperty('classes', [{class: 'wizard', level: 6}, {class: 'fighter', level: 5}])
      await character.setProperty('attributes.intelligence.value', 16)
      const content = rollAction(fireBolt, character)

      expect(content.rolls.map(roll => roll.label)).toEqual(['attack', 'damage'])
      expect(content.rolls[0].output.total).toBe(1 + 3 + 4)
      expect(content.rolls[1].output.total).toBe(3) // 3d10 tier, every die 1
    })

    test('upcast slot replaces damage, save DC is evaluated', async () => {
      await character.setProperty('classes', [{class: 'wizard', level: 5}])
      await character.setProperty('attributes.intelligence.value', 16)
      const burningHands: CharacterAction = {
        id: 'burningHands_1', name: 'Огненные ладони', from: {type: 'class', id: 'wizard', level: 1},
        damage: F('(3d6)[fire]'), slots: {2: F('(4d6)[fire]')},
        save: {attribute: 'dexterity', difficulty: F('8 + {character.attributes.intelligence.modifier} + {character.proficiency} + {character.spellcasting.dcBonus}'), onSave: 'half'},
        hook: {onUse: 'Поджигает горючие предметы'}
      }
      const content = rollAction(burningHands, character, 2)

      expect(content.rolls[0].output.total).toBe(4)
      expect(content.save).toEqual({attribute: 'dexterity', difficulty: 14, onSave: 'half'})
      expect(content.hook).toBe('Поджигает горючие предметы')
    })

    test('reminders: how it is used, then what it does to the target, one per line', () => {
      const grasp: CharacterAction = {
        id: 'shockingGrasp_1', name: 'Электрошок', from: {type: 'class', id: 'wizard', level: 1}, damage: F('(1d8)[lightning]'),
        hook: {onEffect: 'Цель не может совершать Провоцированные атаки', onUse: 'Преимущество, если цель в металлическом доспехе'}
      }
      expect(rollAction(grasp, character).hook).toBe('Преимущество, если цель в металлическом доспехе\nЦель не может совершать Провоцированные атаки')
      expect(rollAction({...grasp, hook: undefined}, character).hook).toBeUndefined()
    })
  })
})

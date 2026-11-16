//BG3-style action previews (services/ActionPreview): attack bonus, damage range with every die at 1 and at its max, DC.
import {ICharacter} from "@backend/deps/interfaces/DB/Character"
import {Formula} from "@backend/deps/types/internal/Formula"
import {stampMonster} from "@backend/deps/builder/monster"
import {getMonster} from "@backend/deps/data/loader"
import {itemActions} from "@backend/deps/rules/choices"
import {evaluateCharacter} from "@backend/services/Character"
import {blankCharacter} from "@backend/__tests__/_util/characterFixture"

describe('ActionPreview', () => {
  test('goblin dagger: +4, 3–6 piercing', () => {
    const goblin = evaluateCharacter({...blankCharacter(), race: undefined, background: undefined, ...stampMonster(getMonster('goblinMinion'))})
    expect(goblin.actions.find((action) => action.id === 'goblinMinion_dagger')!.preview).toEqual({attack: 4, damage: {min: 3, max: 6, types: ['piercing']}})
  })

  test('rapier on a sheet: the better of STR / DEX plus proficiency; damage range from the live modifier', () => {
    const base = blankCharacter()
    const fencer: ICharacter = {
      ...base,
      attributes: {...base.attributes, dexterity: {...base.attributes.dexterity, value: 16}, strength: {...base.attributes.strength, value: 12}},
      proficiencies: {...base.proficiencies, weaponProficiencies: ['rapier']},
      proficiency: '2' as Formula,
      inventory: [{id: 'rapier-0', item: 'rapier', quantity: 1, equipped: 'mainHand'}]
    }
    fencer.actions = itemActions(fencer, fencer.inventory)
    const rapier = evaluateCharacter(fencer).actions.find((action) => action.from.type === 'item')!
    expect(rapier.preview).toEqual({attack: 5, damage: {min: 4, max: 11, types: ['piercing']}})
  })

  test('a pure roll gets a range; an unreadable formula gets no preview instead of breaking the sheet', () => {
    const character = {...blankCharacter(), actions: [
      {id: 'heal', name: 'Лечение', pureRoll: '2d4 + 2' as Formula, from: {type: 'custom' as const}},
      {id: 'broken', name: 'Сломано', pureRoll: '2d4 + {character.nope.nope}(' as Formula, from: {type: 'custom' as const}}
    ]}
    const [heal, broken] = evaluateCharacter(character).actions
    expect(heal.preview).toEqual({roll: {min: 4, max: 10}})
    expect(broken.preview).toBeUndefined()
  })
})

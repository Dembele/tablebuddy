//Magic weapons / armor built on a base item (rules/items): names, stamped +N attacks, slots, and AC from equipped armor (@armor / @shield).
import {ICharacter, InventoryEntry} from "@backend/deps/interfaces/DB/Character"
import {Formula} from "@backend/deps/types/internal/Formula"
import {baseChoices, entryName} from "@backend/deps/rules/items"
import {equip, itemActions} from "@backend/deps/rules/choices"
import {evaluateCharacter} from "@backend/services/Character"
import {blankCharacter} from "@backend/__tests__/_util/characterFixture"

//a character with the given dexterity / strength wearing or holding these entries
function wearing(entries: Array<Omit<InventoryEntry, 'quantity'>>, dexterity = 10, strength = 10): ICharacter {
  const base = blankCharacter()
  const character: ICharacter = {
    ...base,
    attributes: {...base.attributes, dexterity: {...base.attributes.dexterity, value: dexterity}, strength: {...base.attributes.strength, value: strength}},
    inventory: entries.map((entry) => ({quantity: 1, ...entry}))
  }
  character.actions = itemActions(character, character.inventory)
  return character
}

describe('Magic items on a base', () => {
  test('names read through the base', () => {
    expect(entryName({item: 'weaponPlus1', base: 'longsword'})).toBe('Длинный меч +1')
    expect(entryName({item: 'flameTongue', base: 'longsword'})).toBe('Язык пламени (длинный меч)')
    expect(entryName({item: 'weaponPlus1'})).toBe('Оружие +1')
    expect(entryName({item: 'weaponPlus1', base: 'chainMail'})).toBe('Оружие +1')                                     //not a base it admits
  })

  test('base choices: kinds expand, concrete lists stay', () => {
    expect(baseChoices('weaponPlus1')).toContain('longsword')
    expect(baseChoices('weaponPlus1')).not.toContain('plate')
    expect(baseChoices('mithralArmor')).not.toContain('hide')
    expect(baseChoices('mithralArmor')).toContain('plate')
    expect(baseChoices('longsword')).toEqual([])
  })

  test('+1 longsword: the base attacks with +1 stamped into attack and damage, previews follow', () => {
    const fencer = wearing([{id: 'sword', item: 'weaponPlus1', base: 'longsword', equipped: 'mainHand'}], 10, 16)
    const [oneHanded] = fencer.actions
    expect(oneHanded).toMatchObject({id: 'longsword_1:weaponPlus1', name: 'Удар длинным мечом +1', from: {type: 'item', id: 'weaponPlus1'}})
    expect('attack' in oneHanded && oneHanded.attack?.endsWith(' + 1')).toBe(true)
    expect('damage' in oneHanded && oneHanded.damage).toBe('(1d8 + {character.attributes.strength.modifier} + 1)[slashing]')
    expect(evaluateCharacter(fencer).actions[0].preview).toEqual({attack: 4, damage: {min: 5, max: 12, types: ['slashing']}})
  })

  test('two +1 weapons on different bases are two weapons; a flame tongue keeps its own roll', () => {
    const fighter = wearing([
      {id: 'sword', item: 'weaponPlus1', base: 'longsword', equipped: 'mainHand'},
      {id: 'knife', item: 'weaponPlus1', base: 'dagger', equipped: 'offHand'},
      {id: 'flame', item: 'flameTongue', base: 'scimitar', equipped: 'mainHand'}
    ])
    const ids = fighter.actions.map((action) => action.id)
    expect(ids).toContain('longsword_1:weaponPlus1')
    expect(ids.some((id) => id.startsWith('dagger') && id.endsWith(':weaponPlus1'))).toBe(true)
    expect(ids).toContain('flameTongue_1')
    expect(fighter.actions.find((action) => action.id.endsWith(':flameTongue'))!.name).toContain('(Язык пламени)')
  })

  test('equip takes the slot from the base', () => {
    const character = wearing([{id: 'sword', item: 'weaponPlus1', base: 'longsword'}])
    const outcome = equip(character, 'sword')
    expect(outcome.ok && outcome.value[0].equipped).toBe('mainHand')
    expect(equip(wearing([{id: 'sword', item: 'weaponPlus1'}]), 'sword').ok).toBe(false)                              //no base picked yet
  })
})

describe('AC from equipped armor', () => {
  const ac = (character: ICharacter) => evaluateCharacter(character).armorClass

  test('unarmored: 10 + DEX', () => expect(ac(wearing([], 14))).toBe(12))
  test('chain mail ignores DEX; a shield adds 2', () => {
    expect(ac(wearing([{id: 'mail', item: 'chainMail', equipped: 'chest'}], 14))).toBe(16)
    expect(ac(wearing([{id: 'mail', item: 'chainMail', equipped: 'chest'}, {id: 'board', item: 'shield', equipped: 'offHand'}], 14))).toBe(18)
  })
  test('medium armor caps DEX at +2', () => expect(ac(wearing([{id: 'plate', item: 'breastplate', equipped: 'chest'}], 18))).toBe(16))
  test('armor in the pack does nothing', () => expect(ac(wearing([{id: 'mail', item: 'chainMail'}], 14))).toBe(12))
  test('+1 plate and a +2 shield', () => {
    expect(ac(wearing([{id: 'plate', item: 'armorPlus1', base: 'plate', equipped: 'chest'}, {id: 'board', item: 'shieldPlus2', base: 'shield', equipped: 'offHand'}]))).toBe(23)
  })
  test('unarmored defense through the argument, armor still wins', () => {
    const barbarian = (entries: Array<Omit<InventoryEntry, 'quantity'>>) => {
      const character = wearing(entries, 14)
      character.attributes.constitution = {...character.attributes.constitution, value: 16}
      return {...character, armorClass: '@armor(10 + {character.attributes.dexterity.modifier} + {character.attributes.constitution.modifier}) + @shield()' as Formula}
    }
    expect(ac(barbarian([]))).toBe(15)
    expect(ac(barbarian([{id: 'board', item: 'shield', equipped: 'offHand'}]))).toBe(17)
    expect(ac(barbarian([{id: 'mail', item: 'chainMail', equipped: 'chest'}]))).toBe(16)
  })
})

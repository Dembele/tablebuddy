//Items in use bring their actions (rules/choices itemActions): equipped weapons, consumables from the pack; nothing else touched.
import {equip, itemActions, unequip} from "@backend/deps/rules/choices"
import {ICharacter} from "@backend/deps/interfaces/DB/Character"
import {Formula} from "@backend/deps/types/internal/Formula"
import {blankCharacter} from "@backend/__tests__/_util/characterFixture"

const withKit = (): ICharacter => ({
  ...blankCharacter(),
  inventory: [{id: 'quarterstaff-0', item: 'quarterstaff', quantity: 1}, {id: 'potionOfHealing-1', item: 'potionOfHealing', quantity: 2}],
  actions: [{id: 'custom_1', name: 'Своё', pureRoll: '1d4' as Formula, from: {type: 'custom'}}]
})
const ids = (character: Pick<ICharacter, 'actions'>, inventory: ICharacter['inventory']) => itemActions(character, inventory).map((action) => action.id)

describe('ItemActions', () => {
  test('a potion acts from the pack; the staff only once equipped, and leaves on unequip', () => {
    const character = withKit()
    expect(ids(character, character.inventory)).toEqual(['custom_1', 'potionOfHealing_1'])

    const worn = equip(character, 'quarterstaff-0')
    if (!worn.ok) throw new Error(worn.reason)
    const armed = itemActions(character, worn.value)
    expect(armed.map((action) => action.id).sort()).toEqual(['custom_1', 'potionOfHealing_1', 'quarterstaff_1', 'quarterstaff_2'])
    expect(armed.find((action) => action.id === 'quarterstaff_1')!.from).toEqual({type: 'item', id: 'quarterstaff'})

    const stowed = unequip({...character, inventory: worn.value, actions: armed}, 'quarterstaff-0')
    if (!stowed.ok) throw new Error(stowed.reason)
    expect(ids({actions: armed}, stowed.value)).toEqual(['custom_1', 'potionOfHealing_1'])
  })

  test('a used-up stack takes its action along; two of the same item stamp once', () => {
    const character = withKit()
    expect(ids(character, [{id: 'potionOfHealing-1', item: 'potionOfHealing', quantity: 0}])).toEqual(['custom_1'])
    const pair = [{id: 'potionOfHealing-1', item: 'potionOfHealing' as const, quantity: 1}, {id: 'potionOfHealing-2', item: 'potionOfHealing' as const, quantity: 1}]
    expect(ids(character, pair)).toEqual(['custom_1', 'potionOfHealing_1'])
  })
})

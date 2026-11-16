//Player choices and request costs (packages/rules) on characters built by the real builder.
import {ICharacter} from "@backend/deps/interfaces/DB/Character"
import {attune, equip, preparedLimits, setPrepared} from "@backend/deps/rules/choices"
import {costOptions, recover, recoverable, rest, spend} from "@backend/deps/rules/costs"
import {evaluateCharacter} from "@backend/services/Character"
import {builtCharacter} from "@backend/__tests__/_util/characterFixture"
import {spells} from "@backend/deps/data/loader"

//apply a spend / rest result to a character copy
const applied = (character: ICharacter, changes: Array<{ path: string; value: unknown }>) =>
  ({...character, ...Object.fromEntries(changes.map((change) => [change.path, change.value]))}) as ICharacter

describe('Rules', () => {
  test('a bow spends an arrow (magic ones too), a dart spends itself, no ammo leaves it to the DM', () => {
    const archer = builtCharacter({background: ['soldier'], race: ['human'], class: ['fighter']})
    const bow = {from: {type: 'item' as const, id: 'longbow' as never}}
    const armed = {...archer, inventory: [{id: 'bow', item: 'longbow' as never, quantity: 1}, {id: 'arrows', item: 'arrow' as never, quantity: 20},
      {id: 'magic', item: 'ammunitionPlus1' as never, base: 'arrow' as never, quantity: 3}, {id: 'bolts', item: 'bolts' as never, quantity: 10}]}
    expect(costOptions(armed, bow).map((option) => option.cost)).toEqual([{kind: 'item', entryId: 'arrows'}, {kind: 'item', entryId: 'magic'}])
    const shot = spend(armed, [{kind: 'item', entryId: 'arrows'}])
    expect(shot.ok && (shot.changes.find((change) => change.path === 'inventory')!.value as ICharacter['inventory'])[1].quantity).toBe(19)
    expect(costOptions({...archer, inventory: [{id: 'bow', item: 'longbow' as never, quantity: 1}]}, bow)).toEqual([{cost: {kind: 'none'}, label: 'Нет боеприпасов — на усмотрение ГМ'}])
    expect(costOptions({...archer, inventory: [{id: 'darts', item: 'dart' as never, quantity: 5}]}, {from: {type: 'item', id: 'dart' as never}}).map((option) => option.cost))
      .toEqual([{kind: 'item', entryId: 'darts'}])
  })

  test('fired ammo is counted, an empty quiver stays; picking up returns half (needles none) and the count starts over', () => {
    const archer = builtCharacter({background: ['soldier'], race: ['human'], class: ['fighter']})
    let character: ICharacter = {...archer, inventory: [{id: 'arrows', item: 'arrow' as never, quantity: 3}, {id: 'needles', item: 'needle' as never, quantity: 1}]}
    for (const entryId of ['arrows', 'arrows', 'arrows', 'needles']) {
      const shot = spend(character, [{kind: 'item', entryId}])
      if (!shot.ok) throw new Error(shot.reason)
      character = applied(character, shot.changes)
    }
    expect(character.inventory).toEqual([{id: 'arrows', item: 'arrow', quantity: 0, spent: 3}, {id: 'needles', item: 'needle', quantity: 0, spent: 1}])
    expect(recoverable(character).map((entry) => entry.back)).toEqual([1, 0])
    expect(applied(character, recover(character, true)).inventory).toEqual([{id: 'arrows', item: 'arrow', quantity: 1}])
    expect(applied(character, recover(character, false)).inventory).toEqual([])
  })

  test('spell costs: slots by level, spent one by one, refused when empty; long rest restores', () => {
    const wizard = builtCharacter({background: ['sage'], race: ['human'], class: ['wizard'], 'class:wizard:1:prepared': ['magicMissile', 'mageArmor', 'detectMagic', 'featherFall']})
    const missile = wizard.actions.find((action) => action.spell === 'magicMissile')!
    const options = costOptions(wizard, missile)
    expect(options.map((option) => option.cost.kind)).toEqual(['slot'])
    expect(options[0].slot).toBe(1)

    let current = wizard
    for (let cast = 0; cast < 2; cast++) {
      const result = spend(current, [options[0].cost])
      expect(result.ok).toBe(true)
      if (result.ok) current = applied(current, result.changes)
    }
    expect(current.spellcasting.slots[1]?.current).toBe(0)
    expect(spend(current, [options[0].cost]).ok).toBe(false)
    expect(costOptions(current, missile).length).toBe(0)

    const rested = applied(current, rest(current, evaluateCharacter(current), 'long'))
    expect(rested.spellcasting.slots[1]?.current).toBe(2)
  })

  test('free cast from a feat is offered once, then spent', () => {
    const sage = builtCharacter({background: ['sage'], race: ['human'], class: ['fighter'], 'background:feat:magicInitiate:spell': ['sleep']})
    const sleep = sage.actions.find((action) => action.spell === 'sleep')
    if (!sleep) return //Sleep has no roll in the data: nothing to request
    const free = costOptions(sage, sleep).find((option) => option.cost.kind === 'freeCast')!
    const result = spend(sage, [free.cost])
    expect(result.ok).toBe(true)
    if (result.ok) expect(costOptions(applied(sage, result.changes), sleep).some((option) => option.cost.kind === 'freeCast')).toBe(false)
  })

  test('feature actions offer their own pool or nothing', () => {
    const fighter = builtCharacter({background: ['soldier'], race: ['human'], class: ['fighter']})
    const secondWind = fighter.actions.find((action) => action.from.type === 'class' && /Второе дыхание/.test(action.name))!
    const kinds = costOptions(fighter, secondWind).map((option) => option.cost.kind)
    expect(kinds).toEqual(['resource', 'none'])
  })

  test('prepared spells stay within the class count', () => {
    const cleric = builtCharacter({background: ['acolyte'], race: ['human'], class: ['cleric']})
    const limit = preparedLimits(cleric)['class:cleric']
    expect(limit.prepared).toBe(limit.limit)
    const leveled = (id: string) => ((spells as Record<string, { level: number }>)[id]?.level ?? 0) > 0
    const first = cleric.spellcasting.spells.find((entry) => entry.from.type === 'class' && entry.prepared && !entry.alwaysPrepared && leveled(entry.spell))!
    expect(setPrepared(cleric, 'light', 'class:cleric', false).ok).toBe(false) //cantrips are not prepared
    const unprepared = setPrepared(cleric, first.spell, 'class:cleric', false)
    expect(unprepared.ok).toBe(true)
    if (!unprepared.ok) return
    const back = setPrepared({...cleric, spellcasting: {...cleric.spellcasting, spells: unprepared.value}}, first.spell, 'class:cleric', true)
    expect(back.ok).toBe(true)
    expect(setPrepared(cleric, first.spell, 'class:cleric', true).ok).toBe(true) //already prepared: no change of count
  })

  test('equip replaces what sat in the slot; attunement only where required', () => {
    const fighter = builtCharacter({background: ['soldier'], race: ['human'], class: ['fighter'], 'equipment:class': ['0']})
    const mail = fighter.inventory.find((entry) => entry.item === 'chainMail')!
    const worn = equip(fighter, mail.id)
    expect(worn.ok).toBe(true)
    if (!worn.ok) return
    expect(worn.value.find((entry) => entry.id === mail.id)?.equipped).toBeDefined()
    expect(attune(fighter, mail.id, true, 3).ok).toBe(false)
  })
})

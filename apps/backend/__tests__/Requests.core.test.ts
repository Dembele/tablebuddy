//Request preparation (events/request): what a request may ask, checked against the character and rolled at once; what a verdict spends.
import {builtCharacter} from "@backend/__tests__/_util/characterFixture"
import {Character} from "@backend/services/Character"
import {costsOf, prepare} from "@backend/events/request/requestEvents"
import {costOptions, spend} from "@backend/deps/rules/costs"

describe('Requests', () => {
  const wizard = Character.fromData(builtCharacter({background: ['sage'], race: ['human'], class: ['wizard'], 'class:wizard:1:prepared': ['magicMissile', 'mageArmor', 'detectMagic', 'featherFall']}))
  const missile = wizard.pureData.actions.find((action) => action.spell === 'magicMissile')!

  test('a pool with no roll of its own (Innate Sorcery) is spent by its own request, refused once empty', () => {
    const sorcerer = Character.fromData(builtCharacter({background: ['sage'], race: ['human'], class: ['sorcerer']}))
    const pool = sorcerer.pureData.resources.find((resource) => resource.name === 'Врождённое чародейство')!
    const subject = {kind: 'resource' as const, name: pool.name, from: pool.from}
    expect(prepare(sorcerer, subject)).toMatchObject({title: 'Врождённое чародейство', costLabel: 'Врождённое чародейство (осталось 2)'})
    const spent = spend(sorcerer.pureData, costsOf(subject))
    if (!spent.ok) throw new Error(spent.reason)
    const resources = spent.changes.find((change) => change.path === 'resources')!.value as typeof sorcerer.pureData.resources
    expect(resources.find((resource) => resource.name === pool.name)!.current).toBe(1)
    const empty = Character.fromData({...sorcerer.pureData, resources: resources.map((resource) => ({...resource, current: 0}))})
    expect(prepare(empty, subject)).toBe('Врождённое чародейство: использования закончились')
  })

  test('an action with a cost the character has: rolled now, cost named for the DM', () => {
    const [option] = costOptions(wizard.pureData, missile)
    const prepared = prepare(wizard, {kind: 'action', actionId: missile.id, cost: option.cost})
    if (typeof prepared === 'string') throw new Error(prepared)
    expect(prepared.title).toBe(missile.name)
    expect(prepared.costLabel).toBe(option.label)
    expect(prepared.content?.rolls.length).toBeGreaterThan(0)
    expect(costsOf({kind: 'action', actionId: missile.id, cost: option.cost})).toEqual([option.cost])
  })

  test('a cost the character does not have is refused', () => {
    expect(typeof prepare(wizard, {kind: 'action', actionId: missile.id, cost: {kind: 'slot', level: 9}})).toBe('string')
    expect(typeof prepare(wizard, {kind: 'action', actionId: 'nope', cost: {kind: 'none'}})).toBe('string')
  })

  test('a spell with no roll is cast with a slot; an unknown one is refused', () => {
    const armor = wizard.pureData.spellcasting.spells.find((entry) => entry.spell === 'mageArmor')!
    const prepared = prepare(wizard, {kind: 'cast', spell: 'mageArmor', from: armor.from, cost: {kind: 'slot', level: 1}})
    if (typeof prepared === 'string') throw new Error(prepared)
    expect(prepared.content?.rolls).toEqual([])
    expect(typeof prepare(wizard, {kind: 'cast', spell: 'fireball', from: armor.from, cost: {kind: 'slot', level: 3}})).toBe('string')
  })

  test('checks, hit dice, rests and free rolls', () => {
    const check = prepare(wizard, {kind: 'check', rollType: 'skill.arcana'})
    expect(typeof check !== 'string' && check.content?.rollType).toBe('skill.arcana')
    expect(typeof prepare(wizard, {kind: 'check', rollType: 'attack'})).toBe('string')
    expect(typeof prepare(wizard, {kind: 'hitDie', die: '6'})).not.toBe('string')
    expect(typeof prepare(wizard, {kind: 'hitDie', die: '12'})).toBe('string')
    expect(costsOf({kind: 'rest', rest: 'long'})).toEqual([])
    const free = prepare(wizard, {kind: 'formula', formula: '2d6+3'})
    if (typeof free === 'string') throw new Error(free)
    expect(free.content?.rolls[0].output.total).toBeGreaterThanOrEqual(5)
  })
})

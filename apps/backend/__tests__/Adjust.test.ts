//DM quick controls (rules/adjust): temp HP absorb first, clamps, condition toggles, exhaustion, refusals.
import {adjust} from "@backend/deps/rules/adjust"
import {EvaluatedCharacter} from "@backend/deps/interfaces/DB/Character"

const sheet = (current: number, max: number, temp = 0, conditions: EvaluatedCharacter['conditions'] = []) =>
  ({hitPoints: {current, max, temp}, conditions}) as Pick<EvaluatedCharacter, 'hitPoints' | 'conditions'>

describe('Adjust', () => {
  test('damage eats temp HP first, then current, never below 0', () => {
    expect(adjust(sheet(10, 20, 4), {kind: 'damage', amount: 6})).toEqual([{path: 'hitPoints.temp', value: 0}, {path: 'hitPoints.current', value: 8}])
    expect(adjust(sheet(10, 20, 4), {kind: 'damage', amount: 3})).toEqual([{path: 'hitPoints.temp', value: 1}, {path: 'hitPoints.current', value: 10}])
    expect(adjust(sheet(5, 20), {kind: 'damage', amount: 50})).toEqual([{path: 'hitPoints.current', value: 0}])
  })

  test('healing stops at max and leaves temp HP alone; direct set is bounded', () => {
    expect(adjust(sheet(15, 20, 3), {kind: 'heal', amount: 10})).toEqual([{path: 'hitPoints.current', value: 20}])
    expect(adjust(sheet(15, 20), {kind: 'setHitPoints', current: 7})).toEqual([{path: 'hitPoints.current', value: 7}])
    expect(typeof adjust(sheet(15, 20), {kind: 'setHitPoints', current: 21})).toBe('string')
    expect(adjust(sheet(15, 20), {kind: 'setTemp', temp: 5})).toEqual([{path: 'hitPoints.temp', value: 5}])
  })

  test('conditions toggle without duplicates; exhaustion keeps one entry with a level', () => {
    const poisoned = adjust(sheet(5, 5), {kind: 'condition', condition: 'poisoned', on: true})
    expect(poisoned).toEqual([{path: 'conditions', value: [{condition: 'poisoned'}]}])
    expect(adjust(sheet(5, 5, 0, [{condition: 'poisoned'}]), {kind: 'condition', condition: 'poisoned', on: true})).toEqual([{path: 'conditions', value: [{condition: 'poisoned'}]}])
    expect(adjust(sheet(5, 5, 0, [{condition: 'poisoned'}, {condition: 'prone'}]), {kind: 'condition', condition: 'poisoned', on: false})).toEqual([{path: 'conditions', value: [{condition: 'prone'}]}])
    expect(adjust(sheet(5, 5, 0, [{condition: 'exhaustion', level: 2}]), {kind: 'exhaustion', level: 3})).toEqual([{path: 'conditions', value: [{condition: 'exhaustion', level: 3}]}])
    expect(adjust(sheet(5, 5, 0, [{condition: 'exhaustion', level: 2}]), {kind: 'exhaustion', level: 0})).toEqual([{path: 'conditions', value: []}])
  })

  test('refuses nonsense: negative or fractional amounts, unknown conditions, death saves out of range', () => {
    expect(typeof adjust(sheet(5, 5), {kind: 'damage', amount: -1})).toBe('string')
    expect(typeof adjust(sheet(5, 5), {kind: 'heal', amount: 1.5})).toBe('string')
    expect(typeof adjust(sheet(5, 5), {kind: 'condition', condition: 'flying' as never, on: true})).toBe('string')
    expect(typeof adjust(sheet(0, 5), {kind: 'deathSaves', success: 4, failure: 0, isStable: false})).toBe('string')
    expect(adjust(sheet(0, 5), {kind: 'deathSaves', success: 2, failure: 1, isStable: false})).toHaveLength(3)
  })
})

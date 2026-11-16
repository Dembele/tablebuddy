//Coins (rules/coins): paying with change, purse value, receiving, price labels — registry-free, runs on any book.
import {pay, priceText, purseValue, receive} from "@backend/deps/rules/coins"

const purse = (coins: Partial<Record<'copper' | 'silver' | 'electrum' | 'gold' | 'platinum', number>>) =>
  ({copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0, ...coins})

describe('Coins', () => {
  test('pays with the smallest coins first and gives change in gold / silver / copper', () => {
    expect(pay(purse({copper: 5, gold: 1}), 50)).toEqual(purse({silver: 5, copper: 5}))
    expect(pay(purse({gold: 3, platinum: 1}), 250)).toEqual(purse({silver: 5, platinum: 1}))
    expect(pay(purse({gold: 1}), 101)).toBeNull()
  })

  test('purse value, receiving and labels', () => {
    expect(purseValue(purse({platinum: 1, gold: 2, electrum: 1, silver: 3, copper: 4}))).toBe(1284)
    expect(receive(purse({}), 1534)).toEqual(purse({gold: 15, silver: 3, copper: 4}))
    expect(priceText(1500)).toBe('15 ЗМ')
    expect(priceText(25)).toBe('2 СМ 5 ММ')
    expect(priceText(0)).toBe('0 ММ')
  })
})

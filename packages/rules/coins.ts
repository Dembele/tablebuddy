//Coins: purse value, paying a price (smallest coins first, change back in gold / silver / copper), receiving money, labels.
//Pure and registry-free, so client components may import it (prices in the shop panel).
import {ICharacter} from "../interfaces/DB/Character"

export type Currency = ICharacter['currency']

const coinValues = [['copper', 1], ['silver', 10], ['electrum', 50], ['gold', 100], ['platinum', 1000]] as const
const changeValues = [['gold', 100], ['silver', 10], ['copper', 1]] as const
const coinLabels = {platinum: 'ПМ', gold: 'ЗМ', electrum: 'ЭМ', silver: 'СМ', copper: 'ММ'} as const

//everything in the purse, in copper
export const purseValue = (currency: Currency) => coinValues.reduce((sum, [coin, value]) => sum + currency[coin] * value, 0)

//money in: as few coins as possible, gold / silver / copper (nobody hands out platinum as change)
export function receive(currency: Currency, copper: number): Currency {
  const next = {...currency}
  let left = Math.max(0, Math.floor(copper))
  for (const [coin, value] of changeValues) {
    const count = Math.floor(left / value)
    next[coin] += count
    left -= count * value
  }
  return next
}

//money out: spend the smallest coins first, take the change back; null when the purse cannot cover it
export function pay(currency: Currency, copper: number): Currency | null {
  if (purseValue(currency) < copper) return null
  const next = {...currency}
  let due = copper
  for (const [coin, value] of coinValues) {
    if (due <= 0) break
    const taken = Math.min(next[coin], Math.ceil(due / value))
    next[coin] -= taken
    due -= taken * value
  }
  return receive(next, -due)
}

//«15 ЗМ», «2 СМ 5 ММ», «0 ММ»
export function priceText(copper: number): string {
  const parts: string[] = []
  let left = copper
  for (const [coin, value] of changeValues) {
    const count = Math.floor(left / value)
    if (count) parts.push(`${count} ${coinLabels[coin]}`)
    left -= count * value
  }
  return parts.join(' ') || `0 ${coinLabels.copper}`
}

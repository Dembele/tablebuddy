//Shop rules (rules/shop) on the core book: the rolled shelf within the DM's limits, buying, selling at half price.
import {buy, rollStock, sell, sellPrice, takeStock} from "@backend/deps/rules/shop"
import {ShopEntry} from "@backend/deps/interfaces/shared/Shop"
import {InventoryEntry} from "@backend/deps/interfaces/DB/Character"

const purse = (coins: Partial<Record<'copper' | 'silver' | 'electrum' | 'gold' | 'platinum', number>>) =>
  ({copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0, ...coins})

//a seeded generator, so the shelf is the same every run
function seeded(seed: number) {
  let state = seed
  return () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648
}

describe('Shop', () => {
  test('the shelf keeps to the cap and the rarity ceiling; magic weapons get a base', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const shelf = rollStock({magicLimit: 4, maxRarity: 'uncommon'}, seeded(seed))
      const magic = shelf.filter((entry) => entry.magic)
      expect(magic.length).toBeLessThanOrEqual(4)
      expect(magic.every((entry) => ['common', 'uncommon'].includes(entry.rarity) && entry.stock === 1)).toBe(true)
      expect(magic.filter((entry) => entry.item.startsWith('weaponPlus')).every((entry) => !!entry.base)).toBe(true)
      expect(shelf.filter((entry) => !entry.magic).length).toBeGreaterThan(50)
      expect(shelf.every((entry) => entry.price > 0)).toBe(true)
    }
    expect(rollStock({magicLimit: 0, maxRarity: 'legendary'}, seeded(9)).some((entry) => entry.magic)).toBe(false)
  })

  const longsword: ShopEntry = {id: 'longsword', item: 'longsword', name: 'Длинный меч', type: 'weapon', rarity: 'common', magic: false, price: 1500, stock: null}
  const plusOne: ShopEntry = {id: 'weaponPlus1:dagger', item: 'weaponPlus1', base: 'dagger', name: 'Кинжал +1', type: 'weapon', rarity: 'uncommon', magic: true, price: 40200, stock: 1}

  test('buying takes the money and stacks mundane items; magic is one of a kind', () => {
    const owned: InventoryEntry[] = [{id: 'a', item: 'longsword', quantity: 1}]
    const bought = buy({inventory: owned, currency: purse({gold: 40})}, longsword, 2, 'new')
    expect(bought.ok && bought.value).toEqual({inventory: [{id: 'a', item: 'longsword', quantity: 3}], currency: purse({gold: 10})})

    const magic = buy({inventory: [], currency: purse({gold: 500})}, plusOne, 1, 'new')
    expect(magic.ok && magic.value.inventory).toEqual([{id: 'new', item: 'weaponPlus1', base: 'dagger', quantity: 1}])
    expect(buy({inventory: [], currency: purse({gold: 500})}, plusOne, 2, 'new')).toEqual({ok: false, reason: 'Столько нет в лавке'})
    expect(buy({inventory: [], currency: purse({gold: 14})}, longsword, 1, 'new')).toEqual({ok: false, reason: 'Не хватает денег'})
    expect(takeStock([longsword, plusOne], plusOne.id, 1)).toEqual([longsword])
  })

  test('loot is never on the shelf; treasure sells at its full price', () => {
    expect(rollStock({magicLimit: 0, maxRarity: 'common'}, seeded(3)).some((entry) => entry.type === 'junk' || entry.type === 'treasure')).toBe(false)
    expect(sellPrice('silverChandelier')).toBe(2500)
    expect(sellPrice('longsword')).toBe(750)
  })

  test('selling: half price, mundane and unequipped only', () => {
    const inventory: InventoryEntry[] = [
      {id: 'swords', item: 'longsword', quantity: 2},
      {id: 'worn', item: 'longsword', quantity: 1, equipped: 'mainHand'},
      {id: 'magic', item: 'weaponPlus1', base: 'dagger', quantity: 1}
    ]
    const sold = sell({inventory, currency: purse({})}, 'swords', 1)
    expect(sold.ok && sold.value.currency).toEqual(purse({gold: 7, silver: 5}))
    expect(sold.ok && sold.value.inventory[0].quantity).toBe(1)
    expect(sell({inventory, currency: purse({})}, 'worn', 1)).toEqual({ok: false, reason: 'Сначала снимите предмет'})
    expect(sell({inventory, currency: purse({})}, 'magic', 1)).toEqual({ok: false, reason: 'Магические предметы покупает только ГМ'})
  })
})

//Shop rules: rolling the shelf (mundane items likely, magic by rarity up to the DM's cap), buying, selling at half price (treasure at full).
//Pure: the backend runs these on a DM or player press and stores the result (Doctrine: every change is a press, nothing ticks).
import {ICharacter, InventoryEntry} from "../interfaces/DB/Character"
import {ShopEntry, ShopSettings, ShopState} from "../interfaces/shared/Shop"
import {ENItemRarity, Item, itemRarityMap} from "../types/book/items"
import {ItemId} from "../data/loader"
import {armor} from "../data/loader"
import {weapon} from "../data/loader"
import {tools} from "../data/loader"
import {miscItems} from "../data/loader"
import {MagicItem} from "../types/book/items"
import {magicItems} from "../data/loader"
import {baseChoices, entryName, itemOf} from "./items"
import {pay, receive} from "./coins"
import type {Outcome} from "./choices"

type Purse = Pick<ICharacter, 'inventory' | 'currency'>

const mundaneChance = 0.85
const magicChance: Record<ENItemRarity, number> = {common: 0.4, uncommon: 0.15, rare: 0.06, veryRare: 0.02, legendary: 0.005, artifact: 0}
const rarityOrder = Object.keys(itemRarityMap) as ENItemRarity[]
const refuse = (reason: string): Outcome<never> => ({ok: false, reason})

//everything a shop can carry without the DM: priced, non-magic, not loot — junk or treasure (equipment packs are not items)
const mundaneIds = [armor, weapon, tools, miscItems].flatMap((registry) =>
  Object.values(registry as Record<string, Item>).filter((item) => item.type !== 'junk' && item.type !== 'treasure' && (item.cost ?? 0) > 0).map((item) => item.id as ItemId))

export const isMagic = (itemId: string) => itemId in magicItems
export const emptyShop = (): ShopState => ({open: false, magicLimit: 3, maxRarity: 'uncommon', entries: []})

//Fisher–Yates over a copy
function shuffled<T>(list: T[], random: () => number): T[] {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[copy[index], copy[other]] = [copy[other], copy[index]]
  }
  return copy
}

//one shelf line: name and price resolved here so clients need no rulebook; magic = item price + its base's
function shelfEntry(itemId: ItemId, base: ItemId | undefined, stock: number | null): ShopEntry {
  const item = itemOf(itemId)!
  const price = (item.cost ?? 0) + (base ? itemOf(base)?.cost ?? 0 : 0)
  return {id: base ? `${itemId}:${base}` : itemId, item: itemId, ...(base ? {base} : {}), name: entryName({item: itemId, base}),
    type: item.type, rarity: item.rarity, magic: isMagic(itemId), price, stock}
}

//a fresh shelf: each mundane item with a high chance; magic items by rarity, no rarer than allowed, at most magicLimit, one each
export function rollStock(settings: ShopSettings, random: () => number = Math.random): ShopEntry[] {
  const allowed = rarityOrder.slice(0, rarityOrder.indexOf(settings.maxRarity) + 1)
  const mundane = mundaneIds.filter(() => random() < mundaneChance).map((id) => shelfEntry(id, undefined, null))
  const rolledMagic = Object.values(magicItems as Record<string, MagicItem>)
    .filter((item) => item.cost && allowed.includes(item.rarity) && random() < magicChance[item.rarity])
  const magic = shuffled(rolledMagic, random).slice(0, Math.max(0, Math.floor(settings.magicLimit))).map((item) => {
    const bases = baseChoices(item.id)
    return shelfEntry(item.id as ItemId, bases.length ? bases[Math.floor(random() * bases.length)] : undefined, 1)
  })
  return [...mundane, ...magic].sort((a, b) => Number(a.magic) - Number(b.magic) || a.name.localeCompare(b.name))
}

//the shelf after a sale: limited stock goes down, a sold-out line leaves
export function takeStock(entries: ShopEntry[], entryId: string, quantity: number): ShopEntry[] {
  return entries.flatMap((entry) => entry.id !== entryId || entry.stock === null ? [entry]
    : entry.stock - quantity > 0 ? [{...entry, stock: entry.stock - quantity}] : [])
}

//a magic item's charges when it comes off the shelf: its printed constant maximum, if it has one
const freshCharges = (itemId: string) => {
  const max = Number((itemOf(itemId) as { resource?: { max: string } } | undefined)?.resource?.max)
  return Number.isFinite(max) && max > 0 ? max : undefined
}

//pay for `quantity` of a shelf line; mundane items stack onto a plain unequipped entry of the same item
export function buy(purse: Purse, entry: ShopEntry, quantity: number, newEntryId: string): Outcome<Purse> {
  if (!Number.isInteger(quantity) || quantity < 1) return refuse('Неверное количество')
  if (entry.stock !== null && quantity > entry.stock) return refuse('Столько нет в лавке')
  const currency = pay(purse.currency, entry.price * quantity)
  if (!currency) return refuse('Не хватает денег')

  const stack = !entry.magic && purse.inventory.find((owned) => owned.item === entry.item && owned.base === entry.base
    && !owned.equipped && !owned.note && owned.charges === undefined)
  const charges = entry.magic ? freshCharges(entry.item) : undefined
  const inventory: InventoryEntry[] = stack
    ? purse.inventory.map((owned) => owned === stack ? {...owned, quantity: owned.quantity + quantity} : owned)
    : [...purse.inventory, {id: newEntryId, item: entry.item, ...(entry.base ? {base: entry.base} : {}), quantity, ...(charges ? {charges} : {})}]
  return {ok: true, value: {inventory, currency}}
}

//what one piece fetches: treasure (gems, art objects) its full price, other mundane items half; magic is sold to the DM by hand
export function sellPrice(itemId: string): number | null {
  if (isMagic(itemId)) return null
  const item = itemOf(itemId)
  return item?.type === 'treasure' ? item.cost ?? 0 : Math.floor((item?.cost ?? 0) / 2)
}

//sell `quantity` from an unequipped entry at its sell price
export function sell(purse: Purse, entryId: string, quantity: number): Outcome<Purse & { earned: number; name: string }> {
  const owned = purse.inventory.find((entry) => entry.id === entryId)
  if (!owned) return refuse('Предмет в инвентаре не найден')
  const each = owned.base ? null : sellPrice(owned.item)
  if (each === null) return refuse('Магические предметы покупает только ГМ')
  if (owned.equipped) return refuse('Сначала снимите предмет')
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > owned.quantity) return refuse('Неверное количество')
  if (each === 0) return refuse('За это ничего не дадут')

  const earned = each * quantity
  const inventory = owned.quantity === quantity ? purse.inventory.filter((entry) => entry !== owned)
    : purse.inventory.map((entry) => entry === owned ? {...entry, quantity: entry.quantity - quantity} : entry)
  return {ok: true, value: {inventory, currency: receive(purse.currency, earned), earned, name: entryName(owned)}}
}

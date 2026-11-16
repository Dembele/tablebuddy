//What an item is: the shapes every book's items follow, and the item vocabularies (slots, rarities, types, properties, masteries).
//Ids come from the installed books (data/loader); the entries themselves live in the books under data/<book>/items.

import {Resource} from "../../interfaces/pure/Resource"
import {Action, Attack, ContextRoll} from "../../interfaces/pure/Action"
import {Hooks} from "../Hook"
import {Formula} from "../internal/Formula"
import {ENAttribute} from "../Attribute"
import {ENClass} from "../Class"
import type {AmmoIds, AmmoType, ArmorIds, BundleIds, ENWeaponType, ItemId, SpellId, WeaponIds} from "../../data/loader"

// ───────────── Vocabularies ─────────────

export const equipmentSlotMap = {
  // Core armor slots
  head: "голова",
  chest: "грудь",
  hands: "руки",
  legs: "ноги",
  feet: "ступни",
  cloak: "плащ",

  // Weapon slots - simplified
  mainHand: "основная рука", // Keep this for primary weapon
  offHand: "вторая рука",    // For shields, light weapons, etc.

  // Accessories (your "free" slots)
  ring1: "кольцо 1",
  ring2: "кольцо 2",
  amulet: "амулет",
  belt: "пояс",
  trinket: "амулет"
} as const

export const itemRarityMap = {
  common: "Обычный",
  uncommon: "Необычный",
  rare: "Редкий",
  veryRare: "Очень редкий",
  legendary: "Легендарный",
  artifact: "Артефакт"
} as const

export const itemTypeMap = {
  weapon: "Оружие",
  armor: "Доспех",
  potion: "Зелье",
  scroll: "Свиток",
  wand: "Жезл",
  ring: "Кольцо",
  rod: "Скипетр",
  staff: "Посох",
  wondrousItem: "Чудесный предмет",
  consumable: "Расходуемый",
  tool: "Инструмент",
  focus: "Заклинательная фокусировка",
  gear: "Снаряжение",
  treasure: "Сокровище",
  ammo: "Боеприпас",
  junk: "Мусор",
  //add more when needed

  other: "Другое"
} as const

export const armorPropertyMap = {
  'lightArmor': 'лёгкие доспехи',
  'mediumArmor': "средние доспехи",
  'heavyArmor': "тяжёлые доспехи",
  'stealthDisadvantage': "помеха на проверки скрытности"
  //add if needed
} as const

export const armorClassMap = {
  lightArmor: 'Лёгкий доспех',
  mediumArmor: 'Средний доспех',
  heavyArmor: 'Тяжёлый доспех',
  shield: 'Щит'
} as const

export const weaponPropertyMap = {
  light: "лёгкое",
  heavy: "тяжёлое",
  finesse: "фехтовальное",
  versatile: "универсальное",
  twoHanded: "двуручное",
  reach: "досягаемость",
  thrown: "метательное",
  ammunition: "боеприпасы",
  loading: "заряжание",
  special: "особое",
  ranged: 'дальнобойное',
  melee: 'рукопашное'
} as const

export const weaponMasteryMap = {
  cleave: 'Прорубающее',
  graze: 'Секущее',
  nick: 'Быстрое',
  push: 'Отталкивающее',
  sap: 'Ослабляющее',
  slow: 'Замедление',
  topple: 'Опрокидывающее',
  vex: 'Отвлекающее'
} as const

export type ENEquipmentSlot = keyof typeof equipmentSlotMap
export type RUEquipmentSlot = typeof equipmentSlotMap[ENEquipmentSlot]
export type ENItemType = keyof typeof itemTypeMap
export type RUItemType = typeof itemTypeMap[ENItemType]
export type ENItemRarity = keyof typeof itemRarityMap
export type RUItemRarity = typeof itemRarityMap[ENItemRarity]
export type ENArmorClass = keyof typeof armorClassMap
export type RUArmorClass = typeof armorClassMap[ENArmorClass]
export type ENArmorProperty = keyof typeof armorPropertyMap
export type RUArmorProperty = typeof armorPropertyMap[ENArmorProperty]
export type ENWeaponProperty = keyof typeof weaponPropertyMap
export type RUWeaponProperty = typeof weaponPropertyMap[ENWeaponProperty]
export type ENWeaponMastery = keyof typeof weaponMasteryMap
export type RUWeaponMastery = typeof weaponMasteryMap[ENWeaponMastery]

// ───────────── Items ─────────────

export interface BaseItem {
  id: string                                                                                                            //IMPORTANT: same as the object key
  name: string
  description: string
  type: ENItemType
  rarity: ENItemRarity
  attunement: boolean
  weight: number
  cost: number                                                                                                          //copper
  source: string
  resource?: Resource
  hooks?: Hooks
  equipment?: {
    allowedSlots?: ENEquipmentSlot[]
    defaultSlot?: ENEquipmentSlot
    properties?: Array<ENArmorProperty | ENWeaponProperty>
  }
}

export interface Armor extends BaseItem {
  type: 'armor'
  armorClass: ENArmorClass
  AC: Formula                                                                                                           //'14', '15 + min(2, {character.attributes.dexterity.modifier})'…
  requirements?: Partial<Record<ENAttribute, number>>
}

export interface Weapon extends BaseItem {
  type: 'weapon'
  mastery: ENWeaponMastery
  weaponType: ENWeaponType
  actions: Attack[]
}

export interface RangedWeapon extends Weapon {
  type: 'weapon'
  range: { normal: number, long: number }                                                                               //metadata, doesn't affect the roll
  ammo: AmmoType | 'self'
}

export interface Tool extends BaseItem {
  actions: ContextRoll[]
}

export interface Ammo extends BaseItem {
  type: 'ammo'
  ammo: {
    forWeaponType: ENWeaponType[]
    recoverable?: number                                                                                                //share picked up after a fight
    destroyedOnUse?: boolean
  }
}

//an action + formula only for a direct, untimed, unconditional effect; anything else stays in the description
export interface Consumable extends BaseItem {
  type: 'consumable'
  actions?: Action[]
}

//spellcasting focus: who may use it; no rolls of its own
export interface FocusItem extends BaseItem {
  type: 'focus'
  classes: ENClass[]
}

//same action rule as Consumable
export interface Gear extends BaseItem {
  type: 'gear'
  actions?: Action[]
}

//loot found, not bought: junk (a broken vase) sells at half price, treasure (gems, art objects) at full price; never on a shop shelf
export interface Junk extends BaseItem {
  type: 'junk' | 'treasure'
}

//mundane item kinds a «любой …» base requirement names
export type BaseKind = 'weapon' | 'meleeWeapon' | 'ammo' | 'lightArmor' | 'mediumArmor' | 'heavyArmor'

//charges and riders are display facts; a flat `bonus` lands in formulas only through the base item it is built on (rules/items)
export interface MagicItem extends Omit<BaseItem, 'cost' | 'weight'> {
  cost?: number                                                                                                         //recommended price, copper; absent = none printed (artifacts)
  weight?: number                                                                                                       //lbs; rarely printed
  variantOf?: string                                                                                                    //family key for tiered entries (weaponPlus, iounStone…)
  attunementBy?: string                                                                                                 //restriction as printed
  base?: string                                                                                                         //base-item requirement as printed
  baseItems?: Array<WeaponIds | ArmorIds | AmmoIds>                                                                     //when the requirement names concrete items
  baseKinds?: BaseKind[]                                                                                                //«любой …»: any mundane item of these kinds (the DM picks one per inventory entry)
  bonus?: { attack?: number; damage?: number; armorClass?: number }                                                     //printed flat +N
  spells?: Array<{ spell: SpellId; charges?: number }>                                                                  //spells the text names; `charges` only from spell tables
  actions?: Action[]                                                                                                    //fixed-DC / fixed-dice rolls only
}

export type Item = BaseItem | Ammo | Weapon | Armor | RangedWeapon | FocusItem | Consumable | Gear | Junk | Tool | MagicItem

//equipment pack: a virtual group, never an item — the builder expands it into its members
export interface Bundle {
  id: string                                                                                                            //IMPORTANT: same as the object key
  name: string
  description: string
  items: Array<{ id: string; qty: number }>                                                                             //member item ids
}

//one line of a starting kit (backgrounds, classes); `choose` = pick one, `sameAsTool` = the tool picked for proficiency, `bundle` = a pack
export type StartingItem =
  | { item: ItemId; quantity?: number; note?: string }
  | { choose: ItemId[]; quantity?: number; sameAsTool?: boolean }
  | { bundle: BundleIds }

//one option of «Выберите А или Б»
export interface StartingEquipment {
  items: StartingItem[]
  gold: number                                                                                                          //copper
}

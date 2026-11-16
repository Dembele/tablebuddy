//@ts-nocheck This page is a stub
//The stub book: one placeholder per registry, so a fresh clone compiles and runs with no rulebook installed. Used only when no other
//book is in packages/data (data/books.js). All text here is original filler; replace it with your own book (types/book/book.ts).

import {Ammo, Armor, Bundle, Consumable, FocusItem, Gear, Junk, MagicItem, Tool, Weapon} from "../../types/book/items"
import {Spell} from "../../types/book/spells"
import {Feature} from "../../types/book/features"
import {Class, Subclass} from "../../types/book/classes"
import {Background, Race} from "../../types/book/origins"
import {Monster} from "../../types/book/monsters"
import {Formula} from "../../types/internal/Formula"

const source = 'stub'
const item = {rarity: 'common', attunement: false, weight: 1, cost: 100, source} as const

const exampleArmor: Armor = {
  ...item, id: 'exampleArmor', name: 'Пример доспеха', description: 'Заглушка: лёгкий доспех.', type: 'armor', armorClass: 'lightArmor',
  AC: '11 + {character.attributes.dexterity.modifier}' as Formula,
  equipment: {allowedSlots: ['chest'], defaultSlot: 'chest', properties: ['lightArmor']}
}

const exampleWeapon: Weapon = {
  ...item, id: 'exampleWeapon', name: 'Пример оружия', description: 'Заглушка: простое рукопашное оружие.', type: 'weapon',
  weaponType: 'exampleWeapon', mastery: 'sap',
  actions: [{
    id: 'exampleWeapon_1', name: 'Удар',
    attack: '1d20 + {character.attributes.strength.modifier} + ({character.proficiencies.weaponProficiencies.exampleWeapon} * {character.proficiency})' as Formula,
    damage: '(1d6 + {character.attributes.strength.modifier})[bludgeoning]' as Formula
  }],
  equipment: {allowedSlots: ['mainHand', 'offHand'], defaultSlot: 'mainHand', properties: ['melee']}
}

const exampleTool: Tool = {...item, id: 'exampleTool', name: 'Пример инструмента', description: 'Заглушка: набор инструментов.', type: 'tool', actions: []}

const exampleAmmo: Ammo = {...item, id: 'exampleAmmo', name: 'Пример боеприпасов', description: 'Заглушка.', type: 'ammo', ammo: {forWeaponType: [], recoverable: 0.5}}

const exampleConsumable: Consumable = {
  ...item, id: 'exampleConsumable', name: 'Пример расходника', description: 'Заглушка: восстанавливает немного хитов.', type: 'consumable',
  actions: [{id: 'exampleConsumable_1', name: 'Выпить', pureRoll: '1d4 + 1' as Formula}]
}

const exampleFocus: FocusItem = {...item, id: 'exampleFocus', name: 'Пример фокусировки', description: 'Заглушка.', type: 'focus', classes: ['fighter']}

const exampleGear: Gear = {...item, id: 'exampleGear', name: 'Пример снаряжения', description: 'Заглушка.', type: 'gear'}

const exampleJunk: Junk = {...item, id: 'exampleJunk', name: 'Пример безделушки', description: 'Заглушка: продаётся, но в лавке не встречается.', type: 'junk'}

const exampleMagicItem: MagicItem = {
  id: 'exampleMagicItem', name: 'Пример магического предмета', description: 'Заглушка.', type: 'wondrousItem', rarity: 'uncommon', attunement: false, source
}

const examplePack: Bundle = {id: 'examplePack', name: 'Пример набора', description: 'Заглушка.', items: [{id: 'exampleGear', qty: 1}]}

const exampleSpell: Spell = {
  id: 'exampleSpell', name: 'Пример заговора', description: 'Заглушка: заговор с броском урона.', level: 0, school: 'evocation', classes: ['fighter'], source,
  castingTime: 'action', range: 60, components: {verbal: true}, duration: {units: 'instant'},
  actions: [{id: 'exampleSpell_1', name: 'Пример заговора', damage: '1d8[force]' as Formula}]
}

const feature = (id: string, type: Feature['type'], name: string): Feature => ({id, type, name, description: 'Заглушка.', source})
const exampleFeat = feature('exampleFeat', 'originFeat', 'Пример черты')
const exampleTrait = feature('exampleTrait', 'racial', 'Пример особенности вида')
const exampleClassFeature = feature('exampleClassFeature', 'class', 'Пример умения класса')
const exampleSubclassFeature = feature('exampleSubclassFeature', 'subclass', 'Пример умения подкласса')

const fighter: Class = {
  id: 'fighter', name: 'Пример класса', description: 'Заглушка: класс без заклинаний.', source,
  primaryAbility: {attributes: ['strength'], mode: 'any'}, hitDie: '10', savingThrows: ['strength', 'constitution'],
  grants: {
    skillProficiencies: {choose: {amount: 2, from: ['athletics', 'perception', 'survival']}},
    weaponProficiencies: {fixed: ['exampleWeapon']},
    armorProficiencies: {fixed: ['lightArmor']}
  },
  multiclassGrants: {weaponProficiencies: {fixed: ['exampleWeapon']}},
  equipment: [{items: [{item: 'exampleArmor'}, {item: 'exampleWeapon'}, {bundle: 'examplePack'}], gold: 1000}, {items: [], gold: 5000}],
  table: {},
  subclassLevels: [3],
  features: [{level: 1, feature: 'exampleClassFeature'}]
}

const exampleSubclass: Subclass = {
  id: 'exampleSubclass', name: 'Пример подкласса', class: 'fighter', description: 'Заглушка.', source,
  features: [{level: 3, feature: 'exampleSubclassFeature'}]
}

const exampleBackground: Background = {
  id: 'exampleBackground', name: 'Пример предыстории', description: 'Заглушка.', source,
  abilityScores: {options: ['strength', 'dexterity', 'constitution'], distribution: [[2, 1], [1, 1, 1]], cap: 20},
  feat: {level: 1, feature: 'exampleFeat'},
  grants: {skillProficiencies: {fixed: ['athletics', 'insight']}},
  equipment: [{items: [{item: 'exampleGear'}], gold: 1000}, {items: [], gold: 5000}]
}

const exampleSpecies: Race = {
  id: 'exampleSpecies', name: 'Пример вида', description: 'Заглушка.', source,
  type: 'humanoid', size: ['medium'], speed: {walk: 30}, features: [{level: 1, feature: 'exampleTrait'}]
}

const exampleCreature: Monster = {
  id: 'exampleCreature', name: 'Пример существа', source, size: ['small'], type: 'beast', alignment: 'без мировоззрения',
  armorClass: 12, initiative: 1, hitPoints: {average: 7, formula: '2d6' as Formula}, speed: {walk: 30},
  abilities: {strength: 10, dexterity: 12, constitution: 10, intelligence: 2, wisdom: 10, charisma: 4},
  senses: {passivePerception: 10}, languages: 'нет', challenge: {rating: '1/8', xp: 25, proficiency: 2},
  actions: [{
    id: 'exampleCreature_bite', name: 'Укус', description: 'Бросок рукопашной атаки: +3. Попадание: 3 (1d4 + 1) урона.',
    action: {id: 'exampleCreature_bite', name: 'Укус', attack: '1d20 + 3' as Formula, damage: '(1d4 + 1)[piercing]' as Formula}
  }]
}

export const book = {
  id: 'stub',
  name: 'Заглушка',
  items: {
    armor: {exampleArmor},
    weapons: {exampleWeapon},
    tools: {exampleTool},
    ammo: {exampleAmmo},
    consumables: {exampleConsumable},
    focus: {exampleFocus},
    gear: {exampleGear},
    junk: {exampleJunk},
    magic: {exampleMagicItem}
  },
  bundles: {examplePack},
  spells: {exampleSpell},
  features: {exampleFeat, exampleTrait, exampleClassFeature, exampleSubclassFeature},
  classes: {fighter},
  subclasses: {exampleSubclass},
  backgrounds: {exampleBackground},
  races: {exampleSpecies},
  monsters: {exampleCreature}
}

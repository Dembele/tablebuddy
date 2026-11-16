//Option lists the builder offers, named from the registries; character-state filters (`where`) applied by the caller.
import {Option} from "./questions"
import {skillMap} from "../types/Skill"
import {attributeMap, ENAttribute} from "../types/Attribute"
import {damageTypeMap} from "../types/Damage"
import {languageMap} from "../types/Character"
import {classMap} from "../types/Class"
import {spellSchoolMap} from "../types/Spell"
import {tools} from "../data/loader"
import {basicWeapon} from "../data/loader"
import {armorClassMap} from "../types/book/items"
import {features} from "../data/loader"
import {spells} from "../data/loader"
import {items} from "../data/loader"
import {conditionMap} from "../types/Condition"

type Named = Record<string, { name: string }>

const capital = (text: string) => text.replace(/^./, (letter) => letter.toUpperCase())

//names for `option` choices printed in the text (ancestries, terrains, variants)
export const optionNames: Record<string, string> = {
  arid: 'Засушливая местность', polar: 'Полярная местность', temperate: 'Умеренная местность', tropical: 'Тропическая местность',
  black: 'Чёрный дракон', blue: 'Синий дракон', brass: 'Латунный дракон', bronze: 'Бронзовый дракон', copper: 'Медный дракон',
  gold: 'Золотой дракон', green: 'Зелёный дракон', red: 'Красный дракон', silver: 'Серебряный дракон', white: 'Белый дракон',
  cloud: 'Облачный великан', fire: 'Огненный великан', frost: 'Ледяной великан', hill: 'Холмовой великан', stone: 'Каменный великан', storm: 'Штормовой великан',
  colossusSlayer: 'Убийца колоссов', hordeBreaker: 'Сокрушитель орд', escapeTheHorde: 'Уход от орды', multiattackDefense: 'Защита от мультиатаки',
  darkvision: 'Тёмное зрение', greaterComprehension: 'Высшее понимание', seeInvisibility: 'Видение невидимого',
  divineStrike: 'Божественный удар', potentSpellcasting: 'Могучее колдовство', primalStrike: 'Первобытный удар',
  magician: 'Чародей', warden: 'Страж', protector: 'Защитник', thaumaturge: 'Чудотворец',
  salmon: 'Лосось', panther: 'Пантера', owl: 'Сова'
}

export const nameOf = {
  skill: (id: string) => skillMap[id as keyof typeof skillMap] ?? id,
  attribute: (id: string) => capital(attributeMap[id as ENAttribute] ?? id),
  damageType: (id: string) => capital(damageTypeMap[id as keyof typeof damageTypeMap] ?? id),
  language: (id: string) => languageMap[id as keyof typeof languageMap] ?? id,
  spellList: (id: string) => classMap[id as keyof typeof classMap] ?? id,
  tool: (id: string) => (tools as Named)[id]?.name ?? id,
  weaponType: (id: string) => (basicWeapon as Named)[id]?.name ?? id,
  armor: (id: string) => armorClassMap[id as keyof typeof armorClassMap] ?? id,
  condition: (id: string) => capital(conditionMap[id as keyof typeof conditionMap] ?? id),
  option: (id: string) => optionNames[id] ?? id,
  item: (id: string) => (items as Named)[id]?.name ?? id,
  feature: (id: string) => (features as Named)[id]?.name ?? id,
  spell: (id: string) => (spells as Named)[id]?.name ?? id
}

export type Category = Exclude<keyof typeof nameOf, 'item' | 'feature' | 'spell'>

//every id of a category (used when a choice has no allow list)
export function allOf(category: Category): string[] {
  switch (category) {
    case 'skill': return Object.keys(skillMap)
    case 'attribute': return Object.keys(attributeMap)
    case 'damageType': return Object.keys(damageTypeMap)
    case 'language': return Object.keys(languageMap)
    case 'spellList': return Object.keys(classMap)
    case 'tool': return Object.keys(tools)
    case 'weaponType': return Object.keys(basicWeapon)
    case 'armor': return Object.keys(armorClassMap)
    case 'condition': return Object.keys(conditionMap)
    case 'option': return Object.keys(optionNames)
  }
}

export const optionsOf = (category: Category, ids: string[]): Option[] => ids.map((id) => ({id, name: nameOf[category](id)}))

//spell option: name, level/school hint, rules text
export function spellOption(id: string): Option {
  const spell = (spells as Record<string, { name: string; level: number; school: string; description?: string }>)[id]
  if (!spell) return {id, name: id}
  const school = spellSchoolMap[spell.school as keyof typeof spellSchoolMap] ?? spell.school
  return {id, name: spell.name, hint: `${spell.level === 0 ? 'заговор' : `${spell.level} ур.`} · ${school}`, description: spell.description}
}

//printed name of a stored choice answer, using the category of the ChoiceSpec it answered (ids repeat across categories)
export function choiceAnswerName(featureId: string, choiceId: string, id: string): string {
  const spec = (features as Record<string, { choices?: Array<{ id: string; options: { from: string } }> }>)[featureId]?.choices?.find((choice) => choice.id === choiceId)
  const from = spec?.options.from
  if (from === 'skillOrTool') return id in skillMap ? nameOf.skill(id) : nameOf.tool(id)
  if (from && from in nameOf) return nameOf[from as keyof typeof nameOf](id)
  return nameOf.attribute(id) !== id ? nameOf.attribute(id) : id //asi answers and unknown specs
}

//spells matching a filter, sorted by level then name
export function spellIds(filter: { level?: number; maxLevel?: number; classes?: string[]; schools?: string[]; ritual?: boolean }): string[] {
  return Object.values(spells as Record<string, { id: string; name: string; level: number; school: string; classes: string[]; ritual?: boolean }>)
    .filter((spell) => filter.level === undefined || spell.level === filter.level)
    .filter((spell) => filter.maxLevel === undefined || (spell.level >= 1 && spell.level <= filter.maxLevel))
    .filter((spell) => !filter.classes || filter.classes.some((id) => spell.classes.includes(id)))
    .filter((spell) => !filter.schools || filter.schools.includes(spell.school))
    .filter((spell) => !filter.ritual || spell.ritual)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    .map((spell) => spell.id)
}

//standard languages a new character picks from (2024: Common + two)
export const standardLanguages = ['commonSignLanguage', 'draconic', 'dwarvish', 'elvish', 'giant', 'gnomish', 'goblin', 'halfling', 'orc']

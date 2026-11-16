//Compendium display helpers over the static rulebook (server only): search, meta lines, prices, prerequisites, grants, kits.
import 'server-only'
import {spells} from "@frontend/deps/data/loader"
import {castingTimeMap, spellAreaMap, Spell} from "@frontend/deps/types/book/spells"
import {items} from "@frontend/deps/data/loader"
import {Item, itemRarityMap, itemTypeMap, StartingEquipment} from "@frontend/deps/types/book/items"
import {Feature, featureTypeMap, Prerequisite} from "@frontend/deps/types/book/features"
import {features} from "@frontend/deps/data/loader"
import {Class} from "@frontend/deps/types/book/classes"
import {classes} from "@frontend/deps/data/loader"
import {Subclass} from "@frontend/deps/types/book/classes"
import {subclasses} from "@frontend/deps/data/loader"
import {Race} from "@frontend/deps/types/book/origins"
import {races} from "@frontend/deps/data/loader"
import {Background} from "@frontend/deps/types/book/origins"
import {backgrounds} from "@frontend/deps/data/loader"
import {Monster} from "@frontend/deps/types/book/monsters"
import {monsters} from "@frontend/deps/data/loader"
import {bundles} from "@frontend/deps/data/loader"
import {nameOf} from "@frontend/deps/builder/options"
import {spellSchoolMap} from "@frontend/deps/types/Spell"
import {classMap} from "@frontend/deps/types/Class"
import {damageTypeMap} from "@frontend/deps/types/Damage"
import {attributeMap} from "@frontend/deps/types/Attribute"
import {Proficiencies} from "@frontend/deps/types/internal/Proficiencies"

export const allSpells = Object.values(spells) as Spell[]
export const allItems = Object.values(items) as Item[]
export const allFeatures = Object.values(features) as Feature[]
export const allClasses = Object.values(classes) as Class[]
export const allSubclasses = Object.values(subclasses) as Subclass[]
export const allSpecies = Object.values(races) as Race[]
export const allBackgrounds = Object.values(backgrounds) as Background[]
export const allMonsters = Object.values(monsters) as Monster[]

export const spellById = (id: string) => (spells as Record<string, Spell | undefined>)[id]
export const itemById = (id: string) => (items as Record<string, Item | undefined>)[id]
export const featureById = (id: string) => (features as Record<string, Feature | undefined>)[id]
export const classById = (id: string) => (classes as Record<string, Class | undefined>)[id]
export const subclassById = (id: string) => (subclasses as Record<string, Subclass | undefined>)[id]
export const speciesById = (id: string) => (races as Record<string, Race | undefined>)[id]
export const backgroundById = (id: string) => (backgrounds as Record<string, Background | undefined>)[id]
export const monsterById = (id: string) => (monsters as Record<string, Monster | undefined>)[id]

//challenge rating as a number for sorting / filtering: "1/8" → 0.125
export const challengeValue = (rating: string) => rating.includes('/') ? Number(rating.split('/')[0]) / Number(rating.split('/')[1]) : Number(rating)

//case-insensitive name search; an empty query matches everything
export const matches = (name: string, query?: string) => !query || name.toLowerCase().includes(query.trim().toLowerCase())

//first value of a search param
export const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined

const capital = (text: string) => text.replace(/^./, (letter) => letter.toUpperCase())
export const levelLabel = (level: number) => level === 0 ? 'Заговор' : `${level} уровень`
export const schoolName = (school: string) => spellSchoolMap[school as keyof typeof spellSchoolMap] ?? school
export const classNameOf = (id: string) => classMap[id as keyof typeof classMap] ?? id
export const itemTypeName = (type: string) => itemTypeMap[type as keyof typeof itemTypeMap] ?? type
export const rarityName = (rarity: string) => itemRarityMap[rarity as keyof typeof itemRarityMap] ?? rarity
export const featureTypeName = (type: string) => featureTypeMap[type as keyof typeof featureTypeMap] ?? type

//copper → the largest whole coin
export function money(copper?: number): string {
  if (!copper) return '—'
  if (copper % 100 === 0) return `${copper / 100} ЗМ`
  if (copper % 10 === 0) return `${copper / 10} СМ`
  return `${copper} ММ`
}

//a stored roll as printed: its dice, «+ мод.» when it adds a modifier or bonus, damage types named
export function rollText(formula: string): string {
  const dice = (formula.match(/\d*d\d+/g) ?? []).map((die) => die.replace('d', 'к'))
  const types = [...new Set([...formula.matchAll(/\[(\w+)\]/g)].map((match) => damageTypeMap[match[1] as keyof typeof damageTypeMap] ?? match[1]))]
  const bonus = /\{|\+\s*\d/.test(formula) ? ' + мод.' : ''
  return `${dice.join(' + ') || '—'}${bonus}${types.length ? ` (${types.join(', ')})` : ''}`
}

function rangeText(range: Spell['range']): string {
  if (typeof range === 'number') return range >= 5280 && range % 5280 === 0 ? `${range / 5280} миль` : `${range} фт.`
  return {self: 'На себя', touch: 'Касание', sight: 'В пределах видимости', unlimited: 'Без ограничений', special: 'Особая'}[range]
}

function durationText(duration: Spell['duration']): string {
  const units = {instant: 'Мгновенная', rounds: 'раунд(ов)', minutes: 'мин.', hours: 'ч.', days: 'дн.', untilDispelled: 'Пока не рассеется', special: 'Особая'}[duration.units]
  const amount = duration.value ? `${duration.upTo ? 'до ' : ''}${duration.value} ${units}` : units
  return `${duration.concentration ? 'Концентрация, ' : ''}${amount}`
}

//the spell's header block: casting, range, area, components, duration, lists
export function spellMeta(spell: Spell): Array<[string, string]> {
  const {components} = spell
  const parts = [components.verbal && 'В', components.somatic && 'С', components.material && `М (${components.material})`].filter(Boolean)
  return [
    ['Время накладывания', `${castingTimeMap[spell.castingTime]}${spell.ritual ? ' или ритуал' : ''}${spell.castingNote ? ` — ${spell.castingNote}` : ''}`],
    ['Дистанция', rangeText(spell.range)],
    ...(spell.area ? [['Область', `${spellAreaMap[spell.area.shape]} ${spell.area.size} фт.`] as [string, string]] : []),
    ['Компоненты', parts.join(', ') || '—'],
    ['Длительность', durationText(spell.duration)],
    ['Классы', spell.classes.map(classNameOf).join(', ')]
  ]
}

//«Сила или Ловкость 13+», «уровень Колдуна 5+»…
export function prerequisiteText(prerequisite: Prerequisite): string {
  switch (prerequisite.type) {
    case 'level': return `${prerequisite.min}+ уровень`
    case 'classLevel': return `${classNameOf(prerequisite.class)} ${prerequisite.min}+ уровня`
    case 'attribute': return `${prerequisite.any.map((attribute) => capital(attributeMap[attribute])).join(' или ')} ${prerequisite.min}+`
    case 'armorProficiency': return `Владение: ${nameOf.armor(prerequisite.armor)}`
    case 'flag': return prerequisite.flag === 'spellcasting' ? 'Умение накладывать заклинания' : prerequisite.flag === 'pactMagic' ? 'Магия договора' : prerequisite.flag
    case 'feature': return nameOf.feature(prerequisite.featureId)
    case 'anyOf': return prerequisite.of.map(prerequisiteText).join(' или ')
  }
}

//fixed picks plus «N на выбор из …»
export function proficienciesText<T extends string>(proficiencies: Proficiencies<T> | undefined, name: (id: string) => string): string | null {
  if (!proficiencies) return null
  const fixed = (proficiencies.fixed ?? []).map(name)
  const choose = proficiencies.choose ? [`${proficiencies.choose.amount} на выбор: ${proficiencies.choose.from.map(name).join(', ')}`] : []
  return [...fixed, ...choose].join('; ') || null
}

//one starting kit option as a line
export const equipmentText = (option: StartingEquipment) => [
  ...option.items.map((item) => 'bundle' in item ? (bundles[item.bundle]?.name ?? item.bundle)
    : 'choose' in item ? `одно на выбор: ${item.choose.map(nameOf.item).join(', ')}` : `${nameOf.item(item.item)}${item.quantity ? ` ×${item.quantity}` : ''}`),
  option.gold ? money(option.gold) : ''
].filter(Boolean).join(', ')

//proficiency bonus by character level
export const proficiencyAt = (level: number) => Math.ceil(level / 4) + 1

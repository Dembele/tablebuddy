//Monster → character: stamps a printed stat block (data/monsters) onto a stat-block character as constant formulas.
//No builder questions, no levels: the numbers are the book's; the DM edits them directly afterwards (Doctrine). Pure.

import {Formula} from "../types/internal/Formula"
import {attributeMap, ENAttribute} from "../types/Attribute"
import {ENSkill, skillAttributeMap, skillMap} from "../types/Skill"
import {HitDice, hitDiceArray} from "../types/Character"
import {typedFromEntries, typedKeys} from "../_util/translationMap"
import {CharacterAction, ICharacter, InventoryEntry} from "../interfaces/DB/Character"
import {Monster, MonsterEntry} from "../types/book/monsters"
import {MonsterId} from "../data/loader"

const constant = (value: number) => String(value) as Formula
const modifierOf = (score: number) => Math.floor((score - 10) / 2)

//the parts of a character a stat block decides; everything else keeps the model defaults
export type MonsterStamp = Pick<ICharacter, 'name' | 'isNPC' | 'isTemplate' | 'monster' | 'size' | 'proficiency' | 'attributes' | 'savingThrows'
  | 'skills' | 'initiative' | 'passivePerception' | 'armorClass' | 'hitPoints' | 'hitDice' | 'speed' | 'senses' | 'resistances' | 'immunities'
  | 'conditionImmunities' | 'actions' | 'inventory' | 'notes'>

//a printed total split into stamped value + proficiency flags: +6 with PB 2 over a +2 modifier = expertise
function bonusOf(printed: number, modifier: number, proficiency: number) {
  if (printed - modifier === proficiency * 2) return {value: constant(modifier), proficiency: true, expertise: true}
  if (printed - modifier === proficiency) return {value: constant(modifier), proficiency: true, expertise: false}
  return {value: constant(printed), proficiency: false, expertise: false}
}

export function stampMonster(monster: Monster): MonsterStamp {
  const id = monster.id as MonsterId
  const pb = monster.challenge.proficiency
  const modifiers = typedFromEntries(typedKeys(attributeMap).map((attribute) => [attribute, modifierOf(monster.abilities[attribute])]))

  const savingThrows = typedFromEntries(typedKeys(attributeMap).map((attribute: ENAttribute) => {
    const {value, proficiency} = bonusOf(monster.saves?.[attribute] ?? modifiers[attribute], modifiers[attribute], pb)
    return [attribute, {value, proficiency}]
  }))
  const skills = typedFromEntries(typedKeys(skillMap).map((skill: ENSkill) => {
    const modifier = modifiers[skillAttributeMap[skill]]
    return [skill, bonusOf(monster.skills?.[skill] ?? modifier, modifier, pb)]
  }))

  const dieMatch = String(monster.hitPoints.formula).match(/^(\d+)d(\d+)/)
  const die = dieMatch && hitDiceArray.includes(dieMatch[2] as HitDice) ? dieMatch[2] as HitDice : null
  const dice = typedFromEntries(hitDiceArray.map((hitDie) => [hitDie, hitDie === die ? Number(dieMatch![1]) : 0]))

  const entries: MonsterEntry[] = [...monster.traits ?? [], ...monster.actions ?? [], ...monster.bonusActions ?? [], ...monster.reactions ?? [], ...monster.legendaryActions ?? []]
  const actions: CharacterAction[] = entries.flatMap((entry) => entry.action ? [{...entry.action, from: {type: 'monster', id}}] : [])

  const inventory: InventoryEntry[] = (monster.gear ?? []).flatMap((gear, index) =>
    'item' in gear ? [{id: `${gear.item}-${index}`, item: gear.item, quantity: gear.quantity ?? 1}] : [])

  return {
    name: monster.name,
    isNPC: true,
    isTemplate: true,                                                                                                   //a monster is placed as numbered copies by default; the DM may untick it
    monster: id,
    size: monster.size[0],
    proficiency: constant(pb),
    attributes: typedFromEntries(typedKeys(attributeMap).map((attribute) =>
      [attribute, {value: monster.abilities[attribute], modifier: `floor(({character.attributes.${attribute}.value} - 10) / 2)` as Formula}])),
    savingThrows,
    skills,
    initiative: {value: constant(monster.initiative), proficiency: false},
    passivePerception: constant(monster.senses.passivePerception ?? 10 + modifiers.wisdom),
    armorClass: constant(monster.armorClass),
    hitPoints: {current: monster.hitPoints.average, max: constant(monster.hitPoints.average)},
    hitDice: {current: {...dice}, max: dice},
    speed: {walk: monster.speed.walk ?? 0, ...(monster.speed.swim ? {swim: monster.speed.swim} : {}), ...(monster.speed.fly ? {fly: monster.speed.fly} : {}),
      ...(monster.speed.climb ? {climb: monster.speed.climb} : {})},
    senses: {
      ...(monster.senses.darkvision ? {darkvision: monster.senses.darkvision} : {}), ...(monster.senses.blindsight ? {blindsight: monster.senses.blindsight} : {}),
      ...(monster.senses.tremorsense ? {tremorsense: monster.senses.tremorsense} : {}), ...(monster.senses.truesight ? {truesight: monster.senses.truesight} : {})
    },
    resistances: monster.resistances ?? [],
    immunities: monster.immunities?.damage ?? [],
    conditionImmunities: monster.immunities?.conditions ?? [],
    actions,
    inventory,
    notes: ''
  }
}

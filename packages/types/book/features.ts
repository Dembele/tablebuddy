//What a feature is (feats, fighting styles, species traits, class and subclass features, invocations, epic boons): prerequisites,
//choices, one-time grants, actions, resources. Read by the builder at pick time; nothing here is an effect engine (Doctrine).

import {Proficiencies} from "../internal/Proficiencies"
import {ENSkill} from "../Skill"
import {ENLanguage} from "../Character"
import {ENAttribute} from "../Attribute"
import {ENDamageType} from "../Damage"
import {ENCondition} from "../Condition"
import {Formula} from "../internal/Formula"
import {ENSpellSchool, SpellLevel} from "../Spell"
import {ENClass} from "../Class"
import {Action} from "../../interfaces/pure/Action"
import {Resource} from "../../interfaces/pure/Resource"
import {ENArmorClass} from "./items"
import type {ENTool, ENWeaponType, FeatureId, SpellId} from "../../data/loader"

export const featureTypeMap = {
  class: 'Умение класса',
  subclass: 'Умение подкласса',
  racial: 'Особенность вида',                                                                                          //species trait; repo keeps the legacy "race" name
  generalFeat: 'Универсальная черта',
  originFeat: 'Черта происхождения',
  fightingStyle: 'Боевой стиль',
  epicBoon: 'Эпический дар',
  invocation: 'Таинственное воззвание',
} as const

export type ENFeatureType = keyof typeof featureTypeMap
export type RUFeatureType = typeof featureTypeMap[keyof typeof featureTypeMap]

export type ENSpellId = SpellId

// ───────────── Prerequisites — build-time gate, evaluated once at pick time against live character state ─────────────

export type Prerequisite =
  | { type: 'level'; min: number }                                                                                     //character level
  | { type: 'classLevel'; class: ENClass; min: number }                                                                //«уровень Колдуна 5 или выше»
  | { type: 'attribute'; any: ENAttribute[]; min: number }                                                             //«Сила или Ловкость 13+»
  | { type: 'armorProficiency'; armor: ENArmorClass }                                                                  //shield is an ENArmorClass
  | { type: 'flag'; flag: string }                                                                                     //'spellcasting' | 'pactMagic'
  | { type: 'feature'; featureId: FeatureId }                                                                          //previously picked feat
  | { type: 'anyOf'; of: Prerequisite[] }                                                                              //OR group; a bare list is implicit AND

// ───────────── Choices — what the user picks; answers stored per instance, keyed by choice id ─────────────

export interface ChoiceSpec {
  id: string                                                                                                            //local to the feature: 'skill' | 'spell' | 'damage'…
  count: number
  options:
    | { from: 'skill'; allow?: ENSkill[] }
    | { from: 'attribute'; allow?: ENAttribute[] }
    | { from: 'tool'; allow?: ENTool[] }
    | { from: 'weaponType'; allow?: ENWeaponType[] }
    | { from: 'damageType'; allow?: ENDamageType[] }
    | { from: 'skillOrTool' }                                                                                          //any mix (Skilled)
    | { from: 'feature'; allow: FeatureId[] }                                                                          //pick features (invocations, an origin feat)
    | { from: 'spellList'; allow: ENClass[] }                                                                          //pick a class spell list (Magic Initiate)
    | { from: 'option'; allow: string[] }                                                                              //named variant printed in the text (giant / dragon ancestry)
    | { from: 'spell'; level?: SpellLevel; classes?: ENClass[] | { fromChoice: string }; schools?: ENSpellSchool[]; ritual?: boolean } //class filter, fixed or from another answer
  where?: 'proficient' | 'notProficient'                                                                                //filter against current character state
  distinct?: boolean                                                                                                    //repeatable feats: each take must pick a new value
}

// ───────────── One-time sheet stamp — applied once at commit, monotonic writes onto flat character fields ────────────

export interface Grants {
  expertise?: Proficiencies<ENSkill>
  skillProficiencies?: Proficiencies<ENSkill>
  toolProficiencies?: Proficiencies<ENTool>
  weaponProficiencies?: Proficiencies<ENWeaponType>
  armorProficiencies?: Proficiencies<ENArmorClass>
  languageProficiencies?: Proficiencies<ENLanguage>
  savingThrowProficiencies?: Proficiencies<ENAttribute>
  resistances?: Proficiencies<ENDamageType>
  immunities?: Proficiencies<ENDamageType>
  conditionImmunities?: Proficiencies<ENCondition>

  armorClass?: Formula                                                                                                  //alternative base AC formula the builder offers (Unarmored Defense)
  initiative?: boolean                                                                                                  //initiative.proficiency (Alert)
  senses?: Partial<Record<'darkvision' | 'blindsight' | 'tremorsense' | 'truesight', number>>
  speedBonus?: { walk?: number; swim?: number; fly?: number; climb?: number }
  hitPointMaxBonus?: number                                                                                             //flat, once
  hitPointMaxPerLevel?: number                                                                                          //formula-level, editor-owned

  spellcasting?: LimitedSpellcasting                                                                                    //minor / limited casting added by the feature
  flag?: string                                                                                                         //unmodeled passive marker -> character.flags
}

//minor spellcasting granted by a feature
export interface LimitedSpellcasting {
  ability: ENAttribute[]                                                                                                //pool; the raised attribute is set at commit (instance.asi)
  cantrips?: SpellPick                                                                                                  //always prepared, no slots needed
  spells?: SpellPick                                                                                                    //always prepared; free cast until reset
  freeCastResetOn?: 'shortRest' | 'longRest'                                                                            //label only — nothing auto-resets (Doctrine)
  leveled?: Array<{ level: number; spell: ENSpellId }>                                                                  //always prepared from that level; free cast only when freeCastResetOn is set
  leveledByChoice?: { choice: string; options: Record<string, Array<{ level: number; spell: ENSpellId }>> }           //like leveled, list picked by a ChoiceSpec answer
}

//fixed spells land unconditionally; chosen ones are merged from the instance at commit
export interface SpellPick {
  fixed?: ENSpellId[]
  chosenAmount?: number
}

//level-keyed formula swaps; `{ability}` in a formula = the attribute this feature raised / chose, bound once at stamp
export type FeatureAction = Action & { tiers?: Partial<Record<number, Formula>> }

//ability score increase: distribution [[2],[1,1]] = one +2 or two +1
export interface AbilityIncrease {
  options: ENAttribute[] | 'any'
  distribution: number[][]
  cap: number                                                                                                           //20 for feats; epic boons raise it to 30
}

export interface Feature {
  id: string                                                                                                            //IMPORTANT: same as the object key
  type: ENFeatureType
  name: string
  description?: string                                                                                                  //rules text; passive effects live here only
  source?: string

  prerequisites?: Prerequisite[]                                                                                        //implicit AND; gates the pick in the builder
  repeatable?: boolean
  abilityIncrease?: AbilityIncrease
  choices?: ChoiceSpec[]                                                                                                //answered at pick time, stored on the instance
  grants?: Grants                                                                                                       //stamped onto flat character fields at commit
  actions?: FeatureAction[]                                                                                             //active, human-triggered rolls only
  resources?: Resource[]                                                                                                //limited uses
}

//what a character stores per taken feature: id + answered choices; everything else is derived
export interface FeatureInstance {
  featureId: FeatureId
  asi?: ENAttribute[]                                                                                                   //answer of abilityIncrease
  choices?: Record<string, string | string[]>                                                                           //by ChoiceSpec.id
}

//grant of a feature at a level (class / subclass / species / background)
export type FeatureGrant = {
  level: number
  feature: FeatureId
  choices?: Array<FeatureId>                                                                                            //OR pick from these instead (ASI slot -> general feats)
  presetChoices?: Record<string, string | string[]>                                                                     //answers fixed by the granter
}

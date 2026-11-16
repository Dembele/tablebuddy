//What a class and a subclass are: fixed facts, class table columns, pools, casting, level grants. Features are referenced by id.

import {ENAttribute} from "../Attribute"
import {HitDice} from "../Character"
import {ENReset} from "../Reset"
import {ENClass, ENSpellProgression} from "../Class"
import {FeatureGrant, Grants} from "./features"
import {StartingEquipment} from "./items"
import type {SpellId} from "../../data/loader"

type ClassGrants = Pick<Grants, 'skillProficiencies' | 'toolProficiencies' | 'weaponProficiencies' | 'armorProficiencies'>

//one column of the class table («Ярость», «Урон ярости»…): values[level - 1]
export interface ClassColumn {
  name: string
  values: number[]
}

//limited-use pool whose size is a table column; the builder copies the value at level-up
export interface ClassResource {
  name: string
  column: string
  resetsOn: ENReset
  note?: string                                                                                                         //partial recovery as printed
}

//full class casting; slots come from rules/spellSlots slotsTable(progression), counts from table columns
export interface ClassSpellcasting {
  ability: ENAttribute
  list: ENClass                                                                                                         //whose spell list
  progression: ENSpellProgression
  cantripsColumn?: string
  preparedColumn: string
  swapOn: 'levelUp' | 'longRest'                                                                                        //when one prepared spell may be replaced
  focus?: string                                                                                                        //as printed
  spellbook?: { start: number; perLevel: number }                                                                       //prepared spells come from a book
  recommended?: { cantrips?: SpellId[]; spells?: SpellId[] }
}

export interface Class {
  id: string                                                                                                            //IMPORTANT: same as the object key
  name: string
  description: string
  source: string

  primaryAbility: { attributes: ENAttribute[]; mode: 'all' | 'any' }                                                    //multiclass gate: 13+ in it
  hitDie: HitDice
  savingThrows: ENAttribute[]
  grants: ClassGrants                                                                                                   //as a level-1 character
  multiclassGrants: ClassGrants                                                                                         //as a multiclass pick
  equipment: StartingEquipment[]                                                                                        //[A, B]
  table: Record<string, ClassColumn>
  resources?: ClassResource[]
  spellcasting?: ClassSpellcasting
  subclassLevels: number[]                                                                                              //levels where the chosen subclass grants its features
  features: FeatureGrant[]
}

export interface Subclass {
  id: string                                                                                                            //IMPORTANT: same as the object key
  name: string
  class: ENClass
  description: string
  source: string
  table?: Record<string, ClassColumn>                                                                                   //subclass-only columns, values[class level - 1]
  resources?: ClassResource[]
  spellcasting?: ClassSpellcasting                                                                                      //subclass casters; columns refer to this table
  features: FeatureGrant[]                                                                                              //levels match the parent's subclassLevels
}

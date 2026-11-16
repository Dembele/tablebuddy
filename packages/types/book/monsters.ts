//What a monster is: a stat block as printed. Numbers are the printed results, not formulas over a character; actions carry the
//printed rolls for the request / verdict queue. Everything else (riders, recharge, legendary uses, lair) is display text (Doctrine).

import {Action} from "../../interfaces/pure/Action"
import {ENAttribute} from "../Attribute"
import {ENCondition} from "../Condition"
import {ENDamageType} from "../Damage"
import {Formula} from "../internal/Formula"
import {ENCreatureType, ENSize} from "../Race"
import {ENSkill} from "../Skill"
import type {ItemId, SpellId} from "../../data/loader"

//one trait / action / bonus action / reaction / legendary action, as printed
export interface MonsterEntry {
  id: string                                                                                                            //<monsterId>_<entry>
  name: string
  usage?: string                                                                                                        //«1/день», «Перезарядка 5–6» as printed
  note?: string                                                                                                         //«только в форме волка»
  trigger?: string                                                                                                      //reactions: «Условие» as printed
  description: string                                                                                                   //full text as printed
  action?: Action                                                                                                       //attack or save effect; absent = text only
  spells?: SpellId[]                                                                                                    //spells the entry names
}

//lore after the stat block: headers, paragraphs, roll tables, lists, sidebars
export type MonsterLore =
  | { type: 'header'; level: number; text: string }
  | { type: 'paragraph'; text: string; italic?: boolean }
  | { type: 'table'; rows: string[][] }
  | { type: 'list'; items: string[] }
  | { type: 'sidebar'; title: string | null; text: string }
  | { type: 'quote'; text: string }
  | { type: 'rule' }

export interface Monster {
  id: string                                                                                                            //IMPORTANT: same as the object key
  name: string
  source: string

  size: ENSize[]                                                                                                        //several = «Средний или Маленький»
  type: ENCreatureType
  altType?: ENCreatureType
  tags?: string[]                                                                                                       //«(Гоблиноид)» as printed
  swarmOf?: ENSize | string
  alignment: string

  armorClass: number
  armorNote?: string
  initiative: number                                                                                                    //bonus
  hitPoints: { average: number; formula: Formula }
  speed: { walk?: number; fly?: number; climb?: number; swim?: number; burrow?: number; hover?: boolean; note?: string } //feet
  abilities: Record<ENAttribute, number>                                                                                //scores
  saves?: Partial<Record<ENAttribute, number>>                                                                          //only those that differ from the modifier
  skills?: Partial<Record<ENSkill, number>>
  vulnerabilities?: ENDamageType[]
  resistances?: ENDamageType[]
  immunities?: { damage: ENDamageType[]; conditions: ENCondition[] }
  damageNote?: string
  senses: { darkvision?: number; blindsight?: number; truesight?: number; tremorsense?: number; passivePerception?: number; note?: string }
  languages: string
  challenge: { rating: string; xp: number; xpInLair?: number; proficiency: number }
  habitat?: string[]
  treasure?: string[]
  gear?: Array<{ item: ItemId; quantity?: number } | { name: string; quantity?: number }>

  traits?: MonsterEntry[]
  actions?: MonsterEntry[]
  bonusActions?: MonsterEntry[]
  reactions?: MonsterEntry[]
  legendaryIntro?: string
  legendaryActions?: MonsterEntry[]
  lore?: MonsterLore[]
}

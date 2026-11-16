//Live character: the persisted bag where rulebook picks become state. Rulebook entries are referenced by registry id
//(data/*), never copied; formulas are human-owned text the engine evaluates via {character.…} paths — keep those paths stable.
//Grants are stamped once at commit with their origin (`from`) so the builder / level-up helper knows what came from where.

import {Formula} from "../../types/internal/Formula"
import {ObjectId} from "../../types/internal/ObjectId"
import {UserSafe} from "./User"
import {ICampaign} from "./Campaign"
import {ENAttribute} from "../../types/Attribute"
import {ENSkill} from "../../types/Skill"
import {ENLanguage, HitDice} from "../../types/Character"
import {ENDamageType} from "../../types/Damage"
import {ENCondition} from "../../types/Condition"
import {ENSize} from "../../types/Race"
import {SpellLevel} from "../../types/Spell"
import {Action} from "../pure/Action"
import {Resource} from "../pure/Resource"
import {ClassId} from "../../data/loader"
import {SubclassId} from "../../data/loader"
import {RaceId} from "../../data/loader"
import {BackgroundId} from "../../data/loader"
import {FeatureId} from "../../data/loader"
import {FeatureInstance} from "../../types/book/features"
import {SpellId} from "../../data/loader"
import {ItemId} from "../../data/loader"
import {ENEquipmentSlot} from "../../types/book/items"
import {ENTool} from "../../data/loader"
import {ENWeaponType} from "../../data/loader"
import {ENArmorClass} from "../../types/book/items"
import {MonsterId} from "../../data/loader"

// ───────────── Origin of anything stamped onto the sheet ─────────────

//where a feature / spell / action / resource came from; `custom` = added by hand (DM gift, homebrew, correction)
export type GrantSource =
  | { type: 'class'; id: ClassId; level: number }
  | { type: 'subclass'; id: SubclassId; level: number }
  | { type: 'race'; id: RaceId; level?: number }
  | { type: 'background'; id: BackgroundId }
  | { type: 'feature'; id: FeatureId }                                                                                  //picked through another feature (invocation from Eldritch Invocations, feat from ASI)
  | { type: 'item'; id: ItemId }
  | { type: 'monster'; id: MonsterId }                                                                                  //stamped from a Monster Manual stat block
  | { type: 'custom'; note?: string }

export type SlotLevel = Exclude<SpellLevel, 0>

//a taken feature: id + answered choices (data/features), plus where it came from
export type CharacterFeature = FeatureInstance & { from: GrantSource }

//a stamped roll: copied from a spell / feature / item action with `{ability}` already bound; tiers & slots kept for display/pick
export type CharacterAction = Action & {
  from: GrantSource
  spell?: SpellId                                                                                                       //stamped from a spell: tiers follow character level whoever granted it
  tiers?: Partial<Record<number, Formula>>                                                                              //character level (spells, species) or class level (class/subclass features)
  slots?: Partial<Record<SlotLevel, Formula>>                                                                           //upcast formula per slot level
}

//limited-use pool; current is human-committed, nothing resets it automatically
export type CharacterResource = Resource & { current: number; from: GrantSource }

export interface CharacterSpell {
  spell: SpellId
  ability: ENAttribute                                                                                                  //bound at stamp: class casting ability or the attribute a feat raised
  from: GrantSource
  prepared: boolean
  alwaysPrepared?: boolean                                                                                              //domain/patron/species spells: never swapped out
  freeCast?: { resetsOn: 'shortRest' | 'longRest'; available: boolean }                                                 //feature-granted cast without a slot; `available` is human-toggled
}

export interface InventoryEntry {
  id: string                                                                                                            //entry identity: two daggers may be equipped differently
  item: ItemId
  base?: ItemId                                                                                                         //the mundane weapon / armor / ammo a magic item is built on («Оружие +1» → longsword), picked by the DM
  quantity: number
  equipped?: ENEquipmentSlot
  attuned?: boolean
  charges?: number                                                                                                      //magic item charges, human-committed
  spent?: number                                                                                                        //ammo fired since the last pick-up (rules/costs recover)
  note?: string                                                                                                         //engraving, origin, DM remark
}

// ───────────── The character ─────────────

interface Character {
  _id: ObjectId
  name: string
  isNPC: boolean
  isTemplate: boolean
  avatar?: string
  image?: string
  notes?: string
  monster?: MonsterId                                                                                                   //stat-block character: the printed block lives in data/monsters, numbers are stamped constants

  // origin (registry ids); absent on a blank character until the builder or editor sets them
  race?: RaceId
  size?: ENSize                                                                                                         //picked from race.size
  background?: BackgroundId
  classes: Array<{                                                                                                      //[0] = starting class (full proficiencies, max HP die at level 1)
    class: ClassId
    subclass?: SubclassId
    level: number
  }>
  xp: number
  features: CharacterFeature[]
  levelUpAllowed?: boolean                                                                                              //set by the DM; a player may level up only while it is true (cleared by the level-up)
  rolledScores?: Array<{ total: number; dice: number[] }>                                                              //4d6 drop lowest, rolled once by the backend at creation; only the DM clears it

  // core sheet: formulas evaluated by the engine, paths referenced by data formulas
  proficiency: Formula                                                                                                  //{character.proficiency}
  attributes: Record<ENAttribute, { value: number; modifier: Formula }>                                                 //{character.attributes.X.modifier}
  savingThrows: Record<ENAttribute, { value: Formula; proficiency: boolean }>
  skills: Record<ENSkill, { value: Formula; proficiency: boolean; expertise: boolean }>
  initiative: { value: Formula; proficiency: boolean }
  passivePerception: Formula
  armorClass: Formula                                                                                                   //the sheet's own; features only offer alternatives (Grants.armorClass)
  critThresholdMod: number
  maxAttunements: Formula

  hitPoints: { current: number; max: Formula; temp?: number }
  hitDice: { current: Record<HitDice, number>; max: Record<HitDice, number> }                                         //every die present (0 = none) so formulas can reference {character.hitDice.max.8}
  deathSavingThrows: { value: Formula; success: 0 | 1 | 2 | 3; failure: 0 | 1 | 2 | 3; isStable: boolean } //value = flat bonus, the engine adds 1d20

  speed: { walk: number; swim?: number; fly?: number; climb?: number }                                                  //feet
  senses: { darkvision?: number; blindsight?: number; tremorsense?: number; truesight?: number }

  //{character.proficiencies.X.<id>} resolves to 1 when listed, 0 when not
  proficiencies: {
    weaponProficiencies: ENWeaponType[]
    armorProficiencies: ENArmorClass[]
    toolProficiencies: ENTool[]
    languageProficiencies: ENLanguage[]
  }
  resistances: ENDamageType[]
  immunities: ENDamageType[]
  conditionImmunities: ENCondition[]
  conditions: Array<{ condition: ENCondition; level?: number; note?: string }>                                         //display state only; level = exhaustion
  flags: string[]                                                                                                       //unmodeled passive markers (Grants.flag)

  resources: CharacterResource[]
  actions: CharacterAction[]

  spellcasting: {                                                                                                       //required: spell formulas reference it on every character (non-casters too)
    dcBonus: number                                                                                                     //0 by default
    attackBonus: number                                                                                                 //0 by default
    slots: Partial<Record<SlotLevel, { current: number; max: Formula }>>
    pactSlots?: { level: SlotLevel; current: number; max: Formula }                                                     //Warlock Pact Magic: own pool, Short Rest
    spells: CharacterSpell[]
    spellbook?: SpellId[]                                                                                               //Wizard: spells copied into the book (prepared ones come from here)
  }

  inventory: InventoryEntry[]
  currency: { copper: number; silver: number; electrum: number; gold: number; platinum: number }                        //coin counts, not a copper total
}

export interface ICharacter extends Character {
  owner: ObjectId
  usableBy: ObjectId[]
  campaign: ObjectId
  templateSource?: ObjectId
}

export interface FCharacter extends Character {
  owner: UserSafe
  usableBy: UserSafe[]
  campaign: ICampaign
  templateSource?: ICharacter
}

//populated -> stored refs
export const FtoICharacter = (character: FCharacter): ICharacter => ({
  ...character,
  owner: character.owner._id,
  usableBy: character.usableBy.map(user => user._id),
  campaign: character.campaign._id,
  templateSource: character.templateSource?._id
})

export type Override<T, R> = Omit<T, keyof R> & R;

//every sheet Formula evaluated to a number; action rolls stay formulas
type Evaluated<T> = T extends Formula ? number
  : T extends (...args: never[]) => unknown ? T
  : T extends Array<infer Entry> ? Array<Evaluated<Entry>>
  : T extends object ? { [K in keyof T]: Evaluated<T[K]> }
  : T

//snapshot the backend CharacterManager holds and clients render
//what an action rolls, worked out by the backend for display (BG3-style): attack bonus, damage / roll range with every die at 1 and at its max
export interface ActionPreview {
  attack?: number
  damage?: { min: number; max: number; types: ENDamageType[] }
  roll?: { min: number; max: number }
  dc?: number
}

export type EvaluatedCharacter = Override<Evaluated<Omit<ICharacter, 'actions'>>, {
  actions: Array<CharacterAction & { preview?: ActionPreview }>
}>;

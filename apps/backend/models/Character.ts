//Character collection: mirrors deps/interfaces/DB/Character. Rulebook entries are registry ids (enum-checked), never refs.
//Stamped shapes (feature choices, grant sources, actions) are Mixed: their types live in packages, the builder writes them.
//Plain `new Schema`, not createSchema: nested objects must exist with their defaults on every character (createSchema leaves them undefined).
import mongoose, {Model, model, Schema, SchemaDefinition} from 'mongoose'
import {ICharacter} from "@backend/deps/interfaces/DB/Character"
import {characterFormulas} from "@backend/deps/registry/characterFormulas"
import {typedFromEntries, typedKeys} from "@backend/deps/_util/translationMap"
import {hitDiceArray, languageMap} from "@backend/deps/types/Character"
import {attributeMap} from '@backend/deps/types/Attribute'
import {skillMap} from "@backend/deps/types/Skill"
import {sizeMap} from "@backend/deps/types/Race"
import {damageTypeMap} from "@backend/deps/types/Damage"
import {conditionMap} from "@backend/deps/types/Condition"
import {classes} from "@backend/deps/data/loader"
import {subclasses} from "@backend/deps/data/loader"
import {monsters} from "@backend/deps/data/loader"
import {races} from "@backend/deps/data/loader"
import {backgrounds} from "@backend/deps/data/loader"
import {spells} from "@backend/deps/data/loader"
import {equipmentSlotMap} from "@backend/deps/types/book/items"
import {items} from "@backend/deps/data/loader"
import {tools} from "@backend/deps/data/loader"
import {basicWeapon} from "@backend/deps/data/loader"
import {armorClassMap} from "@backend/deps/types/book/items"

const idOf = (registry: object) => ({type: String, enum: typedKeys(registry)})
const listOf = (registry: object) => ({type: [String], enum: typedKeys(registry), default: []})
const slotLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const stampedList = {type: Schema.Types.Mixed, default: () => []}                                                      //list of stamped shapes, written whole

const ClassLevelDef = new Schema({
  class: {...idOf(classes), required: true},
  subclass: idOf(subclasses),
  level: {type: Number, min: 1, max: 20, required: true}
}, {_id: false})

const SpellEntryDef = new Schema({
  spell: {...idOf(spells), required: true},
  ability: {type: String, enum: typedKeys(attributeMap), required: true},
  from: {type: Schema.Types.Mixed, required: true},
  prepared: {type: Boolean, default: false},
  alwaysPrepared: Boolean,
  freeCast: {type: Schema.Types.Mixed}
}, {_id: false})

const InventoryEntryDef = new Schema({
  id: {type: String, required: true},
  item: {...idOf(items), required: true},
  base: idOf(items),                                                                                                    //mundane item a magic one is built on
  quantity: {type: Number, default: 1, min: 0},
  equipped: {type: String, enum: typedKeys(equipmentSlotMap)},
  attuned: Boolean,
  charges: Number,
  spent: Number,                                                                                                        //ammo fired since the last pick-up
  note: String
}, {_id: false})

const ConditionDef = new Schema({
  condition: {type: String, enum: typedKeys(conditionMap), required: true},
  level: Number,
  note: String
}, {_id: false})

const diceRecord = () => typedFromEntries(hitDiceArray.map(die => [die, {type: Number, default: 0}]))

const CharacterDef: SchemaDefinition<ICharacter> = {
  name: {type: String, default: 'not_init'},
  isNPC: {type: Boolean, default: false},
  isTemplate: {type: Boolean, default: false},
  avatar: String,
  image: String,
  notes: String,
  owner: {type: Schema.Types.ObjectId, ref: 'User', required: true},
  usableBy: [{type: Schema.Types.ObjectId, ref: 'User'}],
  campaign: {type: Schema.Types.ObjectId, ref: 'Campaign', required: true},
  templateSource: {type: Schema.Types.ObjectId, ref: 'Character'},
  monster: idOf(monsters),                                                                                                //stat-block character (data/monsters)

  race: idOf(races),
  size: {type: String, enum: typedKeys(sizeMap)},
  background: idOf(backgrounds),
  classes: {type: [ClassLevelDef], default: []},
  xp: {type: Number, default: 0},
  features: stampedList,
  levelUpAllowed: {type: Boolean, default: false},                                                                          //DM switch for one player level-up
  rolledScores: {type: Schema.Types.Mixed},                                                                               //[{total, dice}] ×6, rolled once

  proficiency: {type: String, default: characterFormulas.proficiency},
  attributes: typedFromEntries(typedKeys(attributeMap).map(attribute => [attribute, {
    value: {type: Number, default: 10},
    modifier: {type: String, default: characterFormulas.attributes[attribute]}
  }])),
  savingThrows: typedFromEntries(typedKeys(attributeMap).map(attribute => [attribute, {
    value: {type: String, default: characterFormulas.savingThrows[attribute]},
    proficiency: {type: Boolean, default: false}
  }])),
  skills: typedFromEntries(typedKeys(skillMap).map(skill => [skill, {
    value: {type: String, default: characterFormulas.skills[skill]},
    proficiency: {type: Boolean, default: false},
    expertise: {type: Boolean, default: false}
  }])),
  initiative: {
    value: {type: String, default: characterFormulas.initiative},
    proficiency: {type: Boolean, default: false}
  },
  passivePerception: {type: String, default: characterFormulas.passivePerception},
  armorClass: {type: String, default: characterFormulas.armorClass},
  critThresholdMod: {type: Number, default: 0},
  maxAttunements: {type: String, default: characterFormulas.maxAttunements},

  hitPoints: {
    current: {type: Number, default: 1},
    max: {type: String, default: characterFormulas.hitPoints},
    temp: Number
  },
  hitDice: {current: diceRecord(), max: diceRecord()},
  deathSavingThrows: {
    value: {type: String, default: characterFormulas.deathSavingThrows},
    success: {type: Number, enum: [0, 1, 2, 3], default: 0},
    failure: {type: Number, enum: [0, 1, 2, 3], default: 0},
    isStable: {type: Boolean, default: false}
  },

  speed: {walk: {type: Number, default: 30}, swim: Number, fly: Number, climb: Number},
  senses: {darkvision: Number, blindsight: Number, tremorsense: Number, truesight: Number},
  proficiencies: {
    weaponProficiencies: listOf(basicWeapon),
    armorProficiencies: listOf(armorClassMap),
    toolProficiencies: listOf(tools),
    languageProficiencies: listOf(languageMap)
  },
  resistances: listOf(damageTypeMap),
  immunities: listOf(damageTypeMap),
  conditionImmunities: listOf(conditionMap),
  conditions: {type: [ConditionDef], default: []},
  flags: {type: [String], default: []},

  resources: stampedList,
  actions: stampedList,

  spellcasting: {
    dcBonus: {type: Number, default: 0},
    attackBonus: {type: Number, default: 0},
    slots: typedFromEntries(slotLevels.map(level => [level, {
      current: {type: Number, default: 0},
      max: {type: String, default: '0'}
    }])),
    pactSlots: {type: Schema.Types.Mixed},
    spells: {type: [SpellEntryDef], default: []},
    spellbook: listOf(spells)
  },

  inventory: {type: [InventoryEntryDef], default: []},
  currency: {
    copper: {type: Number, default: 0},
    silver: {type: Number, default: 0},
    electrum: {type: Number, default: 0},
    gold: {type: Number, default: 0},
    platinum: {type: Number, default: 0}
  }
}

const CharacterSchema = new Schema<ICharacter>(CharacterDef, {timestamps: true, minimize: false}) //keep empty objects (senses: {}) — readers expect every path

CharacterSchema.index({owner: 1})
CharacterSchema.index({campaign: 1})
CharacterSchema.index({isNPC: 1})
CharacterSchema.index({isTemplate: 1})

export const Character: Model<ICharacter> = mongoose.models.Character || model<ICharacter>('Character', CharacterSchema)

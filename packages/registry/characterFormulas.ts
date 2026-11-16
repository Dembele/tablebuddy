//Default sheet formulas for a new character (2024 rules). Human-owned once written: the builder copies them, the user may edit.
//Functions: @level() total level, @level(classId), @startingHitDie(), @armor(unarmored) / @shield() from equipped armor;
//list refs resolve to 1/0 (see engine characterUtils).

import {Formula} from "../types/internal/Formula"
import {attributeMap, ENAttribute} from "../types/Attribute"
import {ENSkill, skillAttributeMap, skillMap} from "../types/Skill"
import {hitDiceArray} from "../types/Character"
import {typedFromEntries, typedKeys} from "../_util/translationMap"

const formula = (text: string) => text as Formula
const modifierOf = (attribute: ENAttribute) => `{character.attributes.${attribute}.modifier}`
const constitution = modifierOf('constitution')

//level 1: max of the starting die; every other die: its average (half + 1); each level gives at least 1 HP
const hitPointMax = [
  `max(1, @startingHitDie() + ${constitution})`,
  ...hitDiceArray.map((die) =>
    `({character.hitDice.max.${die}} - (@startingHitDie() == ${die})) * max(1, ${Number(die) / 2 + 1} + ${constitution})`)
].join(' + ')

export const characterFormulas = {
  proficiency: formula('ceil(@level() / 4) + 1'),
  attributes: typedFromEntries(typedKeys(attributeMap).map((attribute) =>
    [attribute, formula(`floor(({character.attributes.${attribute}.value} - 10) / 2)`)])),
  savingThrows: typedFromEntries(typedKeys(attributeMap).map((attribute) => [attribute, formula(modifierOf(attribute))])),
  skills: typedFromEntries(typedKeys(skillMap).map((skill: ENSkill) => [skill, formula(modifierOf(skillAttributeMap[skill]))])),
  initiative: formula(modifierOf('dexterity')),
  passivePerception: formula('10 + {character.skills.perception.value} + ({character.skills.perception.proficiency} + {character.skills.perception.expertise}) * {character.proficiency}'),
  armorClass: formula(`@armor(10 + ${modifierOf('dexterity')}) + @shield()`),
  hitPoints: formula(hitPointMax),
  deathSavingThrows: formula('0'),
  maxAttunements: formula('3')
}

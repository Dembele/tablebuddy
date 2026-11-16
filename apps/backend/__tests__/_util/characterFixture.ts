//In-memory character for engine tests: default sheet formulas (registry/characterFormulas), no DB.
import {ICharacter} from "@backend/deps/interfaces/DB/Character"
import {characterFormulas} from "@backend/deps/registry/characterFormulas"
import {typedFromEntries, typedKeys} from "@backend/deps/_util/translationMap"
import {attributeMap} from "@backend/deps/types/Attribute"
import {skillMap} from "@backend/deps/types/Skill"
import {hitDiceArray} from "@backend/deps/types/Character"
import {newObjectId} from "@backend/deps/types/internal/ObjectId"
import {Character, CharacterAPI} from "@backend/services/Character"
import {Answers, BuildResult, buildCreation, standardArray} from "@backend/deps/builder/_index"

const noDice = () => typedFromEntries(hitDiceArray.map(die => [die, 0]))

export function blankCharacter(): ICharacter {
  return {
    _id: newObjectId('68f4eb4af1e03be810200ca1'), owner: newObjectId('owner'), usableBy: [], campaign: newObjectId('campaign'),
    name: 'Тестовый', isNPC: false, isTemplate: false,
    race: 'human', size: 'medium', background: 'soldier', classes: [], xp: 0, features: [],
    proficiency: characterFormulas.proficiency,
    attributes: typedFromEntries(typedKeys(attributeMap).map(attribute => [attribute, {value: 10, modifier: characterFormulas.attributes[attribute]}])),
    savingThrows: typedFromEntries(typedKeys(attributeMap).map(attribute => [attribute, {value: characterFormulas.savingThrows[attribute], proficiency: false}])),
    skills: typedFromEntries(typedKeys(skillMap).map(skill => [skill, {value: characterFormulas.skills[skill], proficiency: false, expertise: false}])),
    initiative: {value: characterFormulas.initiative, proficiency: false},
    passivePerception: characterFormulas.passivePerception,
    armorClass: characterFormulas.armorClass,
    critThresholdMod: 0,
    maxAttunements: characterFormulas.maxAttunements,
    hitPoints: {current: 1, max: characterFormulas.hitPoints},
    hitDice: {current: noDice(), max: noDice()},
    deathSavingThrows: {value: characterFormulas.deathSavingThrows, success: 0, failure: 0, isStable: false},
    speed: {walk: 30}, senses: {},
    proficiencies: {weaponProficiencies: [], armorProficiencies: [], toolProficiencies: [], languageProficiencies: []},
    resistances: [], immunities: [], conditionImmunities: [], conditions: [], flags: [],
    resources: [], actions: [],
    spellcasting: {dcBonus: 0, attackBonus: 0, slots: {}, spells: []},
    inventory: [],
    currency: {copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0}
  }
}

//live wrapper over a blank character; setProperty re-evaluates in memory
export const testCharacter = (): CharacterAPI => Character.fromData(blankCharacter())

//creation with every open question answered: given picks first, then recommended / enabled options
export function builtCharacter(given: Answers): ICharacter {
  const answers: Answers = {'scores:method': ['standard'], ...given}
  let built: BuildResult = buildCreation(blankCharacter(), answers)
  for (let round = 0; round < 40 && built.missing.length; round++) {
    for (const key of built.missing) {
      if (given[key]) continue
      const question = built.questions.find((candidate) => candidate.key === key)!
      if (question.kind === 'scores') { answers[key] = standardArray.map(String); continue }
      const enabled = question.options.filter((option) => !option.disabled).map((option) => option.id)
      const recommended = (question.recommended ?? []).filter((id) => enabled.includes(id))
      answers[key] = [...recommended, ...enabled.filter((id) => !recommended.includes(id))].slice(0, question.count)
    }
    built = buildCreation(blankCharacter(), answers)
  }
  return built.character
}

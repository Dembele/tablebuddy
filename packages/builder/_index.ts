//Character builder (2024 PHB): creation and level-up as one pure walk each. Same call = plan + live preview:
//it returns the questions (answered or not), what is still missing, and the draft with everything answered stamped in.
//Nothing here persists — the user reviews the draft and commits it through the normal character update.

import {ICharacter} from "../interfaces/DB/Character"
import {ENAttribute, attributeMap} from "../types/Attribute"
import {races} from "../data/loader"
import {backgrounds} from "../data/loader"
import {classes} from "../data/loader"
import {Answers, Problems, Question, ScoreMethod, scoresProblem} from "./questions"
import {nameOf, optionsOf, standardLanguages} from "./options"
import {modifier, Stamper} from "./Stamper"

export type {Answers, Problems, Question, Option, ScoreMethod} from "./questions"
export {standardArray, pointBuyCost, pointBuyBudget, pointBuyEquivalent, scoresProblem} from "./questions"
export type {RolledScore} from "./questions"
export {choiceAnswerName} from "./options"

export interface BuildResult {
  character: ICharacter
  questions: Question[]
  missing: string[]                                                                                                     //question keys still unanswered or invalid
  problems: Problems
  notes: string[]                                                                                                       //things the builder leaves to the user
}

type RaceEntry = { id: string; name: string; description: string; lineageOf?: string; size: string[]; speed: { walk: number }; features: Array<{ level: number; feature: string }> }
type BackgroundEntry = (typeof backgrounds)[keyof typeof backgrounds]
type ClassEntry = (typeof classes)[keyof typeof classes]
const raceList = races as unknown as Record<string, RaceEntry>
const backgroundList = backgrounds as unknown as Record<string, BackgroundEntry>
const classList = classes as unknown as Record<string, ClassEntry>
const attributes = Object.keys(attributeMap) as ENAttribute[]

const result = (stamper: Stamper): BuildResult =>
  ({character: stamper.draft, questions: stamper.questions, missing: stamper.missing, problems: stamper.problems, notes: stamper.notes})

const short = (text: string) => text.split('\n')[0]

//2024 multiclassing: 13+ in the primary ability of the new class and of every class you already have
function multiclassProblem(stamper: Stamper, classId: string): string | undefined {
  const failing = [classId, ...stamper.draft.classes.map((entry) => entry.class)].filter((id, index, list) => list.indexOf(id) === index).filter((id) => {
    const {attributes: needed, mode} = classList[id].primaryAbility
    const meets = (attribute: ENAttribute) => stamper.draft.attributes[attribute].value >= 13
    return mode === 'all' ? !needed.every(meets) : !needed.some(meets)
  })
  return failing.length ? `мультикласс: нужно 13+ в основной характеристике (${failing.map((id) => classList[id].name).join(', ')})` : undefined
}

//level-1 character from a blank sheet: scores, background, species, class, equipment
export function buildCreation(character: ICharacter, answers: Answers): BuildResult {
  const stamper = new Stamper(character, answers)
  const draft = stamper.draft
  if (character.classes.length) {
    stamper.notes.push('У персонажа уже есть класс — используйте повышение уровня')
    return result(stamper)
  }

  stamper.group = 'abilities'
  const rolled = character.rolledScores?.length ? character.rolledScores : undefined
  const methods = rolled
    ? [{id: 'roll', name: 'Броски', hint: rolled.map((score) => score.total).join(', ')}]
    : [{id: 'pointBuy', name: 'Покупка', hint: '27 очков'}, {id: 'standard', name: 'Стандартный набор', hint: '15, 14, 13, 12, 10, 8'},
      {id: 'roll', name: 'Броски', hint: '4к6 без меньшего, один раз — без переброса'}]
  const method = stamper.ask({key: 'scores:method', title: 'Способ определения характеристик', count: 1, options: methods})?.[0] as ScoreMethod | undefined
  if (method) {
    const scores = stamper.ask({key: 'scores', kind: 'scores', method, rolled, title: 'Значения характеристик', count: 6, options: optionsOf('attribute', attributes)})
    const values = scores?.map(Number)
    const problem = values ? scoresProblem(method, values, rolled) : method === 'roll' && !rolled ? 'Сначала бросьте кости' : 'Распределите значения'
    if (problem) {
      stamper.problems.scores = problem
      if (!stamper.missing.includes('scores')) stamper.missing.push('scores')
    } else if (values) attributes.forEach((attribute, index) => draft.attributes[attribute].value = values[index])
  }
  const baseScores = Object.fromEntries(attributes.map((attribute) => [attribute, draft.attributes[attribute].value]))

  //background before species: its fixed skills are known before anyone picks skills
  stamper.group = 'background'
  const backgroundOptions = Object.values(backgroundList).map((background) => ({id: background.id, name: background.name, description: short(background.description),
    hint: (background.abilityScores.options as ENAttribute[]).map((attribute) => nameOf.attribute(attribute)).join(', ')}))
  const backgroundId = stamper.ask({key: 'background', title: 'Предыстория', count: 1, options: backgroundOptions})?.[0]
  const background = backgroundId ? backgroundList[backgroundId] : undefined
  if (background) {
    draft.background = background.id as ICharacter['background']
    stamper.grantProficiencies(background.grants, 'background:proficiencies', background.name)
    stamper.abilityIncrease(background.abilityScores, 'background:asi', background.name)
    stamper.grantFeature(background.feat, {type: 'background', id: draft.background!}, 'background:feat')
  }
  //the scores step shows the origin bonus answered so far
  const scoresQuestion = stamper.questions.find((question) => question.key === 'scores')
  if (scoresQuestion) scoresQuestion.bonuses = Object.fromEntries(attributes.map((attribute) => [attribute, draft.attributes[attribute].value - baseScores[attribute]]))

  stamper.group = 'race'
  const raceOptions = Object.values(raceList).map((race) => ({id: race.id, name: race.name, description: short(race.description)}))
  const raceId = stamper.ask({key: 'race', title: 'Вид', count: 1, options: raceOptions})?.[0]
  if (raceId) {
    const race = raceList[raceId]
    draft.race = race.id as ICharacter['race']
    draft.speed.walk = race.speed.walk
    const size = stamper.ask({key: 'race:size', title: 'Размер', count: 1, options: optionsOf('option', race.size).map((option) => ({...option, name: {small: 'Маленький', medium: 'Средний'}[option.id] ?? option.id}))})
    if (size) draft.size = size[0] as ICharacter['size']
    race.features.forEach((grant, index) => grant.level <= 1 && stamper.grantFeature(grant as never, {type: 'race', id: draft.race!}, `race:${index}`))
  }
  if (!draft.proficiencies.languageProficiencies.includes('common')) draft.proficiencies.languageProficiencies.push('common')
  const languageOptions = optionsOf('language', standardLanguages).map((option) =>
    draft.proficiencies.languageProficiencies.includes(option.id as never) ? {...option, disabled: 'уже знаете'} : option)
  const languages = stamper.ask({key: 'languages', title: 'Языки (кроме Общего)', count: 2, options: languageOptions})
  if (languages) stamper.addProficiencies('languageProficiencies', languages)

  stamper.group = 'class'
  const classOptions = Object.values(classList).map((entry) => ({id: entry.id, name: entry.name, description: short(entry.description),
    hint: `к${entry.hitDie} · ${entry.primaryAbility.attributes.map((attribute) => nameOf.attribute(attribute)).join(entry.primaryAbility.mode === 'all' ? ' и ' : ' или ')}`}))
  const classId = stamper.ask({key: 'class', title: 'Класс', count: 1, options: classOptions})?.[0]
  if (classId) {
    stamper.addClassLevel(classId, true)
    draft.hitPoints.current = Math.max(1, Number(classList[classId].hitDie) + modifier(draft.attributes.constitution.value))
  }

  stamper.group = 'equipment'
  if (classId) stamper.startingEquipment(classList[classId].equipment, 'equipment:class', `Снаряжение класса: ${classList[classId].name}`)
  if (background) stamper.startingEquipment(background.equipment, 'equipment:background', `Снаряжение предыстории: ${background.name}`)

  return result(stamper)
}

//one more level: an existing class or a new one (multiclass), with everything that level brings
export function buildLevelUp(character: ICharacter, answers: Answers): BuildResult {
  const stamper = new Stamper(character, answers)
  const draft = stamper.draft
  const level = stamper.characterLevel()
  if (!draft.classes.length) {
    stamper.notes.push('Сначала создайте персонажа')
    return result(stamper)
  }
  if (level >= 20) {
    stamper.notes.push('Достигнут 20 уровень')
    return result(stamper)
  }

  stamper.group = 'class'
  const options = Object.values(classList).map((entry) => {
    const current = stamper.classLevel(entry.id)
    return current
      ? {id: entry.id, name: entry.name, hint: `уровень ${current} → ${current + 1}`}
      : {id: entry.id, name: entry.name, hint: 'новый класс', warning: multiclassProblem(stamper, entry.id)}
  }).sort((a, b) => Number(!stamper.classLevel(a.id)) - Number(!stamper.classLevel(b.id)))
  const classId = stamper.ask({key: 'levelUp:class', title: `Повышение до уровня ${level + 1}`, count: 1, options, recommended: [draft.classes[0].class]})?.[0]
  if (!classId) return result(stamper)

  stamper.addClassLevel(classId, false)
  const newLevel = level + 1
  const race = draft.race ? raceList[draft.race] : undefined
  race?.features.forEach((grant, index) => grant.level === newLevel && stamper.grantFeature(grant as never, {type: 'race', id: draft.race!, level: newLevel}, `race:${index}`))

  const die = Number(classList[classId].hitDie)
  draft.hitPoints.current += Math.max(1, die / 2 + 1 + modifier(draft.attributes.constitution.value))
  return result(stamper)
}

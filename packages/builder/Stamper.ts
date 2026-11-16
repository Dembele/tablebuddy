//The builder walk: asks questions, reads answers, stamps grants onto a draft character. Pure — no I/O, no engine.
//Unanswered questions leave their part unstamped and are listed in `missing`; the UI commits only when nothing is missing.

import {CharacterAction, CharacterFeature, CharacterSpell, GrantSource, ICharacter} from "../interfaces/DB/Character"
import {Formula} from "../types/internal/Formula"
import {ENAttribute} from "../types/Attribute"
import {skillMap} from "../types/Skill"
import {ENSpellProgression} from "../types/Class"
import {features} from "../data/loader"
import {Feature, FeatureGrant, Grants, LimitedSpellcasting, Prerequisite, ChoiceSpec} from "../types/book/features"
import {classes} from "../data/loader"
import {Class, ClassColumn, ClassResource, ClassSpellcasting} from "../types/book/classes"
import {subclasses} from "../data/loader"
import {spells} from "../data/loader"
import {bindSpellAbility} from "../rules/spellFormulas"
import {slotsTable, fullSlots} from "../rules/spellSlots"
import {bundles} from "../data/loader"
import {StartingEquipment} from "../types/book/items"
import {tools} from "../data/loader"
import {Answers, Option, Problems, Question} from "./questions"
import {allOf, Category, nameOf, optionsOf, spellIds, spellOption} from "./options"

type AnyFeature = Feature & { id: string }
type AnyClass = Class
type Draft = ICharacter

const featureList = features as unknown as Record<string, AnyFeature>
const classList = classes as unknown as Record<string, AnyClass>
const subclassList = subclasses as unknown as Record<string, { id: string; name: string; class: string; description: string; table?: Record<string, ClassColumn>; resources?: ClassResource[]; spellcasting?: ClassSpellcasting; features: FeatureGrant[] }>
const spellList = spells as unknown as Record<string, { id: string; name: string; level: number; classes: string[]; actions?: CharacterAction[] }>

export const modifier = (score: number) => Math.floor((score - 10) / 2)
const unique = <T>(values: T[]) => [...new Set(values)]
const plainNumber = (formula: string) => /^\s*\d+\s*$/.test(formula) ? Number(formula) : null

//which character list a grant key writes, and which ChoiceSpec category answers its `choose`
const grantCategory: Record<string, Category> = {
  skillProficiencies: 'skill', expertise: 'skill', toolProficiencies: 'tool', weaponProficiencies: 'weaponType',
  savingThrowProficiencies: 'attribute', resistances: 'damageType', immunities: 'damageType',
  languageProficiencies: 'language', armorProficiencies: 'armor', conditionImmunities: 'condition'
}
const proficiencyGrants = Object.keys(grantCategory) as Array<keyof typeof grantCategory>

//choices whose count follows a class table column, not the printed count
const columnChoices: Record<string, { column: string; choice: string }> = {
  warlockEldritchInvocations: {column: 'invocations', choice: 'invocations'},
  fighterWeaponMastery: {column: 'weaponMastery', choice: 'weapons'},
  barbarianWeaponMastery: {column: 'weaponMastery', choice: 'weapons'}
}

//stable text key of a grant source, used to dedupe stamped entries
export const sourceKey = (source: GrantSource) => source.type === 'custom' ? 'custom' : `${source.type}:${source.id}`

export class Stamper {
  readonly draft: Draft
  readonly questions: Question[] = []
  readonly missing: string[] = []
  readonly notes: string[] = []
  readonly problems: Problems = {}
  group = 'main'

  constructor(character: ICharacter, private readonly answers: Answers) {
    this.draft = structuredClone(character)
  }

  // ───────────── asking ─────────────

  //registers a question; returns its answer when complete and valid (disabled options never count)
  ask(question: Omit<Question, 'group' | 'kind'> & { kind?: Question['kind'] }): string[] | undefined {
    const enabled = question.options.filter((option) => !option.disabled)
    const count = question.kind === 'scores' ? question.count : Math.min(question.count, enabled.length)
    const full: Question = {kind: 'pick', ...question, count, group: this.group}
    if (count === 0) return []
    if (full.kind === 'pick' && enabled.length === count) {
      this.questions.push({...full, fixed: true})
      return enabled.map((option) => option.id)
    }
    this.questions.push(full)
    const answer = this.answers[full.key]
    const allowed = new Set(enabled.map((option) => option.id))
    if (answer && answer.length === count && (full.kind === 'scores' || (new Set(answer).size === count && answer.every((id) => allowed.has(id))))) return answer
    this.missing.push(full.key)
    return undefined
  }

  //does the draft already have this id under a grant key (proficiency lists, saves, expertise, defences)
  has(grantKey: string, id: string): boolean {
    const draft = this.draft
    switch (grantKey) {
      case 'skillProficiencies': return !!draft.skills[id as keyof typeof skillMap]?.proficiency
      case 'expertise': return !!draft.skills[id as keyof typeof skillMap]?.expertise
      case 'savingThrowProficiencies': return !!draft.savingThrows[id as ENAttribute]?.proficiency
      case 'resistances': return draft.resistances.includes(id as never)
      case 'immunities': return draft.immunities.includes(id as never)
      case 'conditionImmunities': return draft.conditionImmunities.includes(id as never)
      default: return ((draft.proficiencies as unknown as Record<string, string[]>)[grantKey] ?? []).includes(id)
    }
  }

  //marks options that would grant nothing new
  private markOwned(grantKey: string, options: Option[]): Option[] {
    return options.map((option) => this.has(grantKey, option.id) ? {...option, disabled: grantKey === 'expertise' ? 'уже экспертность' : 'уже есть'} : option)
  }

  // ───────────── levels & prerequisites ─────────────

  characterLevel = () => this.draft.classes.reduce((total, entry) => total + entry.level, 0)
  classLevel = (classId: string) => this.draft.classes.find((entry) => entry.class === classId)?.level ?? 0

  //level a source scales with: class level for class / subclass grants, character level otherwise
  levelFor(source: GrantSource): number {
    if (source.type === 'class') return this.classLevel(source.id)
    if (source.type === 'subclass') return this.classLevel(subclassList[source.id]?.class ?? '')
    return this.characterLevel()
  }

  hasFeature = (featureId: string) => this.draft.features.some((instance) => instance.featureId === featureId)

  //flags derived from what the character has (feat prerequisites)
  private hasFlag(flag: string): boolean {
    if (this.draft.flags.includes(flag)) return true
    const has = (predicate: (feature: AnyFeature) => boolean) => this.draft.features.some((instance) => {
      const feature = featureList[instance.featureId]
      return feature ? predicate(feature) : false
    })
    switch (flag) {
      case 'spellcasting': return this.draft.classes.some((entry) => classList[entry.class]?.spellcasting || (entry.subclass && subclassList[entry.subclass]?.spellcasting))
      case 'pactMagic': return this.classLevel('warlock') > 0
      case 'fightingStyle': return has((feature) => feature.type === 'fightingStyle')
      case 'weaponMastery': return has((feature) => /WeaponMastery$/.test(feature.id))
      case 'warlockDamagingCantrip': return this.draft.spellcasting.spells.some((entry) =>
        spellList[entry.spell]?.level === 0 && spellList[entry.spell]?.classes.includes('warlock') && (spellList[entry.spell]?.actions?.length ?? 0) > 0)
      default: return false
    }
  }

  //printed reason when a prerequisite fails, null when met
  prerequisiteProblem(prerequisites: Prerequisite[] | undefined): string | null {
    for (const prerequisite of prerequisites ?? []) {
      const problem = this.singleProblem(prerequisite)
      if (problem) return problem
    }
    return null
  }

  private singleProblem(prerequisite: Prerequisite): string | null {
    switch (prerequisite.type) {
      case 'level': return this.characterLevel() >= prerequisite.min ? null : `нужен уровень ${prerequisite.min}`
      case 'classLevel': return this.classLevel(prerequisite.class) >= prerequisite.min ? null : `нужен уровень ${prerequisite.min} класса`
      case 'attribute': return prerequisite.any.some((attribute) => this.draft.attributes[attribute].value >= prerequisite.min)
        ? null : `нужно ${prerequisite.any.map(nameOf.attribute).join(' или ')} ${prerequisite.min}+`
      case 'armorProficiency': return this.draft.proficiencies.armorProficiencies.includes(prerequisite.armor) ? null : `нужно владение: ${nameOf.armor(prerequisite.armor)}`
      case 'flag': return this.hasFlag(prerequisite.flag) ? null : `нужно: ${prerequisite.flag}`
      case 'feature': return this.hasFeature(prerequisite.featureId) ? null : `нужно: ${nameOf.feature(prerequisite.featureId)}`
      case 'anyOf': return prerequisite.of.some((inner) => !this.singleProblem(inner)) ? null : 'не выполнено ни одно из условий'
    }
  }

  //a pickable feature: taken non-repeatable ones disabled, unmet prerequisites become warnings
  featureOptions(ids: string[]): Option[] {
    return unique(ids).flatMap((id) => {
      const feature = featureList[id]
      if (!feature) return []
      return [{id, name: feature.name, description: feature.description, warning: this.prerequisiteProblem(feature.prerequisites) ?? undefined,
        disabled: !feature.repeatable && this.hasFeature(id) ? 'уже взято' : undefined}]
    })
  }

  // ───────────── features ─────────────

  //a level grant: OR-pick among choices, preset answers, then the feature itself
  grantFeature(grant: FeatureGrant, from: GrantSource, key: string) {
    let featureId: string = grant.feature
    if (grant.choices?.length) {
      const options = this.featureOptions([grant.feature, ...grant.choices])
      const pick = this.ask({key: `${key}:pick`, title: `Выбор вместо «${nameOf.feature(grant.feature)}»`, count: 1, options, recommended: [grant.feature]})
      if (!pick) return
      featureId = pick[0]
    }
    this.stampFeature(featureId, from, `${key}:${featureId}`, grant.presetChoices)
  }

  //one feature instance: ability increase, its choices, grants, sub-features, actions, resources
  stampFeature(featureId: string, from: GrantSource, key: string, preset?: Record<string, string | string[]>) {
    const feature = featureList[featureId]
    if (!feature) return this.notes.push(`Нет в справочнике: ${featureId}`)
    const instance: CharacterFeature = {featureId: feature.id as CharacterFeature['featureId'], from, choices: {}}

    if (feature.abilityIncrease) instance.asi = this.abilityIncrease(feature.abilityIncrease, `${key}:asi`, feature.name)

    for (const spec of feature.choices ?? []) {
      if (preset?.[spec.id] !== undefined) {
        instance.choices![spec.id] = preset[spec.id]
        continue
      }
      const count = columnChoices[feature.id]?.choice === spec.id ? this.columnValue(from, columnChoices[feature.id].column) ?? spec.count : spec.count
      const answer = this.ask({key: `${key}:${spec.id}`, title: `${feature.name}: выбор`, count, options: this.choiceOptions(spec, instance, feature)})
      if (answer) instance.choices![spec.id] = answer
    }

    this.draft.features.push(instance)
    this.applyGrants(feature, instance, key)
    this.applySkillOrTool(feature, instance)
    for (const spec of feature.choices ?? []) {
      if (spec.options.from !== 'feature') continue
      for (const subId of [instance.choices?.[spec.id] ?? []].flat()) this.stampFeature(subId, {type: 'feature', id: feature.id as CharacterFeature['featureId']}, `${key}:${spec.id}:${subId}`)
    }

    const ability = this.featureAbility(feature, instance)
    for (const action of feature.actions ?? []) this.addAction(action, from, ability)
    for (const resource of feature.resources ?? []) this.addResource(resource.name, resource.max, resource.resetsOn, from)
  }

  //options of one ChoiceSpec against the current draft: useless picks disabled with the reason, never hidden
  private choiceOptions(spec: ChoiceSpec, instance: CharacterFeature, feature?: AnyFeature): Option[] {
    const {options} = spec
    const grants = feature?.grants as Record<string, { choose?: unknown } | undefined> | undefined
    const grantsChoice = (grantKey: string) => !!grants?.[grantKey]?.choose
    //where: proficient / notProficient against one proficiency list
    const byWhere = (grantKey: string, list: Option[]): Option[] => list.map((option) => {
      const owned = this.has(grantKey, option.id)
      if (spec.where === 'proficient' && !owned) return {...option, disabled: 'нужно владение'}
      if (spec.where === 'notProficient' && owned) return {...option, disabled: 'уже есть'}
      return option
    })

    switch (options.from) {
      case 'skill': {
        const list = optionsOf('skill', options.allow ?? allOf('skill'))
        const expertise = grantsChoice('expertise'), proficiency = grantsChoice('skillProficiencies')
        const skillSpecs = (feature?.choices ?? []).filter((choice) => choice.options.from === 'skill').length
        const feedsExpertise = spec.where === 'proficient' || (expertise && !proficiency)
        const feedsBoth = expertise && proficiency && !spec.where && skillSpecs === 1
        if (feedsBoth) return list.map((option) => this.has('expertise', option.id) ? {...option, disabled: 'уже экспертность'}
          : this.has('skillProficiencies', option.id) ? {...option, hint: 'уже владеете → станет экспертностью'} : option)
        if (feedsExpertise) return byWhere('skillProficiencies', list)
          .map((option) => !option.disabled && this.has('expertise', option.id) ? {...option, disabled: 'уже экспертность'} : option)
        return proficiency ? this.markOwned('skillProficiencies', list) : byWhere('skillProficiencies', list)
      }
      case 'attribute': return byWhere('savingThrowProficiencies', optionsOf('attribute', options.allow ?? allOf('attribute')))
      case 'tool': {
        const list = optionsOf('tool', options.allow ?? allOf('tool'))
        return grantsChoice('toolProficiencies') ? this.markOwned('toolProficiencies', list) : byWhere('toolProficiencies', list)
      }
      case 'weaponType': return byWhere('weaponProficiencies', optionsOf('weaponType', options.allow ?? allOf('weaponType')))
      case 'damageType': {
        const list = optionsOf('damageType', options.allow ?? allOf('damageType'))
        return grantsChoice('resistances') ? this.markOwned('resistances', list) : list
      }
      case 'spellList': return optionsOf('spellList', options.allow)
      case 'option': return optionsOf('option', options.allow)
      case 'feature': return this.featureOptions(options.allow)
      case 'skillOrTool': return [
        ...this.markOwned('skillProficiencies', optionsOf('skill', allOf('skill'))),
        ...this.markOwned('toolProficiencies', optionsOf('tool', allOf('tool')))
      ]
      case 'spell': {
        const classFilter = Array.isArray(options.classes) ? options.classes
          : options.classes ? [instance.choices?.[options.classes.fromChoice] ?? []].flat() : undefined
        if (classFilter && classFilter.length === 0) return []
        const known = new Set<string>(this.draft.spellcasting.spells.map((entry) => entry.spell))
        return spellIds({level: options.level, classes: classFilter, schools: options.schools, ritual: options.ritual})
          .map((id) => known.has(id) ? {...spellOption(id), disabled: 'уже известно'} : spellOption(id))
      }
    }
  }

  //Ability score increase as one question per bonus (+2 first); answers are attributes, values applied with the cap
  abilityIncrease(increase: Feature['abilityIncrease'] & object, key: string, title: string): ENAttribute[] | undefined {
    const pool = increase.options === 'any' ? allOf('attribute') : increase.options
    let distribution = increase.distribution[0]
    if (increase.distribution.length > 1) {
      const modes = increase.distribution.map((bonuses) => ({id: bonuses.join(','), name: bonuses.map((bonus) => `+${bonus}`).join(' / ')}))
      const mode = this.ask({key: `${key}:mode`, title: `${title}: распределение`, count: 1, options: modes})
      if (!mode) return undefined
      distribution = mode[0].split(',').map(Number)
    }
    const picked: ENAttribute[] = []
    distribution.forEach((bonus, index) => {
      const options = pool.filter((attribute) => !picked.includes(attribute as ENAttribute)).map((attribute) => {
        const value = this.draft.attributes[attribute as ENAttribute].value
        return {id: attribute, name: nameOf.attribute(attribute), hint: `${value} → ${Math.min(increase.cap, value + bonus)}`,
          warning: value + bonus > increase.cap ? `предел ${increase.cap}` : undefined}
      })
      const answer = this.ask({key: `${key}:${index}`, title: `${title}: +${bonus}`, count: 1, options})
      if (answer) picked.push(answer[0] as ENAttribute)
    })
    if (picked.length !== distribution.length) return undefined
    picked.forEach((attribute, index) => {
      const score = this.draft.attributes[attribute]
      score.value = Math.min(increase.cap, score.value + distribution[index])
    })
    return picked
  }

  // ───────────── grants ─────────────

  //proficiency-like grants (fixed + chosen), senses, speed, HP, flags, limited spellcasting
  applyGrants(feature: AnyFeature, instance: CharacterFeature, key: string) {
    const grants = feature.grants
    if (!grants) return
    const chosen = this.chosenProficiencies(feature, instance, key)
    for (const grantKey of proficiencyGrants) {
      const grant = grants[grantKey as keyof Grants] as { fixed?: string[]; choose?: unknown } | undefined
      if (grant) this.addProficiencies(grantKey, [...(grant.fixed ?? []), ...(chosen[grantKey] ?? [])])
    }
    if (grants.initiative) this.draft.initiative.proficiency = true
    for (const [sense, range] of Object.entries(grants.senses ?? {})) {
      const senses = this.draft.senses as Record<string, number | undefined>
      senses[sense] = Math.max(senses[sense] ?? 0, range ?? 0)
    }
    for (const [type, bonus] of Object.entries(grants.speedBonus ?? {})) {
      const speed = this.draft.speed as Record<string, number | undefined>
      if (type === 'walk') speed.walk = (speed.walk ?? 0) + (bonus ?? 0)
      else speed[type] = Math.max(speed[type] ?? 0, bonus || this.draft.speed.walk) //0 = equal to walking speed
    }
    if (grants.hitPointMaxBonus) this.draft.hitPoints.max = `${this.draft.hitPoints.max} + ${grants.hitPointMaxBonus}` as Formula
    if (grants.hitPointMaxPerLevel) this.draft.hitPoints.max = `${this.draft.hitPoints.max} + ${grants.hitPointMaxPerLevel} * @level()` as Formula
    if (grants.armorClass) this.notes.push(`${feature.name}: КД без доспеха — в редакторе замените формулу КД на @armor(${grants.armorClass}) + @shield()`)
    if (grants.flag && !this.draft.flags.includes(grants.flag)) this.draft.flags.push(grants.flag)
    if (grants.spellcasting) this.limitedSpellcasting(grants.spellcasting, feature, instance, key)
  }

  //answers for every `choose` grant: from the feature's own ChoiceSpecs of that category, or asked directly
  private chosenProficiencies(feature: AnyFeature, instance: CharacterFeature, key: string): Record<string, string[]> {
    const grants = feature.grants!
    const result: Record<string, string[]> = {}
    const answersOf = (specs: ChoiceSpec[]) => specs.flatMap((spec) => [instance.choices?.[spec.id] ?? []].flat())
    const chooseOf = (grantKey: string) => (grants[grantKey as keyof Grants] as { choose?: { amount: number; from: string[] } } | undefined)?.choose

    //skills: one spec may feed both proficiency and expertise («proficiency, or expertise if already proficient»)
    const skillSpecs = (feature.choices ?? []).filter((spec) => spec.options.from === 'skill')
    const expertiseChoose = chooseOf('expertise'), skillChoose = chooseOf('skillProficiencies')
    if (skillSpecs.length && (expertiseChoose || skillChoose)) {
      if (expertiseChoose && skillChoose) {
        for (const spec of skillSpecs) for (const skill of answersOf([spec])) {
          const proficient = this.draft.skills[skill as keyof typeof skillMap]?.proficiency
          const target = spec.where === 'proficient' ? 'expertise' : spec.where === 'notProficient' || skillSpecs.length > 1 ? 'skillProficiencies'
            : proficient ? 'expertise' : 'skillProficiencies'
          ;(result[target] ||= []).push(skill)
        }
      } else result[expertiseChoose ? 'expertise' : 'skillProficiencies'] = answersOf(skillSpecs)
    }

    for (const grantKey of proficiencyGrants) {
      const choose = chooseOf(grantKey)
      if (!choose || result[grantKey]) continue
      const category = grantCategory[grantKey]
      const specs = (feature.choices ?? []).filter((spec) => spec.options.from === category)
      if (specs.length) {
        result[grantKey] = answersOf(specs).filter((id) => choose.from.includes(id))
        continue
      }
      const answer = this.ask({key: `${key}:grant:${grantKey}`, title: `${feature.name}: выбор`, count: choose.amount, options: this.markOwned(grantKey, optionsOf(category, choose.from))})
      if (answer) result[grantKey] = answer
    }
    return result
  }

  //skills / tools picked through a skillOrTool choice (Skilled)
  private applySkillOrTool(feature: AnyFeature, instance: CharacterFeature) {
    for (const spec of feature.choices ?? []) {
      if (spec.options.from !== 'skillOrTool') continue
      for (const id of [instance.choices?.[spec.id] ?? []].flat()) {
        if (id in skillMap) this.addProficiencies('skillProficiencies', [id])
        else if (id in tools) this.addProficiencies('toolProficiencies', [id])
      }
    }
  }

  //writes ids into the right character list / flags
  addProficiencies(grantKey: string, ids: string[]) {
    const draft = this.draft
    for (const id of ids) {
      if (grantKey === 'skillProficiencies') draft.skills[id as keyof typeof skillMap].proficiency = true
      else if (grantKey === 'expertise') Object.assign(draft.skills[id as keyof typeof skillMap], {proficiency: true, expertise: true})
      else if (grantKey === 'savingThrowProficiencies') draft.savingThrows[id as ENAttribute].proficiency = true
      else {
        const list = (grantKey === 'resistances' ? draft.resistances : grantKey === 'immunities' ? draft.immunities
          : grantKey === 'conditionImmunities' ? draft.conditionImmunities
            : draft.proficiencies[grantKey as keyof typeof draft.proficiencies]) as string[]
        if (!list.includes(id)) list.push(id)
      }
    }
  }

  // ───────────── spells & actions ─────────────

  //casting ability of a feature: the only one, the attribute picked or raised by it, else asked
  private featureAbility(feature: AnyFeature, instance: CharacterFeature, key?: string): ENAttribute | undefined {
    const pool = feature.grants?.spellcasting?.ability
    if (pool?.length === 1) return pool[0]
    const picked = (feature.choices ?? []).filter((spec) => spec.options.from === 'attribute')
      .flatMap((spec) => [instance.choices?.[spec.id] ?? []].flat()) as ENAttribute[]
    const candidates = [...picked, ...(instance.asi ?? [])]
    const inPool = candidates.find((attribute) => !pool || pool.includes(attribute))
    if (inPool || !pool || !key) return inPool
    const answer = this.ask({key: `${key}:castingAbility`, title: `${feature.name}: базовая характеристика`, count: 1, options: optionsOf('attribute', pool)})
    return answer?.[0] as ENAttribute | undefined
  }

  //fixed, chosen and level-gated spells of a limited spellcasting grant
  private limitedSpellcasting(casting: LimitedSpellcasting, feature: AnyFeature, instance: CharacterFeature, key: string) {
    const ability = this.featureAbility(feature, instance, key)
    if (!ability) return
    const freeCast = casting.freeCastResetOn ? {resetsOn: casting.freeCastResetOn, available: true} : undefined
    const {from} = instance
    for (const id of casting.cantrips?.fixed ?? []) this.addSpell(id, ability, from, {alwaysPrepared: true})
    for (const id of casting.spells?.fixed ?? []) this.addSpell(id, ability, from, {alwaysPrepared: true, freeCast})
    const chosenSpells = (feature.choices ?? []).filter((spec) => spec.options.from === 'spell').flatMap((spec) => [instance.choices?.[spec.id] ?? []].flat())
    for (const id of chosenSpells) this.addSpell(id, ability, from, spellList[id]?.level === 0 ? {alwaysPrepared: true} : {alwaysPrepared: true, freeCast})
    this.leveledSpells(casting, instance, ability)
  }

  //always-prepared spells reached at the source's current level
  private leveledSpells(casting: LimitedSpellcasting, instance: CharacterFeature, ability: ENAttribute) {
    const level = this.levelFor(instance.from)
    const freeCast = casting.freeCastResetOn ? {resetsOn: casting.freeCastResetOn, available: true} : undefined
    const byChoice = casting.leveledByChoice
    const chosenList = byChoice ? byChoice.options[[instance.choices?.[byChoice.choice] ?? []].flat()[0] ?? ''] ?? [] : []
    for (const entry of [...(casting.leveled ?? []), ...chosenList]) {
      if (entry.level <= level) this.addSpell(entry.spell, ability, instance.from, {alwaysPrepared: true, freeCast})
    }
  }

  //after a level-up: spells existing features unlock at the new level
  refreshLeveledSpells() {
    for (const instance of this.draft.features) {
      const feature = featureList[instance.featureId]
      const casting = feature?.grants?.spellcasting
      if (!casting || (!casting.leveled && !casting.leveledByChoice)) continue
      const ability = this.featureAbility(feature, instance)
      if (ability) this.leveledSpells(casting, instance, ability)
    }
  }

  //one spell entry per (spell, source); its actions stamped with the ability bound
  addSpell(spellId: string, ability: ENAttribute, from: GrantSource, extra: Partial<CharacterSpell> = {}) {
    const spell = spellList[spellId]
    if (!spell) return this.notes.push(`Нет в справочнике: заклинание ${spellId}`)
    const spells = this.draft.spellcasting.spells
    if (spells.some((entry) => entry.spell === spellId && sourceKey(entry.from) === sourceKey(from))) return
    spells.push({spell: spellId as CharacterSpell['spell'], ability, from, prepared: true, ...extra})
    for (const action of spell.actions ?? []) this.addAction(action, from, ability, spellId)
  }

  //stamped roll with `{ability}` bound; ids suffixed by source so two grants of one spell stay apart
  addAction(action: object, from: GrantSource, ability: ENAttribute | undefined, spellId?: string) {
    const bind = (formula: Formula) => ability ? bindSpellAbility(formula, ability) : formula
    const source = action as CharacterAction & { save?: { difficulty: Formula; onSave?: unknown } }
    const stamped = {...source, from, ...(spellId ? {spell: spellId} : {}), id: `${source.id}@${sourceKey(from)}`} as CharacterAction & Record<string, unknown>
    for (const field of ['attack', 'damage', 'pureRoll'] as const) if (typeof stamped[field] === 'string') stamped[field] = bind(stamped[field] as Formula)
    if (source.save) stamped.save = {...source.save, difficulty: bind(source.save.difficulty)}
    for (const field of ['tiers', 'slots'] as const) {
      const table = stamped[field] as Record<string, Formula> | undefined
      if (table) stamped[field] = Object.fromEntries(Object.entries(table).map(([level, formula]) => [level, bind(formula)]))
    }
    if (!ability && JSON.stringify(stamped).includes('{ability}')) this.notes.push(`${source.name}: не выбрана характеристика — исправьте формулу в редакторе`)
    const actions = this.draft.actions
    const index = actions.findIndex((existing) => existing.id === stamped.id)
    if (index >= 0) actions[index] = stamped
    else actions.push(stamped)
  }

  //resource per (name, source): max as given, current filled when the max is a plain number
  addResource(name: string, max: Formula, resetsOn: ICharacter['resources'][number]['resetsOn'], from: GrantSource) {
    const resources = this.draft.resources
    const value = plainNumber(max)
    const existing = resources.find((resource) => resource.name === name && sourceKey(resource.from) === sourceKey(from))
    if (existing) Object.assign(existing, {max, current: value ?? existing.current, from})
    else resources.push({name, max, resetsOn, current: value ?? 0, from})
  }

  // ───────────── classes ─────────────

  //value of a class / subclass table column at the source's level
  columnValue(source: GrantSource, column: string): number | undefined {
    const level = this.levelFor(source)
    const classId = source.type === 'subclass' ? subclassList[source.id]?.class : source.type === 'class' ? source.id : undefined
    if (!classId || level < 1) return undefined
    const subclassId = this.draft.classes.find((entry) => entry.class === classId)?.subclass
    const table = {...classList[classId]?.table, ...(subclassId ? subclassList[subclassId]?.table : {})}
    return table[column]?.values[level - 1]
  }

  //one more level in a class: hit die, proficiencies (first level), subclass, features, table resources, spells, slots
  addClassLevel(classId: string, startingClass: boolean) {
    const characterClass = classList[classId]
    let entry = this.draft.classes.find((existing) => existing.class === classId)
    if (!entry) {
      entry = {class: classId as ICharacter['classes'][number]['class'], level: 0}
      this.draft.classes.push(entry)
    }
    entry.level += 1
    const level = entry.level
    const from: GrantSource = {type: 'class', id: entry.class, level}
    const key = `class:${classId}:${level}`

    this.draft.hitDice.max[characterClass.hitDie] += 1
    this.draft.hitDice.current[characterClass.hitDie] += 1

    if (level === 1) {
      if (startingClass) for (const attribute of characterClass.savingThrows) this.draft.savingThrows[attribute].proficiency = true
      this.grantProficiencies(startingClass ? characterClass.grants : characterClass.multiclassGrants, `${key}:proficiencies`, characterClass.name)
    }

    if (characterClass.subclassLevels[0] === level && !entry.subclass) {
      const options = Object.values(subclassList).filter((subclass) => subclass.class === classId)
        .map((subclass) => ({id: subclass.id, name: subclass.name, description: subclass.description}))
      const answer = this.ask({key: `${key}:subclass`, title: `${characterClass.name}: подкласс`, count: 1, options})
      if (answer) entry.subclass = answer[0] as never
    }

    characterClass.features.forEach((grant, index) => grant.level === level && this.grantFeature(grant, from, `${key}:${index}`))
    this.growColumnChoices(from, key)
    const subclass = entry.subclass ? subclassList[entry.subclass] : undefined
    const subclassFrom: GrantSource | undefined = subclass && {type: 'subclass', id: entry.subclass!, level}
    if (subclass) subclass.features.forEach((grant, index) => grant.level === level && this.grantFeature(grant, subclassFrom!, `${key}:subclass:${index}`))

    for (const resource of characterClass.resources ?? []) this.tableResource(resource, from)
    for (const resource of subclass?.resources ?? []) this.tableResource(resource, subclassFrom!)

    const casting = characterClass.spellcasting ?? subclass?.spellcasting
    if (casting) this.classSpells(casting, characterClass.spellcasting ? from : subclassFrom!, key, level)
    this.refreshLeveledSpells()
    this.syncSlots()
  }

  //class / multiclass / background proficiencies; `choose` lists asked directly
  grantProficiencies(grants: Class['grants'], key: string, className: string) {
    for (const [grantKey, grant] of Object.entries(grants) as Array<[string, { fixed?: string[]; choose?: { amount: number; from: string[] } }]>) {
      this.addProficiencies(grantKey, grant.fixed ?? [])
      if (!grant.choose) continue
      const options = this.markOwned(grantKey, optionsOf(grantCategory[grantKey], grant.choose.from))
      const answer = this.ask({key: `${key}:${grantKey}`, title: `${className}: владения`, count: grant.choose.amount, options})
      if (answer) this.addProficiencies(grantKey, answer)
    }
  }

  //column-driven choices (invocations, weapon mastery) ask for the extra picks when their column grows
  private growColumnChoices(from: GrantSource, key: string) {
    if (from.type !== 'class') return
    for (const instance of this.draft.features) {
      const rule = columnChoices[instance.featureId]
      if (!rule || sourceKey(instance.from) !== sourceKey(from) || instance.from.type !== 'class' || instance.from.level === from.level) continue
      const target = this.columnValue(from, rule.column) ?? 0
      const current = [instance.choices?.[rule.choice] ?? []].flat()
      if (target <= current.length) continue
      const feature = featureList[instance.featureId]
      const spec = feature.choices?.find((choice) => choice.id === rule.choice)
      if (!spec) continue
      const options = this.choiceOptions(spec, instance, feature).filter((option) => !current.includes(option.id))
      const answer = this.ask({key: `${key}:grow:${instance.featureId}`, title: `${feature.name}: новый выбор`, count: target - current.length, options})
      if (!answer) continue
      instance.choices = {...instance.choices, [rule.choice]: [...current, ...answer]}
      if (spec.options.from === 'feature') for (const subId of answer) this.stampFeature(subId, {type: 'feature', id: instance.featureId}, `${key}:grow:${subId}`)
    }
  }

  //pool sized by a table column (rages, ki…): max follows the column, current refilled
  private tableResource(resource: ClassResource, from: GrantSource) {
    const value = this.columnValue(from, resource.column)
    if (!value) return
    this.addResource(resource.name, String(value) as Formula, resource.resetsOn, from)
  }

  //highest spell level this caster's own progression reaches at its class level
  private maxSpellLevel(progression: ENSpellProgression, level: number): number {
    const row = slotsTable(progression)[level - 1] ?? []
    return row.reduce((highest, slots, index) => slots > 0 ? index + 1 : highest, 0)
  }

  //cantrips / prepared spells up to the table counts; the Wizard fills the spellbook first
  private classSpells(casting: ClassSpellcasting, from: GrantSource, key: string, level: number) {
    const ownSpells = () => this.draft.spellcasting.spells.filter((entry) => sourceKey(entry.from) === sourceKey(from))
    const known = new Set<string>(this.draft.spellcasting.spells.map((entry) => entry.spell))
    const title = nameOf.spellList(casting.list)

    const cantripTarget = casting.cantripsColumn ? this.columnValue(from, casting.cantripsColumn) ?? 0 : 0
    const cantripsNeeded = cantripTarget - ownSpells().filter((entry) => spellList[entry.spell]?.level === 0).length
    if (cantripsNeeded > 0) {
      const options = spellIds({level: 0, classes: [casting.list]}).map((id) => known.has(id) ? {...spellOption(id), disabled: 'уже известно'} : spellOption(id))
      const answer = this.ask({key: `${key}:cantrips`, title: `${title}: заговоры`, count: cantripsNeeded, options, recommended: casting.recommended?.cantrips})
      for (const id of answer ?? []) this.addSpell(id, casting.ability, from, {prepared: true})
    }

    const maxLevel = this.maxSpellLevel(casting.progression, level)
    if (maxLevel < 1) return
    let pool = spellIds({maxLevel, classes: [casting.list]})
    if (casting.spellbook) {
      const book = this.draft.spellcasting.spellbook ??= []
      const add = level === 1 ? casting.spellbook.start : casting.spellbook.perLevel
      const options = pool.filter((id) => !book.includes(id as never)).map(spellOption)
      const answer = this.ask({key: `${key}:spellbook`, title: 'Книга заклинаний: новые заклинания', count: add, options, recommended: casting.recommended?.spells})
      for (const id of answer ?? []) book.push(id as never)
      pool = pool.filter((id) => book.includes(id as never))
    }

    const preparedTarget = this.columnValue(from, casting.preparedColumn) ?? 0
    const preparedNeeded = preparedTarget - ownSpells().filter((entry) => (spellList[entry.spell]?.level ?? 0) > 0 && !entry.alwaysPrepared).length
    if (preparedNeeded > 0) {
      const options = pool.map((id) => known.has(id) ? {...spellOption(id), disabled: 'уже известно'} : spellOption(id))
      const answer = this.ask({key: `${key}:prepared`, title: `${title}: подготовленные заклинания`, count: preparedNeeded, options, recommended: casting.recommended?.spells})
      for (const id of answer ?? []) this.addSpell(id, casting.ability, from, {prepared: true})
    }
    if (casting.swapOn === 'levelUp' && level > 1) this.notes.push(`${title}: при повышении уровня можно заменить одно заклинание — в редакторе`)
  }

  //slot maxima from every caster class (2024 multiclass: half round up, third round down); Pact Magic apart
  syncSlots() {
    const casters = this.draft.classes.flatMap((entry) => {
      const casting = classList[entry.class]?.spellcasting ?? (entry.subclass ? subclassList[entry.subclass]?.spellcasting : undefined)
      return casting ? [{level: entry.level, progression: casting.progression}] : []
    })
    const shared = casters.filter((caster) => caster.progression !== 'warlock')
    const rows: number[] = shared.length === 1
      ? slotsTable(shared[0].progression)[shared[0].level - 1] ?? []
      : (() => {
        const effective = shared.reduce((total, caster) => total + (caster.progression === 'half' ? Math.ceil(caster.level / 2)
          : caster.progression === 'third' ? Math.floor(caster.level / 3) : caster.level), 0)
        return Array.from({length: 9}, (_, index) => effective ? fullSlots(index + 1, effective) : 0)
      })()

    const slots = this.draft.spellcasting.slots
    for (let slotLevel = 1; slotLevel <= 9; slotLevel++) {
      const max = rows[slotLevel - 1] ?? 0
      const level = slotLevel as keyof typeof slots
      const previous = slots[level]
      const previousMax = plainNumber(previous?.max ?? '0') ?? 0
      slots[level] = {max: String(max) as Formula, current: Math.max(0, (previous?.current ?? 0) + max - previousMax)}
    }

    const warlock = this.classLevel('warlock')
    if (warlock > 0) {
      const row = slotsTable('warlock')[warlock - 1]
      const pactLevel = row.findIndex((count) => count > 0) + 1
      const count = row[pactLevel - 1]
      const previous = this.draft.spellcasting.pactSlots
      const previousMax = plainNumber(previous?.max ?? '0') ?? 0
      this.draft.spellcasting.pactSlots = {level: pactLevel as never, max: String(count) as Formula, current: Math.max(0, (previous?.current ?? 0) + count - previousMax)}
    }
  }

  // ───────────── equipment ─────────────

  //one of the A / B / gold options: items (packs expanded, «choose one» asked) into the inventory, coins into the purse
  startingEquipment(options: StartingEquipment[], key: string, title: string) {
    const describe = (option: StartingEquipment) => [
      ...option.items.map((item) => 'bundle' in item ? (bundles[item.bundle]?.name ?? item.bundle)
        : 'choose' in item ? `на выбор: ${item.choose.length} вариантов` : `${nameOf.item(item.item)}${item.quantity ? ` ×${item.quantity}` : ''}`),
      option.gold ? `${option.gold / 100} ЗМ` : ''
    ].filter(Boolean).join(', ')
    const letters = 'АБВГ'
    const answer = this.ask({key, title, count: 1, options: options.map((option, index) => ({id: String(index), name: `Вариант ${letters[index]}`, description: describe(option)}))})
    if (!answer) return
    const option = options[Number(answer[0])]
    option.items.forEach((item, index) => {
      if ('bundle' in item) for (const member of bundles[item.bundle]?.items ?? []) this.addItem(member.id, member.qty)
      else if ('choose' in item) {
        const sameAsTool = item.sameAsTool ? item.choose.filter((id) => this.draft.proficiencies.toolProficiencies.includes(id as never)) : []
        const pick = sameAsTool.length === 1 ? sameAsTool : this.ask({key: `${key}:choose:${index}`, title: `${title}: предмет на выбор`, count: 1, options: item.choose.map((id) => ({id, name: nameOf.item(id)}))})
        if (pick) this.addItem(pick[0], item.quantity ?? 1)
      } else this.addItem(item.item, item.quantity ?? 1, item.note)
    })
    this.draft.currency.copper += option.gold % 100
    this.draft.currency.gold += Math.floor(option.gold / 100)
  }

  //stack by item id (when no note), else a new entry with a deterministic unique id
  addItem(itemId: string, quantity: number, note?: string) {
    const inventory = this.draft.inventory
    const stack = !note && inventory.find((entry) => entry.item === itemId && !entry.note)
    if (stack) return void (stack.quantity += quantity)
    let suffix = inventory.length
    while (inventory.some((entry) => entry.id === `${itemId}-${suffix}`)) suffix++
    inventory.push({id: `${itemId}-${suffix}`, item: itemId as never, quantity, ...(note ? {note} : {})})
  }
}

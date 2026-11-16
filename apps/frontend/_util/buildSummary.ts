//Printable preview of a builder draft (server side): names instead of ids, grouped like the sheet.
import {ICharacter} from "@frontend/deps/interfaces/DB/Character"
import {attributeMap, ENAttribute} from "@frontend/deps/types/Attribute"
import {skillMap} from "@frontend/deps/types/Skill"
import {languageMap} from "@frontend/deps/types/Character"
import {damageTypeMap} from "@frontend/deps/types/Damage"
import {typedKeys} from "@frontend/deps/_util/translationMap"
import {armorName, attributeName, backgroundName, className, featureName, itemName, raceName, senseNames, sourceLabel, speedNames, spellName, spellOf, subclassName} from "@frontend/_util/rulebook"
import {choiceAnswerName} from "@frontend/deps/builder/_index"

export interface Summary {
  title: string
  attributes: Array<{ name: string; value: number; save: boolean }>
  lines: Array<{ label: string; value: string }>
  features: Array<{ name: string; source: string; picks: string }>
  spells: Array<{ name: string; level: number; source: string }>
  inventory: string[]
}

export function summarize(character: ICharacter): Summary {
  const classes = character.classes.map((entry) => `${className(entry.class)}${entry.subclass ? ` (${subclassName(entry.subclass)})` : ''} ${entry.level}`).join(' / ')
  const skills = typedKeys(skillMap).filter((skill) => character.skills[skill].proficiency)
    .map((skill) => `${skillMap[skill]}${character.skills[skill].expertise ? ' (экспертность)' : ''}`)
  const slots = Object.entries(character.spellcasting.slots).filter(([, slot]) => slot && slot.max !== '0').map(([level, slot]) => `${level}: ${slot!.max}`)
  const {proficiencies} = character

  const lines = [
    {label: 'Происхождение', value: [character.race && raceName(character.race), character.background && backgroundName(character.background)].filter(Boolean).join(' · ')},
    {label: 'Хиты', value: `${character.hitPoints.current} (кости: ${Object.entries(character.hitDice.max).filter(([, count]) => count).map(([die, count]) => `${count}к${die}`).join(', ')})`},
    {label: 'Скорость', value: Object.entries(character.speed).filter(([, value]) => value).map(([type, value]) => `${speedNames[type] ?? type} ${value}`).join(', ')},
    {label: 'Навыки', value: skills.join(', ')},
    {label: 'Доспехи', value: proficiencies.armorProficiencies.map(armorName).join(', ')},
    {label: 'Оружие', value: proficiencies.weaponProficiencies.length > 12 ? `${proficiencies.weaponProficiencies.length} видов` : proficiencies.weaponProficiencies.map(itemName).join(', ')},
    {label: 'Инструменты', value: proficiencies.toolProficiencies.map(itemName).join(', ')},
    {label: 'Языки', value: proficiencies.languageProficiencies.map((language) => languageMap[language] ?? language).join(', ')},
    {label: 'Сопротивления', value: character.resistances.map((type) => damageTypeMap[type]).join(', ')},
    {label: 'Чувства', value: Object.entries(character.senses).filter(([, range]) => range).map(([sense, range]) => `${senseNames[sense] ?? sense} ${range} фт.`).join(', ')},
    {label: 'Ячейки', value: [...slots, character.spellcasting.pactSlots ? `договор ${character.spellcasting.pactSlots.level} ур. ×${character.spellcasting.pactSlots.max}` : ''].filter(Boolean).join(' · ')},
    {label: 'Ресурсы', value: character.resources.map((resource) => `${resource.name} ${resource.max}`).join(', ')},
    {label: 'Монеты', value: `${character.currency.gold} ЗМ ${character.currency.silver} СМ ${character.currency.copper} ММ`}
  ].filter((line) => line.value)

  return {
    title: `${character.name === 'not_init' ? 'Новый персонаж' : character.name}${classes ? ` — ${classes}` : ''}`,
    attributes: (Object.keys(attributeMap) as ENAttribute[]).map((attribute) => ({name: attributeName(attribute), value: character.attributes[attribute].value, save: character.savingThrows[attribute].proficiency})),
    lines,
    features: character.features.map((instance) => ({name: featureName(instance.featureId), source: sourceLabel(instance.from),
      picks: Object.entries(instance.choices ?? {}).flatMap(([choiceId, ids]) => [ids].flat().map((id) => choiceAnswerName(instance.featureId, choiceId, id))).join(', ')})),
    spells: character.spellcasting.spells.map((entry) => ({name: spellName(entry.spell), level: spellOf(entry.spell)?.level ?? 0, source: sourceLabel(entry.from)}))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
    inventory: character.inventory.map((entry) => `${itemName(entry.item)}${entry.quantity > 1 ? ` ×${entry.quantity}` : ''}`)
  }
}

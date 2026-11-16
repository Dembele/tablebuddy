import {attributeMap} from "../Attribute"
import {typedKeys} from "../../_util/translationMap"
import {skillMap} from "../Skill"
import {hitDiceArray} from "../Character"
import {typedFromEntries} from "../../_util/translationMap"

export type RollType = keyof typeof rollTypeToTitleMap

export const rollTypeToTitleMap = {
  'initiative': 'Инициатива',
  'save.death': 'Спасбросок от смерти',
  'attack': 'Атака',
  'spell': 'Заклинание',
  'feature': 'Умение',

  ...typedFromEntries(typedKeys(attributeMap).map(attr => [`save.${attr}`, `Спасбросок ${attributeMap[attr]}`] as const)),
  ...typedFromEntries(typedKeys(skillMap).map(skill => [`skill.${skill}`, `Проверка ${skillMap[skill]}`] as const)),
  ...typedFromEntries(hitDiceArray.map(die => [`hitDie.${die}`, 'Кость здоровья'] as const))
}
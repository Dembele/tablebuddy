//Registry option lists the editor needs, built on the server so the client never loads the full rulebook.
import {classes} from "@frontend/deps/data/loader"
import {subclasses} from "@frontend/deps/data/loader"
import {races} from "@frontend/deps/data/loader"
import {backgrounds} from "@frontend/deps/data/loader"
import {equipmentSlotMap} from "@frontend/deps/types/book/items"
import {items} from "@frontend/deps/data/loader"
import {tools} from "@frontend/deps/data/loader"
import {basicWeapon} from "@frontend/deps/data/loader"
import {armorClassMap} from "@frontend/deps/types/book/items"
import {languageMap} from "@frontend/deps/types/Character"
import {damageTypeMap} from "@frontend/deps/types/Damage"
import {conditionMap} from "@frontend/deps/types/Condition"
import {sizeMap} from "@frontend/deps/types/Race"
import {EvaluatedCharacter, ICharacter} from "@frontend/deps/interfaces/DB/Character"
import {featureName, spellName} from "@frontend/_util/rulebook"
import {baseChoices} from "@frontend/deps/rules/items"
import type {Option} from "@frontend/components/Character/editor/fields"

export interface EditorOptions {
  races: Option[]
  backgrounds: Option[]
  sizes: Option[]
  classes: Option[]
  subclasses: Array<Option & { class: string }>
  items: Option[]
  bases: Record<string, string[]>  //magic item id → ids of the mundane items it may be built on (names in `items`)
  slots: Option[]
  weapons: Option[]
  armor: Option[]
  tools: Option[]
  languages: Option[]
  damageTypes: Option[]
  conditions: Option[]
  names: Record<string, string> //names of features / spells already on this character
  isDM: boolean                 //DM-only controls (clearing a roll)
  maxima: {                     //evaluated caps for the counters the editor shows (stored caps are formulas)
    hitPoints?: number
    slots: Partial<Record<number, number>>
    pactSlots?: number
    resources: number[]         //by index in character.resources
  }
}

const fromRegistry = (registry: Record<string, { name: string }>): Option[] =>
  Object.entries(registry).map(([id, entry]) => ({id, name: entry.name})).sort((a, b) => a.name.localeCompare(b.name))
const fromMap = (map: Record<string, string>): Option[] => Object.entries(map).map(([id, name]) => ({id, name}))

export function editorOptions(character: ICharacter, isDM: boolean, evaluated?: EvaluatedCharacter | null): EditorOptions {
  const names: Record<string, string> = {}
  for (const feature of character.features) names[feature.featureId] = featureName(feature.featureId)
  for (const entry of character.spellcasting.spells) names[entry.spell] = spellName(entry.spell)

  return {
    races: fromRegistry(races),
    backgrounds: fromRegistry(backgrounds),
    sizes: fromMap(sizeMap),
    classes: fromRegistry(classes),
    subclasses: Object.values(subclasses).map((subclass) => ({id: subclass.id, name: subclass.name, class: subclass.class})),
    items: fromRegistry(items),
    bases: Object.fromEntries(Object.keys(items).map((id) => [id, baseChoices(id)]).filter(([, choices]) => choices.length)),
    slots: fromMap(equipmentSlotMap),
    weapons: fromRegistry(basicWeapon),
    armor: fromMap(armorClassMap),
    tools: fromRegistry(tools),
    languages: fromMap(languageMap),
    damageTypes: fromMap(damageTypeMap),
    conditions: fromMap(conditionMap),
    names,
    isDM,
    maxima: {
      hitPoints: evaluated?.hitPoints.max,
      slots: Object.fromEntries(Object.entries(evaluated?.spellcasting.slots ?? {}).map(([level, slot]) => [level, slot?.max ?? 0])),
      pactSlots: evaluated?.spellcasting.pactSlots?.max,
      resources: (evaluated?.resources ?? []).map((resource) => resource.max)
    }
  }
}

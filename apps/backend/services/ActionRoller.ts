//Assisted roller: rolls a stamped character action with the character's context. Results only — nothing is applied.
import {CharacterAction} from "@backend/deps/interfaces/DB/Character"
import {RollContent} from "@backend/deps/interfaces/DB/Chat"
import {Formula} from "@backend/deps/types/internal/Formula"
import {actionReminders} from "@backend/deps/types/Hook"
import {subclasses, SubclassId} from "@backend/deps/data/loader"
import {evaluator} from "@backend/services/Evaluator"
import {CharacterAPI} from "@backend/services/Character"

//level a tiered action scales with: class level for class/subclass features, character level for spells and the rest
function scalingLevel(action: CharacterAction, character: Pick<CharacterAPI, 'classes'>): number {
  const totalLevel = character.classes.reduce((total, entry) => total + entry.level, 0)
  const {from} = action
  const classId = from.type === 'class' ? from.id : from.type === 'subclass' ? subclasses[from.id as SubclassId].class : null
  if (!classId || action.spell) return totalLevel
  return character.classes.find(entry => entry.class === classId)?.level ?? 0
}

//base formula, replaced by the upcast slot entry or the highest reached tier
export function pickFormula(action: CharacterAction, base: Formula, character: Pick<CharacterAPI, 'classes'>, slot?: number): Formula {
  const upcast = slot !== undefined ? action.slots?.[slot as keyof typeof action.slots] : undefined
  if (upcast) return upcast
  const level = scalingLevel(action, character)
  const reached = Object.keys(action.tiers ?? {}).map(Number).filter(tier => tier <= level).sort((a, b) => b - a)[0]
  return reached !== undefined ? action.tiers![reached]! : base
}

export function rollAction(action: CharacterAction, character: CharacterAPI, slot?: number): RollContent {
  const content: RollContent = {action: {id: action.id, name: action.name, from: action.from, slot}, rolls: [], hook: actionReminders(action.hook).join('\n') || undefined}

  if ('attack' in action && action.attack)
    content.rolls.push({label: 'attack', output: evaluator.eval(action.attack, {character, rollType: 'attack'})})
  if ('damage' in action)
    content.rolls.push({label: 'damage', output: evaluator.eval(pickFormula(action, action.damage, character, slot), {character})})
  if ('pureRoll' in action)
    content.rolls.push({label: 'roll', output: evaluator.eval(pickFormula(action, action.pureRoll, character, slot), {character})})
  if ('save' in action && action.save)
    content.save = {
      attribute: action.save.attribute,
      difficulty: evaluator.eval(action.save.difficulty, {character}).total,
      onSave: action.save.onSave
    }

  return content
}

//Formula functions (`@name(args)`): read-only lookups over the roll context, resolved by the engine.
import {RollContext} from "@backend/services/Evaluator"
import {getClass, ClassId} from "@backend/deps/data/loader"
import {entryArmor} from "@backend/deps/rules/items"
import {resolveReferences} from "@backend/_util/characterUtils"
import {safeEvaluate} from "@backend/_util/safeEvaluate"

type DiceFunction = (context: RollContext, ...params: string[]) => number | string

//classes of the context character, or an error when there is none
const classesOf = (context: RollContext) => {
  if (!context.character) throw new Error("Missing character context")
  return context.character.classes
}

//equipped armor of one kind (body or shield): its AC formula worked out against the character, plus the magic bonus
const wornArmor = (context: RollContext, shield: boolean) => {
  if (!context.character) throw new Error("Missing character context")
  const worn = context.character.inventory.filter((entry) => entry.equipped && entry.quantity > 0).map(entryArmor)
    .find((piece) => piece && (piece.armorClass === 'shield') === shield)
  return worn && Number(safeEvaluate(resolveReferences(worn.AC, context))) + worn.bonus
}

export const functionRegistry: Record<string, DiceFunction> = {
  //@level() = total character level; @level(fighter) = levels in that class (by class id)
  level: (context, classId?: string) => {
    const classes = classesOf(context)
    if (classId) return classes.find(entry => entry.class === classId)?.level ?? 0
    return classes.reduce((total, entry) => total + entry.level, 0)
  },

  //@startingHitDie() = hit die faces of the starting class (classes[0]), 0 without a class
  startingHitDie: (context) => {
    const [startingClass] = classesOf(context)
    return startingClass ? Number(getClass(startingClass.class as ClassId).hitDie) : 0
  },

  //@armor(unarmored) = AC of the equipped body armor (own formula + magic bonus); without one the value given, default 10 + DEX
  armor: (context, unarmored?: string) => wornArmor(context, false)
    ?? (unarmored ? Number(unarmored) : Number(safeEvaluate(resolveReferences('10 + {character.attributes.dexterity.modifier}', context)))),

  //@shield() = AC bonus of the equipped shield (+2, plus a magic bonus), 0 without one
  shield: (context) => wornArmor(context, true) ?? 0
}

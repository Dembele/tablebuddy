//Spell formula templates. Kept apart from _index.ts so category files import values without an import cycle.
//`{ability}` is the only template token: bound once when a spell is stamped onto a character, never re-bound after.

import {ENAttribute} from "../types/Attribute"
import {Formula} from "../types/internal/Formula"

export const SPELL_ABILITY = '{ability}'

export const spellAttack = `1d20 + ${SPELL_ABILITY} + {character.proficiency} + {character.spellcasting.attackBonus}` as Formula
export const spellSaveDC = `8 + ${SPELL_ABILITY} + {character.proficiency} + {character.spellcasting.dcBonus}` as Formula

//Turns a spell formula into sheet text for a known casting ability.
export function bindSpellAbility(formula: Formula, ability: ENAttribute): Formula {
  return formula.replaceAll(SPELL_ABILITY, `{character.attributes.${ability}.modifier}`) as Formula
}

//Request choices for sheet buttons, computed on the server from the evaluated snapshot (rules/costs reads the rulebook).
import 'server-only'
import {CharacterAction, CharacterSpell, EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import {costOptions, hitDieOptions} from "@frontend/deps/rules/costs"
import type {SubjectChoice} from "@frontend/components/Room/RequestButton"

//one choice per cost the character can pay for this action now
export const actionChoices = (character: EvaluatedCharacter, action: CharacterAction): SubjectChoice[] =>
  costOptions(character, action).map((option) => ({label: option.label, subject: {kind: 'action', actionId: action.id, cost: option.cost}}))

//a spell without a roll of its own: cast it, paying with a slot / free cast
export const castChoices = (character: EvaluatedCharacter, entry: Pick<CharacterSpell, 'spell' | 'from'>): SubjectChoice[] =>
  costOptions(character, entry).map((option) => ({label: option.label, subject: {kind: 'cast', spell: entry.spell, from: entry.from, cost: option.cost}}))

//one choice per die kind left
export const hitDieChoices = (character: EvaluatedCharacter): SubjectChoice[] =>
  hitDieOptions(character).flatMap((option) => option.cost.kind === 'hitDie' ? [{label: option.label, subject: {kind: 'hitDie', die: option.cost.die}}] : [])

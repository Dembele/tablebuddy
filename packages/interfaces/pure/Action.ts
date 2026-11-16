// An action answers exactly one question: what gets rolled, as base defaults without modifiers.
// When it rolls and what the result does is out of scope — that's DM territory.
import {ENAttribute} from "../../types/Attribute"
import {Formula} from "../../types/internal/Formula"
import {Hooks} from "../../types/Hook"

interface Base {
  id: string
  name: string
  description?: string
  hook?: Hooks //print something?
}

export interface Attack extends Base {
  // present ⇒ this action rolls an attack; the formula is how to roll it
  attack?: Formula
  // if the DM says hit (or the effect applies): how to roll damage
  damage: Formula
}

export interface Check extends Base {
  damage: Formula
  save?: {
    attribute: ENAttribute
    difficulty: Formula
    // what a successful save does to the damage; 'none' = damage only on fail
    onSave?: 'full' | 'half' | 'none' | Formula
  }
}

export interface ContextRoll extends Base {
  pureRoll: Formula
}

export type Action = Attack | Check | ContextRoll
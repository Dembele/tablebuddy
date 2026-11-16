//What a book is: one ruleset source (the 2024 core, an expansion, homebrew) as plain registries keyed by id. A book is data only —
//it lives in data/<book>/_book.ts and exports `book`; the loader (data/loader) merges every installed book and serves the result.

import {Ammo, Armor, Bundle, Consumable, FocusItem, Gear, Junk, MagicItem, RangedWeapon, Tool, Weapon} from "./items"
import {Spell} from "./spells"
import {Feature} from "./features"
import {Class, Subclass} from "./classes"
import {Background, Race} from "./origins"
import {Monster} from "./monsters"

export interface Book {
  id: string                                                                                                            //folder name: 'core', 'xanathar'…
  name: string
  items: {
    armor: Record<string, Armor>
    weapons: Record<string, Weapon | RangedWeapon>                                                                      //mundane weapons: their ids are the weapon types proficiencies name
    tools: Record<string, Tool>
    ammo: Record<string, Ammo>
    consumables: Record<string, Consumable>
    focus: Record<string, FocusItem>
    gear: Record<string, Gear>
    junk: Record<string, Junk>                                                                                          //narrative loot
    magic: Record<string, MagicItem>
  }
  bundles: Record<string, Bundle>                                                                                       //equipment packs, never items
  spells: Record<string, Spell>
  features: Record<string, Feature>
  classes: Record<string, Class>
  subclasses: Record<string, Subclass>
  backgrounds: Record<string, Background>
  races: Record<string, Race>
  monsters: Record<string, Monster>
}

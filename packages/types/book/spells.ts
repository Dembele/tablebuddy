//What a spell is, and the spell vocabularies (casting times, areas). Meta fields (time, range, area, components, duration) are
//display-only — the engine never reads them (Doctrine). Formula templates and slot tables are mechanics: rules/spellFormulas, rules/spellSlots.

import {ENSpellSchool, SpellLevel} from "../Spell"
import {ENClass} from "../Class"
import {Formula} from "../internal/Formula"
import {Hooks} from "../Hook"
import {Action} from "../../interfaces/pure/Action"

export const castingTimeMap = {
  action: 'Действие',
  bonusAction: 'Бонусное действие',
  reaction: 'Реакция',
  minute: 'Минута',
  tenMinutes: '10 минут',
  hour: 'Час',
  eightHours: '8 часов',
  twelveHours: '12 часов',
  day: '24 часа'
} as const

export const spellAreaMap = {
  sphere: 'Сфера',
  cube: 'Куб',
  cone: 'Конус',
  cylinder: 'Цилиндр',
  line: 'Линия',
  emanation: 'Эманация'
} as const

export type ENCastingTime = keyof typeof castingTimeMap
export type RUCastingTime = typeof castingTimeMap[ENCastingTime]
export type ENSpellArea = keyof typeof spellAreaMap
export type RUSpellArea = typeof spellAreaMap[ENSpellArea]

//cantrip damage tier: the builder swaps an action's damage at these total character levels (level-up is a human commit)
export type CantripTierLevel = 5 | 11 | 17

//upcast: slot level the spell is cast with (2–9); the roller picks the formula for the chosen slot (human input at cast)
export type SlotLevel = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type SpellAction = Action & {
  tiers?: Partial<Record<CantripTierLevel, Formula>>                                                                    //cantrips: replaces `damage` from that character level on
  slots?: Partial<Record<SlotLevel, Formula>>                                                                           //leveled: replaces `damage` / `pureRoll` when cast with that slot
}

export interface Spell {
  id: string                                                                                                            //IMPORTANT: same as object key
  name: string
  description: string
  level: SpellLevel                                                                                                     //0 = cantrip
  school: ENSpellSchool
  classes: ENClass[]
  source: string

  castingTime: ENCastingTime
  castingNote?: string                                                                                                  //reaction trigger / alternate time, as printed
  ritual?: boolean
  range: number | 'self' | 'touch' | 'sight' | 'unlimited' | 'special'                                                  //feet (miles converted)
  area?: { shape: ENSpellArea; size: number }                                                                           //feet: radius / edge / length
  components: {
    verbal?: boolean
    somatic?: boolean
    material?: string                                                                                                   //text as printed
    consumed?: boolean
    cost?: number                                                                                                       //copper
  }
  duration: { concentration?: boolean; upTo?: boolean; units: 'instant' | 'rounds' | 'minutes' | 'hours' | 'days' | 'untilDispelled' | 'special'; value?: number }

  upgrade?: string                                                                                                      //«Усиление заговора» / «На более высоких уровнях» as printed
  actions?: SpellAction[]                                                                                               //active rolls only; utility spells have none
  hooks?: Hooks
}

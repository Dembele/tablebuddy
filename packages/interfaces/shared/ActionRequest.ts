//A player's (or the DM's) request waiting for the DM's verdict (Doctrine): what is asked, what it spends, the dice rolled at request time.
//Kept in memory per campaign room; `content` (the dice) goes to the DM only.

import {Cost} from "../../rules/costs"
import {RollContent} from "../DB/Chat"
import {GrantSource} from "../DB/Character"
import {RollType} from "../../types/internal/RollType"
import {HitDice} from "../../types/Character"
import {SpellId} from "../../data/loader"

export type RequestSubject =
  | { kind: 'action'; actionId: string; cost: Cost }                                                                    //stamped action (attack, spell roll, feature)
  | { kind: 'cast'; spell: SpellId; from: GrantSource; cost: Cost }                                                     //a spell with no roll of its own (Shield, Sleep…)
  | { kind: 'check'; rollType: RollType }                                                                               //skill, save, initiative, death save
  | { kind: 'hitDie'; die: HitDice }                                                                                    //short-rest healing roll, spends the die
  | { kind: 'rest'; rest: 'short' | 'long' }
  | { kind: 'resource'; name: string; from: GrantSource }                                                               //one use of a pool with no roll of its own (Rage, Innate Sorcery)
  | { kind: 'recover' }                                                                                                 //pick up fired ammo after a fight
  | { kind: 'formula'; formula: string }                                                                                //free roll

export type Verdict = 'allow' | 'fail' | 'deny'

export interface ActionRequest {
  id: string
  characterId: string
  character: { name: string; avatar?: string }
  requester: { id: string; username: string; role: 'ГМ' | 'Игрок' }
  subject: RequestSubject
  title: string                                                                                                         //"Огненный шар", "Проверка Атлетики", "Короткий отдых"
  costLabel?: string                                                                                                    //what the verdict will spend
  warnings: string[]                                                                                                    //for the DM: unprepared spell, …
  content?: RollContent                                                                                                 //DM only
  createdAt: number
}

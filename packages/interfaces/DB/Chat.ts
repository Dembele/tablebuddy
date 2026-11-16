//Stays in DB

import {ObjectId} from "../../types/internal/ObjectId"
import {UserSafe} from "./User"
import {GrantSource, ICharacter, Override} from "./Character"
import {RollOutput} from "../../types/internal/Dice"
import {RollType} from "../../types/internal/RollType"
import {ENAttribute} from "../../types/Attribute"

export type IChatMessage = {
  _id: ObjectId;
  type: 'system' | 'roll' | 'chat';
  title?: string;
  sender: UserSafe['_id'];
  introduceAsCharacter?: ICharacter['_id']
  content: string | RollContent;
  timestamp: Date;
  campaignId: ObjectId;
}
//what a roll message carries: results only — applying them is the DM's call (Doctrine)
export interface RollContent {
  rollType?: RollType                                                                                                   //sheet roll (skill, save, initiative, hit die)
  formula?: string                                                                                                      //free roll (/roll 2d6+3)
  action?: { id: string; name: string; from: GrantSource; slot?: number }                                               //character action, upcast slot if any
  rolls: Array<{ label: 'roll' | 'attack' | 'damage'; output: RollOutput }>
  save?: { attribute: ENAttribute; difficulty: number; onSave?: string }                                                //targets roll it themselves
  hook?: string                                                                                                         //reminders printed with the roll, one per line (action.hook onUse / onEffect)
  title?: string                                                                                                        //what was asked (request title)
  cost?: string                                                                                                         //what the verdict spent
  rest?: 'short' | 'long'                                                                                               //an allowed rest: resets applied
  failed?: boolean                                                                                                      //DM verdict "fail": costs spent, result void (counterspelled, dropped)
}

export type FChatMessage = Override<IChatMessage, {
  sender: Pick<UserSafe, '_id' | 'username' | 'role'>
  introduceAsCharacter?: Pick<ICharacter, '_id' | 'name' | 'avatar'>
}>
export type SystemMessage = Override<FChatMessage, {
  _id?: never,
  type: 'system'
  title?: never
  sender?: never
  introduceAsCharacter?: never
  content: string
  timestamp?: never
  campaignId?: never
}>


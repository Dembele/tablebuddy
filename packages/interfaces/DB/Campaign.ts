//stays in DB

import {UserSafe} from "./User"
import {TurnOrder} from "../shared/TurnOrder"
import {IMap} from "./Map"
import {ObjectId} from "../../types/internal/ObjectId"
import {ShopState} from "../shared/Shop"

interface CampaignBase {
  _id: ObjectId
  name: string
  description: string
  image: string | null
  status: 'В процессе' | 'На паузе' | 'Завершена'
}

export interface ICampaign extends CampaignBase {
  players: Array<ObjectId>
  currentMap: ObjectId | null
  availableMaps: ObjectId[]
  turnOrder?: TurnOrder                                                                                                 //initiative list the DM keeps (rules/turns)
  shop?: ShopState                                                                                                      //the shop the DM opens, stock rolled (rules/shop)
}

export interface FCampaign extends CampaignBase {
  players: Array<UserSafe>
  currentMap: IMap | null
  availableMaps: IMap
  turnOrder?: TurnOrder
}

export interface Campaign {
  _id: ICampaign['_id'];
  name: ICampaign['name'];
  description?: ICampaign['description'];
  image?: ICampaign['image'];
  status: ICampaign['status'];
  playerCount: number; //reduced from array
  createdAt: string //converted from date
}
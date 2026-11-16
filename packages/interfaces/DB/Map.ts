import {ICampaign} from "./Campaign"
import {IToken} from "./Token"
import {ObjectId} from "../../types/internal/ObjectId"
import {MonsterId} from "../../data/loader"

export const LayerMap = {
  'BG': 0,
  'PLAYER': 1,
  'FOW': 2,
  'DM': 3,
  'TEMP': 4
} as const

//a library map's monster token: imported as a numbered copy of the campaign's template for that monster
export interface MonsterPlacement {
  monster: MonsterId
  position: { x: number, y: number }
  visible: boolean
}

interface MapBase {
  _id: ObjectId
  name: string
  description: string
  backgroundImagePath: string
  thumbnailPath?: string
  gridType: 'square' | 'none'
  gridConfig: {
    size: {x: number, y: number}
    color: string
    offset: { top: number, bottom: number, right: number, left: number }
    cellSize: { x: number, y: number }
    feats: number
    opacity?: number
  }
  isTemplate: boolean                                                                                                   //library map: no campaign, shared by every DM, imported as a copy
  fogOfWar?: {
    enabled: boolean
    exploredAreas: string
  }
  tokens: Array<IToken>
  placements?: Array<MonsterPlacement>                                                                                  //library maps only
}

export interface IMap extends MapBase {
  campaign?: ObjectId
}

export interface FMap extends MapBase {
  campaign?: ICampaign
}

export type Map = Pick<MapBase, '_id' | 'name' | 'description' | 'backgroundImagePath'> & { campaign: ICampaign }
import mongoose, {Model, model, Schema, SchemaDefinition} from 'mongoose'
import {ICampaign} from "@backend/deps/interfaces/DB/Campaign"
import {createSchema} from "@backend/_util/dbMinify"

//initiative list (interfaces/shared/TurnOrder): written whole by the room, read through rules/turns.readTurnOrder
const TurnOrderEntryDef = {
  id: {type: String, required: true},
  characterId: String,
  name: String,
  initiative: {type: Number, default: null},
  hidden: {type: Boolean, default: false}
}

const TurnOrderDef = {
  round: {type: Number, default: 1},
  current: {type: String, default: null},
  entries: [TurnOrderEntryDef]
}

const CampaignDef: SchemaDefinition<ICampaign> = {
  name: {type: String, required: true, unique: true},
  description: {type: String, default: ''},
  players: {type: [{type: Schema.Types.ObjectId, ref: 'User', required: true}], default: []},
  image: {type: String, default: null}, //cover path under /api/campaigns/<id>/, null = none
  status: {type: String, enum: ['В процессе', 'На паузе', 'Завершена'], default: 'В процессе'},
  currentMap: {type: Schema.Types.ObjectId, ref: 'Map', default: null},
  availableMaps: {type: [{type: Schema.Types.ObjectId, ref: 'Map'}], default: []},
  turnOrder: TurnOrderDef,
  shop: {type: Schema.Types.Mixed, default: undefined}                                                                  //ShopState, written whole by the room
}

const CampaignSchema = createSchema<ICampaign>(CampaignDef, {timestamps: true})

// Indexes
CampaignSchema.index({name: 'text'})
CampaignSchema.index({'players.user': 1})
CampaignSchema.index({status: 1})

export const Campaign: Model<ICampaign> = mongoose.models.Campaign || model<ICampaign>('Campaign', CampaignSchema)
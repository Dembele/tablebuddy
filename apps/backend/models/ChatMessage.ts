import mongoose, {model, Model, Schema, SchemaDefinition} from "mongoose"
import {IChatMessage} from "@backend/deps/interfaces/DB/Chat"
import {createSchema} from "@backend/_util/dbMinify"

const ChatDef: SchemaDefinition<IChatMessage> = {
  type: {
    type: String,
    enum: ['system', 'combat', 'roll', 'chat']
  },
  introduceAsCharacter: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  title: String,
  content: Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now
  },
  campaignId: {
    type: Schema.Types.ObjectId,
    ref: 'Campaign'
  }
}

const ChatSchema = createSchema<IChatMessage>(ChatDef)
ChatSchema.index({campaignId: 1, timestamp: -1})                                                                       //room history: latest messages of a campaign

export const Chat: Model<IChatMessage> = mongoose.models.Chat || model<IChatMessage>('Chat', ChatSchema);

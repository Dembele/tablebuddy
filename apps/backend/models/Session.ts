import mongoose, {Schema, Model, model, Document, SchemaDefinition} from 'mongoose'
import {randomBytes} from 'node:crypto'
import {ISession} from "@backend/deps/interfaces/DB/Session"
import {createSchema} from "@backend/_util/dbMinify"

const SessionDef: SchemaDefinition<ISession> = {
  token: {
    type: String,
    unique: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expires: {
    type: Date,
    default: () => new Date(Date.now() + parseInt(process.env['SESS_LIFETIME'] || '86400000')),
    index: { expires: 0 }
  }
}

const SessionSchema = createSchema<ISession>(SessionDef, {timestamps: true})

// Pre-save hook to generate token before saving
SessionSchema.pre<ISession & Document>('save', async function() {
  if (!this.isNew) return // Only generate token for new documents

  this.token = randomBytes(32).toString('hex') //256 bits from the OS CSPRNG
})

export const Session: Model<ISession> = mongoose.models.Session || model<ISession>('Session', SessionSchema)
import mongoose, {Model, model, SchemaDefinition} from 'mongoose'
import {compareSync, hashSync} from 'bcrypt'
import {IUser} from '@backend/deps/interfaces/DB/User'
import {createSchema} from "@backend/_util/dbMinify"

const UserDef: SchemaDefinition<IUser> = {
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'Игрок'
  }
}

const UserSchema = createSchema<IUser>(UserDef, {timestamps: true})

UserSchema.pre('save', async function () {
  if (this.isModified('password') || this.isNew) {
    this.password = hashSync(this.password, 10)
  }
})

UserSchema.methods.comparePasswords = function (password: string) {
  return compareSync(password, this.password)
}

export const User: Model<IUser> = mongoose.models.User || model<IUser>('User', UserSchema)
import {ObjectId} from "../../types/internal/ObjectId"

export interface ISession {
  _id: ObjectId
  token: string
  user: ObjectId
  expires: Date
  __v?: number
}
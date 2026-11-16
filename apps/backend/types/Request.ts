import {Request as Req} from "express"
import {IUser} from "@backend/deps/interfaces/DB/User"

export type Request = Req & {
  token?: string | null
  user?: {_id: IUser['_id'], role: IUser['role']} | null
}
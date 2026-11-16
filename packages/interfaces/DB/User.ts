//Stays in DB

import {ObjectId} from "../../types/internal/ObjectId"

export interface IUser {
  _id: ObjectId
  username: string;
  createdAt: Date;
  role: "Игрок" | "ГМ"
  password: string
  comparePasswords(password: string): boolean
}

export type UserSafe = Pick<IUser, '_id' | 'username' | 'role' | 'createdAt'>
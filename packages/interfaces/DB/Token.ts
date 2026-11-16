//Stays in DB

import {ObjectId} from "../../types/internal/ObjectId"

export interface IToken {
  character: ObjectId
  position: { x: number, y: number }
  visible: boolean
}
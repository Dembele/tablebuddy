import {ENSize} from "../types/Race"
import {sizeOffsetMap} from "../types/Race"

export const getTokenSize = (size: ENSize) => sizeOffsetMap[size].size
export const getTokenOffset = (size: ENSize) => sizeOffsetMap[size].offset

export const topLeftToCenter = (pos: { x: number; y: number }, size: ENSize) => {
  const offset = getTokenOffset(size)
  return {x: pos.x + offset, y: pos.y + offset}
}

export const centerToTopLeft = (center: { x: number; y: number }, size: ENSize) => {
  const offset = getTokenOffset(size)
  return {x: center.x - offset, y: center.y - offset}
}
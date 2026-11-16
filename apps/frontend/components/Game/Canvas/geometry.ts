//Canvas geometry over a map's grid: pixel ↔ cell, token boxes (tiny tokens share a cell by quadrant), fog checks, who sees / moves a token.
import type {IMap} from "@frontend/deps/interfaces/DB/Map"
import type {IToken} from "@frontend/deps/interfaces/DB/Token"
import type {EvaluatedCharacter} from "@frontend/deps/interfaces/DB/Character"
import {sizeOffsetMap} from "@frontend/deps/types/Race"
import type {RoomUser} from "@frontend/store/room"

export interface Cell { x: number; y: number }
export interface Box { left: number; top: number; width: number; height: number }

//cell under a map pixel, clamped to the grid
export function cellAt(map: IMap, pixelX: number, pixelY: number): Cell {
  const {cellSize, offset, size} = map.gridConfig
  const x = Math.floor((pixelX - offset.left) / cellSize.x)
  const y = Math.floor((pixelY - offset.top) / cellSize.y)
  return {x: Math.min(size.x - 1, Math.max(0, x)), y: Math.min(size.y - 1, Math.max(0, y))}
}

//top-left pixel of a cell (fractions allowed: centers are +0.5)
export function cellToPixel(map: IMap, x: number, y: number) {
  const {cellSize, offset} = map.gridConfig
  return {x: offset.left + x * cellSize.x, y: offset.top + y * cellSize.y}
}

//cells a creature of this size covers (tiny = a quarter cell, still one cell for movement)
export const cellsOf = (character: Pick<EvaluatedCharacter, 'size'> | undefined) => Math.max(1, sizeOffsetMap[character?.size ?? 'medium']?.size ?? 1)

//pixel box of a token; tiny ones take a quadrant by their order in the cell
export function tokenBox(map: IMap, token: IToken, characters: Record<string, EvaluatedCharacter>, tokens: Record<string, IToken>): Box {
  const {cellSize} = map.gridConfig
  const character = characters[String(token.character)]
  const origin = cellToPixel(map, token.position.x, token.position.y)
  if (character?.size !== 'tiny') {
    const cells = cellsOf(character)
    return {left: origin.x, top: origin.y, width: cells * cellSize.x, height: cells * cellSize.y}
  }
  const sharing = Object.values(tokens).filter((other) => other.position.x === token.position.x && other.position.y === token.position.y
    && characters[String(other.character)]?.size === 'tiny')
  const quadrant = Math.max(0, sharing.findIndex((other) => String(other.character) === String(token.character))) % 4
  return {left: origin.x + (quadrant % 2) * cellSize.x / 2, top: origin.y + Math.floor(quadrant / 2) * cellSize.y / 2, width: cellSize.x / 2, height: cellSize.y / 2}
}

//fog: without fog everything is open; with it only '1' tiles are
export function isRevealed(map: IMap, cell: Cell): boolean {
  if (!map.fogOfWar?.enabled) return true
  return map.fogOfWar.exploredAreas[cell.y * map.gridConfig.size.x + cell.x] === '1'
}

//any cell under the token open (fog off = open)
export function tokenRevealed(map: IMap, token: IToken, character: EvaluatedCharacter | undefined): boolean {
  const cells = cellsOf(character)
  for (let x = 0; x < cells; x++) for (let y = 0; y < cells; y++) if (isRevealed(map, {x: token.position.x + x, y: token.position.y + y})) return true
  return false
}

//DM or the character's owner / a user it is shared with
export const mayControl = (user: RoomUser, character: EvaluatedCharacter | undefined) =>
  user.role === 'ГМ' || (!!character && (String(character.owner) === user.id || character.usableBy.some((id) => String(id) === user.id)))

//hidden tokens: only the DM and those who play the character see them
export const maySee = (user: RoomUser, token: IToken, character: EvaluatedCharacter | undefined) => token.visible || mayControl(user, character)

//what a player is shown of a character anywhere in the room (party list, initiative): their own side always,
//other NPCs once the token is shown and out of the fog, templates never. The DM sees everything.
export function playerSees(user: RoomUser, character: EvaluatedCharacter, token: IToken | undefined, map: IMap | null): boolean {
  if (user.role === 'ГМ') return true
  if (character.isTemplate) return false
  if (!character.isNPC || mayControl(user, character)) return true
  return !!token?.visible && !!map && tokenRevealed(map, token, character)
}

//a map pixel as a fractional cell (pings point between grid lines too)
export function pixelToCell(map: IMap, pixelX: number, pixelY: number): Cell {
  const {cellSize, offset} = map.gridConfig
  return {x: (pixelX - offset.left) / cellSize.x, y: (pixelY - offset.top) / cellSize.y}
}

//topmost visible token under a map pixel
export function tokenAt(map: IMap, pixelX: number, pixelY: number, tokens: Record<string, IToken>, characters: Record<string, EvaluatedCharacter>, user: RoomUser): IToken | undefined {
  return Object.values(tokens).reverse().find((token) => {
    if (!maySee(user, token, characters[String(token.character)])) return false
    const box = tokenBox(map, token, characters, tokens)
    return pixelX >= box.left && pixelX < box.left + box.width && pixelY >= box.top && pixelY < box.top + box.height
  })
}

//top-left cell for a token centered on a clicked cell (large tokens sit around the click)
export function topLeftFor(character: EvaluatedCharacter | undefined, center: Cell): Cell {
  const shift = Math.floor((cellsOf(character) - 1) / 2)
  return {x: center.x - shift, y: center.y - shift}
}

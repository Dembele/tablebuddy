//Canvas socket procedures: a visual layer only (Doctrine) — ruler, token placement / drag / move / removal, fog of war, token visibility.
//The DM places tokens, edits fog and visibility; a player moves only tokens of characters they may play. No game logic reads positions.
import {BroadcastUtils, CampaignRoom, GameHub} from "@backend/events/main"
import {updateTile} from "@backend/deps/_util/FoWUtils"
import {UserSafe} from "@backend/deps/interfaces/DB/User"
import {characterManager} from "@backend/services/CharacterManager"
import {copiesOf, deleteCopies, spawnCopy} from "@backend/services/TemplateCopies"

const isDM = (user: UserSafe) => user.role === 'ГМ'

//DM, or the character's owner / a user it is shared with
async function mayMove(user: UserSafe, characterId: string): Promise<boolean> {
  if (isDM(user)) return true
  const character = await characterManager.getOrCreateCharacter(characterId)
  const userId = String(user._id)
  return String(character.owner) === userId || character.usableBy.some(id => String(id) === userId)
}

//every tile of a rectangle shown or hidden; bounds clamped to the grid
function fogRect(fog: string, size: { x: number; y: number }, rect: { minX: number; minY: number; maxX: number; maxY: number }, show: boolean): string {
  let updated = fog
  for (let x = Math.max(0, rect.minX); x <= Math.min(size.x - 1, rect.maxX); x++)
    for (let y = Math.max(0, rect.minY); y <= Math.min(size.y - 1, rect.maxY); y++)
      updated = updateTile(updated, size.x, x, y, show)
  return updated
}

const denied = {message: {type: 'system' as const, content: 'Недостаточно прав'}}

//tokens off the loaded map and copies deleted; everyone drops them, requests of deleted copies go too
async function removeFromRoom(room: CampaignRoom, characterIds: string[], $all: BroadcastUtils['$all']) {
  const loaded = room.currentMap
  if (loaded) room.updateMap(current => { current.tokens.splice(0, current.tokens.length, ...current.tokens.filter(token => !characterIds.includes(String(token.character)))) })
  $all('remove-token', {characterIds})
  const deleted = await deleteCopies(characterIds, room.campaignId, loaded?._id)
  if (!deleted.length) return false
  const pruned = room.removeCharacters(deleted)
  $all('remove-characters', {characterIds: deleted})
  if (pruned) $all('turn-order', {turnOrder: room.turnOrder})
  return true
}

export function registerCanvasEvents(hub: GameHub) {
  hub.procedure('draw-line', async ({data, user, $all}) => {
    $all('draw-line', {from: data.from, to: data.to, user})
  })

  hub.procedure('clear-line', async ({user, $all}) => {
    $all('clear-line', {user})
  })

  //"look here": a pulse on everyone's map for a moment, nothing stored
  hub.procedure('ping', async ({data, user, $all}) => {
    const {x, y} = data?.position ?? {}
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    $all('ping', {position: {x, y}, user: {id: String(user._id), username: user.username, role: user.role}})
  })

  //drag preview: broadcast only, nothing stored
  hub.procedure('token-drag-preview', async ({data, user, $all}) => {
    if (!await mayMove(user, String(data.characterId))) return
    $all('token-drag-preview', {characterId: data.characterId, to: data.to, user})
  })

  //DM: put a character on the current map (hidden until shown); placing again moves it. A template drops a new numbered copy each time
  hub.procedure('create-token', async ({data, user, room, map, $all, $self}) => {
    if (!isDM(user)) return $self('system-message', denied)
    let character = await characterManager.getOrCreateCharacter(String(data.characterId))
    if (String(character.campaign) !== room.campaignId.toString()) return $self('system-message', {message: {type: 'system', content: 'Персонаж из другой кампании'}})
    if (character.isTemplate) {
      const copyId = await spawnCopy(character._id)
      room.addCharacter(copyId)
      character = await characterManager.getOrCreateCharacter(String(copyId))
      $all('update-character', {character: character.evaluatedData})
    }
    const characterId = String(character._id)
    const position = {x: Math.round(data.position.x), y: Math.round(data.position.y)}
    const existing = map.tokens.find(token => String(token.character) === characterId)
    room.updateMap(current => {
      const placed = current.tokens.find(token => String(token.character) === characterId)
      if (placed) placed.position = position
      else current.tokens.push({character: character._id, position, visible: false})
    })
    $all('create-token', {token: {character: character._id, position, visible: existing?.visible ?? false}})
  })

  //DM: take a token off the map; a template copy is deleted with it
  hub.procedure('remove-token', async ({data, user, room, $all, $requests, $self}) => {
    if (!isDM(user)) return $self('system-message', denied)
    if (await removeFromRoom(room, [String(data.characterId)], $all)) $requests()
  })

  //DM: every copy of a template, wherever its token is
  hub.procedure('remove-copies', async ({data, user, room, $all, $requests, $self}) => {
    if (!isDM(user)) return $self('system-message', denied)
    const copies = await copiesOf(data.templateId, room.campaignId)
    if (copies.length && await removeFromRoom(room, copies, $all)) $requests()
  })

  hub.procedure('move-token-end', async ({data, user, room, map, $all, $self}) => {
    if (!await mayMove(user, String(data.characterId))) return $self('system-message', denied)
    const tokenIndex = map.tokens.findIndex(token => String(token.character) === String(data.characterId))
    if (tokenIndex === -1) return
    const to = {x: Math.round(data.to.x), y: Math.round(data.to.y)}
    room.updateMap(current => { current.tokens[tokenIndex].position = to })
    $all('token-moved', {characterId: data.characterId, to, user})
  })

  hub.procedure('reveal-tile', async ({data, user, room, map, $all, $self}) => {
    if (!isDM(user)) return $self('system-message', denied)
    if (!map.fogOfWar) return
    const fog = updateTile(map.fogOfWar.exploredAreas, map.gridConfig.size.x, data.position.x, data.position.y, true)
    room.updateMap(current => { current.fogOfWar!.exploredAreas = fog })
    $all('reveal-tile', {position: data.position})
  })

  hub.procedure('hide-tile', async ({data, user, room, map, $all, $self}) => {
    if (!isDM(user)) return $self('system-message', denied)
    if (!map.fogOfWar) return
    const fog = updateTile(map.fogOfWar.exploredAreas, map.gridConfig.size.x, data.position.x, data.position.y, false)
    room.updateMap(current => { current.fogOfWar!.exploredAreas = fog })
    $all('hide-tile', {position: data.position})
  })

  hub.procedure('reveal-rect', async ({data, user, room, map, $all, $self}) => {
    if (!isDM(user)) return $self('system-message', denied)
    if (!map.fogOfWar) return
    const fog = fogRect(map.fogOfWar.exploredAreas, map.gridConfig.size, data, true)
    room.updateMap(current => { current.fogOfWar!.exploredAreas = fog })
    $all('reveal-rect', {minX: data.minX, minY: data.minY, maxX: data.maxX, maxY: data.maxY})
  })

  hub.procedure('hide-rect', async ({data, user, room, map, $all, $self}) => {
    if (!isDM(user)) return $self('system-message', denied)
    if (!map.fogOfWar) return
    const fog = fogRect(map.fogOfWar.exploredAreas, map.gridConfig.size, data, false)
    room.updateMap(current => { current.fogOfWar!.exploredAreas = fog })
    $all('hide-rect', {minX: data.minX, minY: data.minY, maxX: data.maxX, maxY: data.maxY})
  })

  hub.procedure('toggle-tokens-visibility', async ({data, user, room, $all, $self}) => {
    if (!isDM(user)) return $self('system-message', denied)
    if (!data.tokenIds?.length) return
    const ids = data.tokenIds.map(String)
    room.updateMap(current => { for (const token of current.tokens) if (ids.includes(String(token.character))) token.visible = data.visible })
    $all('toggle-tokens-visibility', {tokenIds: data.tokenIds, visible: data.visible})
  })
}

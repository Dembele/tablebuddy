//Map library: campaign-free maps (isTemplate, no campaign) shared by every DM — image, grid, fog and monster placements.
//A snapshot copies a campaign map in (monster tokens become placements, other tokens stay behind); an import copies a library map
//out as an independent campaign map: files copied, each placement a numbered copy of the campaign's template. Never linked back.
import fs from "node:fs"
import path from "node:path"
import {Types} from "mongoose"
import {Map as MapDoc} from "@backend/models/Map"
import {Campaign} from "@backend/models/Campaign"
import {Character} from "@backend/models/Character"
import {spawnCopy} from "@backend/services/TemplateCopies"
import {monsterToken} from "@backend/services/MonsterTokens"
import {IMap, MonsterPlacement} from "@backend/deps/interfaces/DB/Map"
import {ObjectId} from "@backend/deps/types/internal/ObjectId"
import {getMonster, MonsterId, monsters} from "@backend/deps/data/loader"
import {stampMonster} from "@backend/deps/builder/monster"

const publicDir = path.join(process.cwd(), 'public')
export const libraryDir = path.join(publicDir, 'library', 'maps')
const campaignMapsDir = (campaignId: string) => path.join(publicDir, 'campaigns', campaignId, 'maps')

//a refusal meant for the DM (missing map, campaign or file); anything else is a server error
export class LibraryError extends Error {}

type MapFiles = Pick<IMap, 'backgroundImagePath' | 'thumbnailPath'>

//the file behind a stored /api/… media path (query dropped); anything outside public/ or missing = none
export function diskPath(publicPath?: string): string | undefined {
  if (!publicPath?.startsWith('/api/')) return undefined
  const resolved = path.resolve(publicDir, publicPath.slice('/api/'.length).split('?')[0])
  return resolved.startsWith(publicDir + path.sep) && fs.existsSync(resolved) ? resolved : undefined
}

//image + thumbnail copied into a folder under the new map's id; the public paths of the copies
function copyFiles(source: MapFiles, mapId: ObjectId, directory: string, publicBase: string): MapFiles {
  const main = diskPath(source.backgroundImagePath)
  if (!main) throw new LibraryError('Файл изображения карты не найден')
  fs.mkdirSync(directory, {recursive: true})
  const version = `?t=${Date.now()}`
  fs.copyFileSync(main, path.join(directory, `${mapId}.webp`))
  const thumbnail = diskPath(source.thumbnailPath)
  if (thumbnail) fs.copyFileSync(thumbnail, path.join(directory, `${mapId}_thumbnail.webp`))
  return {backgroundImagePath: `${publicBase}/${mapId}.webp${version}`, thumbnailPath: thumbnail ? `${publicBase}/${mapId}_thumbnail.webp${version}` : undefined}
}

//what a map carries over either way: texts, grid, fog (revealed tiles included)
const sharedFields = (map: IMap) => ({name: map.name, description: map.description, gridType: map.gridType, gridConfig: map.gridConfig,
  fogOfWar: {enabled: !!map.fogOfWar?.enabled, exploredAreas: map.fogOfWar?.exploredAreas ?? ''}})

//campaign map → new library map; tokens of bestiary monsters (templates' copies or single ones) become placements
export async function snapshotToLibrary(mapId: string): Promise<ObjectId> {
  const map = await MapDoc.findById(mapId).lean<IMap>()
  if (!map || !map.campaign) throw new LibraryError('Карта кампании не найдена')
  const placed = await Character.find({_id: {$in: map.tokens.map((token) => token.character)}, monster: {$exists: true, $ne: null}}).select('_id monster').lean()
  const monsterOf = Object.fromEntries(placed.map((character) => [String(character._id), character.monster as MonsterId]))
  const placements: MonsterPlacement[] = map.tokens.flatMap((token) => {
    const monster = monsterOf[String(token.character)]
    return monster ? [{monster, position: {...token.position}, visible: token.visible}] : []
  })
  const entry = new MapDoc({...sharedFields(map), isTemplate: true, tokens: [], placements, backgroundImagePath: 'pending'})
  entry.set(copyFiles(map, entry._id, libraryDir, '/api/library/maps'))
  await entry.save()
  return entry._id
}

//the campaign's template for a bestiary monster, made like a bestiary drop when there is none yet
async function templateFor(campaignId: ObjectId, monster: MonsterId, ownerId: ObjectId, created: ObjectId[]): Promise<ObjectId> {
  const existing = await Character.findOne({campaign: campaignId, monster, isTemplate: true}).select('_id').lean()
  if (existing) return existing._id
  const template = await Character.create({owner: ownerId, campaign: campaignId, ...stampMonster(getMonster(monster)), ...monsterToken(monster)})
  created.push(template._id)
  return template._id
}

//library map → new campaign map with its monsters placed; the first map of a campaign becomes current. Returns the map and every character made
export async function importFromLibrary(libraryId: string, campaignId: string, ownerId: ObjectId): Promise<{ mapId: ObjectId; created: ObjectId[] }> {
  const entry = await MapDoc.findById(libraryId).lean<IMap>()
  if (!entry || !entry.isTemplate || entry.campaign) throw new LibraryError('Карта библиотеки не найдена')
  const campaign = await Campaign.findById(campaignId)
  if (!campaign) throw new LibraryError('Кампания не найдена')

  const map = new MapDoc({...sharedFields(entry), campaign: campaign._id, tokens: [], backgroundImagePath: 'pending'})
  map.set(copyFiles(entry, map._id, campaignMapsDir(String(campaign._id)), `/api/campaigns/${campaign._id}/maps`))
  const created: ObjectId[] = []
  const templates: Partial<Record<MonsterId, ObjectId>> = {}
  for (const placement of entry.placements ?? []) {
    if (!(placement.monster in monsters)) continue                                                                    //a bestiary entry renamed since the snapshot
    const template = templates[placement.monster] ??= await templateFor(campaign._id, placement.monster, ownerId, created)
    const copy = await spawnCopy(template)
    created.push(copy)
    map.tokens.push({character: new Types.ObjectId(String(copy)), position: {...placement.position}, visible: placement.visible})
  }
  await map.save()

  campaign.availableMaps = [...campaign.availableMaps, map._id]
  if (!campaign.currentMap) campaign.currentMap = map._id
  await campaign.save()
  return {mapId: map._id, created}
}

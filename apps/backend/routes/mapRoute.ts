//Campaign maps REST, the DM's alone: list, read, create, edit, delete. Players get no map list and no map by id — what lies ahead
//(and the unfogged picture of where they are) is not theirs to browse; they see the current map in the game room, under its fog.
//Tokens and fog stay with the game room. Images arrive as data URLs and are stored under public/campaigns/<id>/maps (main + thumbnail).
//The map library (/library, services/MapLibrary): campaign-free maps every DM shares — upload, snapshot a campaign map in, import a copy out.
import express, {Response} from 'express'
import fs from "node:fs"
import path from "node:path"
import {Request} from "@backend/types/Request"
import {Map} from "@backend/models/Map"
import {Campaign} from "@backend/models/Campaign"
import {IMap} from "@backend/deps/interfaces/DB/Map"
import {processAndSaveImage} from "@backend/_util/processImage"
import {genericErrorHandler} from "@backend/_util/mongooseErrorHandler"
import {defaultPermission} from "@backend/_util/routesProtector"
import {importFromLibrary, LibraryError, libraryDir, snapshotToLibrary} from "@backend/services/MapLibrary"

const router = express.Router()
router.use(defaultPermission('ГМ'))

const summaryFields = '_id name description backgroundImagePath thumbnailPath gridType campaign updatedAt'
const librarySummaryFields = `${summaryFields} placements`

//editable fields only: name, description, grid, fog switch; anything else in the body is ignored
function editableFields(body: Record<string, unknown>): Partial<IMap> {
  const fields: Partial<IMap> = {}
  if (typeof body.name === 'string') fields.name = body.name.trim()
  if (typeof body.description === 'string') fields.description = body.description
  if (body.gridType === 'square' || body.gridType === 'none') fields.gridType = body.gridType
  if (body.gridConfig && typeof body.gridConfig === 'object') fields.gridConfig = body.gridConfig as IMap['gridConfig']
  return fields
}

//map files on disk (main + thumbnail): the campaign's folder, or the library's
function removeFiles(map: Pick<IMap, '_id' | 'campaign'>) {
  const directory = map.campaign ? path.join(process.cwd(), 'public', 'campaigns', String(map.campaign), 'maps') : libraryDir
  for (const file of [`${map._id}.webp`, `${map._id}_thumbnail.webp`]) fs.rmSync(path.join(directory, file), {force: true})
}

//rooms holding this campaign re-read it (a library map has none)
async function refreshRoom(campaignId: unknown) {
  if (!campaignId) return
  const {getHub} = await import('@backend/server')
  await getHub()?.reloadRoom(String(campaignId))
}

//?campaign=<id>: that campaign's maps (summaries)
router.get('/', async (req: Request, res: Response) => {
  const campaign = req.query.campaign
  if (typeof campaign !== 'string') return void res.status(400).send('Нужна кампания')
  try {
    res.json(await Map.find({campaign}).select(summaryFields).sort({name: 1}).lean())
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//the library: every DM's shared maps, newest first
router.get('/library', async (_req: Request, res: Response) => {
  try {
    res.json(await Map.find({isTemplate: true, campaign: null}).select(librarySummaryFields).sort({updatedAt: -1}).lean())
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//new library map from an uploaded image (no campaign, no placements)
router.post('/library', async (req: Request, res: Response) => {
  const {image} = req.body
  const fields = editableFields(req.body)
  if (!fields.name) return void res.status(400).send('Нужно название карты')
  if (typeof image !== 'string' || !image.startsWith('data:image/')) return void res.status(400).send('Нужно изображение карты')
  try {
    const map = new Map({...fields, isTemplate: true, backgroundImagePath: 'pending', tokens: [], placements: [], fogOfWar: {enabled: req.body.fogEnabled === true, exploredAreas: ''}})
    const {imagePath, thumbnailPath} = await processAndSaveImage({image, mapId: map._id, type: 'map'})
    map.backgroundImagePath = imagePath
    map.thumbnailPath = thumbnailPath
    await map.save()
    res.status(201).json({_id: map._id})
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//campaign map → library snapshot (monster tokens kept as placements)
router.post('/:id/to-library', async (req: Request, res: Response) => {
  try {
    res.status(201).json({_id: await snapshotToLibrary(String(req.params.id))})
  } catch (error) {
    if (error instanceof LibraryError) return void res.status(400).send(error.message)
    genericErrorHandler(error, res)
  }
})

//library map → a copy in a campaign, its monsters placed as copies of the campaign's templates
router.post('/:id/import', async (req: Request, res: Response) => {
  const {campaign} = req.body as { campaign?: unknown }
  if (typeof campaign !== 'string' || !campaign) return void res.status(400).send('Кампания не указана')
  try {
    const {mapId, created} = await importFromLibrary(String(req.params.id), campaign, req.user!._id)
    const {getHub} = await import('@backend/server')                                                                 //lazy: server → app → routes would be circular
    for (const characterId of created) await getHub()?.announceCharacter(campaign, characterId)
    await refreshRoom(campaign)
    res.status(201).json({_id: mapId})
  } catch (error) {
    if (error instanceof LibraryError) return void res.status(400).send(error.message)
    genericErrorHandler(error, res)
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const map = await Map.findById(req.params.id).lean<IMap>()
    if (!map) return void res.status(404).send('Карта не найдена')
    res.json(map)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//new map in a campaign; the first one becomes current
router.post('/', async (req: Request, res: Response) => {
  const {campaign: campaignId, image} = req.body
  const fields = editableFields(req.body)
  if (!fields.name) return void res.status(400).send('Нужно название карты')
  if (typeof image !== 'string' || !image.startsWith('data:image/')) return void res.status(400).send('Нужно изображение карты')

  try {
    const campaign = await Campaign.findById(campaignId)
    if (!campaign) return void res.status(404).send('Кампания не найдена')
    const map = new Map({...fields, campaign: campaign._id, backgroundImagePath: 'pending', tokens: [], fogOfWar: {enabled: req.body.fogEnabled === true, exploredAreas: ''}})
    const {imagePath, thumbnailPath} = await processAndSaveImage({image, mapId: map._id, campaignId: String(campaign._id), type: 'map'})
    map.backgroundImagePath = imagePath
    map.thumbnailPath = thumbnailPath
    await map.save()

    campaign.availableMaps = [...campaign.availableMaps, map._id]
    if (!campaign.currentMap) campaign.currentMap = map._id
    await campaign.save()
    await refreshRoom(campaign._id)
    res.status(201).json({_id: map._id})
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//name, description, grid, optionally a new image (data URL); tokens and fog untouched
router.put('/:id', async (req: Request, res: Response) => {
  const fields = editableFields(req.body)
  if (fields.name === '') return void res.status(400).send('Нужно название карты')

  try {
    const map = await Map.findById(req.params.id)
    if (!map) return void res.status(404).send('Карта не найдена')
    map.set(fields)
    if (typeof req.body.fogEnabled === 'boolean') map.set('fogOfWar.enabled', req.body.fogEnabled) //revealed tiles stay: they belong to the game room
    if (typeof req.body.image === 'string' && req.body.image.startsWith('data:image/')) {
      const {imagePath, thumbnailPath} = await processAndSaveImage({image: req.body.image, mapId: map._id, campaignId: map.campaign ? String(map.campaign) : undefined, type: 'map'})
      map.backgroundImagePath = imagePath
      map.thumbnailPath = thumbnailPath ?? map.thumbnailPath
    }
    await map.save()
    await refreshRoom(map.campaign)
    res.sendStatus(200)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//the map, its files, and its place in the campaign (current map cleared if it was this one)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const map = await Map.findById(req.params.id).lean<IMap>()
    if (!map) return void res.sendStatus(204)
    await Campaign.updateOne({_id: map.campaign}, {$pull: {availableMaps: map._id}})
    await Campaign.updateOne({_id: map.campaign, currentMap: map._id}, {currentMap: null})
    await Map.deleteOne({_id: map._id})
    removeFiles(map)
    await refreshRoom(map.campaign)
    res.sendStatus(204)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

export default router

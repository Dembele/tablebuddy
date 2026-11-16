//Campaign REST: the DM sees and manages every campaign; a player sees the ones they are in. Covers are optional uploads.
import express, {Response} from "express"
import {Request} from "@backend/types/Request"
import {Campaign} from "@backend/models/Campaign"
import {Map} from "@backend/models/Map"
import {Character} from "@backend/models/Character"
import {ICampaign} from "@backend/deps/interfaces/DB/Campaign"
import {processAndSaveImage} from "@backend/_util/processImage"
import fs from "node:fs"
import {genericErrorHandler} from "@backend/_util/mongooseErrorHandler"
import {defaultPermission} from "@backend/_util/routesProtector"
import path from "node:path"
import {User} from "@backend/models/User"
import {UserSafe} from "@backend/deps/interfaces/DB/User"
import {issueTicket} from "@backend/services/SocketTickets"

const router = express.Router()
router.use(defaultPermission('Игрок'))

const statuses = ['В процессе', 'На паузе', 'Завершена']
const summaryFields = "_id name description image status players createdAt"
const isDM = (req: Request) => req.user?.role === 'ГМ'
const isMember = (req: Request, campaign: Pick<ICampaign, 'players'>) => isDM(req) || campaign.players.some(id => String(id) === String(req.user?._id))

export const validateCampaignInput = (name: unknown, status?: unknown): { error?: string } => {
  if (!name || typeof name !== 'string' || name.trim().length < 2) return {error: 'Название кампании обязательно и должно содержать минимум 2 символа'}
  if (status && (typeof status !== 'string' || !statuses.includes(status))) return {error: 'Недопустимый статус кампании'}
  return {}
}

//base64 data URL -> stored cover path; anything else is ignored
async function saveCover(image: unknown, campaignId: string): Promise<string | undefined> {
  if (typeof image !== 'string' || !image.startsWith('data:image/')) return undefined
  const {imagePath} = await processAndSaveImage({image, campaignId, type: "cover"})
  return imagePath
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const filter = isDM(req) ? {} : {players: req.user!._id}
    res.json(await Campaign.find(filter).select(summaryFields).sort({createdAt: -1}).lean())
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const campaign = await Campaign.findById(req.params.id).lean<ICampaign>()
    if (!campaign) return void res.status(404).send('Кампания не найдена')
    if (!isMember(req, campaign)) return void res.status(403).send('Запрещено')
    res.json(campaign)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//DM: the map the game room shows (one of the campaign's maps, or none)
router.patch('/:id/current-map', defaultPermission('ГМ'), async (req: Request, res: Response) => {
  const {mapId} = req.body as { mapId?: string | null }
  try {
    const campaign = await Campaign.findById(req.params.id)
    if (!campaign) return void res.status(404).send('Кампания не найдена')
    if (mapId && !await Map.exists({_id: mapId, campaign: campaign._id})) return void res.status(404).send('Карта не из этой кампании')
    campaign.currentMap = (mapId ?? null) as unknown as ICampaign['currentMap']
    await campaign.save()
    const {getHub} = await import('@backend/server')
    await getHub()?.reloadRoom(String(campaign._id))
    res.sendStatus(200)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//one-time ticket for the campaign's socket room (members and the DM)
router.post('/:id/socket-ticket', async (req: Request, res: Response) => {
  try {
    const [campaign, user] = await Promise.all([
      Campaign.findById(req.params.id).select('players').lean<Pick<ICampaign, 'players'>>(),
      User.findById(req.user!._id).select('_id username role createdAt').lean<UserSafe>()
    ])
    if (!campaign) return void res.status(404).send('Кампания не найдена')
    if (!user) return void res.status(401).send('Пользователь не найден')
    if (!isMember(req, campaign)) return void res.status(403).send('Запрещено')
    res.json({ticket: issueTicket(user, String(req.params.id))})
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

router.post('/', defaultPermission('ГМ'), async (req: Request, res: Response) => {
  const {name, description, status, image, players} = req.body
  const validation = validateCampaignInput(name, status)
  if (validation.error) return void res.status(400).send(validation.error)

  try {
    const campaign = await Campaign.create({
      name: name.trim(),
      description: description?.trim() || '',
      status: status || 'В процессе',
      players: Array.isArray(players) ? players : []
    })
    try {
      const cover = await saveCover(image, campaign.id)
      if (cover) {
        campaign.image = cover
        await campaign.save()
      }
    } catch (fileError) {
      await Campaign.deleteOne({_id: campaign._id})
      throw fileError
    }
    res.status(201).json({_id: campaign._id})
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

router.put('/:id', defaultPermission('ГМ'), async (req: Request, res: Response) => {
  const {name, description, status, image, players} = req.body
  const validation = validateCampaignInput(name, status)
  if (validation.error) return void res.status(400).send(validation.error)

  try {
    const campaign = await Campaign.findById(req.params.id)
    if (!campaign) return void res.status(404).send('Кампания не найдена')

    campaign.name = name.trim()
    campaign.description = description?.trim() || ''
    campaign.status = status || campaign.status
    if (Array.isArray(players)) campaign.players = players
    const cover = await saveCover(image, campaign.id)
    if (cover) campaign.image = cover
    else if (image === null) campaign.image = null
    await campaign.save()
    res.sendStatus(204)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//refuses while characters still belong to it; maps and uploaded files go with it
router.delete('/:id', defaultPermission('ГМ'), async (req: Request, res: Response) => {
  const id = String(req.params.id)
  try {
    const campaign = await Campaign.findById(id)
    if (!campaign) return void res.status(404).send('Кампания не найдена')
    const characters = await Character.countDocuments({campaign: id})
    if (characters) return void res.status(409).send(`В кампании ещё есть персонажи (${characters}) — удалите или перенесите их`)

    await Map.deleteMany({campaign: id})
    fs.rmSync(path.join(process.cwd(), 'public', 'campaigns', id), {recursive: true, force: true})
    await Campaign.findByIdAndDelete(id)
    res.sendStatus(204)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

export default router

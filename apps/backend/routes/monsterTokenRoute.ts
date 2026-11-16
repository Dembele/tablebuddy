//Monster token pack (DM): list which bestiary monsters have a token, save one from a dropped picture, remove it.
//Only ids from data/monsters are accepted, so a path can never leave public/monsters/.
import express, {Response} from 'express'
import {Request} from "@backend/types/Request"
import {defaultPermission} from "@backend/_util/routesProtector"
import {monsters} from "@backend/deps/data/loader"
import {deleteMonsterToken, monsterToken, monsterTokenIds, saveMonsterToken} from "@backend/services/MonsterTokens"

const router = express.Router()
router.use(defaultPermission('ГМ'))

const known = (id: unknown): id is string => typeof id === 'string' && Object.hasOwn(monsters, id)

router.get('/', (_req: Request, res: Response) => {
  res.json(monsterTokenIds().filter(known))
})

router.get('/:id', (req: Request, res: Response) => {
  if (!known(req.params.id)) return void res.status(404).send('Нет такого монстра')
  res.json(monsterToken(req.params.id))
})

//body: avatar (256 px round token, data URL), image (source picture, data URL, optional)
router.put('/:id', async (req: Request, res: Response) => {
  if (!known(req.params.id)) return void res.status(404).send('Нет такого монстра')
  const {avatar, image} = req.body as { avatar?: string; image?: string }
  if (typeof avatar !== 'string') return void res.status(400).send('Нет картинки токена')
  try {
    res.json(await saveMonsterToken(req.params.id, avatar, typeof image === 'string' ? image : undefined))
  } catch (error) {
    res.status(400).send(error instanceof Error ? error.message : 'Не удалось сохранить токен')
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  if (!known(req.params.id)) return void res.status(404).send('Нет такого монстра')
  await deleteMonsterToken(req.params.id)
  res.sendStatus(204)
})

export default router

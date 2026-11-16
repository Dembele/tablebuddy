//Users: the list for DM pickers, the DM's role switch and password reset; safe fields only, DM only.
import express, {Response} from "express"
import {User} from "@backend/models/User"
import {defaultPermission} from "@backend/_util/routesProtector"
import {Request} from "@backend/types/Request"
import {genericErrorHandler} from "@backend/_util/mongooseErrorHandler"
import {Session} from "@backend/models/Session"
import {minPasswordLength} from "@backend/routes/authRoute"

const router = express.Router()
router.use(defaultPermission('ГМ'))

router.get('/', async (_req, res) => {
  res.json(await User.find().select('_id username role createdAt').sort({username: 1}).lean())
})

//role switch; a DM cannot demote themselves, so the table never loses its last DM by accident
router.patch('/:id/role', async (req: Request, res: Response) => {
  const {role} = req.body as { role?: string }
  if (role !== 'ГМ' && role !== 'Игрок') return void res.status(400).send('Роль: ГМ или Игрок')
  if (String(req.user!._id) === String(req.params.id) && role !== 'ГМ') return void res.status(409).send('Нельзя снять роль ГМ с себя')

  try {
    const updated = await User.findByIdAndUpdate(req.params.id, {role}, {runValidators: true})
    if (!updated) return void res.status(404).send('Пользователь не найден')
    res.sendStatus(200)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

//DM reset of a forgotten password; that user's sessions end
router.patch('/:id/password', async (req: Request, res: Response) => {
  const {password} = req.body as { password?: unknown }
  if (typeof password !== 'string' || password.length < minPasswordLength) return void res.status(400).send(`Пароль — минимум ${minPasswordLength} символов`)

  try {
    const user = await User.findById(req.params.id)
    if (!user) return void res.status(404).send('Пользователь не найден')
    user.password = password
    await user.save()
    await Session.deleteMany({user: user._id})
    res.sendStatus(200)
  } catch (error) {
    genericErrorHandler(error, res)
  }
})

export default router

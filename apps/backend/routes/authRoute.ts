//Auth REST: who am I (by session token), login, register, own password change. Usernames match literally, case-insensitively.
//Internet-facing: registration needs REGISTRATION_CODE when it is set; repeated wrong passwords lock a username for a while.
import express from 'express'
import {timingSafeEqual} from "node:crypto"
import {Session} from "@backend/models/Session"
import {Request} from "@backend/types/Request"
import {IUser} from "@backend/deps/interfaces/DB/User"
import {User} from "@backend/models/User"

const router = express.Router()

//usernames match case-insensitively but literally: no regex from user input
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const minPasswordLength = 6
const loginFailureLimit = 5                                                                                             //wrong passwords before a username is locked
const loginLockMs = 5 * 60 * 1000
const badCredentials = 'Неверное имя пользователя или пароль'                                                            //same answer for unknown user and wrong password

//wrong-password count per lowercased username; in memory, so a restart forgets it
const loginFailures = new Map<string, { count: number; lockedUntil: number }>()

//true while this username is locked out
const isLocked = (key: string) => (loginFailures.get(key)?.lockedUntil ?? 0) > Date.now()

//one more wrong password; reaching the limit locks the username and starts the count over
function noteFailure(key: string) {
  const count = (loginFailures.get(key)?.count ?? 0) + 1
  loginFailures.set(key, count >= loginFailureLimit ? {count: 0, lockedUntil: Date.now() + loginLockMs} : {count, lockedUntil: 0})
}

//the invite code matches REGISTRATION_CODE, or no code is required
function codeAccepted(code: unknown) {
  const expected = process.env.REGISTRATION_CODE
  if (!expected) return true
  if (typeof code !== 'string') return false
  const [given, wanted] = [Buffer.from(code), Buffer.from(expected)]
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

router.get('/', async (req: Request, res) => {
  if (!req.token) {
    console.log('token not provided')
    res.status(401).send('Не предоставлен токен')
    return
  }

  const session = await Session.findOne({token: req.token}).populate<{ user: IUser }>('user')
  if (!session) {
    console.log('Сессия пользователя не найдена')
    res.status(404).send("Сессия пользователя не найдена")
    return
  }

  res.status(200).json({
    _id: session.user._id,
    username: session.user.username,
    role: session.user.role,
    createdAt: session.user.createdAt
  })
})

router.post('/login', async (req, res) => {
  const {username, password} = req.body

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    res.status(400).send('Имя пользователя и пароль необходимы')
    return
  }

  const key = username.trim().toLowerCase()
  if (isLocked(key)) return void res.status(429).send('Слишком много неудачных попыток, попробуйте через несколько минут')

  const user = await User.findOne({
    username: {$regex: `^${escapeRegex(username)}$`, $options: 'i'}
  });

  if (!user || !user.comparePasswords(password as string)) {
    noteFailure(key)
    return void res.status(401).send(badCredentials)
  }
  loginFailures.delete(key)

  const session = new Session({user: user._id})
  await session.save()


  if (!session) {
    console.log(session)
    res.status(500).send("Ошибка создания сессии, войдите вручную")
    return
  }

  res.status(200).json({
    user: {
      _id: user._id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt
    },
    token: session.token
  }) // 201 Created status
})
router.post('/register', async (req, res) => {
  const {username, password, code} = req.body
  if (!codeAccepted(code)) return void res.status(403).send('Неверный код приглашения')

  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    res.status(400).send('Имя пользователя и пароль необходимы')
    return
  }
  if (password.length < minPasswordLength) {
    res.status(400).send(`Пароль — минимум ${minPasswordLength} символов`)
    return
  }

  const userCheck = await User.findOne({
    username: {$regex: `^${escapeRegex(username)}$`, $options: 'i'}
  });

  if (userCheck) {
    res.status(409).send('Пользователь уже существует')
    return
  }

  // Here you would normally create the user
  const newUser = new User({username, password})
  await newUser.save()

  const session = new Session({user: newUser._id})
  await session.save()

  if (!session) {
    console.log(session)
    res.status(500).send("Ошибка создания сессии, войдите вручную")
    return
  }

  res.status(201).json({
    user: {
      _id: newUser._id,
      username: newUser.username,
      role: newUser.role,
      createdAt: newUser.createdAt
    },
    token: session.token
  }) // 201 Created status
})

//own password change: the current one is required; every other session of this user ends
router.patch('/password', async (req: Request, res) => {
  const {current, next} = req.body as { current?: unknown; next?: unknown }
  if (!req.token) return void res.status(401).send('Не предоставлен токен')
  if (typeof current !== 'string' || typeof next !== 'string') return void res.status(400).send('Нужны текущий и новый пароль')
  if (next.length < minPasswordLength) return void res.status(400).send(`Пароль — минимум ${minPasswordLength} символов`)

  try {
    const session = await Session.findOne({token: req.token})
    if (!session) return void res.status(401).send('Сессия не найдена')
    const user = await User.findById(session.user)
    if (!user) return void res.status(404).send('Пользователь не найден')
    if (!user.comparePasswords(current)) return void res.status(400).send('Текущий пароль указан неверно')
    user.password = next
    await user.save()
    await Session.deleteMany({user: user._id, token: {$ne: req.token}})
    res.sendStatus(200)
  } catch (error) {
    console.error('Password change failed', error)
    res.status(500).send('Ошибка сервера')
  }
})

export {minPasswordLength}
export default router
import express, {NextFunction, Response} from 'express'
import {Request} from "@backend/types/Request"
import cors from 'cors'
import authRoute from "@backend/routes/authRoute"
import campaignRoute from "@backend/routes/campaignRoute"
import mapRoute from "@backend/routes/mapRoute"
import adminRoute from "@backend/routes/adminRoute"
import characterRoute from "@backend/routes/characterRoute"
import userRoute from "@backend/routes/userRoute"
import monsterTokenRoute from "@backend/routes/monsterTokenRoute"

const app = express()

app.use((req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  console.log(`${req.method} ${req.originalUrl} ${req.headers['user-agent']}`)

  if (authHeader && authHeader.startsWith('Bearer ')) {
    req.token = authHeader.split(' ')[1] || null
  } else {
    req.token = null
  }
  next()
})

// Middleware
app.disable('x-powered-by')
app.use(cors({origin: process.env.FRONTEND_PUBLIC_URL || false}))                                                      //browsers only from our own site (the frontend proxies /api same-origin)
app.use(express.json({limit: '10mb'}))
app.use(express.static('public'))
app.use('/auth', authRoute)
app.use('/campaign', campaignRoute)
app.use('/map', mapRoute)
app.use('/admin', adminRoute)
app.use('/character', characterRoute)
app.use('/user', userRoute)
app.use('/monster-token', monsterTokenRoute)

app.use((req, res) => {
  const statusCode = 404;
  const message = 'Страница не найдена или метод не поддерживается'
  res.status(statusCode).send(message);
})

export default app
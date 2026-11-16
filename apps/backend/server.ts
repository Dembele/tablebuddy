import type {Server as HttpServer} from 'http'
import http from 'http'
import app from '@backend/app'
import {Server} from 'socket.io'
import mongoose from 'mongoose'
import {registerChatEvents} from '@backend//events/chat/chatEvents'
import {registerRequestEvents} from "@backend/events/request/requestEvents"
import {registerCanvasEvents} from "@backend/events/action/canvasEvents"
import {GameHub} from "@backend/events/main"
import {registerCharacterEvents} from "@backend/events/character/characterEvents"
import {registerTurnEvents} from "@backend/events/turn/turnEvents"
import {registerShopEvents} from "@backend/events/shop/shopEvents"

type ConnectionObject = {
  isConnected?: number;
};

const connection: ConnectionObject = {}
let io: Server | undefined
let hub: GameHub | undefined

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_PUBLIC_URL,
      methods: ["GET", "POST"],
      credentials: true
    },
    path: '/socket.io',
    transports: ['websocket']
  })

  const socketEvents = new GameHub(io)
  hub = socketEvents
  registerChatEvents(socketEvents)
  registerRequestEvents(socketEvents)
  registerCanvasEvents(socketEvents)
  registerCharacterEvents(socketEvents)
  registerTurnEvents(socketEvents)
  registerShopEvents(socketEvents)

  return io
}

//the hub, for REST routes that change room state (maps); undefined before the socket starts (tests)
export const getHub = (): GameHub | undefined => hub

export const getIo = (): Server => {
  if (!io) {
    throw new Error('Socket.io not initialized! Call initSocket() first. Did server.ts start correctly?')
  }
  return io
}

async function connectToDatabase(): Promise<boolean> {
  // Already connected? Return true immediately.
  if (connection.isConnected === 1) {
    return true
  }

  // Validate required env var early
  if (!process.env.DB_ADDRESS) {
    throw new Error('DB_ADDRESS env var missing - cannot connect to database')
  }

  try {
    const db = await mongoose.connect(process.env.DB_ADDRESS, {})
    const state = db.connections[0].readyState
    connection.isConnected = state
    return state === 1 // Only true if fully connected (readyState 1).
  } catch (error) {
    console.error("Database connection failed")
    console.error(error)
    connection.isConnected = 0 // Mark as disconnected for future checks.
    return false
  }
}

async function startServer() {
  const dbConnected = await connectToDatabase()
  if (!dbConnected) throw new Error('Database connection failed')

  try {
    const server = http.createServer(app)
    const PORT = process.env.PORT || process.env.BACKEND_PORT || 4000 //BACKEND_PORT comes from shared.env

    initSocket(server)

    server.listen(PORT, () => {
      console.log(`Server started on port ${PORT} | DB: On | Sockets: On`)
    })

  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Start the application
void startServer()
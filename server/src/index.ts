import { Server, matchMaker } from 'colyseus'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
// import { monitor } from '@colyseus/monitor' // Disabled in production due to missing dependencies
import { MatchRoom } from './rooms/MatchRoom.js'
import { gameClock } from '@kickoff/shared/engine/GameClock'
import rootPkg from '../../package.json' assert { type: 'json' }

const appVersion = process.env.APP_VERSION || (rootPkg as any).version || '0.0.0'

const app = express()
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000

// CORS configuration
// In production with separate pods, configure allowed origins
const corsOptions = {
  origin: process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',')
    : '*', // Allow all origins in development
  credentials: true,
}
app.use(cors(corsOptions))
app.use(express.json())

// Create HTTP server
const httpServer = createServer(app)

// Initialize Colyseus
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
  }),
})

// Register room handlers
// filterBy(['roomName']) creates separate room instances for each unique roomName
// This allows:
// - Tests: Each test gets isolated room (unique roomName from worker index)
// - Production: All players with same roomName join same room
gameServer.define('match', MatchRoom).filterBy(['roomName'])

// Colyseus monitor (dev tool) - Disabled in production
// app.use('/colyseus', monitor())

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: gameClock.now(),
    version: appVersion,
    server: `Kickoff v${appVersion}`,
  })
})

// List available rooms API
app.get('/api/rooms', async (_req, res) => {
  try {
    const rooms = await matchMaker.query({ name: 'match' })
    res.json(rooms)
  } catch (err) {
    console.error('Error in /api/rooms:', err);
    res.status(500).json({ error: (err as Error).message, stack: (err as Error).stack })
  }
})

// Start server
// Listen on :: (IPv6 all interfaces) which also handles IPv4 if dual-stack is available
// For IPv6-only servers, this ensures proper binding
gameServer.listen(port, '::')

console.log(`🚀 Kickoff Server listening on http://[::]:${port}`)
console.log(`📊 Colyseus Monitor: http://[::]:${port}/colyseus`)

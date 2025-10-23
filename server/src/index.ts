import Colyseus from 'colyseus'
import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
import { monitor } from '@colyseus/monitor'
import { MatchRoom } from './rooms/MatchRoom'

const { Server } = Colyseus

const app = express()
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000

// CORS for local development
app.use(cors())
app.use(express.json())

// Create HTTP server
const httpServer = createServer(app)

// Initialize Colyseus
const gameServer = new Server({
  server: httpServer,
})

// Register room handlers
// filterBy(['roomName']) creates separate room instances for each unique roomName
// This allows:
// - Tests: Each test gets isolated room (unique roomName from worker index)
// - Production: All players with same roomName join same room
gameServer.define('match', MatchRoom).filterBy(['roomName'])

// Colyseus monitor (dev tool)
app.use('/colyseus', monitor())

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    server: 'Kickoff v0.2.0',
  })
})

// Start server
gameServer.listen(port, '0.0.0.0')

console.log(`🚀 Kickoff Server listening on http://0.0.0.0:${port}`)
console.log(`📊 Colyseus Monitor: http://0.0.0.0:${port}/colyseus`)

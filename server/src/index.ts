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

// Register room handlers with metadata filtering for test isolation
// filterBy checks options, not metadata - use options.roomName for matching
gameServer.define('match', MatchRoom).filterBy(['roomName'])

// Colyseus monitor (dev tool)
app.use('/colyseus', monitor())

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    server: 'Socca2 v0.1.0',
  })
})

// Start server
gameServer.listen(port, '0.0.0.0')

console.log(`🚀 Socca2 Server listening on http://0.0.0.0:${port}`)
console.log(`📊 Colyseus Monitor: http://0.0.0.0:${port}/colyseus`)

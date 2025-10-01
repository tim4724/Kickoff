import { NetworkManager } from '../network/NetworkManager'

/**
 * Simple network connection test
 * Tests basic client-server connectivity
 */
async function testNetworkConnection() {
  console.log('='.repeat(50))
  console.log('NETWORK CONNECTION TEST')
  console.log('='.repeat(50))

  const networkManager = new NetworkManager({
    serverUrl: 'ws://localhost:3000',
    roomName: 'match',
  })

  // Register event listeners
  networkManager.on('stateChange', (state) => {
    console.log('[TEST] State update received:')
    console.log(`  - Match Time: ${state.matchTime}s`)
    console.log(`  - Score: ${state.scoreBlue} - ${state.scoreRed}`)
    console.log(`  - Phase: ${state.phase}`)
    console.log(`  - Players: ${state.players.size}`)
    console.log(`  - Ball: (${Math.round(state.ball.x)}, ${Math.round(state.ball.y)})`)
  })

  networkManager.on('playerJoin', (player) => {
    console.log(`[TEST] Player joined: ${player.id} (${player.team} team)`)
  })

  networkManager.on('playerLeave', (playerId) => {
    console.log(`[TEST] Player left: ${playerId}`)
  })

  networkManager.on('matchStart', (duration) => {
    console.log(`[TEST] Match started! Duration: ${duration}s`)
  })

  networkManager.on('matchEnd', (winner, scoreBlue, scoreRed) => {
    console.log(`[TEST] Match ended! Winner: ${winner}, Score: ${scoreBlue} - ${scoreRed}`)
  })

  networkManager.on('connectionError', (error) => {
    console.error(`[TEST] Connection error: ${error}`)
  })

  // Attempt connection
  console.log('\n[TEST] Attempting connection...')
  const connected = await networkManager.connect()

  if (connected) {
    console.log('✅ [TEST] Connection successful!')
    console.log(`   Session ID: ${networkManager.getSessionId()}`)

    // Send a test input
    console.log('\n[TEST] Sending test input...')
    networkManager.sendInput({ x: 0.5, y: 0 }, false)

    // Wait 2 seconds to receive state updates
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Send action input (shoot/kick)
    console.log('\n[TEST] Sending action input...')
    networkManager.sendInput({ x: 0.5, y: 0 }, true)

    // Wait another 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Disconnect
    console.log('\n[TEST] Disconnecting...')
    networkManager.disconnect()

    console.log('✅ [TEST] Test completed successfully!')
    console.log('='.repeat(50))
  } else {
    console.error('❌ [TEST] Connection failed!')
    console.log('='.repeat(50))
  }
}

// Run the test
testNetworkConnection().catch((error) => {
  console.error('[TEST] Test failed with error:', error)
  process.exit(1)
})

import { test, expect, Browser } from '@playwright/test'
import { setTestRoomId, waitForPlayerReady } from './helpers/room-utils'
import { TEST_ENV } from "./config/test-env"

/**
 * Room Selection Test Suite
 *
 * Tests that clients can decide which room to join and that
 * rooms are properly isolated from each other.
 */

const CLIENT_URL = TEST_ENV.CLIENT_URL

test.describe('Room Selection', () => {
  test('Clients can choose which room to join', async ({ browser }, testInfo) => {
    // Create room IDs for two separate rooms
    const roomA = `room-a-${testInfo.workerIndex}-${Date.now()}`
    const roomB = `room-b-${testInfo.workerIndex}-${Date.now()}`

    console.log(`🏠 Testing room selection:`)
    console.log(`  Room A: ${roomA}`)
    console.log(`  Room B: ${roomB}`)

    // Helper to create a client with scoped logs
    const makeClient = async (label: string) => {
      const context = await browser.newContext()
      const page = await context.newPage()
      const logs: string[] = []
      page.on('console', msg => {
        const text = msg.text()
        logs.push(text)
        console.log(`[${label}] ${text}`)
      })
      return { context, page, logs }
    }

    const client1 = await makeClient('Client1/RoomA')
    const client2 = await makeClient('Client2/RoomB')
    const client3 = await makeClient('Client3/RoomA')
    const client4 = await makeClient('Client4/RoomB')

    // Assign clients to different rooms
    // Client 1 & 3 → Room A
    await setTestRoomId(client1.page, roomA)
    await setTestRoomId(client3.page, roomA)

    // Client 2 & 4 → Room B
    await setTestRoomId(client2.page, roomB)
    await setTestRoomId(client4.page, roomB)

    // Navigate all clients
    await Promise.all([
      client1.page.goto(CLIENT_URL),
      client2.page.goto(CLIENT_URL),
      client3.page.goto(CLIENT_URL),
      client4.page.goto(CLIENT_URL),
    ])

    // Wait for all clients to be ready
    await Promise.all([
      waitForPlayerReady(client1.page),
      waitForPlayerReady(client2.page),
      waitForPlayerReady(client3.page),
      waitForPlayerReady(client4.page),
    ])

    // Helper to get room ID from client
    const getRoomId = async (page: any) => page.evaluate(() => (window as any).__gameControls?.scene?.networkManager?.getRoom()?.roomId)

    const [id1, id2, id3, id4] = await Promise.all([
      getRoomId(client1.page),
      getRoomId(client2.page),
      getRoomId(client3.page),
      getRoomId(client4.page),
    ])

    // Verify connections are distinct and paired correctly
    // Note: getRoom()?.id returns the Colyseus Room ID.
    // Since we forced "roomName" via setTestRoomId, the server logic for room creation might vary,
    // but players joining the same roomName should end up in the same Room ID.

    // Verify Room A clients share the same Room ID
    expect(id1).toBeTruthy()
    expect(id1).toBe(id3)

    // Verify Room B clients share the same Room ID
    expect(id2).toBeTruthy()
    expect(id2).toBe(id4)

    // Verify Room A and Room B are different
    expect(id1).not.toBe(id2)

    // Clean up
    await client1.page.close()
    await client2.page.close()
    await client3.page.close()
    await client4.page.close()
    await client1.context.close()
    await client2.context.close()
    await client3.context.close()
    await client4.context.close()

    console.log(`✅ Room selection test passed!`)
  })

  test('Single client can join a specific named room', async ({ browser }, testInfo) => {
    const customRoomName = `my-custom-room-${testInfo.workerIndex}-${Date.now()}`

    console.log(`🎯 Testing single client joining custom room: ${customRoomName}`)

    const context = await browser.newContext()
    const client = await context.newPage()

    // Capture console logs
    const roomLogs: string[] = []
    client.on('console', msg => {
      const text = msg.text()
      roomLogs.push(text)
      console.log(`[Client] ${text}`)
    })

    // Set custom room ID
    await setTestRoomId(client, customRoomName)
    await client.goto(CLIENT_URL)
    await waitForPlayerReady(client)

    // Verify connection
    await expect.poll(() => roomLogs.some(log =>
      log.includes('Connected! Session ID:')
    ), { timeout: 4000 }).toBe(true)

    console.log(`✅ Client successfully joined custom room: ${customRoomName}`)

    // Clean up
    await client.close()
    await context.close()
  })
})

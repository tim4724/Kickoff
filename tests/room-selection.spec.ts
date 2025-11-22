import { test, expect, Browser } from '@playwright/test'
import { setTestRoomId } from './helpers/room-utils'
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

    // Wait for all clients to log their room selection and connection
    const waitForJoin = (logs: string[], room: string) =>
      expect.poll(() => logs.filter(l => l.includes('Using test room:')).length, { timeout: 4000 }).toBeGreaterThanOrEqual(1)
        .then(() => expect(logs.some(l => l.includes(room))).toBe(true))
        .then(() =>
          expect.poll(() => logs.filter(l => l.includes('Connected! Session ID:')).length, { timeout: 4000 }).toBeGreaterThanOrEqual(1)
        )

    await Promise.all([
      waitForJoin(client1.logs, roomA),
      waitForJoin(client2.logs, roomB),
      waitForJoin(client3.logs, roomA),
      waitForJoin(client4.logs, roomB),
    ])

    // Verify Room A clients joined the correct room
    // Verify rooms are isolated (room tags never cross)
    expect(client1.logs.some(log => log.includes(roomA))).toBe(true)
    expect(client3.logs.some(log => log.includes(roomA))).toBe(true)
    expect(client2.logs.some(log => log.includes(roomB))).toBe(true)
    expect(client4.logs.some(log => log.includes(roomB))).toBe(true)
    expect(client1.logs.every(log => !log.includes(roomB))).toBe(true)
    expect(client2.logs.every(log => !log.includes(roomA))).toBe(true)

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

    // Verify join + connection quickly
    await expect.poll(() => roomLogs.some(log =>
      log.includes('Using test room:') && log.includes(customRoomName)
    ), { timeout: 4000 }).toBe(true)

    await expect.poll(() => roomLogs.some(log =>
      log.includes('Connected! Session ID:')
    ), { timeout: 4000 }).toBe(true)

    console.log(`✅ Client successfully joined custom room: ${customRoomName}`)

    // Clean up
    await client.close()
    await context.close()
  })
})

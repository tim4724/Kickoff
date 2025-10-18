import { test, expect, Browser } from '@playwright/test'
import { setTestRoomId } from './helpers/room-utils'
import { waitScaled } from './helpers/time-control'
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

    // Create contexts and pages for 4 clients
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const context3 = await browser.newContext()
    const context4 = await browser.newContext()

    const client1 = await context1.newPage()
    const client2 = await context2.newPage()
    const client3 = await context3.newPage()
    const client4 = await context4.newPage()

    // Set up console logging
    const logs: { client: string; message: string }[] = []

    client1.on('console', msg => {
      const text = msg.text()
      logs.push({ client: 'Client1', message: text })
      console.log(`[Client1/RoomA] ${text}`)
    })
    client2.on('console', msg => {
      const text = msg.text()
      logs.push({ client: 'Client2', message: text })
      console.log(`[Client2/RoomB] ${text}`)
    })
    client3.on('console', msg => {
      const text = msg.text()
      logs.push({ client: 'Client3', message: text })
      console.log(`[Client3/RoomA] ${text}`)
    })
    client4.on('console', msg => {
      const text = msg.text()
      logs.push({ client: 'Client4', message: text })
      console.log(`[Client4/RoomB] ${text}`)
    })

    // Assign clients to different rooms
    // Client 1 & 3 → Room A
    await setTestRoomId(client1, roomA)
    await setTestRoomId(client3, roomA)

    // Client 2 & 4 → Room B
    await setTestRoomId(client2, roomB)
    await setTestRoomId(client4, roomB)

    // Navigate all clients
    await Promise.all([
      client1.goto(CLIENT_URL),
      client2.goto(CLIENT_URL),
      client3.goto(CLIENT_URL),
      client4.goto(CLIENT_URL),
    ])

    // Wait for all clients to connect and join rooms (longer wait for Phaser initialization)
    await Promise.all([
      waitScaled(client1, 5000),
      waitScaled(client2, 5000),
      waitScaled(client3, 5000),
      waitScaled(client4, 5000),
    ])

    // Verify Room A clients joined the correct room
    const roomALogs = logs.filter(
      log =>
        (log.client === 'Client1' || log.client === 'Client3') &&
        log.message.includes('Using test room:')
    )

    expect(roomALogs.length).toBeGreaterThanOrEqual(1)
    expect(roomALogs.some(log => log.message.includes(roomA))).toBe(true)
    console.log(`✅ Room A clients joined: ${roomA}`)

    // Verify Room B clients joined the correct room
    const roomBLogs = logs.filter(
      log =>
        (log.client === 'Client2' || log.client === 'Client4') &&
        log.message.includes('Using test room:')
    )

    expect(roomBLogs.length).toBeGreaterThanOrEqual(1)
    expect(roomBLogs.some(log => log.message.includes(roomB))).toBe(true)
    console.log(`✅ Room B clients joined: ${roomB}`)

    // Verify both rooms had "Connected!" messages (proves rooms were joined successfully)
    const connectedLogsRoomA = logs.filter(
      log =>
        (log.client === 'Client1' || log.client === 'Client3') &&
        log.message.includes('Connected! Session ID:')
    )
    const connectedLogsRoomB = logs.filter(
      log =>
        (log.client === 'Client2' || log.client === 'Client4') &&
        log.message.includes('Connected! Session ID:')
    )

    expect(connectedLogsRoomA.length).toBeGreaterThanOrEqual(2)
    expect(connectedLogsRoomB.length).toBeGreaterThanOrEqual(2)
    console.log(`✅ All clients successfully connected to their rooms`)

    // Verify rooms are isolated (different room IDs in logs)
    expect(
      roomALogs.some(log => log.message.includes(roomA)) &&
      !roomALogs.some(log => log.message.includes(roomB))
    ).toBe(true)
    expect(
      roomBLogs.some(log => log.message.includes(roomB)) &&
      !roomBLogs.some(log => log.message.includes(roomA))
    ).toBe(true)
    console.log(`✅ Verified rooms are isolated - clients joined correct rooms`)

    // Clean up
    await client1.close()
    await client2.close()
    await client3.close()
    await client4.close()
    await context1.close()
    await context2.close()
    await context3.close()
    await context4.close()

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

    // Wait for connection
    await waitScaled(client, 3000)

    // Verify client joined the custom room
    expect(roomLogs.some(log =>
      log.includes('Using test room:') && log.includes(customRoomName)
    )).toBe(true)

    // Verify connection was successful
    expect(roomLogs.some(log =>
      log.includes('Connected! Session ID:')
    )).toBe(true)

    console.log(`✅ Client successfully joined custom room: ${customRoomName}`)

    // Clean up
    await client.close()
    await context.close()
  })
})

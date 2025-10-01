/**
 * LatencyTracker - Measures input-to-visual lag and network round-trip time
 *
 * Usage:
 *   const tracker = new LatencyTracker(scene, networkManager)
 *   tracker.measureInputLag() // Returns Promise<number> in milliseconds
 *   tracker.measureNetworkRTT() // Returns Promise<number> in milliseconds
 */

import { NetworkManager } from '../network/NetworkManager'

export interface LatencyMeasurement {
  inputToVisual: number // ms from input to visual change
  networkRTT: number // ms round-trip to server
  timestamp: number // when measurement was taken
  playerPosition: { x: number; y: number } // position when measured
}

export class LatencyTracker {
  private networkManager?: NetworkManager
  private measurements: LatencyMeasurement[] = []
  private readonly MAX_HISTORY = 100

  constructor(_scene: Phaser.Scene, networkManager?: NetworkManager) {
    this.networkManager = networkManager
  }

  /**
   * Measure input-to-visual latency
   * Sends input and measures time until player position changes visibly
   */
  async measureInputLag(playerSprite: Phaser.GameObjects.GameObject & { x: number; y: number }): Promise<number> {
    return new Promise((resolve) => {
      const startTime = performance.now()
      const initialX = playerSprite.x
      const initialY = playerSprite.y

      // Send input movement
      if (this.networkManager) {
        this.networkManager.sendInput({ x: 1, y: 0 }, false)
      }

      // Poll for visual change (up to 500ms)
      const checkInterval = setInterval(() => {
        const currentX = playerSprite.x
        const currentY = playerSprite.y
        const moved = Math.abs(currentX - initialX) > 2 || Math.abs(currentY - initialY) > 2

        if (moved) {
          const lag = performance.now() - startTime
          clearInterval(checkInterval)
          resolve(lag)
        }
      }, 1) // Check every 1ms for precision

      // Timeout after 500ms
      setTimeout(() => {
        clearInterval(checkInterval)
        resolve(500) // Max lag value
      }, 500)
    })
  }

  /**
   * Measure network round-trip time (ping)
   * Sends timestamp to server and measures time until echo
   */
  async measureNetworkRTT(): Promise<number> {
    if (!this.networkManager) {
      return 0
    }

    return new Promise((resolve) => {
      const startTime = performance.now()
      const room = this.networkManager!.getRoom()

      if (!room) {
        resolve(0)
        return
      }

      // Listen for pong response (one-time)
      const handler = () => {
        const rtt = performance.now() - startTime
        resolve(rtt)
      }

      room.onMessage('pong', handler)

      // Send ping
      room.send('ping', { sent: startTime })

      // Timeout after 1 second
      setTimeout(() => {
        resolve(1000) // Max RTT value
      }, 1000)
    })
  }

  /**
   * Measure both input lag and network RTT
   */
  async measureComplete(playerSprite: Phaser.GameObjects.GameObject & { x: number; y: number }): Promise<LatencyMeasurement> {
    const [inputToVisual, networkRTT] = await Promise.all([
      this.measureInputLag(playerSprite),
      this.measureNetworkRTT()
    ])

    const measurement: LatencyMeasurement = {
      inputToVisual,
      networkRTT,
      timestamp: Date.now(),
      playerPosition: {
        x: playerSprite.x,
        y: playerSprite.y
      }
    }

    // Store measurement
    this.measurements.push(measurement)
    if (this.measurements.length > this.MAX_HISTORY) {
      this.measurements.shift()
    }

    return measurement
  }

  /**
   * Get average latency from recent measurements
   */
  getAverageLatency(count: number = 10): { inputToVisual: number; networkRTT: number } {
    const recent = this.measurements.slice(-count)
    if (recent.length === 0) {
      return { inputToVisual: 0, networkRTT: 0 }
    }

    const sum = recent.reduce(
      (acc, m) => ({
        inputToVisual: acc.inputToVisual + m.inputToVisual,
        networkRTT: acc.networkRTT + m.networkRTT
      }),
      { inputToVisual: 0, networkRTT: 0 }
    )

    return {
      inputToVisual: sum.inputToVisual / recent.length,
      networkRTT: sum.networkRTT / recent.length
    }
  }

  /**
   * Get all measurements
   */
  getMeasurements(): LatencyMeasurement[] {
    return [...this.measurements]
  }

  /**
   * Clear measurement history
   */
  clear(): void {
    this.measurements = []
  }

  /**
   * Export measurements as CSV for analysis
   */
  exportCSV(): string {
    const header = 'timestamp,inputToVisual,networkRTT,playerX,playerY\n'
    const rows = this.measurements.map(m =>
      `${m.timestamp},${m.inputToVisual.toFixed(2)},${m.networkRTT.toFixed(2)},${m.playerPosition.x.toFixed(1)},${m.playerPosition.y.toFixed(1)}`
    ).join('\n')

    return header + rows
  }
}

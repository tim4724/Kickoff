/**
 * NetworkSmoothnessMetrics
 *
 * Records per-frame sprite positions and computes smoothness metrics.
 * Zero-cost when not recording (early-exit on every sample call).
 */

interface PositionSample {
  x: number
  y: number
  timestamp: number
}

interface EntitySamples {
  preSyncPositions: PositionSample[]
  postSyncPositions: PositionSample[]
  reconciliationErrors: number[]
  stateChangeTimestamps: number[]
}

interface EntityReport {
  /** Average frame-to-frame position delta (pixels) */
  avgDelta: number
  /** Variance of frame-to-frame deltas */
  deltaVariance: number
  /** Standard deviation of frame-to-frame deltas */
  stdDev: number
  /** Largest single-frame position jump (pixels) */
  maxJump: number
  /** Frames with zero movement when movement was expected */
  stallCount: number
  /** Frames with delta > 2× average (visual pop) */
  jumpCount: number
  /** stallCount / totalFrames */
  stallRatio: number
  /** jumpCount / totalFrames */
  jumpRatio: number
  /** Total frames sampled */
  totalFrames: number
  /** Average reconciliation error (local player only) */
  avgReconciliationError: number
}

export class NetworkSmoothnessMetrics {
  private recording = false
  private entities = new Map<string, EntitySamples>()
  private lastServerPositions = new Map<string, { x: number; y: number }>()

  startRecording(): void {
    this.reset()
    this.recording = true
  }

  stopRecording(): void {
    this.recording = false
  }

  reset(): void {
    this.entities.clear()
    this.lastServerPositions.clear()
    this.recording = false
  }

  /** Call BEFORE lerp/sync — detects server state changes & measures reconciliation error */
  samplePreSync(
    serverState: any,
    localSprites: Map<string, { x: number; y: number }>,
    myPlayerId: string
  ): void {
    if (!this.recording) return
    if (!serverState?.players || !serverState?.ball) return

    const now = performance.now()

    // Sample ball pre-sync
    const ballKey = '__ball__'
    const ballEntity = this.getEntity(ballKey)
    const serverBallX = serverState.ball.x ?? 0
    const serverBallY = serverState.ball.y ?? 0

    const lastBall = this.lastServerPositions.get(ballKey)
    if (!lastBall || lastBall.x !== serverBallX || lastBall.y !== serverBallY) {
      ballEntity.stateChangeTimestamps.push(now)
      this.lastServerPositions.set(ballKey, { x: serverBallX, y: serverBallY })
    }

    // Sample players pre-sync
    serverState.players.forEach((player: any, playerId: string) => {
      const entity = this.getEntity(playerId)
      const serverX = player.x ?? 0
      const serverY = player.y ?? 0

      const lastPos = this.lastServerPositions.get(playerId)
      if (!lastPos || lastPos.x !== serverX || lastPos.y !== serverY) {
        entity.stateChangeTimestamps.push(now)
        this.lastServerPositions.set(playerId, { x: serverX, y: serverY })
      }

      // Reconciliation error for local player
      if (playerId === myPlayerId) {
        const sprite = localSprites.get(playerId)
        if (sprite) {
          const dx = sprite.x - serverX
          const dy = sprite.y - serverY
          entity.reconciliationErrors.push(Math.sqrt(dx * dx + dy * dy))
        }
      }

      entity.preSyncPositions.push({ x: serverX, y: serverY, timestamp: now })
    })

    ballEntity.preSyncPositions.push({ x: serverBallX, y: serverBallY, timestamp: now })
  }

  /** Call AFTER lerp/sync — captures final visual sprite positions */
  samplePostSync(
    ballSprite: { x: number; y: number },
    remotePlayers: Map<string, { x: number; y: number }>,
    _myPlayerId: string
  ): void {
    if (!this.recording) return

    const now = performance.now()

    // Ball post-sync
    const ballEntity = this.getEntity('__ball__')
    ballEntity.postSyncPositions.push({ x: ballSprite.x, y: ballSprite.y, timestamp: now })

    // Players post-sync
    remotePlayers.forEach((sprite, playerId) => {
      const entity = this.getEntity(playerId)
      entity.postSyncPositions.push({ x: sprite.x, y: sprite.y, timestamp: now })
    })
  }

  /** Compute smoothness report for all tracked entities */
  getSmoothnessReport(): Record<string, EntityReport> {
    const report: Record<string, EntityReport> = {}

    this.entities.forEach((samples, entityId) => {
      const positions = samples.postSyncPositions
      if (positions.length < 2) return

      const deltas: number[] = []
      let maxJump = 0

      for (let i = 1; i < positions.length; i++) {
        const dx = positions[i].x - positions[i - 1].x
        const dy = positions[i].y - positions[i - 1].y
        const delta = Math.sqrt(dx * dx + dy * dy)
        deltas.push(delta)
        if (delta > maxJump) maxJump = delta
      }

      const totalFrames = deltas.length
      const avgDelta = deltas.reduce((s, d) => s + d, 0) / totalFrames

      const deltaVariance =
        deltas.reduce((s, d) => s + (d - avgDelta) ** 2, 0) / totalFrames
      const stdDev = Math.sqrt(deltaVariance)

      // Stall: frame with zero movement (< 0.1px) when average movement is significant
      const stallThreshold = 0.1
      const stallCount = avgDelta > 1 ? deltas.filter((d) => d < stallThreshold).length : 0

      // Jump: frame with delta > 2× average
      const jumpThreshold = avgDelta * 2
      const jumpCount = deltas.filter((d) => d > jumpThreshold).length

      const avgReconciliationError =
        samples.reconciliationErrors.length > 0
          ? samples.reconciliationErrors.reduce((s, e) => s + e, 0) /
            samples.reconciliationErrors.length
          : 0

      report[entityId] = {
        avgDelta: Math.round(avgDelta * 100) / 100,
        deltaVariance: Math.round(deltaVariance * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        maxJump: Math.round(maxJump * 100) / 100,
        stallCount,
        jumpCount,
        stallRatio: Math.round((stallCount / totalFrames) * 1000) / 1000,
        jumpRatio: Math.round((jumpCount / totalFrames) * 1000) / 1000,
        totalFrames,
        avgReconciliationError: Math.round(avgReconciliationError * 100) / 100,
      }
    })

    return report
  }

  private getEntity(id: string): EntitySamples {
    let entity = this.entities.get(id)
    if (!entity) {
      entity = {
        preSyncPositions: [],
        postSyncPositions: [],
        reconciliationErrors: [],
        stateChangeTimestamps: [],
      }
      this.entities.set(id, entity)
    }
    return entity
  }
}

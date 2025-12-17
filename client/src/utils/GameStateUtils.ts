import { GeometryUtils } from '@shared/utils/geometry'
import type { GameEngineState } from '@shared/engine/types'
import type { Team } from '@shared/types'

/**
 * Game State Utilities
 * Helper functions for working with GameEngineState
 */
export class GameStateUtils {
  /**
   * Get player team by ID
   */
  static getPlayerTeam(state: GameEngineState, playerId: string): Team | null {
    const player = state.players.get(playerId)
    return player ? player.team : null
  }

  /**
   * Get all teammate IDs for a given player
   */
  static getTeammateIds(state: GameEngineState, myPlayerId: string): string[] {
    const myTeam = this.getPlayerTeam(state, myPlayerId)
    if (!myTeam) return []

    const teammates: string[] = []
    state.players.forEach((player, playerId) => {
      if (player.team === myTeam) {
        teammates.push(playerId)
      }
    })
    return teammates
  }

  /**
   * Find the teammate closest to the ball
   */
  static findBestInterceptor(
    state: GameEngineState,
    teammateIds: string[]
  ): string | null {
    if (teammateIds.length === 0) return null

    let bestPlayerId: string | null = null
    let bestDistance = Number.MAX_VALUE

    const ballX = state.ball.x
    const ballY = state.ball.y

    for (const playerId of teammateIds) {
      const player = state.players.get(playerId)
      if (!player) continue

      const distance = GeometryUtils.distanceSquared(player.x, player.y, ballX, ballY)

      if (distance < bestDistance) {
        bestDistance = distance
        bestPlayerId = playerId
      }
    }

    return bestPlayerId
  }
}

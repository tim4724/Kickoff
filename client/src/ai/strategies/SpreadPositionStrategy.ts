/**
 * SpreadPositionStrategy - Off-ball positioning
 *
 * Positions players to receive passes based on calculated options.
 */

import { PlayerRole } from '../types'
import { EnginePlayerData } from '@shared/engine/types'
import { PassOption } from '../utils/PassEvaluator'

export class SpreadPositionStrategy {
  /**
   * Assign players to their best pass receive positions
   *
   * @param players - Available players
   * @param passOptions - Calculated pass options
   * @returns Map of player ID to role
   */
  static getSpreadPassReceivePositions(
    players: EnginePlayerData[],
    passOptions: PassOption[]
  ): Map<string, PlayerRole> {
    const roles = new Map<string, PlayerRole>()
    const assignedPlayers = new Set<string>()

    // Pass options are already sorted by quality and anti-clustered
    // Just assign the best available option for each player
    for (const option of passOptions) {
      if (assignedPlayers.has(option.teammate.id)) continue

      roles.set(option.teammate.id, {
        goal: 'receivePass-spread',
        target: option.position
      })
      assignedPlayers.add(option.teammate.id)
    }

    // Handle any players who didn't get a pass option (fallback)
    // This shouldn't happen often if PassEvaluator covers the grid well
    for (const player of players) {
      if (!assignedPlayers.has(player.id)) {
        roles.set(player.id, {
          goal: 'stay',
          target: { x: player.x, y: player.y } // Stay put
        })
      }
    }

    return roles
  }
}

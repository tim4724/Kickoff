/**
 * SpreadPositionStrategy - Calculate optimal spread positions for receiving passes
 *
 * Uses PassEvaluator to position players at optimal "pass-to-space" locations.
 * Shared logic used by both DefensiveStrategy and OffensiveStrategy.
 *
 * Approach:
 * 1. Use PassEvaluator to generate and score candidate positions
 * 2. Assign each player to their best available position
 * 3. Ensure spacing by preferring positions not already taken
 */

import { PlayerRole } from '../types'
import { PlayerData } from '../../../../shared/src/types'
import { PassOption } from '../utils/PassEvaluator'

export class SpreadPositionStrategy {
  /**
   * Calculate spread positions for receiving passes
   * Uses PassEvaluator to find optimal pass-to-space positions
   *
   * @param offensivePlayers - Players to position for receiving passes
   * @param passOptions - Pre-calculated pass options (required)
   * @returns Map of player ID to role assignment
   */
  static getSpreadPassReceivePositions(
    offensivePlayers: PlayerData[],
    passOptions: PassOption[]
  ): Map<string, PlayerRole> {
    const roles = new Map<string, PlayerRole>()

    if (offensivePlayers.length === 0) {
      return roles
    }

    // Use provided pass options
    const options = passOptions

    // Track assigned players to avoid duplicates
    const assignedPlayers = new Set<string>()

    // Assign each player to their best available position
    for (const option of options) {
      if (assignedPlayers.has(option.teammate.id)) {
        // This player already has a position - skip to next option
        continue
      }

      // Assign this player to this position
      roles.set(option.teammate.id, {
        goal: 'receivePass-spread',
        target: option.position,
      })
      assignedPlayers.add(option.teammate.id)
    }

    // Fallback: any players without positions stay at current position
    for (const player of offensivePlayers) {
      if (!assignedPlayers.has(player.id)) {
        roles.set(player.id, {
          goal: 'stay',
          target: player.position,
        })
      }
    }

    return roles
  }
}

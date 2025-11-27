# AI Architecture

## Overview

The AI operates on a simple, high-level strategy system that adapts based on ball possession. At the core, the `TeamAI` class determines whether the team should be on offense or defense and assigns roles to individual `AIPlayer` instances accordingly.

## Key Components

-   **`AIManager.ts`**: The top-level manager that orchestrates all AI teams in the game.
-   **`TeamAI.ts`**: Manages a single team's strategy. It switches between `OffensiveStrategy` and `DefensiveStrategy` based on which team last possessed the ball.
-   **`AIPlayer.ts`**: Represents a single AI-controlled player, executing the specific goal assigned to it by `TeamAI` (e.g., "ATTACK," "SUPPORT," "DEFEND").

## Strategies

-   **`OffensiveStrategy.ts`**: Assigns attacking and supporting roles to players when the team has possession.
-   **`DefensiveStrategy.ts`**: Assigns defensive roles to players when the opponent has possession.

This streamlined structure allows for clear, role-based decision-making without the complexity of a scorer-based evaluation system.

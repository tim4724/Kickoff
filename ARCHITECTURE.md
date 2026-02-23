# Kickoff - System Architecture

## 🏗️ Architecture Overview

Kickoff is a real-time multiplayer arcade soccer game built on a classic client-server model.

-   **Client:** A lightweight web client built with PixiJS v8, responsible for rendering, input handling, and client-side prediction. It communicates with the server via WebSockets.
-   **Server:** An authoritative game server powered by Colyseus, which manages all game logic, physics simulation, and AI control. It is the single source of truth for the game state.
-   **Shared:** A common workspace for code shared between the client and server, primarily for game state schemas and type definitions.

---

## 📦 Component Breakdown

### Client Layer Components

1.  **PixiJS v8 Renderer**
    -   Manages all visual presentation, including the game field, players, ball, and UI.
    -   Uses a dual-layer system (Game World + UI) managed by `CameraManager` and PixiJS Containers.
    -   Handles letterboxing to support various screen aspect ratios.

2.  **Input Handler**
    -   Captures user input from a virtual on-screen joystick and action buttons.
    -   Sends timestamped input data to the server for processing.

3.  **Game State Manager (Client)**
    -   Maintains the local game state received from the server.
    -   Implements client-side prediction for the human-controlled player to provide responsive, zero-latency feedback.
    -   Uses state interpolation for other players and the ball to ensure smooth visual movement.

4.  **Colyseus Client SDK**
    -   Manages the WebSocket connection to the server.
    -   Receives game state updates from the server and passes them to the client's Game State Manager.
    -   Sends user inputs to the server.

---

### Server Layer Components

1.  **Colyseus Match Room**
    -   Each match takes place in a dedicated, server-side room instance.
    -   Manages the match lifecycle, including player joining, leaving, and the main game loop.
    -   Runs the game simulation at a fixed tick rate of 30 Hz.

2.  **Game State (Shared Schema)**
    -   The authoritative game state is defined in a Colyseus schema (`server/src/schema/GameState.ts`).
    -   This schema includes data for all players, the ball, the score, and the match timer.
    -   Colyseus automatically handles delta-compression, sending only the changes to clients to minimize bandwidth usage.

3.  **Game Logic Engine**
    -   Contains the core game mechanics, which are simulated exclusively on the server.
    -   **Physics Simulation:** A simple arcade-style physics model for player and ball movement, collisions, and goal detection.
    -   **AI Controller:** Manages the behavior of AI-controlled bots using a strategy-based system (`OffensiveStrategy` and `DefensiveStrategy`).
    -   **Cursor Switching:** Automatically assigns control of the nearest AI teammate to the human player based on proximity to the ball.

4.  **Matchmaking Service**
    -   A simple queue-based system that pairs players to create new match rooms.

---

## 🎮 Gameplay Mechanics

### Control Scheme

-   **Virtual Joystick** (left side of screen): Controls player movement.
-   **Action Button** (right side of screen): Context-sensitive button for passing and shooting. Power is determined by how long the button is held.
-   **Player Switching:** Control automatically switches to the AI teammate closest to the ball. A clear visual indicator highlights the currently controlled player.

### Match Structure

-   **Format:** 1 human + 2 AI bots vs. 1 human + 2 AI bots.
-   **Duration:** Short mobile sessions, typically around 2 minutes.
-   **Field:** Standard 1700×1000 pitch.
-   **Scoring:** The team with the most goals at the end of the match wins.

### AI Teammate Behavior

-   AI teammates are designed to be competent and supportive, not frustrating.
-   The AI operates on a strategy-based system, switching between offensive and defensive roles based on ball possession.
-   AI players automatically position themselves, attempt to intercept passes, and make runs to support the human player.

### Ball Mechanics

-   Simplified, arcade-style physics model. The ball has a slight "magnetism" to make dribbling and control more forgiving.
-   A player gains possession by moving close to the ball. The system includes pressure and lockout timers to prevent rapid possession changes.

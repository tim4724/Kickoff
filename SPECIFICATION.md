# Kickoff - Game Specification

**Document Status:** This document provides a high-level specification for the Kickoff game. For more detailed technical architecture, development commands, or gameplay constants, see `ARCHITECTURE.md`, `AGENTS.md`, and `shared/src/types.ts`.

---

## 🎯 Core Vision

**Elevator Pitch:** A fast-paced, 3v3 arcade soccer game designed for the mobile web. Each team consists of one human player and two AI-controlled teammates. The game focuses on quick, action-packed matches with intuitive controls.

---

## 🎮 Gameplay Mechanics

### Control Scheme

-   **Input System:**
    -   **Virtual Joystick** (left side of screen): Controls player movement.
    -   **Action Button** (right side of screen): A context-sensitive button for passing and shooting. Power is determined by how long the button is held.
-   **Player Switching:**
    -   Control automatically switches to the AI teammate closest to the ball, ensuring the player is always in the action.
    -   A clear visual indicator highlights the currently controlled player.

### Match Structure

-   **Format:** 1 human + 2 AI bots vs. 1 human + 2 AI bots.
-   **Duration:** Matches are designed for short mobile sessions, typically lasting around 2 minutes.
-   **Field:** The game is played on a standard 1920x1080 pitch.
-   **Scoring:** The team with the most goals at the end of the match wins.

### AI Teammate Behavior

-   **Core Goal:** AI teammates are designed to be competent and supportive, not frustrating.
-   **System:** The AI operates on a strategy-based system, switching between offensive and defensive roles based on ball possession.
-   **Responsibilities:** AI players will automatically position themselves, attempt to intercept passes, and make runs to support the human player.

### Ball Mechanics

-   **Physics:** The game uses a simplified, arcade-style physics model. The ball has a slight "magnetism" to make dribbling and control more forgiving.
-   **Possession:** A player gains possession by moving close to the ball. The system includes pressure and lockout timers to prevent rapid possession changes.

---

## 🏗️ Technical Foundation

### Frontend Stack

-   **Rendering Engine:** **Phaser 3** is used for its robust 2D rendering capabilities, mobile-first design, and active community support.
-   **Framework:** The client is built with **TypeScript** and **Vite** for type safety and a fast development workflow.

### Backend Stack

-   **Multiplayer Server:** **Colyseus** serves as the authoritative backend, managing game state, server-side logic, and real-time communication.
-   **Architecture:** The server uses a room-based architecture, with each match running in a separate, isolated instance.
-   **State Sync:** Colyseus handles state synchronization with delta-compression to ensure efficient, low-bandwidth communication with clients.

### Network Architecture

-   **Protocol:** Communication is handled via **WebSockets**.
-   **Tick Rate:** The server runs at a fixed **30 Hz tick rate**.
-   **Latency Handling:** The client uses **prediction** for the human-controlled player's actions to provide an immediate, lag-free experience. The server's authoritative state is used to reconcile any differences. Other entities are smoothly rendered using **interpolation**.

# Kickoff Roadmap (concise)

Current state: 3v3 multiplayer with AI bots, authoritative Colyseus server, client prediction, unified 1600×1000 coordinates, and a passing Playwright suite (40 tests).

## Done
- Core gameplay loop: movement, possession with pressure/lockouts, variable-power shooting.
- Networking: 30 Hz authoritative server, prediction + reconciliation, test ports isolated (3001/5174).
- Rendering/UX: dual cameras with letterboxing, mobile controls.
- AI: Hierarchical system (AIManager → TeamAI → AIPlayer) for 3v3 teams.
- Tooling: Auto-start test servers, 10× time acceleration, GHCR image publishing pipeline.

## Near-Term Focus
- Match flow polish (timer/UI/end screen).
- AI tuning and balance adjustments.
- Reduce flaky/failing cases if any regressions appear; keep tests green.

## References
- Operational guidance: `AGENTS.md`
- Quick usage: `README.md`, `QUICKSTART.md`
- AI deep dive: `client/src/ai/AI_STRUCTURE.md`
- Legacy references: `ARCHITECTURE.md`, `SPECIFICATION.md` (historical; verify against `shared/src/types.ts`)

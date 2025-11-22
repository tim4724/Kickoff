## Test Suite TODO / Streamlining Plan

Quick notes per spec file with proposed actions to reduce flakiness and runtime.

- `responsive-ui-navigation.spec.ts`: Already condensed to 6 tests; keep as-is, watch for menu click regressions.
- `room-selection.spec.ts`: Evaluate for redundant room-list checks; consider collapsing lobby assertions into a single flow.
- `lag-measurement.spec.ts`: Verify if timing-heavy; explore lowering iteration counts or using synthetic delays instead of real waits.
- `multiplayer-ai-control.spec.ts`: Check for overlap with ai-gameplay-flow; combine AI control assertions where possible.
- `two-player-room-join.spec.ts`: Known flake; add deterministic room IDs and reuse connection helper; merge team-assignment checks into single scenario.
- `player-lifecycle.spec.ts`: Targeted fixes for disconnect handling; ensure cleanup hooks; possibly merge with match-lifecycle coverage.
- `orientation-change-during-gameplay.spec.ts`: Trim duplicate orientation cases; keep one portrait/landscape swap with assertions.
- `multiplayer-e2e.spec.ts`: Audit length; split into smoke vs. extended; keep smoke in default run, gate extended via tag/profile.
- `multiplayer-network-sync.spec.ts`: Heaviest; reduce frames sampled and reuse fixtures; consider isolating ball-possession test as smoke only.
- `shooting-mechanics.spec.ts`: Check projectile/goal cases for overlong waits; reduce repetition with parameterized helper.
- `two-client-cross-visibility.spec.ts`: Ensure minimal steps; consider merging visibility checks into multiplayer-e2e smoke.
- `ai-gameplay-flow.spec.ts`: Possible overlap with multiplayer-ai-control; merge or mark one as smoke, one as extended.
- `multiplayer-restart-colors.spec.ts`: Quick sanity test; keep but ensure single restart loop only.
- `core-features-regression.spec.ts`: Inventory overlaps; split into smoke + extended, or mark slower cases for nightly profile.
- `game-field-rendering.spec.ts`: Keep single viewport sanity; avoid multiple size loops.
- `client-server-realtime-delta.spec.ts`: Timing-sensitive; reduce sample count and cap retries.
- `initial-position-sync.spec.ts`: Ensure deterministic seeds; potentially merge into multiplayer-network-sync smoke.
- `game-over-screen.spec.ts`: Keep as smoke; verify no extra waits after game end.
- `ball-capture.spec.ts`: Heavy physics; keep but ensure 10x time scale active; consider moving to extended profile if still slow.
- `player-switching.spec.ts`: Confirm unique coverage; if redundant with ai-control, consolidate.
- `match-lifecycle.spec.ts`: Overlaps with player-lifecycle; merge teardown/startup checks; keep only one “restart” path in smoke.

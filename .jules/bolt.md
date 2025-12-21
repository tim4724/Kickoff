## 2024-05-24 - Object Reuse in Game Loop
**Learning:** Reusing objects in the game loop (like `reusedInput` in `GameEngine.ts`) prevents garbage collection pressure, but requires careful reset and property copying to avoid "action at a distance" bugs where shared references corrupt state.
**Action:** When implementing object pooling, always ensure the reused object is explicitly reset at the start of use and that consumers (like `processPlayerInput`) only read primitives or copy values, never storing the reference itself.

## 2024-05-24 - Iteration Performance
**Learning:** In performance-critical rendering or physics loops (like `BaseGameScene.ts`), `for...of` loops are preferred over `.forEach()` to avoid the allocation overhead of callback functions for every element in every frame.
**Action:** Use `for (const [key, value] of map)` instead of `map.forEach((value, key) => ...)` in `update()` methods.

## 2025-12-21 - Optimization of Object Allocation in Nested Loops
**Learning:** In AI calculations involving lookahead simulation (like `InterceptionCalculator`), nested loops calling physics simulation helpers can generate thousands of short-lived objects per frame/tick. Using an `out` parameter pattern for object reuse dramatically reduces this pressure.
**Action:** When implementing simulation loops, pass a reusable "result" object to the inner simulation function instead of returning a new object every time.

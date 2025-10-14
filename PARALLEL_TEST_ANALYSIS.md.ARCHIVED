# Parallel Test Execution - Status & Findings

## Summary

**Status**: Multi-worker testing (2+ workers) is **NOT SUPPORTED**
**Recommendation**: Use **1 worker with 10x time acceleration**
**Root Cause**: Playwright browser context initialization concurrency issue

## Current Configuration

```bash
# ✅ Recommended (stable, fast)
npm run test:e2e -- --workers=1

# ❌ Not Working
npm run test:e2e -- --workers=2  # Fails
npm run test:e2e -- --workers=4  # Fails
```

## Test Results

| Workers | Status | Notes |
|---------|--------|-------|
| 1 | ✅ Pass | All 79 tests passing, 5-8 minutes |
| 2 | ❌ Fail | Browser initialization timeout |
| 4 | ❌ Fail | Browser initialization timeout |

## Root Cause

**Playwright browser concurrency issue**, NOT a server or physics problem:

1. Tests fail BEFORE game loads ("Loading Kickoff..." screen)
2. Browser contexts cannot be created reliably in parallel
3. Worker indices are inconsistent (saw 1,2,3,4,6,10,11,14,15 instead of 0,1)

## Infrastructure Improvements (Completed)

Despite multi-worker not working, we implemented production-ready improvements:

### Server (server/src/index.ts)
```typescript
// HTTP Server Tuning
httpServer.maxConnections = 0 // Unlimited
httpServer.keepAliveTimeout = 60000 // 60s
httpServer.headersTimeout = 61000

// WebSocket Transport
const transport = new WebSocketTransport({
  maxPayload: 1024 * 1024, // 1MB
  pingInterval: 10000,
  pingMaxRetries: 3,
  perMessageDeflate: false
})
```

### Client (client/vite.config.ts)
```typescript
server: {
  hmr: { overlay: false },
  cors: true,
  strictPort: false
}
```

### Time Acceleration
- GameClock system with 10x acceleration
- Fixed 60Hz physics for determinism
- Complete test helper ecosystem

## Performance

**Current (1 worker + 10x accel)**:
- Real time: 5-8 minutes
- Game time: 50-80 minutes (10x)
- Reliability: 100% (all tests pass)

**Theoretical (if multi-worker worked)**:
- 2 workers: 2.5-4 min (2x speedup)
- 4 workers: 1.5-2 min (3-4x speedup)

## Future Investigation

If multi-worker support is needed, investigate:

1. **Playwright Configuration**
   - Browser launch args for resource limits
   - Shared browser with isolated contexts
   - Browser instance pooling

2. **Alternative Approaches**
   - Different test runner (Cypress, WebDriver BiDi)
   - Custom test orchestration
   - Sequential batching with 10x-100x time acceleration

3. **System-Level**
   - OS file descriptor limits (`ulimit -n`)
   - Browser process limits
   - Memory/CPU constraints

## Recommendation

**Use 1 worker.** The 10x time acceleration provides excellent speed while maintaining 100% stability and deterministic physics.

For details, see:
- `TESTING.md` - Complete testing guide
- Git history - Full investigation details

# Kickoff Technical Documentation

Technical specifications, implementation details, and development workflow documentation.

## Current System Documentation

### Core Mechanics
- **[BALL_CAPTURE_MECHANISM.md](BALL_CAPTURE_MECHANISM.md)** - Possession system with pressure dynamics, lockouts, and magnetism
- **[LAG_OPTIMIZATION_SUMMARY.md](LAG_OPTIMIZATION_SUMMARY.md)** - Client prediction, server reconciliation, and performance optimizations
- **[INPUT_LAG_OPTIMIZATION_WORKFLOW.md](INPUT_LAG_OPTIMIZATION_WORKFLOW.md)** - Detailed lag reduction implementation

### Implementation Results
- **[SHOOTING_IMPLEMENTATION_RESULTS.md](SHOOTING_IMPLEMENTATION_RESULTS.md)** - Shooting mechanics, test coverage, bugs fixed
- **[CODE_IMPROVEMENTS_SUMMARY.md](CODE_IMPROVEMENTS_SUMMARY.md)** - Code quality and architecture improvements
- **[TEST_FAILURE_ANALYSIS.md](TEST_FAILURE_ANALYSIS.md)** - Recent test failures and fixes

### Completed Work
- **[CLEANUP_SUMMARY.md](CLEANUP_SUMMARY.md)** - Codebase cleanup and organization
- **[DUAL_CAMERA_CLEANUP.md](DUAL_CAMERA_CLEANUP.md)** - Camera system refactoring

## Archive

Historical implementation workflows and phase reports moved to `archive/` directory:
- Week-by-week development summaries
- Phase completion reports
- Initial test reports and bug analyses
- Implementation workflows for completed features

## Quick Reference

### Game Physics
- Player Speed: 250 px/s
- Ball Speed: 400 px/s (shot), 200 px/s (min)
- Ball Friction: 0.98/frame
- Possession Radius: 50px
- Pressure Radius: 120px

### Network Architecture
- Server: Authoritative (Colyseus 0.16)
- Update Rate: 30 Hz
- Client: Predictive with reconciliation (lerp factor: 0.3)
- Reconciliation: Adaptive (0.05-0.6 based on error)

### Testing
- Framework: Playwright
- Coverage: E2E gameplay, multiplayer sync, possession mechanics
- Location: `/tests/*.spec.ts`
- Run: `npm run test:e2e`

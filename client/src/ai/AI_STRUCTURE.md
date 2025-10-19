# AI Architecture Structure

## Overview
Scoring-based AI system where each possible action is evaluated independently and the highest-scoring action is selected.

## Directory Structure

```
client/src/ai/
├── AIPlayer.ts                   [EXISTING] Pure execution layer
├── TeamAI.ts                     [EXISTING] High-level coordinator
├── AIManager.ts                  [EXISTING] Multi-team manager
├── types.ts                      [UPDATED] Type definitions + ActionContext
│
├── scorers/                      [NEW] Action evaluators
│   ├── ActionScorer.ts           Base interface for all scorers
│   │
│   ├── possession/               [6 scorers] When I have the ball
│   │   ├── ShootScorer.ts
│   │   ├── DribbleToGoalScorer.ts
│   │   ├── DribbleToSpaceScorer.ts
│   │   ├── PassScorer.ts
│   │   ├── ThroughBallScorer.ts
│   │   └── ClearBallScorer.ts
│   │
│   ├── support/                  [5 scorers] When teammate has ball
│   │   ├── ReceivePassScorer.ts
│   │   ├── SupportRunScorer.ts
│   │   ├── OfferPassingLaneScorer.ts
│   │   ├── MaintainSpacingScorer.ts
│   │   └── OverlapRunScorer.ts
│   │
│   ├── defensive/                [6 scorers] When opponent has ball
│   │   ├── InterceptBallScorer.ts
│   │   ├── PressCarrierScorer.ts
│   │   ├── MarkOpponentScorer.ts
│   │   ├── BlockPassingLaneScorer.ts
│   │   ├── HoldPositionScorer.ts
│   │   └── TrackBackScorer.ts
│   │
│   ├── transition/               [3 scorers] When ball is loose
│   │   ├── ChaseBallScorer.ts
│   │   ├── AnticipateInterceptScorer.ts
│   │   └── SecondBallScorer.ts
│   │
│   └── special/                  [3 scorers] Special situations
│       ├── CounterAttackScorer.ts
│       ├── HoldPossessionScorer.ts
│       └── RecycleScorer.ts
│
├── strategies/                   [NEW] Decision makers
│   ├── PossessionDecisionMaker.ts   Evaluates possession scorers
│   ├── SupportDecisionMaker.ts      Evaluates support scorers
│   ├── DefensiveDecisionMaker.ts    Evaluates defensive scorers
│   └── TransitionDecisionMaker.ts   Evaluates transition scorers
│
└── utils/                        [NEW] Shared utilities
    ├── InterceptionCalculator.ts    Ball interception logic
    └── SpatialAnalysis.ts           Geometry helpers
```

## Total Files Created
- **23 Scorers** (all game situations covered)
- **4 Decision Makers** (context-aware selection)
- **2 Utility Modules** (shared calculations)
- **1 Base Interface** (ActionScorer)
- **1 Types Update** (ActionContext, ActionScore, AI_CONSTANTS)

## Implementation Status
✅ **Complete Structure** - All files created with skeleton implementations
⏳ **Ready for Implementation** - Each scorer has TODO markers for logic

## Next Steps (Iterative Implementation)
1. Extract InterceptionCalculator logic from TeamAI.ts
2. Implement SpatialAnalysis utility methods
3. Implement scorers one by one (start with possession)
4. Wire decision makers into TeamAI
5. Test and tune scoring weights

## Key Design Principles
- **Separation of Concerns**: Each scorer handles one specific action
- **Scoring System**: All actions return 0-1 score, highest wins
- **Directional Threats**: No more "nearest opponent", use cone-based queries
- **Context-Aware**: Different decision makers for different situations
- **Extensible**: Easy to add new scorers without changing existing code
- **Testable**: Each scorer can be unit tested independently

# Phase 6.5+: DAG-Based Routing Enhancement (2026-02-01)

> Extracted from `docs/CHANGELOG-PHASES.md` to keep the changelog lean.
> See main phase doc: `docs/phases/phase-7-multi-plant-support.md` for broader context.

---

## Overview

Enhanced Routings to support parallel/concurrent process flows using a Directed Acyclic Graph (DAG) model.

**Example Flow:**
```
   SMT (start)
     |
     v
   +------------------+
   |                  |
   v                  v
  ICT           Conformal  (parallel - both follow SMT)
   |                  |
   +------------------+
           |
           v
       Assembly (waits for BOTH)
```

---

## IE Agent Validation

| Aspect | Assessment |
|--------|------------|
| **Theoretical soundness** | Excellent — DAG is the correct abstraction for manufacturing flows |
| **Practical applicability** | Good — covers 90%+ of real manufacturing flows |
| **Extensibility** | Good — foundation supports future simulation |

---

## Database Tables

**Migration:** `migrations/009_model_area_routing.sql`

```sql
model_area_routing (
  id, model_id, area_code, sequence,
  is_required BOOLEAN DEFAULT TRUE,
  expected_yield DECIMAL DEFAULT 1.0,   -- future: yield cascade
  volume_fraction DECIMAL DEFAULT 1.0,  -- future: split path demand
)

model_area_predecessors (
  id, model_id, area_code, predecessor_area_code,
  dependency_type TEXT DEFAULT 'finish_to_start'
)
```

---

## IPC Channels

```typescript
ROUTING_CHANNELS = {
  GET_BY_MODEL: 'routing:get-by-model',
  SET_ROUTING: 'routing:set-routing',
  SET_PREDECESSORS: 'routing:set-predecessors',
  DELETE_ROUTING: 'routing:delete-routing',
  VALIDATE_DAG: 'routing:validate-dag',
  GET_TOPOLOGICAL_ORDER: 'routing:get-topological-order',
  HAS_ROUTING: 'routing:has-routing',
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `migrations/009_model_area_routing.sql` | Database tables |
| `src/shared/types/routing.ts` | TypeScript types |
| `src/main/database/repositories/SQLiteModelAreaRoutingRepository.ts` | Repository with Kahn's algorithm for cycle detection |
| `src/main/ipc/handlers/routing.handler.ts` | IPC handlers |
| `src/renderer/features/routings/store/useRoutingStore.ts` | DAG routing state management |
| `src/renderer/features/routings/components/PredecessorSelector.tsx` | UI: predecessor selection |
| `src/renderer/features/routings/components/EditRoutingModal.tsx` | UI: edit routing with DAG |

---

## Features Implemented

- [x] DAG data model for parallel process flows
- [x] `finish_to_start` dependency semantics
- [x] Cycle detection using Kahn's algorithm
- [x] Orphan detection (areas unreachable from start)
- [x] Predecessor selection UI in Edit Routing modal
- [x] Real-time DAG validation indicator
- [x] Color-coded area types (start=green, end=purple, intermediate=blue)
- [x] Predecessor count badges on flow badges
- [x] Backward compatible — models without DAG config continue to work
- [x] Clear Routing feature with Cancel-as-rescue pattern
- [x] User-friendly cycle prevention message

---

## Bug Fixes

- **Duplicate line addition**: Fixed React state mutation bug where `.push()` caused duplicate lines in StrictMode
- **Cycle detection UX**: Changed cryptic message to clearer "Not available — X already runs after this area"

---

## Future Schema Fields (Not Yet in UI)

These fields are in the schema for future use:
- `expected_yield` — for yield cascade calculations in optimizer
- `volume_fraction` — for split path demand distribution
- `min_buffer_time_hours` — cure time, cooling time between stages

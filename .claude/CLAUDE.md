# Line Optimizer - Project Context

> **⚠️ CRITICAL: READ THIS AFTER EVERY COMPACTION**
> This file contains agent orchestration rules that MUST be followed. If you just resumed from a compacted conversation, re-read this entire file before proceeding.

---

## 🤖 Agent Orchestration (MANDATORY)

**Claude MUST automatically select and invoke the appropriate agents for each task.**

### Agent Routing Rules

| Task Type | Trigger Keywords | Agent Type (exact) |
|-----------|------------------|-------------------|
| React components, UI, styling, windows | "component", "UI", "modal", "window", "canvas" | `frontend-developer` |
| UX/UI design, wireframes, user flows | "UX", "UI design", "wireframe", "user flow", "layout" | `ux-ui-designer` |
| Optimizer algorithm, manufacturing logic | "optimizer", "allocation", "utilization", "constraint" | `Industrial Engineer` |
| Electron main process, IPC, services | "IPC", "main process", "BrowserWindow", "service" | `backend-architect` |
| Database schema, migrations, queries | "schema", "migration", "query", "SQLite" | `database-architect` |
| After writing/modifying code | (always after implementation) | `code-reviewer` |
| Tests, coverage, CI/CD testing | "test", "coverage", "spec", "vitest" | `test-engineer` |
| Performance bottlenecks | "slow", "performance", "memory" | `performance-profiler` |
| Codebase exploration, finding code | "where is", "how does", "find" | `Explore` |

### Custom Agent: UX/UI Designer

The `ux-ui-designer` agent is a **World-Class Product Designer** with expertise from Apple, Airbnb, Stripe, and Google. **Consult this agent for:**
- UI/UX design decisions and patterns
- Modal vs. page vs. inline editing decisions
- Data table design and navigation architecture
- Accessibility and design system recommendations
- Manufacturing/industrial software design patterns

**Location:** `~/.claude/agents/ux-ui-designer.md`

### Custom Agent: Industrial Engineer

The `Industrial Engineer` agent is a **World-Class Manufacturing Expert** with 13 years automotive experience at BorgWarner. **ALWAYS consult this agent for:**
- Any changes to the Python optimizer algorithm
- New metrics or KPI calculations
- Manufacturing logic decisions (cycle time, efficiency, constraints)
- Algorithm correctness validation
- Theory of Constraints analysis

### Parallel Execution

When tasks are independent, invoke multiple agents in parallel:
- New Electron feature → `backend-architect` (main) + `frontend-developer` (renderer) in parallel
- After implementation → `code-reviewer` to verify quality
- Algorithm changes → `Industrial Engineer` to validate, then `code-reviewer`

### Multi-Component Features

For features that span multiple layers (like a new window):
1. `backend-architect` for main process / IPC / window management
2. `frontend-developer` for React components / UI
3. `Industrial Engineer` if it affects how manufacturing data is displayed

---

## Current State

**Version:** 0.6.5 (DAG-Based Routing)
**Last Updated:** 2026-02-01
**Developer:** Aaron Zapata (Supervisor Industrial Engineering, BorgWarner)

### Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Canvas Feature (ReactFlow) | ✅ Complete |
| Phase 2 | CRUD Lines (Add/Edit/Delete) | ✅ Complete |
| Phase 3.4 | Multi-Sheet Excel Import | ✅ Complete |
| Phase 3.5 | Analysis Control Bar | ✅ Complete |
| Phase 4.1 | Python Optimizer Algorithm | ✅ Complete |
| Phase 4.2 | Results UI & Multi-Window | ✅ Complete |
| Phase 5 | Changeover Matrix | ✅ Complete |
| Phase 5.5 | Changeover Capacity Constraints | ✅ Complete |
| Phase 5.6 | Changeover Toggle Controls | ✅ Complete |
| Phase 6.0 | Sidebar Navigation Foundation | ✅ Complete |
| Phase 6A+ | Models + Volumes CRUD | ✅ Complete |
| Phase 6D | Custom Areas CRUD | ✅ Complete |
| Phase 6B | Line-Model Compatibilities | ✅ Complete |
| Phase 6.5 | Routings View | ✅ Complete |
| Phase 6.5+ | DAG-Based Routing | ✅ Complete |

### Current Capabilities

1. **Data Import**: Multi-sheet Excel import (Lines, Models, Compatibilities, Areas, **Changeover**)
2. **Canvas**: Interactive production line visualization with drag & drop
3. **Analysis**: Python-based optimization with 17ms execution time
4. **Multi-Window**: Timeline window auto-opens in separate window for multi-monitor setups
5. **Results Panel**: Detailed utilization by area, line, and model with constraint drill-down
6. **Changeover Matrix**: Three-tier resolution (Global → Family → Line) with Excel import and UI editor
7. **Routings**: Model-centric process flow view with DAG-based parallel process support

---

## Target Audience

**This tool is NOT for shop floor operators.** It is designed for strategic capacity planning by:

| User Type | Primary Use Case |
|-----------|------------------|
| **Industrial Engineers** | Capacity planning, scenario analysis, constraint identification, volume allocation |
| **Plant Managers** | Strategic decisions, resource allocation, investment justification |
| **Corporate/Regional Teams** | Multi-plant capacity visibility, global planning, new business feasibility |

### Design Implications

- **Yearly volumes** are the primary view (not daily/hourly for operators)
- **Multi-year analysis** for strategic planning horizons
- **Detailed tables** are appropriate - users are technical
- **English interface** - corporate/engineering standard
- **Scenario comparison** is high priority for decision-making
- **Executive dashboards** for management presentations

### NOT in Scope

- Real-time production monitoring (that's MES)
- Operator work instructions
- Shop floor displays
- Shift-level scheduling

---

## Tech Stack

```
Electron 28 + React 18 + TypeScript
├── SQLite (local database via better-sqlite3)
├── Zustand (state management)
├── ReactFlow (canvas visualization)
├── Vite (build tool)
└── Python 3 (optimization algorithm)
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              ELECTRON DESKTOP APP                        │
├─────────────────────────────────────────────────────────┤
│  RENDERER (React)          │  MAIN (Node.js)            │
│  ├── Canvas Feature        │  ├── IPC Handlers          │
│  ├── Analysis Control Bar  │  ├── SQLite Database       │
│  ├── Results Panel         │  ├── DataExporter          │
│  └── Import Wizard         │  └── PythonBridge          │
├─────────────────────────────────────────────────────────┤
│                    PYTHON OPTIMIZER                      │
│  Optimizer/optimizer.py - Line utilization algorithm    │
└─────────────────────────────────────────────────────────┘
```

---

## Key Files

| Purpose | Location |
|---------|----------|
| **Phase 5.6 Toggle Controls** | `docs/phases/phase-5.6-changeover-toggle-controls.md` |
| Phase 5 Changeover | `docs/phases/phase-5-changeover-matrix.md` |
| Phase 3.5 Summary | `docs/phases/phase-3.5-summary.md` |
| Excel import spec | `docs/phases/phase-3.4-summary.md` |
| Python optimizer | `Optimizer/optimizer.py` |
| Algorithm changelog | `Optimizer/CHANGELOG.md` |
| Analysis store | `src/renderer/features/analysis/store/useAnalysisStore.ts` |
| Results display | `src/renderer/features/analysis/components/ResultsPanel.tsx` |
| Constraint timeline | `src/renderer/features/analysis/components/ConstraintTimeline.tsx` |
| Timeline window page | `src/renderer/pages/TimelineWindowPage.tsx` |
| Window handler | `src/main/ipc/handlers/window.handler.ts` |
| Python bridge | `src/main/services/python/PythonBridge.ts` |
| Data exporter | `src/main/services/analysis/DataExporter.ts` |
| **Changeover types** | `src/shared/types/changeover.ts` |
| **Changeover repository** | `src/main/database/repositories/SQLiteChangeoverRepository.ts` |
| **Changeover handler** | `src/main/ipc/handlers/changeover.handler.ts` |
| **Changeover store** | `src/renderer/features/changeover/store/useChangeoverStore.ts` |
| **Changeover migrations** | `src/main/database/migrations/005_changeover.sql`, `006_fix_changeover_view.sql` |

---

## Database Schema

```sql
-- Core tables
production_lines          -- Line metadata (name, area, time_available_daily)
product_models_v2         -- Model metadata (name, customer, program, family)
product_volumes           -- Multi-year volumes (model_id, year, volume, operations_days)
line_model_compatibilities -- Line-model pairs (cycle_time, efficiency, priority)

-- Phase 5: Changeover tables ✅
user_preferences              -- Global settings (changeover_default_minutes, smed_benchmark)
family_changeover_defaults    -- Family-to-family default changeover times
line_changeover_overrides     -- Line-specific changeover exceptions (sparse)
changeover_method_configs     -- Calculation method preferences
v_resolved_changeover_times   -- VIEW: Three-tier resolution (line > family > global)

-- Phase 6.5: Model Area Routing (DAG) ✅
model_area_routing            -- Areas in model's process flow (yield, volume_fraction)
model_area_predecessors       -- Predecessor relationships (DAG edges)
```

**Database location:** `~/Library/Application Support/Line Optimizer/line-optimizer.db`

---

## Algorithm Key Concepts

### Per-Area Processing
Each manufacturing area (SMT, ICT, Conformal, Router, Final Assembly) processes the FULL demand independently because products flow through ALL areas sequentially.

### Sequential Operations Must Be Separate Areas

**CRITICAL DATA MODELING RULE**: If operations are **sequential** (every unit must pass through each), they must be modeled as **separate areas**.

**Wrong** (treats operations as interchangeable alternatives):
```
Area: SUBASSEMBLY
Lines: HVDC 1, HVAC 1, GDB 1, FSW 1  ← Optimizer picks fastest, others show 0%
```

**Correct** (each operation processes full demand):
```
Area: SUB-HVDC  → Lines: HVDC 1, HVDC 2
Area: SUB-HVAC  → Lines: HVAC 1, HVAC 2
Area: SUB-GDB   → Lines: GDB 1, GDB 2
Area: SUB-FSW   → Lines: FSW 1, FSW 2
```

When operations are in the **same area**, the optimizer treats them as alternative paths and allocates all demand to the most efficient line (fastest cycle time), leaving other lines at 0% utilization.

### Priority Distribution (Area-Wide)
Priority is respected across the entire area, not just within each line:
```
Priority 1 models distributed to ALL compatible lines first
Then Priority 2 models get remaining capacity
```

### Time Constraint (Not Piece Count)
The constraint is available TIME, not a fixed piece count. Multiple models with different cycle times can produce varying total pieces within the same time window.

### Core Formula
```python
adjusted_cycle_time = cycle_time / (efficiency / 100)
max_units = available_time / adjusted_cycle_time
allocated_units = min(max_units, daily_demand)
```

### Changeover Matrix (Phase 5)

**Problem**: Current optimizer assumes zero changeover time (unrealistic).

**Solution**: N×N matrix per line capturing time to switch from Model A to Model B.

**Three-Tier Resolution** (single database, priority lookup):
1. **Line Override** (highest): Specific line+model pair → Use this value
2. **Family Default** (medium): Family-to-family baseline → Use if no override
3. **Global Default** (fallback): 30 minutes → Use if nothing else matches

**Probability-Weighted Formula**:
```python
# Weight each transition by likelihood based on demand mix
Expected_per_changeover = Σ P[i] × P[j] × Time[i,j] / (1 - HHI)

# Estimate changeovers using effective model count (Phase 5.5)
N_eff = 1 / HHI  # Effective number of equal-sized models
num_changeovers = (N_eff - 1), bounded by practical constraints

Total_changeover_loss = Expected_per_changeover × num_changeovers

# Where:
# P[i] = proportion of demand for model i
# HHI = Σ P[i]² (concentration index)
# Time[i,j] = changeover time from model i to j (from matrix)
```

**Capacity-Reducing Behavior** (Phase 5.5):
```
Phase 1: Initial allocation (full available time)
Phase 2: Calculate changeover → If over capacity, scale down production
Phase 3: Track additional unfulfilled demand
```

**Full specification**: `docs/phases/phase-5-changeover-matrix.md`

---

## Common Commands

```bash
# Development
npm start              # Start app with HMR
npm run type-check     # TypeScript validation

# Database
npm run db:reset       # Delete database and start fresh (only when needed)
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db

# Test optimizer
python3 Optimizer/test_priority_distribution.py
```

> **Note:** You no longer need to delete the database before every `npm start`. The migration system tracks which migrations have run. Only use `npm run db:reset` when I tell you a schema change requires it.

---

## Completed in Phase 4.2

- [x] Dedicated line bottleneck detection (constraintType, constrainedLines)
- [x] Constraint drill-down with Pareto analysis
- [x] Multi-window support (ConstraintTimeline in separate window)
- [x] Auto-open Timeline window when analysis completes
- [x] Live updates to Timeline when re-running analysis
- [x] Status badge in Canvas showing "Analysis Complete"

## Completed in Phase 5: Changeover Matrix ✅

**Full specification**: `docs/phases/phase-5-changeover-matrix.md`

### Phase 5.1: Foundation ✅
- [x] TypeScript types (`src/shared/types/changeover.ts`)
- [x] Database migration (`005_changeover.sql`, `006_fix_changeover_view.sql`)
- [x] Repository (`SQLiteChangeoverRepository.ts`) + IPC handlers
- [x] IPC channels registered in `preload.ts`

### Phase 5.2: UI Components ✅
- [x] Changeover button on canvas nodes
- [x] Matrix editor modal (`ChangeoverMatrixModal.tsx`)
- [x] Zustand store (`useChangeoverStore.ts`)

### Phase 5.3: Excel Import ✅
- [x] "Changeover" sheet detection and parsing in `MultiSheetImporter.ts`
- [x] Validation in `MultiSheetValidator.ts`
- [x] Import handler in `multi-sheet-excel.handler.ts`
- [x] Test data: 433 family-to-family entries in test fixture

### Phase 5.4: Optimizer Integration ✅
- [x] Changeover data exported via `DataExporter.ts`
- [x] Changeover impact calculated in `optimizer.py`
- [x] Results shown in `ResultsPanel.tsx`

### Phase 5.5: Changeover Enhancements ✅ (2026-01-27)

**Bug Fixes:**
- [x] Fixed matrix editor input focus timing (double-keypress bug) - callback ref instead of useEffect

**UI Improvements:**
- [x] Added calculation method selector dropdown in Changeover Modal
- [x] Users can now choose: Probability-Weighted, Simple Average, or Worst Case
- [x] Method preference saved to database via IPC

**Algorithm Improvements (validated by Industrial Engineer agent):**

1. **Improved Changeover Count Heuristic**:
   ```python
   # Old: estimated_changeovers = max(1, num_models - 1)  # Too simplistic
   # New: Uses effective model count based on HHI
   N_eff = 1 / HHI  # Effective number of equal-sized models
   estimated_changeovers = (N_eff - 1), bounded by practical constraints
   ```

   | Scenario | HHI | N_eff | Changeovers/day |
   |----------|-----|-------|-----------------|
   | Balanced (5×20%) | 0.20 | 5.0 | 4.0 |
   | Dominated (70/10/10/5/5) | 0.51 | 1.9 | 1.0 |
   | High-mix (10×10%) | 0.10 | 10.0 | 9.0 |

2. **Changeover as Capacity Constraint**:
   - Previously: Changeover was informational only (didn't affect allocation)
   - Now: Changeover **reduces available capacity**
   - If (production + changeover) > available time → scale down production
   - Additional unfulfilled demand tracked automatically

**New Output Fields:**
- `hhi` - Herfindahl-Hirschman Index (demand concentration)
- `effectiveModels` - Numbers equivalent (1/HHI)
- `capacityAdjusted` - Boolean flag if line was scaled down

**Files Modified:**
- `Optimizer/optimizer.py` - Added `apply_changeover_capacity_reduction()` function
- `src/renderer/features/changeover/components/ChangeoverMatrixModal.tsx` - Method selector
- `src/renderer/features/changeover/components/MatrixTable.tsx` - Focus fix
- `src/renderer/features/changeover/components/FamilyMatrixView.tsx` - Focus fix
- `src/renderer/features/changeover/store/useChangeoverStore.ts` - `setCalculationMethod` action

## Phase 5.6: Changeover Toggle Controls ✅ (2026-01-28)

**Full specification**: `docs/phases/phase-5.6-changeover-toggle-controls.md`

### Feature Overview

Toggle controls for changeover calculation at two levels:
1. **Global Toggle** (Analysis Control Bar): Enable/disable changeover for entire analysis
2. **Per-Line Toggle** (Canvas Nodes): Enable/disable changeover for specific lines

### Toggle Hierarchy (True Override)

| Global | Line | Result |
|--------|------|--------|
| OFF | OFF | No changeover (theoretical) |
| OFF | **ON** | Changeover calculated (critical override) |
| ON | OFF | No changeover (exclusion) |
| ON | ON | Changeover calculated (realistic) |

### Stacked Bar Visualization

Canvas nodes show time allocation after analysis:
```
┌─────────────────────────────────────┐
│  SMT Line 1                🔴 🔄   │
│  ██████████████░░░░░░░░░░  87%     │
│   Production  CO    Available      │
│     70.5%    16.5%    13%          │
└─────────────────────────────────────┘
```

**Color Scheme:**
- Blue (`#3B82F6`): Production time
- Amber (`#F59E0B`): Changeover time
- Gray (`#E5E7EB`): Available capacity

**Border Color by Utilization:**
- Gray: < 70% (underutilized)
- Blue: 70-85% (healthy)
- Amber: 85-95% (approaching constraint)
- Red: > 95% (at/over capacity)

### Implementation Tasks

- [x] Database migration (`007_changeover_toggles.sql`)
- [x] Per-line `changeover_enabled` column
- [x] Global `changeover_global_enabled` preference
- [x] IPC handlers for toggle state
- [x] Global toggle in Analysis Control Bar
- [x] Per-line toggle icon on canvas nodes
- [x] Stacked bar visualization
- [x] Optimizer respects toggle flags

### Phase 5.6.1: Critical Override Enhancement (2026-01-29)

- [x] Database migration (`008_changeover_explicit.sql`) - Track explicit user toggles
- [x] `changeoverExplicit` field to track user-set overrides
- [x] True override logic in Python optimizer
- [x] Critical override UI indicator (red ring when global OFF but line explicitly ON)

**Files Added:**
- `src/main/database/migrations/007_changeover_toggles.sql`
- `src/main/database/migrations/008_changeover_explicit.sql` - Phase 5.6.1
- `src/renderer/features/analysis/components/ChangeoverToggle.tsx`

**Files Modified:**
- `src/shared/types/index.ts` - Added `changeoverEnabled` and `changeoverExplicit` to ProductionLine
- `src/shared/constants/index.ts` - Added IPC channels for toggle operations
- `src/domain/entities/ProductionLine.ts` - Added `changeoverEnabled` and `changeoverExplicit` fields
- `src/main/database/repositories/SQLiteProductionLineRepository.ts` - Toggle methods with explicit tracking
- `src/main/database/repositories/SQLiteChangeoverRepository.ts` - Added global toggle methods
- `src/main/ipc/handlers/production-lines.handler.ts` - Added per-line toggle handler
- `src/main/ipc/handlers/changeover.handler.ts` - Added global toggle handlers
- `src/main/services/analysis/DataExporter.ts` - Export toggle states to Python
- `Optimizer/optimizer.py` - True override logic in `should_calculate_changeover()`
- `src/renderer/features/analysis/store/useAnalysisStore.ts` - Global toggle state
- `src/renderer/features/analysis/components/AnalysisControlBar.tsx` - Added ChangeoverToggle
- `src/renderer/features/canvas/components/nodes/ProductionLineNode.tsx` - Per-line toggle + stacked bar + critical override UI
- `src/renderer/features/canvas/hooks/useLoadLines.ts` - Load changeoverEnabled and changeoverExplicit

### Phase 5.6.3: Simplified UI (2026-01-30)

Simplified the changeover toggle UI from a dropdown menu to three clear buttons:

```
┌─────────────────────────────────────────────────────────────────┐
│  🕐 Changeover:  [All ON]  [All OFF]  [↺ Reset]                 │
└─────────────────────────────────────────────────────────────────┘
```

| Button | Action |
|--------|--------|
| **All ON** | Enables changeover for ALL lines + sets global to ON |
| **All OFF** | Disables changeover for ALL lines + sets global to OFF |
| **Reset** | Resets ALL lines to match current global state + clears sticky flags |

**Sticky Behavior**: Lines manually toggled on canvas become "sticky" and ignore All ON/All OFF. Reset clears sticky flags.

**Files Modified:**
- `src/renderer/features/analysis/components/ChangeoverToggle.tsx` - Replaced dropdown with 3 buttons
- `src/main/database/repositories/SQLiteProductionLineRepository.ts` - Reset accepts target state
- `src/main/ipc/handlers/production-lines.handler.ts` - Handler passes state to repository

### Canvas UX Improvements (2026-01-30)

Added AutoCAD-style selection and cursor behavior:

**Box Selection:**
- Left-click + drag on empty space creates a selection rectangle
- All nodes touching the rectangle are selected (`SelectionMode.Partial`)
- Cmd/Ctrl + click to add to selection

**Panning:**
- Middle-click + drag to pan
- Right-click + drag to pan

**CAD-Style Cursors:**
| Context | Cursor |
|---------|--------|
| Canvas (default) | Crosshair `+` |
| Panning | Grabbing hand |
| Hovering node | Pointer |
| Dragging node | Grabbing hand |

**Files Modified:**
- `src/renderer/features/canvas/ProductionCanvas.tsx` - Selection and pan settings
- `src/renderer/styles/globals.css` - CAD-style cursor CSS

### Year Navigation for Canvas (2026-01-30)

Navigate through years to see how utilization bars change over time on all canvas nodes.

**UI:**
```
           [◀] 2025 [▶]
            1 of 4
```

**Behavior:**
- Appears automatically when multi-year analysis results are available
- Click arrows to cycle through years
- All canvas nodes update to show the selected year's utilization
- Utilization bars animate as you navigate between years

**State:**
- `displayedYearIndex` in analysis store tracks current year
- Resets to first year (index 0) when new analysis completes

**Files Added:**
- `src/renderer/features/canvas/components/YearNavigator.tsx`

**Files Modified:**
- `src/renderer/features/analysis/store/useAnalysisStore.ts` - Year navigation state and actions
- `src/renderer/features/canvas/components/nodes/ProductionLineNode.tsx` - Use `displayedYearIndex`
- `src/renderer/features/canvas/ProductionCanvas.tsx` - Added YearNavigator component

## Completed: Phase 6 - Data Management CRUD ✅

**Full specification**: `docs/phases/phase-6-data-management-crud.md`

Full in-app data modeling without Excel dependency:

- [x] **Phase 6.0**: Sidebar navigation foundation
- [x] **Phase 6A+**: Models + Volumes CRUD
- [x] **Phase 6D**: Custom Areas CRUD
- [x] **Phase 6B**: Line-Model Compatibilities CRUD

## Completed: Phase 6.5 - Routings View ✅ (2026-01-31)

Model-centric view showing process flow for each model.

**Files Created:**
- `src/renderer/pages/RoutingsPage.tsx` - Main routings view
- `src/renderer/features/routings/store/useRoutingStore.ts` - Routing state management
- `src/renderer/features/routings/components/ProcessFlowBadges.tsx` - Area badge visualization
- `src/renderer/features/routings/components/EditRoutingModal.tsx` - Edit model routing

**Files Modified:**
- `src/renderer/store/useNavigationStore.ts` - Added 'routings' view
- `src/renderer/components/layout/Sidebar.tsx` - Added Routings nav item (Cmd+3)
- `src/renderer/components/layout/AppLayout.tsx` - Added RoutingsPage routing

**Features:**
- [x] New "Routings" sidebar item with GitBranch icon
- [x] Model list with inline process flow badges `[SMT] → [ICT] → [FA]`
- [x] Area color coding from area catalog
- [x] Warning indicator for models without routing
- [x] Edit Routing modal with visual flow builder
- [x] Add/remove areas from model flow
- [x] Line assignment management per area
- [x] Cycle time, efficiency, priority editing

## Phase 6.5+: DAG-Based Routing Enhancement ✅ (2026-02-01)

Enhanced Routings to support parallel/concurrent process flows using a Directed Acyclic Graph (DAG) model.

**Example Flow:**
```
   SMT (start)
     |
     v
   ┌─────────────────┐
   │                 │
   v                 v
  ICT           Conformal  (parallel - both follow SMT)
   │                 │
   └─────────────────┘
           │
           v
       Assembly (waits for BOTH)
```

### IE Agent Validation

| Aspect | Assessment |
|--------|------------|
| **Theoretical soundness** | Excellent - DAG is the correct abstraction |
| **Practical applicability** | Good - covers 90%+ of real manufacturing flows |
| **Extensibility** | Good - foundation supports future simulation |

### Database Tables

**Migration:** `009_model_area_routing.sql`

```sql
model_area_routing (
  id, model_id, area_code, sequence,
  is_required BOOLEAN DEFAULT TRUE,     -- Can this step be skipped?
  expected_yield DECIMAL DEFAULT 1.0,   -- Yield at this stage (0.0-1.0)
  volume_fraction DECIMAL DEFAULT 1.0,  -- For split paths (0.0-1.0)
)

model_area_predecessors (
  id, model_id, area_code, predecessor_area_code,
  dependency_type TEXT DEFAULT 'finish_to_start'
)
```

### Files Created

| File | Purpose |
|------|---------|
| `src/main/database/migrations/009_model_area_routing.sql` | Database tables |
| `src/shared/types/routing.ts` | TypeScript types |
| `src/main/database/repositories/SQLiteModelAreaRoutingRepository.ts` | Repository with Kahn's algorithm |
| `src/main/ipc/handlers/routing.handler.ts` | IPC handlers |
| `src/renderer/features/routings/components/PredecessorSelector.tsx` | UI component |

### Files Modified

| File | Changes |
|------|---------|
| `src/shared/constants/index.ts` | Added `ROUTING_CHANNELS` |
| `src/shared/types/index.ts` | Export routing types |
| `src/main/database/repositories/index.ts` | Export new repository |
| `src/main/ipc/handlers/index.ts` | Register routing handlers |
| `src/preload.ts` | Expose new channels |
| `src/renderer/features/routings/store/useRoutingStore.ts` | DAG routing state management |
| `src/renderer/features/routings/components/EditRoutingModal.tsx` | Predecessor UI |

### Features

- [x] DAG data model for parallel process flows
- [x] `finish_to_start` dependency semantics
- [x] Cycle detection using Kahn's algorithm
- [x] Orphan detection (areas unreachable from start)
- [x] Predecessor selection UI in Edit Routing modal
- [x] Real-time DAG validation indicator
- [x] Color-coded area types (start=green, end=purple, intermediate=blue)
- [x] Predecessor count badges on flow badges
- [x] IE-recommended fields: `expected_yield`, `volume_fraction` (schema only, UI later)
- [x] Backward compatible - models without DAG config continue to work
- [x] Clear Routing feature with Cancel-as-rescue pattern
- [x] User-friendly cycle prevention message ("Not available - X already runs after this area")

### Bug Fixes

- **Duplicate line addition**: Fixed React state mutation bug where `.push()` caused duplicate lines in StrictMode. Changed to immutable update with spread operators and duplicate check.
- **Cycle detection UX**: Changed cryptic "Adding X would create a cycle" to clearer "Not available - X already runs after this area"

### Clear Routing Feature

Users can now clear a model's routing configuration:
- **Clear Routing button** in modal header (only shows for models with existing routing)
- **Confirmation dialog** warns user and mentions Cancel rescue option
- **Cancel-as-rescue pattern**: Clearing only affects local state until Save is clicked
- **Warning banner**: Shows "Routing will be cleared when you click Save. Click Cancel to keep the original routing."
- **Undo via Cancel**: User can click Cancel to discard the clear action and keep original routing

### IPC Channels

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

### Future Enhancements (Not in Phase 6.5+)

These fields are included in the schema for future use but NOT exposed in UI yet:
- `expected_yield` - For yield cascade calculations in optimizer
- `volume_fraction` - For split path demand distribution
- `min_buffer_time_hours` - Cure time, cooling time between stages

---

## Future Phases

### Phase 7: Enhanced Visualization
- [ ] Process flow visualization on Canvas (connections/arrows between areas)

### Phase 8: Scenario Management
- [ ] Save/load analysis scenarios
- [ ] Compare scenarios side-by-side
- [ ] What-if analysis

### Phase 9: Reports & Export
- [ ] PDF report generation (executive summary)
- [ ] Excel export (detailed results)
- [ ] SMED priority report (top costly transitions)

### Phase 10: Advanced Features
- [ ] Progress streaming from Python to UI
- [ ] TSP-optimal sequencing method
- [ ] Multi-year analysis dashboard

---

## Important Notes

- **HMR**: Changes to `src/renderer/*` auto-reload; changes to `src/main/*` require app restart
- **IPC Security**: All database access goes through IPC handlers (no direct DB from renderer)
- **Soft Deletes**: Records use `active` flag, not hard deletes
- **Execution Speed**: Python optimizer runs in ~17ms (not 10-20 seconds) because it's pure Python without pandas/Excel I/O overhead


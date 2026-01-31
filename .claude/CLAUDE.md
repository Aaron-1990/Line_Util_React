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
| Optimizer algorithm, manufacturing logic | "optimizer", "allocation", "utilization", "constraint" | `Industrial Engineer` |
| Electron main process, IPC, services | "IPC", "main process", "BrowserWindow", "service" | `backend-architect` |
| Database schema, migrations, queries | "schema", "migration", "query", "SQLite" | `database-architect` |
| After writing/modifying code | (always after implementation) | `code-reviewer` |
| Tests, coverage, CI/CD testing | "test", "coverage", "spec", "vitest" | `test-engineer` |
| Performance bottlenecks | "slow", "performance", "memory" | `performance-profiler` |
| Codebase exploration, finding code | "where is", "how does", "find" | `Explore` |

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

**Version:** 0.5.6.3 (Phase 5.6.3 - Simplified UI)
**Last Updated:** 2026-01-30
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

### Current Capabilities

1. **Data Import**: Multi-sheet Excel import (Lines, Models, Compatibilities, Areas, **Changeover**)
2. **Canvas**: Interactive production line visualization with drag & drop
3. **Analysis**: Python-based optimization with 17ms execution time
4. **Multi-Window**: Timeline window auto-opens in separate window for multi-monitor setups
5. **Results Panel**: Detailed utilization by area, line, and model with constraint drill-down
6. **Changeover Matrix**: Three-tier resolution (Global → Family → Line) with Excel import and UI editor

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
```

**Database location:** `~/Library/Application Support/Line Optimizer/line-optimizer.db`

---

## Algorithm Key Concepts

### Per-Area Processing
Each manufacturing area (SMT, ICT, Conformal, Router, Final Assembly) processes the FULL demand independently because products flow through ALL areas sequentially.

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

## Future Phases

### Phase 6: Enhanced Visualization
- [ ] Process flow visualization (connections/arrows between areas)

### Phase 7: Scenario Management
- [ ] Save/load analysis scenarios
- [ ] Compare scenarios side-by-side
- [ ] What-if analysis

### Phase 8: Reports & Export
- [ ] PDF report generation (executive summary)
- [ ] Excel export (detailed results)
- [ ] SMED priority report (top costly transitions)

### Phase 9: Advanced Features
- [ ] Progress streaming from Python to UI
- [ ] TSP-optimal sequencing method
- [ ] Multi-year analysis dashboard

---

## Important Notes

- **HMR**: Changes to `src/renderer/*` auto-reload; changes to `src/main/*` require app restart
- **IPC Security**: All database access goes through IPC handlers (no direct DB from renderer)
- **Soft Deletes**: Records use `active` flag, not hard deletes
- **Execution Speed**: Python optimizer runs in ~17ms (not 10-20 seconds) because it's pure Python without pandas/Excel I/O overhead


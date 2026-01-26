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

**Version:** 0.4.3 (Phase 4.2 Complete)
**Last Updated:** 2026-01-25
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

### Current Capabilities

1. **Data Import**: Multi-sheet Excel import (Lines, Models, Compatibilities, Areas)
2. **Canvas**: Interactive production line visualization with drag & drop
3. **Analysis**: Python-based optimization with 17ms execution time
4. **Multi-Window**: Timeline window auto-opens in separate window for multi-monitor setups
5. **Results Panel**: Detailed utilization by area, line, and model with constraint drill-down

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
| Main documentation | `docs/phases/phase-3.5-summary.md` |
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

---

## Database Schema

```sql
production_lines          -- Line metadata (name, area, time_available_daily)
product_models_v2         -- Model metadata (name, customer, program, family)
product_volumes           -- Multi-year volumes (model_id, year, volume, operations_days)
line_model_compatibilities -- Line-model pairs (cycle_time, efficiency, priority)
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

## Next Steps (Phase 5)

- [ ] Progress streaming from Python to UI
- [ ] Results update canvas nodes with utilization colors
- [ ] Error handling improvements
- [ ] Dashboard with KPIs and charts
- [ ] Scenario comparison (save/load scenarios)
- [ ] Export reports (PDF/Excel)

---

## Important Notes

- **HMR**: Changes to `src/renderer/*` auto-reload; changes to `src/main/*` require app restart
- **IPC Security**: All database access goes through IPC handlers (no direct DB from renderer)
- **Soft Deletes**: Records use `active` flag, not hard deletes
- **Execution Speed**: Python optimizer runs in ~17ms (not 10-20 seconds) because it's pure Python without pandas/Excel I/O overhead


# Line Optimizer - Project Context

## Current State

**Version:** 0.4.1 (Phase 4.1 Complete)
**Last Updated:** 2026-01-24
**Developer:** Aaron Zapata (Supervisor Industrial Engineering, BorgWarner)

### Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Canvas Feature (ReactFlow) | ✅ Complete |
| Phase 2 | CRUD Lines (Add/Edit/Delete) | ✅ Complete |
| Phase 3.4 | Multi-Sheet Excel Import | ✅ Complete |
| Phase 3.5 | Analysis Control Bar | ✅ Complete |
| Phase 4.1 | Python Optimizer Algorithm | ✅ Complete |

### Current Capabilities

1. **Data Import**: Multi-sheet Excel import (Lines, Models, Compatibilities)
2. **Canvas**: Interactive production line visualization with drag & drop
3. **Analysis**: Python-based optimization with 17ms execution time
4. **Results Panel**: Modal displaying utilization by area, line, and model

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

## Next Steps (Phase 4.2)

- [ ] Progress streaming from Python to UI
- [ ] Results update canvas nodes with utilization colors
- [ ] Error handling improvements
- [ ] Dashboard with KPIs and charts

---

## Important Notes

- **HMR**: Changes to `src/renderer/*` auto-reload; changes to `src/main/*` require app restart
- **IPC Security**: All database access goes through IPC handlers (no direct DB from renderer)
- **Soft Deletes**: Records use `active` flag, not hard deletes
- **Execution Speed**: Python optimizer runs in ~17ms (not 10-20 seconds) because it's pure Python without pandas/Excel I/O overhead

---

## Automatic Agent Orchestration

When working on this project, Claude should automatically analyze each task and invoke the appropriate specialized agents without being asked.

### Task Analysis Process

Before starting any non-trivial task:
1. **Identify task type**: Is this frontend, backend, optimization, testing, architecture?
2. **Assess complexity**: Does this need specialized expertise?
3. **Select agents**: Choose the right agent(s) based on the mapping below
4. **Execute**: Invoke agents proactively, in parallel when independent

### Agent Routing Rules

| Task Type | Trigger Keywords/Patterns | Agent to Use |
|-----------|---------------------------|--------------|
| React components, UI, styling | "component", "UI", "button", "modal", "canvas" | `frontend-developer` |
| Optimizer algorithm changes | "optimizer", "allocation", "utilization", "Python algorithm" | `industrial-engineer` |
| API design, data flow | "API", "endpoint", "service", "IPC" | `backend-architect` |
| Database schema, queries | "schema", "migration", "query", "SQLite" | `database-architect` |
| After completing any feature | Code was written or modified | `code-reviewer` |
| Test creation or fixes | "test", "coverage", "spec", "vitest" | `test-engineer` |
| Performance issues | "slow", "performance", "memory", "optimize" | `performance-profiler` |
| Codebase exploration | "where is", "how does", "find", "understand" | `Explore` agent |

### Parallel Execution

When multiple agents are needed and their tasks are independent, invoke them in parallel. For example:
- Writing a new feature → `frontend-developer` (implement) + `test-engineer` (tests) in parallel
- After implementation → `code-reviewer` to verify quality

### Always Consult Industrial Engineer For

- Any changes to the Python optimizer
- New metrics or KPI calculations
- Manufacturing logic decisions
- Algorithm correctness validation

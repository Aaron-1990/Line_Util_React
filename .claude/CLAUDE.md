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
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db

# Test optimizer
python3 Optimizer/test_priority_distribution.py
```

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

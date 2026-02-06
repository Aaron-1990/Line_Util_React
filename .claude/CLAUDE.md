# Line Optimizer - Project Context

> **Version:** 0.7.3 | **Last Updated:** 2026-02-02 | **Developer:** Aaron Zapata

---

## DEVELOPMENT FRAMEWORK (MANDATORY)

**Read and follow:** `~/.claude/CLAUDE.md` - Framework de Desarrollo Hibrido v2.0 (Global)

This project follows the global development framework. Key principles:
- **CONTRACTS-FIRST**: Define interfaces in `@shared/types/` BEFORE implementing
- **NO WORKAROUNDS**: If solution requires a "trick", STOP and find the standard way
- **BLOQUE 0**: Always investigate documentation and define contracts first

---

## BEFORE MODIFYING CODE (Read First)

**To avoid breaking existing features or duplicating work:**

1. **Use `Explore` agent first** when asked to modify any feature - understand what exists before changing
2. **Read `docs/CHANGELOG-PHASES.md`** before modifying these areas:
   - Changeover (Phases 5.x) - complex toggle hierarchy, capacity reduction logic
   - Routings (Phase 6.5+) - DAG model, cycle detection, predecessor logic
   - Multi-Plant (Phase 7.x) - plant scoping, Excel import with plant detection
   - Canvas nodes - stacked bars, year navigation, toggle states
3. **Check existing stores** before creating new state: `useAnalysisStore`, `useChangeoverStore`, `useRoutingStore`, `usePlantStore`, `useNavigationStore`
4. **Check existing IPC channels** in `src/shared/constants/index.ts` before adding new ones
5. **Check existing repositories** in `src/main/database/repositories/` before writing SQL

**If unsure, ASK the user** rather than guess. Fixing broken features costs more than asking.

---

## Agent Orchestration (MANDATORY)

**ALL agents MUST follow `~/.claude/CLAUDE.md`**

| Task Type | Agent Type | BLOQUE 0 Focus |
|-----------|------------|----------------|
| React, UI, modals, windows | `frontend-developer` | React/ReactFlow APIs |
| UX/UI design, wireframes | `ux-ui-designer` | Standard UX patterns |
| Optimizer algorithm, manufacturing | `Industrial Engineer` | Algorithm correctness |
| Electron main process, IPC | `backend-architect` | IPC contracts, Electron APIs |
| Database schema, migrations | `database-architect` | Schema design, indexes |
| After writing code | `code-reviewer` | **Detect workarounds** |
| Tests, coverage | `test-engineer` | Test contracts |
| Performance issues | `performance-profiler` | Profiling APIs |
| Finding code | `Explore` | Existing patterns |

**Marketing/Sales Agents:** `product-marketing-manager`, `b2b-sales-strategist`, `content-marketing-specialist`, `market-research-analyst`

### Agent Protocol

1. **BLOQUE 0**: Agent investigates APIs/documentation first
2. **Propose**: Solution based on standard APIs (no workarounds)
3. **Implement**: With checkpoints after each block
4. **Review**: `code-reviewer` validates no workarounds introduced

**Parallel Execution:** For multi-layer features, invoke `backend-architect` + `frontend-developer` in parallel. Always run `code-reviewer` after implementation.

---

## Tech Stack

```
Electron 28 + React 18 + TypeScript
├── SQLite (better-sqlite3)
├── Zustand (state management)
├── ReactFlow (canvas)
├── Vite (build)
└── Python 3 (optimizer)
```

---

## Architecture

```
RENDERER (React)              MAIN (Node.js)
├── Canvas Feature            ├── IPC Handlers
├── Analysis Control Bar      ├── SQLite Database
├── Results Panel             ├── DataExporter
└── Import Wizard             └── PythonBridge
                    ↓
              PYTHON OPTIMIZER
         Optimizer/optimizer.py
```

---

## Key Files

| Purpose | Location |
|---------|----------|
| Python optimizer | `Optimizer/optimizer.py` |
| Algorithm changelog | `Optimizer/CHANGELOG.md` |
| Analysis store | `src/renderer/features/analysis/store/useAnalysisStore.ts` |
| Python bridge | `src/main/services/python/PythonBridge.ts` |
| Data exporter | `src/main/services/analysis/DataExporter.ts` |
| Changeover types | `src/shared/types/changeover.ts` |
| Changeover repo | `src/main/database/repositories/SQLiteChangeoverRepository.ts` |
| Plant types | `src/shared/types/plant.ts` |
| Plant repo | `src/main/database/repositories/SQLitePlantRepository.ts` |
| Routing types | `src/shared/types/routing.ts` |
| Routing repo | `src/main/database/repositories/SQLiteModelAreaRoutingRepository.ts` |
| Shape Catalog Plan | `docs/phases/phase-7.5-shape-catalog.md` |

**Phase history:** See `docs/CHANGELOG-PHASES.md` for detailed implementation history.

---

## Database Schema (Core Tables)

```sql
production_lines          -- Line metadata (plant_id, name, area, time_available)
product_models_v2         -- Model metadata (name, customer, program, family)
product_volumes           -- Multi-year volumes (model_id, year, volume)
line_model_compatibilities -- Line-model pairs (cycle_time, efficiency, priority)
plants                    -- Plant definitions (code, name, timezone)

-- Changeover
user_preferences              -- Global settings
family_changeover_defaults    -- Family-to-family times
line_changeover_overrides     -- Line-specific exceptions
v_resolved_changeover_times   -- VIEW: Three-tier resolution

-- Routing (DAG)
model_area_routing            -- Areas in model's process flow
model_area_predecessors       -- DAG edges (predecessors)
```

**DB location:** `~/Library/Application Support/Line Optimizer/line-optimizer.db`

---

## Algorithm Key Concepts

### Per-Area Processing
Each area processes FULL demand independently (products flow through ALL areas sequentially).

### Sequential Operations = Separate Areas
**Wrong:** `Area: SUBASSEMBLY` with lines HVDC, HVAC, GDB, FSW (optimizer picks fastest only)
**Correct:** Separate areas: `SUB-HVDC`, `SUB-HVAC`, `SUB-GDB`, `SUB-FSW`

### Core Formula
```python
adjusted_cycle_time = cycle_time / (efficiency / 100)
max_units = available_time / adjusted_cycle_time
allocated_units = min(max_units, daily_demand)
```

### Changeover (Three-Tier Resolution)
1. **Line Override** → 2. **Family Default** → 3. **Global Default** (30 min)

Changeover reduces capacity. Formula uses HHI (demand concentration) to estimate changeovers:
```python
N_eff = 1 / HHI  # Effective model count
estimated_changeovers = N_eff - 1
```

---

## Current Capabilities

1. **Data Import**: Multi-sheet Excel with Plant column detection + auto-create plants
2. **Canvas**: Interactive visualization with drag & drop, year navigation
3. **Analysis**: Python optimizer (~17ms), changeover toggle controls
4. **Multi-Window**: Timeline auto-opens in separate window
5. **Changeover**: Three-tier matrix, per-line toggles, stacked bar visualization
6. **Routings**: DAG-based parallel process flows
7. **Multi-Plant**: Plant-scoped data, global analysis view

---

## Common Commands

```bash
npm start              # Start app with HMR
npm run type-check     # TypeScript validation
npm run db:reset       # Delete database (only when needed)

# Test optimizer
python3 Optimizer/test_priority_distribution.py
```

---

## Future Phases

| Phase | Description |
|-------|-------------|
| 7.5 | Shape Catalog & Polymorphic Objects - see `docs/phases/phase-7.5-shape-catalog.md` |
| 8 | Project files (.lineopt), scenarios |
| 9 | PDF/Excel reports |
| 10 | Progress streaming, TSP sequencing |
| 11 | Simulation export (ProModel) |

---

## Git Policy

**NEVER push these folders (in .gitignore):**
- `.marketing/` - Sales decks, pricing
- `docs/marketing/` - Marketing docs
- `docs/market-research/` - Competitive analysis

**Before push:** Check `git status` for confidential files.

---

## UI Standards

| Pattern | Component | Documentation |
|---------|-----------|---------------|
| SubMenu (nested menus) | `src/renderer/components/ui/SubMenu.tsx` | `docs/standards/ui-submenu-pattern.md` |

**Key UX patterns implemented:**
- Safe triangle pattern for diagonal mouse movement
- Click-to-toggle with pinned state
- Delayed open/close for natural interaction

---

## Important Notes

- **HMR**: `src/renderer/*` auto-reloads; `src/main/*` requires app restart
- **IPC Security**: All DB access through IPC handlers
- **Soft Deletes**: Records use `active` flag
- **Execution Speed**: Python runs in ~17ms (pure Python, no pandas overhead)

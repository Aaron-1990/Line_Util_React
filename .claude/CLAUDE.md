# Line Optimizer - Project Context

> **Version:** 0.7.6 | **Last Updated:** 2026-02-17 | **Developer:** Aaron Zapata

---

## DEVELOPMENT FRAMEWORK (MANDATORY)

**Read and follow:** `~/.claude/CLAUDE.md` - Framework de Desarrollo Hibrido v2.0 (Global)

This project follows the global development framework. Key principles:
- **CONTRACTS-FIRST**: Define interfaces in `@shared/types/` BEFORE implementing
- **NO WORKAROUNDS**: If solution requires a "trick", STOP and find the standard way
- **BLOQUE 0**: Always investigate documentation and define contracts first

---

## MODEL CONFIGURATION

**Default model:** `opusplan` (automatic hybrid workflow)

See `~/.claude/CLAUDE.md` for full configuration details. This project uses the global `opusplan` configuration which maps Framework Hibrido v2.0 phases to optimal models (Opus for BLOQUE 0, Sonnet for implementation).

---

## BEFORE MODIFYING CODE (Read First)

**To avoid breaking existing features or duplicating work:**

1. **MANDATORY: Run Bug Prevention Checklist** - `docs/standards/BUG-5-AND-3-4-PREVENTION-CHECKLIST.md`
   - Prevents regression of Bug 5 (Mac sleep/wake data loss)
   - Prevents regression of Bug 3-4 (ReactFlow remount/selection clearing)
   - Prevents regression of Phase 7.6 bugs (Rules of Hooks, deleteKeyCode race)
   - **Use checklist BEFORE implementing ANY feature**

2. **Use `Explore` agent first** when asked to modify any feature - understand what exists before changing

3. **Read `docs/CHANGELOG-PHASES.md`** before modifying these areas:
   - Changeover (Phases 5.x) - complex toggle hierarchy, capacity reduction logic
   - Routings (Phase 6.5+) - DAG model, cycle detection, predecessor logic
   - Multi-Plant (Phase 7.x) - plant scoping, Excel import with plant detection
   - Canvas nodes - stacked bars, year navigation, toggle states
   - **Canvas architecture (Phase 7.6)** - Single Source of Truth, node data pattern

4. **Check existing stores** before creating new state: `useAnalysisStore`, `useChangeoverStore`, `useRoutingStore`, `usePlantStore`, `useNavigationStore`

5. **Check existing IPC channels** in `src/shared/constants/index.ts` before adding new ones

6. **Check existing repositories** in `src/main/database/repositories/` before writing SQL

**If unsure, ASK the user** rather than guess. Fixing broken features costs more than asking.

---

## CRITICAL CODE SECTIONS (DO NOT MODIFY)

**⚠️ These sections have inline "DO NOT MODIFY" comments. Read them before making changes.**

### 1. Project Save/Load & Plant ID Management (2025-02-14)

**Documentation:** `docs/fixes/fix-canvas-save-load-and-shapes.md`

**Critical Files & Sections:**

| File | Section | Why Critical |
|------|---------|--------------|
| `AppLayout.tsx:44-48` | `refreshAllStores()` sequence | localStorage must be cleared BEFORE loading stores |
| `usePlantStore.ts:175-188` | Plant ID validation in `loadPlants()` | Prevents stale plant IDs from breaking canvas |
| `ProjectFileService.ts:405-410` | System tables exclusion list | Prevents deleting built-in shapes on "New Project" |
| `ProjectFileService.ts:537-595` | `ensureShapesSeeded()` function | Auto-seeds shapes if empty (idempotent) |
| `main/index.ts:74-130` | `ensureShapesSeeded()` function | App startup shape validation |

**What happens if modified:**
- Canvas objects won't load after save/reopen
- Object Palette will be empty (no shapes)
- Plant IDs will mismatch across database switches

**If you need to modify these areas:**
1. Read `docs/fixes/fix-canvas-save-load-and-shapes.md` FIRST
2. Run full regression test suite (4 scenarios in doc)
3. Consult with user before proceeding

### 3. Canvas Single Source of Truth (2026-02-17)

**Documentation:** `docs/phases/phase-7.6-canvas-single-source-of-truth.md`

**Architecture:** `nodes[].data = { objectId: string }` (reference only). All canvas object data lives in `useCanvasObjectStore.objects[]`.

**Critical Files & Rules:**

| Rule | Why Critical |
|------|-------------|
| `GenericShapeNode.tsx` — ALL hooks before `if (!object) return null` | `useMemo` after early return causes crash on deletion (TypeScript cannot detect this) |
| `ProductionCanvas.tsx` — `deleteKeyCode={null}` on `<ReactFlow>` | Without it, RF's internal handler fires first, empties selection, custom handler is a NOOP, `objects[]` never updated → objects reappear |
| Only use `updateObject()` to change canvas object data | `nodes[].data` is now `{ objectId }` only — updating `node.data` does nothing |
| `deleteObject(id)` handles both stores | Calls `deleteNode(id)` internally — do not call them separately |

**What happens if Rules are violated:**
- Missing `deleteKeyCode={null}` → deleted objects reappear after tab navigation (Bug 5-like symptom)
- Hook after early return → `Rendered fewer hooks than expected` crash when any object is deleted
- Updating `node.data` directly → changes are ignored (node reads from `objects[]`, not `node.data`)

**If you need to add a new node component:**
1. Read `docs/phases/phase-7.6-canvas-single-source-of-truth.md`
2. Use `GenericShapeNode` as the template
3. Verify: all hooks before early return, no hook count mismatch possible

---

### 2. Mac Sleep/Wake & Store Persistence (2025-02-15)

**Documentation:** `docs/fixes/bug-5-mac-sleep-wake-objects-reappear.md`

**CRITICAL: DO NOT break these mechanisms - they prevent data loss on Mac sleep/wake**

**Critical Files & Sections:**

| File | Section | Why Critical |
|------|---------|--------------|
| `index.tsx:21-42` | `beforeunload` handler | Blocks Vite's page reload on Mac wake - MUST preserve |
| `AppLayout.tsx:371-380` | Resume handler | Log-only, NO `refreshAllStores()` - prevents DB overwrite |
| `main/index.ts` | powerMonitor handlers | WAL checkpoints on suspend/shutdown - ensures DB writes persist |
| `connection.ts` | `checkpoint()` method | PASSIVE/TRUNCATE modes - critical for data durability |
| `SQLiteCanvasObjectRepository.ts` | WAL checkpoint after delete | Ensures deletes survive Mac sleep |

**What happens if modified:**
- Deleted canvas objects reappear after Mac sleep/wake
- User changes lost (stores destroyed by page reload)
- Data corruption (writes not persisted to DB)
- 5000x slower resume (50-200ms vs 0.01ms)

**The Bug 5 Mechanism (DO NOT BREAK):**

```
Mac Sleep → Vite WebSocket disconnects
           ↓
Mac Wake → Vite attempts location.reload()
           ↓
beforeunload fires → preventDefault() → Reload BLOCKED ✅
           ↓
Stores persist in memory (NO DB reload)
           ↓
Resume handler logs only (NO refreshAllStores())
           ↓
Objects stay exactly as user left them ✅
```

**If you need to modify these areas:**

1. **Read full documentation FIRST:** `docs/fixes/bug-5-mac-sleep-wake-objects-reappear.md`
   - Understand all 4 failed attempts (v1, v2, v3.1)
   - Know why each failed
   - v4 is the ONLY working solution

2. **NEVER do these (proven to fail):**
   - ❌ Override `window.location.reload` (read-only in Chromium)
   - ❌ Call `refreshAllStores()` on resume (overwrites in-memory state)
   - ❌ Remove WAL checkpoints (data loss on crashes)
   - ❌ Remove `beforeunload` handler (page reload destroys stores)

3. **If adding new stores:**
   - Zustand stores automatically persist through sleep/wake (thanks to `beforeunload`)
   - NO special handling needed
   - Just ensure important writes trigger WAL checkpoint

4. **If modifying resume flow:**
   - Resume handler MUST be lightweight (log-only)
   - NO DB queries on resume
   - Stores already have correct state (page didn't reload)

5. **Testing requirements:**
   - Test sleep/wake cycles (Apple menu → Reposo → Wake after 1 min)
   - Verify objects don't reappear after delete
   - Check DevTools console persists (not reset)
   - Verify Save/Don't Save dialog still works

**Related bugs:**
- Bug 3/4: `commitHookEffectListMount` clears ReactFlow selection (separate issue)
- Legacy `production_lines` VIEW causes "Area cannot be empty" (30+ files to migrate)

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

## Documentation Structure

Understanding where to find project documentation:

| Purpose | Location | Description |
|---------|----------|-------------|
| **Phase Index** | `docs/CHANGELOG-PHASES.md` | Brief summary of completed phases + references |
| **Phase Details** | `docs/phases/phase-X.md` | Full implementation docs for completed phases |
| **Feature Specs** | `docs/specs/` | Specifications for features TO BE implemented |
| **Testing Guides** | `docs/testing/` | Manual test procedures and validation |

**Navigation Pattern**:
1. Need context on existing feature? → Read `CHANGELOG-PHASES.md` (index) → Follow reference to `docs/phases/phase-X.md` (details)
2. Implementing new feature? → Read spec from `docs/specs/feature-name.md`
3. Testing feature? → Read guide from `docs/testing/feature-test.md`

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

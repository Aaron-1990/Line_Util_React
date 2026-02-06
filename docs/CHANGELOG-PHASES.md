# Line Optimizer - Phase Implementation History

> This file contains detailed implementation history for completed phases.
> For current project context, see `.claude/CLAUDE.md`

---

## Phase 4.2: Multi-Window Results

- [x] Dedicated line bottleneck detection (constraintType, constrainedLines)
- [x] Constraint drill-down with Pareto analysis
- [x] Multi-window support (ConstraintTimeline in separate window)
- [x] Auto-open Timeline window when analysis completes
- [x] Live updates to Timeline when re-running analysis
- [x] Status badge in Canvas showing "Analysis Complete"

---

## Phase 5: Changeover Matrix

**Full specification**: `docs/phases/phase-5-changeover-matrix.md`

### Phase 5.1: Foundation
- [x] TypeScript types (`src/shared/types/changeover.ts`)
- [x] Database migration (`005_changeover.sql`, `006_fix_changeover_view.sql`)
- [x] Repository (`SQLiteChangeoverRepository.ts`) + IPC handlers
- [x] IPC channels registered in `preload.ts`

### Phase 5.2: UI Components
- [x] Changeover button on canvas nodes
- [x] Matrix editor modal (`ChangeoverMatrixModal.tsx`)
- [x] Zustand store (`useChangeoverStore.ts`)

### Phase 5.3: Excel Import
- [x] "Changeover" sheet detection and parsing in `MultiSheetImporter.ts`
- [x] Validation in `MultiSheetValidator.ts`
- [x] Import handler in `multi-sheet-excel.handler.ts`
- [x] Test data: 433 family-to-family entries in test fixture

### Phase 5.4: Optimizer Integration
- [x] Changeover data exported via `DataExporter.ts`
- [x] Changeover impact calculated in `optimizer.py`
- [x] Results shown in `ResultsPanel.tsx`

### Phase 5.5: Changeover Enhancements (2026-01-27)

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

---

## Phase 5.6: Changeover Toggle Controls (2026-01-28)

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

---

## Canvas UX Improvements (2026-01-30)

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

---

## Year Navigation for Canvas (2026-01-30)

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

---

## Phase 6: Data Management CRUD

**Full specification**: `docs/phases/phase-6-data-management-crud.md`

Full in-app data modeling without Excel dependency:

- [x] **Phase 6.0**: Sidebar navigation foundation
- [x] **Phase 6A+**: Models + Volumes CRUD
- [x] **Phase 6D**: Custom Areas CRUD
- [x] **Phase 6B**: Line-Model Compatibilities CRUD

---

## Phase 6.5: Routings View (2026-01-31)

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

---

## Phase 6.5+: DAG-Based Routing Enhancement (2026-02-01)

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
  is_required BOOLEAN DEFAULT TRUE,
  expected_yield DECIMAL DEFAULT 1.0,
  volume_fraction DECIMAL DEFAULT 1.0,
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
- [x] User-friendly cycle prevention message

### Bug Fixes

- **Duplicate line addition**: Fixed React state mutation bug where `.push()` caused duplicate lines in StrictMode
- **Cycle detection UX**: Changed cryptic message to clearer "Not available - X already runs after this area"

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

---

## Phase 7: Multi-Plant Support (2026-02-02)

**Full specification**: `docs/phases/phase-7-multi-plant-support.md`

### Sprint 1-3: Backend Foundation

| Component | Status | Key Files |
|-----------|--------|-----------|
| Database Migration | ✅ | `migrations/010_multi_plant_support.sql` |
| Plant Types | ✅ | `src/shared/types/plant.ts` |
| Plant Repository | ✅ | `SQLitePlantRepository.ts` |
| Plant IPC Handlers | ✅ | `plant.handler.ts` |
| Plant-Scoped Line Queries | ✅ | `SQLiteProductionLineRepository.ts` |
| DataExporter Plant Support | ✅ | `DataExporter.ts` |
| Navigation Store Plant Context | ✅ | `useNavigationStore.ts` |
| Plant Store | ✅ | `usePlantStore.ts` |
| localStorage Persistence | ✅ | Built into navigation store |

### Sprint 4: Plant Selector UI

- [x] Plant dropdown in sidebar
- [x] "All Plants" page with CRUD table
- [x] Add/Edit Plant modal
- [x] Plants nav item (Cmd+5)
- [x] Plant switching with localStorage persistence

### Sprint 5: Global Analysis

- [x] Global Analysis page with network overview
- [x] Utilization bars per plant
- [x] Summary + Alerts cards
- [x] Plant comparison table
- [x] "Run All Plants" with progress
- [x] Global nav item (Cmd+6)

### Sprint 6: Model Ownership

- [x] Database migration (011_model_plant_ownership.sql)
- [x] Model entity with launchPlantId, primaryPlantId
- [x] ModelsPage with Plant column + ownership badges
- [x] model_plant_assignments table for lifecycle tracking

**Deferred:** Transfer wizard, before/after comparison

### Phase 7.2: Plant Column Detection (2026-02-02)

Excel import now automatically detects Plant columns and assigns imported data to the correct plant.

**Data Ownership Model (IE/DB Agent Validated):**
| Data Type | Ownership | Reason |
|-----------|-----------|--------|
| Models | **GLOBAL** | Same model can be produced at multiple plants |
| Lines | **PLANT-SPECIFIC** | Physical equipment exists at one location |
| Areas | **PLANT-SPECIFIC** | Plant layout specific |
| Compatibilities | **PLANT-SPECIFIC** | Same model may have different cycle times at different plants |
| Changeover | **PLANT-SPECIFIC** | Equipment-specific changeover times |

**Excel Sheet Structure:**
```
Lines:          [Plant] [Line Name] [Area] [Line Type] [Time Available Hours]
Areas:          [Plant] [Area Code] [Area Name] [Color]
Compatibilities: [Plant] [Model] [Line] [Cycle Time] [Efficiency] [Priority]
Changeover:     [Plant] [From Family] [To Family] [Minutes]
Models:         (no Plant column - global data)
```

**Files Modified:**
- `src/shared/types/index.ts` - Plant column mappings
- `src/main/services/excel/MultiSheetImporter.ts` - Plant column detection
- `src/main/services/excel/MultiSheetValidator.ts` - Extract plantCode
- `src/main/services/excel/ExcelValidator.ts` - Extract plantCode
- `src/main/ipc/handlers/multi-sheet-excel.handler.ts` - Plant code lookup

### Phase 7.3: Auto-Create Plants from Excel (2026-02-02)

Plants are now automatically detected and created during Excel import.

**Behavior:**
1. During validation, check each detected plant code against database
2. Show "Exists" or "Will be created" status in import preview
3. During import, auto-create missing plants before importing lines
4. New plants get their code as both `code` and `name`

**Files Modified:**
- `src/shared/types/index.ts` - Added `PlantValidationStatus`
- `src/main/ipc/handlers/multi-sheet-excel.handler.ts` - Auto-create plants
- `src/renderer/features/excel/components/MultiSheetValidationDisplay.tsx` - Plants UI
- `src/renderer/features/excel/components/MultiSheetProgressTracker.tsx` - Plants result
- `src/renderer/features/excel/components/MultiSheetImportWizard.tsx` - Refresh after import

---

## Phase 7.5: Unified Canvas Objects (2026-02-03 to 2026-02-04)

**Full specification**: `docs/phases/phase-7.5-shape-catalog.md`

### Migration 017: Unify Production Lines into Canvas Objects

Production lines are now stored as canvas_objects with `object_type='process'`.

**Key Changes:**
- `production_lines` → migrated to `canvas_objects` (type='process')
- `line_model_compatibilities` → migrated to `canvas_object_compatibilities`
- Backward-compatible VIEWs created for legacy code
- ID mapping table for traceability

**Files Modified:**
- `src/main/database/migrations/017_unify_production_lines.sql` - Main migration
- `src/main/database/repositories/SQLiteCanvasObjectRepository.ts` - Process properties methods
- `src/main/database/repositories/SQLiteCanvasObjectCompatibilityRepository.ts` - Compatibilities CRUD
- `src/main/database/repositories/SQLiteLineModelCompatibilityRepository.ts` - Uses new table
- `src/main/database/repositories/SQLiteProductionLineRepository.ts` - Uses underlying tables
- `src/main/ipc/handlers/multi-sheet-excel.handler.ts` - Import to canvas_objects
- `src/renderer/features/canvas/hooks/useLoadLines.ts` - Load from canvas_objects
- `src/renderer/features/canvas/store/useCanvasObjectStore.ts` - Process properties

### Bug Fixes (2026-02-04)

1. **WAL Checkpoint Table Locks**: Removed `wal_checkpoint(PASSIVE)` calls that caused table locks during bulk imports

2. **Duplicate Import Records**: Fixed import loop to update `existingObjectsMap` after creating objects, preventing duplicate records when Excel has duplicate line names

3. **Smart Update**: Implemented comparison-based updates that only write to DB when values actually change:
   - Added `unchanged` count to `EntityImportResult`
   - UI now shows: Created | Updated | Unchanged | Errors
   - Each entity type compares relevant fields before deciding to update

### Bug Fixes (2026-02-05)

1. **✅ FIXED: Missing Changeover Controls on GenericShapeNode**
   - **Problem**: When Phase 7.5 unified all nodes to use `GenericShapeNode`, the changeover controls from `ProductionLineNode` were not ported
   - **Root Cause**: `GenericShapeNode.tsx` was created as a new component without the changeover functionality that existed in `ProductionLineNode.tsx`
   - **Solution**: Ported complete changeover functionality from ProductionLineNode:
     - Added Timer/TimerOff icons for changeover toggle
     - Added Settings2 button for changeover matrix modal
     - Added per-object changeover toggle with critical override support
     - Added stacked utilization bar (production + changeover + available)
     - Added dynamic border color based on utilization
     - Added `changeoverExplicit` field to ProcessProperties type
     - Updated IPC handler and repository to support changeoverExplicit
     - Updated store optimistic update for nested processProperties
   - **Files Modified**:
     - `src/renderer/features/canvas/components/nodes/GenericShapeNode.tsx`
     - `src/shared/types/canvas-object.ts`
     - `src/main/ipc/handlers/canvas-objects.handler.ts`
     - `src/main/database/repositories/SQLiteCanvasObjectRepository.ts`
     - `src/renderer/features/canvas/store/useCanvasObjectStore.ts`

2. **✅ VERIFIED: Database Migration 017 Complete**
   - Verified 400 process objects with matching process_properties
   - Verified 0 orphan objects (all have properties)
   - Verified volumes exist (years 2024-2034)
   - Verified 3408 compatibilities
   - The "Zero Total Pieces" issue was likely transient or cache-related

3. **✅ FIXED: Process Object Layout - Elements Outside Bounds**
   - **Problem**: User reported "la barra queda fuera del objeto" - utilization bar and data were rendered outside the object bounds
   - **Root Cause**: GenericShapeNode was using SVG-based shape rendering which didn't accommodate the stacked bar and changeover controls properly for process objects
   - **Solution**: Redesigned GenericShapeNode to use a card-like layout (similar to the original ProductionLineNode) specifically for process objects:
     - Card layout with `min-w-[200px]` and `min-h-[80px]`
     - Header with name, status dot, and changeover toggle/matrix buttons
     - Stacked utilization bar (blue for production, amber for changeover) inside the card
     - Legend showing production % and changeover % when applicable
     - Dynamic border color based on utilization thresholds
     - Non-process objects continue to use shape-based SVG rendering
   - **Files Modified**:
     - `src/renderer/features/canvas/components/nodes/GenericShapeNode.tsx`

4. **✅ FIXED: Missing Info Fields in Process Objects**
   - **Problem**: Process objects were missing info fields that were displayed in the original ProductionLineNode
   - **Root Cause**: When porting functionality from ProductionLineNode to GenericShapeNode, some display fields were omitted
   - **Solution**: Added complete info section matching ProductionLineNode:
     - **Area**: from processProperties.area
     - **Time**: calculated from processProperties.timeAvailableDaily (displayed as hours/day)
     - **Efficiency**: blended efficiency calculated from analysis results (weighted average of assigned model efficiencies)
     - **Models**: count of assigned models from analysis results (with separator, shown only when > 0)
   - **Files Modified**:
     - `src/renderer/features/canvas/components/nodes/GenericShapeNode.tsx`

5. **✅ FIXED: Efficiency Display Showing Wrong Value (×100)**
   - **Problem**: Efficiency was showing as thousands (e.g., 8500%) instead of correct percentage (85%)
   - **Root Cause**: Code was multiplying efficiency by 100, but the value from optimizer is already a percentage
   - **Solution**: Removed the `* 100` multiplication in efficiencyDisplay calculation
   - **Files Modified**:
     - `src/renderer/features/canvas/components/nodes/GenericShapeNode.tsx`

6. **✅ ADDED: Allocated Pieces & Operation Days Display**
   - Added two new fields to process objects after analysis:
     - **Pieces**: Total allocated units per day for the line (sum of all model assignments)
     - **Op Days**: Operation days used for yearly calculations (from optimizer output)
   - Added `operationsDays` to optimizer output summary
   - Added `operationsDays` to TypeScript `YearSummary` interface
   - **Files Modified**:
     - `src/renderer/features/canvas/components/nodes/GenericShapeNode.tsx`
     - `Optimizer/optimizer.py`
     - `src/shared/types/index.ts`

7. **✅ REMOVED: Confusing Average Utilization from Run Button**
   - **Problem**: "Analysis Complete (28%)" showed average across ALL years, which was misleading
   - **Solution**: Simplified to just "Analysis Complete" without the percentage
   - **Files Modified**:
     - `src/renderer/features/analysis/components/RunAnalysisButton.tsx`

8. **✅ ADDED: Escape Key to Deselect (AutoCAD-style)**
   - Pressing **Escape** now clears all selected objects on the canvas
   - Works with:
     - Single object selection (click)
     - Multiple selection via box drag
     - Multiple selection via Cmd+click
   - Clears both internal stores and ReactFlow's selection state
   - **Files Modified**:
     - `src/renderer/features/canvas/ProductionCanvas.tsx`

9. **✅ FIXED: Duplicate Data Causing Low Utilization**
   - **Problem**: Analysis showed very low utilization (7-20% instead of expected 30-80%)
   - **Root Cause**: Data was imported 4 times, creating 400 lines from 100 unique lines. Each line got only 1/4 of expected demand.
   - **Solution**: Cleaned database and re-imported fresh data from Excel
   - **Lesson Learned**: During migration testing, always verify data isn't duplicated

---

## Future Enhancements (Schema Only, Not in UI)

These fields are included in database schema for future use:
- `expected_yield` - For yield cascade calculations in optimizer
- `volume_fraction` - For split path demand distribution
- `min_buffer_time_hours` - Cure time, cooling time between stages

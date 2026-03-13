# Line Optimizer — Phase Index

> **Lean index of completed phases.** Each entry is 3-5 lines.
> For implementation detail, follow the `docs/phases/` links.
> For architectural rules introduced, see `docs/rules/ARCHITECTURE-RULES.md`.
> Last updated: 2026-03-12

---

## Bug Fix: Canvas Object Position Persistence (2026-03-12)
**Status:** Complete | **Commits:** 1fa3757 + (draggingCanvasIds fix)
**Summary:** Canvas object drag positions were never written to SQLite. ReactFlow v11 drag-end fires `{dragging: false, position: undefined}` — the outer `change.position` guard in `onNodesChange` blocked it entirely. Fix: `draggingCanvasIds` ref tracks genuine drags; persists on the `position: undefined` drag-end event via `updatedNodes`. Secondary fix: clear canvas stores in `refreshAllStores()` so `hasObjectsForPlant` guard never uses stale objects from a prior project on open.
**Key files:** `ProductionCanvas.tsx` (`onNodesChange`, `draggingCanvasIds` ref)
**Rules introduced:** Rule 9 (see `docs/rules/ARCHITECTURE-RULES.md`)

---

## Phase 9: Export Optimization Results to Excel (2026-03-12)
**Status:** Complete | **Commits:** ee0e577, bddfb36
**Summary:** Export analysis results to `.xlsx` from the Results panel. Sheets: Resumen, Utilizacion, Cuellos de Botella, Demanda No Cubierta. Validation rows (DISTRIBUIDO, VOLUMEN BD, COBERTURA, ESTADO) per area. `dialog.showSaveDialog` for file picker.
**Key files:** `ExcelExporter.ts`, `export.handler.ts`, `ExportResultsButton.tsx`, `src/shared/constants/index.ts` (EXPORT_CHANNELS)

---

## Phase 8.5c: Non-Destructive Image Crop — COMPLETE (2026-03-12)
**Status:** Complete | **Commits:** cdd580f, 7e1ee09, af25643, 2d6ba49, ae015bd
**Summary:** PowerPoint-style 8-handle crop with live preview. Phase 1: Tailwind Preflight `maxWidth:'none'` fix. Phase 2: primary-field architecture (`imageOriginX/Y`, `imageScale` primary; position/size derived). Click-outside commits. Panning fix: `isPassThrough = l.locked` unconditional — RF wrapper always pointer-events:none on locked images; selection via position-based onPaneClick hit detection.
**Key files:** `CropOverlay.tsx`, `LayoutImageNode.tsx`, `useLayoutStore.ts`, `ProductionCanvas.tsx`, `deriveBounds.ts`, migration `022_layout_image_origin.sql`
**Detail:** `docs/fixes/crop-image-offset-after-done.md` | `docs/fixes/phase-8.5c-phase2-crop-position-bugs.md` | **Rules introduced:** Rule 8

---

## Phase 4.2: Multi-Window Results

**Status:** Complete
**Summary:** Dedicated bottleneck detection (constraintType, constrainedLines), constraint drill-down with Pareto analysis, ConstraintTimeline as separate Electron BrowserWindow, auto-opens after analysis with cascade positioning.
**Key files:** `src/renderer/pages/TimelineWindowPage.tsx`, `src/main/index.ts` (window management)

---

## Phase 5: Changeover Matrix

**Status:** Complete
**Summary:** Three-tier changeover time resolution (line override → family default → global default). Matrix editor modal, Excel import from "Changeover" sheet, optimizer integration with HHI-based capacity reduction.
**Key files:** `src/shared/types/changeover.ts`, `SQLiteChangeoverRepository.ts`, `ChangeoverMatrixModal.tsx`
**Detail:** `docs/phases/phase-5-changeover-matrix.md`

---

## Phase 5.5: Changeover Enhancements

**Status:** Complete
**Summary:** Added calculation method selector (Probability-Weighted / Simple Average / Worst Case). Improved changeover count heuristic using HHI (Herfindahl-Hirschman Index). Changeover now reduces available capacity.
**Key files:** `Optimizer/optimizer.py`, `ChangeoverMatrixModal.tsx`

---

## Phase 5.6: Changeover Toggle Controls

**Status:** Complete
**Summary:** Global toggle (Analysis Control Bar) and per-line toggle (canvas nodes) for changeover. Toggle hierarchy: Global OFF + Line ON = calculated (critical override). Stacked bar visualization on nodes (blue=production, amber=changeover, gray=available).
**Key files:** `ProductionCanvas.tsx`, `AnalysisControlBar.tsx`, `SQLiteProductionLineRepository.ts`
**Detail:** `docs/phases/phase-5.6-changeover-toggle-controls.md`

---

## Phase 5.6.1: Critical Override

**Status:** Complete
**Summary:** `changeoverExplicit` flag tracks user-set per-line overrides. Red ring indicator when global is OFF but line is explicitly ON.
**Migration:** `migrations/008_changeover_explicit.sql`

---

## Phase 5.6.3: Simplified Toggle UI

**Status:** Complete
**Summary:** Replaced dropdown with 3 buttons: All ON / All OFF / Reset. "Sticky" lines (manually toggled) ignore All ON/OFF. Reset clears sticky flags.
**Key files:** `ChangeoverToggle.tsx`, `SQLiteProductionLineRepository.ts`

---

## Canvas UX Improvements (2026-01-30)

**Status:** Complete
**Summary:** AutoCAD-style box selection (left-drag on empty space), middle/right-click pan, crosshair cursor on canvas, grabbing cursor during pan/drag.
**Key files:** `ProductionCanvas.tsx`, `globals.css`

---

## Year Navigation (2026-01-30)

**Status:** Complete
**Summary:** `[◀] 2025 [▶] / 1 of 4` navigator in canvas. All nodes update utilization bars for the selected year. Resets to year 0 on new analysis.
**Key files:** `YearNavigator.tsx`, `useAnalysisStore.ts`, `ProductionLineNode.tsx`

---

## Phase 6: Data Management CRUD

**Status:** Complete
**Summary:** Full in-app data modeling — Models, Volumes, Compatibilities, Custom Areas CRUD. Sidebar navigation foundation with Cmd+1-6 shortcuts.
**Detail:** `docs/phases/phase-6-data-management-crud.md`

---

## Phase 6.5: Routings View

**Status:** Complete
**Summary:** Model-centric view showing process flow as badges `[SMT] → [ICT] → [FA]`. Edit Routing modal with add/remove areas, line assignment, cycle time/efficiency/priority editing.
**Key files:** `RoutingsPage.tsx`, `useRoutingStore.ts`, `EditRoutingModal.tsx`

---

## Phase 6.5+: DAG-Based Routing

**Status:** Complete
**Summary:** Parallel/concurrent process flows via Directed Acyclic Graph. Kahn's algorithm for cycle detection. Predecessor selection UI. Backward compatible.
**Key files:** `SQLiteModelAreaRoutingRepository.ts`, `migrations/009_model_area_routing.sql`
**IPC:** `ROUTING_CHANNELS` (get-by-model, set-routing, set-predecessors, validate-dag, get-topological-order)
**Detail:** `docs/phases/phase-6.5-dag-routing.md`

---

## Phase 7: Multi-Plant Support (2026-02-02)

**Status:** Complete
**Summary:** Plant-scoped production lines, areas, compatibilities, changeover. Global Analysis page. Excel import with Plant column detection and auto-create plants. Model ownership (global models, plant-specific lines).
**Key files:** `usePlantStore.ts`, `SQLitePlantRepository.ts`, `plant.handler.ts`, `MultiSheetImporter.ts`
**Detail:** `docs/phases/phase-7-multi-plant-support.md`

---

## Phase 7.5: Unified Canvas Objects (2026-02-03)

**Status:** Complete — with post-implementation bug fixes
**Summary:** Production lines migrated to polymorphic `canvas_objects` table (type='process'). `GenericShapeNode` renders all object types. Shape palette. Changeover controls ported from `ProductionLineNode`.
**Migration:** `migrations/017_unify_production_lines.sql`
**Key files:** `GenericShapeNode.tsx`, `SQLiteCanvasObjectRepository.ts`, `useCanvasObjectStore.ts`
**Detail:** `docs/phases/phase-7.5-shape-catalog.md` | **Post-mortem:** `docs/phases/phase-7.5-post-mortem.md`

---

## Phase 7.6: Canvas Single Source of Truth (2026-02-17)

**Status:** Complete — with 3 post-implementation bugs fixed
**Summary:** `nodes[].data` changed to `{ objectId: string }` reference only. All canvas object data lives in `useCanvasObjectStore.objects[]`. Eliminated dual source of truth between ReactFlow and Zustand.
**Rules introduced:** Rules 1, 2, 3 (see `docs/rules/ARCHITECTURE-RULES.md`)
**Detail:** `docs/phases/phase-7.6-canvas-single-source-of-truth.md`

---

## Phase 7.6: Results Validation & Independent Results Window (2026-02-06)

**Status:** Complete | **Commits:** `9004a11`, `b16ae16`
**Summary:** Multi-year validation rows in results table (Σ DISTRIBUIDO, VOLUMEN, COBERTURA, ESTADO). Results window converted to Electron BrowserWindow with cascade positioning.
**Detail:** `docs/phases/phase-7.6-results-enhancements.md`

---

## Phase 8.0: Project Files Foundation (2026-02-07)

**Status:** Complete | **Commits:** `92af1d0`
**Summary:** `.lop` project file format (SQLite backup API). File menu (New/Open/Save/Save As), keyboard shortcuts, version checking, unsaved changes detection.
**Rules introduced:** Rule 4 — dynamic `getInstance()` (see `docs/rules/ARCHITECTURE-RULES.md`)
**Detail/Troubleshooting:** `docs/troubleshooting/phase-8-database-instance-references.md`

---

## Phase 8.1: Untitled Project Workflow (2026-02-08)

**Status:** Complete
**Summary:** Excel/Word-like "Untitled Project" state on startup. Before-quit/open/new dialogs. Path-based global DB clearing after Save As (solves replaceInstance() race condition).
**New IPC:** `GET_DEFAULT_DB_PATH`, `CLEAR_DATABASE_AT_PATH`
**Detail:** `docs/phases/phase-8.1-untitled-project-workflow.md`

---

## Phase 8.2: Fix Remaining Handler Instances (2026-02-10)

**Status:** Complete — orchestrator-driven
**Summary:** Applied Rule 4 (dynamic getInstance) to all 7 remaining handlers. All 15 database-using handlers now audited and fixed.
**Spec:** `docs/specs/phase-8.0-fix-remaining-handler-instances.md`

---

## Phase 8.5: Canvas Background Layout Images (2026-02-25)

**Status:** Complete | **Commits:** `2f432c6`, `17b5b6b`
**Summary:** Import PNG/JPG/BMP/WebP/SVG as background floor plan layers. Drag, resize, opacity, lock, visibility, name edit, delete. SSoT pattern: `LayoutNodeData = { layoutId }`.
**Migration:** `migrations/019_project_layouts.sql`
**Key files:** `LayoutImageNode.tsx`, `useLayoutStore.ts`, `SQLiteLayoutRepository.ts`, `layout.handler.ts`
**Rules:** Same as Rules 1-3 applied to layout system (see `docs/rules/ARCHITECTURE-RULES.md`)

---

## Phase 8.5b: Layout Image Enhanced Controls (2026-02-25)

**Status:** Complete | **Commits:** `17b5b6b`
**Summary:** W/H numeric inputs, aspect ratio lock (chain-link toggle), rotation (0-359° input + 0°/90°/180°/270° presets), Reset Dimensions, Reset Rotation, original size display.
**Migration:** `migrations/020_layout_enhancements.sql` (adds rotation, original_width, original_height, aspect_ratio_locked)
**Rules introduced:** Rules 6, 7 (see `docs/rules/ARCHITECTURE-RULES.md`)

---

## Future Phases

| Phase | Description |
|-------|-------------|
| 8.6 | DXF import (AutoCAD floor plans — requires DXF→SVG library) |
| 8.7 | Scale reference tool (pixel-to-meter calibration) |
| ~~9~~ | ~~PDF/Excel reports~~ Done |
| 10 | Progress streaming, TSP sequencing |
| 11 | Simulation export (ProModel) |

---

## Schema Fields Deferred to Future UI

- `expected_yield` — yield cascade calculations in optimizer
- `volume_fraction` — split path demand distribution
- `min_buffer_time_hours` — cure time between stages

# Pending Bugs - To Address in Future Sessions

**Last Updated:** 2026-02-17
**Status:** 2 pending (Bug 1 priority next session), 1 clarified, 1 cosmetic, 1 resolved

---

## Bug 1: Incomplete Process Object Counter Still Failing

**Priority:** High (next session)
**Impact:** UX/Visual — Status bar counts are wrong, user can't trust "complete/incomplete" indicators

### Current State (2026-02-17)

Two partial fixes were implemented but the counter is still not working correctly:

- **Part 1** (`374ea69`) — Added complete/incomplete process object counts to status bar
- **Part 1b** (`6e62b16`) — Refresh counts after create/delete/duplicate operations

Despite these commits, the incomplete process object counter still fails. **This is the next item to fix.**

### Description

The status bar shows complete/incomplete counts for process objects (canvas objects with `objectType = 'process'`). The counts are inaccurate — either showing 0 when objects exist, or not updating correctly after operations.

### Expected Behavior
- Status bar counts all process objects on the current canvas/plant
- "Complete" = process object has area + time + at least 1 assigned model
- "Incomplete" = process object missing area, time, or models
- Counts refresh immediately after: create, delete, duplicate, edit, model assign/unassign

### Actual Behavior
- Counter shows wrong values (0 or stale counts)
- Not consistently updated after operations

### Investigation Starting Point

Since Phase 7.6 changed how canvas object data is stored (`nodes[].data` → `objects[]`), verify:
1. Does the status bar query `useCanvasObjectStore.objects[]` or the old `useCanvasStore.nodes[]`?
2. Is the "completeness" check reading from `objects[]` (which has fresh `processProperties`) or from a stale source?
3. Do the refresh triggers (create/delete/duplicate) fire AFTER `objects[]` is updated?

### Files to Check
- Status bar component in Canvas feature
- IPC handler for status count data
- Repository query — verify it reads `canvas_objects WHERE objectType='process'`
- Completeness logic — needs `area`, `timeAvailableDaily`, and `compatibilitiesCount > 0`

### Context After Phase 7.6
- `objects[]` is the single source of truth for all canvas object data
- `processProperties` (area, timeAvailableDaily) lives inside each object in `objects[]`
- `compatibilitiesCount` is on the object itself
- Any completeness check must read from `useCanvasObjectStore.objects[]`

---

## Bug 2: Routings Don't Auto-Generate When Assigning Areas

**Priority:** Medium-High
**Impact:** Workflow - User has to manually create routings

### Description

When creating process objects, assigning areas to them, the system doesn't automatically create the routing entries that connect models to those areas.

### Expected Behavior
- User creates process objects
- User assigns areas to objects (e.g., "SMT", "ASSEMBLY")
- User assigns models to objects
- System should auto-create routing entries: `model_area_routing` + `model_area_predecessors`

### Actual Behavior
- User creates process objects ✅
- User assigns areas ✅
- User assigns models ✅
- **Routings are NOT created** ❌
- User has to manually create routings separately

### Context
- User mentioned: "aunque tengo las líneas/procesos creadas"
- "cree areas, las asigne a los objetos/lineas"
- "pero los routings no se van creando para los modelos que estan dados de alta"

### Possible Causes
1. No auto-generation logic exists (expected behavior to manually create routings)
2. Auto-generation exists but isn't triggered by area assignment
3. Migration from production_lines to canvas_objects broke the auto-generation

### Investigation Needed
- Check if auto-generation was ever implemented
- If yes, find where it was and why it stopped working
- If no, design the feature from scratch

### Design Questions (if implementing)
1. Should routings auto-create on area assignment?
2. Should they auto-create when model is assigned to object?
3. What should the default predecessor logic be?
4. Should user be prompted to confirm auto-generation?

### Files to Check
- `src/main/database/repositories/SQLiteModelAreaRoutingRepository.ts`
- IPC handlers for area/model assignment
- Phase 6.5+ documentation on routing logic

---

## Bug 3: Delete Selection Fails After Navigation (UX Issue - NOT Data Loss)

**Priority:** Medium
**Impact:** UX - Selection doesn't work consistently after navigation
**Status:** ✅ CLARIFIED - Soft delete works correctly, issue is selection UX only

### Description

After navigation (Canvas → Models → Canvas), selection sometimes fails intermittently, making it difficult to delete objects. However, **this is NOT a data loss bug** - the system correctly implements soft delete.

### CLARIFICATION (2026-02-15)

**✅ System works correctly:**
- Delete operations use soft delete: `UPDATE canvas_objects SET active = 0`
- Load operations filter correctly: `WHERE active = 1`
- Objects marked as deleted stay deleted (don't reappear after navigation)
- Future Ctrl+Z functionality can restore `active = 0` objects

**❌ UX issue (selection):**
- After navigation, `commitHookEffectListMount` appears
- Selection clears immediately after clicking
- Sometimes takes multiple attempts to select and delete
- But when delete DOES execute, it works correctly (soft delete)

### Expected Behavior
- User navigates between tabs
- Returns to Canvas
- Clicks object → Selection applies and STAYS
- Presses Delete → Works on first attempt

### Actual Behavior
- User navigates between tabs
- Returns to Canvas
- Clicks object → Selection applies then CLEARS immediately
- May need multiple clicks/attempts
- Eventually works, but UX is frustrating

### Root Cause

The `commitHookEffectListMount` behavior is caused by ReactFlow's internal effects remounting after navigation. This creates a timing issue where selection clears immediately after being applied.

**Why it happens:**
1. Navigation causes ProductionCanvas to unmount/remount
2. ReactFlow reinitializes its internal state
3. Something in the initialization triggers effect remounting on interactions
4. Selection applies → Effect remounts → Selection clears

**Why it's only a UX issue, not data loss:**
- When delete DOES execute, it correctly does soft delete
- Soft delete verified: `UPDATE canvas_objects SET active = 0`
- Load filter verified: `WHERE active = 1`
- Objects stay deleted across navigation cycles

### Possible Solutions

**Option 1: Improve selection stability (Low effort)**
- Investigate why `getNodes().filter(n => n.selected)` returns empty after navigation
- May involve timing of when selection state is read vs when it's applied
- Estimated: 1-2 hours

**Option 2: Architectural refactor (High effort)**
- Make ReactFlow single source of truth (ChatGPT's recommendation)
- Remove dual-store pattern entirely
- Estimated: 2-3 hours
- Higher confidence but more invasive

### Files to Check
- `src/renderer/features/canvas/ProductionCanvas.tsx` (delete handler lines 410-459)
- `src/renderer/features/canvas/hooks/useLoadLines.ts` (store-based guard)
- `src/main/ipc/handlers/canvas-object.handler.ts` (backend delete handler)
- Database: `canvas_objects` table (check if deletes persist)

---

## Bug 4: commitHookEffectListMount Appears After Post-Navigation Clicks

**Priority:** Low (if Bug 3 is resolved)
**Impact:** Unknown - May be cosmetic or may indicate deeper issue

### Description

After navigating between tabs and returning to Canvas, clicking on objects triggers `commitHookEffectListMount` in React DevTools console, indicating ReactFlow is mounting internal effects.

### Evidence
```
[onNodeClick] Clicked node: ID
[onSelectionChange] Selection changed: 1 nodes selected
[onSelectionChange] Selection changed: 0 nodes selected  ← Clears
commitHookEffectListMount  ← ReactFlow effect mounts
```

### Investigation Efforts
- Removed `clearSelection()` from useLoadLines ❌
- Changed `fitView` prop to `fitView()` function ❌
- Implemented batch delete ❌
- All attempts didn't prevent this behavior

### Possible Causes
1. Dual-store pattern (useCanvasStore + ReactFlow) creates state conflicts
2. ReactFlow receiving nodes with changing references
3. Some prop of ReactFlow causing internal effect remounts
4. Fundamental to how ReactFlow works with controlled components

### If This Needs Fixing
- Likely requires architectural refactor
- Make ReactFlow single source of truth
- Remove useCanvasStore.nodes entirely

### Current Status
- Appears in logs but doesn't seem to break functionality (if Bug 3 verifies deletes work)
- Low priority unless Bug 3 confirms it's causing issues

---

## Bug 5: Deleted Objects Reappear After Mac Sleep/Wake ✅ RESOLVED

**Priority:** ~~CRITICAL~~ → RESOLVED
**Impact:** ~~Data Loss / Inconsistent State~~ → Fixed
**Resolved:** 2026-02-15 (Commit: 2bcf5b3)
**Documentation:** `docs/fixes/bug-5-mac-sleep-wake-objects-reappear.md`

### Problem (Original)

When Mac entered sleep/wake cycle, deleted canvas objects would reappear despite being correctly marked as `active = 0` in the database.

### Root Cause (Found)

1. Vite HMR WebSocket disconnects during Mac sleep
2. On wake, Vite calls `location.reload()` destroying all Zustand stores
3. App reloads ALL active objects from DB, including objects "deleted" from UI only
4. Deletes never reached DB due to Bug 3/4 (selection clears before delete executes)

### Solution (Implemented - 4 Iterations)

**v4 (Final Fix):**
- Added WAL checkpoint methods (PASSIVE/FULL/TRUNCATE modes)
- PowerMonitor handlers: suspend → TRUNCATE checkpoint, resume → log only
- Periodic checkpoint every 30s (PASSIVE mode)
- Checkpoint after soft delete operations
- beforeunload handler detects `vite:ws:disconnect` and blocks reload with `preventDefault()`
- Removed destructive `refreshAllStores()` from resume handler

**Result:** Objects stay stable through sleep/wake cycles (5000x faster resume: 0.01ms vs 50-200ms)

### Files Modified
- `src/main/database/connection.ts` - checkpoint() method
- `src/main/index.ts` - powerMonitor handlers + periodic checkpoint
- `src/main/database/repositories/SQLiteCanvasObjectRepository.ts` - checkpoint after delete
- `src/shared/constants/index.ts` - POWER_EVENTS constant
- `src/preload.ts` - POWER_EVENTS whitelist
- `src/renderer/index.tsx` - beforeunload handler
- `src/renderer/components/layout/AppLayout.tsx` - simplified resume handler
- `src/renderer/features/canvas/store/useCanvasStore.ts` - @deprecated refreshNodes()

### Verification
✅ Objects stay stable through multiple sleep/wake cycles
✅ Process objects with models/areas preserved
✅ Delete one-by-one + sleep/wake works correctly
✅ Save/Don't Save dialog works after sleep/wake
✅ NO "Error: Area cannot be empty" during resume

**For complete technical details, see:** `docs/fixes/bug-5-mac-sleep-wake-objects-reappear.md`

---

## Summary

| Bug | Priority | Impact | Status |
|-----|----------|--------|--------|
| 1. Status bar "0 Lines" | Medium | UX | ⚠️ PENDING |
| 2. Routings don't auto-generate | Medium-High | Workflow | ⚠️ PENDING |
| 3. Delete selection fails post-navigation | Medium | UX (NOT data loss) | ✅ CLARIFIED |
| 4. commitHookEffectListMount appears | Low | UX/Cosmetic | ⚠️ COSMETIC |
| 5. Objects reappear after Mac sleep | ~~CRITICAL~~ | ~~Data inconsistency~~ | ✅ RESOLVED (2026-02-15) |

---

## Recommended Priority Order for Next Session

1. **FIRST:** Fix incomplete process object counter - Bug 1 (CONTINUED)
   - Parts 1 and 1b were implemented but counter still fails
   - Investigate whether completeness check reads from `objects[]` (Phase 7.6 source of truth)
   - Verify refresh triggers fire AFTER `objects[]` is updated
   - See updated Bug 1 section above for investigation starting points

2. **SECOND:** Investigate Routings auto-generation - Bug 2
   - Design decision: Should this be automatic?
   - If yes, implement feature
   - If no, update UX to make manual process clear
   - Medium-High priority for workflow efficiency

3. **THIRD:** Address Bug 3 selection UX (only if user workflow requires)
   - If users can work around it: Low priority
   - If it's blocking workflow: Implement selection stability fix
   - Consider architectural refactor (ReactFlow single source of truth)

4. **ALTERNATIVE:** Continue with Phase 8.0 (8 handlers pending)
   - Fix database instance references in remaining IPC handlers
   - Prevents "database connection is not open" errors after opening .lop files
   - See: `docs/specs/phase-8.0-fix-remaining-handler-instances.md`

---

*Documented by: Claude Sonnet 4.5*
*Date: 2026-02-15*
*Updated: 2026-02-17 - Bug 1 updated with Phase 7.6 context; Phase 7.6 (canvas SSoT) completed*

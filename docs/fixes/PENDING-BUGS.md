# Pending Bugs - To Address in Future Sessions

**Last Updated:** 2026-02-15
**Status:** Documented, not yet investigated

---

## Bug 1: Status Bar Shows "0 Lines" Despite Process Objects Existing

**Priority:** Medium
**Impact:** UX/Visual - Data appears incomplete

### Description

The status bar at the bottom of the Canvas shows "Data Incomplete" and displays "0 Lines" even when process objects (converted lines) exist on the canvas.

### Expected Behavior
- Status bar should count process objects as "lines"
- Should show: "X Lines" where X = number of process objects

### Actual Behavior
- Shows: "0 Lines"
- Other metrics are correct: "2 Models", "2 Volumes", "12 Compat"

### Context
- User created several objects
- Converted them to process objects (using object type conversion)
- Generated areas and models
- Assigned them to objects/lines
- Status bar still shows "0 Lines"

### Possible Causes
1. Status bar logic only counts `production_lines` table entries
2. Doesn't count `canvas_objects` where `objectType = 'process'`
3. After Phase 7.5 unification, status bar wasn't updated

### Investigation Needed
- Check where status bar data comes from
- Verify if it queries `production_lines` (deprecated) instead of `canvas_objects`
- See Phase 7.5 migration 017_unify_production_lines.sql

### Files to Check
- Status bar component (likely in Canvas feature)
- IPC handler for status data
- Repository that provides line count

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

## Bug 3: Delete Post-Navigation May Not Persist to Database (CRITICAL - NEEDS VERIFICATION)

**Priority:** CRITICAL
**Impact:** Data Loss - Deletes might not persist

### Description

After investigating the Canvas delete bug for 5 days, we noticed that deletes AFTER navigation may not be persisting to the database, despite appearing to work in the UI.

### Expected Behavior
- User creates objects
- User navigates to Models (or any tab)
- User returns to Canvas
- User selects and deletes object
- **Object is deleted from database**
- When app restarts, object stays deleted

### Actual Behavior
- User creates objects
- User navigates to Models
- User returns to Canvas
- User selects and deletes object
- **Object disappears from UI** ✅
- **BUT backend logs don't show deletion** ❌
- Unknown if object is actually deleted from DB

### Evidence

**Test 1 (no navigation) - Backend logs show:**
```
[Canvas Object Handler] Deleting object: cDPJvUeaa04ArgCjMyHk1
[Canvas Object Handler] Deleting object: U_zIu4Cm4jJH_cXS99Tgu
...
```
✅ Each delete reaches backend

**Test 2 (with navigation) - Backend logs show:**
```
[useLoadLines] Store already has 5 objects for plant: X - skipping reload
```
❌ NO "[Canvas Object Handler] Deleting object: ..." logs

**Frontend logs show:**
```
[Delete] Total nodes: 4
[Delete] Nodes with selected=true: 0
[ProductionCanvas] Delete pressed but no objects selected
```
→ Delete handler returns early (no objects selected)

### User Reports
- "funciona al primer click, veo el borde azul y funciona"
- Objects don't reappear after multiple navigation cycles
- Tested with all tabs: Models, Routings, Areas, Plants, Global, Preferences

### The Mystery
- User sees objects disappear ✅
- User sees blue selection border ✅
- Objects don't reappear after navigation ✅
- **But backend doesn't log the delete** ❌

### Hypotheses

**Hypothesis A: Deletes are working, logs were just missed**
- Maybe backend logs were scrolled past
- Maybe delete happens through different code path
- Need to verify by checking DB directly

**Hypothesis B: Objects removed from UI store but not DB**
- useLoadLines "skips reload" so uses local store
- Local store has objects removed (visually)
- But DB still has them
- On app restart, would they reappear?

**Hypothesis C: commitHookEffectListMount is cosmetic**
- The effect remount happens but doesn't break functionality
- Selection clears momentarily but re-applies
- Delete works despite the logs suggesting otherwise

### Verification Steps (MUST DO NEXT SESSION)

1. **Setup:**
   - Fresh database
   - Create 5 objects in Canvas
   - Note their IDs

2. **Test:**
   - Navigate to Models
   - Return to Canvas
   - Select and delete 1 object
   - User confirms: "It worked, I see it disappear"

3. **Verify Database:**
   - Open DB with SQLite browser
   - Check `canvas_objects` table
   - Is the deleted object still there?
   - Check `active` flag (should be 0 if soft delete)

4. **Verify Persistence:**
   - Completely restart the app (kill process)
   - Fresh load from database
   - Do the "deleted" objects reappear?

5. **Check Backend Logs:**
   - Did `[Canvas Object Handler] Deleting object: ID` appear?
   - If yes: Hypothesis A is correct
   - If no: Hypothesis B is correct → CRITICAL BUG

### If Verification Shows Bug Exists

**Option 1: Quick Fix**
- Find why `getNodes().filter(n => n.selected)` returns empty array post-navigation
- Fix the selection state preservation
- Ensure delete handler actually executes

**Option 2: Architectural Refactor (ChatGPT's recommendation)**
- Make ReactFlow single source of truth
- Remove dual-store pattern
- Estimated effort: 2-3 hours
- Higher confidence of success

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

## Summary

| Bug | Priority | Impact | Verification Needed |
|-----|----------|--------|-------------------|
| 1. Status bar "0 Lines" | Medium | UX | No - clearly reproducible |
| 2. Routings don't auto-generate | Medium-High | Workflow | No - clearly reproducible |
| 3. Delete post-navigation may not persist | **CRITICAL** | Data Loss | **YES - MUST DO FIRST** |
| 4. commitHookEffectListMount appears | Low | Unknown | Depends on Bug 3 result |

---

## Recommended Priority Order for Next Session

1. **FIRST:** Verify Bug 3 (delete persistence)
   - If deletes work: Mark as resolved, celebrate 🎉
   - If deletes fail: Fix immediately (critical data loss bug)

2. **SECOND:** Fix Status bar "0 Lines" (quick win)
   - Likely just updating query to count process objects
   - Should be < 30 min

3. **THIRD:** Investigate Routings auto-generation
   - Design decision: Should this be automatic?
   - If yes, implement feature
   - If no, update UX to make manual process clear

4. **FOURTH:** Address commitHookEffectListMount (only if needed)
   - If Bug 3 shows deletes work: Ignore this (cosmetic)
   - If Bug 3 shows deletes fail: Requires architectural fix

---

*Documented by: Claude Sonnet 4.5*
*Date: 2026-02-15*

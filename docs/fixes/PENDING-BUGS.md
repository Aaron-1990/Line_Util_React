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

## Bug 5: Deleted Objects Reappear After Mac Sleep/Wake (CRITICAL)

**Priority:** CRITICAL
**Impact:** Data Loss / Inconsistent State - Deleted objects reappear

### Description

When the Mac enters sleep/suspension mode and then wakes up (user logs back in with fingerprint), all objects that were previously deleted reappear in the Canvas, even though they were correctly marked as `active = 0` in the database.

### Expected Behavior
1. User deletes objects from Canvas
2. Objects marked as `active = 0` in DB (soft delete)
3. Mac enters sleep mode
4. User wakes Mac (Touch ID / password)
5. App resumes
6. **Deleted objects stay deleted** (not visible)

### Actual Behavior
1. User deletes objects from Canvas ✅
2. Objects marked as `active = 0` in DB ✅
3. Mac enters sleep mode
4. User wakes Mac
5. App resumes
6. **Deleted objects REAPPEAR in Canvas** ❌

### User Report
- "me fui por un rato de la laptop mac, entro en modo creo suspension, o reposo"
- "al poner mi huella, todos los objetos que habia borrado del canvas reaparecieron"
- "si la app esta activa y los borro al navegar ya no reaparecen"
- "incluso si genero nuevos objetos, estos ya no aparecen" (after wake)

### Possible Causes

**Hypothesis 1: App reload on wake**
- Electron might be reloading the entire app on wake
- Store gets cleared and reloads from DB
- BUT load query might be broken and loading `active = 0` objects

**Hypothesis 2: State reset on wake**
- Mac sleep triggers some state reset
- Zustand stores get cleared
- Reload happens but with incorrect query

**Hypothesis 3: Event listener issue**
- Electron has resume/wake event listeners
- Custom code might be reloading data incorrectly
- May be resetting `active` flags back to 1

**Hypothesis 4: Cache/WAL checkpoint issue**
- Soft delete happens (`active = 0`)
- But change isn't flushed to disk before sleep
- On wake, WAL rollback restores `active = 1`
- Note: Code comment mentions "WAL checkpoint removed to prevent table locks"

### Investigation Needed

1. **Check for Electron wake/resume listeners:**
   - Search for: `app.on('resume')`, `powerMonitor`, `'wake'` events
   - See if custom code reloads data on wake

2. **Verify DB query on load:**
   - Confirm `findAllByPlant()` uses `WHERE active = 1`
   - Already verified (line 112 of SQLiteCanvasObjectRepository.ts)
   - So if objects reappear, they must have `active = 1` in DB

3. **Test WAL persistence:**
   - Delete object
   - Check DB immediately: `SELECT active FROM canvas_objects WHERE id = ?`
   - Sleep Mac
   - Wake Mac
   - Check DB again: Did `active` change from 0 to 1?

4. **Check DB transaction handling:**
   - Are deletes wrapped in transactions?
   - Are transactions committed before sleep?
   - Is WAL checkpoint needed to persist changes?

### Files to Check
- `src/main/index.ts` - Main process, app lifecycle events
- `src/main/database/index.ts` - DB initialization, WAL mode
- Electron docs: Power monitoring, app events
- SQLite WAL documentation

### Temporary Workaround
Force WAL checkpoint after delete:
```typescript
// In SQLiteCanvasObjectRepository.delete()
this.db.prepare('PRAGMA wal_checkpoint(FULL)').run();
```

But this was previously removed due to "table locks during bulk operations".

---

## Summary

| Bug | Priority | Impact | Verification Needed |
|-----|----------|--------|-------------------|
| 1. Status bar "0 Lines" | Medium | UX | No - clearly reproducible |
| 2. Routings don't auto-generate | Medium-High | Workflow | No - clearly reproducible |
| 3. Delete selection fails post-navigation | Medium | UX (NOT data loss) | ✅ Clarified - soft delete works |
| 4. commitHookEffectListMount appears | Low | UX/Cosmetic | No - low priority |
| 5. Objects reappear after Mac sleep | **CRITICAL** | Data inconsistency | **YES - MUST FIX** |

---

## Recommended Priority Order for Next Session

1. **FIRST:** Investigate Bug 5 (Mac sleep/wake) - CRITICAL
   - Check Electron wake/resume listeners
   - Verify if objects have `active = 1` after wake
   - Test WAL checkpoint behavior
   - Implement fix (likely force WAL checkpoint or handle resume event)

2. **SECOND:** Fix Status bar "0 Lines" (quick win)
   - Update query to count process objects
   - Should be < 30 min

3. **THIRD:** Investigate Routings auto-generation
   - Design decision: Should this be automatic?
   - If yes, implement feature
   - If no, update UX to make manual process clear

4. **FOURTH:** Address Bug 3 selection UX (only if user workflow requires)
   - If users can work around it: Low priority
   - If it's blocking workflow: Implement selection stability fix

---

*Documented by: Claude Sonnet 4.5*
*Date: 2026-02-15*

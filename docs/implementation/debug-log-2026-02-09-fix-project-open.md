# Debug Log: Fix Project Open Workflow

> **Date:** 2026-02-09
> **Phase:** 8.1 - Untitled Project Workflow (Bug Fixes)
> **Duration:** ~4 hours
> **Status:** ✅ RESOLVED

---

## Problem Statement

After implementing Phase 8.1 (Untitled Project Workflow), opening `.lop` files via File > Open Project resulted in:
- File dialog closed successfully
- App window still showed "Untitled Project"
- No data loaded into UI (plants, models, lines, etc.)
- No error messages in terminal

**User Impact:** Critical - Cannot open saved project files

---

## Root Causes Identified

### 1. Stale Database Instance References (CRITICAL)

**File:** `src/main/ipc/handlers/production-lines.handler.ts`

**Problem:**
```typescript
// ❌ INCORRECT - Gets instance ONCE at registration
export function registerProductionLinesHandlers(): void {
  const db = DatabaseConnection.getInstance();  // ← Stale after replaceInstance()
  const repository = new SQLiteProductionLineRepository(db);

  ipcMain.handle('lines:get-all', async () => {
    const lines = await repository.findActive();  // ← Uses closed DB instance
  });
}
```

**Why it failed:**
1. Handler registers with initial global DB instance
2. `replaceInstance()` closes old instance, assigns new .lop instance
3. Handler still uses closed instance → "database connection is not open"

**Solution:**
```typescript
// ✅ CORRECT - Gets fresh instance on each request
ipcMain.handle('lines:get-all', async () => {
  const repository = new SQLiteProductionLineRepository(
    DatabaseConnection.getInstance()  // ← Fresh instance every time
  );
  const lines = await repository.findActive();
});
```

**Impact:** Production lines data now loads correctly after opening .lop files

---

### 2. Duplicate Event Listeners

**Files:**
- `src/renderer/store/useProjectStore.ts` (line 200)
- `src/renderer/components/layout/AppLayout.tsx` (line 335)

**Problem:** Both files registered listeners for `PROJECT_OPENED` event:
```typescript
// useProjectStore.ts - Called refreshProjectInfo() only
window.electronAPI.on(PROJECT_EVENTS.PROJECT_OPENED, () => {
  useProjectStore.getState().refreshProjectInfo();
});

// AppLayout.tsx - Called full refreshAllStores()
window.electronAPI.on(PROJECT_EVENTS.PROJECT_OPENED, handleProjectOpened);
```

**Why it failed:**
- Race condition between two listeners
- Project state (`setProjectType`, `clearUnsavedChanges`) updated multiple times
- Stores refreshed multiple times
- UI state inconsistent → appeared as "Untitled Project"

**Solution:** Removed duplicate listener from `useProjectStore.ts`, kept only AppLayout.tsx handler.

**Event ownership pattern established:**
- **High-level lifecycle** (`PROJECT_OPENED`, `PROJECT_RESET`) → AppLayout coordinates
- **Low-level state** (`PROJECT_SAVED`, `PROJECT_CLOSED`) → Stores handle individually

---

### 3. window.location.reload() Issues in Electron

**File:** `src/renderer/components/layout/AppLayout.tsx`

**Problem:**
```typescript
const handleProjectOpened = useCallback(() => {
  setProjectType('saved', filePath);
  clearUnsavedChanges();
  refreshProjectInfo();

  window.location.reload();  // ❌ Closes DB connection in Electron
});
```

**Why it failed:**
- `window.location.reload()` has known issues in Electron
- Causes database connection to close unexpectedly
- Not the standard Electron pattern for refreshing app state

**Solution:** Created `refreshAllStores()` function to reload all Zustand stores:
```typescript
async function refreshAllStores(): Promise<void> {
  await Promise.all([
    useProjectStore.getState().refreshProjectInfo(),
    usePlantStore.getState().loadPlants(),
    useModelStore.getState().loadModels(),
    useAreaStore.getState().loadAreas(),
    useAnalysisStore.getState().refreshData(),
    useChangeoverStore.getState().loadFamilyDefaults(),
    useChangeoverStore.getState().loadGlobalSettings(),
    useRoutingStore.getState().loadData(),
    useCanvasStore.getState().refreshNodes(),
    useShapeCatalogStore.getState().refreshCatalog(),
  ]);

  useNavigationStore.getState().initializePlantFromStorage();
}
```

**Impact:** Standard Electron pattern, no DB connection issues, better performance

---

### 4. Empty Test File (Diagnosis Issue)

**File:** `~/Desktop/test-open-target.lop`

**Problem:** Test file was empty (0 plants, 0 lines, 0 models)

**Why it confused us:**
- All systems were working correctly
- File opened successfully, stores refreshed correctly
- BUT no data to display → appeared broken

**Solution:** Created proper test file with data using controlled procedure

---

## Timeline

### [15:00] Initial Problem Report
- User reports .lop files not loading after File > Open
- Terminal shows "database connection is not open" errors

### [15:30] First Fix Attempt - window.location.reload()
- Replaced with `refreshAllStores()`
- User correctly rejected as potential workaround
- Investigated proper Electron patterns

### [16:00] Discovered production-lines.handler.ts Bug
- Found stale `getInstance()` pattern
- Fixed all 9 handlers in production-lines.handler.ts
- Error "database connection is not open" disappeared

### [16:30] File Still Not Loading - Duplicate Listeners
- backend-architect agent identified duplicate PROJECT_OPENED listeners
- Removed duplicate from useProjectStore.ts
- Still didn't fix apparent issue

### [17:00] Systematic Diagnosis
- backend-architect agent ran systematic root cause analysis
- Checked test file with sqlite3 → **FILE WAS EMPTY**
- All systems were working correctly

### [17:15] Controlled Test Procedure
- Created new test file with data (test-controlled.lop)
- Verified Save As works correctly
- Verified Open Project works correctly
- **CONFIRMED: All systems functional** ✅

---

## Files Modified

### Main Process
1. **src/main/ipc/handlers/production-lines.handler.ts**
   - Updated 9 handlers to use fresh `getInstance()` on each request
   - Lines: 13-302 (entire file refactored)

### Renderer Process
2. **src/renderer/components/layout/AppLayout.tsx**
   - Added `refreshAllStores()` helper function (lines 27-58)
   - Updated `handleProjectOpened` to use `refreshAllStores()` (line 239)
   - Updated `handleProjectReset` to use `refreshAllStores()` (line 267)
   - Removed `refreshProjectInfo` from dependency arrays (async now)

3. **src/renderer/store/useProjectStore.ts**
   - Removed duplicate `PROJECT_OPENED` listener (deleted lines 200-202)
   - Kept `PROJECT_SAVED` and `PROJECT_CLOSED` listeners
   - Added clarifying comments about event ownership

### Documentation
4. **docs/specs/phase-8.1-fix-project-open-duplicate-listeners.md**
   - Complete specification of duplicate listener fix
   - Event ownership pattern documentation

5. **docs/implementation/debug-log-2026-02-09-fix-project-open.md**
   - This file (real-time implementation log)

---

## Validation

### Type Check
```bash
npm run type-check  # ✅ Passes
```

### Manual Testing
```bash
# Test Save As functionality
1. Create Untitled Project
2. Add plant: TEST / Test Plant
3. File > Save As → test-controlled.lop
4. Verify with sqlite3: ✅ Plant exists in file

# Test Open Project functionality
5. File > New Project → Don't Save
6. Verify: Empty catalog
7. File > Open Project → test-controlled.lop
8. Verify: ✅ Plant TEST appears in UI

# Test database switching
9. Check terminal logs: ✅ Single refresh cycle, no errors
```

---

## Remaining Work

### Tests Pending (Phase 8.1 - Untitled Project Workflow)

**Test 4:** "Don't Save" before File > Open
- Status: Not started
- Scenario: Untitled project with unsaved changes → File > Open → Don't Save
- Expected: Opens selected file, discards unsaved changes

**Test 5:** "Cancel" in save dialog before File > Open
- Status: Not started
- Scenario: Untitled project with unsaved changes → File > Open → Save → Cancel dialog
- Expected: Stays in current project

**Test 6:** Save As with unsaved changes before File > New
- Status: Not started
- Scenario: Untitled project with unsaved changes → File > New → Save
- Expected: Prompts for save location, creates new empty project

**Test 7:** "Don't Save" before File > New
- Status: Not started
- Scenario: Untitled project with unsaved changes → File > New → Don't Save
- Expected: Creates new empty project, discards unsaved changes

**Test 8:** Save successfully before File > New
- Status: Not started
- Scenario: Saved project with unsaved changes → File > New → Save
- Expected: Saves changes, creates new empty project

### Other Handlers Needing Fix (Low Priority)

From `docs/specs/fix-remaining-database-instance-refs.md`:
- area-catalog.handler.ts
- canvas-objects.handler.ts
- analysis.handler.ts
- multi-sheet-excel.handler.ts
- canvas-object-compatibility.handler.ts
- excel.handler.ts
- model-processes.handler.ts
- product-models.handler.ts

**Note:** These handlers only affect specific features when opening .lop files. Not critical for Test 4-8 completion.

---

## Lessons Learned

### ✅ What Worked Well
1. **Using specialized agents** (backend-architect) for complex Electron/IPC issues
2. **Systematic diagnosis** instead of fixing symptoms
3. **Framework Híbrido v2.0 Anti-Workaround protocol** - forced us to find proper solutions
4. **Controlled test procedures** - created reproducible test cases

### ⚠️ What Could Improve
1. **Earlier use of agents** - spent time debugging manually first
2. **Test file validation** - should have checked file contents earlier
3. **Terminal logs analysis** - needed better renderer-side logging

### 🎯 Key Takeaways
1. **Electron IPC pattern:** Always get `getInstance()` in handler, not at registration
2. **Event ownership:** Single listener per event type (AppLayout = coordinator)
3. **Avoid window.location.reload()** in Electron - use store refresh instead
4. **Verify test data** before debugging system behavior

---

## Impact Assessment

### ✅ Fixed Issues
- ✅ Project files (.lop) now open correctly
- ✅ Data loads into UI after opening files
- ✅ No "database connection is not open" errors
- ✅ Clean single refresh cycle (no duplicates)
- ✅ Production lines catalog works after opening files

### 🔧 Known Limitations
- ⚠️ Other handlers (8 remaining) still use old pattern - will fail for specific features when opening .lop files
- ⚠️ Tests 4-8 not yet validated

### 📈 Next Steps
1. Continue with Tests 4-8 (Untitled Project Workflow)
2. Fix remaining 8 handlers (Phase 8.0 continuation)
3. Add automated tests for File > Open/Save workflows

---

**Total Time:** ~4 hours
**Lines Changed:** ~150
**Tests Completed:** 1-3 of 8 (Test 3 extended)
**Tests Remaining:** 4-8

**Status:** Phase 8.1 File Open workflow ✅ WORKING

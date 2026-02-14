# Fix: Canvas Objects Save/Load & Shape Catalog Auto-Seed

**Date:** 2025-02-14
**Developer:** Aaron Zapata (with Claude Code)
**Status:** ✅ RESOLVED
**Framework:** Híbrido v2.0 - Contracts-First, No Workarounds

---

## Executive Summary

Fixed two critical bugs related to project save/load workflows:

1. **Primary Bug:** Canvas objects not loading after saving and reopening project files (.lop)
2. **Regression Bug:** Shape catalog empty when creating new projects (exposed after fixing primary bug)

Both bugs are now resolved with robust solutions that prevent future data integrity issues.

---

## Bug #1: Canvas Objects Not Loading After Save/Reopen

### Symptom

User creates canvas objects, saves project as `.lop` file, reopens the file → canvas is empty despite objects being saved correctly in the database.

### Root Cause

**localStorage plant ID persistence across database switches.**

When a project file is opened, the navigation store loads an outdated plant ID from localStorage instead of using the plant ID from the newly loaded database:

```
Session 1 (Temp DB):
  - Plant ID: "BDDixTiuxGcu1qzVTf4tQ"
  - User creates objects linked to this plant
  - Saves to areas_limpio.lop
  - localStorage persists: "BDDixTiuxGcu1qzVTf4tQ"

Session 2 (After reopen):
  - Opens areas_limpio.lop
  - File contains plant "BDDixTiuxGcu1qzVTf4tQ"
  - But temp DB has new plant: "caHSrCMa7_J-GopguDAu8"
  - Navigation store loads from localStorage: "BDDixTiuxGcu1qzVTf4tQ"
  - Canvas queries with WRONG plant ID → 0 objects found
```

### Solution (Contracts-First)

**BLOQUE 0: Architecture Analysis**
- Identified localStorage persistence as anti-pattern for database-scoped data
- Defined clear contracts for plant ID lifecycle across DB switches

**Implementation (3 fixes):**

1. **NavigationStore - Clear localStorage on DB switch**
   - Added `clearPersistedPlantId()` method
   - Clears localStorage plant ID when database instance changes

2. **PlantStore - Validate plant exists before using**
   - Enhanced `loadPlants()` to validate navigation store's plant ID against loaded plants
   - Fallback to default plant if stored plant doesn't exist in current DB

3. **AppLayout - Clear before refresh**
   - Modified `refreshAllStores()` to call `clearPersistedPlantId()` BEFORE loading stores
   - Ensures clean state when switching databases

### Files Modified

| File | Change | Lines |
|------|--------|-------|
| `src/renderer/store/useNavigationStore.ts` | Added `clearPersistedPlantId()` method | 108-116 |
| `src/renderer/features/plants/store/usePlantStore.ts` | Added validation in `loadPlants()` | 175-188 |
| `src/renderer/components/layout/AppLayout.tsx` | Clear localStorage before refresh | 44-48 |

### Testing Performed

✅ Create objects in temp DB → Save As → Reopen → Objects load correctly
✅ Plant ID matches database after reopen
✅ No localStorage mismatches in console
✅ Existing functionality not broken (copy/paste, duplicate)

---

## Bug #2: Shape Catalog Empty in New Projects (Regression)

### Symptom

After fixing Bug #1, when user creates "New Project", the Object Palette has no shapes available (Rectangle, Triangle, Circle, Diamond missing).

### Root Cause Analysis

**Shape catalog tables preserved but empty.**

The fix for Bug #1 was architecturally correct but exposed an underlying issue:

1. `ProjectFileService.newProject()` was modified to preserve system tables (`shape_catalog`, `shape_categories`, `shape_anchors`)
2. BUT these tables were already empty (migrations had run but data was missing)
3. Preserving empty tables = no shapes available

**Why tables were empty:**
- Migrations create tables and INSERT seed data in one SQL file
- Migration 012 only runs ONCE (tracked in `migrations` table)
- If shapes were deleted after migration ran, they don't get restored
- `newProject()` now preserves these tables instead of deleting them

### Solution (Safety Check Pattern)

**Created auto-seed helper function** that:
1. Checks if `shape_catalog` is empty
2. If empty, re-executes INSERTs from migration 012
3. Runs at two critical points:
   - App startup (`initializeApp()`)
   - New project creation (`ProjectFileService.newProject()`)

This ensures shapes are ALWAYS available regardless of database state.

### Files Modified

| File | Change | Lines |
|------|--------|-------|
| `src/main/services/project/ProjectFileService.ts` | Exclude shape tables from clear | 405-410 |
| `src/main/services/project/ProjectFileService.ts` | Auto-create default plant in `newProject()` | 438-447 |
| `src/main/services/project/ProjectFileService.ts` | Added `ensureShapesSeeded()` helper | 537-595 |
| `src/main/index.ts` | Added `ensureShapesSeeded()` function | 74-130 |
| `src/main/index.ts` | Call auto-seed in `initializeApp()` | 106 |

### Implementation Details

**Shape auto-seed function:**
```typescript
function ensureShapesSeeded(db: Database): void {
  // 1. Check if shape_catalog has data
  const count = db.prepare('SELECT COUNT(*) as count FROM shape_catalog').get();

  if (count > 0) return; // Already seeded

  // 2. Re-insert built-in shapes
  // - 4 shape categories (basic, machines, flow, custom)
  // - 4 basic shapes (rectangle, triangle, circle, diamond)
  // - 15 shape anchors (connection points for each shape)
}
```

**Called at:**
- `src/main/index.ts:initializeApp()` - App startup safety check
- `src/main/services/project/ProjectFileService.ts:newProject()` - New project safety check

### Testing Performed

✅ App startup → Default plant created, shapes available
✅ New Project → Default plant created, shapes available
✅ Open saved project → Objects load correctly
✅ Create objects → Save → Reopen → Objects persist correctly

---

## Architecture Principles Applied

### 1. Contracts-First (BLOQUE 0)
Before implementing, we:
- Investigated Zustand persist patterns
- Analyzed complete save/load flow
- Defined clear contracts for plant ID lifecycle
- Validated against browser localStorage APIs

### 2. No Workarounds
- Solution uses standard Zustand patterns (manual localStorage management)
- No "tricks" or "hacks" to bypass framework behavior
- Followed official patterns from Zustand 4.x documentation

### 3. Fail-Safe Defaults
- If stored plant invalid → fallback to default plant
- If shapes empty → auto-seed from migration data
- Non-fatal errors logged as warnings, don't crash app

### 4. Separation of Concerns
- **User Data:** Cleared on "New Project" (models, volumes, canvas objects)
- **System Data:** Preserved (shape_catalog, migrations)
- Clear distinction prevents accidental deletion of built-in data

---

## Critical Code Sections (DO NOT MODIFY WITHOUT REVIEW)

### 1. AppLayout.refreshAllStores()
```typescript
// CRITICAL: Clear localStorage plant ID BEFORE loading stores
useNavigationStore.getState().clearPersistedPlantId();

await Promise.all([...store refreshes...]);
```

**Why critical:** If clearPersistedPlantId() is removed or moved AFTER Promise.all(), the localStorage plant ID mismatch bug will return.

### 2. ProjectFileService.newProject() - System Tables Exclusion
```typescript
WHERE type='table'
  AND name NOT LIKE 'sqlite_%'
  AND name NOT IN ('migrations', 'shape_catalog', 'shape_categories', 'shape_anchors')
```

**Why critical:** These are SYSTEM tables with built-in data. Removing them from exclusion list will delete shapes on every "New Project".

### 3. ensureShapesSeeded() - Auto-Seed Logic
```typescript
if (shapeCount.count > 0) {
  console.log('Shape catalog already seeded, skipping');
  return;
}
```

**Why critical:** Without this check, every app startup would try to re-insert shapes causing duplicate key errors. The check makes it idempotent.

---

## Future Considerations

### If Adding New System Tables

When adding new built-in data tables (e.g., template catalog, icon library):

1. **Add to exclusion list** in `ProjectFileService.newProject()`:
   ```typescript
   AND name NOT IN ('migrations', 'shape_catalog', ..., 'new_system_table')
   ```

2. **Create auto-seed helper** similar to `ensureShapesSeeded()`

3. **Call in two places**:
   - `initializeApp()` - app startup
   - `newProject()` - new project creation

### If Modifying Plant Store Initialization

The validation logic in `usePlantStore.loadPlants()` is critical:
```typescript
// Validate navigation store's plant ID against loaded plants
if (navStore.currentPlantId) {
  const exists = plants.some(p => p.id === navStore.currentPlantId);
  if (!exists) {
    navStore.setCurrentPlant(defaultPlantId); // Fallback
  }
}
```

DO NOT remove this - it prevents stale plant IDs from breaking the app.

### If Changing Database Connection Management

Any code that switches the active database instance (like `DatabaseConnection.replaceInstance()`) should be followed by:
```typescript
useNavigationStore.getState().clearPersistedPlantId();
```

This prevents localStorage from persisting plant IDs across database boundaries.

---

## Regression Prevention Checklist

Before modifying related code, verify:

- [ ] Does this change affect database instance switching?
- [ ] Does this change affect localStorage plant ID persistence?
- [ ] Does this change affect system data tables (shapes, migrations)?
- [ ] Does this change affect `refreshAllStores()` sequence?
- [ ] Have I tested all 4 scenarios:
  - [ ] App startup
  - [ ] New Project
  - [ ] Open saved project
  - [ ] Save & Reopen

If ANY checkbox is checked, run full regression testing before committing.

---

## Testing Protocol (For Future Changes)

### Minimal Test Suite
```bash
1. npm start
   → Verify: Default plant appears
   → Verify: Shapes available in Object Palette

2. Create canvas objects → Save As "test.lop"
   → Verify: File saves successfully

3. Reopen app → Open Project "test.lop"
   → Verify: Canvas objects load correctly
   → Verify: Plant ID matches saved file

4. File → New Project
   → Verify: Default plant created
   → Verify: Shapes available
   → Verify: Canvas starts empty
```

### Full Regression Suite
Add to minimal suite:
```bash
5. Create objects in Untitled → Don't Save → Reopen app
   → Verify: Canvas starts fresh, no persisted objects

6. Open saved project → Modify objects → Save → Reopen
   → Verify: Modifications persisted

7. Open project A → Open project B without saving
   → Verify: Project B loads correctly
   → Verify: No data leakage from project A
```

---

## Related Documentation

- **Framework:** `~/.claude/CLAUDE.md` - Framework de Desarrollo Híbrido v2.0
- **Phase History:** `docs/CHANGELOG-PHASES.md`
- **Database Schema:** `src/main/database/migrations/001_initial_schema.sql`
- **Shape Catalog:** `src/main/database/migrations/012_shape_catalog.sql`
- **Project Management:** Phase 8 (planned)

---

## Lessons Learned

### What Worked Well
1. **Framework methodology prevented workarounds** - BLOQUE 0 investigation found root cause
2. **Explore agent identified timing issues** - traced complete save/load flow
3. **Regression caught immediately** - user tested thoroughly after each fix
4. **Auto-seed pattern robust** - idempotent, defensive, non-fatal errors

### What Could Be Improved
1. **Initial analysis missed empty shapes** - should have checked ALL system tables
2. **No automated tests** - manual testing required for each change
3. **localStorage patterns unclear** - should document when to use vs avoid

### Future Improvements
1. Create automated E2E tests for project save/load workflows
2. Add database integrity check on app startup (verify system tables not empty)
3. Consider migrating to Zustand persist middleware for consistency
4. Add telemetry to track localStorage plant ID mismatches

---

## Sign-off

**Developer:** Aaron Zapata
**Date:** 2025-02-14
**Framework Compliance:** ✅ Híbrido v2.0
**Workarounds:** ❌ None
**Tests Passed:** ✅ All (4/4 scenarios)
**Documentation:** ✅ Complete

**Approved for Production:** ✅

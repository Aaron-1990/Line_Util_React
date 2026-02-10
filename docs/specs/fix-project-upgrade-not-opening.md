# Fix: Project Upgrade Not Opening After Migration

> **Bug Fix Specification**
> **Created:** 2026-02-08
> **Priority:** HIGH
> **Impact:** Critical - Users cannot open older project files

---

## Metadata

- **Agent:** backend-architect
- **Estimated Time:** 1 hour
- **Complexity:** Medium
- **Type:** Bug Fix

---

## Problem Statement

### Current Behavior (BROKEN)

```
User: File > Open Project → select old.lop
  ↓
Dialog: "This project needs upgrade"
  ↓
User: Click "Upgrade Project"
  ↓
System: Creates backup ✅
System: Runs migrations ✅
System: Shows "Successfully upgraded" ✅
  ↓
Result: App shows UNTITLED PROJECT (empty) ❌
Expected: App should show opened project with data ✅
```

### Root Cause

**File:** `src/main/services/project/ProjectFileService.ts`
**Lines:** 90-175

**Issue:** After successful migration (line 141), the database instance is NOT properly closed and re-opened. The code continues to line 167-175 with a stale database reference.

**Code flow:**
```typescript
// Line 61: Open DB temporarily
db = new Database(filePath, { readonly: false });

// Line 91-164: Migration block
if (compat.needsMigration) {
  // ... migrations happen ...

  // Line 135-141: Show success message
  await dialog.showMessageBox(...);

  // NO db.close() here! ❌
  // NO re-open of migrated file! ❌
}

// Line 167-175: Continue with stale db
this.currentFilePath = filePath;
return db; // ← Returns stale DB reference
```

**Why it fails:**
1. Database opened at line 61 is modified in-place during migration
2. After migration, DB is NOT closed and re-opened
3. Returning the stale `db` reference causes undefined behavior
4. Handler in `project.handler.ts` receives broken DB instance
5. `replaceInstance()` fails or receives wrong instance
6. App stays in Untitled state

---

## Solution Design

### Option A: Close and Re-open After Migration (RECOMMENDED)

**Pros:**
- Clean database state
- Migrations fully applied to disk
- No stale references

**Cons:**
- Slightly more code

**Implementation:**
```typescript
// After line 141 (success message)

// CLOSE the database that was migrated
db.close();
console.log(`[ProjectFileService] Closed migrated database`);

// RE-OPEN the migrated file
db = new Database(filePath as string, { readonly: false });
console.log(`[ProjectFileService] Re-opened migrated database`);

// Continue with normal flow (lines 167-175)
```

---

### Option B: Don't Show Success Dialog Immediately

**Pros:**
- No code duplication
- Natural flow

**Cons:**
- User doesn't get immediate feedback

**Implementation:**
```typescript
// Remove lines 134-141 (success dialog)
// Move success dialog to AFTER project opens in renderer
// Handler PROJECT_OPENED shows toast notification
```

---

## Implementation Plan

## BLOQUE 0: Contracts & Architecture

### Objective
Understand current flow and define fix approach.

**Analysis:**
1. Read `ProjectFileService.openProject()` (lines 25-176)
2. Read `project.handler.ts` OPEN handler (uses openProject)
3. Read `AppLayout.tsx` PROJECT_OPENED handler
4. Identify exact failure point

**Decision:** Use Option A (close and re-open).

**Checkpoint:**
```bash
# No code changes yet
echo "Analysis complete"
```

**Success Criteria:**
- [ ] Current flow understood
- [ ] Failure point identified
- [ ] Fix approach decided

---

## BLOQUE 1: Implement Fix

### Objective
Close and re-open database after migration.

**File:** `src/main/services/project/ProjectFileService.ts`

**Changes:**

**Location:** After line 141 (success message dialog)

**Add:**
```typescript
        // Show success message
        await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Project Upgraded',
          message: 'Project has been successfully upgraded to the current version.',
          detail: `Backup saved as:\n${path.basename(backupPath)}`,
          buttons: ['OK']
        });

        // NEW: Close and re-open the migrated database
        db.close();
        console.log(`[ProjectFileService] Closed database after migration`);

        db = new Database(filePath as string, { readonly: false });
        DatabaseConnection.configurePragmas(db); // Apply FK + WAL
        console.log(`[ProjectFileService] Re-opened migrated database`);
      } catch (error) {
        // ... existing error handling ...
```

**Checkpoint:**
```bash
npm run type-check
```

**Success Criteria:**
- [ ] Code compiles without errors
- [ ] No TypeScript errors
- [ ] Logic is sound

---

## BLOQUE FINAL: Testing & Validation

### Objective
Verify upgrade now opens project correctly.

**Test Case 1: Old Project File**

**Setup:**
```bash
# Reset DB
npm run db:reset

# Start app
npm start
```

**Steps:**
1. Create 2 plants:
   - Code: `US`, Name: `Detroit Plant`
   - Code: `CA`, Name: `Toronto Plant`
2. File > Save As → `test-upgrade.lop`
3. File > New Project → Don't Save
4. Verify empty catalog

**Manually corrupt metadata to simulate old file:**
```bash
# Open the .lop file with sqlite3
sqlite3 ~/Desktop/test-upgrade.lop

# Delete app_version to make it look old
DELETE FROM project_metadata WHERE key = 'app_version';

# Verify
SELECT * FROM project_metadata;

# Exit
.quit
```

**Execute Test:**
5. File > Open Project → `test-upgrade.lop`
6. **Verify:** Dialog appears: "This project needs upgrade"
7. Click **"Upgrade Project"**
8. **Verify:** Dialog: "Successfully upgraded"
9. Click **"OK"**
10. **Expected:** Project opens automatically
11. **Verify:** Catálogo shows 2 plants (US, CA) ✅
12. **Verify:** App is NOT in Untitled state ✅

**Test Case 2: Regression - Normal File**

**Steps:**
1. File > New Project → Don't Save
2. Create 1 plant: `MX`, `Silao Plant`
3. File > Save As → `test-normal.lop`
4. File > New Project → Don't Save
5. File > Open Project → `test-normal.lop`
6. **Verify:** NO upgrade dialog (file is current version)
7. **Verify:** Project opens immediately
8. **Verify:** Shows plant MX

**Success Criteria:**
- [ ] Test Case 1 passes (upgrade opens project)
- [ ] Test Case 2 passes (normal open still works)
- [ ] No regressions in save/open flow

---

## Acceptance Criteria

### Functional
- [x] Old project files trigger upgrade dialog
- [x] User can choose "Upgrade Project" or "Cancel"
- [x] Backup is created before migration
- [ ] After upgrade, project OPENS automatically ← FIX THIS
- [ ] Opened project shows correct data
- [x] Normal files open without upgrade dialog

### Non-Functional
- [ ] No performance degradation
- [ ] Error handling preserved
- [ ] Logs are informative

---

## Risk Assessment

**Risk Level:** LOW

**Why:**
- Small, localized change (3 lines)
- Only affects upgrade path (rare)
- Normal open/save flow unchanged
- Easy to test

**Rollback Plan:**
- Remove added lines 142-146
- Git revert if needed

---

## Testing Checklist

**Before Fix:**
- [x] Bug reproduced (upgrade doesn't open)
- [x] Root cause identified

**After Fix:**
- [ ] Upgrade opens project correctly
- [ ] Data appears in opened project
- [ ] Normal open still works
- [ ] Save As still works
- [ ] No console errors

---

## Implementation Notes

**Alternative considered:**
- Re-call `openProject()` recursively after migration
- Rejected: Overcomplicated, risk of infinite loop

**Why close + re-open:**
- Ensures DB is in clean state
- Migrations fully written to disk
- Pragmas (FK, WAL) applied correctly
- No stale in-memory state

---

**Estimated Time:** 1 hour (30 min implementation + 30 min testing)
**Priority:** HIGH (blocks Test 4-8)
**Blocking:** All "Open Project" tests with upgrade scenario

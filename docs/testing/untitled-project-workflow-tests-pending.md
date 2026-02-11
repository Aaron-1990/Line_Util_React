# Untitled Project Workflow - Tests Complete

> **Phase:** 8.1 - Untitled Project Workflow
> **Status:** ✅ ALL TESTS PASSED (8/8)
> **Last Updated:** 2026-02-10
> **Result:** READY FOR PRODUCTION

---

## Tests Completed ✅

### Test 1: Basic Untitled Project Creation
**Status:** ✅ PASSED
- App starts with "Untitled Project"
- No file path associated
- hasUnsavedChanges = false initially

### Test 2: Unsaved Changes Detection
**Status:** ✅ PASSED
- Create plant → hasUnsavedChanges = true
- File menu shows unsaved indicator
- Before-quit handler blocks quit

### Test 3: Save As from Untitled Project
**Status:** ✅ PASSED (Extended validation)
- Save As prompts for file location
- Creates .lop file with data
- File > New → Don't Save → returns to empty Untitled
- **Extended:** File > Open → loads saved file with data ✅

---

## Tests Completed ✅

### Test 4: "Don't Save" Before File > Open

**Status:** ✅ PASSED (2026-02-10)

**Scenario:** Untitled project with unsaved changes → File > Open → Don't Save

**Steps:**
1. Start with Untitled Project (empty)
2. Create 1 plant: `DISCARD` / `Plant to Discard`
3. Verify hasUnsavedChanges = true
4. File > Open Project
5. **Expected:** Dialog appears: "You have unsaved changes. Save before opening?"
   - Buttons: [Save] [Don't Save] [Cancel]
6. Click **"Don't Save"**
7. Select `test-controlled.lop` (has plant TEST)
8. Click Open

**Expected Results:**
- ✅ Dialog closes
- ✅ File `test-controlled.lop` opens successfully
- ✅ Plant TEST appears in catalog (not DISCARD)
- ✅ Plant DISCARD is discarded (not saved)
- ✅ projectType = 'saved'
- ✅ hasUnsavedChanges = false
- ✅ Window shows project name

**Validation Commands:**
```bash
# Verify global DB is empty (DISCARD plant not saved)
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db "SELECT * FROM plants;"
# Expected: empty or only plants from previous tests

# Verify test-controlled.lop still has TEST plant
sqlite3 ~/Desktop/test-controlled.lop "SELECT code, name FROM plants;"
# Expected: TEST|Test Plant
```

---

### Test 5: "Cancel" in Save Dialog Before File > Open

**Status:** ✅ PASSED (2026-02-10)

**Scenario:** Untitled project with unsaved changes → File > Open → Save → Cancel save dialog

**Steps:**
1. Start with Untitled Project (empty)
2. Create 1 plant: `KEEP` / `Plant to Keep`
3. Verify hasUnsavedChanges = true
4. File > Open Project
5. **Expected:** Dialog: "Save changes?"
6. Click **"Save"**
7. **Expected:** Save dialog appears
8. Click **"Cancel"** in save dialog (don't save file)

**Expected Results:**
- ✅ Save dialog closes
- ✅ File > Open dialog also closes
- ✅ **Stays in current Untitled Project**
- ✅ Plant KEEP still exists in catalog
- ✅ hasUnsavedChanges = true (still unsaved)
- ✅ projectType = 'untitled'
- ✅ No file opened

**Purpose:** User cancels save → should abort File > Open operation

---

### Test 6: Save As with Unsaved Changes Before File > New

**Status:** ✅ PASSED (2026-02-10) + UX IMPROVEMENTS

**Scenario:** Untitled project with unsaved changes → File > New → Save

**Steps:**
1. Start with Untitled Project (empty)
2. Create 1 plant: `SAVE1` / `Plant Save 1`
3. Verify hasUnsavedChanges = true
4. File > New Project
5. **Expected:** Dialog: "Save changes before creating new project?"
6. Click **"Save"**
7. **Expected:** Save As dialog appears
8. Save as `test-save-before-new.lop` on Desktop
9. Click Save

**Expected Results:**
- ✅ File created: `test-save-before-new.lop`
- ✅ New empty Untitled Project created
- ✅ Catalog is empty (no plants)
- ✅ projectType = 'untitled'
- ✅ hasUnsavedChanges = false

**Validation:**
```bash
# Verify saved file has SAVE1 plant
sqlite3 ~/Desktop/test-save-before-new.lop "SELECT code, name FROM plants;"
# Expected: SAVE1|Plant Save 1

# Verify global DB is empty (new project)
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db "SELECT * FROM plants;"
# Expected: empty
```

---

### Test 7: "Don't Save" Before File > New

**Status:** ✅ PASSED (2026-02-10)

**Scenario:** Untitled project with unsaved changes → File > New → Don't Save

**Steps:**
1. Start with Untitled Project (empty)
2. Create 1 plant: `DISCARD2` / `Plant Discard 2`
3. Verify hasUnsavedChanges = true
4. File > New Project
5. **Expected:** Dialog: "Save changes?"
6. Click **"Don't Save"**

**Expected Results:**
- ✅ Dialog closes
- ✅ New empty Untitled Project created
- ✅ Catalog is empty (no plants)
- ✅ Plant DISCARD2 was discarded (not saved)
- ✅ projectType = 'untitled'
- ✅ hasUnsavedChanges = false

**Validation:**
```bash
# Verify global DB is empty
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db "SELECT * FROM plants;"
# Expected: empty
```

---

### Test 8: Save Successfully Before File > New (Saved Project)

**Status:** ✅ PASSED (2026-02-10)

**Scenario:** **Saved project** with unsaved changes → File > New → Save

**Setup:**
1. File > Open Project → `test-controlled.lop` (has plant TEST)
2. Edit plant TEST → change name to "Test Plant Modified"
3. Verify hasUnsavedChanges = true
4. Verify projectType = 'saved'

**Steps:**
5. File > New Project
6. **Expected:** Dialog: "Save changes to test-controlled?"
7. Click **"Save"** (NOT Save As - direct save to current file)

**Expected Results:**
- ✅ Changes saved to `test-controlled.lop` (no save dialog, direct save)
- ✅ New empty Untitled Project created
- ✅ Catalog is empty
- ✅ projectType = 'untitled'
- ✅ hasUnsavedChanges = false

**Validation:**
```bash
# Verify test-controlled.lop has modified plant name
sqlite3 ~/Desktop/test-controlled.lop "SELECT code, name FROM plants;"
# Expected: TEST|Test Plant Modified

# Verify global DB is empty (new project)
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db "SELECT * FROM plants;"
# Expected: empty

# Open test-controlled.lop again to verify
# Should see "Test Plant Modified" in catalog
```

---

## Test Matrix

| Test | Scenario | Action | Expected Outcome | Status |
|------|----------|--------|-----------------|--------|
| 1 | App Start | - | Shows Untitled Project | ✅ PASSED |
| 2 | Create Data | Add plant | hasUnsavedChanges = true | ✅ PASSED |
| 3 | Untitled → Save As | Save | Creates .lop file | ✅ PASSED |
| 3-Ext | Open Saved File | File > Open | Loads data from .lop | ✅ PASSED |
| 4 | Untitled → Open (Don't Save) | File > Open → Don't Save | Opens file, discards changes | ✅ PASSED |
| 5 | Untitled → Open (Cancel) | File > Open → Save → Cancel | Stays in current project | ✅ PASSED |
| 6 | Untitled → New (Save As) | File > New → Save As | Prompts Save As, creates new | ✅ PASSED |
| 6+ | Saved → New (4 buttons) | File > New | [Save] [Save As] [Don't Save] [Cancel] | ✅ PASSED + UX |
| 7 | Untitled → New (Don't Save) | File > New → Don't Save | Discards changes, creates new | ✅ PASSED |
| 8 | Saved → New (Save) | File > New → Save | Direct save, creates new | ✅ PASSED |

---

## Prerequisites for Testing

### Test Files Required
- ✅ `test-controlled.lop` - Has plant TEST (created in Test 3-Ext)
- ⏳ `test-save-before-new.lop` - Will be created in Test 6

### App State Between Tests
- Reset to Untitled Project: File > New Project → Don't Save
- Verify empty catalog before each test
- Check hasUnsavedChanges = false before starting

### Validation Tools
```bash
# Check global DB (Untitled Project database)
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db "SELECT * FROM plants;"

# Check .lop file
sqlite3 ~/Desktop/[filename].lop "SELECT * FROM plants;"
```

---

## Known Issues

### ✅ Fixed (2026-02-09)
- production-lines.handler.ts stale instance references
- Duplicate PROJECT_OPENED event listeners
- window.location.reload() issues in Electron

### ⚠️ Remaining (Low Priority)
- 8 other handlers need getInstance() pattern fix (see Phase 8.0 spec)
- Only affects specific features when opening .lop files
- Does not block Tests 4-8

---

## Success Criteria

All tests 4-8 must pass with:
- ✅ Correct dialog prompts appear
- ✅ User choices respected (Save/Don't Save/Cancel)
- ✅ Data saved/discarded correctly
- ✅ Project state transitions correctly
- ✅ No errors in terminal
- ✅ UI updates reflect correct state

---

**Next Test:** Test 4 - "Don't Save" before File > Open
**Estimated Time:** 30 minutes (all 5 tests)
**Blocked By:** None - ready to proceed

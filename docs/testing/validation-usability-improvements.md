# Validation Checklist: Usability Improvements 1 & 2

> **Date:** 2026-02-11
> **Changes:** Dark Mode + Canvas Placement + Manual Fixes
> **Risk Level:** Medium (orchestrator changes + manual fixes)

---

## Files Modified Summary

### Spec 1: Dark Mode (Low Risk - Only Styling)
- ✅ MultiSheetImportWizard.tsx (styling only)
- ✅ FileSelector.tsx (styling only)
- ✅ SheetSelector.tsx (styling only)
- ✅ MultiSheetValidationDisplay.tsx (styling only)
- ✅ MultiSheetProgressTracker.tsx (styling only)

**Risk:** Low - Only added Tailwind `dark:` variants, no logic changes

### Spec 2: Canvas Placement (Medium Risk - Logic Changes)
- ⚠️ ProductionCanvas.tsx (empty state logic modified)
- ⚠️ CanvasEmptyState.tsx (button behavior changed)
- ⚠️ CanvasToolbar.tsx (removed modal references)
- ⚠️ AddLineModal.tsx (DELETED)
- ✅ Created shape constants

**Risk:** Medium - Logic changes, deleted component

### Manual Fixes (Medium Risk)
- ⚠️ Database: Inserted shapes manually
- ⚠️ ProductionCanvas.tsx (empty state restored after initial removal)

---

## Critical Workflows to Test

### ✅ Test 1: App Startup
**Steps:**
1. Close app completely
2. `npm start`
3. Wait for app to load

**Expected:**
- ✅ App starts without errors
- ✅ Empty state shows with 2 buttons
- ✅ No console errors in terminal

**Status:** [ ] PENDING

---

### ✅ Test 2: Empty State Buttons
**Steps:**
1. From empty state, click "Import from Excel"
2. Verify import wizard opens
3. Go back to canvas
4. From empty state, click "Add Line Manually"
5. Verify canvas appears with tools

**Expected:**
- ✅ "Import from Excel" navigates to /excel/import
- ✅ "Add Line Manually" dismisses empty state
- ✅ Canvas shows with ObjectPalette visible
- ✅ No errors

**Status:** [ ] PENDING

---

### ✅ Test 3: Dark Mode in Import Wizard
**Steps:**
1. Toggle theme to Dark (theme selector)
2. Navigate to File > Import Excel Data
3. Go through all wizard steps:
   - File selection
   - Sheet selection
   - Validation display
   - Progress tracker

**Expected:**
- ✅ All backgrounds visible (not bright white)
- ✅ All text readable (good contrast)
- ✅ Borders visible
- ✅ Hover states work
- ✅ Selected states visible

**Status:** [ ] PENDING

---

### ✅ Test 4: Import Excel Workflow (Functionality)
**Steps:**
1. Prepare test Excel file with:
   - Plants sheet
   - Lines sheet
   - Models sheet
   - Volumes sheet
2. File > Import Excel Data
3. Select file
4. Select sheets
5. Review validation
6. Import

**Expected:**
- ✅ File picker works
- ✅ Sheet detection works
- ✅ Validation runs correctly
- ✅ Import completes successfully
- ✅ Data appears in catalogs
- ✅ No console errors

**Status:** [ ] PENDING

---

### ✅ Test 5: Canvas Object Placement (New Workflow)
**Steps:**
1. Start with empty canvas (or click "Add Line Manually")
2. Click a shape in ObjectPalette (rectangle, circle, etc.)
3. Click on canvas
4. Verify object appears
5. Click another shape
6. Place another object

**Expected:**
- ✅ Shape selection works
- ✅ Cursor changes to placement mode
- ✅ Ghost preview follows cursor (if implemented)
- ✅ Click creates object at correct position
- ✅ Object appears on canvas
- ✅ Properties panel opens
- ✅ Can edit object name/properties
- ✅ Tool returns to select mode after placement

**Status:** [ ] PENDING

---

### ✅ Test 6: Existing Canvas Features (Regression Test)
**Steps:**
1. Create 2-3 objects on canvas
2. Test each feature:
   - Select object (click)
   - Move object (drag)
   - Delete object (context menu or delete key)
   - Edit properties (properties panel)
   - Connect objects (if connections implemented)
   - Zoom in/out
   - Pan canvas

**Expected:**
- ✅ All existing features still work
- ✅ No regressions
- ✅ Properties panel works
- ✅ Context menu works

**Status:** [ ] PENDING

---

### ✅ Test 7: Old "Add Line" Buttons (If Any Exist)
**Steps:**
1. Check if there are other "Add Line" buttons in:
   - CanvasToolbar (top toolbar)
   - Context menus
   - Other locations
2. Test each one

**Expected:**
- ✅ Toolbar buttons work (if they exist)
- ✅ No references to deleted AddLineModal
- ✅ No console errors about missing components

**Status:** [ ] PENDING

---

### ✅ Test 8: Project File Operations (Critical)
**Steps:**
1. Create test project with data
2. Save As → test-validation.lop
3. Close app
4. Open app
5. File > Open → test-validation.lop
6. Verify all data loaded correctly

**Expected:**
- ✅ Save works
- ✅ Open works
- ✅ Data persists correctly
- ✅ No "database connection is not open" errors

**Status:** [ ] PENDING

---

### ✅ Test 9: Multi-Plant Support (If Applicable)
**Steps:**
1. Create 2 plants
2. Add objects to plant 1
3. Switch to plant 2
4. Add objects to plant 2
5. Switch back to plant 1
6. Verify objects are plant-scoped correctly

**Expected:**
- ✅ Objects appear in correct plant
- ✅ Plant switching works
- ✅ No data leakage between plants

**Status:** [ ] PENDING

---

### ✅ Test 10: Shape Catalog (Database Fix)
**Steps:**
1. Navigate to canvas
2. Check if ObjectPalette shows shapes
3. Verify 4 basic shapes exist:
   - Rectangle
   - Circle
   - Triangle
   - Diamond

**Expected:**
- ✅ Shapes visible in ObjectPalette
- ✅ Can select and place each shape
- ✅ No errors about missing shapes

**Status:** [ ] PENDING

---

## Quick Smoke Test (5 minutes)

If you're short on time, run these critical tests first:

1. **App Startup** ✅
2. **Empty State → Canvas** ✅
3. **Place One Object** ✅
4. **Import Excel** ✅
5. **Dark Mode Toggle** ✅

---

## Known Issues Before Changes

From Phase 8.2, these issues were already known:
- ⚠️ 3 catalog UI issues (pending for next session)
- ⚠️ Plant-line relationship undefined (Issue #3)

**These are NOT regressions from today's changes.**

---

## Rollback Plan (If Needed)

If major issues found:

```bash
# See recent commits
git log --oneline -5

# Rollback to before usability changes
git revert 233165a  # Fix empty state
git revert df91f96  # Remove empty state
git revert e493c21  # Canvas placement
git revert 8aa5a9a  # Dark mode
```

Or reset to before changes:
```bash
git reset --hard e92b7d5  # Before usability improvements
```

---

## Post-Validation Actions

If all tests pass:
- [ ] Mark this validation doc as ✅ PASSED
- [ ] Continue with Issue #3 (Plant-line relationship)
- [ ] Archive this validation for future reference

If issues found:
- [ ] Document issues in detail
- [ ] Determine if rollback needed
- [ ] Create fix plan
- [ ] Re-test after fixes

---

## Notes for Tester

- Test in both **Light** and **Dark** modes
- Check **terminal output** for errors/warnings
- Use **different plants** if multi-plant is enabled
- Try **edge cases** (no data, lots of data, etc.)
- Report **any unexpected behavior** even if minor

---

**Tester:** [Your Name]
**Date Tested:** [Date]
**Result:** [ ] PASSED / [ ] FAILED
**Issues Found:** [List any issues]

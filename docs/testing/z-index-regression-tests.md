# Z-Index Regression Tests

**Change:** Modified `duplicate()` to use `MAX(z_index) + 1` instead of `source.zIndex + 1`

**Date:** 2026-02-14

**Commit:** cc0f816

---

## Test 1: Simple Duplicate (Ctrl+D)

**Objetivo:** Verificar que objeto duplicado aparece ENCIMA del padre

**Pasos:**
1. Delete DB: `rm ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db`
2. Start app: `npm start`
3. Create "Object A" on canvas
4. Select "Object A"
5. Press Ctrl+D

**Expected:**
- ✅ "Object A_copy" appears VISUALLY on top of "Object A"
- ✅ No console errors

**DB Validation:**
```sql
-- Should show:
-- Object A: z_index = 0
-- Object A_copy: z_index = 1
SELECT name, z_index FROM canvas_objects ORDER BY z_index;
```

---

## Test 2: Multiple Sequential Duplicates

**Objetivo:** Verificar que z-index incrementa correctamente en múltiples duplicados

**Pasos:**
1. Create "Line 1"
2. Press Ctrl+D (creates "Line 1_copy")
3. Select "Line 1" again
4. Press Ctrl+D (creates "Line 1_copy2")
5. Select "Line 1_copy"
6. Press Ctrl+D (creates "Line 1_copy_copy")

**Expected:**
- ✅ Visual stacking order (bottom to top): Line 1 → Line 1_copy → Line 1_copy2 → Line 1_copy_copy
- ✅ Each duplicate on top of all previous objects

**DB Validation:**
```sql
-- Should show incrementing z_index:
-- Line 1: z_index = 0
-- Line 1_copy: z_index = 1
-- Line 1_copy2: z_index = 2
-- Line 1_copy_copy: z_index = 3
SELECT name, z_index FROM canvas_objects ORDER BY z_index;
```

---

## Test 3: Copy/Paste Multiple Times (Ctrl+C → Ctrl+V)

**Objetivo:** Verificar que paste mode también respeta MAX(z_index) + 1

**Pasos:**
1. Create "Assembly Line"
2. Select it
3. Press Ctrl+C (copy)
4. Press Ctrl+V (activate paste mode)
5. Click on canvas (paste #1)
6. Click on canvas again (paste #2)
7. Click on canvas again (paste #3)
8. Press ESC (exit paste mode)

**Expected:**
- ✅ 3 pasted objects created
- ✅ Each paste appears on top of all previous objects
- ✅ Visual stacking order: Assembly Line → paste #1 → paste #2 → paste #3

**DB Validation:**
```sql
-- Should show:
-- Assembly Line: z_index = 0
-- Assembly Line_copy: z_index = 1
-- Assembly Line_copy2: z_index = 2
-- Assembly Line_copy3: z_index = 3
SELECT name, z_index FROM canvas_objects ORDER BY z_index;
```

---

## Test 4: Right-Click Context Menu Duplicate

**Objetivo:** Verificar que context menu duplicate también funciona correctamente

**Pasos:**
1. Create "Test Object"
2. Right-click on "Test Object"
3. Click "Duplicate"
4. Right-click on "Test Object_copy"
5. Click "Duplicate"

**Expected:**
- ✅ "Test Object_copy" appears on top of "Test Object"
- ✅ "Test Object_copy_copy" appears on top of "Test Object_copy"

**DB Validation:**
```sql
SELECT name, z_index FROM canvas_objects ORDER BY z_index;
-- Test Object: 0
-- Test Object_copy: 1
-- Test Object_copy_copy: 2
```

---

## Test 5: Mix Create + Duplicate

**Objetivo:** Verificar que objetos creados manualmente (z_index=0) no rompen el sistema de duplicado

**Pasos:**
1. Create "Object A" (z_index=0)
2. Create "Object B" (z_index=0)
3. Create "Object C" (z_index=0)
4. Select "Object B"
5. Press Ctrl+D (duplicate "Object B")

**Expected:**
- ✅ "Object B_copy" has z_index = 1 (MAX of [0,0,0] + 1)
- ✅ "Object B_copy" appears on top of ALL objects (A, B, C)

**DB Validation:**
```sql
SELECT name, z_index FROM canvas_objects ORDER BY z_index, name;
-- Object A: 0
-- Object B: 0
-- Object C: 0
-- Object B_copy: 1
```

---

## Test 6: Save/Load Project with Z-Index

**Objetivo:** Verificar que z-index se persiste correctamente en archivos .lop

**Pasos:**
1. Create "Line 1"
2. Duplicate to create "Line 1_copy" (z_index=1)
3. Duplicate again to create "Line 1_copy2" (z_index=2)
4. Save project as "test-z-index.lop"
5. Close app
6. Restart app
7. Open "test-z-index.lop"

**Expected:**
- ✅ All 3 objects load correctly
- ✅ Visual stacking order preserved: Line 1 → Line 1_copy → Line 1_copy2
- ✅ z_index values preserved in database

**DB Validation:**
```sql
SELECT name, z_index FROM canvas_objects ORDER BY z_index;
-- Line 1: 0
-- Line 1_copy: 1
-- Line 1_copy2: 2
```

---

## Test 7: Edge Case - High Z-Index Value

**Objetivo:** Verificar que MAX(z_index) funciona correctamente con valores altos

**Setup:**
```sql
-- Manually set high z-index in DB
UPDATE canvas_objects SET z_index = 999 WHERE name = 'Object A';
```

**Pasos:**
1. Restart app to load object with z_index=999
2. Create new "Object B" (z_index=0)
3. Duplicate "Object B"

**Expected:**
- ✅ "Object B_copy" has z_index = 1000 (MAX of [999, 0] + 1)
- ✅ "Object B_copy" appears on top of BOTH objects

**DB Validation:**
```sql
SELECT name, z_index FROM canvas_objects ORDER BY z_index;
-- Object B: 0
-- Object A: 999
-- Object B_copy: 1000
```

---

## Test 8: Concurrent Duplicates (Edge Case)

**Objetivo:** Verificar comportamiento si múltiples duplicates ocurren "simultáneamente"

**Pasos:**
1. Create "Line X"
2. Quickly: Select → Ctrl+D → Ctrl+D → Ctrl+D (rapid duplicates)

**Expected:**
- ✅ 3 duplicates created
- ✅ Each has unique z_index (no collisions)
- ✅ All appear in correct stacking order

**Note:** MAX(z_index) query executes CADA VEZ, previniendo race conditions

---

## Integration Test: Excel Import + Duplicate

**Objetivo:** Verificar que objetos importados desde Excel se pueden duplicar correctamente

**Pasos:**
1. Import Excel with 5 lines
2. Verify all imported lines have z_index = 0
3. Select any imported line
4. Press Ctrl+D

**Expected:**
- ✅ Duplicate has z_index = 1
- ✅ Duplicate appears on top of all imported lines
- ✅ All properties copied correctly (Area, CT, models)

---

## Success Criteria

All tests MUST pass with:
- ✅ No console errors
- ✅ Correct visual stacking order
- ✅ Correct z_index values in database
- ✅ No duplicate z_index values (unless both are 0 from create())
- ✅ Duplicates ALWAYS appear on top of ALL existing objects

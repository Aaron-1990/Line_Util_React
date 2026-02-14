# Area Catalog Regression Tests

**Bug Fixed:** Custom areas persisting after "Don't Save" in Untitled Project workflow

**Root Cause:** `area_catalog` table was excluded from `clearTempDatabase()` to preserve seed data, but user-created custom areas are stored in the same table

**Fix:** Added `area_catalog` to `tablesToClear` array. Default areas are automatically re-seeded on next app open via migration 001 (`INSERT OR IGNORE`)

**Date:** 2026-02-14

**Commit:** (pending)

---

## Test 1: Custom Areas Cleared on "Don't Save" ⭐ CRITICAL

**Objetivo:** Verificar que custom areas creadas por el usuario se eliminan cuando elige "Don't Save"

**Pasos:**
1. Delete DB to start fresh:
   ```bash
   rm ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db
   ```

2. Start app:
   ```bash
   npm start
   ```

3. Verify default areas exist:
   - Navigate to Settings → Areas (or wherever areas are managed)
   - ✅ Should see default areas: ICT, SMT, WAVE, ASSEMBLY, TEST

4. Create custom areas:
   - Create area: "WS" (Wave Solder)
   - Create area: "CUSTOM1"
   - Create area: "CUSTOM2"

5. Close app (trigger "Don't Save"):
   - Press Cmd+Q (Mac) or close terminal with Ctrl+C
   - ✅ Dialog should appear: "Save / Don't Save / Cancel"

6. Click "Don't Save"
   - ✅ Console should show: `[Main] User chose Don't Save - clearing temp database`

7. Restart app:
   ```bash
   npm start
   ```

8. Verify custom areas removed:
   - Navigate to Settings → Areas
   - ✅ Should ONLY see default areas: ICT, SMT, WAVE, ASSEMBLY, TEST
   - ❌ Custom areas (WS, CUSTOM1, CUSTOM2) should be GONE

**DB Validation:**
```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db "SELECT code, name FROM area_catalog WHERE active = 1 ORDER BY code;"
```

**Expected Output:**
```
area-assembly|ASSEMBLY
area-ict|ICT
area-smt|SMT
area-test|TEST
area-wave|WAVE
```

**NO custom areas should appear.**

---

## Test 2: Default Areas Re-Seeded After Clear

**Objetivo:** Verificar que default areas se restauran automáticamente después de limpiar la base de datos

**Pasos:**
1. Delete DB:
   ```bash
   rm ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db
   ```

2. Start app (first time - runs migrations):
   ```bash
   npm start
   ```

3. Verify default areas exist:
   ```bash
   sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db "SELECT COUNT(*) FROM area_catalog WHERE active = 1;"
   ```
   - ✅ Expected: `5` (default areas)

4. Create custom area:
   - Create "TESTING_AREA"

5. Close app and click "Don't Save"

6. Restart app

7. Verify:
   - ✅ Default 5 areas exist
   - ✅ Custom "TESTING_AREA" is gone

**DB Validation:**
```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db "SELECT code, name FROM area_catalog WHERE active = 1 ORDER BY name;"
```

**Expected:**
```
area-assembly|ASSEMBLY
area-ict|ICT
area-smt|SMT
area-test|TEST
area-wave|WAVE
```

---

## Test 3: Save Project Preserves Custom Areas

**Objetivo:** Verificar que custom areas SÍ se guardan cuando usuario elige "Save"

**Pasos:**
1. Delete DB to start fresh
2. Start app
3. Create custom areas: "WS", "CUSTOM1"
4. Save project as "test-areas.lop"
5. Close app (no dialog should appear - project saved)
6. Restart app
7. Open "test-areas.lop"

**Expected:**
- ✅ Default areas: ICT, SMT, WAVE, ASSEMBLY, TEST
- ✅ Custom areas: WS, CUSTOM1
- ✅ Total: 7 areas

**DB Validation:**
```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db "SELECT COUNT(*) FROM area_catalog WHERE active = 1;"
```

**Expected:** `7`

---

## Test 4: Mix Default and Custom Areas

**Objetivo:** Verificar que solo custom areas se eliminan, default areas se re-seed

**Pasos:**
1. Delete DB
2. Start app (default 5 areas loaded)
3. Create 3 custom areas: "A1", "A2", "A3"
4. Close app → "Don't Save"
5. Restart app

**Expected:**
- ✅ Default areas restored: 5
- ✅ Custom areas removed: 0

**DB Validation:**
```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db "SELECT code, name FROM area_catalog WHERE active = 1 ORDER BY code;"
```

**Expected (5 rows):**
```
area-assembly|ASSEMBLY
area-ict|ICT
area-smt|SMT
area-test|TEST
area-wave|WAVE
```

---

## Test 5: Edit Default Area Then Don't Save

**Objetivo:** Verificar que ediciones a default areas se revierten

**Pasos:**
1. Delete DB
2. Start app
3. Edit default area "ICT" → Change name to "ICT MODIFIED"
4. Close app → "Don't Save"
5. Restart app

**Expected:**
- ✅ "ICT" name reverted to original "ICT"
- ✅ All default areas have original values

**DB Validation:**
```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db "SELECT code, name FROM area_catalog WHERE code = 'area-ict';"
```

**Expected:**
```
area-ict|ICT
```

**NOT:** `area-ict|ICT MODIFIED`

---

## Test 6: Delete Default Area Then Don't Save

**Objetivo:** Verificar que eliminación de default areas se revierte

**Pasos:**
1. Delete DB
2. Start app (5 default areas)
3. Delete area "SMT"
4. Close app → "Don't Save"
5. Restart app

**Expected:**
- ✅ "SMT" area restored
- ✅ All 5 default areas present

**DB Validation:**
```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db "SELECT COUNT(*) FROM area_catalog WHERE code = 'area-smt' AND active = 1;"
```

**Expected:** `1`

---

## Test 7: Rapid Create/Delete Then Don't Save

**Objetivo:** Verificar comportamiento con múltiples operaciones

**Pasos:**
1. Delete DB
2. Start app
3. Create "A1"
4. Delete "A1"
5. Create "A2"
6. Edit "A2" → Change name to "A2 MODIFIED"
7. Create "A3"
8. Delete default area "TEST"
9. Close app → "Don't Save"
10. Restart app

**Expected:**
- ✅ ALL custom areas gone (A1, A2, A3)
- ✅ ALL default areas present (including TEST)
- ✅ NO modifications persisted

**DB Validation:**
```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db "SELECT COUNT(*) FROM area_catalog WHERE active = 1;"
```

**Expected:** `5` (only defaults)

---

## Integration Test: Areas Used in Objects

**Objetivo:** Verificar que áreas usadas en canvas objects se manejan correctamente

**Pasos:**
1. Delete DB
2. Start app
3. Create custom area "WS"
4. Create canvas object with area = "WS"
5. Close app → "Don't Save"
6. Restart app

**Expected:**
- ✅ Custom area "WS" is gone
- ✅ Canvas object is gone (entire database cleared)
- ✅ No orphaned references
- ✅ Default areas available for use

---

## SQL Validation Script

```bash
# Run after tests to verify area_catalog state
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db << 'EOF'
.mode column
.headers on

SELECT '=== Area Catalog State ===' as status;

SELECT
  code,
  name,
  color,
  active,
  created_at
FROM area_catalog
ORDER BY code;

SELECT '=== Summary ===' as status;

SELECT
  COUNT(*) as total_areas,
  COUNT(CASE WHEN active = 1 THEN 1 END) as active_areas,
  COUNT(CASE WHEN code LIKE 'area-%' THEN 1 END) as default_areas,
  COUNT(CASE WHEN code NOT LIKE 'area-%' THEN 1 END) as custom_areas
FROM area_catalog;

EOF
```

---

## Success Criteria

All tests MUST pass with:
- ✅ Custom areas cleared on "Don't Save"
- ✅ Default areas re-seeded automatically
- ✅ Saved projects preserve custom areas
- ✅ No orphaned references
- ✅ No console errors
- ✅ clearTempDatabase() runs without errors

---

## Rollback Plan

If tests fail, revert commit:
```bash
git revert HEAD
```

And investigate:
- Migration 001 seed data
- INSERT OR IGNORE behavior
- Foreign key constraints

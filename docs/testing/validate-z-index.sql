-- ============================================
-- Z-INDEX VALIDATION SCRIPT
-- Run after regression tests to verify z-index integrity
-- ============================================

-- Usage:
-- sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db < docs/testing/validate-z-index.sql

.mode column
.headers on

-- ============================================
-- Test 1: Check all z-index values
-- ============================================
.print "============================================"
.print "Test 1: All Objects with Z-Index"
.print "Expected: Incrementing z_index for duplicates"
.print "============================================"

SELECT
  name,
  z_index,
  object_type,
  x_position,
  y_position,
  created_at
FROM canvas_objects
WHERE active = 1
ORDER BY z_index, name;

.print ""

-- ============================================
-- Test 2: Detect z-index gaps
-- ============================================
.print "============================================"
.print "Test 2: Z-Index Gaps Detection"
.print "Expected: Some gaps are OK (created objects have z_index=0)"
.print "============================================"

WITH RECURSIVE z_range AS (
  SELECT MIN(z_index) as z FROM canvas_objects WHERE active = 1
  UNION ALL
  SELECT z + 1 FROM z_range WHERE z < (SELECT MAX(z_index) FROM canvas_objects WHERE active = 1)
)
SELECT
  z_range.z as missing_z_index
FROM z_range
LEFT JOIN canvas_objects ON canvas_objects.z_index = z_range.z AND canvas_objects.active = 1
WHERE canvas_objects.id IS NULL
ORDER BY z_range.z;

.print ""

-- ============================================
-- Test 3: Duplicate naming pattern validation
-- ============================================
.print "============================================"
.print "Test 3: Objects with '_copy' in name"
.print "Expected: All should have z_index > 0"
.print "============================================"

SELECT
  name,
  z_index,
  CASE
    WHEN z_index > 0 THEN 'PASS'
    ELSE 'FAIL - Should have z_index > 0'
  END as validation
FROM canvas_objects
WHERE active = 1 AND name LIKE '%_copy%'
ORDER BY name;

.print ""

-- ============================================
-- Test 4: Max z-index per plant
-- ============================================
.print "============================================"
.print "Test 4: Max Z-Index per Plant"
.print "Expected: Should match number of duplicates"
.print "============================================"

SELECT
  plant_id,
  MAX(z_index) as max_z_index,
  COUNT(*) as total_objects,
  COUNT(CASE WHEN name LIKE '%_copy%' THEN 1 END) as duplicates
FROM canvas_objects
WHERE active = 1
GROUP BY plant_id;

.print ""

-- ============================================
-- Test 5: Z-Index consistency check
-- ============================================
.print "============================================"
.print "Test 5: Z-Index Consistency"
.print "Expected: No duplicate z_index unless both are 0"
.print "============================================"

SELECT
  z_index,
  COUNT(*) as count,
  GROUP_CONCAT(name, ', ') as objects_with_same_z,
  CASE
    WHEN z_index = 0 THEN 'OK - Created objects can share z_index=0'
    WHEN COUNT(*) > 1 THEN 'WARNING - Duplicate z_index (should not happen with MAX+1)'
    ELSE 'PASS'
  END as validation
FROM canvas_objects
WHERE active = 1
GROUP BY z_index
HAVING COUNT(*) > 1
ORDER BY z_index;

.print ""

-- ============================================
-- Test 6: Verify duplicate stacking order
-- ============================================
.print "============================================"
.print "Test 6: Duplicate Stacking Order"
.print "Expected: _copy should have higher z_index than parent"
.print "============================================"

WITH duplicates AS (
  SELECT
    id,
    name,
    z_index,
    -- Extract parent name (remove _copy suffix)
    CASE
      WHEN name LIKE '%_copy2' THEN REPLACE(name, '_copy2', '')
      WHEN name LIKE '%_copy' THEN REPLACE(name, '_copy', '')
      ELSE NULL
    END as parent_name
  FROM canvas_objects
  WHERE active = 1 AND name LIKE '%_copy%'
)
SELECT
  d.name as duplicate_name,
  d.z_index as duplicate_z_index,
  p.name as parent_name,
  p.z_index as parent_z_index,
  CASE
    WHEN d.z_index > p.z_index THEN 'PASS'
    ELSE 'FAIL - Duplicate should have higher z_index'
  END as validation
FROM duplicates d
LEFT JOIN canvas_objects p ON p.name = d.parent_name AND p.active = 1
WHERE p.id IS NOT NULL
ORDER BY d.name;

.print ""

-- ============================================
-- Summary
-- ============================================
.print "============================================"
.print "SUMMARY"
.print "============================================"

SELECT
  'Total Objects' as metric,
  COUNT(*) as value
FROM canvas_objects WHERE active = 1
UNION ALL
SELECT
  'Objects with z_index = 0',
  COUNT(*)
FROM canvas_objects WHERE active = 1 AND z_index = 0
UNION ALL
SELECT
  'Objects with z_index > 0',
  COUNT(*)
FROM canvas_objects WHERE active = 1 AND z_index > 0
UNION ALL
SELECT
  'Max Z-Index',
  MAX(z_index)
FROM canvas_objects WHERE active = 1
UNION ALL
SELECT
  'Duplicates (_copy in name)',
  COUNT(*)
FROM canvas_objects WHERE active = 1 AND name LIKE '%_copy%';

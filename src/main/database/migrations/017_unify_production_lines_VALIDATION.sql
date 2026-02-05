-- ============================================
-- VALIDATION QUERIES: Migration 017 - Unify Production Lines
-- Run these queries AFTER migration to verify data integrity
-- ============================================

-- ============================================
-- 1. RECORD COUNT VALIDATION
-- Compare before/after counts from validation table
-- ============================================

-- Show migration validation summary
SELECT
  check_name,
  value_before,
  value_after,
  CASE
    WHEN check_name = 'production_lines_total' THEN
      CASE WHEN value_after >= value_before THEN 'PASS' ELSE 'FAIL - Lost records' END
    WHEN check_name = 'production_lines_active' THEN
      CASE WHEN value_after >= value_before THEN 'PASS' ELSE 'FAIL - Lost active records' END
    WHEN check_name = 'line_model_compatibilities' THEN
      CASE WHEN value_after >= value_before THEN 'PASS' ELSE 'FAIL - Lost compatibilities' END
    ELSE 'INFO'
  END as status,
  validated_at
FROM _migration_017_validation
ORDER BY check_name;

-- ============================================
-- 2. DATA INTEGRITY CHECKS
-- ============================================

-- Check: All production_lines have corresponding canvas_objects
SELECT
  'Migrated lines check' as check_name,
  (SELECT COUNT(*) FROM _archived_production_lines) as original_count,
  (SELECT COUNT(*) FROM canvas_objects WHERE object_type = 'process') as migrated_count,
  CASE
    WHEN (SELECT COUNT(*) FROM canvas_objects WHERE object_type = 'process') >=
         (SELECT COUNT(*) FROM _archived_production_lines)
    THEN 'PASS'
    ELSE 'FAIL'
  END as status;

-- Check: All compatibilities have been migrated
SELECT
  'Migrated compatibilities check' as check_name,
  (SELECT COUNT(*) FROM _archived_line_model_compatibilities) as original_count,
  (SELECT COUNT(*) FROM canvas_object_compatibilities) as migrated_count,
  CASE
    WHEN (SELECT COUNT(*) FROM canvas_object_compatibilities) >=
         (SELECT COUNT(*) FROM _archived_line_model_compatibilities)
    THEN 'PASS'
    ELSE 'FAIL'
  END as status;

-- Check: All process canvas_objects have process_properties
SELECT
  'Process properties completeness' as check_name,
  (SELECT COUNT(*) FROM canvas_objects WHERE object_type = 'process') as process_objects,
  (SELECT COUNT(*) FROM process_properties) as properties_count,
  CASE
    WHEN (SELECT COUNT(*) FROM canvas_objects WHERE object_type = 'process') =
         (SELECT COUNT(*) FROM process_properties)
    THEN 'PASS'
    ELSE 'FAIL - Missing properties'
  END as status;

-- Check: ID mapping completeness
SELECT
  'ID mapping completeness' as check_name,
  (SELECT COUNT(*) FROM _archived_production_lines) as original_lines,
  (SELECT COUNT(*) FROM _production_line_id_mapping) as mapped_ids,
  CASE
    WHEN (SELECT COUNT(*) FROM _production_line_id_mapping) =
         (SELECT COUNT(*) FROM _archived_production_lines)
    THEN 'PASS'
    ELSE 'FAIL - Missing mappings'
  END as status;

-- ============================================
-- 3. NO ORPHANS CHECK
-- ============================================

-- Check: No orphaned process_properties (without canvas_object)
SELECT
  'Orphaned process_properties' as check_name,
  COUNT(*) as orphan_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END as status
FROM process_properties pp
WHERE NOT EXISTS (
  SELECT 1 FROM canvas_objects co WHERE co.id = pp.canvas_object_id
);

-- Check: No orphaned canvas_object_compatibilities (without canvas_object)
SELECT
  'Orphaned compatibilities' as check_name,
  COUNT(*) as orphan_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END as status
FROM canvas_object_compatibilities coc
WHERE NOT EXISTS (
  SELECT 1 FROM canvas_objects co WHERE co.id = coc.canvas_object_id
);

-- Check: No orphaned canvas_object_compatibilities (without model)
SELECT
  'Orphaned compatibilities (no model)' as check_name,
  COUNT(*) as orphan_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END as status
FROM canvas_object_compatibilities coc
WHERE NOT EXISTS (
  SELECT 1 FROM product_models_v2 pm WHERE pm.id = coc.model_id
);

-- ============================================
-- 4. BACKWARD COMPATIBILITY VIEW CHECKS
-- ============================================

-- Check: production_lines view returns same count as archived table
SELECT
  'Backward compat: production_lines view' as check_name,
  (SELECT COUNT(*) FROM _archived_production_lines) as original_count,
  (SELECT COUNT(*) FROM production_lines) as view_count,
  CASE
    WHEN (SELECT COUNT(*) FROM production_lines) =
         (SELECT COUNT(*) FROM _archived_production_lines)
    THEN 'PASS'
    ELSE 'FAIL - View missing records'
  END as status;

-- Check: line_model_compatibilities view returns same count
SELECT
  'Backward compat: line_model_compatibilities view' as check_name,
  (SELECT COUNT(*) FROM _archived_line_model_compatibilities) as original_count,
  (SELECT COUNT(*) FROM line_model_compatibilities) as view_count,
  CASE
    WHEN (SELECT COUNT(*) FROM line_model_compatibilities) >=
         (SELECT COUNT(*) FROM _archived_line_model_compatibilities)
    THEN 'PASS'
    ELSE 'FAIL - View missing records'
  END as status;

-- ============================================
-- 5. DATA QUALITY SPOT CHECKS
-- ============================================

-- Sample: Compare a few records between archive and migrated data
SELECT
  'Sample data comparison' as section,
  apl.id as original_id,
  apl.name as original_name,
  apl.area as original_area,
  apl.time_available_daily as original_time,
  co.id as migrated_id,
  co.name as migrated_name,
  pp.area as migrated_area,
  pp.time_available_daily as migrated_time,
  CASE
    WHEN apl.name = co.name
     AND apl.area = pp.area
     AND apl.time_available_daily = pp.time_available_daily
    THEN 'MATCH'
    ELSE 'MISMATCH'
  END as comparison
FROM _archived_production_lines apl
JOIN _production_line_id_mapping m ON apl.id = m.production_line_id
JOIN canvas_objects co ON m.canvas_object_id = co.id
JOIN process_properties pp ON co.id = pp.canvas_object_id
LIMIT 10;

-- ============================================
-- 6. COMPATIBILITY DATA SPOT CHECK
-- ============================================

SELECT
  'Compatibility migration sample' as section,
  almc.id as original_id,
  almc.line_id as original_line_id,
  almc.model_id,
  almc.cycle_time as original_cycle_time,
  almc.efficiency as original_efficiency,
  coc.id as migrated_id,
  coc.canvas_object_id as migrated_object_id,
  coc.cycle_time as migrated_cycle_time,
  coc.efficiency as migrated_efficiency,
  CASE
    WHEN almc.cycle_time = coc.cycle_time
     AND almc.efficiency = coc.efficiency
    THEN 'MATCH'
    ELSE 'MISMATCH'
  END as comparison
FROM _archived_line_model_compatibilities almc
JOIN _production_line_id_mapping m ON almc.line_id = m.production_line_id
JOIN canvas_object_compatibilities coc ON m.canvas_object_id = coc.canvas_object_id
  AND almc.model_id = coc.model_id
LIMIT 10;

-- ============================================
-- 7. SUMMARY REPORT
-- ============================================

SELECT '========================================' as report;
SELECT 'MIGRATION 017 VALIDATION SUMMARY' as report;
SELECT '========================================' as report;

SELECT
  'Total canvas_objects (process type): ' || COUNT(*) as report
FROM canvas_objects WHERE object_type = 'process';

SELECT
  'Total process_properties: ' || COUNT(*) as report
FROM process_properties;

SELECT
  'Total canvas_object_compatibilities: ' || COUNT(*) as report
FROM canvas_object_compatibilities;

SELECT
  'Total ID mappings: ' || COUNT(*) as report
FROM _production_line_id_mapping;

SELECT
  'Archived production_lines: ' || COUNT(*) as report
FROM _archived_production_lines;

SELECT
  'Archived line_model_compatibilities: ' || COUNT(*) as report
FROM _archived_line_model_compatibilities;

SELECT '========================================' as report;

-- ============================================
-- 8. ANALYSIS_RUNS REFERENCE CHECK
-- Check if any analysis_runs reference production_line IDs
-- (These would need application-level handling)
-- ============================================

-- Note: analysis_runs stores JSON, so we search for patterns
SELECT
  'Analysis runs with line references' as check_name,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) = 0 THEN 'OK - No historical analysis affected'
    ELSE 'WARNING - May need JSON update'
  END as status
FROM analysis_runs
WHERE results_json LIKE '%line_id%'
   OR results_json LIKE '%production_line%';

-- ============================================
-- END OF VALIDATION
-- ============================================

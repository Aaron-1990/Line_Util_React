-- ============================================
-- ROLLBACK: Migration 017 - Unify Production Lines
-- Run this script to revert migration 017
-- ============================================
--
-- IMPORTANT: This rollback should be run ONLY if the migration
-- encountered issues. It will restore the original table structure
-- but may lose data added AFTER the migration ran.
--
-- Pre-requisites:
-- - _archived_production_lines must exist
-- - _archived_line_model_compatibilities must exist
-- ============================================

-- ============================================
-- PHASE 1: Drop backward compatibility views
-- ============================================

DROP VIEW IF EXISTS production_lines;
DROP VIEW IF EXISTS line_model_compatibilities;
DROP VIEW IF EXISTS v_active_lines;
DROP VIEW IF EXISTS v_line_utilization_summary;
DROP VIEW IF EXISTS v_compatibilities_real_time;
DROP VIEW IF EXISTS v_plant_active_lines;
DROP VIEW IF EXISTS v_process_objects_with_properties;

-- ============================================
-- PHASE 2: Restore archived tables
-- ============================================

-- Restore production_lines from archive
ALTER TABLE _archived_production_lines RENAME TO production_lines;

-- Restore line_model_compatibilities from archive
ALTER TABLE _archived_line_model_compatibilities RENAME TO line_model_compatibilities;

-- ============================================
-- PHASE 3: Remove migrated data from canvas_objects
-- Only remove objects that were created by migration (prefixed with 'co-pl-')
-- ============================================

-- Delete migrated process_properties (prefixed with 'pp-pl-')
DELETE FROM process_properties WHERE id LIKE 'pp-pl-%';

-- Delete migrated canvas_object_compatibilities (prefixed with 'coc-')
DELETE FROM canvas_object_compatibilities WHERE id LIKE 'coc-mig-%';
DELETE FROM canvas_object_compatibilities WHERE id LIKE 'coc-lnk-%';

-- Delete migrated canvas_objects (prefixed with 'co-pl-')
DELETE FROM canvas_objects WHERE id LIKE 'co-pl-%';

-- ============================================
-- PHASE 4: Remove changeover_explicit column from process_properties
-- SQLite doesn't support DROP COLUMN directly, need to recreate table
-- ============================================

-- Create temp table without changeover_explicit
CREATE TABLE process_properties_temp (
  id TEXT PRIMARY KEY,
  canvas_object_id TEXT NOT NULL UNIQUE,
  area TEXT NOT NULL DEFAULT '',
  time_available_daily INTEGER NOT NULL DEFAULT 72000,
  line_type TEXT NOT NULL DEFAULT 'shared'
    CHECK(line_type IN ('shared', 'dedicated')),
  changeover_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (canvas_object_id) REFERENCES canvas_objects(id) ON DELETE CASCADE
);

-- Copy data (excluding changeover_explicit)
INSERT INTO process_properties_temp (id, canvas_object_id, area, time_available_daily, line_type, changeover_enabled, created_at, updated_at)
SELECT id, canvas_object_id, area, time_available_daily, line_type, changeover_enabled, created_at, updated_at
FROM process_properties
WHERE id NOT LIKE 'pp-pl-%';

-- Drop old table and rename
DROP TABLE process_properties;
ALTER TABLE process_properties_temp RENAME TO process_properties;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_process_properties_canvas_object
  ON process_properties(canvas_object_id);
CREATE INDEX IF NOT EXISTS idx_process_properties_area
  ON process_properties(area);

-- ============================================
-- PHASE 5: Drop mapping and validation tables
-- ============================================

DROP TABLE IF EXISTS _production_line_id_mapping;
DROP TABLE IF EXISTS _migration_017_validation;

-- ============================================
-- PHASE 6: Recreate original views
-- ============================================

-- v_active_lines (original)
CREATE VIEW IF NOT EXISTS v_active_lines AS
SELECT * FROM production_lines WHERE active = 1;

-- v_line_utilization_summary (original)
CREATE VIEW IF NOT EXISTS v_line_utilization_summary AS
SELECT
  pl.id,
  pl.name,
  pl.area,
  pl.time_available_daily,
  COUNT(lma.model_id) as assigned_models_count
FROM production_lines pl
LEFT JOIN line_model_assignments lma ON pl.id = lma.line_id
WHERE pl.active = 1
GROUP BY pl.id;

-- v_compatibilities_real_time (original)
CREATE VIEW IF NOT EXISTS v_compatibilities_real_time AS
SELECT
  c.id,
  c.line_id,
  c.model_id,
  l.name as line_name,
  m.name as model_name,
  c.cycle_time,
  c.efficiency,
  c.priority,
  CAST(c.cycle_time AS REAL) / (c.efficiency / 100.0) as real_time_per_unit,
  m.annual_volume,
  m.operations_days,
  CASE
    WHEN m.operations_days > 0 THEN CAST(m.annual_volume AS REAL) / m.operations_days
    ELSE 0
  END as daily_demand
FROM line_model_compatibilities c
LEFT JOIN production_lines l ON c.line_id = l.id
LEFT JOIN product_models_v2 m ON c.model_id = m.id
WHERE (m.active = 1 OR m.active IS NULL) AND (l.active = 1 OR l.active IS NULL);

-- v_plant_active_lines (original)
CREATE VIEW IF NOT EXISTS v_plant_active_lines AS
SELECT
  pl.*,
  p.code as plant_code,
  p.name as plant_name
FROM production_lines pl
JOIN plants p ON pl.plant_id = p.id
WHERE pl.active = 1 AND p.is_active = 1;

-- v_process_objects_with_properties (original from migration 015)
CREATE VIEW IF NOT EXISTS v_process_objects_with_properties AS
SELECT
  co.id,
  co.plant_id,
  co.name as object_name,
  co.description,
  co.x_position,
  co.y_position,
  co.object_type,
  pp.area,
  pp.time_available_daily,
  pp.line_type,
  pp.changeover_enabled,
  pll.production_line_id,
  pl.name as linked_line_name
FROM canvas_objects co
LEFT JOIN process_properties pp ON co.id = pp.canvas_object_id
LEFT JOIN process_line_links pll ON co.id = pll.canvas_object_id
LEFT JOIN production_lines pl ON pll.production_line_id = pl.id
WHERE co.object_type = 'process' AND co.active = 1;

-- ============================================
-- ROLLBACK COMPLETE
-- ============================================
--
-- Summary:
-- - Restored: production_lines table
-- - Restored: line_model_compatibilities table
-- - Removed: Migrated canvas_objects (co-pl-*)
-- - Removed: Migrated process_properties (pp-pl-*)
-- - Removed: Migrated compatibilities (coc-mig-*, coc-lnk-*)
-- - Removed: changeover_explicit from process_properties
-- - Removed: _production_line_id_mapping
-- - Removed: _migration_017_validation
-- - Recreated: Original views
--
-- NOTE: Canvas objects and process_properties created BEFORE the migration
-- are preserved (those not prefixed with migration markers).
-- ============================================

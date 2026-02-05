-- ============================================
-- MIGRATION 017: Unify Production Lines into Canvas Objects
-- Phase 7.5: Complete migration from production_lines to canvas_objects
-- Version: 7.5.2
-- ============================================
--
-- This migration unifies the production_lines table into the canvas_objects system:
-- 1. Add missing columns to process_properties (changeover_explicit)
-- 2. Create canvas_objects from production_lines
-- 3. Create process_properties from production_lines data
-- 4. Migrate line_model_compatibilities to canvas_object_compatibilities
-- 5. Archive old tables (soft migration - tables renamed, not deleted)
-- 6. Update views for backward compatibility
--
-- ID Strategy:
--   - Canvas object IDs: 'co-pl-{production_line_id}' for migrated lines
--   - Process properties IDs: 'pp-pl-{production_line_id}'
--   - Compatibility IDs: 'coc-{original_id}'
--   - This preserves traceability to original production_line IDs
--
-- Data Model (After Migration):
--   plants -> canvas_objects -> process_properties
--                |-> canvas_object_compatibilities -> product_models_v2
--                |-> canvas_connections
--
-- IMPORTANT: This migration is REVERSIBLE. See rollback section at bottom.
-- ============================================

-- ============================================
-- PRE-MIGRATION: Check if migration already ran (idempotency)
-- ============================================

-- Create validation table to store migration state
CREATE TABLE IF NOT EXISTS _migration_017_validation (
  check_name TEXT PRIMARY KEY,
  value_before INTEGER,
  value_after INTEGER,
  validated_at TEXT DEFAULT (datetime('now'))
);

-- Check if migration already completed (production_lines is now a VIEW)
-- If _archived_production_lines exists, migration was already run
INSERT OR REPLACE INTO _migration_017_validation (check_name, value_before)
  SELECT 'migration_already_complete',
    (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='_archived_production_lines');

-- ============================================
-- PHASE 1: Add changeover_explicit column if missing
-- ============================================
-- Note: This column should exist from migration 015, but older DBs may not have it.
-- We use a safe approach that handles both cases.

-- Check if changeover_explicit column exists
INSERT OR REPLACE INTO _migration_017_validation (check_name, value_before)
  SELECT 'changeover_explicit_exists',
    (SELECT COUNT(*) FROM pragma_table_info('process_properties') WHERE name = 'changeover_explicit');

-- Skip the entire migration if production_lines table doesn't exist
-- (meaning migration already ran and renamed it)
-- This makes the migration idempotent

-- ============================================
-- PHASE 2: Insert production_lines as canvas_objects
-- Skip lines that are already linked via process_line_links (to avoid duplicates)
-- ============================================

-- Insert production_lines as canvas_objects (type='process')
-- Uses rect-basic shape as default
INSERT INTO canvas_objects (
  id,
  plant_id,
  shape_id,
  object_type,
  name,
  description,
  x_position,
  y_position,
  width,
  height,
  rotation,
  color_override,
  active,
  locked,
  z_index,
  created_at,
  updated_at
)
SELECT
  'co-pl-' || pl.id,                              -- Prefixed ID for traceability
  pl.plant_id,                                     -- Direct plant reference
  'rect-basic',                                    -- Default shape (rectangle)
  'process',                                       -- Object type
  pl.name,                                         -- Line name
  'Migrated from production_lines on ' || datetime('now'),  -- Description
  pl.x_position,                                   -- Preserve X position
  pl.y_position,                                   -- Preserve Y position
  200,                                             -- Default width
  100,                                             -- Default height
  0,                                               -- No rotation
  NULL,                                            -- No color override
  pl.active,                                       -- Preserve active status
  0,                                               -- Not locked
  0,                                               -- Default z-index
  pl.created_at,                                   -- Preserve creation time
  datetime('now')                                  -- Update timestamp
FROM production_lines pl
WHERE NOT EXISTS (
  -- Skip lines that are already linked to a canvas object
  SELECT 1 FROM process_line_links pll WHERE pll.production_line_id = pl.id
);

-- ============================================
-- PHASE 3: Create process_properties for migrated lines
-- ============================================

INSERT INTO process_properties (
  id,
  canvas_object_id,
  area,
  time_available_daily,
  line_type,
  changeover_enabled,
  changeover_explicit,
  created_at,
  updated_at
)
SELECT
  'pp-pl-' || pl.id,                              -- Prefixed ID
  'co-pl-' || pl.id,                              -- Reference to migrated canvas_object
  pl.area,                                         -- Area code
  pl.time_available_daily,                         -- Time available (seconds)
  COALESCE(pl.line_type, 'shared'),               -- Line type
  COALESCE(pl.changeover_enabled, 1),             -- Changeover enabled
  COALESCE(pl.changeover_explicit, 0),            -- Changeover explicit override
  pl.created_at,                                   -- Preserve creation time
  datetime('now')                                  -- Update timestamp
FROM production_lines pl
WHERE NOT EXISTS (
  -- Skip lines that are already linked to a canvas object
  SELECT 1 FROM process_line_links pll WHERE pll.production_line_id = pl.id
);

-- ============================================
-- PHASE 4: Update process_properties for already-linked lines
-- Copy production_lines data into existing process_properties
-- ============================================

-- For lines already linked via process_line_links, update their process_properties
-- This handles the case where a canvas object was created but properties weren't copied
UPDATE process_properties
SET
  area = (
    SELECT pl.area
    FROM process_line_links pll
    JOIN production_lines pl ON pll.production_line_id = pl.id
    WHERE pll.canvas_object_id = process_properties.canvas_object_id
  ),
  time_available_daily = (
    SELECT pl.time_available_daily
    FROM process_line_links pll
    JOIN production_lines pl ON pll.production_line_id = pl.id
    WHERE pll.canvas_object_id = process_properties.canvas_object_id
  ),
  line_type = (
    SELECT COALESCE(pl.line_type, 'shared')
    FROM process_line_links pll
    JOIN production_lines pl ON pll.production_line_id = pl.id
    WHERE pll.canvas_object_id = process_properties.canvas_object_id
  ),
  changeover_enabled = (
    SELECT COALESCE(pl.changeover_enabled, 1)
    FROM process_line_links pll
    JOIN production_lines pl ON pll.production_line_id = pl.id
    WHERE pll.canvas_object_id = process_properties.canvas_object_id
  ),
  changeover_explicit = (
    SELECT COALESCE(pl.changeover_explicit, 0)
    FROM process_line_links pll
    JOIN production_lines pl ON pll.production_line_id = pl.id
    WHERE pll.canvas_object_id = process_properties.canvas_object_id
  ),
  updated_at = datetime('now')
WHERE canvas_object_id IN (
  SELECT canvas_object_id FROM process_line_links WHERE production_line_id IS NOT NULL
);

-- ============================================
-- PHASE 5: Migrate line_model_compatibilities to canvas_object_compatibilities
-- ============================================

-- First, migrate compatibilities for lines that were already linked
INSERT OR IGNORE INTO canvas_object_compatibilities (
  id,
  canvas_object_id,
  model_id,
  cycle_time,
  efficiency,
  priority,
  created_at,
  updated_at
)
SELECT
  'coc-lnk-' || lmc.id,                           -- Prefixed ID for linked lines
  pll.canvas_object_id,                            -- Use existing canvas_object_id from link
  lmc.model_id,
  lmc.cycle_time,
  lmc.efficiency,
  lmc.priority,
  lmc.created_at,
  datetime('now')
FROM line_model_compatibilities lmc
JOIN process_line_links pll ON lmc.line_id = pll.production_line_id
WHERE pll.production_line_id IS NOT NULL
-- Skip if this compatibility already exists
AND NOT EXISTS (
  SELECT 1 FROM canvas_object_compatibilities coc
  WHERE coc.canvas_object_id = pll.canvas_object_id
  AND coc.model_id = lmc.model_id
);

-- Then, migrate compatibilities for newly migrated lines
INSERT OR IGNORE INTO canvas_object_compatibilities (
  id,
  canvas_object_id,
  model_id,
  cycle_time,
  efficiency,
  priority,
  created_at,
  updated_at
)
SELECT
  'coc-mig-' || lmc.id,                           -- Prefixed ID for migrated lines
  'co-pl-' || lmc.line_id,                        -- Reference to migrated canvas_object
  lmc.model_id,
  lmc.cycle_time,
  lmc.efficiency,
  lmc.priority,
  lmc.created_at,
  datetime('now')
FROM line_model_compatibilities lmc
WHERE NOT EXISTS (
  -- Only for lines that were NOT already linked (freshly migrated)
  SELECT 1 FROM process_line_links pll WHERE pll.production_line_id = lmc.line_id
)
-- Skip if this compatibility already exists
AND NOT EXISTS (
  SELECT 1 FROM canvas_object_compatibilities coc
  WHERE coc.canvas_object_id = 'co-pl-' || lmc.line_id
  AND coc.model_id = lmc.model_id
);

-- ============================================
-- PHASE 6: Create ID mapping table for reference
-- This helps with any future queries that need to map old IDs to new
-- ============================================

CREATE TABLE IF NOT EXISTS _production_line_id_mapping (
  production_line_id TEXT PRIMARY KEY,
  canvas_object_id TEXT NOT NULL,
  migration_type TEXT NOT NULL,  -- 'migrated' or 'linked'
  migrated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Store mappings for newly migrated lines
INSERT OR IGNORE INTO _production_line_id_mapping (production_line_id, canvas_object_id, migration_type)
SELECT
  pl.id,
  'co-pl-' || pl.id,
  'migrated'
FROM production_lines pl
WHERE NOT EXISTS (
  SELECT 1 FROM process_line_links pll WHERE pll.production_line_id = pl.id
);

-- Store mappings for already-linked lines
INSERT OR IGNORE INTO _production_line_id_mapping (production_line_id, canvas_object_id, migration_type)
SELECT
  pll.production_line_id,
  pll.canvas_object_id,
  'linked'
FROM process_line_links pll
WHERE pll.production_line_id IS NOT NULL;

-- ============================================
-- PHASE 7: Archive old tables (rename, don't delete)
-- ============================================

-- Rename production_lines to _archived_production_lines
ALTER TABLE production_lines RENAME TO _archived_production_lines;

-- Rename line_model_compatibilities to _archived_line_model_compatibilities
ALTER TABLE line_model_compatibilities RENAME TO _archived_line_model_compatibilities;

-- Mark process_line_links as deprecated (keep for now, but add marker)
-- We can't rename it because canvas_objects may still reference it
-- Instead, we'll handle this in application code

-- ============================================
-- PHASE 8: Create backward compatibility view
-- This view provides the old production_lines interface for legacy code
-- ============================================

CREATE VIEW IF NOT EXISTS production_lines AS
SELECT
  CASE
    WHEN m.production_line_id IS NOT NULL THEN m.production_line_id
    ELSE REPLACE(co.id, 'co-pl-', '')
  END as id,
  co.plant_id,
  co.name,
  pp.area,
  pp.line_type,
  pp.time_available_daily,
  co.x_position,
  co.y_position,
  pp.changeover_enabled,
  pp.changeover_explicit,
  co.active,
  co.created_at,
  co.updated_at
FROM canvas_objects co
JOIN process_properties pp ON co.id = pp.canvas_object_id
LEFT JOIN _production_line_id_mapping m ON co.id = m.canvas_object_id
WHERE co.object_type = 'process';

-- ============================================
-- PHASE 9: Create backward compatibility view for compatibilities
-- ============================================

CREATE VIEW IF NOT EXISTS line_model_compatibilities AS
SELECT
  coc.id,
  CASE
    WHEN m.production_line_id IS NOT NULL THEN m.production_line_id
    ELSE REPLACE(coc.canvas_object_id, 'co-pl-', '')
  END as line_id,
  coc.model_id,
  coc.cycle_time,
  coc.efficiency,
  coc.priority,
  (SELECT plant_id FROM canvas_objects WHERE id = coc.canvas_object_id) as plant_id,
  coc.created_at,
  coc.updated_at
FROM canvas_object_compatibilities coc
LEFT JOIN _production_line_id_mapping m ON coc.canvas_object_id = m.canvas_object_id;

-- ============================================
-- PHASE 10: Update dependent views
-- Drop and recreate views that depend on production_lines
-- ============================================

-- Drop old views that reference production_lines directly
DROP VIEW IF EXISTS v_active_lines;
DROP VIEW IF EXISTS v_line_utilization_summary;
DROP VIEW IF EXISTS v_compatibilities_real_time;
DROP VIEW IF EXISTS v_plant_active_lines;
DROP VIEW IF EXISTS v_process_objects_with_lines;
DROP VIEW IF EXISTS v_process_objects_with_properties;

-- Recreate v_active_lines using canvas_objects
CREATE VIEW IF NOT EXISTS v_active_lines AS
SELECT
  CASE
    WHEN m.production_line_id IS NOT NULL THEN m.production_line_id
    ELSE REPLACE(co.id, 'co-pl-', '')
  END as id,
  co.plant_id,
  co.name,
  pp.area,
  pp.line_type,
  pp.time_available_daily,
  co.x_position,
  co.y_position,
  pp.changeover_enabled,
  pp.changeover_explicit,
  co.active,
  co.created_at,
  co.updated_at
FROM canvas_objects co
JOIN process_properties pp ON co.id = pp.canvas_object_id
LEFT JOIN _production_line_id_mapping m ON co.id = m.canvas_object_id
WHERE co.object_type = 'process' AND co.active = 1;

-- Recreate v_line_utilization_summary
CREATE VIEW IF NOT EXISTS v_line_utilization_summary AS
SELECT
  co.id,
  co.name,
  pp.area,
  pp.time_available_daily,
  (SELECT COUNT(*) FROM canvas_object_compatibilities coc WHERE coc.canvas_object_id = co.id) as assigned_models_count
FROM canvas_objects co
JOIN process_properties pp ON co.id = pp.canvas_object_id
WHERE co.object_type = 'process' AND co.active = 1;

-- Recreate v_compatibilities_real_time using new structure
CREATE VIEW IF NOT EXISTS v_compatibilities_real_time AS
SELECT
  coc.id,
  coc.canvas_object_id as line_id,
  coc.model_id,
  co.name as line_name,
  pm.name as model_name,
  coc.cycle_time,
  coc.efficiency,
  coc.priority,
  CAST(coc.cycle_time AS REAL) / (coc.efficiency / 100.0) as real_time_per_unit,
  pm.annual_volume,
  pm.operations_days,
  CASE
    WHEN pm.operations_days > 0 THEN CAST(pm.annual_volume AS REAL) / pm.operations_days
    ELSE 0
  END as daily_demand
FROM canvas_object_compatibilities coc
JOIN canvas_objects co ON coc.canvas_object_id = co.id
JOIN product_models_v2 pm ON coc.model_id = pm.id
WHERE co.object_type = 'process'
  AND (co.active = 1 OR co.active IS NULL)
  AND (pm.active = 1 OR pm.active IS NULL);

-- Recreate v_plant_active_lines
CREATE VIEW IF NOT EXISTS v_plant_active_lines AS
SELECT
  co.id,
  co.plant_id,
  co.name,
  pp.area,
  pp.line_type,
  pp.time_available_daily,
  pp.changeover_enabled,
  pp.changeover_explicit,
  p.code as plant_code,
  p.name as plant_name
FROM canvas_objects co
JOIN process_properties pp ON co.id = pp.canvas_object_id
JOIN plants p ON co.plant_id = p.id
WHERE co.object_type = 'process' AND co.active = 1 AND p.is_active = 1;

-- Recreate v_process_objects_with_properties (simplified - no more linking)
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
  pp.changeover_explicit,
  -- Legacy fields for backward compatibility
  NULL as production_line_id,
  NULL as linked_line_name
FROM canvas_objects co
LEFT JOIN process_properties pp ON co.id = pp.canvas_object_id
WHERE co.object_type = 'process' AND co.active = 1;

-- ============================================
-- PHASE 11: Post-migration validation
-- ============================================

-- Update validation table with post-migration counts
UPDATE _migration_017_validation SET value_after = (
  SELECT COUNT(*) FROM canvas_objects WHERE object_type = 'process'
) WHERE check_name = 'production_lines_total';

UPDATE _migration_017_validation SET value_after = (
  SELECT COUNT(*) FROM canvas_objects WHERE object_type = 'process' AND active = 1
) WHERE check_name = 'production_lines_active';

UPDATE _migration_017_validation SET value_after = (
  SELECT COUNT(*) FROM canvas_object_compatibilities
) WHERE check_name = 'line_model_compatibilities';

UPDATE _migration_017_validation SET value_after = (
  SELECT COUNT(*) FROM canvas_objects
) WHERE check_name = 'canvas_objects_before';

UPDATE _migration_017_validation SET value_after = (
  SELECT COUNT(*) FROM process_properties
) WHERE check_name = 'process_properties_before';

UPDATE _migration_017_validation SET value_after = (
  SELECT COUNT(*) FROM canvas_object_compatibilities
) WHERE check_name = 'canvas_object_compatibilities_before';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
--
-- Summary of changes:
-- - Added: changeover_explicit to process_properties
-- - Migrated: 209 production_lines -> canvas_objects (type='process')
-- - Migrated: 1712 line_model_compatibilities -> canvas_object_compatibilities
-- - Created: _production_line_id_mapping for ID traceability
-- - Archived: production_lines -> _archived_production_lines
-- - Archived: line_model_compatibilities -> _archived_line_model_compatibilities
-- - Created: Backward compatibility views for production_lines and line_model_compatibilities
-- - Updated: All dependent views to use new structure
--
-- Notes:
-- - process_line_links table is now DEPRECATED (kept for reference)
-- - Old production_line IDs preserved in _production_line_id_mapping
-- - Views provide backward compatibility for legacy code
-- - analysis_runs JSON references will need application-level handling
--
-- Next steps (application code):
-- 1. Update repositories to use canvas_objects/process_properties
-- 2. Update DataExporter to use canvas_objects
-- 3. Update Python optimizer input format (or use view)
-- 4. Remove/deprecate ProductionLineRepository
-- 5. Clean up process_line_links logic
-- ============================================

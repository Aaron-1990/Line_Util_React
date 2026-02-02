-- ============================================
-- MIGRATION 010: Multi-Plant Support
-- Phase 7: Enable multi-plant capacity planning
-- Version: 7.0.0
-- ============================================
--
-- This migration introduces multi-plant support:
-- 1. Plants table as top-level organizational unit
-- 2. plant_id foreign keys on plant-scoped tables
-- 3. Model ownership tracking (launch_plant, primary_plant)
-- 4. Plant-specific volume and routing tables
-- 5. Default plant for backward compatibility
--
-- Data Model:
--   GLOBAL: product_models_v2, area_catalog (definitions)
--   PLANT-SPECIFIC: lines, volumes, routings, compatibilities
-- ============================================

-- ============================================
-- PHASE 1: Create plants table
-- ============================================

CREATE TABLE IF NOT EXISTS plants (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,                             -- Short code: "REY", "SLP", "ITX"
  name TEXT NOT NULL,                             -- Full name: "Reynosa, Tamaulipas"
  region TEXT,                                    -- Geographic region: "LATAM", "NA", "EMEA", "APAC"
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,                          -- ISO 3166-1 alpha-2: "MX", "US"
  timezone TEXT DEFAULT 'America/Chicago',        -- IANA timezone
  currency_code CHAR(3) DEFAULT 'USD',
  default_operations_days INTEGER DEFAULT 240 CHECK(default_operations_days > 0 AND default_operations_days <= 366),
  default_shifts_per_day INTEGER DEFAULT 2 CHECK(default_shifts_per_day >= 1 AND default_shifts_per_day <= 4),
  default_hours_per_shift REAL DEFAULT 8.0 CHECK(default_hours_per_shift > 0 AND default_hours_per_shift <= 12),
  color TEXT,                                     -- Hex color for UI: "#3B82F6"
  is_default INTEGER DEFAULT 0,                   -- Boolean: default plant for new data
  is_active INTEGER DEFAULT 1,                    -- Boolean: soft delete
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ensure code is unique among active plants
CREATE UNIQUE INDEX IF NOT EXISTS idx_plants_code ON plants(code) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_plants_region ON plants(region);
CREATE INDEX IF NOT EXISTS idx_plants_active ON plants(is_active);
CREATE INDEX IF NOT EXISTS idx_plants_default ON plants(is_default) WHERE is_default = 1;

-- Trigger: Auto-update timestamp
CREATE TRIGGER IF NOT EXISTS update_plants_timestamp
AFTER UPDATE ON plants
BEGIN
  UPDATE plants SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================
-- PHASE 2: Insert default plant for existing data
-- ============================================

INSERT INTO plants (id, code, name, region, location_country, is_default, is_active, notes)
VALUES (
  'plant-default',
  'DEFAULT',
  'Default Plant',
  'Default',
  'US',
  1,
  1,
  'Auto-created during multi-plant migration. Rename to your actual plant name.'
);

-- ============================================
-- PHASE 3: Add plant_id to production_lines
-- ============================================

ALTER TABLE production_lines ADD COLUMN plant_id TEXT REFERENCES plants(id) ON DELETE RESTRICT;

-- Backfill existing lines to default plant
UPDATE production_lines SET plant_id = 'plant-default' WHERE plant_id IS NULL;

-- Create compound index for plant-scoped queries
CREATE INDEX IF NOT EXISTS idx_production_lines_plant ON production_lines(plant_id);
CREATE INDEX IF NOT EXISTS idx_production_lines_plant_active ON production_lines(plant_id, active);

-- ============================================
-- PHASE 4: Add plant_id to canvas_areas
-- ============================================

ALTER TABLE canvas_areas ADD COLUMN plant_id TEXT REFERENCES plants(id) ON DELETE CASCADE;

-- Backfill existing canvas areas to default plant
UPDATE canvas_areas SET plant_id = 'plant-default' WHERE plant_id IS NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_canvas_areas_plant ON canvas_areas(plant_id);

-- ============================================
-- PHASE 5: Add plant_id to line_model_compatibilities (denormalized)
-- ============================================

ALTER TABLE line_model_compatibilities ADD COLUMN plant_id TEXT REFERENCES plants(id) ON DELETE CASCADE;

-- Backfill from production_lines relationship
UPDATE line_model_compatibilities
SET plant_id = (SELECT plant_id FROM production_lines WHERE id = line_model_compatibilities.line_id)
WHERE plant_id IS NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_compatibilities_plant ON line_model_compatibilities(plant_id);

-- ============================================
-- PHASE 6: Add model ownership fields to product_models_v2
-- ============================================

-- launch_plant_id: Historical record - which plant first launched this model (never changes)
ALTER TABLE product_models_v2 ADD COLUMN launch_plant_id TEXT REFERENCES plants(id) ON DELETE SET NULL;

-- primary_plant_id: Current owner - who manages ECNs, process docs (can change after transfer)
ALTER TABLE product_models_v2 ADD COLUMN primary_plant_id TEXT REFERENCES plants(id) ON DELETE SET NULL;

-- ownership_type: 'exclusive' (single plant), 'shared' (multiple plants active), 'transferred' (moved)
ALTER TABLE product_models_v2 ADD COLUMN ownership_type TEXT DEFAULT 'exclusive'
  CHECK(ownership_type IN ('exclusive', 'shared', 'transferred'));

-- Backfill existing models to default plant
UPDATE product_models_v2
SET launch_plant_id = 'plant-default',
    primary_plant_id = 'plant-default',
    ownership_type = 'exclusive'
WHERE launch_plant_id IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_models_v2_launch_plant ON product_models_v2(launch_plant_id);
CREATE INDEX IF NOT EXISTS idx_models_v2_primary_plant ON product_models_v2(primary_plant_id);
CREATE INDEX IF NOT EXISTS idx_models_v2_ownership ON product_models_v2(ownership_type);

-- ============================================
-- PHASE 7: Create plant_product_volumes table
-- Plant-specific demand allocation (replaces product_volumes for multi-plant)
-- ============================================

CREATE TABLE IF NOT EXISTS plant_product_volumes (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES product_models_v2(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK(year >= 2000 AND year <= 2100),
  volume INTEGER NOT NULL DEFAULT 0 CHECK(volume >= 0),
  operations_days INTEGER NOT NULL DEFAULT 240 CHECK(operations_days >= 0 AND operations_days <= 366),
  source TEXT DEFAULT 'manual',                   -- 'manual', 'excel_import', 'corporate', 'migration'
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(plant_id, model_id, year)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plant_volumes_plant ON plant_product_volumes(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_volumes_model ON plant_product_volumes(model_id);
CREATE INDEX IF NOT EXISTS idx_plant_volumes_year ON plant_product_volumes(year);
CREATE INDEX IF NOT EXISTS idx_plant_volumes_plant_year ON plant_product_volumes(plant_id, year);

-- Trigger: Auto-update timestamp
CREATE TRIGGER IF NOT EXISTS update_plant_product_volumes_timestamp
AFTER UPDATE ON plant_product_volumes
BEGIN
  UPDATE plant_product_volumes SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Migrate existing product_volumes to plant_product_volumes
INSERT INTO plant_product_volumes (id, plant_id, model_id, year, volume, operations_days, source, created_at, updated_at)
SELECT
  'ppv-' || id,
  'plant-default',
  model_id,
  year,
  volume,
  operations_days,
  'migration',
  created_at,
  updated_at
FROM product_volumes;

-- ============================================
-- PHASE 8: Create plant_model_routing table
-- Plant-specific process flow (DAG)
-- ============================================

CREATE TABLE IF NOT EXISTS plant_model_routing (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES product_models_v2(id) ON DELETE CASCADE,
  area_code TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,            -- Display order hint
  is_required INTEGER NOT NULL DEFAULT 1,         -- 1=required, 0=optional
  expected_yield REAL NOT NULL DEFAULT 1.0 CHECK(expected_yield >= 0.0 AND expected_yield <= 1.0),
  volume_fraction REAL NOT NULL DEFAULT 1.0 CHECK(volume_fraction >= 0.0 AND volume_fraction <= 1.0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(plant_id, model_id, area_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plant_routing_plant ON plant_model_routing(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_routing_model ON plant_model_routing(model_id);
CREATE INDEX IF NOT EXISTS idx_plant_routing_plant_model ON plant_model_routing(plant_id, model_id);

-- Trigger: Auto-update timestamp
CREATE TRIGGER IF NOT EXISTS update_plant_model_routing_timestamp
AFTER UPDATE ON plant_model_routing
BEGIN
  UPDATE plant_model_routing SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Migrate existing model_area_routing to plant_model_routing
INSERT INTO plant_model_routing (id, plant_id, model_id, area_code, sequence, is_required, expected_yield, volume_fraction, created_at, updated_at)
SELECT
  'pmr-' || id,
  'plant-default',
  model_id,
  area_code,
  sequence,
  is_required,
  expected_yield,
  volume_fraction,
  created_at,
  updated_at
FROM model_area_routing;

-- ============================================
-- PHASE 9: Create plant_model_routing_predecessors table
-- Plant-specific DAG edges
-- ============================================

CREATE TABLE IF NOT EXISTS plant_model_routing_predecessors (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  area_code TEXT NOT NULL,
  predecessor_area_code TEXT NOT NULL,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(plant_id, model_id, area_code, predecessor_area_code),
  CHECK(area_code != predecessor_area_code),

  FOREIGN KEY (plant_id, model_id, area_code)
    REFERENCES plant_model_routing(plant_id, model_id, area_code) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plant_routing_pred_plant ON plant_model_routing_predecessors(plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_routing_pred_model ON plant_model_routing_predecessors(plant_id, model_id);
CREATE INDEX IF NOT EXISTS idx_plant_routing_pred_area ON plant_model_routing_predecessors(plant_id, model_id, area_code);

-- Migrate existing model_area_predecessors
INSERT INTO plant_model_routing_predecessors (id, plant_id, model_id, area_code, predecessor_area_code, dependency_type, created_at)
SELECT
  'pmrp-' || id,
  'plant-default',
  model_id,
  area_code,
  predecessor_area_code,
  dependency_type,
  created_at
FROM model_area_predecessors;

-- ============================================
-- PHASE 10: Update unique constraints
-- Line names should be unique PER PLANT (not globally)
-- ============================================

-- Drop old index (if exists) and create new plant-scoped unique index
DROP INDEX IF EXISTS idx_production_lines_name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_production_lines_name_plant
  ON production_lines(name, plant_id) WHERE active = 1;

-- ============================================
-- PHASE 11: Create views for plant-scoped queries
-- ============================================

-- View: Active lines for a plant (use with WHERE plant_id = ?)
CREATE VIEW IF NOT EXISTS v_plant_active_lines AS
SELECT
  pl.*,
  p.code as plant_code,
  p.name as plant_name
FROM production_lines pl
JOIN plants p ON pl.plant_id = p.id
WHERE pl.active = 1 AND p.is_active = 1;

-- View: Plant volumes with daily demand
CREATE VIEW IF NOT EXISTS v_plant_volumes_daily_demand AS
SELECT
  v.id,
  v.plant_id,
  p.code as plant_code,
  p.name as plant_name,
  v.model_id,
  m.name as model_name,
  m.customer,
  m.program,
  m.family,
  v.year,
  v.volume,
  v.operations_days,
  CASE
    WHEN v.operations_days > 0 THEN CAST(v.volume AS REAL) / v.operations_days
    ELSE 0
  END as daily_demand,
  v.source
FROM plant_product_volumes v
JOIN plants p ON v.plant_id = p.id
JOIN product_models_v2 m ON v.model_id = m.id
WHERE m.active = 1 AND p.is_active = 1;

-- View: Model assignments across plants
CREATE VIEW IF NOT EXISTS v_model_plant_summary AS
SELECT
  m.id as model_id,
  m.name as model_name,
  m.customer,
  m.family,
  m.launch_plant_id,
  lp.code as launch_plant_code,
  lp.name as launch_plant_name,
  m.primary_plant_id,
  pp.code as primary_plant_code,
  pp.name as primary_plant_name,
  m.ownership_type,
  (SELECT COUNT(DISTINCT plant_id) FROM plant_product_volumes WHERE model_id = m.id AND volume > 0) as active_plant_count,
  (SELECT SUM(volume) FROM plant_product_volumes WHERE model_id = m.id) as total_global_volume
FROM product_models_v2 m
LEFT JOIN plants lp ON m.launch_plant_id = lp.id
LEFT JOIN plants pp ON m.primary_plant_id = pp.id
WHERE m.active = 1;

-- View: Plant capacity summary (for global dashboard)
CREATE VIEW IF NOT EXISTS v_plant_capacity_summary AS
SELECT
  p.id as plant_id,
  p.code as plant_code,
  p.name as plant_name,
  p.region,
  (SELECT COUNT(*) FROM production_lines WHERE plant_id = p.id AND active = 1) as line_count,
  (SELECT COUNT(DISTINCT model_id) FROM plant_product_volumes WHERE plant_id = p.id AND volume > 0) as model_count,
  (SELECT COUNT(DISTINCT area) FROM production_lines WHERE plant_id = p.id AND active = 1) as area_count
FROM plants p
WHERE p.is_active = 1;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
--
-- Summary of changes:
-- - Created: plants table
-- - Added: plant_id to production_lines, canvas_areas, line_model_compatibilities
-- - Added: launch_plant_id, primary_plant_id, ownership_type to product_models_v2
-- - Created: plant_product_volumes (migrated from product_volumes)
-- - Created: plant_model_routing (migrated from model_area_routing)
-- - Created: plant_model_routing_predecessors (migrated from model_area_predecessors)
-- - Created: Views for plant-scoped queries
-- - Default plant created with all existing data assigned
--
-- Next steps (application code):
-- 1. Update repositories to accept plantId parameter
-- 2. Update IPC handlers to pass plantId
-- 3. Add PlantRepository and plant CRUD
-- 4. Add plant selector to UI
-- ============================================

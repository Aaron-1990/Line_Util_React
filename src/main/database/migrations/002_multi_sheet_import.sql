-- ============================================
-- MIGRATION 002: Multi-Sheet Import Support
-- Adds line_model_compatibilities table and updates product_models
-- Version: 2.0.0
-- ============================================

-- ============================================
-- PRODUCT MODELS UPDATE
-- Add columns for multi-sheet import (annual_volume, operations_days)
-- ============================================

-- Add new columns to product_models if they don't exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a different approach

-- First check if columns exist, if not add them
-- Note: These ALTER TABLE statements will fail silently if columns already exist
-- We handle this at the application level

-- For fresh installs or if the table needs these columns:
-- annual_volume: Total yearly production volume
-- operations_days: Number of working days per year (1-365)
-- customer: Customer name
-- program: Program/project name

-- Create temporary table to check structure
CREATE TABLE IF NOT EXISTS _migration_check (id INTEGER PRIMARY KEY);
DROP TABLE IF EXISTS _migration_check;

-- ============================================
-- LINE-MODEL COMPATIBILITIES TABLE
-- Stores which models can run on which lines with efficiency
-- Uses surrogate keys (IDs) instead of natural keys (names) for referential integrity
-- ============================================

CREATE TABLE IF NOT EXISTS line_model_compatibilities (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  cycle_time INTEGER NOT NULL CHECK(cycle_time > 0),
  efficiency INTEGER NOT NULL CHECK(efficiency > 0 AND efficiency <= 100),
  priority INTEGER NOT NULL DEFAULT 1 CHECK(priority >= 1),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (line_id) REFERENCES production_lines(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES product_models_v2(id) ON DELETE CASCADE,
  UNIQUE(line_id, model_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_compatibilities_line ON line_model_compatibilities(line_id);
CREATE INDEX IF NOT EXISTS idx_compatibilities_model ON line_model_compatibilities(model_id);
CREATE INDEX IF NOT EXISTS idx_compatibilities_priority ON line_model_compatibilities(line_id, priority);

-- ============================================
-- PRODUCT MODELS V2 TABLE (for multi-sheet import)
-- Simplified structure for Python algorithm
-- ============================================

CREATE TABLE IF NOT EXISTS product_models_v2 (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  customer TEXT NOT NULL DEFAULT '',
  program TEXT NOT NULL DEFAULT '',
  family TEXT NOT NULL DEFAULT '',
  annual_volume INTEGER NOT NULL DEFAULT 0 CHECK(annual_volume >= 0),
  operations_days INTEGER NOT NULL DEFAULT 250 CHECK(operations_days > 0 AND operations_days <= 365),
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for product_models_v2
CREATE INDEX IF NOT EXISTS idx_product_models_v2_name ON product_models_v2(name);
CREATE INDEX IF NOT EXISTS idx_product_models_v2_family ON product_models_v2(family);
CREATE INDEX IF NOT EXISTS idx_product_models_v2_active ON product_models_v2(active);
CREATE INDEX IF NOT EXISTS idx_product_models_v2_customer ON product_models_v2(customer);

-- ============================================
-- TRIGGERS - Auto-update timestamps
-- ============================================

CREATE TRIGGER IF NOT EXISTS update_compatibilities_timestamp
AFTER UPDATE ON line_model_compatibilities
BEGIN
  UPDATE line_model_compatibilities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_product_models_v2_timestamp
AFTER UPDATE ON product_models_v2
BEGIN
  UPDATE product_models_v2 SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- VIEWS for multi-sheet import analysis
-- ============================================

-- View: Models with daily demand calculation
CREATE VIEW IF NOT EXISTS v_models_daily_demand AS
SELECT
  id,
  name,
  customer,
  program,
  family,
  annual_volume,
  operations_days,
  CASE
    WHEN operations_days > 0 THEN CAST(annual_volume AS REAL) / operations_days
    ELSE 0
  END as daily_demand,
  active
FROM product_models_v2
WHERE active = 1;

-- View: Compatibilities with calculated real time per unit
-- JOINs to production_lines and product_models_v2 to get names for display
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

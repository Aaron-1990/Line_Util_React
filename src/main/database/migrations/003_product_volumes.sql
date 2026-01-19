-- ============================================
-- MIGRATION 003: Multi-Year Product Volumes
-- Normalized volume storage supporting dynamic year ranges
-- Version: 3.0.0
-- ============================================

-- ============================================
-- PRODUCT VOLUMES TABLE
-- Stores annual volumes per model per year
-- Supports any year range (dynamic from Excel)
-- ============================================

CREATE TABLE IF NOT EXISTS product_volumes (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  year INTEGER NOT NULL CHECK(year >= 2000 AND year <= 2100),
  volume INTEGER NOT NULL DEFAULT 0 CHECK(volume >= 0),
  operations_days INTEGER NOT NULL DEFAULT 240 CHECK(operations_days >= 0 AND operations_days <= 366),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES product_models_v2(id) ON DELETE CASCADE,
  UNIQUE(model_id, year)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_volumes_model ON product_volumes(model_id);
CREATE INDEX IF NOT EXISTS idx_volumes_year ON product_volumes(year);
CREATE INDEX IF NOT EXISTS idx_volumes_model_year ON product_volumes(model_id, year);

-- ============================================
-- TRIGGER - Auto-update timestamp
-- ============================================

CREATE TRIGGER IF NOT EXISTS update_product_volumes_timestamp
AFTER UPDATE ON product_volumes
BEGIN
  UPDATE product_volumes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- VIEW - Volumes with daily demand calculation
-- ============================================

CREATE VIEW IF NOT EXISTS v_volumes_daily_demand AS
SELECT
  v.id,
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
  END as daily_demand
FROM product_volumes v
LEFT JOIN product_models_v2 m ON v.model_id = m.id
WHERE m.active = 1 OR m.active IS NULL;

-- ============================================
-- VIEW - Year range summary
-- ============================================

CREATE VIEW IF NOT EXISTS v_volume_year_summary AS
SELECT
  year,
  COUNT(DISTINCT model_id) as model_count,
  SUM(volume) as total_volume,
  AVG(operations_days) as avg_operations_days
FROM product_volumes
GROUP BY year
ORDER BY year;

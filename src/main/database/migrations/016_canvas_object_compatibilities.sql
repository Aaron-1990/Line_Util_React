-- ============================================
-- MIGRATION 016: Canvas Object Compatibilities
-- Adds canvas_object_compatibilities table for model assignments
-- Mirrors line_model_compatibilities but for canvas objects
-- Version: 7.5.1
-- ============================================

-- ============================================
-- CANVAS OBJECT COMPATIBILITIES TABLE
-- Stores which models can run on which canvas objects (process types)
-- Uses same structure as line_model_compatibilities for consistency
-- ============================================

CREATE TABLE IF NOT EXISTS canvas_object_compatibilities (
  id TEXT PRIMARY KEY,
  canvas_object_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  cycle_time INTEGER NOT NULL CHECK(cycle_time > 0),
  efficiency INTEGER NOT NULL CHECK(efficiency > 0 AND efficiency <= 100),
  priority INTEGER NOT NULL DEFAULT 1 CHECK(priority >= 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (canvas_object_id) REFERENCES canvas_objects(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES product_models_v2(id) ON DELETE CASCADE,
  UNIQUE(canvas_object_id, model_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_canvas_compat_object ON canvas_object_compatibilities(canvas_object_id);
CREATE INDEX IF NOT EXISTS idx_canvas_compat_model ON canvas_object_compatibilities(model_id);
CREATE INDEX IF NOT EXISTS idx_canvas_compat_priority ON canvas_object_compatibilities(canvas_object_id, priority);

-- ============================================
-- TRIGGER - Auto-update timestamps
-- ============================================

CREATE TRIGGER IF NOT EXISTS update_canvas_compat_timestamp
AFTER UPDATE ON canvas_object_compatibilities
BEGIN
  UPDATE canvas_object_compatibilities SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================
-- VIEW: Canvas Object Compatibilities with details
-- JOINs to canvas_objects and product_models_v2 for display
-- ============================================

CREATE VIEW IF NOT EXISTS v_canvas_object_compatibilities AS
SELECT
  c.id,
  c.canvas_object_id,
  c.model_id,
  co.name as object_name,
  co.object_type,
  m.name as model_name,
  m.family as model_family,
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
FROM canvas_object_compatibilities c
LEFT JOIN canvas_objects co ON c.canvas_object_id = co.id
LEFT JOIN product_models_v2 m ON c.model_id = m.id
WHERE (m.active = 1 OR m.active IS NULL) AND (co.active = 1 OR co.active IS NULL);

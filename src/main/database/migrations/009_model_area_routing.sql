-- ============================================
-- MIGRATION 009: Model Area Routing (DAG)
-- Phase 6.5 Enhancement: Support parallel process flows
-- Version: 6.5.0
-- ============================================

-- Table: model_area_routing
-- Stores which areas a model passes through with IE-recommended fields
CREATE TABLE IF NOT EXISTS model_area_routing (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  area_code TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,            -- Display order hint (not dependency order)
  is_required INTEGER NOT NULL DEFAULT 1,         -- Can this step be skipped? (1=required, 0=optional)
  expected_yield REAL NOT NULL DEFAULT 1.0,       -- Yield at this stage (0.0-1.0)
  volume_fraction REAL NOT NULL DEFAULT 1.0,      -- For split paths (0.0-1.0)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Constraints
  UNIQUE(model_id, area_code),
  CHECK(expected_yield >= 0.0 AND expected_yield <= 1.0),
  CHECK(volume_fraction >= 0.0 AND volume_fraction <= 1.0),

  -- Foreign keys
  FOREIGN KEY (model_id) REFERENCES product_models_v2(id) ON DELETE CASCADE
);

-- Table: model_area_predecessors
-- Stores predecessor relationships (edges in the DAG)
-- finish_to_start semantics: predecessor must complete before successor starts
CREATE TABLE IF NOT EXISTS model_area_predecessors (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  area_code TEXT NOT NULL,
  predecessor_area_code TEXT NOT NULL,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Constraints
  UNIQUE(model_id, area_code, predecessor_area_code),
  CHECK(area_code != predecessor_area_code),       -- Prevent self-references

  -- Foreign keys: cascade delete when routing step is removed
  FOREIGN KEY (model_id, area_code)
    REFERENCES model_area_routing(model_id, area_code) ON DELETE CASCADE,
  FOREIGN KEY (model_id, predecessor_area_code)
    REFERENCES model_area_routing(model_id, area_code) ON DELETE CASCADE
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_model_area_routing_model
  ON model_area_routing(model_id);

CREATE INDEX IF NOT EXISTS idx_model_area_routing_area
  ON model_area_routing(area_code);

CREATE INDEX IF NOT EXISTS idx_model_area_predecessors_model
  ON model_area_predecessors(model_id);

CREATE INDEX IF NOT EXISTS idx_model_area_predecessors_area
  ON model_area_predecessors(model_id, area_code);

CREATE INDEX IF NOT EXISTS idx_model_area_predecessors_pred
  ON model_area_predecessors(model_id, predecessor_area_code);

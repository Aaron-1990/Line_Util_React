-- ============================================
-- Migration 011: Model Plant Assignments
-- Phase 7 Sprint 6: Track model lifecycle at each plant
-- NOTE: launch_plant_id and primary_plant_id columns already added in migration 010
-- ============================================

-- ============================================
-- Model Plant Assignments (for tracking model lifecycle at each plant)
-- ============================================

CREATE TABLE IF NOT EXISTS model_plant_assignments (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES product_models_v2(id) ON DELETE CASCADE,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,

  -- Assignment type
  assignment_type TEXT NOT NULL DEFAULT 'primary' CHECK (assignment_type IN ('primary', 'secondary', 'overflow', 'backup')),

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('proposed', 'ramp_up', 'active', 'phasing_out', 'inactive')),

  -- Dates
  assignment_start_date TEXT,  -- When assignment was created
  production_start_date TEXT,  -- When production actually began
  phase_out_date TEXT,         -- When production ended/will end

  -- Transfer tracking
  transferred_from_plant_id TEXT REFERENCES plants(id),
  transfer_reason TEXT CHECK (transfer_reason IN ('capacity', 'cost', 'customer_request', 'closure', 'other')),

  -- Metadata
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Ensure unique model-plant combination
  UNIQUE(model_id, plant_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_mpa_model ON model_plant_assignments(model_id);
CREATE INDEX IF NOT EXISTS idx_mpa_plant ON model_plant_assignments(plant_id);
CREATE INDEX IF NOT EXISTS idx_mpa_status ON model_plant_assignments(status);

-- ============================================
-- View: Models with plant ownership info
-- ============================================

CREATE VIEW IF NOT EXISTS v_models_with_plants AS
SELECT
  m.id,
  m.name,
  m.customer,
  m.program,
  m.family,
  m.active,
  m.launch_plant_id,
  m.primary_plant_id,
  lp.code AS launch_plant_code,
  lp.name AS launch_plant_name,
  pp.code AS primary_plant_code,
  pp.name AS primary_plant_name,
  -- Ownership type derived
  CASE
    WHEN m.launch_plant_id = m.primary_plant_id AND
         (SELECT COUNT(*) FROM model_plant_assignments WHERE model_id = m.id AND status = 'active') <= 1
    THEN 'exclusive'
    WHEN m.launch_plant_id != m.primary_plant_id
    THEN 'transferred'
    ELSE 'shared'
  END AS ownership_type,
  -- Count of active plants
  (SELECT COUNT(*) FROM model_plant_assignments WHERE model_id = m.id AND status = 'active') AS active_plant_count
FROM product_models_v2 m
LEFT JOIN plants lp ON m.launch_plant_id = lp.id
LEFT JOIN plants pp ON m.primary_plant_id = pp.id;

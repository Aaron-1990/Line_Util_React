-- ============================================
-- Migration 015: Process Properties
-- Adds process_properties table for process objects
-- Allows processes to have their own production properties
-- instead of requiring a link to an existing production line
-- ============================================

-- Process Properties Table
-- Stores production-related properties for process canvas objects
CREATE TABLE IF NOT EXISTS process_properties (
  id TEXT PRIMARY KEY,
  canvas_object_id TEXT NOT NULL UNIQUE,

  -- Production properties (same as production_lines)
  area TEXT NOT NULL DEFAULT '',
  time_available_daily INTEGER NOT NULL DEFAULT 72000,  -- 20 hours in seconds
  line_type TEXT NOT NULL DEFAULT 'shared'
    CHECK(line_type IN ('shared', 'dedicated')),
  changeover_enabled INTEGER NOT NULL DEFAULT 1,
  changeover_explicit INTEGER NOT NULL DEFAULT 0,  -- Phase 7.5: explicit user override flag

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign keys
  FOREIGN KEY (canvas_object_id) REFERENCES canvas_objects(id) ON DELETE CASCADE
);

-- Index for fast lookups by canvas object
CREATE INDEX IF NOT EXISTS idx_process_properties_canvas_object
  ON process_properties(canvas_object_id);

-- Index for area queries (useful for area-based filtering)
CREATE INDEX IF NOT EXISTS idx_process_properties_area
  ON process_properties(area);

-- View to get process objects with their properties
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
  -- Also include linked line info for backward compatibility
  pll.production_line_id,
  pl.name as linked_line_name
FROM canvas_objects co
LEFT JOIN process_properties pp ON co.id = pp.canvas_object_id
LEFT JOIN process_line_links pll ON co.id = pll.canvas_object_id
LEFT JOIN production_lines pl ON pll.production_line_id = pl.id
WHERE co.object_type = 'process' AND co.active = 1;

-- ============================================
-- Migration 014: Polymorphic Connections
-- Allow canvas_connections to connect any node type
-- (canvas_objects AND production_lines)
-- Also fixes bug in v_process_objects_with_lines view
-- ============================================

-- First, fix the broken view that references wrong column name
-- (time_available_seconds should be time_available_daily)
DROP VIEW IF EXISTS v_process_objects_with_lines;

CREATE VIEW v_process_objects_with_lines AS
SELECT
  co.id,
  co.plant_id,
  co.name as object_name,
  co.x_position,
  co.y_position,
  pll.production_line_id,
  pl.name as line_name,
  pl.area as line_area,
  pl.time_available_daily
FROM canvas_objects co
LEFT JOIN process_line_links pll ON co.id = pll.canvas_object_id
LEFT JOIN production_lines pl ON pll.production_line_id = pl.id
WHERE co.object_type = 'process' AND co.active = 1;

-- Clean up any partial state from failed previous attempt
DROP TABLE IF EXISTS canvas_connections_new;

-- Check if canvas_connections exists, if not create it fresh
-- This handles the case where previous migration attempt failed midway
CREATE TABLE IF NOT EXISTS canvas_connections (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  source_anchor TEXT,
  target_object_id TEXT NOT NULL,
  target_anchor TEXT,
  connection_type TEXT NOT NULL DEFAULT 'flow'
    CHECK(connection_type IN ('flow', 'info', 'material')),
  label TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
);

-- Now create the new table structure (without restrictive foreign keys)
CREATE TABLE canvas_connections_new (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,

  -- Source endpoint (can be canvas_object OR production_line)
  source_object_id TEXT NOT NULL,
  source_anchor TEXT,

  -- Target endpoint (can be canvas_object OR production_line)
  target_object_id TEXT NOT NULL,
  target_anchor TEXT,

  -- Connection metadata
  connection_type TEXT NOT NULL DEFAULT 'flow'
    CHECK(connection_type IN ('flow', 'info', 'material')),
  label TEXT,

  -- Control
  active INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Only keep plant foreign key (not object foreign keys)
  -- This allows connecting production_lines which aren't in canvas_objects
  FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
);

-- Copy existing data (if any)
INSERT OR IGNORE INTO canvas_connections_new
SELECT * FROM canvas_connections;

-- Drop old table
DROP TABLE canvas_connections;

-- Rename new table
ALTER TABLE canvas_connections_new RENAME TO canvas_connections;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_canvas_connections_plant ON canvas_connections(plant_id);
CREATE INDEX IF NOT EXISTS idx_canvas_connections_source ON canvas_connections(source_object_id);
CREATE INDEX IF NOT EXISTS idx_canvas_connections_target ON canvas_connections(target_object_id);
CREATE INDEX IF NOT EXISTS idx_canvas_connections_plant_active ON canvas_connections(plant_id, active);

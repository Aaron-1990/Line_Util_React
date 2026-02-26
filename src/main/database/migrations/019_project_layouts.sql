-- ============================================
-- MIGRATION 019: Project Layouts
-- PHASE: 8.5 - Canvas Background Layouts
-- BREAKING CHANGE: NO
-- BACKWARD COMPATIBLE: YES (only adds table)
-- ============================================

CREATE TABLE IF NOT EXISTS project_layouts (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image_data TEXT NOT NULL,          -- base64 data URI (PNG/JPG) or SVG string
  source_format TEXT NOT NULL,       -- 'png', 'jpg', 'svg', 'dxf', 'pdf'
  x_position REAL DEFAULT 0,
  y_position REAL DEFAULT 0,
  width REAL NOT NULL,
  height REAL NOT NULL,
  opacity REAL DEFAULT 0.5,
  locked INTEGER DEFAULT 0,
  visible INTEGER DEFAULT 1,
  z_index INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_layouts_plant_id
  ON project_layouts(plant_id);

CREATE INDEX IF NOT EXISTS idx_project_layouts_active
  ON project_layouts(active);

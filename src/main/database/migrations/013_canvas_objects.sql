-- ============================================
-- MIGRATION 013: Canvas Objects
-- Phase 7.5: Polymorphic canvas object instances
-- Version: 7.5.0
-- ============================================
--
-- This migration introduces the Canvas Objects system:
-- 1. Canvas objects as shape instances with functional types
-- 2. Type-specific property tables (buffer_properties)
-- 3. Process-to-ProductionLine linking
-- 4. Object-to-object connections (edges)
--
-- Data Model:
--   plants → canvas_objects → shape_catalog
--                ↓
--          buffer_properties (for type='buffer')
--          process_line_links (for type='process')
--                ↓
--          canvas_connections (edges)
--
-- Object Types:
--   - generic: Basic shape with no special behavior
--   - process: Linked to a production_line for capacity analysis
--   - buffer: WIP storage with capacity properties
--   - source: Material/demand entry point
--   - sink: Finished goods exit point
--   - quality_gate: Inspection/quality checkpoint
-- ============================================

-- ============================================
-- PHASE 1: Canvas Objects Table
-- Instances of shapes placed on the canvas
-- ============================================

CREATE TABLE IF NOT EXISTS canvas_objects (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,

  -- Reference to shape definition
  shape_id TEXT NOT NULL,

  -- Functional type (determines available properties)
  object_type TEXT NOT NULL DEFAULT 'generic'
    CHECK(object_type IN ('generic', 'process', 'buffer', 'source', 'sink', 'quality_gate')),

  -- Identification
  name TEXT NOT NULL,
  description TEXT,

  -- Canvas position and dimensions
  x_position REAL NOT NULL DEFAULT 0,
  y_position REAL NOT NULL DEFAULT 0,
  width REAL,                                    -- NULL = use shape default
  height REAL,                                   -- NULL = use shape default
  rotation REAL NOT NULL DEFAULT 0,              -- Degrees (0-360)

  -- Visual customization
  color_override TEXT,                           -- Hex color, NULL = use type default

  -- Control flags
  active INTEGER NOT NULL DEFAULT 1,             -- Soft delete
  locked INTEGER NOT NULL DEFAULT 0,             -- Prevent editing
  z_index INTEGER NOT NULL DEFAULT 0,            -- Stacking order

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign keys
  FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
  FOREIGN KEY (shape_id) REFERENCES shape_catalog(id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_canvas_objects_plant ON canvas_objects(plant_id);
CREATE INDEX IF NOT EXISTS idx_canvas_objects_plant_active ON canvas_objects(plant_id, active);
CREATE INDEX IF NOT EXISTS idx_canvas_objects_type ON canvas_objects(object_type);
CREATE INDEX IF NOT EXISTS idx_canvas_objects_shape ON canvas_objects(shape_id);

-- Trigger: Auto-update timestamp
CREATE TRIGGER IF NOT EXISTS update_canvas_objects_timestamp
AFTER UPDATE ON canvas_objects
BEGIN
  UPDATE canvas_objects SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================
-- PHASE 2: Buffer Properties Table
-- Extended properties for object_type = 'buffer'
-- ============================================

CREATE TABLE IF NOT EXISTS buffer_properties (
  id TEXT PRIMARY KEY,
  canvas_object_id TEXT NOT NULL UNIQUE,

  -- Capacity settings
  max_capacity INTEGER NOT NULL DEFAULT 100      -- Maximum units the buffer can hold
    CHECK(max_capacity > 0),
  buffer_time_hours REAL NOT NULL DEFAULT 4.0    -- Target coverage time in hours
    CHECK(buffer_time_hours >= 0),

  -- Runtime state (for simulation)
  current_wip INTEGER NOT NULL DEFAULT 0         -- Current work-in-progress count
    CHECK(current_wip >= 0),

  -- Behavior settings
  fifo_enforced INTEGER NOT NULL DEFAULT 1,      -- First-In-First-Out discipline
  overflow_policy TEXT NOT NULL DEFAULT 'block'  -- What happens when full
    CHECK(overflow_policy IN ('block', 'overflow', 'alert')),

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign key with cascade delete
  FOREIGN KEY (canvas_object_id) REFERENCES canvas_objects(id) ON DELETE CASCADE
);

-- Trigger: Auto-update timestamp
CREATE TRIGGER IF NOT EXISTS update_buffer_properties_timestamp
AFTER UPDATE ON buffer_properties
BEGIN
  UPDATE buffer_properties SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================
-- PHASE 3: Process Line Links Table
-- Links canvas objects (type='process') to production_lines
-- ============================================

CREATE TABLE IF NOT EXISTS process_line_links (
  id TEXT PRIMARY KEY,
  canvas_object_id TEXT NOT NULL UNIQUE,

  -- Linked production line (can be NULL if not yet linked)
  production_line_id TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign keys
  FOREIGN KEY (canvas_object_id) REFERENCES canvas_objects(id) ON DELETE CASCADE,
  FOREIGN KEY (production_line_id) REFERENCES production_lines(id) ON DELETE SET NULL
);

-- Index for reverse lookup (find canvas object from line)
CREATE INDEX IF NOT EXISTS idx_process_line_links_line ON process_line_links(production_line_id);

-- ============================================
-- PHASE 4: Canvas Connections Table
-- Edges between canvas objects (material/info flow)
-- ============================================

CREATE TABLE IF NOT EXISTS canvas_connections (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,

  -- Source endpoint
  source_object_id TEXT NOT NULL,
  source_anchor TEXT,                            -- Anchor name (e.g., 'right', 'output')

  -- Target endpoint
  target_object_id TEXT NOT NULL,
  target_anchor TEXT,                            -- Anchor name (e.g., 'left', 'input')

  -- Connection metadata
  connection_type TEXT NOT NULL DEFAULT 'flow'   -- Semantic type of connection
    CHECK(connection_type IN ('flow', 'info', 'material')),
  label TEXT,                                    -- Optional label for display

  -- Control
  active INTEGER NOT NULL DEFAULT 1,             -- Soft delete

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign keys
  FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
  FOREIGN KEY (source_object_id) REFERENCES canvas_objects(id) ON DELETE CASCADE,
  FOREIGN KEY (target_object_id) REFERENCES canvas_objects(id) ON DELETE CASCADE
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_canvas_connections_plant ON canvas_connections(plant_id);
CREATE INDEX IF NOT EXISTS idx_canvas_connections_source ON canvas_connections(source_object_id);
CREATE INDEX IF NOT EXISTS idx_canvas_connections_target ON canvas_connections(target_object_id);
CREATE INDEX IF NOT EXISTS idx_canvas_connections_plant_active ON canvas_connections(plant_id, active);

-- ============================================
-- PHASE 5: Views for Common Queries
-- ============================================

-- View: Canvas objects with shape details
CREATE VIEW IF NOT EXISTS v_canvas_objects_full AS
SELECT
  co.id,
  co.plant_id,
  p.code as plant_code,
  p.name as plant_name,
  co.shape_id,
  sc.name as shape_name,
  sc.render_type,
  sc.primitive_type,
  sc.svg_content,
  COALESCE(co.width, sc.default_width) as effective_width,
  COALESCE(co.height, sc.default_height) as effective_height,
  co.object_type,
  co.name,
  co.description,
  co.x_position,
  co.y_position,
  co.rotation,
  co.color_override,
  co.active,
  co.locked,
  co.z_index,
  co.created_at,
  co.updated_at
FROM canvas_objects co
JOIN plants p ON co.plant_id = p.id
JOIN shape_catalog sc ON co.shape_id = sc.id
WHERE co.active = 1;

-- View: Process objects with linked line details
CREATE VIEW IF NOT EXISTS v_process_objects_with_lines AS
SELECT
  co.id,
  co.plant_id,
  co.name as object_name,
  co.x_position,
  co.y_position,
  pll.production_line_id,
  pl.name as line_name,
  pl.area as line_area,
  pl.time_available_seconds
FROM canvas_objects co
LEFT JOIN process_line_links pll ON co.id = pll.canvas_object_id
LEFT JOIN production_lines pl ON pll.production_line_id = pl.id
WHERE co.object_type = 'process' AND co.active = 1;

-- View: Buffer objects with properties
CREATE VIEW IF NOT EXISTS v_buffer_objects_with_props AS
SELECT
  co.id,
  co.plant_id,
  co.name as object_name,
  co.x_position,
  co.y_position,
  bp.max_capacity,
  bp.buffer_time_hours,
  bp.current_wip,
  bp.fifo_enforced,
  bp.overflow_policy,
  CASE
    WHEN bp.max_capacity > 0 THEN ROUND(CAST(bp.current_wip AS REAL) / bp.max_capacity * 100, 1)
    ELSE 0
  END as utilization_percent
FROM canvas_objects co
LEFT JOIN buffer_properties bp ON co.id = bp.canvas_object_id
WHERE co.object_type = 'buffer' AND co.active = 1;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
--
-- Summary of changes:
-- - Created: canvas_objects table (main object instances)
-- - Created: buffer_properties table (buffer-specific properties)
-- - Created: process_line_links table (process-to-line mapping)
-- - Created: canvas_connections table (edges between objects)
-- - Created: Views for full object details, process objects, buffer objects
-- - Indexes for plant, type, shape, and connection lookups
-- - Auto-update triggers for canvas_objects and buffer_properties
--
-- Next steps (application code):
-- 1. Create SQLiteCanvasObjectRepository
-- 2. Create canvas-objects.handler.ts IPC handlers
-- 3. Create useCanvasObjectStore Zustand store
-- 4. Create GenericShapeNode ReactFlow component
-- 5. Create ContextMenu for type conversion
-- 6. Create ObjectPropertiesPanel for editing
-- ============================================

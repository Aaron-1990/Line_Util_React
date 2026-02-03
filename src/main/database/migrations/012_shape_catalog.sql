-- ============================================
-- MIGRATION 012: Shape Catalog
-- Phase 7.5: Extensible shape system for canvas objects
-- Version: 7.5.0
-- ============================================
--
-- This migration introduces the Shape Catalog system:
-- 1. Shape categories for organization
-- 2. Shape definitions with multiple render types
-- 3. Connection anchors for each shape
-- 4. Built-in basic shapes as initial data
--
-- Data Model:
--   shape_categories → shape_catalog → shape_anchors
--
-- Future extensibility:
--   - Import from SVG, DXF (AutoCAD), images
--   - AI-generated shapes
--   - User-created custom shapes
-- ============================================

-- ============================================
-- PHASE 1: Shape Categories Table
-- Organizes shapes into browsable groups
-- ============================================

CREATE TABLE IF NOT EXISTS shape_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  icon TEXT,                                     -- Lucide icon name for UI
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for ordered display
CREATE INDEX IF NOT EXISTS idx_shape_categories_order ON shape_categories(display_order);

-- ============================================
-- PHASE 2: Shape Catalog Table
-- Stores all available shape definitions
-- ============================================

CREATE TABLE IF NOT EXISTS shape_catalog (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Source tracking for imported/generated shapes
  source TEXT NOT NULL DEFAULT 'builtin'
    CHECK(source IN ('builtin', 'imported', 'ai_generated', 'user')),
  source_file TEXT,                              -- Original file path for imports

  -- Rendering method (exactly one of the content fields should be populated)
  render_type TEXT NOT NULL DEFAULT 'svg'
    CHECK(render_type IN ('svg', 'image', 'path', 'primitive')),
  svg_content TEXT,                              -- Full SVG or path data
  image_url TEXT,                                -- URL or data URI for images
  primitive_type TEXT                            -- For render_type='primitive'
    CHECK(primitive_type IS NULL OR primitive_type IN ('rectangle', 'triangle', 'circle', 'diamond')),

  -- Default dimensions
  default_width REAL DEFAULT 200,
  default_height REAL DEFAULT 100,

  -- Display metadata
  thumbnail_svg TEXT,                            -- Miniature preview for toolbar/browser

  -- Control flags
  is_active INTEGER NOT NULL DEFAULT 1,          -- Soft delete
  is_favorite INTEGER NOT NULL DEFAULT 0,        -- User favorites
  usage_count INTEGER NOT NULL DEFAULT 0,        -- Track popularity

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Foreign key to category
  FOREIGN KEY (category_id) REFERENCES shape_categories(id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_shape_catalog_category ON shape_catalog(category_id);
CREATE INDEX IF NOT EXISTS idx_shape_catalog_source ON shape_catalog(source);
CREATE INDEX IF NOT EXISTS idx_shape_catalog_active ON shape_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_shape_catalog_favorite ON shape_catalog(is_favorite) WHERE is_favorite = 1;

-- Trigger: Auto-update timestamp
CREATE TRIGGER IF NOT EXISTS update_shape_catalog_timestamp
AFTER UPDATE ON shape_catalog
BEGIN
  UPDATE shape_catalog SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================
-- PHASE 3: Shape Anchors Table
-- Connection points for edges between objects
-- ============================================

CREATE TABLE IF NOT EXISTS shape_anchors (
  id TEXT PRIMARY KEY,
  shape_id TEXT NOT NULL,
  name TEXT,                                     -- 'input', 'output', 'top', 'bottom-left', etc.
  position TEXT NOT NULL                         -- Primary position hint
    CHECK(position IN ('top', 'right', 'bottom', 'left')),
  offset_x REAL NOT NULL DEFAULT 0.5             -- Relative X (0-1, left to right)
    CHECK(offset_x >= 0 AND offset_x <= 1),
  offset_y REAL NOT NULL DEFAULT 0.5             -- Relative Y (0-1, top to bottom)
    CHECK(offset_y >= 0 AND offset_y <= 1),
  is_input INTEGER NOT NULL DEFAULT 1,           -- Can receive connections
  is_output INTEGER NOT NULL DEFAULT 1,          -- Can source connections

  -- Foreign key with cascade delete
  FOREIGN KEY (shape_id) REFERENCES shape_catalog(id) ON DELETE CASCADE
);

-- Index for shape lookup
CREATE INDEX IF NOT EXISTS idx_shape_anchors_shape ON shape_anchors(shape_id);

-- ============================================
-- PHASE 4: Insert Initial Data - Categories
-- ============================================

INSERT INTO shape_categories (id, name, display_order, icon) VALUES
  ('basic', 'Basic Shapes', 1, 'Shapes'),
  ('machines', 'Machines & Equipment', 2, 'Cog'),
  ('flow', 'Flow Control', 3, 'GitBranch'),
  ('custom', 'Custom', 99, 'Sparkles');

-- ============================================
-- PHASE 5: Insert Initial Data - Basic Shapes
-- ============================================

INSERT INTO shape_catalog (id, category_id, name, description, source, render_type, primitive_type, default_width, default_height) VALUES
  ('rect-basic', 'basic', 'Rectangle', 'Standard rectangular shape for general use', 'builtin', 'primitive', 'rectangle', 200, 100),
  ('triangle-basic', 'basic', 'Triangle', 'Triangular shape for decision points or flow direction', 'builtin', 'primitive', 'triangle', 200, 120),
  ('circle-basic', 'basic', 'Circle', 'Circular shape for nodes or junctions', 'builtin', 'primitive', 'circle', 120, 120),
  ('diamond-basic', 'basic', 'Diamond', 'Diamond shape for decision or inspection points', 'builtin', 'primitive', 'diamond', 120, 120);

-- ============================================
-- PHASE 6: Insert Initial Data - Shape Anchors
-- ============================================

-- Rectangle anchors (4 sides)
INSERT INTO shape_anchors (id, shape_id, name, position, offset_x, offset_y, is_input, is_output) VALUES
  ('rect-top', 'rect-basic', 'top', 'top', 0.5, 0, 1, 1),
  ('rect-bottom', 'rect-basic', 'bottom', 'bottom', 0.5, 1, 1, 1),
  ('rect-left', 'rect-basic', 'left', 'left', 0, 0.5, 1, 1),
  ('rect-right', 'rect-basic', 'right', 'right', 1, 0.5, 1, 1);

-- Triangle anchors (top point, two bottom corners)
INSERT INTO shape_anchors (id, shape_id, name, position, offset_x, offset_y, is_input, is_output) VALUES
  ('tri-top', 'triangle-basic', 'top', 'top', 0.5, 0, 1, 1),
  ('tri-bottom-left', 'triangle-basic', 'bottom-left', 'bottom', 0.25, 1, 1, 1),
  ('tri-bottom-right', 'triangle-basic', 'bottom-right', 'bottom', 0.75, 1, 1, 1);

-- Circle anchors (4 cardinal points)
INSERT INTO shape_anchors (id, shape_id, name, position, offset_x, offset_y, is_input, is_output) VALUES
  ('circle-top', 'circle-basic', 'top', 'top', 0.5, 0, 1, 1),
  ('circle-bottom', 'circle-basic', 'bottom', 'bottom', 0.5, 1, 1, 1),
  ('circle-left', 'circle-basic', 'left', 'left', 0, 0.5, 1, 1),
  ('circle-right', 'circle-basic', 'right', 'right', 1, 0.5, 1, 1);

-- Diamond anchors (4 points)
INSERT INTO shape_anchors (id, shape_id, name, position, offset_x, offset_y, is_input, is_output) VALUES
  ('diamond-top', 'diamond-basic', 'top', 'top', 0.5, 0, 1, 1),
  ('diamond-bottom', 'diamond-basic', 'bottom', 'bottom', 0.5, 1, 1, 1),
  ('diamond-left', 'diamond-basic', 'left', 'left', 0, 0.5, 1, 1),
  ('diamond-right', 'diamond-basic', 'right', 'right', 1, 0.5, 1, 1);

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
--
-- Summary of changes:
-- - Created: shape_categories table (4 initial categories)
-- - Created: shape_catalog table (4 basic shapes)
-- - Created: shape_anchors table (15 anchors for basic shapes)
-- - Indexes for category, source, active, favorite lookups
-- - Auto-update trigger for shape_catalog
--
-- Next steps (application code):
-- 1. Create SQLiteShapeCatalogRepository
-- 2. Create shape-catalog.handler.ts IPC handlers
-- 3. Create useShapeCatalogStore Zustand store
-- 4. Create ObjectPalette and ShapeBrowserModal components
-- ============================================

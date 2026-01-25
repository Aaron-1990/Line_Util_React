-- ============================================
-- LINE OPTIMIZER - INITIAL DATABASE SCHEMA
-- Version: 1.0.0
-- ============================================

-- ============================================
-- AREA CATALOG (Configurable)
-- ============================================

CREATE TABLE IF NOT EXISTS area_catalog (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_area_catalog_code ON area_catalog(code);
CREATE INDEX IF NOT EXISTS idx_area_catalog_active ON area_catalog(active);

-- ============================================
-- PRODUCTION LINES
-- ============================================

CREATE TABLE IF NOT EXISTS production_lines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  time_available_daily INTEGER NOT NULL,
  active BOOLEAN DEFAULT 1,
  x_position REAL DEFAULT 0,
  y_position REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (area) REFERENCES area_catalog(code) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_production_lines_name ON production_lines(name) WHERE active = 1;
CREATE INDEX IF NOT EXISTS idx_production_lines_area ON production_lines(area);
CREATE INDEX IF NOT EXISTS idx_production_lines_active ON production_lines(active);

-- ============================================
-- PRODUCT MODELS
-- ============================================

CREATE TABLE IF NOT EXISTS product_models (
  id TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  name TEXT NOT NULL,
  bu TEXT NOT NULL,
  area TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  efficiency REAL NOT NULL CHECK(efficiency > 0 AND efficiency <= 1),
  compatible_lines TEXT NOT NULL DEFAULT '[]',
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (area) REFERENCES area_catalog(code) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_product_models_family ON product_models(family);
CREATE INDEX IF NOT EXISTS idx_product_models_area ON product_models(area);
CREATE INDEX IF NOT EXISTS idx_product_models_active ON product_models(active);
CREATE INDEX IF NOT EXISTS idx_product_models_priority ON product_models(priority);

-- ============================================
-- MODEL PROCESSES
-- ============================================

CREATE TABLE IF NOT EXISTS model_processes (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  name TEXT NOT NULL,
  cycle_time INTEGER NOT NULL,
  quantity_per_product INTEGER NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES product_models(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_model_processes_model_id ON model_processes(model_id);
CREATE INDEX IF NOT EXISTS idx_model_processes_sequence ON model_processes(model_id, sequence);

-- ============================================
-- LINE-MODEL ASSIGNMENTS (Many-to-Many)
-- ============================================

CREATE TABLE IF NOT EXISTS line_model_assignments (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (line_id) REFERENCES production_lines(id) ON DELETE CASCADE,
  FOREIGN KEY (model_id) REFERENCES product_models(id) ON DELETE CASCADE,
  UNIQUE(line_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_line_id ON line_model_assignments(line_id);
CREATE INDEX IF NOT EXISTS idx_assignments_model_id ON line_model_assignments(model_id);

-- ============================================
-- PRODUCTION VOLUMES
-- ============================================

CREATE TABLE IF NOT EXISTS production_volumes (
  id TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  days_of_operation INTEGER NOT NULL CHECK(days_of_operation > 0 AND days_of_operation <= 365),
  year INTEGER NOT NULL CHECK(year >= 2024),
  quantity INTEGER NOT NULL CHECK(quantity >= 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(family, year)
);

CREATE INDEX IF NOT EXISTS idx_production_volumes_family ON production_volumes(family);
CREATE INDEX IF NOT EXISTS idx_production_volumes_year ON production_volumes(year);
CREATE INDEX IF NOT EXISTS idx_production_volumes_family_year ON production_volumes(family, year);

-- ============================================
-- CANVAS AREAS (Visual grouping)
-- ============================================

CREATE TABLE IF NOT EXISTS canvas_areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  area_code TEXT NOT NULL,
  x_position REAL DEFAULT 0,
  y_position REAL DEFAULT 0,
  width REAL DEFAULT 400,
  height REAL DEFAULT 300,
  color TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (area_code) REFERENCES area_catalog(code) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_canvas_areas_code ON canvas_areas(area_code);

-- ============================================
-- ANALYSIS RUNS (Historical analysis results)
-- ============================================

CREATE TABLE IF NOT EXISTS analysis_runs (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  summary_json TEXT NOT NULL,
  results_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_year ON analysis_runs(year);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_created ON analysis_runs(created_at DESC);

-- ============================================
-- TRIGGERS - Auto-update timestamps
-- ============================================

CREATE TRIGGER IF NOT EXISTS update_area_catalog_timestamp
AFTER UPDATE ON area_catalog
BEGIN
  UPDATE area_catalog SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_production_lines_timestamp
AFTER UPDATE ON production_lines
BEGIN
  UPDATE production_lines SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_product_models_timestamp
AFTER UPDATE ON product_models
BEGIN
  UPDATE product_models SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_model_processes_timestamp
AFTER UPDATE ON model_processes
BEGIN
  UPDATE model_processes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_production_volumes_timestamp
AFTER UPDATE ON production_volumes
BEGIN
  UPDATE production_volumes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_canvas_areas_timestamp
AFTER UPDATE ON canvas_areas
BEGIN
  UPDATE canvas_areas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- TRIGGERS - Sync compatible_lines field
-- ============================================

CREATE TRIGGER IF NOT EXISTS sync_compatible_lines_on_insert
AFTER INSERT ON line_model_assignments
BEGIN
  UPDATE product_models
  SET compatible_lines = (
    SELECT json_group_array(line_id)
    FROM line_model_assignments
    WHERE model_id = NEW.model_id
  )
  WHERE id = NEW.model_id;
END;

CREATE TRIGGER IF NOT EXISTS sync_compatible_lines_on_delete
AFTER DELETE ON line_model_assignments
BEGIN
  UPDATE product_models
  SET compatible_lines = (
    SELECT COALESCE(json_group_array(line_id), '[]')
    FROM line_model_assignments
    WHERE model_id = OLD.model_id
  )
  WHERE id = OLD.model_id;
END;

-- ============================================
-- VIEWS - Query optimization
-- ============================================

CREATE VIEW IF NOT EXISTS v_active_lines AS
SELECT * FROM production_lines WHERE active = 1;

CREATE VIEW IF NOT EXISTS v_active_models AS
SELECT * FROM product_models WHERE active = 1;

CREATE VIEW IF NOT EXISTS v_models_with_processes AS
SELECT 
  m.*,
  COUNT(p.id) as process_count,
  SUM(p.cycle_time * p.quantity_per_product) as total_cycle_time
FROM product_models m
LEFT JOIN model_processes p ON m.id = p.model_id
GROUP BY m.id;

CREATE VIEW IF NOT EXISTS v_line_utilization_summary AS
SELECT 
  pl.id,
  pl.name,
  pl.area,
  pl.time_available_daily,
  COUNT(lma.model_id) as assigned_models_count
FROM production_lines pl
LEFT JOIN line_model_assignments lma ON pl.id = lma.line_id
WHERE pl.active = 1
GROUP BY pl.id;

-- ============================================
-- SEED DATA - Default area catalog
-- ============================================

INSERT OR IGNORE INTO area_catalog (id, code, name, color, active) VALUES
  ('area-ict', 'ICT', 'ICT', '#60a5fa', 1),
  ('area-smt', 'SMT', 'SMT', '#34d399', 1),
  ('area-wave', 'WAVE', 'Wave Solder', '#fbbf24', 1),
  ('area-assembly', 'ASSEMBLY', 'Manual Assembly', '#f472b6', 1),
  ('area-test', 'TEST', 'Testing', '#a78bfa', 1);

-- ============================================
-- PRAGMA SETTINGS
-- ============================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -64000;

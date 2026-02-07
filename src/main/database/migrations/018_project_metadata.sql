-- ============================================
-- MIGRATION 018: Project Metadata
-- PHASE: 8.0 - Project Files Foundation
-- BREAKING CHANGE: NO
-- BACKWARD COMPATIBLE: YES (only adds table)
-- ============================================

CREATE TABLE IF NOT EXISTS project_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Create index for faster lookups (optimization)
CREATE INDEX IF NOT EXISTS idx_project_metadata_updated
  ON project_metadata(updated_at);

-- Seed default metadata
-- Note: app_version and schema_version will be set by ProjectFileService
INSERT OR IGNORE INTO project_metadata (key, value) VALUES
  ('project_name', 'Untitled Project'),
  ('description', ''),
  ('created_at', datetime('now')),
  ('last_modified_at', datetime('now'));

-- Add comment for future developers
-- SQLite doesn't support COMMENT ON, so we document in migration file:
--
-- project_metadata stores key-value pairs for:
--   - app_version: Semantic version (e.g., "0.8.0")
--   - schema_version: Migration number (e.g., "18")
--   - created_at: UTC timestamp of project creation
--   - last_modified_at: UTC timestamp of last save
--   - last_modified_by: App version that last saved this project
--   - project_name: User-defined project name
--   - description: Optional project description

-- ============================================
-- MIGRATION 020: Layout Image Enhanced Controls
-- Phase 8.5b: Adds rotation, original dimensions, aspect ratio lock
-- ============================================

ALTER TABLE project_layouts ADD COLUMN rotation REAL NOT NULL DEFAULT 0;
ALTER TABLE project_layouts ADD COLUMN original_width REAL;
ALTER TABLE project_layouts ADD COLUMN original_height REAL;
ALTER TABLE project_layouts ADD COLUMN aspect_ratio_locked INTEGER NOT NULL DEFAULT 1;

-- Backfill original dimensions for existing rows
UPDATE project_layouts
SET original_width = width,
    original_height = height
WHERE original_width IS NULL;

-- Migration 021: Non-destructive crop columns for layout images (Phase 8.5c)
-- NULL = no crop applied (backward compatible, existing rows unaffected)
ALTER TABLE project_layouts ADD COLUMN crop_x REAL DEFAULT NULL;
ALTER TABLE project_layouts ADD COLUMN crop_y REAL DEFAULT NULL;
ALTER TABLE project_layouts ADD COLUMN crop_w REAL DEFAULT NULL;
ALTER TABLE project_layouts ADD COLUMN crop_h REAL DEFAULT NULL;

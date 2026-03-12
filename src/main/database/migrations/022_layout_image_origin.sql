-- Migration 022: Primary geometry fields for layout images (Phase 8.5c Phase 2)
-- Stores imageOriginX/Y (canvas position of full uncropped image TL) and
-- imageScale (CSS px per image px) as primary fields.
-- xPosition/yPosition/width/height become derived (computed by deriveBounds()).
-- NULL = legacy row; mapRowToEntity auto-computes from stored position/size.
ALTER TABLE project_layouts ADD COLUMN image_origin_x REAL DEFAULT NULL;
ALTER TABLE project_layouts ADD COLUMN image_origin_y REAL DEFAULT NULL;
ALTER TABLE project_layouts ADD COLUMN image_scale    REAL DEFAULT NULL;

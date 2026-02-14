-- ============================================
-- MIGRATION 004: Line Type and Area Sequence
-- Adds line_type to production_lines (shared/dedicated)
-- Adds sequence to area_catalog for process ordering
-- Version: 4.0.0
-- ============================================

-- ============================================
-- PRODUCTION LINES - Add line_type column
-- ============================================

-- Add line_type column (shared or dedicated)
-- 'shared' = line can handle any compatible model (pool of resources)
-- 'dedicated' = line is dedicated to specific models/family
ALTER TABLE production_lines ADD COLUMN line_type TEXT DEFAULT 'shared' CHECK(line_type IN ('shared', 'dedicated'));

-- Create index for filtering by line type
CREATE INDEX IF NOT EXISTS idx_production_lines_type ON production_lines(line_type);

-- ============================================
-- AREA CATALOG - Add sequence column
-- ============================================

-- Add sequence column for process ordering (upstream to downstream)
-- 1 = first process (e.g., SMT)
-- Higher numbers = later processes (e.g., Final Assembly)
ALTER TABLE area_catalog ADD COLUMN sequence INTEGER DEFAULT 0;

-- Create index for ordering by sequence
CREATE INDEX IF NOT EXISTS idx_area_catalog_sequence ON area_catalog(sequence);

-- ============================================
-- UPDATE DEFAULT AREAS WITH TYPICAL SEQUENCE
-- Users can modify via Excel import or UI
-- ============================================

-- No default area sequence - app is industry-agnostic
-- Users define their own areas and sequences based on their manufacturing process flow
-- (Removed default electronics manufacturing sequence)

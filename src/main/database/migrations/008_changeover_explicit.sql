-- ============================================
-- MIGRATION 008: Changeover Explicit Override
-- Phase 5.6 Enhancement: Track explicit per-line overrides
-- Version: 5.6.1
-- ============================================

-- Add column to track if user explicitly set the changeover toggle
-- NULL or 0 = follows global setting (default behavior)
-- 1 = user explicitly set this toggle (true override)
ALTER TABLE production_lines ADD COLUMN changeover_explicit INTEGER DEFAULT 0;

-- Reset all existing lines to follow global (no explicit override)
-- This preserves backward compatibility
UPDATE production_lines SET changeover_explicit = 0;

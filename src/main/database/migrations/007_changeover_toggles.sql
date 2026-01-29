-- ============================================
-- MIGRATION 007: Changeover Toggle Controls
-- Phase 5.6: Enable/disable changeover at global and per-line level
-- Version: 5.6.0
-- ============================================

-- ============================================
-- PER-LINE TOGGLE
-- Default: ON (changeover enabled by default)
-- ============================================

ALTER TABLE production_lines ADD COLUMN changeover_enabled INTEGER DEFAULT 1;

-- ============================================
-- GLOBAL TOGGLE IN USER_PREFERENCES
-- Default: ON (changeover enabled globally by default)
-- ============================================

INSERT OR IGNORE INTO user_preferences (id, key, value, description)
VALUES (
    'pref-changeover-global-enabled',
    'changeover_global_enabled',
    '1',
    'Global toggle for changeover calculation (1=ON, 0=OFF). When OFF, only lines with explicit override ON calculate changeover.'
);

-- ============================================
-- MIGRATION 005: Changeover Matrix
-- Phase 5: Model changeover time management
-- Three-tier resolution: Global → Family → Line Override
-- Version: 5.0.0
-- ============================================

-- ============================================
-- USER PREFERENCES TABLE
-- Stores global settings including default changeover time
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert global default changeover time (30 minutes)
INSERT OR IGNORE INTO user_preferences (id, key, value, description)
VALUES (
    'pref_global_changeover',
    'changeover_default_minutes',
    '30',
    'Default changeover time in minutes when no family or line-specific value exists'
);

-- Insert SMED benchmark (10 minutes)
INSERT OR IGNORE INTO user_preferences (id, key, value, description)
VALUES (
    'pref_smed_benchmark',
    'smed_benchmark_minutes',
    '10',
    'SMED benchmark in minutes - changeovers exceeding this show a warning'
);

-- ============================================
-- FAMILY CHANGEOVER DEFAULTS TABLE
-- Family-to-family baseline changeover times
-- Used when no line-specific override exists
-- ============================================

CREATE TABLE IF NOT EXISTS family_changeover_defaults (
    id TEXT PRIMARY KEY,
    from_family TEXT NOT NULL,
    to_family TEXT NOT NULL,
    changeover_minutes INTEGER NOT NULL CHECK(changeover_minutes >= 0 AND changeover_minutes <= 480),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    -- Unique constraint prevents duplicate family pairs
    UNIQUE(from_family, to_family)
);

-- Index for fast lookups by family pair
CREATE INDEX IF NOT EXISTS idx_family_changeover_from_to
    ON family_changeover_defaults(from_family, to_family);

-- ============================================
-- LINE CHANGEOVER OVERRIDES TABLE
-- Line-specific changeover time exceptions (sparse storage)
-- Only stores values that differ from family defaults
-- ============================================

CREATE TABLE IF NOT EXISTS line_changeover_overrides (
    id TEXT PRIMARY KEY,
    line_id TEXT NOT NULL,
    from_model_id TEXT NOT NULL,
    to_model_id TEXT NOT NULL,
    changeover_minutes INTEGER NOT NULL CHECK(changeover_minutes >= 0 AND changeover_minutes <= 480),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    -- Foreign key to production_lines
    FOREIGN KEY (line_id) REFERENCES production_lines(id) ON DELETE CASCADE,
    -- Unique constraint prevents duplicate line+model combinations
    UNIQUE(line_id, from_model_id, to_model_id)
);

-- Index for fast lookups by line
CREATE INDEX IF NOT EXISTS idx_line_changeover_line
    ON line_changeover_overrides(line_id);

-- Index for fast lookups by model pair within a line
CREATE INDEX IF NOT EXISTS idx_line_changeover_models
    ON line_changeover_overrides(line_id, from_model_id, to_model_id);

-- ============================================
-- CHANGEOVER METHOD CONFIGS TABLE
-- User preferences for calculation methods per context
-- ============================================

CREATE TABLE IF NOT EXISTS changeover_method_configs (
    id TEXT PRIMARY KEY,
    context TEXT NOT NULL UNIQUE CHECK(context IN ('global', 'analysis', 'simulation')),
    method_id TEXT NOT NULL CHECK(method_id IN ('probability_weighted', 'tsp_optimal', 'worst_case', 'simple_average')),
    config_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Set default calculation method to probability-weighted
INSERT OR IGNORE INTO changeover_method_configs (id, context, method_id, config_json)
VALUES (
    'method_config_global',
    'global',
    'probability_weighted',
    '{"includeHHI": true, "minModelsForProbability": 2}'
);

-- ============================================
-- VIEW: Resolved Changeover Times
-- Joins all three tiers for easy querying
-- Priority: line_override > family_default > global_default
-- ============================================

CREATE VIEW IF NOT EXISTS v_resolved_changeover_times AS
WITH model_families AS (
    -- Get family for each model
    SELECT id as model_id, name as model_name, family
    FROM product_models_v2
    WHERE active = 1
),
global_default AS (
    -- Get global default from user_preferences
    SELECT CAST(value AS INTEGER) as default_minutes
    FROM user_preferences
    WHERE key = 'changeover_default_minutes'
),
line_models AS (
    -- Get all models assigned to each line
    SELECT DISTINCT
        lmc.line_id,
        lmc.model_id,
        mf.model_name,
        mf.family
    FROM line_model_compatibilities lmc
    JOIN model_families mf ON lmc.model_id = mf.model_id
)
SELECT
    lm1.line_id,
    lm1.model_id as from_model_id,
    lm1.model_name as from_model_name,
    lm1.family as from_family,
    lm2.model_id as to_model_id,
    lm2.model_name as to_model_name,
    lm2.family as to_family,
    -- Three-tier resolution with COALESCE
    COALESCE(
        -- Tier 1: Line-specific override (highest priority)
        lco.changeover_minutes,
        -- Tier 2: Family default
        fcd.changeover_minutes,
        -- Tier 3: Global default (fallback)
        gd.default_minutes
    ) as changeover_minutes,
    CASE
        WHEN lm1.model_id = lm2.model_id THEN 'same_model'
        WHEN lco.changeover_minutes IS NOT NULL THEN 'line_override'
        WHEN fcd.changeover_minutes IS NOT NULL THEN 'family_default'
        ELSE 'global_default'
    END as source
FROM line_models lm1
CROSS JOIN line_models lm2
LEFT JOIN line_changeover_overrides lco
    ON lco.line_id = lm1.line_id
    AND lco.from_model_id = lm1.model_id
    AND lco.to_model_id = lm2.model_id
LEFT JOIN family_changeover_defaults fcd
    ON fcd.from_family = lm1.family
    AND fcd.to_family = lm2.family
CROSS JOIN global_default gd
WHERE lm1.line_id = lm2.line_id;

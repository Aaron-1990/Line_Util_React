-- ============================================
-- MIGRATION 006: Fix Changeover View
-- Fixes the v_resolved_changeover_times view
-- Removes invalid reference to lmc.active column
-- Version: 6.0.0
-- ============================================

-- Drop the existing broken view
DROP VIEW IF EXISTS v_resolved_changeover_times;

-- Recreate the view with the correct definition
-- Priority: line_override > family_default > global_default
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

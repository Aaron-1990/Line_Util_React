# Migration 017: Unify Production Lines into Canvas Objects

**Date:** 2026-02-04
**Version:** 7.5.2
**Author:** Database Architect Agent

---

## Overview

This migration unifies the `production_lines` table into the `canvas_objects` system, completing Phase 7.5 of the Shape Catalog & Polymorphic Objects feature.

### Goals

1. **Single source of truth**: All process nodes (lines) exist in `canvas_objects`
2. **Unified data model**: Properties stored in `process_properties`, compatibilities in `canvas_object_compatibilities`
3. **Backward compatibility**: Views maintain old API for legacy code
4. **Reversibility**: Full rollback capability

---

## Files

| File | Purpose |
|------|---------|
| `017_unify_production_lines.sql` | Main migration script |
| `017_unify_production_lines_ROLLBACK.sql` | Rollback script |
| `017_unify_production_lines_VALIDATION.sql` | Post-migration validation queries |

---

## Pre-Migration State

### Tables (Before)

```
production_lines (209 records)
├── id, plant_id, name, area
├── time_available_daily, line_type
├── x_position, y_position
├── changeover_enabled, changeover_explicit
└── active, created_at, updated_at

line_model_compatibilities (1712 records)
├── id, line_id, model_id
├── cycle_time, efficiency, priority
└── plant_id, created_at, updated_at

canvas_objects (69 records) - NEW SYSTEM
├── id, plant_id, shape_id, object_type
├── name, description
├── x_position, y_position, width, height
└── active, locked, z_index

process_properties (18 records) - NEW SYSTEM
├── id, canvas_object_id
├── area, time_available_daily, line_type
└── changeover_enabled (NO changeover_explicit)

process_line_links (15 records) - LINKING TABLE
├── id, canvas_object_id
└── production_line_id

canvas_object_compatibilities (16 records) - NEW SYSTEM
├── id, canvas_object_id, model_id
└── cycle_time, efficiency, priority
```

### Data Flow (Before)

```
Excel Import → production_lines → line_model_compatibilities
                    ↓
              [optional link]
                    ↓
            process_line_links → canvas_objects
```

---

## Post-Migration State

### Tables (After)

```
_archived_production_lines (209 records) - ARCHIVED
_archived_line_model_compatibilities (1712 records) - ARCHIVED

canvas_objects (~278 records)
├── Existing 69 + 209 migrated = ~278 total
└── All lines now represented as object_type='process'

process_properties (~227 records)
├── Existing 18 (may be updated) + 209 migrated
└── NOW INCLUDES changeover_explicit column

canvas_object_compatibilities (~1728 records)
├── Existing 16 + 1712 migrated
└── All model assignments unified

_production_line_id_mapping (209 records) - NEW
├── Maps old production_line IDs to new canvas_object IDs
└── Supports legacy code lookups

production_lines (VIEW) - BACKWARD COMPAT
line_model_compatibilities (VIEW) - BACKWARD COMPAT
```

### Data Flow (After)

```
Excel Import → canvas_objects (type='process') → canvas_object_compatibilities
                     ↓
              process_properties
```

---

## Special Considerations

### 1. `process_line_links` Table

**Question:** What happens with existing `process_line_links`?

**Answer:** The migration handles this in two ways:

1. **Lines already linked** (15 records): These canvas objects ALREADY exist. The migration:
   - Updates their `process_properties` with data from the linked `production_line`
   - Copies `line_model_compatibilities` to `canvas_object_compatibilities`
   - Records the mapping in `_production_line_id_mapping` with type='linked'

2. **Lines NOT linked** (194 records): The migration:
   - Creates NEW `canvas_objects` with ID `co-pl-{production_line_id}`
   - Creates NEW `process_properties` with ID `pp-pl-{production_line_id}`
   - Copies all `line_model_compatibilities`
   - Records the mapping with type='migrated'

**Post-migration:** The `process_line_links` table is DEPRECATED but not deleted. Application code should:
- Stop using `process_line_links` for new operations
- Use `_production_line_id_mapping` for legacy ID lookups
- Eventually clean up the table in a future migration

### 2. `changeover_explicit` Column

**Question:** How is `changeover_explicit` handled since it doesn't exist in `process_properties`?

**Answer:** The migration adds this column in Phase 1:

```sql
ALTER TABLE process_properties ADD COLUMN changeover_explicit INTEGER NOT NULL DEFAULT 0;
```

Then during data migration:
- For migrated lines: copies value from `production_lines.changeover_explicit`
- For linked lines: updates from linked `production_line.changeover_explicit`

### 3. ID Preservation Strategy

To maintain traceability and support legacy code:

| Original Table | New ID Format | Example |
|----------------|---------------|---------|
| production_lines | `co-pl-{id}` | `co-pl-line-123` |
| process_properties | `pp-pl-{id}` | `pp-pl-line-123` |
| line_model_compatibilities (migrated) | `coc-mig-{id}` | `coc-mig-compat-456` |
| line_model_compatibilities (linked) | `coc-lnk-{id}` | `coc-lnk-compat-789` |

The `_production_line_id_mapping` table provides reverse lookups:

```sql
SELECT canvas_object_id FROM _production_line_id_mapping
WHERE production_line_id = 'line-123';
-- Returns: 'co-pl-line-123' (if migrated) or 'co-existing-456' (if linked)
```

### 4. Analysis Runs Handling

**Question:** What about `analysis_runs` that reference `line_id`?

**Answer:** The migration checks for this but does NOT modify stored JSON:

1. Currently there are 0 `analysis_runs` in the database
2. The validation queries check for references
3. If needed, application code should:
   - Use `_production_line_id_mapping` for lookups when displaying historical results
   - Store new analysis results with `canvas_object_id` instead of `line_id`

**Recommended approach for Python optimizer:**
```python
# Old format (deprecated)
results = {"line_id": "line-123", ...}

# New format (recommended)
results = {"canvas_object_id": "co-pl-line-123", ...}

# Backward compatible lookup
def get_object_id(line_id_or_object_id):
    if line_id_or_object_id.startswith('co-'):
        return line_id_or_object_id
    # Lookup in mapping
    return db.query("SELECT canvas_object_id FROM _production_line_id_mapping WHERE production_line_id = ?", line_id_or_object_id)
```

### 5. Backward Compatibility Views

Two views maintain the old API:

**`production_lines` view:**
```sql
SELECT
  CASE
    WHEN m.production_line_id IS NOT NULL THEN m.production_line_id
    ELSE REPLACE(co.id, 'co-pl-', '')
  END as id,  -- Returns original line ID if available
  co.plant_id, co.name,
  pp.area, pp.line_type, pp.time_available_daily,
  pp.changeover_enabled, pp.changeover_explicit,
  co.x_position, co.y_position, co.active
FROM canvas_objects co
JOIN process_properties pp ON co.id = pp.canvas_object_id
LEFT JOIN _production_line_id_mapping m ON co.id = m.canvas_object_id
WHERE co.object_type = 'process';
```

**`line_model_compatibilities` view:**
```sql
SELECT
  coc.id,
  CASE
    WHEN m.production_line_id IS NOT NULL THEN m.production_line_id
    ELSE REPLACE(coc.canvas_object_id, 'co-pl-', '')
  END as line_id,
  coc.model_id, coc.cycle_time, coc.efficiency, coc.priority,
  (SELECT plant_id FROM canvas_objects WHERE id = coc.canvas_object_id) as plant_id
FROM canvas_object_compatibilities coc
LEFT JOIN _production_line_id_mapping m ON coc.canvas_object_id = m.canvas_object_id;
```

---

## Running the Migration

### Step 1: Backup Database

```bash
cp ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db \
   ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.backup.db
```

### Step 2: Run Migration

The migration runs automatically via `MigrationRunner.ts`. To run manually:

```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db < \
  src/main/database/migrations/017_unify_production_lines.sql
```

### Step 3: Validate

```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db < \
  src/main/database/migrations/017_unify_production_lines_VALIDATION.sql
```

Expected output: All checks should show `PASS`.

### Step 4: Test Application

1. Start app: `npm start`
2. Open canvas - all production lines should appear
3. Check properties panel - changeover settings should work
4. Run analysis - results should be correct

---

## Rollback Procedure

If issues are found:

### Step 1: Stop Application

### Step 2: Run Rollback

```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db < \
  src/main/database/migrations/017_unify_production_lines_ROLLBACK.sql
```

### Step 3: Remove Migration Record

Edit `MigrationRunner.ts` to skip migration 017, or:

```sql
DELETE FROM migrations WHERE version = '017' OR name LIKE '%unify_production%';
```

### Step 4: Restart Application

---

## Application Code Changes Required

After migration, update these files:

### 1. Repositories

| Old | New |
|-----|-----|
| `SQLiteProductionLineRepository.ts` | Use `SQLiteCanvasObjectRepository.ts` |
| `SQLiteLineModelCompatibilityRepository.ts` | Use `SQLiteCanvasObjectCompatibilityRepository.ts` |

### 2. IPC Handlers

Update handlers to use canvas_objects:
- `production-lines.handler.ts` - Deprecated, forward to canvas-objects
- `line-compatibilities.handler.ts` - Deprecated, forward to canvas-object-compatibilities

### 3. DataExporter

Update `DataExporter.ts` to query canvas_objects:

```typescript
// Old
const lines = await db.all('SELECT * FROM production_lines WHERE plant_id = ?', plantId);

// New
const lines = await db.all(`
  SELECT co.*, pp.*
  FROM canvas_objects co
  JOIN process_properties pp ON co.id = pp.canvas_object_id
  WHERE co.plant_id = ? AND co.object_type = 'process'
`, plantId);
```

### 4. Python Optimizer

Update input format or use backward-compat view:

```python
# Option A: Use view (no changes needed)
lines = db.execute("SELECT * FROM production_lines")

# Option B: Use new structure (recommended)
lines = db.execute("""
  SELECT co.id, co.name, pp.area, pp.time_available_daily, ...
  FROM canvas_objects co
  JOIN process_properties pp ON co.id = pp.canvas_object_id
  WHERE co.object_type = 'process' AND co.active = 1
""")
```

---

## Future Cleanup

In a later migration (019 or later):

1. Drop `process_line_links` table (deprecated)
2. Drop `_production_line_id_mapping` (once legacy support removed)
3. Drop `_archived_production_lines` (once confident in migration)
4. Drop `_archived_line_model_compatibilities`
5. Drop backward-compat views if all code updated

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Lines storage | `production_lines` | `canvas_objects` (type='process') |
| Properties | In `production_lines` | `process_properties` |
| Compatibilities | `line_model_compatibilities` | `canvas_object_compatibilities` |
| Visual system | Separate from production data | Unified |
| Extensibility | Limited | Polymorphic (any shape, any type) |

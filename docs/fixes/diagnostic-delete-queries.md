# Canvas Objects Soft Delete Diagnostic Queries

Database Location: `~/Library/Application Support/Line Optimizer/line-optimizer.db`

---

## Query 1: View Recent Canvas Objects (Last 10)
Shows all recent objects with their active status and timestamps.

```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db << 'EOF'
.mode column
.headers on
.width 15 8 30 20 20

SELECT
  substr(id, 1, 8) AS id_short,
  active,
  substr(name, 1, 28) AS name,
  datetime(created_at) AS created_at,
  datetime(updated_at) AS updated_at
FROM canvas_objects
ORDER BY updated_at DESC
LIMIT 10;
EOF
```

**What it shows:**
- Recent objects with their active status (1 = active, 0 = soft-deleted)
- Names, creation time, and last update time
- Helps identify which objects were recently modified

---

## Query 2: Verify Specific Delete Operation
Replace `YOUR_OBJECT_ID` with the actual object ID to verify it was soft-deleted.

```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db << 'EOF'
.mode column
.headers on
.width 35 8 30 20

SELECT
  id,
  active,
  substr(name, 1, 28) AS name,
  datetime(created_at) AS created_at,
  datetime(updated_at) AS updated_at
FROM canvas_objects
WHERE id = 'YOUR_OBJECT_ID';
EOF
```

**What it shows:**
- Exact row for the object you're checking
- If `active = 0`, the soft delete succeeded
- If `active = 1`, the delete did not happen
- Shows when it was created vs when it was last updated

**Example with real ID:**
```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db << 'EOF'
SELECT id, active, name, datetime(updated_at) FROM canvas_objects
WHERE id = 'abc123xyz456';
EOF
```

---

## Query 3: Check Database Schema & Instance
Verifies that the database is intact and has all expected tables.

```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db << 'EOF'
.mode column
.headers on

-- Check all tables exist
SELECT name, type FROM sqlite_master
WHERE type = 'table'
ORDER BY name;
EOF
```

**What it shows:**
- List of all tables in the database
- Verifies both legacy and new schema exist
- Shows if `canvas_objects` and `production_lines` coexist

---

## Query 4: Count Active vs Deleted Objects (by Plant)
Shows distribution of active/soft-deleted objects per plant.

```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db << 'EOF'
.mode column
.headers on
.width 35 15 15

SELECT
  plant_id,
  SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_count,
  SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) AS deleted_count,
  COUNT(*) AS total
FROM canvas_objects
GROUP BY plant_id
ORDER BY plant_id;
EOF
```

**What it shows:**
- Number of active objects per plant
- Number of soft-deleted objects per plant
- Total count per plant
- Helps verify deletion operations are working

---

## Query 5: Find All Soft-Deleted Objects (active = 0)
Lists all objects that have been soft-deleted but not hard-deleted.

```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db << 'EOF'
.mode column
.headers on
.width 15 35 20 20

SELECT
  substr(id, 1, 8) AS id_short,
  substr(name, 1, 33) AS name,
  object_type,
  datetime(updated_at) AS deleted_at
FROM canvas_objects
WHERE active = 0
ORDER BY updated_at DESC;
EOF
```

**What it shows:**
- All soft-deleted objects still in database
- When they were deleted
- What type they were
- Useful for cleanup operations

---

## Query 6: Check for Active Flag Values (Data Integrity)
Validates that active column only contains 0 or 1 (no NULL or unexpected values).

```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db << 'EOF'
.mode column
.headers on

SELECT DISTINCT active, COUNT(*) as count
FROM canvas_objects
GROUP BY active
ORDER BY active;
EOF
```

**What it shows:**
- Distribution of active column values
- If you see anything other than 0 or 1, there's a data integrity issue
- Expected output: Two rows with active=0 and active=1

---

## Quick Troubleshooting Checklist

### Objects Reappear After Delete

1. **Check if delete actually happened:**
   ```bash
   # Use Query 2 with your object ID
   # If active = 1, the delete operation failed
   # If active = 0, the issue is in the app logic (not reading active flag)
   ```

2. **Check if multiple DB instances exist:**
   ```bash
   # Check file size (should be same)
   ls -lh ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db

   # Check modification time
   stat ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db
   ```

3. **Verify app reads active flag:**
   - Check `SQLiteCanvasObjectRepository.findAllByPlant()` at line 110-116
   - Must include: `WHERE ... AND active = 1`
   - Current code is correct

4. **Check for cached data:**
   - Frontend may be returning cached objects
   - Check `useAnalysisStore` state management
   - Verify IPC handler clears cache after delete

---

## Common Issues & Solutions

### Issue: Objects show active=0 in DB but appear in app

**Cause:** Frontend not filtering by active flag
**Check:** `src/renderer/features/canvas/hooks/useCanvasObjects.ts`
Should include: `active === true` filter

---

### Issue: active column has NULL values

**Cause:** Malformed INSERT or migration issue
**Fix:** Update all NULLs to 1 (active)
```bash
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db << 'EOF'
UPDATE canvas_objects SET active = 1 WHERE active IS NULL;
EOF
```

---

### Issue: Database size keeps growing

**Cause:** Soft-deleted objects accumulating
**Solution:** Either:
1. Hard-delete after N days: `DELETE FROM canvas_objects WHERE active = 0 AND datetime(updated_at) < datetime('now', '-30 days')`
2. Archive to separate table: Copy soft-deleted objects to archive, then hard-delete

---

## Running These Queries

All commands are ready to copy-paste into your terminal. They will:
- Open the SQLite database
- Display results in formatted columns
- Close automatically

No data is modified by these diagnostic queries (all are SELECT only).

---

## Example Output

Query 1 - Recent Objects:
```
id_short  active  name                      created_at          updated_at
--------  ------  --------                  ---------           --------
abc1234d  1       Process A                 2025-02-15 10:30    2025-02-15 10:35
def5678e  0       Buffer B                  2025-02-14 09:00    2025-02-15 11:00
ghi9012f  1       Process C                 2025-02-15 11:15    2025-02-15 11:20
```

Query 3 - Schema Check (Expected tables):
```
name                          type
----                          ----
canvas_connections            table
canvas_object_compatibilities table
canvas_objects                table
production_lines              table
shape_catalog                 table
... (and others)
```

This confirms both canvas (Phase 7.5) and legacy schema coexist.

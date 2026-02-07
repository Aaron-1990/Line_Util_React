# Fix Database Instance References - All Remaining Handlers

## Metadata
- **Designed:** 2026-02-07
- **Designer:** Aaron Zapata
- **Project:** Line Optimizer
- **Framework:** Híbrido v2.0
- **Domain:** Backend/Database
- **Agent:** `backend-architect`
- **Priority:** HIGH
- **Estimated Complexity:** Medium (repetitive but critical)

---

## Context

### Business Value
Phase 8.0 (Project Files) revealed a critical architectural bug: handlers capture database instance references at registration time instead of obtaining them dynamically. This causes handlers to fail with "database connection is not open" errors after `replaceInstance()` calls (when opening .lop files).

**Already Fixed:**
- `project.handler.ts` ✅
- `plant.handler.ts` ✅

**Still Broken (7 handlers):**
- `models-v2.handler.ts` ❌
- `volume.handler.ts` ❌
- `compatibility.handler.ts` ❌
- `changeover.handler.ts` ❌
- `routing.handler.ts` ❌
- `canvas-objects.handler.ts` ❌
- `shape-catalog.handler.ts` ❌

### Problem Statement
After Save As, the active database switches to the .lop file. All operations (create model, add volume, etc.) will fail because handlers use stale DB references.

### Success Criteria
- All handlers use `DatabaseConnection.getInstance()` dynamically
- Operations work correctly after Save As → Open cycle
- No "database not open" errors
- TypeScript compiles without errors

---

## BLOQUE 0: Contracts & Architecture

### Objective
Understand the current handler architecture and define the fix pattern before making changes.

### Research Tasks

1. **Read Reference Documentation**
   ```bash
   cat docs/troubleshooting/phase-8-database-instance-references.md
   ```
   Understand the root cause and solution pattern.

2. **Analyze Fixed Handlers (Reference Implementation)**
   ```bash
   # Study the correct pattern
   cat src/main/ipc/handlers/plant.handler.ts
   ```
   Note how `getInstance()` is called INSIDE each handler.

3. **List All Handlers to Fix**
   ```bash
   ls -la src/main/ipc/handlers/*.handler.ts | grep -v project | grep -v plant
   ```

4. **For Each Handler, Identify:**
   - How many IPC handlers are registered
   - Which repositories are used
   - Where DB instance is captured
   - Line numbers to modify

### Architectural Principles

**Anti-Pattern (Current):**
```typescript
export function registerHandlers(): void {
  const db = DatabaseConnection.getInstance(); // ❌ Captured once
  const repo = new Repository(db);

  ipcMain.handle(CHANNEL, async () => {
    return repo.method(); // Uses stale DB
  });
}
```

**Correct Pattern (Target):**
```typescript
export function registerHandlers(): void {
  ipcMain.handle(CHANNEL, async () => {
    const repo = new Repository(DatabaseConnection.getInstance()); // ✅ Dynamic
    return repo.method();
  });
}
```

### Validation Criteria

- [ ] Read troubleshooting doc
- [ ] Analyzed plant.handler.ts as reference
- [ ] Listed all 7 handlers to fix
- [ ] Documented repository dependencies for each
- [ ] NO workarounds - using standard getInstance() pattern

---

## BLOQUE 1: Fix models-v2.handler.ts

### Objective
Apply dynamic getInstance() pattern to models handler.

### Analysis

**File:** `src/main/ipc/handlers/models-v2.handler.ts`

**Expected Pattern:**
```typescript
// Current (broken)
const db = DatabaseConnection.getInstance();
const modelRepository = new SQLiteProductModelRepositoryV2(db);

// Target (fixed)
// Inside each handler:
const modelRepository = new SQLiteProductModelRepositoryV2(DatabaseConnection.getInstance());
```

### Implementation

1. **Read current implementation**
   ```bash
   cat src/main/ipc/handlers/models-v2.handler.ts
   ```

2. **Identify capture location**
   - Find where `const db = DatabaseConnection.getInstance()` is called
   - Find where repository is instantiated

3. **Apply fix**
   - Remove captured `db` variable
   - Inside each `ipcMain.handle()`, create repository with `getInstance()`

4. **Verify TypeScript**
   ```bash
   npm run type-check
   ```

### Checkpoint (30 sec)

```bash
# Verify fix applied
grep "DatabaseConnection.getInstance()" src/main/ipc/handlers/models-v2.handler.ts

# Count should match number of handlers
npm run type-check
```

**Success Criteria:**
- [ ] `getInstance()` called inside each handler
- [ ] No captured `db` variable at function scope
- [ ] TypeScript compiles without errors
- [ ] File saved

---

## BLOQUE 2: Fix volume.handler.ts

### Objective
Apply dynamic getInstance() pattern to volume handler.

### Analysis

**File:** `src/main/ipc/handlers/volume.handler.ts`

**Repository:** `SQLiteProductVolumeRepository`

### Implementation

Same pattern as BLOQUE 1:
1. Read file
2. Identify capture point
3. Remove captured reference
4. Add `getInstance()` inside each handler
5. Verify TypeScript

### Checkpoint (30 sec)

```bash
grep "DatabaseConnection.getInstance()" src/main/ipc/handlers/volume.handler.ts
npm run type-check
```

**Success Criteria:**
- [ ] `getInstance()` called inside each handler
- [ ] TypeScript compiles
- [ ] File saved

---

## BLOQUE 3: Fix compatibility.handler.ts

### Objective
Apply dynamic getInstance() pattern to compatibility handler.

### Analysis

**File:** `src/main/ipc/handlers/compatibility.handler.ts`

**Repository:** `SQLiteLineModelCompatibilityRepository`

### Implementation

Same pattern as BLOQUE 1.

### Checkpoint (30 sec)

```bash
grep "DatabaseConnection.getInstance()" src/main/ipc/handlers/compatibility.handler.ts
npm run type-check
```

**Success Criteria:**
- [ ] `getInstance()` called inside each handler
- [ ] TypeScript compiles
- [ ] File saved

---

## BLOQUE 4: Fix changeover.handler.ts

### Objective
Apply dynamic getInstance() pattern to changeover handler.

### Analysis

**File:** `src/main/ipc/handlers/changeover.handler.ts`

**Repository:** `SQLiteChangeoverRepository`

**Note:** This handler may have multiple repositories (family defaults, line overrides, preferences).

### Implementation

Same pattern as BLOQUE 1, but verify ALL repository instantiations are fixed.

### Checkpoint (30 sec)

```bash
grep "DatabaseConnection.getInstance()" src/main/ipc/handlers/changeover.handler.ts
npm run type-check
```

**Success Criteria:**
- [ ] `getInstance()` called for ALL repositories
- [ ] TypeScript compiles
- [ ] File saved

---

## BLOQUE 5: Fix routing.handler.ts

### Objective
Apply dynamic getInstance() pattern to routing handler.

### Analysis

**File:** `src/main/ipc/handlers/routing.handler.ts`

**Repository:** `SQLiteModelAreaRoutingRepository`

### Implementation

Same pattern as BLOQUE 1.

### Checkpoint (30 sec)

```bash
grep "DatabaseConnection.getInstance()" src/main/ipc/handlers/routing.handler.ts
npm run type-check
```

**Success Criteria:**
- [ ] `getInstance()` called inside each handler
- [ ] TypeScript compiles
- [ ] File saved

---

## BLOQUE 6: Fix canvas-objects.handler.ts

### Objective
Apply dynamic getInstance() pattern to canvas objects handler.

### Analysis

**File:** `src/main/ipc/handlers/canvas-objects.handler.ts`

**Repository:** Likely `SQLiteCanvasObjectRepository` or similar

### Implementation

Same pattern as BLOQUE 1.

### Checkpoint (30 sec)

```bash
grep "DatabaseConnection.getInstance()" src/main/ipc/handlers/canvas-objects.handler.ts
npm run type-check
```

**Success Criteria:**
- [ ] `getInstance()` called inside each handler
- [ ] TypeScript compiles
- [ ] File saved

---

## BLOQUE 7: Fix shape-catalog.handler.ts

### Objective
Apply dynamic getInstance() pattern to shape catalog handler.

### Analysis

**File:** `src/main/ipc/handlers/shape-catalog.handler.ts`

**Repository:** Likely shape-related repository

### Implementation

Same pattern as BLOQUE 1.

### Checkpoint (30 sec)

```bash
grep "DatabaseConnection.getInstance()" src/main/ipc/handlers/shape-catalog.handler.ts
npm run type-check
```

**Success Criteria:**
- [ ] `getInstance()` called inside each handler
- [ ] TypeScript compiles
- [ ] File saved

---

## BLOQUE 8: Fix canvas-object-compatibility.handler.ts (if exists)

### Objective
Apply dynamic getInstance() pattern to canvas object compatibility handler.

### Analysis

**File:** `src/main/ipc/handlers/canvas-object-compatibility.handler.ts`

**Note:** Verify if this handler exists and needs fixing.

### Implementation

If file exists, same pattern as BLOQUE 1.

### Checkpoint (30 sec)

```bash
# Only if file exists
if [ -f "src/main/ipc/handlers/canvas-object-compatibility.handler.ts" ]; then
  grep "DatabaseConnection.getInstance()" src/main/ipc/handlers/canvas-object-compatibility.handler.ts
fi
npm run type-check
```

**Success Criteria:**
- [ ] File checked (exists or not)
- [ ] If exists, `getInstance()` applied
- [ ] TypeScript compiles

---

## BLOQUE FINAL: Integration Testing & Validation

### Objective
Verify all handlers work correctly after Save As → Open cycle.

### Test Plan

#### Test 1: Models Handler
```
1. New Project
2. Save As → "test-models.lop"
3. Create a new model
4. EXPECTED: Model created successfully (no "database not open" error)
5. Save
6. New Project
7. Open → "test-models.lop"
8. EXPECTED: Model appears in list
```

#### Test 2: Volumes Handler
```
1. New Project
2. Create a model
3. Save As → "test-volumes.lop"
4. Add volume to model
5. EXPECTED: Volume created successfully
6. New Project
7. Open → "test-volumes.lop"
8. EXPECTED: Volume data persisted
```

#### Test 3: Compatibility Handler
```
1. New Project
2. Create line and model
3. Save As → "test-compat.lop"
4. Add compatibility
5. EXPECTED: Compatibility created successfully
6. Verify after reopen
```

#### Test 4: Changeover Handler
```
1. New Project
2. Save As → "test-changeover.lop"
3. Set changeover time
4. EXPECTED: Changeover saved successfully
5. Verify after reopen
```

#### Test 5: Routing Handler
```
1. New Project
2. Create model
3. Save As → "test-routing.lop"
4. Add routing
5. EXPECTED: Routing created successfully
6. Verify after reopen
```

#### Test 6: Canvas Objects Handler
```
1. New Project
2. Save As → "test-canvas.lop"
3. Create canvas object (line/area)
4. EXPECTED: Object created successfully
5. Verify after reopen
```

#### Test 7: Shape Catalog Handler
```
1. New Project
2. Save As → "test-shapes.lop"
3. Use shape catalog operation
4. EXPECTED: Operation succeeds
5. Verify after reopen
```

### Manual Verification Commands

```bash
# Check all handlers use getInstance() correctly
echo "=== Checking getInstance() usage in all handlers ==="
for file in src/main/ipc/handlers/*.handler.ts; do
  echo "File: $file"
  grep -c "DatabaseConnection.getInstance()" "$file" || echo "  WARNING: No getInstance() found"
done

# Final type check
echo "=== Running TypeScript type check ==="
npm run type-check

# Count fixed handlers
echo "=== Summary ==="
echo "Total handlers with getInstance():"
grep -r "DatabaseConnection.getInstance()" src/main/ipc/handlers/*.handler.ts | wc -l
```

### Checklist Final

- [ ] All 7+ handlers use `getInstance()` dynamically
- [ ] No captured `db` variables at function scope
- [ ] TypeScript compiles without errors
- [ ] Manual test of at least 3 handlers passes
- [ ] No console errors during operations
- [ ] Save → Open → Verify data persists for each tested handler

---

## Success Criteria

### Technical
- [ ] All handlers modified to use `getInstance()` inside handlers
- [ ] Zero captured database references at registration time
- [ ] TypeScript type-check passes
- [ ] No regression in existing functionality

### Functional
- [ ] All CRUD operations work after Save As
- [ ] Data persists correctly across Save/Open cycles
- [ ] No "database not open" errors in any handler
- [ ] Project files remain compatible

### Code Quality
- [ ] Code follows existing patterns from plant.handler.ts
- [ ] No workarounds or hacks introduced
- [ ] Consistent style across all handlers

---

## Testing Strategy

### Unit Testing
Not required - this is a refactor that maintains existing behavior.

### Integration Testing (Manual)
Test matrix (7 handlers × 3 operations = 21 tests):

| Handler | Create After Save As | Read After Reopen | Update After Save As |
|---------|---------------------|-------------------|---------------------|
| Models | ✅ | ✅ | ✅ |
| Volumes | ✅ | ✅ | ✅ |
| Compatibility | ✅ | ✅ | ✅ |
| Changeover | ✅ | ✅ | ✅ |
| Routing | ✅ | ✅ | ✅ |
| Canvas Objects | ✅ | ✅ | ✅ |
| Shape Catalog | ✅ | ✅ | ✅ |

### Regression Testing
Run existing app workflows to ensure no breakage:
1. Import Excel data
2. Run analysis
3. View results
4. Modify changeover matrix
5. Create routings

---

## Implementation Command

```bash
# For Orchestrator v4
orchestrate docs/specs/fix-database-instance-references-all-handlers.md

# Or for Claude Code CLI with agent
claude "@backend-architect implement fix-database-instance-references according to docs/specs/fix-database-instance-references-all-handlers.md"
```

---

## Post-Implementation Verification

### Automated Checks

```bash
# 1. Type check
npm run type-check

# 2. Verify getInstance() usage
echo "Handlers using getInstance():"
grep -r "DatabaseConnection.getInstance()" src/main/ipc/handlers/*.handler.ts | cut -d: -f1 | sort -u

# 3. Verify no captured DB references (should find 0 matches)
echo "Captured DB references (should be 0):"
grep -r "const db = DatabaseConnection.getInstance()" src/main/ipc/handlers/*.handler.ts | grep -v project.handler | grep -v plant.handler | wc -l
```

### Manual Testing Checklist

```
[ ] Start app (npm start)
[ ] New Project
[ ] Save As → test-all.lop
[ ] Create model → Success
[ ] Add volume → Success
[ ] Add compatibility → Success
[ ] Set changeover → Success
[ ] Add routing → Success
[ ] Create canvas object → Success
[ ] Use shape catalog → Success
[ ] Save (Cmd+S)
[ ] New Project
[ ] Open test-all.lop
[ ] All data persisted → Success
[ ] No console errors
```

---

## Rollback Plan

If issues are found:

```bash
# Revert commit
git revert HEAD

# Or reset to before fix
git reset --hard <commit-before-fix>
```

---

## Notes for Agent

1. **Be Methodical:** Fix one handler at a time, verify each before moving to next
2. **Use plant.handler.ts as Reference:** It's the gold standard
3. **Watch for Multiple Repositories:** Some handlers (changeover) use multiple repos
4. **Don't Skip Type Check:** Run after each handler fix
5. **Report Anomalies:** If a handler has unusual pattern, document it

---

## Expected Time

- **BLOQUE 0:** 15 min (research & analysis)
- **BLOQUE 1-8:** 10 min each × 8 = 80 min (implementation)
- **BLOQUE FINAL:** 30 min (testing)
- **Total:** ~2 hours

---

## Dependencies

- Phase 8.0 fixes already applied (project.handler, plant.handler)
- DatabaseConnection.getInstance() available
- TypeScript compiler working
- App can be tested locally

---

## References

- **Troubleshooting Doc:** `docs/troubleshooting/phase-8-database-instance-references.md`
- **Reference Implementation:** `src/main/ipc/handlers/plant.handler.ts`
- **CHANGELOG:** `docs/CHANGELOG-PHASES.md` (Phase 8.0 entry)
- **Original Issue:** Database instance references captured at registration time

---

**Spec Version:** 1.0
**Last Updated:** 2026-02-07
**Status:** Ready for Implementation

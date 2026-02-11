# Phase 8.0: Fix Remaining Database Instance References

> **Specification for Orchestrator Execution**
> **Created:** 2026-02-10
> **Agent:** backend-architect
> **Priority:** Medium
> **Complexity:** Low (Repetitive pattern application)

---

## Metadata

- **Type:** Bug Fix / Technical Debt
- **Estimated Time:** 2-3 hours
- **Framework:** Híbrido v2.0
- **Orchestrator:** v5.0

---

## Context

During Phase 8.1 implementation, we discovered that several IPC handlers obtain `DatabaseConnection.getInstance()` once during registration, then reuse that instance for all requests. This causes **"database connection is not open"** errors after `replaceInstance()` switches the active database (e.g., when opening .lop files).

**Already Fixed:**
- production-lines.handler.ts ✅ (Phase 8.1)
- changeover.handler.ts ✅ (Phase 8.0)
- compatibility.handler.ts ✅ (Phase 8.0)
- models-v2.handler.ts ✅ (Phase 8.0)
- volumes.handler.ts ✅ (Phase 8.0)

**Remaining Handlers (8):**
1. area-catalog.handler.ts
2. canvas-objects.handler.ts
3. analysis.handler.ts
4. multi-sheet-excel.handler.ts
5. canvas-object-compatibility.handler.ts
6. excel.handler.ts
7. model-processes.handler.ts
8. product-models.handler.ts

---

## BLOQUE 0: Contracts & Architecture

### Objective
Understand the correct pattern and validate against Electron/better-sqlite3 best practices.

### Pattern: INCORRECT (Stale Instance)
```typescript
// ❌ BAD - Gets instance once at registration
export function registerHandler(): void {
  const db = DatabaseConnection.getInstance();
  const repository = new SomeRepository(db);

  ipcMain.handle('channel:action', async () => {
    const data = await repository.findAll();  // Uses closed instance after replaceInstance()
    return { success: true, data };
  });
}
```

### Pattern: CORRECT (Fresh Instance)
```typescript
// ✅ GOOD - Gets fresh instance on each request
export function registerHandler(): void {
  ipcMain.handle('channel:action', async () => {
    const repository = new SomeRepository(
      DatabaseConnection.getInstance()  // Fresh instance every time
    );
    const data = await repository.findAll();
    return { success: true, data };
  });
}
```

### Why This Pattern?
1. **DatabaseConnection is a singleton** that can be replaced via `replaceInstance()`
2. **After replaceInstance()**, old instance is closed, new instance assigned
3. **Repositories holding old instance** will fail with "connection is not open"
4. **Getting getInstance() in each handler** ensures fresh, active instance

### Reference Implementation
See: `src/main/ipc/handlers/production-lines.handler.ts` (fixed in Phase 8.1)

### Validation Strategy
For each handler:
1. Read current implementation
2. Identify if uses stale pattern (getInstance at registration)
3. Count how many ipcMain.handle() calls need updating
4. Apply pattern systematically to each handler
5. Verify no regressions (type-check)

### Success Criteria
- [ ] Pattern understood and documented
- [ ] Reference implementation reviewed
- [ ] All 8 handlers identified
- [ ] No workarounds needed

---

## BLOQUE 1: Fix area-catalog.handler.ts

### Objective
Update area catalog handler to use fresh getInstance() in each handler.

### File
`src/main/ipc/handlers/area-catalog.handler.ts`

### Steps
1. Read current implementation
2. Identify all ipcMain.handle() calls
3. For each handler:
   - Add `const repository = new Repository(DatabaseConnection.getInstance())` inside handler
   - Remove any shared repository/db instances at registration level
4. Verify no other dependencies on stale instance

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] All handlers in file updated
- [ ] No stale getInstance() at registration level
- [ ] Type-check passes
- [ ] Pattern applied consistently

---

## BLOQUE 2: Fix canvas-objects.handler.ts

### Objective
Update canvas objects handler to use fresh getInstance() in each handler.

### File
`src/main/ipc/handlers/canvas-objects.handler.ts`

### Steps
1. Read current implementation
2. Identify all ipcMain.handle() calls
3. Apply pattern to each handler
4. Special attention to bulk operations (may have multiple repository calls in one handler)

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] All handlers updated
- [ ] Bulk operations handled correctly
- [ ] Type-check passes

---

## BLOQUE 3: Fix analysis.handler.ts

### Objective
Update analysis handler to use fresh getInstance() in each handler.

### File
`src/main/ipc/handlers/analysis.handler.ts`

### Steps
1. Read current implementation
2. Identify all ipcMain.handle() calls
3. Apply pattern to each handler
4. **Note:** Analysis may use DataExporter which also needs DB instance

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] All handlers updated
- [ ] DataExporter receives fresh instance if needed
- [ ] Type-check passes

---

## BLOQUE 4: Fix multi-sheet-excel.handler.ts

### Objective
Update multi-sheet Excel import handler to use fresh getInstance() in each handler.

### File
`src/main/ipc/handlers/multi-sheet-excel.handler.ts`

### Steps
1. Read current implementation
2. Identify all ipcMain.handle() calls
3. Apply pattern to each handler
4. **Note:** Import operations may be complex with transactions

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] All handlers updated
- [ ] Transaction handling preserved
- [ ] Type-check passes

---

## BLOQUE 5: Fix canvas-object-compatibility.handler.ts

### Objective
Update canvas object compatibility handler to use fresh getInstance() in each handler.

### File
`src/main/ipc/handlers/canvas-object-compatibility.handler.ts`

### Steps
1. Read current implementation
2. Identify all ipcMain.handle() calls
3. Apply pattern to each handler

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] All handlers updated
- [ ] Type-check passes

---

## BLOQUE 6: Fix excel.handler.ts

### Objective
Update Excel export handler to use fresh getInstance() in each handler.

### File
`src/main/ipc/handlers/excel.handler.ts`

### Steps
1. Read current implementation
2. Identify all ipcMain.handle() calls
3. Apply pattern to each handler

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] All handlers updated
- [ ] Type-check passes

---

## BLOQUE 7: Fix model-processes.handler.ts

### Objective
Update model processes handler to use fresh getInstance() in each handler.

### File
`src/main/ipc/handlers/model-processes.handler.ts`

### Steps
1. Read current implementation
2. Identify all ipcMain.handle() calls
3. Apply pattern to each handler

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] All handlers updated
- [ ] Type-check passes

---

## BLOQUE 8: Fix product-models.handler.ts

### Objective
Update product models handler to use fresh getInstance() in each handler.

### File
`src/main/ipc/handlers/product-models.handler.ts`

### Steps
1. Read current implementation
2. Identify all ipcMain.handle() calls
3. Apply pattern to each handler

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] All handlers updated
- [ ] Type-check passes

---

## BLOQUE FINAL: Validation & Testing

### Objective
Verify all handlers work correctly after opening .lop files.

### Validation Steps

**1. Type Check**
```bash
npm run type-check
```
Expected: ✅ No errors

**2. Pattern Verification**
```bash
# Search for stale pattern (should find ZERO matches in modified files)
grep -r "const db = DatabaseConnection.getInstance()" src/main/ipc/handlers/

# Should only appear inside ipcMain.handle() blocks, not at registration level
```

**3. Manual Testing - Open Project File**
```bash
npm start
```

Test procedure:
1. Start app (Untitled Project)
2. Create test data:
   - 1 plant
   - 1 area
   - 1 model
3. File > Save As → `test-phase-8.lop`
4. File > New → Don't Save
5. File > Open → `test-phase-8.lop`
6. **Verify:**
   - ✅ File opens successfully
   - ✅ Data appears in all catalogs
   - ✅ No "database connection is not open" errors in terminal
   - ✅ Can perform operations (create, edit, delete) in opened file

**4. Test Each Affected Feature**
After opening .lop file, test:
- [ ] Area Catalog (view, create, edit)
- [ ] Canvas Objects (view, create, move)
- [ ] Analysis (run optimization)
- [ ] Excel Import (import new data)
- [ ] Canvas Object Compatibility (view, edit)
- [ ] Excel Export (export data)
- [ ] Model Processes (view, edit)
- [ ] Product Models (view, create, edit)

### Success Criteria
- [ ] Type-check passes
- [ ] No stale pattern found in any handler
- [ ] Manual test: File opens successfully
- [ ] All catalog operations work in opened file
- [ ] No console errors
- [ ] No regressions in existing functionality

---

## Edge Cases & Considerations

### 1. Handlers with Multiple Repository Types
Some handlers may use multiple repositories:
```typescript
ipcMain.handle('complex:operation', async () => {
  // ✅ Get fresh instance for each repository
  const repo1 = new Repository1(DatabaseConnection.getInstance());
  const repo2 = Repository2(DatabaseConnection.getInstance());

  const data1 = await repo1.findAll();
  const data2 = await repo2.findAll();

  return { success: true, data: { data1, data2 } };
});
```

### 2. Handlers with Transactions
Transaction handling should remain unchanged:
```typescript
ipcMain.handle('import:data', async () => {
  const db = DatabaseConnection.getInstance();  // ✅ Fresh instance

  const transaction = db.transaction(() => {
    // Transaction logic
  });

  transaction();
  return { success: true };
});
```

### 3. Handlers Passing DB to Services
Services should also receive fresh instance:
```typescript
ipcMain.handle('export:data', async () => {
  const db = DatabaseConnection.getInstance();  // ✅ Fresh instance
  const exporter = new DataExporter(db);

  const result = await exporter.export();
  return { success: true, data: result };
});
```

---

## Rollback Plan

If issues arise:
1. Git revert to commit before Phase 8.0 fixes
2. Identify problematic handler
3. Fix specific handler
4. Re-run validation

**Rollback command:**
```bash
git log --oneline -10  # Find commit before Phase 8.0
git revert <commit-hash>
```

---

## Post-Implementation Checklist

- [ ] All 8 handlers updated with fresh getInstance() pattern
- [ ] Type-check passes
- [ ] No stale pattern found in grep search
- [ ] Manual test passed (open .lop file)
- [ ] All affected features tested in opened file
- [ ] No console errors
- [ ] Documentation updated (this spec)
- [ ] Git commit created with clear message
- [ ] Changes pushed to GitHub

---

## References

- **Phase 8.1 Fix:** production-lines.handler.ts (commit: 658ce96)
- **DatabaseConnection:** src/main/database/connection.ts
- **replaceInstance() usage:** src/main/services/project/ProjectFileService.ts
- **Framework:** ~/.claude/CLAUDE.md (Híbrido v2.0)

---

## Implementation Command

```bash
# Execute with orchestrator v5.0
orchestrate docs/specs/phase-8.0-fix-remaining-handler-instances.md
```

---

**Expected Duration:** 2-3 hours
**Agent:** backend-architect
**Priority:** Medium (eliminates technical debt)
**Blocking:** None (can be done independently)

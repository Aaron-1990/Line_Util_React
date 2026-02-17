# Bug 5 & Bug 3-4 Prevention Checklist

**Purpose:** Prevent regression of critical bugs when implementing new features

**Use this checklist BEFORE implementing any feature that touches:**
- Data loading/reloading
- Store management (Zustand)
- Canvas/ReactFlow interactions
- Mac sleep/wake handling
- Page lifecycle events

---

## Pre-Implementation Questions

### 1. Does your feature reload data from DB?

**If YES, answer:**
- [ ] Will it reload on component mount/remount? → Use store-based guard
- [ ] Will it clear stores? → NEVER clear stores on wake/resume
- [ ] Will it trigger on navigation? → Ensure doesn't reload unnecessarily

**Critical Pattern:**
```typescript
// ✅ CORRECT: Store-based guard
const currentData = useStore.getState().data;
if (currentData.length > 0 && currentData[0].plantId === currentPlantId) {
  return; // Skip reload
}

// ❌ WRONG: useRef guard (resets on unmount)
const loadedRef = useRef<string | null>(null);
if (loadedRef.current === plantId) return;
```

---

### 2. Does your feature trigger page reload?

**If YES, answer:**
- [ ] Do you call `location.reload()` or `window.location.reload()`? → **NEVER DO THIS**
- [ ] Do you override/remove beforeunload handler? → **NEVER DO THIS**
- [ ] Do you call `refreshAllStores()`? → **ONLY on File > Open, NEVER on resume**

**Critical Files:**
- `src/renderer/index.tsx` (lines 12-51) - beforeunload handler
- `src/renderer/components/layout/AppLayout.tsx` (lines 372-391) - resume handler

---

### 3. Does your feature use ReactFlow?

**If YES, answer:**
- [ ] Do you use `fitView` **prop**? → Use `fitView()` **function** instead
- [ ] Do you clear selection in data loading hooks? → **NEVER DO THIS**
- [ ] Do you delete nodes in a loop? → Use **batch operations** instead
- [ ] Does your feature change how `nodes[]` is rebuilt from store data? → Verify `deleteKeyCode={null}` is set (prevents RF internal handler race condition — see Bug B in `docs/phases/phase-7.6-canvas-single-source-of-truth.md`)

**Critical Patterns:**
```typescript
// ✅ CORRECT: fitView function (controlled)
useEffect(() => {
  if (!isLoading && nodes.length > 0) {
    setTimeout(() => fitView({ padding: 0.1 }), 50);
  }
}, [isLoading, fitView]);

// ❌ WRONG: fitView prop (causes remounts)
<ReactFlow fitView nodes={nodes} />

// ✅ CORRECT: Batch delete
useCanvasStore.setState(state => ({
  nodes: state.nodes.filter(n => !idsToDelete.includes(n.id))
}));

// ❌ WRONG: Loop delete (intermediate renders)
for (const id of idsToDelete) {
  await deleteNode(id);
}

// ✅ CORRECT: deleteKeyCode disabled (single delete handler on document)
<ReactFlow deleteKeyCode={null} ... />

// ❌ WRONG: deleteKeyCode active while custom handler exists on document
<ReactFlow ... />  // ← RF fires first, empties selection, custom handler is NOOP
```

---

### 3b. Does your feature add an early return to a node component?

**If YES, answer:**
- [ ] Have you listed ALL hooks in the component in order?
- [ ] Is the early return placed AFTER the very last hook?
- [ ] NOTE: TypeScript CANNOT catch Rules of Hooks violations — they are runtime-only crashes

**Critical Pattern:**
```typescript
// ✅ CORRECT: ALL hooks before early return (Phase 7.6 pattern)
const object = useCanvasObjectStore((s) => s.objects.find(...));
const activeTool = useToolStore(...);
const handles = useMemo(...);   // ← last hook
if (!object) return null;        // ← early return AFTER all hooks

// ❌ WRONG: hook after early return (crashes when object is deleted)
const object = useCanvasObjectStore((s) => s.objects.find(...));
if (!object) return null;        // ← early return
const handles = useMemo(...);   // ← NEVER REACHED during deletion → crash
```

**How to audit a component before adding an early return:**
```bash
# List all hook calls in the component (check line numbers)
grep -n "use[A-Z]\|useMemo\|useCallback\|useEffect\|useState\|useRef" src/.../MyComponent.tsx
# Verify the early return line number is HIGHER than all hook line numbers
```

---

### 4. Does your feature modify critical files?

**If modifying these files, READ DOCUMENTATION FIRST:**

| File | Read This First |
|------|-----------------|
| `src/renderer/index.tsx` | `docs/fixes/bug-5-mac-sleep-wake-objects-reappear.md` |
| `src/main/index.ts` | Same doc (PowerMonitor section) |
| `src/renderer/components/layout/AppLayout.tsx` | Same doc (resume handler section) |
| `src/renderer/features/canvas/hooks/useLoadLines.ts` | `docs/fixes/SESSION-SUMMARY-2026-02-15-FINAL.md` |
| `src/renderer/features/canvas/ProductionCanvas.tsx` | Same doc |

**Questions:**
- [ ] Did you read the bug documentation?
- [ ] Do you understand why the current code exists?
- [ ] Is your change compatible with the fix?

---

### 5. Does your feature handle power events?

**If YES, answer:**
- [ ] Do you add listeners to `powerMonitor.onSuspend`? → Ensure WAL checkpoint
- [ ] Do you add listeners to `powerMonitor.onResume`? → **NEVER reload stores**
- [ ] Do you call refreshAllStores() on resume? → **NEVER DO THIS**

**Critical Pattern:**
```typescript
// ✅ CORRECT: Resume handler (Bug 5 fix v4)
powerMonitorApi.onResume(async () => {
  console.log('[AppLayout] Mac resumed from sleep');
  // DO NOT call refreshAllStores() - causes Bug 5
});

// ❌ WRONG: Reloading on resume
powerMonitorApi.onResume(async () => {
  await refreshAllStores(); // ← Bug 5 returns
});
```

---

## Post-Implementation Testing

**MANDATORY tests after implementing features:**

### Test 1: Bug 5 Regression Test
1. Create canvas objects
2. Delete some objects
3. Put Mac to sleep (close lid)
4. Wake Mac (Touch ID)
5. **VERIFY:** Deleted objects stay deleted
6. **VERIFY:** No console errors about "database connection is not open"

### Test 2: Bug 3-4 Regression Test
1. Create canvas objects
2. Navigate: Canvas → Models → Canvas
3. Click an object to select it
4. **VERIFY:** Selection stays (doesn't clear immediately)
5. **VERIFY:** No `commitHookEffectListMount` in console
6. Press Delete key
7. **VERIFY:** Object deletes on first attempt

### Test 3: Keyboard Delete + Navigate Regression Test (Phase 7.6)
1. Create canvas objects
2. Select an object
3. Press Backspace to delete
4. Navigate: Canvas → Models → Canvas
5. **VERIFY:** Deleted object does NOT reappear
6. **VERIFY:** No console error "Rendered fewer hooks than expected"

### Test 4: Combined Test
1. Create canvas objects
2. Navigate between tabs multiple times
3. Delete some objects
4. Put Mac to sleep
5. Wake Mac
6. **VERIFY:** All changes persisted
7. **VERIFY:** Selection still works
8. **VERIFY:** Can delete more objects

---

## Red Flags - Stop and Consult

**If you're about to write code that:**
- Calls `location.reload()` anywhere
- Removes/modifies the beforeunload handler
- Clears Zustand stores on wake/resume
- Uses `clearSelection()` in data loading hooks
- Uses `fitView` as a prop (not function)
- Deletes ReactFlow nodes in a for-loop
- Modifies any file in the Critical Files list

**STOP. Read the documentation. Ask the user if unsure.**

---

## Documentation References

| Bug | Documentation | Commit |
|-----|---------------|--------|
| Bug 5 (Mac sleep/wake) | `docs/fixes/bug-5-mac-sleep-wake-objects-reappear.md` | 2bcf5b3 |
| Bug 3-4 (ReactFlow remount) | `docs/fixes/SESSION-SUMMARY-2026-02-15-FINAL.md` | 3b39b70 |
| Bug 3-4 (Selection UX) | `docs/fixes/PENDING-BUGS.md` (Bug 3 section) | - |

---

**Last Updated:** 2026-02-17
**Mandatory for all agents implementing features**

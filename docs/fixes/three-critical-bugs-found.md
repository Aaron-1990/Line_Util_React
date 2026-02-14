# Six Critical Bugs Found in Canvas Object Management

**Date:** 2026-02-14
**Initial Discovery:** Copy/paste feature investigation
**Resolution Date:** 2026-02-14
**Time to Resolve:** ~8 hours (with agents + Framework Híbrido v2.0)
**Status:** ✅ ALL BUGS FIXED AND TESTED

---

## Summary

While investigating copy/paste issues, we discovered **6 critical, interrelated bugs** in canvas object management. These bugs created a perfect storm of state synchronization issues that made deletion appear to work for exactly 2 objects, then fail completely.

**The Bugs:**
1. useLoadLines infinite reload loop
2. Missing clearTempDatabase() after Save As
3. Incomplete revert in deleteObject()
4. onPaneClick clearing selection unconditionally
5. Nodes created without `selectable: true` property
6. Keyboard handler race condition (MOST CRITICAL)

**Final Symptom:** Delete key would work for exactly 2 objects, then stop working. Objects would reappear after tab changes.

**Complexity:** Even with AI agents and structured debugging framework, this took 8 hours to fully resolve. The bugs were deeply intertwined across multiple state management layers (ReactFlow + 3 Zustand stores).

---

## Bug 1: useLoadLines Infinite Reload Loop

### Severity
🔴 **CRITICAL** - Causes excessive database queries and poor performance

### Location
`src/renderer/features/canvas/hooks/useLoadLines.ts:23`

### Root Cause
```typescript
// WRONG - Subscribes to entire store
const { addNode, setNodes } = useCanvasStore();
```

This subscribes `useLoadLines` to **ALL** changes in `useCanvasStore`, including the `nodes` array. When `nodes` changes (create object, move object, etc.), `useLoadLines` re-executes:

1. Create object → `nodes` changes
2. `useLoadLines` detects change → re-executes
3. Calls `setNodes([])` → clears canvas
4. Loads from DB → `nodes` changes again
5. GOTO step 2 (infinite loop)

### Evidence
Terminal logs show excessive reloads:
```
[Canvas Object Handler] Getting objects by plant: T09B_QIqURcpdviI32-Rb  (×50+ times)
```

### Fix
Use specific selectors instead of destructuring:

```typescript
// CORRECT - Subscribe only to functions (stable references)
const addNode = useCanvasStore((state) => state.addNode);
const setNodes = useCanvasStore((state) => state.setNodes);
const setCanvasObjects = useCanvasObjectStore((state) => state.setObjects);
const setConnections = useCanvasObjectStore((state) => state.setConnections);
const currentPlantId = useNavigationStore((state) => state.currentPlantId);
```

Now `useLoadLines` only re-executes when `currentPlantId` changes (the intended behavior).

### Status
✅ **FIXED AND COMMITTED** - Lines 26, 28, 29, 106

---

## Bug 2: Missing clearTempDatabase() After Save As

### Severity
🟡 **HIGH** - Causes data leakage between projects

### Location
`src/main/services/project/ProjectFileService.ts` (method missing)

### Root Cause
When user does "Save As":
1. Current project saved to `.lop` file ✓
2. Database switched to `.lop` file ✓
3. **Temp DB never cleared** ❌
4. Next "New Project" loads temp DB with old data

### Evidence
User reports: "Untitled Project opens with objects from previous project"

### Fix
Add `clearTempDatabase()` method and call after Save As:

```typescript
async saveProjectAs(filePath: string): Promise<void> {
  // ... existing save logic ...

  DatabaseConnection.replaceInstance(newDb);

  // NEW: Clear temp database after successful Save As
  await this.clearTempDatabase();
}

private static async clearTempDatabase(): Promise<void> {
  const tempDbPath = DatabaseConnection.getDefaultPath();
  const tempDb = new Database(tempDbPath, { readonly: false });

  const tablesToClear = [
    'canvas_objects',
    'canvas_connections',
    'production_lines',
    'product_models_v2',
    'product_volumes',
    'line_model_compatibilities',
    'model_area_routing',
    'model_area_predecessors',
    'family_changeover_defaults',
    'line_changeover_overrides',
    'process_properties',
    'buffer_properties',
    'process_line_links',
    'canvas_object_compatibilities',
    'plants',
    'area_catalog',
  ];

  const clearAll = tempDb.transaction(() => {
    for (const table of tablesToClear) {
      tempDb.prepare(`DELETE FROM ${table}`).run();
    }
  });

  clearAll();
  tempDb.close();

  console.log('[ProjectFileService] Temp database cleared');
}
```

**IMPORTANT:** Do NOT clear system tables:
- `shape_catalog`
- `shape_categories`
- `shape_anchors`
- `user_preferences` (global settings)

### Status
✅ **FIXED AND COMMITTED** - Lines 617-687 in ProjectFileService.ts

---

## Bug 3: Incomplete Revert in deleteObject()

### Severity
🟡 **HIGH** - Causes "deleted objects reappear" issue

### Location
`src/renderer/features/canvas/store/useCanvasObjectStore.ts:223-256`

### Root Cause
When `deleteObject()` fails at IPC level, it reverts the object back to `useCanvasObjectStore.objects` but **forgets to revert the ReactFlow node**:

```typescript
deleteObject: async (objectId: string) => {
  // Optimistic update - remove from BOTH stores
  set({ objects: objects.filter((obj) => obj.id !== objectId) });
  useCanvasStore.getState().deleteNode(objectId);  // Remove from ReactFlow

  try {
    const response = await window.electronAPI.invoke(CANVAS_OBJECT_CHANNELS.DELETE, objectId);

    if (!response.success) {
      // INCOMPLETE REVERT - only reverts to useCanvasObjectStore!
      set({ objects: [...get().objects, objectToDelete] });
      // ❌ MISSING: Does not add node back to ReactFlow
      alert(`Failed to delete object: ${response.error}`);
    }
  } catch (error) {
    // INCOMPLETE REVERT
    set({ objects: [...get().objects, objectToDelete] });
    // ❌ MISSING: Does not add node back to ReactFlow
    alert('Failed to delete object. Please try again.');
  }
}
```

This causes desynchronization:
- Object exists in `useCanvasObjectStore.objects` ✓
- Object missing from `useCanvasStore.nodes` ❌
- Next delete attempt: "Node not found for deletion"
- Changing views reloads from DB → object "reappears"

### Evidence
DevTools logs show:
```
[ProductionCanvas] Node not found for deletion: yyMHtlyLh5LwmlIGOkOwC
```

But terminal shows NO corresponding:
```
[Canvas Object Handler] Deleting object: yyMHtlyLh5LwmlIGOkOwC  <-- Missing!
```

### Fix
Revert to BOTH stores on error:

```typescript
if (!response.success) {
  console.error('[CanvasObjectStore] Delete failed:', response.error);
  // Revert on error - add object back to BOTH stores
  set({ objects: [...get().objects, objectToDelete] });
  useCanvasStore.getState().addNode({
    id: objectToDelete.id,
    type: 'genericShape',
    position: { x: objectToDelete.xPosition, y: objectToDelete.yPosition },
    data: objectToDelete,
  });
  alert(`Failed to delete object: ${response.error}`);
} else {
  markProjectUnsaved();
}
```

Apply same fix to catch block (lines 250-255).

Also add canvas reload after successful deletion:
```typescript
} else {
  markProjectUnsaved();

  // Reload canvas to sync all stores (ReactFlow, useCanvasStore, useCanvasObjectStore)
  await get().loadObjectsForPlant(objectToDelete.plantId);
}
```

### Status
✅ **FIXED AND COMMITTED** - Lines 242-280 in useCanvasObjectStore.ts

---

## Bug 4: onPaneClick Clearing Selection Unconditionally

### Severity
🟡 **HIGH** - Prevents node selection via click

### Location
`src/renderer/features/canvas/ProductionCanvas.tsx:565-577`

### Root Cause
The `onPaneClick` handler was clearing selection on **every click**, even when clicking on nodes themselves (due to React event bubbling):

```typescript
// WRONG - Clears selection even when clicking nodes
const onPaneClick = useCallback(async (event: React.MouseEvent) => {
  setSelectedNode(null);
  clearSelection(); // ← Runs even when clicking nodes
  // ...
});
```

### Evidence
- User could click nodes but selection wouldn't persist
- DevTools showed selection being cleared immediately after setting

### Fix
Only clear selection when actually clicking the pane background:

```typescript
const onPaneClick = useCallback(async (event: React.MouseEvent) => {
  // Only clear selection if clicking on the actual pane, not on nodes
  const target = event.target as HTMLElement;
  const isClickOnPane = target.classList.contains('react-flow__pane');

  if (isClickOnPane) {
    setSelectedNode(null);
    clearSelection();
  }

  setContextMenu(null);
  setEdgeContextMenu(null);
  // ...
});
```

### Status
✅ **FIXED AND COMMITTED** - Lines 565-577 in ProductionCanvas.tsx

---

## Bug 5: Nodes Created Without `selectable: true`

### Severity
🟡 **HIGH** - Nodes appear on canvas but cannot be selected

### Location
Multiple files:
- `ProductionCanvas.tsx` (placement mode)
- `ContextMenu.tsx` (duplicate operations)
- `useCanvasObjectStore.ts` (revert logic)
- `useLoadLines.ts` (initial load)

### Root Cause
When creating ReactFlow nodes, the `selectable` and `draggable` properties were not being set, causing ReactFlow to default to `selectable: false`:

```typescript
// WRONG - Missing selectable/draggable
addNode({
  id: newObjectId,
  type: 'genericShape',
  position: { x: xPos, y: yPos },
  data: objectData,
  // ❌ Missing: selectable and draggable
});
```

### Evidence
- Nodes appeared visually on canvas
- Clicking them had no effect (no selection highlight)
- Delete key couldn't find selected nodes because `node.selected` was always `false`

### Fix
Add `selectable: true` and `draggable: true` to **all 8 locations** where nodes are created:

```typescript
// CORRECT - Enable ReactFlow selection
addNode({
  id: newObjectId,
  type: 'genericShape',
  position: { x: xPos, y: yPos },
  data: objectData,
  selectable: true, // Enable ReactFlow selection
  draggable: true,  // Enable dragging
});
```

### Files Modified
1. `ProductionCanvas.tsx` - Lines 696-712 (placement mode)
2. `ProductionCanvas.tsx` - Lines 343-349 (delete revert - not needed, handled differently)
3. `ContextMenu.tsx` - Line 275 (duplicate)
4. `ContextMenu.tsx` - Line 335 (copy/paste)
5. `useCanvasObjectStore.ts` - Lines 246-253 (error revert)
6. `useCanvasObjectStore.ts` - Lines 263-270 (exception revert)
7. `useLoadLines.ts` - Lines 74-81 (initial load)

### Status
✅ **FIXED AND COMMITTED** - All node creation sites updated

---

## Bug 6: Keyboard Handler Race Condition (MOST CRITICAL)

### Severity
🔴 **CRITICAL** - Delete key completely non-functional

### Location
`src/renderer/features/canvas/ProductionCanvas.tsx:315-379`

### Root Cause
The keyboard event listener was caught in an **infinite re-execution loop** due to an unstable dependency in the useEffect:

```typescript
// WRONG - 'nodes' causes infinite re-execution
useEffect(() => {
  const handleKeyDown = async (event: KeyboardEvent) => {
    // handler code
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [getNodes, nodes]); // ← 'nodes' array reference changes on EVERY state update
```

### The Mechanism of Failure

**Zustand Store Mutation Detection:**
- `nodes` comes from `useCanvasStore()`
- Every time ANY node updates (position, selection, etc.), Zustand creates a NEW array reference
- This is standard Zustand behavior (immutability)

**The Infinite Loop:**
```
Effect runs → adds event listener
↓
User interacts with canvas → node position/selection updates
↓
Zustand emits new nodes array (different reference)
↓
Effect dependency [nodes] detects change
↓
useEffect cleanup runs → removes listener
↓
useEffect runs again → adds listener back
↓
... (repeats constantly during interaction)
```

**Race Condition Window:**
- During the cleanup/re-registration cycle, there's a window where the listener is removed but not yet re-added
- Keyboard events are synchronous, listener registration is async (microtask)
- If user presses Delete during this window → **NO HANDLER ATTACHED** → NO EXECUTION

**Why Exactly 2 Deletions Worked:**
This was coincidental timing, not a hard limit. After 2 successful deletions, enough state updates had accumulated that the race condition window became large enough to consistently catch Delete key presses.

### Evidence
**Terminal logs:**
```
[Canvas Object Handler] Creating object: ... (×5)  ✓
[Canvas Object Handler] Deleting object: ...       ✗ (MISSING - handler never fired)
```

**DevTools logs:**
```
[ProductionCanvas] Delete pressed ...  ✗ (MISSING - handler never executed)
```

**No errors, no warnings** - the event listener was simply not attached when Delete was pressed.

### Fix
Remove the unstable `nodes` dependency:

```typescript
// CORRECT - Only stable reference
useEffect(() => {
  const handleKeyDown = async (event: KeyboardEvent) => {
    const reactFlowNodes = getNodes(); // ← Called at execution time, not in closure
    const selectedNodes = reactFlowNodes.filter((node) => node.selected);
    // ... deletion logic
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [getNodes]); // ← IMPORTANT: Only stable ref. DO NOT add 'nodes'
```

**Why this works:**
1. `getNodes` from `useReactFlow()` is a stable reference (never changes)
2. The handler calls `getNodes()` at execution time → always gets fresh state
3. Effect runs once on mount → listener stays attached for component's entire lifecycle
4. No cleanup/re-registration loop → no race condition window

**Pattern Validation:**
This matches the **working Copy/Paste handler** (lines 413-471) which uses only stable function references in dependencies.

### Status
✅ **FIXED AND COMMITTED** - Line 379 in ProductionCanvas.tsx

### Critical Learning
**NEVER put Zustand state arrays in React useEffect dependencies** - they change reference on every state update, causing infinite re-execution loops. Use selector functions or read state via `.getState()` inside the effect instead.

---

## Root Cause Analysis

All 6 bugs share a common pattern: **Incomplete state synchronization between multiple state layers**.

### The Four State Layers

This application manages state across 4 distinct layers:

1. **ReactFlow Internal State** - Node positions, selection, edges (managed by ReactFlow library)
2. **useCanvasStore** (Zustand) - ReactFlow node proxies, selected node
3. **useCanvasObjectStore** (Zustand) - Business objects from database
4. **useToolStore** (Zustand) - UI tool state, selected object IDs

### How The Bugs Interconnected

```
Bug 6 (Race Condition)
  ↓ Delete handler never fires
  ↓
Bug 5 (Missing selectable)
  ↓ Even when handler fires, nodes not selectable
  ↓
Bug 4 (onPaneClick)
  ↓ Even when selectable, selection gets cleared
  ↓
Bug 3 (Incomplete revert)
  ↓ On error, ReactFlow node not restored
  ↓
Bug 1 (Infinite reload)
  ↓ Canvas constantly reloading, disrupting state
  ↓
Bug 2 (Missing clearTempDatabase)
  ↓ Deleted objects reappear from stale temp DB
```

### Why This Was So Difficult

1. **Symptom Misleading:** "Works for 2 deletions, then fails" suggested a counter or limit bug
2. **Silent Failures:** Race condition caused handler to not fire at all - no errors, no logs
3. **Multiple Layers:** Each bug alone was manageable, but together they masked each other
4. **State Drift:** ReactFlow's internal state gradually desynchronized from Zustand stores
5. **Timing Dependent:** Race conditions are notoriously hard to debug (non-deterministic)

---

## Actual Fix Order (What We Did)

The bugs were discovered and fixed in this order:

1. **Bug 1 (useLoadLines)** - Quick win, stopped infinite reload loops
2. **Bug 2 (clearTempDatabase)** - Prevented data leakage between projects
3. **Bug 3 (deleteObject revert)** - Completed error handling for both stores
4. **Bug 4 (onPaneClick)** - Fixed selection being cleared on node clicks
5. **Bug 5 (Missing selectable)** - Enabled ReactFlow selection on all nodes
6. **Bug 6 (Race condition)** - Fixed the root cause preventing Delete from working

**Critical Insight:** We initially thought Bug 5 was the root cause (deletion worked for 2 objects after this fix), but Bug 6 was the actual culprit. This demonstrates how interrelated bugs can mask each other.

## Recommended Fix Order (For Future Similar Issues)

If encountering similar state synchronization bugs:

1. **Start with event listeners** - Check useEffect dependencies for unstable references (Bug 6)
2. **Verify ReactFlow properties** - Ensure `selectable`, `draggable` set correctly (Bug 5)
3. **Check event handlers** - Validate click handlers don't clear state prematurely (Bug 4)
4. **Fix store synchronization** - Use specific selectors, not destructuring (Bug 1)
5. **Complete optimistic updates** - Revert to ALL stores on error (Bug 3)
6. **Clean up state transitions** - Clear temp data when switching contexts (Bug 2)

---

## Testing Protocol

After implementing all fixes, **ALL tests passed successfully** on 2026-02-14:

### Test 1: Object Creation/Deletion (PRIMARY TEST) ✅ PASSED
**Purpose:** Validate all 6 bugs are fixed

1. Restart app (fresh state)
2. Create 5 objects on canvas
3. Select each object individually
4. Press Delete key for each one
5. **Expected:** All 5 deletions succeed
6. **Verify in terminal:**
   ```
   [Canvas Object Handler] Creating object: New Rectangle (×5)
   [Canvas Object Handler] Deleting object: [id1]
   [Canvas Object Handler] Getting objects by plant: ...
   [Canvas Object Handler] Deleting object: [id2]
   [Canvas Object Handler] Getting objects by plant: ...
   [Canvas Object Handler] Deleting object: [id3]
   [Canvas Object Handler] Getting objects by plant: ...
   [Canvas Object Handler] Deleting object: [id4]
   [Canvas Object Handler] Getting objects by plant: ...
   [Canvas Object Handler] Deleting object: [id5]
   [Canvas Object Handler] Getting objects by plant: ...
   ```
7. Switch to Models tab → back to Canvas
8. **Expected:** Canvas is empty (no objects reappear)

**Result:** ✅ ALL 5 deletions worked, canvas remained empty after tab switch

**What This Validates:**
- ✅ Bug 1 fixed: No infinite reload loops (controlled DB queries)
- ✅ Bug 2 fixed: Objects don't reappear from temp DB
- ✅ Bug 3 fixed: Deletion reaches database (no revert)
- ✅ Bug 4 fixed: Nodes can be selected via click
- ✅ Bug 5 fixed: All nodes are selectable
- ✅ Bug 6 fixed: Delete key handler fires every time

### Test 2: Save As Workflow ✅ PASSED
**Purpose:** Validate Bug 2 (clearTempDatabase) is fixed

1. Create objects in Untitled Project
2. File → Save As → "test.lop"
3. Close app
4. Reopen app
5. **Expected:** Untitled Project is empty (no old data from previous project)

**Result:** ✅ Untitled Project opens empty

### Test 3: Performance ✅ PASSED
**Purpose:** Validate Bug 1 (infinite reload loop) is fixed

1. Create 1 object
2. Move it around canvas (drag multiple times)
3. Check terminal logs
4. **Expected:** Minimal DB queries (1-2 per action, not 50+)

**Result:** ✅ Normal DB query pattern observed

### Test 4: Selection Persistence ✅ PASSED
**Purpose:** Validate Bug 4 (onPaneClick) is fixed

1. Create object
2. Click on object → verify selection highlight appears
3. Click on canvas background → verify selection clears
4. Click on object again → verify selection works
5. **Expected:** Selection only clears when clicking actual pane, not on nodes

**Result:** ✅ Selection behavior correct

### Test 5: Multi-Delete Stress Test ✅ PASSED
**Purpose:** Validate Bug 6 (race condition) is completely eliminated

1. Create 10 objects
2. Rapidly delete all 10 using Delete key (rapid succession)
3. **Expected:** All 10 deletions succeed (no "works for 2 then fails" pattern)

**Result:** ✅ All deletions succeeded regardless of speed

---

## Framework Compliance

These fixes follow **Framework Híbrido v2.0**:
- ✅ **Contracts-First:** No new interfaces needed (fixing existing code)
- ✅ **No Workarounds:** Using standard Zustand patterns
- ✅ **Proper Error Handling:** Complete revert logic on failures

---

## Lessons Learned

### What Made This So Difficult

1. **Silent Failures:** Bug 6 (race condition) caused the handler to not execute at all - no errors, no warnings, no logs
2. **Misleading Pattern:** "Works for 2, fails on 3rd" suggested a counter/limit bug, not a race condition
3. **Multiple Layers:** ReactFlow + 3 Zustand stores + database = 5 layers of state to keep synchronized
4. **Masked Bugs:** Each bug masked others (fixing Bug 5 partially worked, hiding Bug 6)
5. **Timing Dependent:** Race conditions are non-deterministic and hard to reproduce consistently

### Time Investment

**Total Resolution Time:** ~8 hours with AI agents + Framework Híbrido v2.0

**Breakdown:**
- Investigation (Explore agents): ~3 hours
- Implementation (fullstack-developer agents): ~2 hours
- Testing iterations: ~2 hours
- Documentation: ~1 hour

**Without structured approach:** Estimated 15-20 hours (or potentially abandoned as "unsolvable")

### Why Even Experienced Developers Would Struggle

1. **React + Zustand + ReactFlow expertise required** - Rare combination of deep knowledge
2. **Race conditions are notoriously hard to debug** - Timing-dependent, non-deterministic
3. **No stack traces or errors** - Silent failure mode makes root cause invisible
4. **Multiple interacting bugs** - Fixing one reveals another, creating false confidence
5. **State synchronization across libraries** - ReactFlow's internal state + Zustand external state

---

## Critical Patterns to Follow

### ✅ DO: Zustand Store Selectors (Prevent Bug 1)

```typescript
// CORRECT - Specific selectors
const setNodes = useCanvasStore((state) => state.setNodes);
const currentPlantId = useNavigationStore((state) => state.currentPlantId);
```

```typescript
// WRONG - Destructuring entire store
const { nodes, edges, setNodes } = useCanvasStore();
```

**Why:** Destructuring subscribes to ALL state changes. Selectors only subscribe to specific values.

### ✅ DO: Stable Dependencies in useEffect (Prevent Bug 6)

```typescript
// CORRECT - Only stable function references
useEffect(() => {
  const handler = () => {
    const freshState = getState(); // Read at execution time
    // ... use freshState
  };
  document.addEventListener('event', handler);
  return () => document.removeEventListener('event', handler);
}, [getState]); // getState is stable
```

```typescript
// WRONG - Array/object state in dependencies
useEffect(() => {
  // ...
}, [nodes, edges]); // ← These change reference constantly!
```

**Why:** Zustand arrays/objects get new references on every state update → infinite re-execution.

### ✅ DO: Synchronize All State Layers (Prevent Bug 3)

```typescript
// CORRECT - Update ALL stores on changes
const deleteObject = async (id: string) => {
  // Optimistic update to BOTH stores
  set({ objects: objects.filter(obj => obj.id !== id) });
  useCanvasStore.getState().deleteNode(id);

  try {
    const result = await api.delete(id);
    if (!result.success) {
      // Revert to BOTH stores
      set({ objects: [...get().objects, originalObject] });
      useCanvasStore.getState().addNode({...});
    }
  } catch {
    // Revert to BOTH stores
  }
};
```

```typescript
// WRONG - Only updates one store
const deleteObject = async (id: string) => {
  set({ objects: objects.filter(obj => obj.id !== id) });
  // ❌ Forgot to update ReactFlow store!
};
```

**Why:** Multi-store architecture requires updates to ALL stores or they desynchronize.

### ✅ DO: Set ReactFlow Node Properties (Prevent Bug 5)

```typescript
// CORRECT - Explicit properties
addNode({
  id: 'node-1',
  type: 'genericShape',
  position: { x: 0, y: 0 },
  data: {...},
  selectable: true,  // ← REQUIRED
  draggable: true,   // ← REQUIRED
});
```

```typescript
// WRONG - Missing properties
addNode({
  id: 'node-1',
  type: 'genericShape',
  position: { x: 0, y: 0 },
  data: {...},
  // ❌ Missing selectable/draggable → defaults to false
});
```

**Why:** ReactFlow defaults to `selectable: false` if not specified.

### ✅ DO: Check Event Target (Prevent Bug 4)

```typescript
// CORRECT - Verify click target
const onPaneClick = (event: React.MouseEvent) => {
  const target = event.target as HTMLElement;
  const isClickOnPane = target.classList.contains('react-flow__pane');

  if (isClickOnPane) {
    clearSelection(); // Only clear if clicking background
  }
};
```

```typescript
// WRONG - Always clears selection
const onPaneClick = () => {
  clearSelection(); // ❌ Runs even when clicking nodes (event bubbles)
};
```

**Why:** React events bubble up. Clicking a node triggers onPaneClick too.

### ✅ DO: Reload Canvas After Mutations (Prevent Bug 3)

```typescript
// CORRECT - Reload to sync state
async deleteObject(id: string) {
  // ... deletion logic
  if (response.success) {
    await get().loadObjectsForPlant(plantId); // ← Reload canvas
  }
}
```

```typescript
// WRONG - No reload
async deleteObject(id: string) {
  // ... deletion logic
  // ❌ Canvas state becomes stale
}
```

**Why:** Reloading ensures ReactFlow internal state syncs with Zustand stores.

---

## Anti-Patterns to Avoid

### ❌ DON'T: Put Zustand Arrays/Objects in useEffect Dependencies

**Never do this:**
```typescript
const nodes = useCanvasStore((state) => state.nodes);
useEffect(() => {
  // ...
}, [nodes]); // ❌ WRONG - 'nodes' reference changes constantly
```

**Why:** Causes infinite re-execution loop (Bug 6).

### ❌ DON'T: Assume ReactFlow Properties Default to True

**Wrong assumption:**
```typescript
addNode({ id, type, position, data }); // ❌ Assumes selectable=true
```

**Why:** ReactFlow defaults to `selectable: false`. Always set explicitly (Bug 5).

### ❌ DON'T: Trust Event Handlers Without Target Checks

**Dangerous pattern:**
```typescript
const onPaneClick = () => {
  clearSelection(); // ❌ Runs even when clicking nodes
};
```

**Why:** Event bubbling causes parent handlers to fire for child elements (Bug 4).

### ❌ DON'T: Forget to Reload After Backend Mutations

**Incomplete pattern:**
```typescript
async mutateData() {
  await api.update(...);
  // ❌ Missing: reload to sync state
}
```

**Why:** Frontend state drifts from backend (Bug 3).

### ❌ DON'T: Destructure Entire Zustand Stores

**Performance killer:**
```typescript
const { nodes, edges, setNodes, setEdges, selectedNode } = useCanvasStore();
```

**Why:** Component re-renders on EVERY store change, not just relevant changes (Bug 1).

---

## Code Review Checklist

Use this checklist when reviewing canvas-related code:

**State Management:**
- [ ] Zustand selectors used (not destructuring entire store)
- [ ] No arrays/objects in useEffect dependencies
- [ ] All stores synchronized on mutations

**ReactFlow Integration:**
- [ ] All nodes have `selectable: true` and `draggable: true`
- [ ] Event handlers check `event.target` before clearing state
- [ ] Canvas reloads after backend mutations

**Event Listeners:**
- [ ] useEffect dependencies are stable function references
- [ ] Cleanup functions remove listeners properly
- [ ] No race conditions (rapid add/remove cycles)

**Error Handling:**
- [ ] Optimistic updates revert to ALL stores on error
- [ ] User gets feedback on failures (alerts/toasts)
- [ ] Logs include enough context for debugging

---

## Related Documentation

- Canvas save/load fix: `docs/fixes/fix-canvas-save-load-and-shapes.md`
- Critical code sections: `.claude/CLAUDE.md` lines 36-64
- Zustand store patterns: Check store implementations in `src/renderer/*/store/`
- ReactFlow documentation: https://reactflow.dev/learn

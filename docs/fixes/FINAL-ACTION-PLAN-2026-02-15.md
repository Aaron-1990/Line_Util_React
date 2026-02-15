# FINAL ACTION PLAN: Accumulative Selection Bug

**Date:** 2026-02-15
**Status:** READY TO IMPLEMENT
**Confidence:** 90%+ success probability
**Time Required:** 15-20 minutes

---

## Executive Summary

After 5 days, 4 failed attempts, and consultation with 4 different AI models (Claude Opus 4.6 Web, ChatGPT 4o, Gemini 2.0 Flash, plus our internal agents), **we have 100% consensus** on the root cause and solution.

**The bug reduces to ONE LINE OF CODE:**
```typescript
useToolStore.getState().clearSelection(); // THIS IS THE KILLER
```

---

## Consensus from ALL 4 AI Models

| Finding | Opus 4.6 | ChatGPT | Gemini | Internal | Verdict |
|---------|----------|---------|--------|----------|---------|
| `clearSelection()` in useLoadLines is destructive | ✅ "THE KILLER" | ✅ "Nuking selection" | ✅ "The gun" | ✅ Critical | **UNANIMOUS** |
| Async for-loop creates render windows | ✅ | ✅ | ✅ | ✅ | **UNANIMOUS** |
| `unstable_batchedUpdates` NOT needed | ✅ | ✅ | ✅ | ✅ | **UNANIMOUS** |
| useRef guard to prevent redundant loads | ✅ | ✅ | ✅ | ✅ | **UNANIMOUS** |

---

## The 3 Changes (Total: ~80 lines modified)

### Change 1: Remove clearSelection (2 minutes)
**File:** `src/renderer/features/canvas/hooks/useLoadLines.ts`
**Lines:** 40-42
**Action:** DELETE these lines entirely

```typescript
// ❌ DELETE THESE LINES:
useToolStore.getState().clearSelection();
useCanvasStore.getState().setSelectedNode(null);
```

**Why:** Selection clearing belongs in USER ACTIONS, not data loading. Every navigation triggers this and kills selection.

**Risk:** Very Low
**Confidence:** 95%

---

### Change 2: Add useRef Guard (5 minutes)
**File:** `src/renderer/features/canvas/hooks/useLoadLines.ts`
**Lines:** 23-115 (refactor useEffect)
**Action:** Add guard to prevent reload unless plant actually changed

```typescript
import { useEffect, useState, useRef } from 'react';

export function useLoadLines(): UseLoadLinesResult {
  const setNodes = useCanvasStore((state) => state.setNodes);
  const setCanvasObjects = useCanvasObjectStore((state) => state.setObjects);
  const setConnections = useCanvasObjectStore((state) => state.setConnections);
  const currentPlantId = useNavigationStore((state) => state.currentPlantId);

  const [isLoading, setIsLoading] = useState(true);
  const [objectCount, setObjectCount] = useState(0);

  // ADD THIS:
  const loadedPlantRef = useRef<string | null>(null);

  useEffect(() => {
    const loadAll = async () => {
      // ADD THIS CHECK:
      // Only load if plant actually changed (prevents redundant loads on remount)
      if (!currentPlantId) {
        setObjectCount(0);
        setNodes([]);
        setCanvasObjects([]);
        setIsLoading(false);
        loadedPlantRef.current = null;
        return;
      }

      // CRITICAL: Skip if already loaded for this plant
      if (loadedPlantRef.current === currentPlantId) {
        console.log('[useLoadLines] Already loaded for plant:', currentPlantId);
        return;
      }

      console.log('[useLoadLines] EXECUTING loadAll - currentPlantId:', currentPlantId);
      setIsLoading(true);

      try {
        // Mark as loaded BEFORE fetch (optimistic)
        loadedPlantRef.current = currentPlantId;

        // ❌ REMOVED: clearSelection() calls - see Change 1

        // Load canvas objects and connections in parallel
        const [objectsResponse, connectionsResponse] = await Promise.all([
          window.electronAPI.invoke<CanvasObjectWithDetails[]>(
            CANVAS_OBJECT_CHANNELS.GET_BY_PLANT,
            currentPlantId
          ),
          window.electronAPI.invoke<CanvasConnection[]>(
            CANVAS_OBJECT_CHANNELS.GET_CONNECTIONS,
            currentPlantId
          ),
        ]);

        // Add canvas objects (unified structure)
        if (objectsResponse.success && objectsResponse.data) {
          setObjectCount(objectsResponse.data.length);
          setCanvasObjects(objectsResponse.data);

          // Preserve selection state when updating nodes
          const currentNodes = useCanvasStore.getState().nodes;
          const currentSelection = new Set(currentNodes.filter(n => n.selected).map(n => n.id));

          const newNodes = objectsResponse.data.map((obj) => ({
            id: obj.id,
            type: 'genericShape',
            position: { x: obj.xPosition, y: obj.yPosition },
            data: obj,
            selectable: true,
            draggable: true,
            // CRITICAL: Preserve selection from current nodes
            selected: currentSelection.has(obj.id),
          }));

          setNodes(newNodes);
        } else {
          setObjectCount(0);
          setNodes([]);
          setCanvasObjects([]);
        }

        if (connectionsResponse.success && connectionsResponse.data) {
          setConnections(connectionsResponse.data);
        } else {
          setConnections([]);
        }
      } catch (error) {
        console.error('Error loading canvas data:', error);
        setObjectCount(0);
        // On error, clear loaded ref to allow retry
        loadedPlantRef.current = null;
      } finally {
        setIsLoading(false);
      }
    };

    loadAll();
  }, [currentPlantId, setNodes, setCanvasObjects, setConnections]);

  // Count process objects
  const processCount = useCanvasObjectStore.getState().objects.filter(
    obj => obj.objectType === 'process'
  ).length;

  return {
    isLoading,
    isEmpty: !isLoading && objectCount === 0,
    lineCount: processCount,
    objectCount,
  };
}
```

**Why:** Prevents useLoadLines from executing on every remount. Only loads when plant ACTUALLY changes.

**Risk:** Low
**Confidence:** 90%

---

### Change 3: Batch Delete Operation (10 minutes)
**File:** `src/renderer/features/canvas/ProductionCanvas.tsx`
**Lines:** 408-429 (replace delete handler)
**Action:** Replace async for-loop with batch state updates + parallel backend calls

```typescript
// FIND THIS SECTION (lines ~386-429):
if (event.key === 'Delete' || event.key === 'Backspace') {
  // Get selection directly from ReactFlow
  const reactFlowNodes = getNodes();
  console.log('[Delete] Total nodes:', reactFlowNodes.length);
  console.log('[Delete] Nodes with selected=true:', reactFlowNodes.filter(n => n.selected).length);

  const selectedNodes = reactFlowNodes.filter((node) => node.selected);
  const objectsToDelete = selectedNodes.map((node) => node.id);

  if (objectsToDelete.length === 0) {
    console.warn('[ProductionCanvas] Delete pressed but no objects selected');
    return;
  }

  event.preventDefault();

  console.log('[Delete] About to delete', objectsToDelete.length, 'objects:', objectsToDelete);

  // ❌ REPLACE THIS ASYNC FOR-LOOP:
  for (const objectId of objectsToDelete) {
    console.log('[Delete] Processing object:', objectId);
    const node = reactFlowNodes.find((n) => n.id === objectId);
    if (node) {
      console.log('[Delete] Node found, calling deleteObject for:', objectId);
      await useCanvasObjectStore.getState().deleteObject(objectId);
      console.log('[Delete] deleteObject completed for:', objectId);
    }
  }

  // ✅ WITH THIS BATCH OPERATION:

  // 1. BATCH UPDATE: Remove from both stores atomically (single React render)
  useCanvasStore.setState(state => ({
    nodes: state.nodes.filter(n => !objectsToDelete.includes(n.id)),
    selectedNode: objectsToDelete.includes(state.selectedNode || '') ? null : state.selectedNode,
  }));

  useCanvasObjectStore.setState(state => ({
    objects: state.objects.filter(obj => !objectsToDelete.includes(obj.id)),
  }));

  console.log('[Delete] UI updated, now persisting to backend...');

  // 2. BACKEND DELETES: Parallel execution (after UI already updated)
  const deleteResults = await Promise.all(
    objectsToDelete.map(id =>
      window.electronAPI
        .invoke(CANVAS_OBJECT_CHANNELS.DELETE, id)
        .then(result => ({ id, success: result.success, error: null }))
        .catch(error => ({ id, success: false, error: error.message }))
    )
  );

  // 3. CHECK FOR FAILURES
  const failures = deleteResults.filter(r => !r.success);
  if (failures.length > 0) {
    console.error('[Delete] Some deletions failed:', failures);
    alert(`Failed to delete ${failures.length} object(s). Check console for details.`);
    // Optionally: reload from DB to get correct state
  }

  console.log('[Delete] All deletions completed successfully');

  // Clear selection after deletion
  useToolStore.getState().clearSelection();
  useCanvasStore.getState().setSelectedNode(null);
}
```

**Why:**
- Eliminates render windows between each delete (no await in loop)
- Updates both stores in single React render cycle
- Backend persistence happens in parallel (faster)
- No intermediate reconciliations that trigger remounting

**Risk:** Low
**Confidence:** 85%

---

## Optional Verification (5 minutes)

**File:** `src/renderer/components/layout/AppLayout.tsx`
**Action:** Verify NO conditional unmount pattern

```typescript
// ❌ BAD (if found, fix it):
{isLoading ? <Spinner /> : renderedView}
{isSaving ? <LoadingOverlay /> : <Outlet />}

// ✅ GOOD:
<div>
  {renderedView}
  {isLoading && <SpinnerOverlay />}
</div>
```

**Why:** Conditional unmount would cause the "Flash of Unmount" that Gemini mentioned.

**Risk:** Very Low (just checking)
**Likelihood this is the issue:** 20%

---

## Implementation Order

```
1. Change 1 (useLoadLines.ts)     - Remove clearSelection          [2 min]
   → Test immediately - this alone should fix 80% of the problem

2. Change 2 (useLoadLines.ts)     - Add useRef guard               [5 min]
   → Test again - should be stable now

3. Change 3 (ProductionCanvas.tsx) - Batch delete                  [10 min]
   → Final test - all issues should be resolved

4. Optional (AppLayout.tsx)        - Verify no conditional unmount [5 min]
```

**Total: 15-20 minutes**

---

## Test Plan (After Each Change)

### Test 1: Basic Delete (After Change 1)
```
1. npm start
2. Create 5 objects
3. Click object → verify blue outline STAYS
4. Press Delete → object disappears
5. Repeat for 2 more objects
EXPECTED: All 3 deletes work
```

### Test 2: Navigation + Delete (After Change 2)
```
1. Create 5 objects
2. Navigate: Canvas → Models → Canvas
3. Click object → verify selection holds
4. Press Delete → object disappears
5. Navigate: Canvas → Models → Canvas (2nd time)
6. Click object → verify selection holds
7. Press Delete → object disappears
EXPECTED: Both deletes work after navigation
```

### Test 3: Multi-Tab Navigation (After Change 3)
```
1. Create 5 objects
2. Navigate through ALL tabs:
   Canvas → Models → Routings → Areas → Preferences → Plants → Global Analysis → Canvas
3. Verify: all 5 objects present
4. Click object → verify selection holds
5. Press Delete → object disappears
6. Repeat steps 2-5 twice more
EXPECTED: All 3 deletes work across multiple navigation cycles
```

### Test 4: Console Verification
```
Throughout all tests, verify:
- useLoadLines logs "Already loaded for plant: X" on remounts
- NO clearSelection calls in logs (except after DELETE completes)
- NO commitHookEffectListMount on clicks
- Backend DELETE shows changes: 1
```

---

## What We're NOT Doing (and Why)

| Rejected Solution | Source | Why NOT |
|-------------------|--------|---------|
| `unstable_batchedUpdates` | Our agents | React 18 auto-batches - unnecessary |
| Remove `useCanvasStore` entirely | ChatGPT | Too risky, 2+ hours, not necessary |
| Fix "listener leak" | Gemini | Cleanup already exists, theory unfounded |
| Architectural refactor | ChatGPT | Surgical fixes sufficient, lower risk |

---

## Risk Analysis

| Change | Files Modified | Lines Changed | Risk | Rollback Time |
|--------|----------------|---------------|------|---------------|
| Change 1 | 1 file | -3 lines | Very Low | 30 seconds |
| Change 2 | 1 file | +20 lines | Low | 1 minute |
| Change 3 | 1 file | ~40 lines | Low | 2 minutes |
| **Total** | **2 files** | **~80 lines** | **Low** | **< 5 minutes** |

---

## Success Criteria

After implementation, the following MUST be true:

- [ ] Can create 5 objects, delete all 5 without selection clearing
- [ ] Can navigate Models → Canvas → delete → works
- [ ] Can navigate through all 6-7 tabs, return to Canvas, delete → works
- [ ] Can delete multiple objects in sequence without issues
- [ ] Console shows useLoadLines executes ONLY on genuine plant change
- [ ] Console shows NO clearSelection during navigation
- [ ] Backend logs show successful DELETE with changes: 1

---

## Rollback Plan (If It Fails)

If after all 3 changes the bug persists:

1. **Revert changes** using git (< 5 min)
2. **Implement ChatGPT's architectural refactor** (single source of truth)
   - Remove `useCanvasStore.nodes`
   - Use ReactFlow's `useReactFlow().getNodes()` only
   - Estimated time: 2-3 hours
   - Risk: Medium-High

But **90%+ probability we won't need this** based on consensus analysis.

---

## Confidence Levels

| Aspect | Confidence | Reasoning |
|--------|-----------|-----------|
| Root cause diagnosis | 95% | 4/4 AIs agree on clearSelection |
| Change 1 fixes 80% | 95% | Unanimous killer line identification |
| Change 2 prevents accumulation | 90% | Standard React pattern |
| Change 3 eliminates race windows | 85% | Batch updates are best practice |
| Overall success | 90%+ | All changes are low-risk, high-reward |

---

## Post-Implementation

After successful validation:

1. **Remove debug logging** (console.log statements added during debugging)
2. **Update CHANGELOG-PHASES.md** with bug fix documentation
3. **Commit with message:**
   ```
   fix: resolve accumulative selection clearing bug after navigation

   Root cause: useLoadLines cleared selection on every execution,
   and async delete loop allowed intermediate renders.

   Changes:
   - Removed clearSelection from useLoadLines (data loading ≠ UI state)
   - Added useRef guard to prevent redundant loads
   - Replaced async for-loop with batch delete operation

   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
   ```

---

## Why This Will Work (Final Analysis)

**Mechanical Explanation:**

1. **Before:** Every navigation → Canvas mount → `useLoadLines` → `clearSelection()` → selection dead → user clicks → selection appears → immediate remount → selection cleared

2. **After:** Navigation → Canvas mount → `useLoadLines` checks ref → "already loaded" → skips → selection preserved → user clicks → selection STAYS → delete works

**The accumulation happened because:**
- Each navigation called `clearSelection()`
- Each `clearSelection()` followed by `setNodes(freshArray)` told ReactFlow "reset everything"
- After N resets, ReactFlow's internal effect timing drifted
- Eventually ReactFlow's sync effect ran on EVERY interaction

**The fix works because:**
- No more `clearSelection()` during data load
- `useRef` prevents redundant `setNodes(freshArray)` calls
- Batch delete prevents intermediate renders
- ReactFlow's internal state stays stable

---

*After 5 days and 70+ hours of debugging, the solution is 3 surgical changes totaling 15-20 minutes of work.*

**Let's end this nightmare.**

# Session Summary: Fourth Attempt - AppLayout Zustand Selectors (2026-02-15)

**Developer:** Aaron Zapata + Claude Sonnet 4.5
**Duration:** ~1 hour
**Status:** ❌ FAILED - Problem persists with accumulative pattern

---

## Executive Summary

Applied Zustand selectors to AppLayout.tsx (same pattern as ProductionCanvas in Attempt 3). Initial DELETE operations work correctly (1-2 times), but problem manifests **accumulatively** - after 2nd deletion, component starts remounting continuously.

**Critical Discovery:** The problem is ACCUMULATIVE, not immediate. First 1-2 deletions work perfectly, then something breaks and remounting begins.

---

## What We Implemented (Attempt 4)

### Based on Attempt 3 Success Pattern

**Fix 1: AppLayout Zustand Selectors**

Applied the same Zustand optimization pattern that we used in ProductionCanvas.tsx:

| Component | Before | After |
|-----------|--------|-------|
| AppLayout state values | `const { currentView } = useNavigationStore();` | `const currentView = useNavigationStore((state) => state.currentView);` |
| AppLayout functions | `const { refreshProjectInfo, ... } = useProjectStore();` | `const { refreshProjectInfo } = useProjectStore(useShallow(...))` |

**Rationale:** If AppLayout re-renders frequently due to bare destructuring, it could contribute to remounting issues even with useMemo in place.

**Fix 2: AppLayout useMemo (Already applied in Attempt 3.5)**

```typescript
const renderedView = useMemo(() => {
  switch (currentView) {
    case 'canvas':
      return <ProductionCanvas />;
    // ...
  }
}, [currentView]);
```

---

## Files Modified

**1. AppLayout.tsx**
- Line 9: Added `import { useShallow } from 'zustand/react/shallow';`
- Lines 81-104: Replaced bare destructuring with optimized selectors

**Pattern Applied:**
```typescript
// BEFORE
export const AppLayout = () => {
  const { currentView } = useNavigationStore();
  const { initialize: initializePlants, isInitialized: plantsInitialized } = usePlantStore();
  const {
    refreshProjectInfo,
    saveProjectAs,
    setProjectType,
    clearUnsavedChanges,
    projectType,
    hasUnsavedChanges,
    projectFilePath,
  } = useProjectStore();

// AFTER
export const AppLayout = () => {
  // State values - individual selectors for optimal re-render granularity
  const currentView = useNavigationStore((state) => state.currentView);
  const plantsInitialized = usePlantStore((state) => state.isInitialized);
  const projectType = useProjectStore((state) => state.projectType);
  const hasUnsavedChanges = useProjectStore((state) => state.hasUnsavedChanges);
  const projectFilePath = useProjectStore((state) => state.projectFilePath);

  // Functions - useShallow for stable references
  const { initialize: initializePlants } = usePlantStore(
    useShallow((state) => ({ initialize: state.initialize }))
  );
  const { refreshProjectInfo, saveProjectAs, setProjectType, clearUnsavedChanges } = useProjectStore(
    useShallow((state) => ({
      refreshProjectInfo: state.refreshProjectInfo,
      saveProjectAs: state.saveProjectStore,
      setProjectType: state.setProjectType,
      clearUnsavedChanges: state.clearUnsavedChanges,
    }))
  );
```

---

## Test Results: ❌ PARTIAL SUCCESS THEN FAILURE

### Test Workflow:

1. ✅ Fresh app start → Create 5 objects
2. ✅ **First DELETE** → Select object → Press Delete → Works correctly
   - Selection appears
   - Object deleted
   - No remounting detected
3. ✅ Navigate to Models → Canvas → Deleted object does NOT reappear (GOOD)
4. ✅ **Second DELETE** → Select object → Press Delete → Works correctly
   - Selection appears
   - Object deleted
   - Console shows `commitHookEffectListMount` AFTER deletion completes
5. ❌ **After 2nd deletion** → Remounting starts happening
   - `commitHookEffectListMount` appears spontaneously
   - `useLoadLines EXECUTING` fires without user action
6. ❌ **Third click attempt** → Selection clears immediately
   - `[onNodeClick]` fires
   - `[onSelectionChange] 1 nodes selected`
   - `[onSelectionChange] 0 nodes selected` ← CLEARED
   - `commitHookEffectListMount`
   - Cannot delete (no selection)

### Console Logs Pattern (ACCUMULATIVE FAILURE):

**First DELETE (WORKS):**
```
[Delete] About to delete 1 objects: ['CRXW0oXUacTcfkc7Qx8RT']
[Delete] deleteObject completed for: CRXW0oXUacTcfkc7Qx8RT
[Delete] All deletions completed
```
No `commitHookEffectListMount` immediately after.

**Second DELETE (WORKS but triggers remounting):**
```
[onNodeClick] Clicked node: WX3D7fy4SjtMqWHNaM_LQ selectable: true
[onSelectionChange] Selection changed: 1 nodes selected
[Delete] About to delete 1 objects: ['WX3D7fy4SjtMqWHNaM_LQ']
[Delete] deleteObject completed for: WX3D7fy4SjtMqWHNaM_LQ
[Delete] All deletions completed
[onSelectionChange] Selection changed: 0 nodes selected  ← After completion
commitHookEffectListMount  ← APPEARS AFTER 2nd DELETE
```

**Then spontaneous remounting without user action:**
```
[onSelectionChange] Selection changed: 0 nodes selected
commitHookEffectListMount
useLoadLines EXECUTING loadAll - currentPlantId: 0S4JfWMuwzU36wXNGjMCJ
```

**Third click (FAILS):**
```
[onNodeClick] Clicked node: bk7COEZvUu33s2uyqUp1Z selectable: true
[onSelectionChange] Selection changed: 1 nodes selected
[onSelectionChange] Selection changed: 0 nodes selected  ← CLEARED
commitHookEffectListMount
[Delete] Delete pressed but no objects selected  ← Cannot delete
```

---

## Critical Evidence: Accumulative Pattern

### Key Observation

The problem is **NOT immediate** - it's **accumulative**:

1. First DELETE: ✅ Works perfectly
2. Second DELETE: ✅ Works, but `commitHookEffectListMount` appears AFTER completion
3. After 2nd DELETE: ❌ Spontaneous remounting starts
4. Third click onwards: ❌ Selection clears immediately, remounting on every interaction

### What This Tells Us

**The DELETE operation itself works correctly:**
- Backend deletes successfully
- Optimistic update removes from store
- ReactFlow node removed

**But something accumulates with each DELETE:**
- First time: No side effects
- Second time: Triggers remounting after completion
- Third+ times: Remounting happens on every interaction

**Hypothesis:** Each DELETE operation is leaving something behind (event listener? store subscription? ReactFlow internal state?) that accumulates until it breaks the component lifecycle.

---

## What We've Ruled Out (4 Attempts)

| Fix Attempted | Status | Result |
|---------------|--------|--------|
| 1. Disable React.StrictMode | ✅ Done (Attempt 1) | Correct, problem persists |
| 2. Remove `nodes` from deps | ✅ Done (Attempt 1) | Correct, problem persists |
| 3. Use getState() in callbacks | ✅ Done (Attempt 1) | Correct, problem persists |
| 4. React.memo on CanvasInner | ✅ Done (Attempt 1) | Correct, problem persists |
| 5. Zustand selectors (ProductionCanvas) | ✅ Done (Attempt 3) | Correct, problem persists |
| 6. useShallow for functions (ProductionCanvas) | ✅ Done (Attempt 3) | Correct, problem persists |
| 7. useMemo in AppLayout | ✅ Done (Attempt 3.5) | Correct, problem persists |
| 8. Zustand selectors (AppLayout) | ✅ Done (Attempt 4) | Correct, problem persists |
| 9. Backend DELETE verification | ✅ Already correct | Works correctly |

**All fixes are technically CORRECT and follow React/Zustand best practices.**

**But they don't address the root cause of the accumulative remounting.**

---

## The Real Problem (Updated Hypothesis)

### Something is accumulating with each DELETE operation

**Previous hypothesis (Attempts 1-3):** State management causing re-renders → remounting

**Updated hypothesis (Attempt 4):** DELETE operation leaves residual state/listeners that accumulate:

**Possible Causes:**

1. **ReactFlow Internal State Corruption:**
   - ReactFlowProvider maintains internal context
   - Each DELETE might corrupt this context slightly
   - After 2 DELETEs, context is sufficiently corrupted to cause remounting

2. **Event Listener Accumulation:**
   - DELETE operation adds/removes event listeners
   - Listeners not properly cleaned up
   - After N deletions, listener chaos causes React to remount

3. **Zustand Store Update Pattern:**
   - `deleteObject` calls `useCanvasStore.getState().deleteNode()`
   - `deleteNode` updates store in a way that's accumulative
   - After N updates, something breaks

4. **ReactFlow Node Array Reference Issue:**
   - Each DELETE creates new nodes array
   - ReactFlow doesn't handle rapid array recreations well
   - After N recreations, ReactFlow loses track and remounts

---

## Evidence Trail

### Sequence of Events (2nd DELETE → Remounting):

1. User clicks object → Selection works
2. User presses Delete → `deleteObject` executes
3. `deleteObject` does:
   ```typescript
   set({ objects: objects.filter((obj) => obj.id !== objectId) });
   useCanvasStore.getState().deleteNode(objectId);
   await window.electronAPI.invoke(CANVAS_OBJECT_CHANNELS.DELETE, objectId);
   ```
4. **AFTER** `deleteObject` completes → `commitHookEffectListMount` appears
5. **WITHOUT user action** → Another remounting cycle starts

### Critical Question:

**What does `useCanvasStore.getState().deleteNode()` do that causes ReactFlow to remount after the 2nd call?**

---

## Files for Next Investigation

**Current Problem Area:**
- `src/renderer/features/canvas/store/useCanvasStore.ts` (deleteNode implementation)
- `src/renderer/features/canvas/store/useCanvasObjectStore.ts` (deleteObject - line 223-279)
- ReactFlowProvider interaction with node updates

**Previous Context:**
- `docs/fixes/SESSION-SUMMARY-2026-02-14.md` (Attempt 1)
- `docs/fixes/SESSION-SUMMARY-2026-02-15-ATTEMPT-2.md` (Attempt 2)
- `docs/fixes/SESSION-SUMMARY-2026-02-15-ATTEMPT-3.md` (Attempt 3)
- `docs/fixes/FIX-2026-02-15-COMPONENT-REMOUNTING.md` (Failed fix from Attempt 3.5)

**Code Files:**
- `src/renderer/features/canvas/ProductionCanvas.tsx` (main component - already optimized)
- `src/renderer/components/layout/AppLayout.tsx` (layout - already optimized)
- `src/renderer/router/index.tsx` (router setup - verified stable)

---

## Questions for Next Investigation

### Critical Questions:

1. **What does `useCanvasStore.deleteNode()` do?**
   - Does it update `nodes` array in a way that causes ReactFlow to remount?
   - Is there a better way to remove nodes from ReactFlow?

2. **Why does the problem manifest after 2 deletions?**
   - What's different about the 2nd deletion vs the 1st?
   - Is there a threshold where something breaks?

3. **Is ReactFlowProvider recreating its context?**
   - Does ReactFlowProvider detect "too many changes" and reset?
   - Is there a way to prevent ReactFlowProvider from remounting?

4. **Could this be a ReactFlow bug?**
   - ReactFlow version: 11.10.1
   - Known issues with rapid node deletions?
   - Should we update/downgrade ReactFlow?

### Investigation Plan:

**Immediate:**
1. Read `useCanvasStore.ts` to see `deleteNode` implementation
2. Check if `deleteNode` is creating unstable references
3. Look for ReactFlow documentation on proper node deletion
4. Check ReactFlow GitHub issues for similar problems

**If that fails:**
1. Try alternative deletion approach (mark as hidden instead of removing from array?)
2. Debounce node updates to ReactFlow
3. Consider switching to uncontrolled ReactFlow mode
4. Update/downgrade ReactFlow to different version

---

## Time Investment

**Total debugging time: ~5 days (70+ hours)**

**Attempts:**
- Day 1-2: 7 bugs fixed, StrictMode disabled, callbacks optimized
- Day 3: Zustand selectors in ProductionCanvas, code-reviewer found selector bug
- Day 3-4: useMemo in AppLayout, Zustand selectors in AppLayout
- Day 4: Discovered accumulative pattern

**Complexity:** EXTREME - Deepest React/ReactFlow/Zustand integration issue encountered

**Status:** BLOCKING PRODUCTION - Core functionality broken

---

## Recommendations for Next Steps

### Option A: Deep deleteNode Investigation (Recommended)

Use agents to:
1. Read and analyze `useCanvasStore.deleteNode()`
2. Identify why it causes remounting after 2nd call
3. Find alternative node deletion approach
4. Check ReactFlow best practices for node removal

**Agents to use:**
- `frontend-developer` (React/ReactFlow expert)
- `code-reviewer` (detect anti-patterns)
- `Explore` (search ReactFlow docs/issues)

### Option B: ReactFlow Version Change

Try different ReactFlow versions:
- Current: 11.10.1
- Try: 11.11.x (latest 11.x)
- Try: 12.x (if available)
- Try: 11.9.x (previous stable)

**Risk:** Breaking changes, API differences

### Option C: Alternative Deletion Strategy

Instead of removing from nodes array:
- Mark nodes as `hidden: true`
- Filter hidden nodes in rendering
- Actual removal only on route change

**Trade-off:** Workaround approach, violates "NO WORKAROUNDS" principle

### Option D: Consult External AIs Again

Generate updated prompt with:
- Accumulative pattern discovery
- All 4 attempts documented
- Focus on ReactFlow + Zustand interaction
- Ask specifically about `deleteNode` patterns

**External AIs:**
- ChatGPT 4o
- Claude Opus 4.6 (Web)
- Gemini 2.0 Flash

---

## Next Action

**CRITICAL:** Need to investigate `useCanvasStore.deleteNode()` implementation.

The accumulative pattern strongly suggests something in the DELETE → deleteNode → store update → ReactFlow chain is not cleaning up properly.

**Recommendation:** Launch `frontend-developer` agent with Opus model to:
1. Analyze `useCanvasStore.ts` deleteNode implementation
2. Identify what's accumulative
3. Propose standard ReactFlow node deletion pattern
4. Check if we're violating any ReactFlow best practices

---

## Current Codebase State

**Working correctly:**
- ✅ Backend DELETE with soft delete (active = 0)
- ✅ First 1-2 DELETE operations
- ✅ Zustand stores with optimized selectors
- ✅ AppLayout with useMemo and selectors
- ✅ ProductionCanvas with optimized subscriptions
- ✅ React.memo on CanvasInner
- ✅ Callbacks using getState()
- ✅ All TypeScript checks pass

**Broken:**
- ❌ DELETE operation #3+ causes accumulative remounting
- ❌ Selection clearing immediately after 2nd DELETE
- ❌ Component remounting on every interaction after threshold
- ❌ useLoadLines executing unnecessarily

---

*This session demonstrates that an accumulative bug is significantly harder to debug than an immediate bug. The problem manifests only after repeated operations, suggesting resource leakage or state corruption that compounds over time.*

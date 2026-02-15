# Analysis Request - Round 3: Accumulative Remounting Bug

**Date:** 2026-02-15
**Project:** Line Optimizer (Electron + React + ReactFlow + Zustand)
**Status:** CRITICAL - Production blocking bug, 5 days debugging, 4 failed attempts

---

## Quick Context

**What:** Canvas objects can't be deleted after navigating between tabs multiple times
**When:** Problem manifests accumulatively - works 1-2 times, then breaks
**Impact:** Core canvas functionality completely broken after navigation

---

## Executive Summary

We have an **accumulative remounting bug** in a ReactFlow-based canvas application. The problem:
- ✅ First DELETE works perfectly
- ⚠️ Second DELETE works but triggers `commitHookEffectListMount`
- ❌ Third+ DELETE fails - selection clears immediately on every click
- ❌ After navigating through multiple tabs, returning to Canvas shows broken state

**NEW DISCOVERY:** The problem is triggered by **navigation through multiple tabs**, not just DELETE operations. User workflow involves visiting 6-7 tabs before returning to Canvas, and each navigation cycle accumulates corruption.

---

## Tech Stack

```
Electron 28.0
React 18.2.0
ReactFlow 11.10.1
Zustand 4.5.7
TypeScript 5.3
Vite 5.0
```

**Component Architecture:**
```
<RouterProvider>
  <AppLayout>                    ← useMemo for view rendering
    <ProductionCanvas>           ← Zustand selectors optimized
      <ReactFlowProvider>
        <CanvasInnerMemoized>    ← React.memo wrapper
          <ReactFlow />
        </CanvasInnerMemoized>
      </ReactFlowProvider>
    </ProductionCanvas>
  </AppLayout>
</RouterProvider>
```

---

## The Problem: Accumulative Pattern

### Test Workflow (Actual User Behavior):

1. App starts → Navigate to Canvas
2. User navigates through ALL tabs to verify clean state:
   - Canvas → Models → Routings → Areas → Preferences → Plants → Global Analysis
3. Return to Canvas
4. Create 5 objects
5. **First DELETE:** ✅ Works
6. Navigate: Canvas → Models → Canvas
7. **Second DELETE:** ✅ Works, but logs show `commitHookEffectListMount`
8. Navigate: Canvas → Models → Canvas (2nd time)
9. ❌ **Now broken** - clicking objects causes immediate selection clearing

### Console Evidence:

**First DELETE (works):**
```
[Delete] About to delete 1 objects: ['CRXW0oXUacTcfkc7Qx8RT']
[Delete] deleteObject completed
```

**Second DELETE (works but shows warning):**
```
[Delete] About to delete 1 objects: ['WX3D7fy4SjtMqWHNaM_LQ']
[Delete] deleteObject completed
[onSelectionChange] Selection changed: 0 nodes selected
commitHookEffectListMount  ← Component REMOUNTING
useLoadLines EXECUTING loadAll  ← Unnecessary reload
```

**Third click (broken):**
```
[onNodeClick] Clicked node: bk7COEZvUu33s2uyqUp1Z selectable: true
[onSelectionChange] Selection changed: 1 nodes selected
[onSelectionChange] Selection changed: 0 nodes selected  ← CLEARED IMMEDIATELY
commitHookEffectListMount
[Delete] Delete pressed but no objects selected
```

---

## What We've Tried (4 Failed Attempts)

### Attempt 1: React Best Practices
- Disabled React.StrictMode
- Fixed callbacks to use `getState()` for stable refs
- Removed `nodes` from `useEffect` dependencies
- Added `React.memo` to CanvasInner
- **Result:** ❌ Problem persists

### Attempt 2: External AI Consultation (Round 1)
- Consulted ChatGPT 4o, Gemini 2 Flash, Claude Opus 4.6
- ChatGPT/Gemini: Claimed component defined inside render (WRONG)
- Opus: Identified Zustand subscription issues (CORRECT)
- **Result:** ❌ Problem persists

### Attempt 3: Zustand Selectors
- Replaced bare destructuring with individual selectors in ProductionCanvas
- Used `useShallow()` for function refs
- Code-reviewer agent caught initial bug (unstable function selectors)
- **Result:** ❌ Problem persists

### Attempt 4: AppLayout Optimization
- Applied `useMemo` to AppLayout view rendering
- Applied Zustand selectors to AppLayout stores
- **Result:** ❌ Problem persists with new pattern (navigation-triggered)

**All fixes are technically correct and follow best practices, but don't solve the root cause.**

---

## Agent Analysis (Our Latest Investigation)

We deployed two specialized agents with full context:

### Frontend Developer Agent (Opus) - Key Findings:

**Root Cause Identified:**
> "The bug is NOT in `deleteNode` itself. The problem is a **state synchronization race condition** between two parallel stores (`useCanvasStore` and `useCanvasObjectStore`) combined with ReactFlow's controlled component pattern."

**The Deletion Flow:**
```typescript
// useCanvasObjectStore.ts deleteObject
deleteObject: async (objectId: string) => {
  // STEP 1: Update useCanvasObjectStore
  set({ objects: objects.filter((obj) => obj.id !== objectId) });

  // STEP 2: Update useCanvasStore (separate render!)
  useCanvasStore.getState().deleteNode(objectId);

  // STEP 3: Backend delete (async)
  await window.electronAPI.invoke(CANVAS_OBJECT_CHANNELS.DELETE, objectId);
}
```

**Why It's Accumulative:**
- First delete: Both stores sync before ReactFlow reconciles → ✅ Works
- Second delete: React scheduler batches differently, timing varies → ⚠️ Works but seeds problem
- Third+ delete: Accumulated reconciliation cycles → ❌ ReactFlow detects "missing" nodes, clears selection

**Proposed Solutions:**
1. **Batch updates** using `unstable_batchedUpdates`
2. **Single source of truth** (remove dual-store pattern)
3. **Use ReactFlow's API** directly instead of Zustand for nodes

### Code Reviewer Agent (Opus) - Critical Issues Found:

**CRITICAL Issue #1: Race Condition in Dual-Store Update**
```typescript
// Lines 232-237, useCanvasObjectStore.ts
set({ objects: objects.filter((obj) => obj.id !== objectId) });  // Render 1
useCanvasStore.getState().deleteNode(objectId);                  // Render 2
```
Two separate state updates = two React renders = race condition window.

**CRITICAL Issue #2: Async For-Loop Allows Renders Between Deletes**
```typescript
// Lines 408-422, ProductionCanvas.tsx
for (const objectId of objectsToDelete) {
  await useCanvasObjectStore.getState().deleteObject(objectId);  // Each await = React can render
}
```

**WARNING Issue #3: useLoadLines Clearing Selection**
```typescript
// Lines 40-42, useLoadLines.ts
useToolStore.getState().clearSelection();       // Clears on EVERY reload
useCanvasStore.getState().setSelectedNode(null);
```

---

## Recommended Solutions (by agents)

### Option A: Batch State Updates (Minimal Change)

```typescript
import { unstable_batchedUpdates } from 'react-dom';

deleteObject: async (objectId: string) => {
  // Both updates in single React render
  unstable_batchedUpdates(() => {
    set({ objects: objects.filter((obj) => obj.id !== objectId) });
    useCanvasStore.getState().deleteNode(objectId);
  });

  await window.electronAPI.invoke(CANVAS_OBJECT_CHANNELS.DELETE, objectId);
};
```

### Option B: Batch All Deletions (Fix Async Loop)

```typescript
// Single state update for all deletions
useCanvasObjectStore.setState(state => ({
  objects: state.objects.filter(obj => !objectsToDelete.includes(obj.id))
}));

useCanvasStore.setState(state => ({
  nodes: state.nodes.filter(node => !objectsToDelete.includes(node.id))
}));

// Parallel DB operations
await Promise.all(objectsToDelete.map(id =>
  window.electronAPI.invoke(CANVAS_OBJECT_CHANNELS.DELETE, id)
));
```

### Option C: Single Source of Truth (Major Refactor)

Remove `useCanvasObjectStore`, use only ReactFlow's state as source of truth.

---

## Key Questions for External Analysis

1. **Is our diagnosis correct?**
   - Is the dual-store race condition the real root cause?
   - Or is there something deeper we're missing?

2. **Why does navigation accumulate the problem?**
   - User visits 6-7 tabs before returning to Canvas
   - Each Canvas mount/unmount cycle seems to worsen state corruption
   - Is ReactFlowProvider accumulating stale state?

3. **Is `unstable_batchedUpdates` the right solution?**
   - Both agents recommend it
   - Is this a standard React pattern for this scenario?
   - Are there better alternatives?

4. **ReactFlow specific:**
   - Are we violating ReactFlow's controlled component contract?
   - Should we use ReactFlow's `useReactFlow().setNodes()` instead of Zustand?
   - Is ReactFlow 11.10.1 stable for this use case?

5. **Why does it work 1-2 times then fail?**
   - What's the threshold/trigger?
   - Is React's scheduler behavior changing after N renders?
   - Is there garbage collection or memory pressure involved?

---

## Critical Files Reference

**State Management:**
- `src/renderer/features/canvas/store/useCanvasStore.ts` - ReactFlow nodes state
- `src/renderer/features/canvas/store/useCanvasObjectStore.ts` - Business objects state (lines 223-279: deleteObject)

**Components:**
- `src/renderer/features/canvas/ProductionCanvas.tsx` - Main canvas component (lines 408-422: async delete loop)
- `src/renderer/components/layout/AppLayout.tsx` - Layout with view switching
- `src/renderer/router/index.tsx` - React Router setup

**Hooks:**
- `src/renderer/features/canvas/hooks/useLoadLines.ts` - Loads objects on mount (lines 40-42: clears selection)

---

## Evidence We've Collected

### Logs showing commitHookEffectListMount:
```
commitHookEffectListMount @ chunk-PJEEZAML.js:16915
commitPassiveMountOnFiber
commitPassiveMountEffects_complete
commitPassiveMountEffects_begin
commitPassiveMountEffects
flushPassiveEffectsImpl
```
This proves **component MOUNTING**, not just re-rendering.

### Stack trace from useLoadLines:
```
useLoadLines EXECUTING loadAll - currentPlantId: 0S4JfWMuwzU36wXNGjMCJ
loadAll @ useLoadLines.ts:36
commitHookEffectListMount  ← Effect executing during MOUNT
```

### Timeline of deterioration:
- 0 deletes: Perfect
- 1 delete: Perfect
- 2 deletes: Works but `commitHookEffectListMount` appears
- 3+ deletes: Broken, selection clears immediately

---

## What We Need from You

**Please analyze:**

1. **Root cause validation:** Are the agents correct about dual-store race condition?
2. **Solution validation:** Is `unstable_batchedUpdates` the right approach?
3. **Alternative approaches:** Better patterns we should consider?
4. **ReactFlow expertise:** Are we using ReactFlow correctly in this scenario?
5. **Why accumulative?** Why does it get worse instead of failing immediately?

**Critical constraint:** We follow "NO WORKAROUNDS" principle - we need the architecturally correct solution, not a hack.

---

## Your Analysis Format

Please structure your response as:

```markdown
## A. Root Cause Analysis
[Your diagnosis]

## B. Validation of Agent Findings
[Agree/Disagree with dual-store race condition theory]

## C. Recommended Solution
[Which option or alternative approach]

## D. Implementation Details
[Specific code changes with line numbers]

## E. Why It's Accumulative
[Explain the 1-2-3+ pattern]

## F. Potential Risks
[What could go wrong with your solution]
```

---

## AI Model Identification

**Please start your response with:**
```
AI Model: [Your model name and version]
Timestamp: [Current timestamp]
Analysis ID: [Unique identifier]
```

This helps us track which AI provided which analysis.

---

Thank you for your analysis. We've been stuck on this for 5 days and need fresh perspective to break through.

---

## Appendix: Previous Analysis Documents

Available for reference if needed:
- `docs/fixes/SESSION-SUMMARY-2026-02-14.md` (Attempt 1)
- `docs/fixes/SESSION-SUMMARY-2026-02-15-ATTEMPT-2.md` (Attempt 2)
- `docs/fixes/SESSION-SUMMARY-2026-02-15-ATTEMPT-3.md` (Attempt 3)
- `docs/fixes/SESSION-SUMMARY-2026-02-15-ATTEMPT-4.md` (Attempt 4)
- `docs/fixes/FIX-2026-02-15-COMPONENT-REMOUNTING.md` (Failed fix from Attempt 3.5)

All previous external AI analyses (Round 1 & 2) are also available in `docs/fixes/ANALYSIS-*.md`.

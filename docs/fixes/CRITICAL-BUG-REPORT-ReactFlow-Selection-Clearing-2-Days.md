# Critical Bug Report: ReactFlow Selection Clearing After Tab Navigation

**Status:** 🔴 UNRESOLVED after 2 days of debugging
**Severity:** CRITICAL - Blocks core functionality
**Date:** February 14-15, 2026
**Developer:** Aaron Zapata + Claude Sonnet 4.5
**Framework Constraint:** Framework Híbrido v2.0 - NO WORKAROUNDS allowed

---

## Executive Summary

Canvas objects in Line Optimizer cannot be deleted after navigating between tabs (Canvas ↔ Models). The deletion feature works perfectly BEFORE tab navigation, but completely breaks AFTER navigating to Models and back to Canvas. This is a critical blocker as the workflow naturally requires tab navigation to assign models to production lines.

**Pattern:**
- ✅ **WORKS:** Create objects → Delete objects → Success
- ❌ **FAILS:** Create objects → Go to Models tab → Return to Canvas → Delete objects → "No objects selected" error

---

## System Context

### What is Line Optimizer?

Line Optimizer is a **manufacturing production line optimization tool** for BorgWarner. It helps industrial engineers:

1. **Design factory layouts** using a visual canvas (drag-and-drop interface)
2. **Model production lines** as graphical objects (rectangles, circles, custom shapes)
3. **Assign product models** to lines with cycle times and efficiency
4. **Run optimization algorithms** (Python-based) to maximize throughput
5. **Analyze results** with visual charts and timelines

**Key Feature:** The Canvas is a visual design tool similar to Figma/Visio, but for manufacturing lines.

---

## Canvas Objects: What They Represent

### Business Context

Each **Canvas Object** represents a **Production Line** or **Process** in a manufacturing plant:

- **Process Type:** Assembly, Subassembly, Test, Packaging
- **Properties:** Cycle time, efficiency, capacity, available time
- **Visual:** Rectangle/circle/custom shape with name label
- **Relationships:** Can connect to other objects (material flow)

**Example:**
```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│ HVDC Assembly    │──────▶│ Testing Station  │──────▶│ Packaging Line   │
│ (Rectangle)      │       │ (Circle)         │       │ (Custom Shape)   │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

### Why Objects Need to Be Deleted

During factory layout design, users **constantly iterate**:
1. Create initial layout
2. Run optimization
3. Realize a line is not needed
4. **Delete that line**
5. Re-run optimization
6. Repeat

**Without deletion working:** Users cannot iterate on designs = tool is unusable.

---

## Natural User Workflow (Why Tab Navigation is Mandatory)

### Phase 1: Initial Canvas Setup
```
User opens app → Canvas tab (default view) → Creates 3-5 canvas objects (rectangles)
```

### Phase 2: Model Creation (REQUIRES Tab Switch)
```
User clicks "Models" tab → Creates product model "HVDC-2024" → Sets volume (50,000 units/year)
```
**WHY MANDATORY:** Models are defined separately from lines. You can't create a model ON the canvas.

### Phase 3: Model Assignment (Back to Canvas)
```
User returns to Canvas tab → Clicks object → Sets object type to "Process" → Assigns model "HVDC-2024" → Sets cycle time (45 sec)
```
**WHY MANDATORY:** You assign models to visual objects, so you MUST be on Canvas tab.

### Phase 4: Iteration (Where Deletion Happens)
```
User realizes one line is redundant → Selects object → Presses Delete key → ❌ FAILS
```

**This is NOT an edge case** - this is the PRIMARY workflow. Users MUST navigate:
```
Canvas → Models → Canvas (multiple times per session)
```

---

## The Problem: Explicit Symptoms

### Symptom 1: "Delete pressed but no objects selected"

**User Action:**
1. Create 5 canvas objects
2. Delete 1 object → ✅ Works
3. Go to Models tab
4. Return to Canvas tab
5. Click on an object → Visual selection appears (blue outline)
6. Press Delete key → ❌ Error message: "Delete pressed but no objects selected"

### Symptom 2: Selection Clears Immediately After Click

**DevTools Logs:**
```javascript
[onSelectionChange] Selection changed: 1 nodes selected        // ✅ Click detected
[onSelectionChange] Selected IDs: ['QetJ1QNLX3eSHdK5GUehl']  // ✅ Node selected
[onNodeClick] Clicked node: QetJ1QNLX3eSHdK5GUehl selectable: true  // ✅ Click handler fires
[onSelectionChange] Selection changed: 0 nodes selected        // ❌ IMMEDIATELY CLEARED
[onSelectionChange] Selected IDs: []                           // ❌ Selection lost

Stack trace:
(anonymous) @ reactflow.js:4490                                // ReactFlow internal
commitHookEffectListMount                                      // React effect mount
commitPassiveMountOnFiber                                      // React lifecycle
```

### Symptom 3: useLoadLines Executing Repeatedly

**Every time user clicks:**
```javascript
useLoadLines.ts:35 [useLoadLines] EXECUTING loadAll - currentPlantId: 8XEuTel3rKpVhBYqzY87Z
useLoadLines.ts:36 [useLoadLines] Stack trace
commitHookEffectListMount
commitPassiveMountOnFiber
```

**This effect should only run when `currentPlantId` changes**, but it's running on EVERY user interaction after tab navigation.

---

## Architecture & Technology Stack

### Tech Stack
```
Frontend:  React 18.2.0 + TypeScript 5.3.3
Canvas:    ReactFlow 11.10.1 (critical library)
State:     Zustand 4.4.7 (multiple stores)
Build:     Vite 5.0.8
Runtime:   Electron 28.1.0
Backend:   Node.js + SQLite (better-sqlite3)
Algorithm: Python 3.x (external optimizer)
```

### Multi-Store Architecture (Zustand)

The app uses **4 separate Zustand stores** for state management:

```typescript
// 1. ReactFlow Nodes & Edges (visual canvas state)
useCanvasStore {
  nodes: Node[]           // ReactFlow nodes (visual objects)
  edges: Edge[]           // ReactFlow edges (connections)
  setNodes: (nodes) => void
  addNode: (node) => void
  removeNode: (id) => void
}

// 2. Business Objects (database-backed entities)
useCanvasObjectStore {
  objects: CanvasObjectWithDetails[]  // Full object data from DB
  setObjects: (objects) => void
  deleteObject: (id) => Promise<void>  // Backend call
  duplicateObject: (id) => Promise<string>
  convertObjectType: (id, type) => Promise<void>
  setProcessProps: (id, props) => Promise<void>
}

// 3. UI Tool State (placement mode, selection, etc.)
useToolStore {
  activeTool: 'select' | { type: 'place', shapeId: string }
  selectedNode: string | null
  setActiveTool: (tool) => void
}

// 4. Navigation State (current plant, filters, etc.)
usePlantStore {
  currentPlantId: string | null
  plants: Plant[]
  setCurrentPlant: (id) => void
}
```

**Critical Synchronization Point:**
When canvas objects are loaded, THREE stores must sync:
1. **useCanvasObjectStore** gets objects from backend
2. **useCanvasStore** converts objects to ReactFlow nodes
3. **useToolStore** tracks which node is selected

**If ANY store is out of sync** → ReactFlow's selection state corrupts.

---

## Critical Code Flow

### 1. Initial Load (Works Correctly)

```typescript
// useLoadLines.ts - Hook that loads canvas data
useEffect(() => {
  const loadAll = async () => {
    // 1. Fetch from backend
    const objectsResponse = await window.electronAPI.invoke('canvas-objects:get-by-plant', currentPlantId);

    // 2. Store in useCanvasObjectStore
    setCanvasObjects(objectsResponse.data);

    // 3. Convert to ReactFlow nodes
    const currentNodes = useCanvasStore.getState().nodes;
    const currentSelection = new Set(currentNodes.filter(n => n.selected).map(n => n.id));

    const newNodes = objectsResponse.data.map((obj) => ({
      id: obj.id,
      type: 'genericShape',
      position: { x: obj.xPosition, y: obj.yPosition },
      data: obj,
      selectable: true,
      draggable: true,
      selected: currentSelection.has(obj.id),  // ← PRESERVE selection (latest fix attempt)
    }));

    // 4. Update ReactFlow
    setNodes(newNodes);
  };

  loadAll();
}, [currentPlantId]);  // ← Dependency: only re-run when plant changes
```

### 2. Delete Operation (The Broken Part)

```typescript
// ProductionCanvas.tsx - Delete key handler
const handleKeyDown = useCallback((event: KeyboardEvent) => {
  if (event.key === 'Delete') {
    const nodes = getNodes();
    const selectedNodes = nodes.filter(n => n.selected);

    console.log('[Delete] Total nodes:', nodes.length);
    console.log('[Delete] Nodes with selected=true:', selectedNodes.length);

    if (selectedNodes.length === 0) {
      console.log('[ProductionCanvas] Delete pressed but no objects selected');  // ← ERROR
      return;
    }

    // If we get here, deletion proceeds...
  }
}, [getNodes]);
```

**The Problem:**
- `selectedNodes.length === 0` EVEN THOUGH user just clicked a node
- ReactFlow's internal effect is clearing `node.selected` immediately after user click
- This only happens AFTER navigating to Models and back

### 3. Tab Navigation Trigger

```typescript
// App.tsx (simplified) - React Router setup
<Routes>
  <Route path="/" element={<Canvas />} />        {/* Mounts ProductionCanvas */}
  <Route path="/models" element={<Models />} />  {/* Different component */}
</Routes>
```

**When navigating Canvas → Models:**
1. React **unmounts** `<ProductionCanvas>` component entirely
2. All useEffect hooks cleanup
3. ReactFlow internal state is destroyed

**When navigating Models → Canvas:**
1. React **remounts** `<ProductionCanvas>` component
2. useEffect hooks run again
3. `useLoadLines` executes (because `currentPlantId` hasn't changed from null → value)
4. ReactFlow initializes with fresh internal state
5. **Something triggers ReactFlow's selection effect repeatedly**

---

## All Attempted Fixes (Chronological)

### Day 1: February 14, 2026

#### Attempt 1: Fix 6 Related Bugs (4 hours)
**Bugs Fixed:**
1. useLoadLines infinite reload loop (changed to specific Zustand selectors)
2. Missing clearTempDatabase() after Save As
3. Incomplete revert in deleteObject() error handling
4. onPaneClick clearing selection unconditionally
5. Nodes created without `selectable: true` property
6. Keyboard handler race condition (removed `nodes` from dependency array)

**Result:** ❌ Deletion still broken after tab navigation
**Why it Failed:** These were real bugs, but not the root cause of selection clearing

#### Attempt 2: Disable React.StrictMode (2 hours)
**Hypothesis:** StrictMode's double-invoke was triggering ReactFlow effects twice

**Code Changed:**
```typescript
// src/renderer/index.tsx
root.render(
  // <React.StrictMode>  ← Commented out
    <RouterProvider router={router} />
  // </React.StrictMode>
);
```

**Evidence:**
Stack traces showed `commitDoubleInvokeEffectsInDEV` before fix, gone after.

**Result:** ❌ Partially helped but problem persists
**Why it Failed:** Reduced double-invocations but didn't fix the core issue

#### Attempt 3: Remove Canvas Reloads from Operations (3 hours)
**Hypothesis:** Reloading canvas after operations was triggering ReactFlow re-initialization

**Operations Modified:**
```typescript
// useCanvasObjectStore.ts - Removed these reloads:

// 1. deleteObject (line 262)
await get().loadObjectsForPlant(objectToDelete.plantId);  // ← REMOVED

// 2. convertObjectType (line 332)
await get().loadObjectsForPlant(existingObject.plantId);  // ← REMOVED

// 3. setProcessProps (line 463)
await get().loadObjectsForPlant(obj.plantId);  // ← REMOVED

// 4. setBufferProps (line 426)
await get().loadObjectsForPlant(obj.plantId);  // ← REMOVED

// 5. linkToLine (line 484)
await get().loadObjectsForPlant(obj.plantId);  // ← REMOVED

// 6. unlinkFromLine (line 504)
await get().loadObjectsForPlant(obj.plantId);  // ← REMOVED
```

**Result:** ❌ No change - problem persists
**Why it Failed:** **User correctly identified this as a potential WORKAROUND** - avoiding reloads instead of fixing the root cause

---

### Day 2: February 15, 2026

#### Attempt 4: Investigate ReactFlow Documentation (1 hour)
**Process:**
1. Used `frontend-developer` agent to research ReactFlow best practices
2. Found controlled component pattern in official docs
3. Discovered we were violating React patterns by hardcoding `selected: false`

**Key Finding:**
```typescript
// WRONG (what we were doing):
const newNodes = objectsResponse.data.map((obj) => ({
  id: obj.id,
  // ... other props
  selected: false,  // ← OVERWRITES ReactFlow's selection state
}));

// RIGHT (according to ReactFlow docs):
const currentSelection = new Set(currentNodes.filter(n => n.selected).map(n => n.id));
const newNodes = objectsResponse.data.map((obj) => ({
  id: obj.id,
  // ... other props
  selected: currentSelection.has(obj.id),  // ← PRESERVES selection
}));
```

#### Attempt 5: Preserve ReactFlow Selection State (30 min)
**Implementation:**
```typescript
// useLoadLines.ts (lines 73-92)
// STANDARD ReactFlow Pattern: Preserve selection state when updating nodes
// Get current selection state from ReactFlow (source of truth)
const currentNodes = useCanvasStore.getState().nodes;
const currentSelection = new Set(currentNodes.filter(n => n.selected).map(n => n.id));

// Build nodes while preserving ReactFlow's selection state
const newNodes = objectsResponse.data.map((obj) => ({
  id: obj.id,
  type: 'genericShape',
  position: { x: obj.xPosition, y: obj.yPosition },
  data: obj,
  selectable: true,
  draggable: true,
  // CRITICAL: Preserve selection - if this node was selected before reload, keep it selected
  selected: currentSelection.has(obj.id),
}));

setNodes(newNodes);
```

**Result:** ❌ STILL BROKEN - selection clears immediately after tab navigation
**Why it Failed:** Unknown - this SHOULD work according to ReactFlow documentation

---

## Current State After All Fixes

### What We Know Works
1. ✅ Deletion works BEFORE navigating to Models tab
2. ✅ Objects are successfully deleted from database (confirmed in logs)
3. ✅ Selection visually appears (blue outline) when clicking
4. ✅ `onNodeClick` handler fires correctly

### What Still Breaks
1. ❌ After tab navigation (Canvas → Models → Canvas), selection clears immediately
2. ❌ `useLoadLines` executes on EVERY click (should only run when plant changes)
3. ❌ ReactFlow effect at `reactflow.js:4490` clears selection after every click
4. ❌ Delete key shows "no objects selected" even though object was just clicked

### The Mystery
**WHY does ReactFlow's effect clear selection after tab navigation?**

The stack trace always shows:
```
(anonymous) @ reactflow.js:4490
commitHookEffectListMount
commitPassiveMountOnFiber
```

This is ReactFlow's **internal selection management effect**. Something about tab navigation causes this effect to:
1. Fire on EVERY user click (instead of just on mount)
2. Clear selection instead of maintaining it
3. Ignore the `selected: true` property we're setting on nodes

---

## Why This Violates Our Development Framework

### Framework Híbrido v2.0: NO WORKAROUNDS Policy

**Definition of Workaround:**
Code that "tricks" or "evades" standard library behavior instead of using the correct API.

**Workarounds We Rejected:**
1. ❌ Removing reloads → Avoids problem instead of fixing it
2. ❌ Disabling StrictMode → Hides symptoms, not a solution
3. ❌ Manual selection tracking → Would duplicate ReactFlow's internal state

**What We Need:**
✅ The **STANDARD ReactFlow solution** for maintaining selection after component remount

---

## Critical Questions for Other AIs

### Question 1: ReactFlow Selection After Unmount
**When a React component unmounts and remounts** (e.g., tab navigation), how should ReactFlow's selection state be restored?

- Should we use `defaultNodes` instead of controlled `nodes` prop?
- Is there a `defaultSelectedNodes` or `initialSelection` prop?
- Should we trigger `onSelectionChange` manually on mount?

### Question 2: Why Does Effect Fire Repeatedly?
**The stack trace shows:**
```
(anonymous) @ reactflow.js:4490
commitHookEffectListMount
```

This effect should only fire on component mount, but it's firing on EVERY click after remount. Why?

- Is ReactFlow detecting node array reference changes?
- Should we use `applyNodeChanges` API instead of `setNodes`?
- Is there a ReactFlow lifecycle hook we're missing?

### Question 3: Dependency Array in useLoadLines
**Current setup:**
```typescript
useEffect(() => {
  loadAll();
}, [currentPlantId]);  // ← Only depends on plant ID
```

But logs show `loadAll` executing on every click. Is React detecting a stale dependency?

### Question 4: Multi-Store Synchronization
**We have 3 stores tracking overlapping state:**
- ReactFlow's internal `nodes` state (managed by ReactFlow)
- `useCanvasStore.nodes` (Zustand)
- `useToolStore.selectedNode` (Zustand)

Should we consolidate? Is this causing race conditions?

---

## Files Involved

### Key Files Modified
```
src/renderer/index.tsx                                           // StrictMode disabled
src/renderer/features/canvas/hooks/useLoadLines.ts              // Selection preservation logic
src/renderer/features/canvas/ProductionCanvas.tsx               // Delete handler + diagnostics
src/renderer/features/canvas/store/useCanvasObjectStore.ts      // Removed reloads (workaround)
src/renderer/features/canvas/store/useCanvasStore.ts            // Zustand store for nodes
src/renderer/features/canvas/store/useToolStore.ts              // UI tool state
```

### ReactFlow Version
```json
{
  "reactflow": "^11.10.1"
}
```

**Known Issues:**
- ReactFlow 11.x has internal selection management
- Using controlled component pattern (`nodes` prop) instead of uncontrolled (`defaultNodes`)

---

## Request for Other AIs

Please analyze this problem with fresh eyes and suggest:

1. **Root Cause:** What is ACTUALLY causing ReactFlow's selection effect to fire repeatedly?
2. **Standard Solution:** What is the ReactFlow-approved way to handle this?
3. **Architecture Review:** Is our multi-store setup fundamentally flawed?
4. **Alternative Approaches:** Should we:
   - Switch to uncontrolled ReactFlow mode?
   - Manage selection entirely outside ReactFlow?
   - Use a different canvas library altogether?

**Constraint:** Solution MUST follow standard library patterns (NO WORKAROUNDS).

**Time Invested:** 2 full days (16+ hours) with AI assistance
**Urgency:** CRITICAL - blocks primary user workflow

---

## Complete Logs (Latest Test Run)

### DevTools Console (Excerpt)
```javascript
// Initial mount - expected
[onSelectionChange] Selection changed: 0 nodes selected
useLoadLines.ts:35 [useLoadLines] EXECUTING loadAll - currentPlantId: null

// Plant initialized - expected
[PlantStore] Initialized with 1 plants, default: PLANT-001
useLoadLines.ts:35 [useLoadLines] EXECUTING loadAll - currentPlantId: 8XEuTel3rKpVhBYqzY87Z

// Multiple re-initializations - NOT EXPECTED
[onSelectionChange] Selection changed: 0 nodes selected
useLoadLines.ts:35 [useLoadLines] EXECUTING loadAll - currentPlantId: 8XEuTel3rKpVhBYqzY87Z
[onSelectionChange] Selection changed: 0 nodes selected

// User creates 5 objects - OK
[Placement] Object created in DB with ID: OOIQKqC9e6TEXV5vWkeNw
[Placement] Object created in DB with ID: bLNvoRHYYgQzx1UfyvysD
[Placement] Object created in DB with ID: ULuAxTiuu7fIcGQyGtBSD
[Placement] Object created in DB with ID: QetJ1QNLX3eSHdK5GUehl
[Placement] Object created in DB with ID: YmTmGdvvvjiPbuCATBbWU

// First deletion - WORKS
[onSelectionChange] Selection changed: 1 nodes selected  ✅
[onSelectionChange] Selected IDs: ['YmTmGdvvvjiPbuCATBbWU']
[onNodeClick] Clicked node: YmTmGdvvvjiPbuCATBbWU selectable: true
[Delete] Total nodes: 5
[Delete] Nodes with selected=true: 1
[Delete] About to delete 1 objects: ['YmTmGdvvvjiPbuCATBbWU']
[Delete] deleteObject completed for: YmTmGdvvvjiPbuCATBbWU  ✅

// Effect clears selection - UNEXPECTED
[onSelectionChange] Selection changed: 0 nodes selected
Stack trace: (anonymous) @ reactflow.js:4490

// useLoadLines runs again - WHY?
useLoadLines.ts:35 [useLoadLines] EXECUTING loadAll - currentPlantId: 8XEuTel3rKpVhBYqzY87Z

// Second deletion attempt - FAILS
[onSelectionChange] Selection changed: 1 nodes selected
[onNodeClick] Clicked node: QetJ1QNLX3eSHdK5GUehl selectable: true
[onSelectionChange] Selection changed: 0 nodes selected  ❌ IMMEDIATELY CLEARED
Stack trace: (anonymous) @ reactflow.js:4490

[Delete] Total nodes: 3
[Delete] Nodes with selected=true: 0  ❌
[ProductionCanvas] Delete pressed but no objects selected  ❌
```

### Node.js Backend Logs (Excerpt)
```
[Canvas Object Handler] Creating object: New Rectangle  ✅
[Canvas Object Handler] Creating object: New Rectangle  ✅
[Canvas Object Handler] Creating object: New Rectangle  ✅
[Canvas Object Handler] Creating object: New Rectangle  ✅
[Canvas Object Handler] Creating object: New Rectangle  ✅

[Canvas Object Handler] Updating position: YmTmGdvvvjiPbuCATBbWU 688.27... 688.61...
[Canvas Object Handler] Deleting object: YmTmGdvvvjiPbuCATBbWU  ✅ DELETED
[Canvas Object Handler] Getting objects by plant: 8XEuTel3rKpVhBYqzY87Z  ← Reload triggered

[Canvas Object Handler] Updating position: QetJ1QNLX3eSHdK5GUehl 691.81... 561.14...
// User tries to delete but fails (no backend call) ❌
```

---

## Conclusion

After 2 days and 8+ attempted fixes, we've exhausted our debugging approaches. The problem appears to be a deep interaction between:
- ReactFlow's internal selection management
- React's component lifecycle (unmount/remount)
- Multi-store state synchronization

We need fresh perspective from other AI models to identify what we're missing.

---

**Document Version:** 1.0
**Generated:** 2026-02-15
**For:** Gemini, Claude (web), ChatGPT, other AI code assistants
**Next Steps:** Share this document and await analysis from multiple AI perspectives

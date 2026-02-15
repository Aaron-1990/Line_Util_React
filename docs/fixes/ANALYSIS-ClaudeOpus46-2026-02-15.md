# Analysis Report

**AI Model:** Claude Opus 4.6 (Anthropic)
**Timestamp:** 2026-02-15T21:00:00Z
**Analysis ID:** OPUS46-001

---

## A. Initial Hypothesis

The `onNodesChange` callback in `ProductionCanvas.tsx` has `nodes` in its dependency array, creating a **feedback loop** after component remount: every selection change recreates the callback, ReactFlow receives a new prop, ReactFlow re-runs internal effects, and selection resets. Before tab navigation this doesn't manifest because ReactFlow's internal state was built incrementally and stays in sync. After remount, the fresh internal state conflicts with the rapidly-changing callback reference.

---

## B. Root Cause Analysis

### 1. Primary Suspect: `nodes` in `onNodesChange` dependency array

From the current code:

```typescript
// ProductionCanvas.tsx - CURRENT (BROKEN)
const onNodesChange = useCallback(
  (changes: NodeChange[]) => {
    const updatedNodes = applyNodeChanges(changes, nodes); // reads `nodes` from closure
    setNodes(updatedNodes);
    // ... position handling
  },
  [nodes, setNodes, updateNodePosition]  // `nodes` HERE is the killer
);
```

**The cycle after remount:**
1. User clicks node -> ReactFlow fires `onNodesChange` with selection change
2. `applyNodeChanges(changes, nodes)` creates new array with `selected: true`
3. `setNodes(updatedNodes)` updates Zustand -> `nodes` reference changes
4. `onNodesChange` is **recreated** (new function reference)
5. ReactFlow receives new `onNodesChange` **prop** -> triggers internal effect cleanup + remount (`commitHookEffectListMount`)
6. ReactFlow's remounted effect synchronizes selection state -> **clears selection**
7. Back to step 1 on next click

### 2. Evidence

The logs confirm this exactly:

```
[onSelectionChange] Selection changed: 1 nodes selected    <- Step 1-2
[onNodeClick] Clicked node: QetJ1QNLX3eSHdK5GUehl         <- Click fires
[onSelectionChange] Selection changed: 0 nodes selected    <- Step 6 (CLEARED)
Stack trace: (anonymous) @ reactflow.js:4490                <- Step 5 (effect re-mount)
```

And `useLoadLines` re-executing on every click confirms the cascade: nodes change -> component re-renders -> hooks re-evaluate.

### 3. ReactFlow Internals at `reactflow.js:4490`

This is ReactFlow's **node synchronization effect** -- an internal `useEffect` that reconciles controlled `nodes` prop with ReactFlow's internal store. When its dependencies change (which includes the callbacks passed as props), it re-runs `commitHookEffectListMount`, resetting internal selection tracking to match whatever `selected` property is on the nodes at that instant (which is already stale because step 3 just completed).

### Secondary Issue: `useLoadLines` building nodes one-by-one

```typescript
// Current code
setNodes([]);  // Clear -> triggers render
response.data.forEach((line) => {
  addNode({...});  // Each call -> triggers render
});
```

This causes N+1 renders during load, each one giving ReactFlow a new nodes reference.

---

## C. The Standard Solution

**SOLUTION:** Remove `nodes` from `onNodesChange` dependency array by reading current nodes directly from Zustand store via `getState()`, and batch node loading in `useLoadLines`.

**WHY THIS IS STANDARD:** ReactFlow docs recommend `setNodes((nds) => applyNodeChanges(changes, nds))` with functional updates. Since Zustand's `setNodes` doesn't accept functions, `useCanvasStore.getState().nodes` achieves identical behavior -- reading latest state without adding a closure dependency. This is also the standard Zustand pattern for accessing state inside callbacks.

**IMPLEMENTATION:**

### Change 1: `ProductionCanvas.tsx` -- Fix `onNodesChange`

**File:** `src/renderer/features/canvas/ProductionCanvas.tsx`

```typescript
// BEFORE (BROKEN):
const onNodesChange = useCallback(
  (changes: NodeChange[]) => {
    const updatedNodes = applyNodeChanges(changes, nodes);
    setNodes(updatedNodes);
    changes.forEach((change) => {
      if (change.type === 'position' && !change.dragging && change.id) {
        const updatedNode = updatedNodes.find(n => n.id === change.id);
        if (updatedNode) {
          updateNodePosition(change.id, updatedNode.position.x, updatedNode.position.y);
          window.electronAPI
            .invoke('lines:update-position', change.id, updatedNode.position.x, updatedNode.position.y)
            .catch((error) => {
              console.error('[ProductionCanvas] Error updating line position:', error);
            });
        }
      }
    });
  },
  [nodes, setNodes, updateNodePosition]
);

// AFTER (FIXED):
const onNodesChange = useCallback(
  (changes: NodeChange[]) => {
    // Read current nodes from store directly - avoids stale closure
    const currentNodes = useCanvasStore.getState().nodes;
    const updatedNodes = applyNodeChanges(changes, currentNodes);
    setNodes(updatedNodes);

    changes.forEach((change) => {
      if (change.type === 'position' && !change.dragging && change.id) {
        const updatedNode = updatedNodes.find(n => n.id === change.id);
        if (updatedNode) {
          updateNodePosition(change.id, updatedNode.position.x, updatedNode.position.y);
          window.electronAPI
            .invoke('lines:update-position', change.id, updatedNode.position.x, updatedNode.position.y)
            .catch((error) => {
              console.error('[ProductionCanvas] Error updating line position:', error);
            });
        }
      }
    });
  },
  [setNodes, updateNodePosition]  // NO `nodes` - stable Zustand refs only
);
```

### Change 2: `useLoadLines.ts` -- Batch node creation

**File:** `src/renderer/features/canvas/hooks/useLoadLines.ts`

```typescript
// BEFORE (N+1 renders):
useEffect(() => {
  const loadLines = async () => {
    setNodes([]);
    const response = await window.electronAPI.invoke<ProductionLine[]>('lines:get-all');
    if (response.success && response.data) {
      response.data.forEach((line) => {
        addNode({...});  // Each call triggers a render
      });
    }
  };
  loadLines();
}, [addNode, setNodes]);

// AFTER (single render):
useEffect(() => {
  const loadLines = async () => {
    try {
      const response = await window.electronAPI.invoke<ProductionLine[]>('lines:get-all');
      if (response.success && response.data) {
        const nodes = response.data.map((line) => ({
          id: line.id,
          type: 'productionLine',
          position: { x: line.xPosition, y: line.yPosition },
          data: {
            id: line.id,
            name: line.name,
            area: line.area,
            timeAvailableDaily: line.timeAvailableDaily,
            efficiency: line.efficiency,
            assignedModelsCount: 0,
          },
        }));
        setNodes(nodes);  // Single call, single render
      }
    } catch (error) {
      console.error('Error loading lines:', error);
    }
  };
  loadLines();
}, [setNodes]);  // setNodes is stable, addNode no longer needed
```

### Change 3: `ProductionCanvas.tsx` -- Same pattern for `onEdgesChange`

```typescript
// BEFORE:
const onEdgesChange = useCallback(
  (changes: EdgeChange[]) => {
    const updatedEdges = applyEdgeChanges(changes, edges);
    setEdges(updatedEdges);
  },
  [edges, setEdges]
);

// AFTER:
const onEdgesChange = useCallback(
  (changes: EdgeChange[]) => {
    const currentEdges = useCanvasStore.getState().edges;
    const updatedEdges = applyEdgeChanges(changes, currentEdges);
    setEdges(updatedEdges);
  },
  [setEdges]  // No `edges` dependency
);
```

### Change 4: `ProductionCanvas.tsx` -- Same for `onConnect`

```typescript
// BEFORE:
const onConnect = useCallback(
  (connection: Connection) => {
    const updatedEdges = addEdge(connection, edges);
    setEdges(updatedEdges);
  },
  [edges, setEdges]
);

// AFTER:
const onConnect = useCallback(
  (connection: Connection) => {
    const currentEdges = useCanvasStore.getState().edges;
    const updatedEdges = addEdge(connection, currentEdges);
    setEdges(updatedEdges);
  },
  [setEdges]
);
```

**VALIDATION:**
1. `npm run type-check` -> PASS
2. Start app -> Create 3 objects on canvas
3. Navigate to Models tab -> Return to Canvas
4. Click any object -> Verify selection persists (blue outline stays)
5. Press Delete -> Object deletes successfully
6. Repeat steps 3-5 three times
7. Check DevTools: `useLoadLines` should NOT fire on clicks

---

## D. Alternative Approaches

1. **Use `useNodesState`/`useEdgesState` from ReactFlow** -- ReactFlow provides these hooks specifically for the controlled pattern with built-in functional updates. Would replace `useCanvasStore` for nodes/edges entirely. Complexity: **Medium** (refactor store separation). Better because it's ReactFlow's first-party solution.

2. **Add functional update support to Zustand store** -- Change `setNodes: (nodes) => set({ nodes })` to `setNodes: (nodesOrFn) => set((state) => ({ nodes: typeof nodesOrFn === 'function' ? nodesOrFn(state.nodes) : nodesOrFn }))`. Then use `setNodes((nds) => applyNodeChanges(changes, nds))` as ReactFlow docs recommend. Complexity: **Low** (one store change + callback updates).

3. **Memoize the ReactFlow component with `key` based on mount cycle** -- Use a `key` prop that changes only on genuine data reloads, preventing unnecessary internal effect re-runs. Complexity: **Low** but feels like a workaround.

---

## E. Architecture Review

The multi-store Zustand setup is NOT fundamentally flawed, but there's a design tension: you have ReactFlow's internal store (which manages selection, viewport, interaction state) AND your Zustand `useCanvasStore` (which duplicates nodes/edges). This dual-state creates synchronization pressure.

**Recommended evolution** (not required for this fix): Keep `useCanvasObjectStore` for business data and `useToolStore` for UI state, but let ReactFlow own nodes/edges via `useNodesState`/`useEdgesState`. This eliminates the synchronization layer entirely. This is a Phase 2 refactor, not blocking.

---

## Answers to Key Questions

### Q1: Why does effect fire on every click?

Because `onNodesChange` is recreated on every click (due to `nodes` in deps), ReactFlow receives a new prop, and React unmounts/remounts the internal effect that depends on that callback. `commitHookEffectListMount` in the stack trace confirms this -- it's a fresh effect mount, not an update.

### Q2: Is our `setNodes()` call wrong?

The call itself is correct, but reading `nodes` from closure instead of from `getState()` is wrong. It forces `nodes` into the dependency array, which triggers the cascade. Use `useCanvasStore.getState().nodes` instead.

### Q3: Controlled vs Uncontrolled mode?

**Stay controlled.** Your architecture requires it (Zustand stores sync with DB). Uncontrolled (`defaultNodes`) would lose the ability to update nodes from outside ReactFlow. The fix is to implement controlled mode *correctly* -- stable callbacks with no state in dependency arrays.

### Q4: Why does useLoadLines execute repeatedly?

In the original code, `useLoadLines` destructures `{ addNode, setNodes }` from `useCanvasStore()` without a selector. `useCanvasStore()` subscribes to ALL state changes. Every time any node changes, the component re-renders. While `addNode` and `setNodes` are stable Zustand refs, the re-render itself may cause React to re-evaluate the effect. The fix (using only `setNodes` with a selector or `getState()`) eliminates this.

---

## Confidence Level

- **Solution Confidence:** **Very High** -- This is a well-documented ReactFlow anti-pattern. The `nodes` in dependency array -> callback recreation -> effect remount chain is deterministic and fully explains all symptoms.
- **Implementation Risk:** **Low** -- Changes are surgical (4 callbacks + 1 hook), no architectural refactoring needed.
- **Expected Resolution Time:** **15-30 minutes** to implement and validate.

---

## Additional Notes

The fact that deletion works BEFORE tab navigation is the strongest evidence: on first mount, `onNodesChange` is created once and ReactFlow's internal effect stabilizes. After remount, the fresh `useEffect` in `useLoadLines` triggers `setNodes` -> `nodes` changes -> `onNodesChange` recreates -> effect cascade begins. From that point forward, every interaction triggers the loop.

This same anti-pattern will bite you again with `onEdgesChange` and `onConnect` -- fix all three while you're at it (included in the changes above).

---

## Summary of All Changes

| # | File | Change | Why |
|---|------|--------|-----|
| 1 | `ProductionCanvas.tsx` | Remove `nodes` from `onNodesChange` deps, use `getState()` | Breaks feedback loop |
| 2 | `ProductionCanvas.tsx` | Remove `edges` from `onEdgesChange` deps, use `getState()` | Same pattern, preventive |
| 3 | `ProductionCanvas.tsx` | Remove `edges` from `onConnect` deps, use `getState()` | Same pattern, preventive |
| 4 | `useLoadLines.ts` | Batch `setNodes()` instead of `forEach(addNode)` | Eliminates N+1 renders |

**Total lines changed:** ~30
**Risk:** Low
**Architectural impact:** None (no store refactoring needed)

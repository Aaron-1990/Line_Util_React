# ReactFlow Single Source of Truth - Architectural Refactor

**Status:** Proposed (Not Implemented)
**Effort:** 2-3 hours
**Risk:** Medium
**Impact:** Resolves root cause of selection/state issues

---

## Current State (Dual-Store Pattern)

### The Problem

Currently, the Canvas uses **two separate sources of truth** for node data:

1. **useCanvasStore (Zustand)** - Manages nodes array
2. **ReactFlow internal state** - Manages selection, position, dragging

This dual ownership creates synchronization issues:
- Selection state conflicts
- Effect remounting after navigation
- `commitHookEffectListMount` appears on interactions
- Timing issues between stores

### Current Architecture

```
User Interaction
      ↓
ReactFlow (controlled mode)
      ↓
onNodesChange callback
      ↓
useCanvasStore.setNodes(updatedNodes)  ← Store update
      ↓
Component re-renders
      ↓
ReactFlow receives new nodes prop
      ↓
ReactFlow internal effects remount  ← PROBLEM
      ↓
Selection state conflicts
```

### Files in Current Pattern

| File | Role | Issue |
|------|------|-------|
| `useCanvasStore.ts` | Stores nodes array | Competes with ReactFlow |
| `useLoadLines.ts` | Loads nodes into store | Has to preserve selection manually |
| `ProductionCanvas.tsx` | Passes nodes to ReactFlow | Dual subscriptions |
| `onNodesChange` callback | Syncs ReactFlow → Store | Extra synchronization step |

---

## Proposed Architecture (Single Source of Truth)

### The Solution

Make **ReactFlow the only source of truth** for nodes. Remove `nodes` from useCanvasStore entirely.

### New Architecture

```
User Interaction
      ↓
ReactFlow (uncontrolled mode)
      ↓
ReactFlow manages state internally  ← SINGLE SOURCE OF TRUTH
      ↓
Use useReactFlow().getNodes() when needed  ← Read from ReactFlow
      ↓
No dual synchronization
      ↓
No effect remounting
      ↓
Selection works perfectly
```

### Benefits

✅ **Eliminates root cause:**
- No more dual-store synchronization
- No more `commitHookEffectListMount` issues
- ReactFlow controls its own state completely

✅ **Simpler mental model:**
- One source of truth for nodes
- No manual selection preservation needed
- ReactFlow does what it's designed to do

✅ **Better performance:**
- No extra store updates on every interaction
- Fewer re-renders
- No subscription conflicts

---

## Implementation Plan

### Phase 1: Prepare Transition (30 min)

**1.1 Create migration helpers**

```typescript
// src/renderer/features/canvas/utils/reactflow-helpers.ts

/**
 * Get all nodes from ReactFlow (new source of truth)
 */
export function getCanvasNodes(reactFlowInstance: ReactFlowInstance): Node[] {
  return reactFlowInstance.getNodes();
}

/**
 * Get nodes by plant ID (for filtering)
 */
export function getNodesByPlant(
  reactFlowInstance: ReactFlowInstance,
  plantId: string
): Node[] {
  return reactFlowInstance.getNodes().filter(
    node => node.data.plantId === plantId
  );
}

/**
 * Add node to ReactFlow
 */
export function addCanvasNode(
  reactFlowInstance: ReactFlowInstance,
  node: Node
): void {
  reactFlowInstance.setNodes(nodes => [...nodes, node]);
}

/**
 * Remove nodes from ReactFlow
 */
export function removeCanvasNodes(
  reactFlowInstance: ReactFlowInstance,
  nodeIds: string[]
): void {
  reactFlowInstance.setNodes(nodes =>
    nodes.filter(n => !nodeIds.includes(n.id))
  );
}
```

**1.2 Document all current usages of useCanvasStore.nodes**

```bash
# Find all places that read nodes from store
grep -r "useCanvasStore.*nodes" src/renderer/

# Find all places that update nodes
grep -r "setNodes" src/renderer/
```

### Phase 2: Refactor useCanvasStore (20 min)

**2.1 Remove nodes from store**

```typescript
// src/renderer/features/canvas/store/useCanvasStore.ts

// BEFORE:
interface CanvasState {
  nodes: Node[];                    // ❌ Remove this
  edges: Edge[];
  selectedNode: string | null;
  setNodes: (nodes: Node[]) => void; // ❌ Remove this
  // ... other methods
}

// AFTER:
interface CanvasState {
  edges: Edge[];                     // Keep edges (not managed by ReactFlow)
  selectedNode: string | null;       // Keep for panel coordination
  // Remove all node-related methods
  // ... other methods
}
```

**2.2 Keep only non-ReactFlow state**

```typescript
const useCanvasStore = create<CanvasState>((set, get) => ({
  // KEEP: Edges (connections are separate from ReactFlow)
  edges: [],
  setEdges: (edges) => set({ edges }),

  // KEEP: Selected node ID (for properties panel)
  selectedNode: null,
  setSelectedNode: (id) => set({ selectedNode: id }),

  // KEEP: Node position updates (to sync with backend)
  updateNodePosition: async (id, x, y) => {
    // Update backend only, ReactFlow manages visual position
    await window.electronAPI.invoke(
      CANVAS_OBJECT_CHANNELS.UPDATE_POSITION,
      id, x, y
    );
  },

  // REMOVE: Everything related to nodes array
  // nodes, setNodes, addNode, deleteNode, etc.
}));
```

### Phase 3: Refactor useLoadLines (30 min)

**3.1 Change from controlled to initial data pattern**

```typescript
// src/renderer/features/canvas/hooks/useLoadLines.ts

// BEFORE: Sets nodes in store
export function useLoadLines(): UseLoadLinesResult {
  const setNodes = useCanvasStore((state) => state.setNodes);

  useEffect(() => {
    const loadAll = async () => {
      const response = await fetch...;
      setNodes(response.data);  // ❌ Sets in store
    };
    loadAll();
  }, [currentPlantId]);
}

// AFTER: Returns initial nodes for ReactFlow
export function useLoadLines(): UseLoadLinesResult {
  const [initialNodes, setInitialNodes] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      const response = await fetch...;

      // Build nodes array
      const nodes = response.data.map(obj => ({
        id: obj.id,
        type: 'genericShape',
        position: { x: obj.xPosition, y: obj.yPosition },
        data: obj,
        selectable: true,
        draggable: true,
        // No need to preserve selection - ReactFlow manages it
      }));

      setInitialNodes(nodes);
      setIsLoading(false);
    };
    loadAll();
  }, [currentPlantId]);

  return { initialNodes, isLoading, isEmpty: !isLoading && initialNodes.length === 0 };
}
```

**3.2 No more selection preservation needed**

ReactFlow maintains selection internally, so we don't need the complex preservation logic.

### Phase 4: Refactor ProductionCanvas (60 min)

**4.1 Use uncontrolled ReactFlow with defaultNodes**

```typescript
// src/renderer/features/canvas/ProductionCanvas.tsx

const CanvasInner = () => {
  const { fitView, getNodes, setNodes } = useReactFlow();

  // Load initial nodes
  const { initialNodes, isLoading } = useLoadLines();

  // ReactFlow manages nodes internally - we just provide initial state
  // No more controlled nodes prop!

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    // ReactFlow handles this internally in uncontrolled mode
    // We only need to listen for position changes to update backend
    changes.forEach(change => {
      if (change.type === 'position' && !change.dragging && change.id) {
        const nodes = getNodes();
        const node = nodes.find(n => n.id === change.id);
        if (node) {
          // Update backend only
          window.electronAPI.invoke(
            CANVAS_OBJECT_CHANNELS.UPDATE_POSITION,
            change.id,
            node.position.x,
            node.position.y
          );
        }
      }
    });
  }, [getNodes]);

  return (
    <ReactFlow
      defaultNodes={initialNodes}  // ← Initial data (uncontrolled)
      // nodes={nodes}              // ❌ Remove controlled prop
      onNodesChange={onNodesChange}
      // ... other props
    >
      {/* ... */}
    </ReactFlow>
  );
};
```

**4.2 Refactor delete handler**

```typescript
// BEFORE: Updates store then backend
const handleDelete = async () => {
  const selectedIds = getSelectedNodeIds();

  // Update store
  useCanvasStore.setState(state => ({
    nodes: state.nodes.filter(n => !selectedIds.includes(n.id))
  }));

  // Update backend
  await Promise.all(selectedIds.map(id => deleteFromBackend(id)));
};

// AFTER: Updates ReactFlow then backend
const handleDelete = async () => {
  const nodes = getNodes();
  const selectedIds = nodes.filter(n => n.selected).map(n => n.id);

  if (selectedIds.length === 0) return;

  // Update ReactFlow (source of truth)
  setNodes(nodes => nodes.filter(n => !selectedIds.includes(n.id)));

  // Update backend in parallel
  const results = await Promise.all(
    selectedIds.map(id =>
      window.electronAPI.invoke(CANVAS_OBJECT_CHANNELS.DELETE, id)
    )
  );

  // Update useCanvasObjectStore (for properties panel)
  useCanvasObjectStore.setState(state => ({
    objects: state.objects.filter(obj => !selectedIds.includes(obj.id))
  }));
};
```

**4.3 Refactor create/add handlers**

```typescript
// BEFORE: Adds to store
const handleCreate = async (position) => {
  const response = await createObject(...);
  const newNode = { id: response.data.id, ... };

  useCanvasStore.getState().addNode(newNode);  // ❌ Store update
};

// AFTER: Adds to ReactFlow
const handleCreate = async (position) => {
  const response = await createObject(...);
  const newNode = {
    id: response.data.id,
    type: 'genericShape',
    position,
    data: response.data,
    selectable: true,
    draggable: true,
  };

  // Add to ReactFlow (source of truth)
  setNodes(nodes => [...nodes, newNode]);

  // Add to useCanvasObjectStore (for properties panel)
  useCanvasObjectStore.getState().addObject(response.data);
};
```

### Phase 5: Update Other Components (20 min)

**5.1 Properties panel**

```typescript
// BEFORE: Reads from useCanvasStore
const selectedNode = useCanvasStore(state =>
  state.nodes.find(n => n.id === state.selectedNode)
);

// AFTER: Reads from useCanvasObjectStore (already has object data)
const selectedObjectId = useCanvasStore(state => state.selectedNode);
const selectedObject = useCanvasObjectStore(state =>
  state.objects.find(obj => obj.id === selectedObjectId)
);
```

**5.2 Context menus and other features**

All features that currently read `useCanvasStore.nodes` should:
1. Use `useReactFlow().getNodes()` if they need ReactFlow state
2. Use `useCanvasObjectStore.objects` if they need business object data

### Phase 6: Testing (20 min)

**Test checklist:**
- [ ] Objects load on Canvas mount
- [ ] Objects persist position on drag
- [ ] Selection works after navigation
- [ ] Delete works without navigation
- [ ] Delete works after navigation (multiple times)
- [ ] Delete works after multiple navigation cycles
- [ ] Create object works
- [ ] Duplicate object works
- [ ] Copy/paste works
- [ ] Properties panel shows correct data
- [ ] Context menu works
- [ ] No `commitHookEffectListMount` warnings
- [ ] No selection clearing issues

---

## Migration Checklist

### Files to Modify

| File | Changes | Effort |
|------|---------|--------|
| `useCanvasStore.ts` | Remove nodes, setNodes, addNode, deleteNode | 15 min |
| `useLoadLines.ts` | Return initialNodes instead of calling setNodes | 20 min |
| `ProductionCanvas.tsx` | Use defaultNodes, refactor handlers | 60 min |
| `UnifiedPropertiesPanel.tsx` | Read from useCanvasObjectStore | 10 min |
| `ContextMenu.tsx` | Use getNodes() or useCanvasObjectStore | 10 min |
| Other components using nodes | Case-by-case updates | 15 min |

**Total estimated effort:** 2-3 hours

### Files to Keep

These files don't change:
- `useCanvasObjectStore.ts` - Still needed for business object data
- Backend repositories - No changes
- IPC handlers - No changes

---

## Comparison: Current vs Proposed

| Aspect | Current (Dual-Store) | Proposed (Single Source) |
|--------|---------------------|-------------------------|
| **Complexity** | High (2 sources of truth) | Low (1 source of truth) |
| **Selection issues** | Yes (`commitHookEffectListMount`) | No (ReactFlow manages it) |
| **Code to maintain** | More (sync logic) | Less (let ReactFlow handle it) |
| **Performance** | Lower (extra updates) | Higher (direct updates) |
| **Risk of bugs** | Higher (sync conflicts) | Lower (no sync needed) |
| **Debugging** | Harder (which store is wrong?) | Easier (only ReactFlow) |

---

## Risks and Mitigation

### Risk 1: Breaking existing functionality
**Mitigation:**
- Comprehensive testing checklist
- Keep feature branch for rollback
- Test each component after migration

### Risk 2: Unexpected ReactFlow behavior
**Mitigation:**
- Follow ReactFlow best practices for uncontrolled mode
- Read ReactFlow docs carefully
- Test edge cases thoroughly

### Risk 3: Performance regression
**Mitigation:**
- Profile before/after
- Should actually improve (fewer re-renders)
- Monitor React DevTools profiler

---

## Why NOT Do This Refactor?

**Reasons to keep current architecture:**

1. **Current state works "well enough"**
   - Delete works without navigation ✅
   - Objects don't reappear after navigation ✅
   - Selection issues are minor UX annoyance, not blocking

2. **Risk vs reward**
   - 2-3 hours of work with medium risk
   - Could introduce new bugs
   - Team bandwidth might be better spent on features

3. **Workarounds are acceptable**
   - Users can navigate → return → click object → delete
   - Not a data loss bug (soft delete works correctly)
   - Doesn't block core workflows

**When TO do this refactor:**

1. Selection UX becomes blocking for users
2. New features need reliable node state
3. Team has bandwidth for architectural work
4. After other critical bugs are fixed (Bug 5: Mac sleep)

---

## Decision Framework

### Do the refactor if:
- [ ] Selection issues are reported by users frequently
- [ ] New features require reliable ReactFlow state
- [ ] Team has 3+ hours for architectural work
- [ ] All critical bugs (Bug 5) are resolved
- [ ] Comprehensive tests can be written first

### Keep current architecture if:
- [ ] Selection issues are acceptable as-is
- [ ] Team focused on feature delivery
- [ ] Risk of regression outweighs benefits
- [ ] Other critical bugs need attention first

---

## Recommended Path Forward

**Phase 1: Fix Critical Bugs First**
1. Fix Bug 5 (Mac sleep/wake) - Data integrity issue
2. Fix Bug 1 (Status bar "0 Lines") - Quick win
3. Evaluate Bug 2 (Routings) - Feature decision

**Phase 2: Evaluate Selection UX**
1. Gather user feedback on selection issues
2. If blocking: Do refactor
3. If minor: Keep current architecture

**Phase 3: Future Maintenance**
- Document dual-store pattern for new developers
- Add comments explaining synchronization
- Keep this refactor doc as reference

---

## Conclusion

This refactor would **definitively solve** the root cause of selection issues by eliminating dual-store synchronization. However, it's a **medium-effort, medium-risk** change that should be prioritized based on:

1. **User impact:** How much do selection issues affect workflows?
2. **Team bandwidth:** Can we allocate 2-3 hours for this?
3. **Other priorities:** Are there more critical bugs/features?

**Current recommendation:**
- Document this architecture (✅ Done)
- Fix critical bugs first (Bug 5: Mac sleep)
- Revisit refactor decision after user feedback

---

*Documented by: Claude Sonnet 4.5*
*Date: 2026-02-15*
*Status: Proposed architecture for future consideration*

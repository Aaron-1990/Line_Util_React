# Phase 7.6: Canvas Single Source of Truth

> **Date:** 2026-02-17 | **Status:** Completed with post-implementation bugs fixed
> **Spec:** `docs/specs/canvas-single-source-of-truth.md`

---

## Problem This Phase Solved

Before Phase 7.6, canvas node data existed in **two places simultaneously**:

```
useCanvasStore.nodes[].data   ←── ReactFlow's internal copy (CanvasObjectWithDetails)
useCanvasObjectStore.objects[] ←── Zustand single source (CanvasObjectWithDetails)
```

Any operation that updated one without updating the other caused inconsistency bugs:
- Stale names/areas shown on nodes after edit
- Changeover toggle state out of sync
- Delete required two separate removals (nodes[] + objects[])
- Adding new features required remembering to update both copies

---

## Architecture After Phase 7.6

```
useCanvasStore.nodes[].data   ←── { objectId: string }  (reference only)
useCanvasObjectStore.objects[] ←── CanvasObjectWithDetails  (SINGLE SOURCE OF TRUTH)
```

**GenericShapeNode** fetches its own data via Zustand selector:
```typescript
const object = useCanvasObjectStore(
  (state) => state.objects.find((o) => o.id === data.objectId)
);
```

When `objects[]` changes → selector fires → node re-renders automatically. No manual sync needed.

### Invariants (Always True After Phase 7.6)

| Invariant | Meaning |
|-----------|---------|
| `nodes[i].data = { objectId: string }` | Nodes contain only an ID reference, never full object data |
| `objects[j]` is the authoritative record | All reads go through `useCanvasObjectStore` |
| One `updateObject()` is sufficient | No `updateNode()` needed after changes |
| `deleteObject(id)` removes from both stores | Calls `deleteNode(id)` internally |

---

## Implementation Summary (7 BLOQUEs)

| BLOQUE | What Changed |
|--------|-------------|
| 0 | `CanvasNodeData` interface defined in `@shared/types`: `{ objectId: string }` |
| 1 | `useCanvasStore` typed to `Node<CanvasNodeData>[]`, `updateNode()`/`updateAllNodes()`/`refreshNodes()` removed |
| 2 | `useCanvasObjectStore.deleteObject()` calls `deleteNode()` internally |
| 3 | `GenericShapeNode` reads from `objects[]` via selector |
| 4 | `useLoadLines` cache-hit path rebuilds `nodes[]` from `objects[]` (was: returned early) |
| 5 | `UnifiedPropertiesPanel` + `LinePropertiesContent` read from `objects[]` |
| 6 | `ContextMenu`, `AssignModelToObjectModal` updated to new pattern |
| 7 | `ProductionLineNode` (deprecated), `ChangeoverToggle`, `useSelectionState` updated |

---

## Post-Implementation Bugs & Fixes

Three bugs were discovered after the initial implementation. All were caused by **incomplete BLOQUE 0 Fase 2** analysis.

### Bug A: `Rendered fewer hooks than expected` (crash on delete)

**Root Cause:** `useMemo` for handle generation was declared AFTER `if (!object) return null` in `GenericShapeNode`. Hook count: 11 on normal render, 10 on deletion render → React crash.

**Why TypeScript Didn't Catch It:** Rules of Hooks violations are runtime-only. `tsc` sees valid syntax.

**Fix:** Moved `shape`, `isConnectMode`, `isConnectionSource`, `anchors`, and `useMemo(handles)` to BEFORE the early return. Used null-safe `object?.shape` for the pre-return declaration.

```
BEFORE fix:  hooks 1-10 → early return → useMemo (hook 11)  ← CRASH
AFTER fix:   hooks 1-10 → useMemo (hook 11) → early return  ← CORRECT
```

**File:** `src/renderer/features/canvas/components/nodes/GenericShapeNode.tsx`

---

### Bug B: Deleted objects reappear after tab navigation

**Root Cause:** ReactFlow's internal `deleteKeyCode` handler fires FIRST on the container div and removes the node from RF's internal Zustand store. The custom `handleKeyDown` on `document` fires SECOND and calls `getNodes()` — which now returns an empty selection because RF already processed the delete. Custom handler returns early without updating `objects[]` or sending IPC delete. On next canvas visit, cache-hit path rebuilds `nodes[]` from `objects[]` (which still has the object) → reappears.

**Why It Was Hidden Before Phase 7.6:** The old cache-hit path returned early without calling `setNodes()`. Even though `objects[]` had the stale entry, nodes[] was never rebuilt, so the object didn't reappear.

**Fix:** Added `deleteKeyCode={null}` to `<ReactFlow>` component to disable the internal handler. The custom `handleKeyDown` on `document` is the sole delete mechanism.

```typescript
// ProductionCanvas.tsx
<ReactFlow
  deleteKeyCode={null}   // ← CRITICAL: Disables RF internal handler
  // ...
/>
```

**File:** `src/renderer/features/canvas/ProductionCanvas.tsx`

---

### Bug C: ChangeoverToggle semantic mismatch (architectural concern)

**Root Cause:** `refreshNodes()` (partial merge of changeover flags into existing nodes) was removed and replaced with `loadObjectsForPlant()` (full DB reload replacing entire `objects[]`). The callers of `refreshNodes()` were not audited before removal.

**Status:** Not the primary cause of Bug B. The heavier `loadObjectsForPlant()` works functionally but is architecturally sub-optimal (full DB round-trip vs in-memory update).

---

## Lessons Learned (BLOQUE 0 Gaps)

| Gap | What Should Have Been Done |
|-----|---------------------------|
| Rules of Hooks audit | Before adding early returns to a component, grep ALL hooks in that component and verify the early return goes AFTER the last hook |
| ReactFlow prop audit | Before changing how nodes[] is rebuilt, audit which RF props interact with the deletion flow (`deleteKeyCode`, `onNodesChange`) |
| Caller audit before removal | Before removing a method, run `grep -rn "methodName" src/` to find ALL callers and document replacement strategy |

---

## Mandatory Rules for Future Features

### 1. Never put an early return before a hook

```typescript
// ❌ WRONG - crash if object deleted while component mounted
const object = useCanvasObjectStore(...)
if (!object) return null;  // ← NEVER here if more hooks follow
const handles = useMemo(...)  // ← HOOK AFTER RETURN = crash

// ✅ CORRECT - ALL hooks before ANY conditional return
const object = useCanvasObjectStore(...)
const handles = useMemo(...)  // ← hook before return
if (!object) return null;     // ← early return AFTER all hooks
```

### 2. Always set `deleteKeyCode={null}` on the ReactFlow instance

The custom keyboard delete handler in `handleKeyDown` on `document` is the sole delete mechanism. If ReactFlow's internal handler is active, it creates a race condition that prevents `objects[]` from being updated.

### 3. `updateObject()` is the only correct way to update canvas object data

```typescript
// ✅ CORRECT
updateCanvasObject(id, { name: newName });

// ❌ WRONG - node.data is now just { objectId }, nothing to update
updateNode(id, { data: { name: newName } });
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/shared/types/canvas-object.ts` | Added `CanvasNodeData = { objectId: string }` |
| `src/renderer/features/canvas/store/useCanvasStore.ts` | Typed nodes as `Node<CanvasNodeData>[]`, removed `updateNode/updateAllNodes/refreshNodes` |
| `src/renderer/features/canvas/store/useCanvasObjectStore.ts` | `deleteObject` calls `deleteNode` internally |
| `src/renderer/features/canvas/hooks/useLoadLines.ts` | Cache-hit rebuilds nodes from objects[] |
| `src/renderer/features/canvas/components/nodes/GenericShapeNode.tsx` | Reads from objects[] via selector; all hooks before early return including useMemo |
| `src/renderer/features/canvas/components/nodes/ProductionLineNode.tsx` | Same selector pattern; all hooks before early return |
| `src/renderer/features/canvas/components/panels/UnifiedPropertiesPanel.tsx` | LinePropertiesContent + ObjectPropertiesContent read from objects[] |
| `src/renderer/features/canvas/components/panels/LinePropertiesPanel.tsx` | Updated to objects[] pattern |
| `src/renderer/features/canvas/components/ContextMenu.tsx` | Updated |
| `src/renderer/features/canvas/components/modals/AssignModelToObjectModal.tsx` | Updated |
| `src/renderer/features/canvas/store/useCanvasObjectCompatibilityStore.ts` | Updated |
| `src/renderer/features/canvas/hooks/useSelectionState.ts` | Reads objectType from objects[] |
| `src/renderer/features/analysis/components/ChangeoverToggle.tsx` | Uses loadObjectsForPlant instead of removed refreshNodes |
| `src/renderer/features/canvas/ProductionCanvas.tsx` | Added `deleteKeyCode={null}` |
| `src/main/database/repositories/SQLiteCanvasObjectRepository.ts` | WAL checkpoint after delete |

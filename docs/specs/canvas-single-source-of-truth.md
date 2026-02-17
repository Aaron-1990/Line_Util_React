# Canvas Single Source of Truth Specification

## Metadata
- **Designed:** 2026-02-16
- **Designer:** Aaron Zapata
- **Project:** Line Optimizer
- **Framework:** Hibrido v2.0
- **Domain:** Frontend Architecture
- **Phase:** 7.6 - Single Source of Truth Refactoring
- **Agent:** `frontend-developer` (implementation), `code-reviewer` (validation)

---

## Context

Line Optimizer is an Electron + React + TypeScript desktop app for manufacturing line analysis. The canvas uses ReactFlow to render production lines and canvas objects.

### The Problem: Dual Data Sources

Two stores contain DUPLICATED business data:

```
useCanvasStore.nodes[].data = { name, area, processProperties, compatibilitiesCount, shape, ... }
useCanvasObjectStore.objects[]  = { name, area, processProperties, compatibilitiesCount, shape, ... }
```

Every write must update BOTH. Forgetting one = silent bug that appears only in specific navigation scenarios.

### The Solution: Single Source of Truth

Make `nodes[].data` contain ONLY `{ objectId: string }`. `GenericShapeNode` retrieves data via Zustand selector from `objects[]`.

---

## BLOQUE 0: Contracts & Architecture

### New Type

```typescript
// src/shared/types/canvas-object.ts - ADD:
/**
 * Minimal data stored in ReactFlow nodes.
 * Actual business data is retrieved via Zustand selector from useCanvasObjectStore.
 * Phase 7.6: Single Source of Truth
 */
export interface CanvasNodeData {
  objectId: string;
}
```

### Zustand Selector Pattern (Standard)

```typescript
// GenericShapeNode reads from objects[] via selector
const object = useCanvasObjectStore(
  (state) => state.objects.find((o) => o.id === data.objectId)
);
// Zustand uses Object.is comparison:
// - When objects.map() creates new ref for THIS object → re-render ✓
// - When unrelated object changes → same ref returned → NO re-render ✓
```

### Store Interface Changes

**useCanvasStore:**
- `nodes: Node<CanvasNodeData>[]` (was `Node<CanvasObjectWithDetails>[]`)
- REMOVE: `updateNode()` — business data must go through `useCanvasObjectStore`
- REMOVE: `updateAllNodes()` — no longer needed
- REMOVE: `refreshNodes()` — was already deprecated
- KEEP: `addNode()`, `deleteNode()`, `updateNodePosition()`, `setNodes()`

**useCanvasObjectStore:** No interface changes — already authoritative.

### Validation Checklist
- [x] Standard Zustand selector pattern (no workarounds)
- [x] Standard ReactFlow `NodeProps<T>` pattern
- [x] Zustand Object.is optimization handles memo replacement
- [x] No reload from DB required (prevents bugs 3-4-5)
- [x] Changeover toggle continues to work (calls `updateObject` which updates `objects[]`)

---

## BLOQUE 1: Type System

### File: `src/shared/types/canvas-object.ts`

Add at the end of the file:

```typescript
// ============================================
// CANVAS NODE DATA (Phase 7.6 - Single Source of Truth)
// ============================================

/**
 * Minimal data stored in ReactFlow nodes.
 * GenericShapeNode retrieves full data via Zustand selector.
 */
export interface CanvasNodeData {
  objectId: string;
}
```

### File: `src/shared/types/index.ts`

Ensure `CanvasNodeData` is exported (add to existing exports from canvas-object):

```typescript
export type { ..., CanvasNodeData } from './canvas-object';
```

### CHECKPOINT
```bash
npm run type-check
# Expected: Pass (new type added, not yet used)
```

---

## BLOQUE 2: useLoadLines Hook Refactoring

### File: `src/renderer/features/canvas/hooks/useLoadLines.ts`

**Two changes — same pattern in both paths:**

**Initial load path** (~line 96):
```typescript
// BEFORE:
data: obj,  // Full copy of business data

// AFTER:
data: { objectId: obj.id },  // Phase 7.6: Reference only
```

**Cache-hit path** (~line 55):
```typescript
// BEFORE:
data: obj,

// AFTER:
data: { objectId: obj.id },  // Phase 7.6: Reference only
```

Also update the import to include `CanvasNodeData` and type `Node<CanvasNodeData>[]`.

### CHECKPOINT
```bash
npm run type-check
# Expected: Errors in GenericShapeNode.tsx (accessing data.name, etc.)
# This is expected — fixed in BLOQUE 3
```

---

## BLOQUE 3: GenericShapeNode Refactoring (Critical)

### File: `src/renderer/features/canvas/components/nodes/GenericShapeNode.tsx`

**Key changes:**

1. Change `NodeProps<GenericShapeNodeData>` → `NodeProps<CanvasNodeData>`
2. Add Zustand selector at top of component body:
   ```typescript
   const object = useCanvasObjectStore(
     (state) => state.objects.find((o) => o.id === data.objectId)
   );
   if (!object) return null;
   ```
3. Replace all `data.X` with `object.X` (name, objectType, colorOverride, processProperties, bufferProperties, shape, width, height, compatibilitiesCount)
4. REMOVE the custom memo comparison function — Zustand Object.is handles this automatically
5. REMOVE the `GenericShapeNodeData` interface (no longer needed)

**Keep unchanged:**
- All helper functions: `getTypeIcon`, `getTypeColorClass`, `renderPrimitive`, etc.
- `DEFAULT_SHAPE`, `UTILIZATION_THRESHOLDS`, `getBorderColor`
- The changeover toggle handlers — they call `updateCanvasObject` which updates `objects[]`
- All JSX (only variable source changes from `data` to `object`)
- `id` prop still used for analysis results lookup and IPC calls

### CHECKPOINT
```bash
npm run type-check
# Expected: Errors in useSelectionState.ts
```

---

## BLOQUE 4: useSelectionState Hook Refactoring

### File: `src/renderer/features/canvas/hooks/useSelectionState.ts`

**Changes:**

1. Import `useCanvasObjectStore`
2. Subscribe to `objects`:
   ```typescript
   const objects = useCanvasObjectStore((s) => s.objects);
   ```
3. Replace `node.data?.objectType` with lookup from `objects[]`:
   ```typescript
   // BEFORE:
   const objectType = node.data?.objectType;

   // AFTER:
   const object = objects.find((o) => o.id === activeId);
   if (!object) {
     return { type: 'none', selectedId: null, selectedIds: [] };
   }
   const objectType = object.objectType;
   ```

### CHECKPOINT
```bash
npm run type-check
# Expected: Errors in ProductionCanvas.tsx and ContextMenu.tsx
```

---

## BLOQUE 5: Update All addNode() Callers

All callers of `addNode()` must change `data: fullObject` to `data: { objectId: fullObject.id }`.

### Files and Locations

**`src/renderer/features/canvas/ProductionCanvas.tsx`**
- Place tool handler: `data: { objectId: newObjectId }`
- Paste handler: `data: { objectId: newObjectWithDetails.id }`
- Duplicate immediate handler: `data: { objectId: newObjectWithDetails.id }`

**`src/renderer/features/canvas/components/ContextMenu.tsx`**
- `convertFromLine` success: `data: { objectId: fullObject.id }`
- `handleDuplicate` success: `data: { objectId: newObjectWithDetails.id }`

**`src/renderer/features/canvas/store/useCanvasObjectStore.ts`**
- `deleteObject` error revert (2 places): `data: { objectId: objectToDelete.id }`

> NOTE: `duplicateObject` and `convertFromLine` call `loadObjectsForPlant` which rebuilds nodes via `setNodes`. Those paths are already handled by BLOQUE 2.

### CHECKPOINT
```bash
npm run type-check
# Expected: Errors in UnifiedPropertiesPanel.tsx (updateNode calls)
```

---

## BLOQUE 6: Remove updateNode() for Business Data

### File: `src/renderer/features/canvas/components/panels/UnifiedPropertiesPanel.tsx`

Remove `updateNode` from destructuring in `LinePropertiesContent` and `ObjectPropertiesContent`.

Remove these `updateNode()` calls (data is in `objects[]` now, re-renders are automatic):

- `handleNameBlur`: remove `updateNode(data.id, { name: name.trim() })`
- `handleAreaChange`: remove `updateNode(data.id, { area, processProperties: ... })`
- `handleTimeChange`: remove `updateNode(data.id, { timeAvailableDaily, processProperties: ... })`
- `handleProcessPropChange`: remove entire `updateNode(object.id, { processProperties: ... })` block

Keep `useAnalysisStore.getState().refreshData()` calls — those are still needed.

### File: `src/renderer/features/canvas/store/useCanvasObjectCompatibilityStore.ts`

Replace `updateNode({compatibilitiesCount})` with direct `objects[]` update:

```typescript
// BEFORE (after createCompatibility / deleteCompatibility):
const newCount = get().getForObject(canvasObjectId).length;
useCanvasStore.getState().updateNode(canvasObjectId, { compatibilitiesCount: newCount });

// AFTER:
const newCount = get().getForObject(canvasObjectId).length;
// Phase 7.6: Update objects[] directly (single source of truth)
const currentObjects = useCanvasObjectStore.getState().objects;
useCanvasObjectStore.getState().setObjects(
  currentObjects.map(obj =>
    obj.id === canvasObjectId
      ? { ...obj, compatibilitiesCount: newCount }
      : obj
  )
);
```

> NOTE: `useCanvasObjectCompatibilityStore` must import `useCanvasObjectStore`.
> REMOVE import of `useCanvasStore` from this file (no longer needed).

### File: `src/renderer/features/canvas/components/ContextMenu.tsx`

Remove any remaining `updateNode()` calls for business data (e.g., after type conversion).

### CHECKPOINT
```bash
npm run type-check
# Expected: Pass
```

---

## BLOQUE 7: Clean Up useCanvasStore

### File: `src/renderer/features/canvas/store/useCanvasStore.ts`

1. Update import: `import { CanvasNodeData } from '@shared/types';`
2. Change `nodes: Node[]` to `nodes: Node<CanvasNodeData>[]`
3. REMOVE from interface and implementation:
   - `updateNode()`
   - `updateAllNodes()`
   - `refreshNodes()` (was already marked deprecated)
4. Update `initialState` typing

### CHECKPOINT
```bash
npm run type-check
# Expected: Pass with 0 errors
```

---

## BLOQUE FINAL: Verification

### Automated
```bash
npm run type-check
# Expected: 0 errors

# Verify no updateNode calls remain for business data:
grep -rn "updateNode(" src/renderer --include="*.ts" --include="*.tsx"
# Expected: Only definition in useCanvasStore.ts (if any leftover), nothing else

# Verify all addNode calls use objectId pattern:
grep -rn "addNode(" src/renderer --include="*.ts" --include="*.tsx" -A 6 | grep "data:"
# Expected: All show "objectId:" pattern
```

### Manual Test Checklist

**Test 1: Basic rendering**
- [ ] Objects appear on canvas
- [ ] Process objects show card with area, time, efficiency
- [ ] Non-process objects show shape layout
- [ ] No console errors

**Test 2: Single source of truth**
- [ ] Change name in panel → node updates immediately
- [ ] Change area in panel → node updates, status bar updates
- [ ] Change time in panel → node updates, status bar updates
- [ ] Add model → incompleteness badge updates
- [ ] Delete model → incompleteness badge updates

**Test 3: Changeover toggle**
- [ ] Click timer icon on node → toggles state
- [ ] Runs analysis → utilization bars correct

**Test 4: Navigation (the original bug)**
- [ ] Create 3 process objects
- [ ] Navigate to Models tab, return to Canvas
- [ ] Delete objects one by one → counter decrements each time
- [ ] Set area + time + model on an object → badge disappears, green dot appears

**Test 5: CRUD operations**
- [ ] Create object (place tool)
- [ ] Duplicate (Ctrl+D)
- [ ] Copy/paste (Ctrl+C, Ctrl+V)
- [ ] Delete from panel
- [ ] Convert type (ContextMenu)

**Test 6: Regression check (bugs 3-4-5)**
- [ ] Navigate rapidly between tabs — no blank canvas, no remount
- [ ] Sleep/wake Mac — canvas recovers

---

## Implementation Command

```bash
claude "@frontend-developer implement canvas-single-source-of-truth according to docs/specs/canvas-single-source-of-truth.md"
```

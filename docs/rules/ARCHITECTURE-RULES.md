# Architecture Rules Registry

> **Canonical location for all mandatory architectural rules.**
> Other docs reference this file — they do NOT duplicate these rules.
> Last updated: 2026-03-05

---

## Rule 1: All Hooks Before Any Early Return (React)

**Status:** MANDATORY since Phase 7.6 (2026-02-17)
**Applies to:** All React node/panel components — `GenericShapeNode.tsx`, `LayoutImageNode.tsx`, `LayoutPropertiesPanel.tsx`, and any future node/panel component

**Audit command:**
```bash
grep -n "use[A-Z]\|useMemo\|useCallback\|useEffect\|useState\|useRef" src/renderer/features/canvas/components/nodes/YourComponent.tsx
# PASS: last hook line number < early return line number
# FAIL: any hook declared AFTER a "return null" or "return;"
```

**Rationale:** TypeScript cannot detect Rules of Hooks violations — they crash at runtime when the component renders with undefined data (e.g., during object deletion).

**Origin:** Phase 7.6 Bug A — `useMemo(handles)` placed after `if (!object) return null` in `GenericShapeNode.tsx` caused `Rendered fewer hooks than expected` crash on delete.

**If adding new hooks to an existing component:**
1. Check current early return line number
2. Place new hook ABOVE it
3. Verify with audit command

---

## Rule 2: `deleteKeyCode={null}` on ReactFlow Instance

**Status:** MANDATORY since Phase 7.6 (2026-02-17)
**Applies to:** `src/renderer/features/canvas/ProductionCanvas.tsx` — the `<ReactFlow>` component

**Required prop:**
```tsx
<ReactFlow
  deleteKeyCode={null}   // REQUIRED — do NOT remove
  ...
/>
```

**Rationale:** Without this, ReactFlow's internal Delete/Backspace handler fires before the custom `document`-level handler, empties the selection, and the custom handler becomes a NOOP — so `objects[]` is never updated and deleted objects reappear after tab navigation.

**Origin:** Phase 7.6 Bug B — deleted canvas objects reappeared after plant tab navigation.

---

## Rule 3: Single Source of Truth — Nodes Hold Only Reference IDs

**Status:** MANDATORY since Phase 7.6 (2026-02-17)
**Applies to:** All canvas node types — canvas objects and layout images

**Pattern:**
```typescript
// ReactFlow node data — reference only:
type CanvasNodeData = { objectId: string }
type LayoutNodeData = { layoutId: string }

// All actual data lives in Zustand stores:
// - Canvas objects: useCanvasObjectStore.objects[]
// - Layout images: useLayoutStore.layouts[]
```

**Update via:**
- Canvas objects: `updateObject(id, changes)` — never update `node.data` directly
- Layout images: `updateLayout(id, input)` — never update `node.data` directly

**Delete via:**
- `deleteObject(id)` — handles both `objects[]` and ReactFlow nodes internally
- Do NOT call `deleteNode(id)` and `objects.filter(...)` separately

**Rationale:** Updating `node.data` directly is silently ignored — nodes read from the Zustand stores, not from `node.data`.

**Origin:** Phase 7.6 — canvas refactoring eliminated dual source of truth between ReactFlow nodes and Zustand store.

---

## Rule 4: Dynamic `getInstance()` in All IPC Handlers

**Status:** MANDATORY since Phase 8.0 (2026-02-07)
**Applies to:** All 15 IPC handlers that access the database

**Pattern:**
```typescript
// WRONG — captured at registration, stale after replaceInstance():
export function registerHandler(): void {
  const repo = new SomeRepository(DatabaseConnection.getInstance()); // captured once
  ipcMain.handle('channel', async () => repo.findAll()); // uses stale connection
}

// CORRECT — fresh instance on every call:
export function registerHandler(): void {
  ipcMain.handle('channel', async () => {
    const repo = new SomeRepository(DatabaseConnection.getInstance()); // fresh every time
    return repo.findAll();
  });
}
```

**Rationale:** `DatabaseConnection.replaceInstance()` is called when opening `.lop` files. Handlers that capture the instance at registration time will use a closed/stale connection after file open.

**Audited handlers (all 15 fixed as of Phase 8.2):**
`project`, `plant`, `production-lines`, `changeover`, `compatibility`, `models-v2`, `volumes`, `analysis`, `canvas-objects`, `canvas-object-compatibility`, `excel`, `model-processes`, `multi-sheet-excel`, `product-models`, `area-catalog`

**Origin:** Phase 8.0 — 10 bugs from stale DB references after opening .lop files.

---

## Rule 5: Never Call `refreshAllStores()` on Resume

**Status:** MANDATORY since Bug 5 fix (2026-02-15)
**Applies to:** `src/renderer/components/layout/AppLayout.tsx` — the resume/reconnect handler

**Required behavior:**
```typescript
// Resume handler MUST be log-only:
ipcRenderer.on('app:resume', () => {
  console.log('[AppLayout] App resumed — stores persist in memory, no reload');
  // DO NOT call refreshAllStores() here
});
```

**Rationale:** On Mac wake, Vite's HMR WebSocket reconnects but the page does NOT reload (blocked by `beforeunload`). Calling `refreshAllStores()` would overwrite the in-memory Zustand state (which is correct) with stale DB data.

**Full mechanism:** See `docs/fixes/bug-5-mac-sleep-wake-objects-reappear.md` (v4 solution).

**Origin:** Bug 5 — deleted canvas objects reappeared after Mac sleep/wake.

---

## Rule 6: `original_width` / `original_height` Are Immutable After Creation

**Status:** MANDATORY since Phase 8.5b (2026-02-25)
**Applies to:** `src/main/database/repositories/SQLiteLayoutRepository.ts` — the `update()` method

**Rule:** Never write `original_width` or `original_height` in `update()`. These columns are set once at import time and serve as the "Reset to Original" baseline.

**Origin:** Phase 8.5b — added Reset Dimensions button; baseline must be stable.

---

## Rule 7: Rotation via CSS on Inner Wrapper, NOT the ReactFlow Node

**Status:** MANDATORY since Phase 8.5b (2026-02-25)
**Applies to:** `src/renderer/features/canvas/components/nodes/LayoutImageNode.tsx`

**Pattern:**
```tsx
// CORRECT — rotation on inner content div:
<div className="layout-node-wrapper">                    {/* ReactFlow node — NO rotation */}
  <NodeResizer ... />
  <div style={{ transform: `rotate(${layout.rotation}deg)` }}>  {/* rotation HERE */}
    <img src={layout.imageData} />
  </div>
</div>

// WRONG — rotation on the ReactFlow node wrapper breaks NodeResizer handles
```

**Rationale:** Rotating the outer ReactFlow node wrapper misaligns the NodeResizer handles (they would rotate with the image, making drag-resize broken). CSS rotation on the inner wrapper keeps handles axis-aligned.

**Origin:** Phase 8.5b — ReactFlow v11 does not support native node rotation.

---

## Adding New Rules

When a new mandatory architectural rule is established during a phase:

1. Add it here with full format (status, applies-to, audit command, rationale, origin)
2. Add a one-line reference in `.claude/CLAUDE.md` Critical Code Sections
3. Add an audit step to `docs/standards/BUG-5-AND-3-4-PREVENTION-CHECKLIST.md` if applicable
4. Update the CHANGELOG entry for the phase with: `Rules introduced: Rule N (see ARCHITECTURE-RULES.md)`

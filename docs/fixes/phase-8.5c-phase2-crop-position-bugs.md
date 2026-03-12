# Phase 8.5c Phase 2 — Crop Position Bugs (2026-03-11)

**Status:** RESOLVED — All bugs verified 2026-03-11
**Files:** `useLayoutStore.ts`, `ProductionCanvas.tsx`, `LayoutImageNode.tsx`, `CropOverlay.tsx`, `deriveBounds.ts`

## Bugs Fixed

### Bug 1 — Node jumps to import position on setCropMode
**Root cause:** `imageOriginX/Y` never updated when user dragged node after import. `onNodesChange` updated `xPosition/yPosition` but not the primary origin fields.
**Fix:** In `onNodesChange` `dragging:true`/`false` branches, compute `imageOriginX = nodeX - (cropX??0) * imageScale` and persist alongside `xPosition/yPosition`.
**Status:** RESOLVED ✓

### Bug 2 — Post-commit jump to upper-left (floating-point echo corruption)
**Root cause:** After `commitCrop`/`resetCrop`/`setCropMode`, ReactFlow echoes a `dragging:true` position change. The handler processed this echo as a real drag and recomputed `imageOriginX/Y` as `echoNodeX - cropX*scale`. Due to floating-point: `(imageOriginX + cropX*scale) - cropX*scale ≠ imageOriginX` — ~1.6px drift per cycle, accumulating across re-crops.
**Fix:** `isTrackedDrag` guard in `onNodesChange`. `imageOriginX/Y` only updated when ID was **already** in `draggingLayoutIds` before the current event (confirmed continuing drag). First `dragging:true` (potentially echo) skips origin update. Final `dragging:false` always writes correct origin.
**Status:** RESOLVED ✓

### Bug 3 — Re-crop without handle movement resets to origin
**Root cause:** `setCropMode` set `pendingCrop: null`. If user entered crop mode and clicked Done without moving handles, `commitCrop` found both `pendingCrop = null` and `layout.cropX/Y/W/H` preserved — intent was ambiguous and fragile.
**Fix:** `setCropMode` pre-populates `pendingCrop` with the existing crop values (if any) before expanding the node. `commitCrop` reads `pendingCrop` first, so Done without handle movement re-applies the same crop.
**Status:** RESOLVED ✓

### Bug 4 — Click outside / Escape behavior (PowerPoint-style)
**Root cause:** `onPaneClick` and `onNodeClick` called `setCropMode(null)` which exits without committing.
**Fix:** `onPaneClick` and `onNodeClick` call `commitCrop(cropId)` — click outside = commit. `CropOverlay` Escape calls `onCancel` → `handleCancelCrop` clears pendingCrop then calls `commitCrop` with no pending → restores pre-session crop.
**Status:** RESOLVED ✓

### Bug 5 — Locked image blocks canvas panning
**Root cause (original attempt):** `isPassThrough = l.locked` (unconditional) was tried but broke image selection entirely — locked+unselected nodes have `selectable:false` + `pointer-events:none`, so users could never click to select a locked image and see the unlock/visibility buttons.
**Correct fix:** Two-layer approach:
1. `isPassThrough = l.locked && selectedNode !== l.id` (conditional) — unselected locked nodes are fully transparent; selected locked nodes keep RF wrapper events for selection management.
2. Image content wrapper (`<div style={{ overflow:'hidden' }}>`) gets `pointerEvents: 'none'` when `layout.locked` — drag over image content passes through to canvas panning.
3. Control buttons overlay retains `pointerEvents: 'auto'` — clickable even when image content is transparent.
**Status:** RESOLVED ✓

---

## Architecture: Primary Fields (Phase 8.5c Phase 2)

| Field | Mutates on | Formula |
|-------|-----------|---------|
| `imageOriginX/Y` | drag only | `nodeX - (cropX??0) * imageScale` |
| `imageScale` | resize only | `nodeW / (cropW??originalW)` |
| `cropX/Y/W/H` | crop commit only | set by CropOverlay handles |
| `xPosition/yPosition/width/height` | derived | `deriveBounds()` — single source |

## Key Invariants
- `deriveBounds()` is the ONLY place the derivation formula is written
- `imageOriginX/Y` must NOT be recomputed from programmatic RF echoes (guard: `isTrackedDrag`)
- `setCropMode` preserves prior `cropX/Y/W/H` in `pendingCrop` for Done-without-movement
- Locked nodes: `isPassThrough` is conditional (locked AND not selected). Image content div is `pointer-events:none` when locked. Control buttons are `pointer-events:auto`.
- Tailwind Preflight override: `<img>` elements inside `overflow:hidden` + `transform` containers MUST have `maxWidth:'none', maxHeight:'none'` inline to prevent global CSS reset from compressing dimensions.

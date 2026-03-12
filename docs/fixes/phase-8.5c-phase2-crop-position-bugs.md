# Phase 8.5c Phase 2 — Crop Position Bugs (2026-03-11)

**Status:** Fixed
**Files:** `useLayoutStore.ts`, `ProductionCanvas.tsx`, `LayoutImageNode.tsx`, `CropOverlay.tsx`, `deriveBounds.ts`

## Bugs Fixed

### Bug 1 — Node jumps to import position on setCropMode (BUG 1)
**Root cause:** `imageOriginX/Y` never updated when user dragged node after import. `onNodesChange` updated `xPosition/yPosition` but not the primary origin fields.
**Fix:** In `onNodesChange` `dragging:true`/`false` branches, compute `imageOriginX = nodeX - (cropX??0) * imageScale` and persist alongside `xPosition/yPosition`.

### Bug 2 — Post-commit jump to upper-left (floating-point echo corruption)
**Root cause:** After `commitCrop`/`resetCrop`/`setCropMode`, ReactFlow echoes a `dragging:true` position change. The handler processed this echo as a real drag and recomputed `imageOriginX/Y` as `echoNodeX - cropX*scale`. Due to floating-point: `(imageOriginX + cropX*scale) - cropX*scale ≠ imageOriginX` — ~1.6px drift per cycle, accumulating across re-crops.
**Fix:** `isTrackedDrag` guard in `onNodesChange`. `imageOriginX/Y` only updated when ID was **already** in `draggingLayoutIds` before the current event (confirmed continuing drag). First `dragging:true` (potentially echo) skips origin update. Final `dragging:false` always writes correct origin.

### Bug 3 — Re-crop without handle movement resets to origin
**Root cause:** `setCropMode` set `pendingCrop: null`. If user entered crop mode and clicked Done without moving handles, `commitCrop` found both `pendingCrop = null` and `layout.cropX/Y/W/H` preserved (expandedBounds doesn't clear them) — but the intent was ambiguous and fragile.
**Fix:** `setCropMode` pre-populates `pendingCrop` with the existing crop values (if any) before expanding the node. `commitCrop` reads `pendingCrop` first, so Done without handle movement re-applies the same crop.

### Bug 4 — Click outside / Escape behavior (PowerPoint-style)
**Root cause:** `onPaneClick` and `onNodeClick` called `setCropMode(null)` which exits without committing.
**Fix:** `onPaneClick` and `onNodeClick` call `commitCrop(cropId)` — click outside = commit. `CropOverlay` Escape calls `onCancel` → `handleCancelCrop` clears pendingCrop then calls `commitCrop` with no pending → restores pre-session crop.

### Bug 5 — Locked image blocks canvas panning
**Root cause:** `isPassThrough = l.locked && selectedNode !== l.id`. When locked image was selected, `pointer-events:none` was removed from the RF wrapper, letting the node capture drag events and block canvas pan.
**Fix:** `isPassThrough = l.locked` (unconditional). Control buttons overlay gets `pointerEvents:'auto'` to remain clickable despite inherited `none`.

## Architecture: Primary Fields (Phase 8.5c Phase 2)

| Field | Mutates on | Formula |
|-------|-----------|---------|
| `imageOriginX/Y` | drag only | `nodeX - (cropX??0) * imageScale` |
| `imageScale` | resize only | `nodeW / (cropW??originalW)` |
| `cropX/Y/W/H` | crop commit only | set by CropOverlay handles |
| `xPosition/yPosition/width/height` | derived | `deriveBounds()` — single source |

## Key Invariants
- `deriveBounds()` is the ONLY place the derivation formula is written
- `imageOriginX/Y` must NOT be recomputed from programmatic RF echoes
- `setCropMode` preserves prior `cropX/Y/W/H` in `pendingCrop` for Done-without-movement
- Locked layout nodes always have `pointer-events:none`; only control buttons use `pointer-events:auto`

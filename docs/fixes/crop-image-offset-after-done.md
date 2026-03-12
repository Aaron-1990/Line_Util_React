# Bug: Image Appears Offset After "Done Cropping"

**Status:** RESOLVED — 2026-03-11 (verified all scenarios)
**Date opened:** 2026-03-05
**Feature:** Phase 8.5c — PowerPoint-style non-destructive image crop
**Symptom:** After clicking "Done Cropping", the node border correctly shrinks to the crop region, but the image content inside the border appears visually offset ("desfasada").

---

## What We Were Trying to Do

When the user draws a crop rectangle in crop mode and clicks "Done Cropping":
1. The node border should shrink to exactly surround the selected crop region.
2. The image inside the border should show only the cropped portion, aligned to fill the border with no offset.

---

## Files Involved

| File | Role |
|------|------|
| `src/renderer/features/canvas/store/useLayoutStore.ts` | `commitCrop`, `setCropMode`, `resetCrop` — crop state machine |
| `src/renderer/features/canvas/components/nodes/LayoutImageNode.tsx` | `renderImage` — renders image with crop clipping |
| `src/renderer/features/canvas/components/nodes/CropOverlay.tsx` | Renders handles, converts mouse drag to image pixels |
| `src/renderer/features/canvas/utils/deriveBounds.ts` | `deriveBounds()` — single source of truth for xPosition/yPosition/width/height |
| `src/renderer/features/canvas/ProductionCanvas.tsx` | `layoutNodes` useMemo, `onNodesChange` handler |

---

## Fix History

### v1 (Phase 8.5c original)
`commitCrop` exited crop mode but did NOT resize the node. Border stayed at original size, image showed cropped region. Image appeared offset because the border was the wrong size.

### v2 (Phase 8.5c-patch)
`commitCrop` added node resize logic with aspect-ratio heuristic to detect "already resized" case.

**Root cause of v2 failure:** False positive when crop has same aspect ratio as original image. Heuristic triggered on first-time crops, computing wrong canonical dimensions. Node stayed at original size. Image offset persisted.

### v3
Removed the heuristic. `commitCrop` always uses `layout.width, layout.height` as canonical.
**Result:** Border shrinks correctly. Image offset persists. Math traces correct — visual offset NOT explained by a math error.

---

## Root Cause Investigation: 5 Sessions, Correct Math, Wrong Visual

The most significant insight of this debugging journey: **5 sessions of correct math producing wrong visual output**. The root cause was in a completely different layer — CSS — not in the geometry calculations.

### Fix 4 — `prevCommittedCrop` snapshot (Session 2, 2026-03-08)

**Root cause:** `handleCropEnd` fires BEFORE "Done Cropping" and overwrites `layout.cropX/Y/W/H` with the NEW crop values. `commitCrop` used `layout.cropW` as `prevCropW` → aspect-match ran against the NEW crop, not the previously committed crop → wrong scale/origin when crop AR ≈ node AR.

**Fix:** `prevCommittedCrop` snapshot saved at `setCropMode` entry. `commitCrop` + `resetCrop` use `prevCommittedCrop` for scale/origin detection. Applied 2026-03-08. **Did not fully resolve the visual offset.**

---

## Resolution — FINAL (2026-03-11)

### Fix 5 — Phase 1: Tailwind Preflight CSS Override (RENDERING BUG)

**Root cause:** Tailwind Preflight injects `img { max-width: 100%; height: auto }` globally. Inside an `overflow:hidden` + CSS `transform` container (the crop clipping div), this global reset compressed the `<img>` element below its intended render size (`imgW × imgH`). The image was physically smaller than the math expected, so the `translate(X, Y)` offset was correct by geometry but wrong by visual position.

**Fix:** Added `maxWidth: 'none', maxHeight: 'none'` to the `<img>` inline style in `LayoutImageNode.tsx` `renderImage()`:

```typescript
<img
  style={{
    width: imgW,
    height: imgH,
    maxWidth: 'none',   // overrides Tailwind Preflight max-width:100%
    maxHeight: 'none',  // overrides Tailwind Preflight height:auto
    transform: `translate(${translateX}px, ${translateY}px)`,
    ...
  }}
/>
```

**Files changed:** `LayoutImageNode.tsx` — `renderImage()` function.
**Status:** VERIFIED WORKING.

---

### Fix 6 — Phase 2: Permanent Image Origin Architecture (ARCHITECTURE MIGRATION)

**Root cause of re-crop bugs:** The old architecture stored `xPosition/yPosition/width/height` as primary fields and reverse-engineered `imageScale` and `imageOrigin` during re-crop. This accumulated floating-point errors across sequential crops.

**Fix:** Migrated to primary-field architecture:

| Field | Mutates on | Formula |
|-------|-----------|---------|
| `imageOriginX/Y` | user drag only | `nodeX - (cropX??0) * imageScale` |
| `imageScale` | user resize only | `nodeW / (cropW??originalW)` |
| `cropX/Y/W/H` | crop commit only | set by CropOverlay handles |
| `xPosition/yPosition/width/height` | derived | `deriveBounds()` — single source of truth |

**Additional fixes during Phase 2:**
- `setCropMode` pre-populates `pendingCrop` with previous crop values (prevents re-crop without handle movement from defaulting to origin)
- `handleResizeEnd` updates `imageScale` and recomputes `imageOriginX/Y` (prevents incomplete image after resize)
- `isTrackedDrag` guard prevents ReactFlow echo events from corrupting `imageOriginX/Y`
- Click-outside commits crop (PowerPoint-style behavior — `onPaneClick` calls `commitCrop`)
- SQLite migration `022_layout_image_origin.sql` adds `image_origin_x`, `image_origin_y`, `image_scale` columns

**Files changed:** `useLayoutStore.ts`, `ProductionCanvas.tsx`, `LayoutImageNode.tsx`, `CropOverlay.tsx`, `deriveBounds.ts`, `SQLiteLayoutRepository.ts`, migration `022`.
**Status:** VERIFIED WORKING — all test scenarios pass (first crop, re-crop, reset, re-crop after reset, resize after crop, multiple zoom levels).

---

## Cross-Layer Debugging Protocol Insight

**The 5-session lesson:** When math is provably correct but visual output is wrong, the bug is in a DIFFERENT layer than where you are looking. In this case:

- Layer 1 (geometry/math): verified correct in sessions 1-5
- Layer 2 (Zustand state): fixed (atomic commits, `prevCommittedCrop`)
- Layer 3 (ReactFlow echoes): fixed (`isTrackedDrag` guard)
- **Layer 4 (CSS global resets): ROOT CAUSE** — Tailwind Preflight overriding inline dimensions

**Protocol for next time:** When math is correct and visual is wrong, audit in this order:
1. CSS `max-width`, `max-height`, `height: auto` global resets on the element
2. Parent container CSS that could compress children
3. Framework-level styles (Tailwind Preflight, CSS reset libraries)
4. Then suspect state/math

---

## Verified Test Scenarios (2026-03-11)

- [x] First crop of freshly imported image
- [x] Re-crop after a committed crop
- [x] Reset crop → image returns to original
- [x] Re-crop after reset
- [x] Resize node after crop (imageScale updates correctly)
- [x] Multiple zoom levels (crop handles align correctly)
- [x] Click outside crop mode → commits (PowerPoint behavior)
- [x] Escape → restores pre-session crop

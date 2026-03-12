# Bug: Image Appears Offset After "Done Cropping"

**Status:** IN PROGRESS — 2026-03-08 (Session 2 fix applied, pending user verification)
**Date opened:** 2026-03-05
**Feature:** Phase 8.5c — PowerPoint-style non-destructive image crop
**Symptom:** After clicking "Done Cropping", the node border correctly shrinks to the crop region, but the image content inside the border appears visually offset ("desfasada").

---

## What We Are Trying to Do

When the user draws a crop rectangle in crop mode and clicks "Done Cropping":
1. The node border should shrink to exactly surround the selected crop region.
2. The image inside the border should show only the cropped portion, aligned to fill the border with no offset.

Step 1 now works (v3 fix). Step 2 does not.

---

## Symptom / Exact Behavior

- **Border**: shrinks correctly to the crop selection dimensions ✓
- **Image content inside the border**: appears shifted relative to where the crop handles were drawn ✗

The image appears to have moved within the border. The crop rectangle shown during crop mode does not match what is visible after Done Cropping.

---

## Files Involved

| File | Lines | Role |
|------|-------|------|
| `src/renderer/features/canvas/store/useLayoutStore.ts` | 236–273 | `commitCrop` — resizes/repositions node on Done |
| `src/renderer/features/canvas/components/nodes/LayoutImageNode.tsx` | 176–222 | `renderImage` — renders image with crop clipping |
| `src/renderer/features/canvas/components/nodes/LayoutImageNode.tsx` | 255–267 | `computeCropParams` — provides coordinate system to CropOverlay |
| `src/renderer/features/canvas/components/nodes/CropOverlay.tsx` | 82–324 | Renders handles, converts mouse drag to image pixels |
| `src/renderer/features/canvas/utils/containBounds.ts` | 1–23 | `computeContainBounds` — shared object-fit:contain math |
| `src/renderer/features/canvas/ProductionCanvas.tsx` | 139–173 | `layoutNodes` useMemo — maps layouts → ReactFlow node objects |

---

## Fix History

### v1 (Phase 8.5c original)
`commitCrop` exited crop mode but did NOT resize the node. Border stayed at original size, image showed cropped region. Image appeared offset because the border was the wrong size.

### v2 (Phase 8.5c-patch — session before this one)
`commitCrop` added node resize logic:
- Detected "already resized" case using heuristic: `scaleW = layout.width / layout.cropW`, `scaleH = layout.height / layout.cropH`; if `|scaleW - scaleH| < 0.001 AND cropW < originalWidth`, assumed node was already crop-sized and "undid" the resize to get canonical dimensions.

**Root cause of v2 failure:** False positive when crop has same aspect ratio as original image (e.g., corner crop, proportional selection). The heuristic triggered on first-time crops, computing `canonicalW = originalWidth * scaleW = originalWidth * (nodeWidth/cropW)`. For a 1920×1080 node with 960×540 crop: `scaleW = 1920/960 = 2`, so `canonicalW = 1920*2 = 3840 → newWidth = 960*2 = 1920`. Node stayed at original size. Image offset persisted.

### v3 (current — this session)
Removed the heuristic. `commitCrop` now always uses `layout.width, layout.height` as canonical:

```typescript
const fullBounds = computeContainBounds(
  layout.originalWidth, layout.originalHeight,
  layout.width, layout.height
);
const scale = fullBounds.width / layout.originalWidth;
get().updateLayout(id, {
  width: layout.cropW * scale,
  height: layout.cropH * scale,
  xPosition: layout.xPosition + fullBounds.x + layout.cropX * scale,
  yPosition: layout.yPosition + fullBounds.y + layout.cropY * scale,
});
```

**Result:** Border now shrinks correctly. Image offset persists.

**Diagnostic `console.log` added** at line 257 in `useLayoutStore.ts`:
```typescript
console.log('[commitCrop]', {
  node: { w: layout.width, h: layout.height, x: layout.xPosition, y: layout.yPosition },
  crop: { x: layout.cropX, y: layout.cropY, w: layout.cropW, h: layout.cropH },
  original: { w: layout.originalWidth, h: layout.originalHeight },
  fullBounds, scale,
  result: { w: layout.cropW * scale, h: layout.cropH * scale },
});
```

This log is still present in the code.

---

## Math Trace (v3 — verified correct)

For a 1000×800 image in a 1000×800 node, crop `{x:200, y:100, w:600, h:500}`:

**commitCrop:**
- `fullBounds = {x:0, y:0, w:1000, h:800}`, `scale = 1`
- `newW=600, newH=500, newX=origX+200, newY=origY+100` ✓

**renderImage after commitCrop** (`layout.width=600, layout.height=500`):
- `cropBounds = computeContainBounds(600, 500, 600, 500) = {0, 0, 600, 500}` (same AR, no letterbox)
- `scale2 = 1` (same as commitCrop scale)
- `imgW=1000, imgH=800`
- `translateX = -200, translateY = -100`
- Image at (-200,-100) clipped to 600×500 container → shows pixels (200..800, 100..600) ✓

The math traces as correct. The visual offset is NOT explained by a math error in either function.

---

## Current Hypotheses

### Hypothesis A (Most Likely): ReactFlow node position does not update

`commitCrop` calls `updateLayout({ xPosition: newX, yPosition: newY })`. This updates `layouts` in the Zustand store. The `layoutNodes` useMemo in `ProductionCanvas` depends on `[layouts, selectedNode, cropModeLayoutId]` and rebuilds with `position: { x: l.xPosition, y: l.yPosition }`.

**Question:** Does ReactFlow actually move the node to `(newX, newY)` on canvas?

If ReactFlow IGNORES or lags the position update (e.g., because it caches node positions in internal state), then:
- The border shrinks (LayoutImageNode inner div uses `layout.width/height` directly) ✓
- The image is translated by `-cropX*scale, -cropY*scale` (expecting the node to have moved)
- But the node is still at the original canvas position
- Net visible effect: image appears to shift LEFT/UP by `fullBounds.x + cropX*scale, fullBounds.y + cropY*scale` from expected

This would create an offset that is exactly proportional to the crop offset — the further the crop is from the top-left of the image, the more offset the image appears.

### Hypothesis B: renderImage uses stale layout.width/height

If `renderImage` executes during a partial render where `cropModeLayoutId` has been set to null (so `isCropMode=false` and `renderCrop = storedCrop`) but `layout.width/height` still reflect the PRE-COMMIT node size, then:

- `cropBounds = computeContainBounds(cropW, cropH, OLD_nodeW, OLD_nodeH)` → may have letterbox x/y
- `scale2` is larger than `scale_from_commitCrop`
- `translateX = cropBounds.x - cropX * scale2` → wrong offset

This would only occur if Zustand batching fails and renders happen in an interleaved order.

### Hypothesis C: Floating point accumulation (sequential crops)

After the first `commitCrop`, the node is `cropW*scale × cropH*scale`. On the second crop, `computeContainBounds(originalW, originalH, cropW*scale, cropH*scale)` computes `fullBounds` with potential tiny rounding errors. These accumulate over sequential crops. The offset would grow with each crop operation.

---

## Next Steps for Next Session

**Step 1: Read the `[commitCrop]` console.log output**

Trigger a crop and Done Cropping, then check DevTools console. Verify:
- `scale` matches what you expect (`fullBounds.width / original.w`)
- `result.w` and `result.h` are the expected crop dimensions
- `node.x + fullBounds.x + crop.x * scale` = expected new canvas X position

**Step 2: Verify ReactFlow node position**

After clicking Done, check in React DevTools (or add a debug label) whether the node's canvas position actually changed to `result.newX, result.newY`. If the node is still at the original position, Hypothesis A is confirmed.

**Step 3: Verify renderImage scale**

Add a `console.log` inside `renderImage` (only when not in crop mode) to print `cropBounds`, `scale`, `translateX`, `translateY`. Compare these values to what commitCrop computed — they should match.

**Step 4: If Hypothesis A confirmed**

Force ReactFlow to accept the new position. Options:
- Add a `key` prop to the node that changes when position is updated programmatically (forces remount — last resort)
- Use ReactFlow's `setNodes` imperative API via `useReactFlow()` to update position directly
- Check whether `onNodesChange` for position changes conflicts with the external position update

**Step 5: If Hypothesis B confirmed**

Ensure `commitCrop` is atomic — use a single Zustand `set()` call that updates both `layouts` and `cropModeLayoutId` at once:
```typescript
set((state) => ({
  layouts: state.layouts.map((l) => l.id === id ? { ...l, ...input } : l),
  cropModeLayoutId: null,
}));
```

---

## Resolution (2026-03-08) — Session 1: Partial

### Root Cause (Session 1)

Two separate architectural flaws compounding:

**Flaw 1 (primary):** `commitCrop` treated a single user action ("Done Cropping") as two separate Zustand `set()` calls — `updateLayout()` (updates `layouts`) followed by `set({cropModeLayoutId: null})`.

**Flaw 2 (defense-in-depth):** `onNodesChange` in `ProductionCanvas.tsx` unconditionally wrote ALL position changes from ReactFlow back to the store — including echoed position changes from the controlled `nodes` prop.

### Fix Applied (Session 1)

1. **Atomic `commitCrop`** — Single `set()` updates `layouts` AND `cropModeLayoutId: null` simultaneously.
2. **Atomic `resetCrop`** — Same pattern.
3. **`onNodesChange` SSoT guard** — Only processes `change.dragging === true/false`. Ignores undefined (programmatic echo). Added `draggingLayoutIds` ref to distinguish user drags from spurious `dragging===false` echoes.

**Bug still persisted after Session 1.**

---

## Resolution (2026-03-08) — Session 2: Root Cause Found

### Root Cause (Session 2)

`commitCrop` uses `layout.cropW/H` to detect re-crop and `layout.cropX/Y` to reconstruct the image origin. But `handleCropEnd` runs BEFORE "Done Cropping" and overwrites `layout.cropX/Y/W/H` with the NEW crop values.

**Effect:** The aspect-match heuristic compares `nodeW / newCropW` (wrong) instead of `nodeW / prevCommittedCropW` (correct). When the new crop happens to have AR ≈ node AR, the re-crop path fires on a first crop, computing a wrong scale and origin. The node's border may appear correct while the image shifts inside it. Same flaw in `resetCrop`.

**Concrete trigger:** Image 1920×872 (AR 2.202) in node 800×363 (AR 2.204). User crops to any rectangle with AR ≈ 2.20 (e.g., proportional to the image). Heuristic wrongly takes re-crop path → node doesn't resize → image appears offset inside unchanged border.

### Fix Applied (Session 2)

**`prevCommittedCrop` — snapshot at crop mode entry.**

1. Added `prevCommittedCrop` field to store (ephemeral, not persisted).
2. `setCropMode(layoutId)` saves `layout.cropX/Y/W/H` into `prevCommittedCrop` BEFORE `handleCropEnd` can overwrite them.
3. `commitCrop` uses `prevCommittedCrop.cropW/H` (not `layout.cropW/H`) for scale detection and `prevCommittedCrop.cropX/Y` for origin reconstruction.
4. `resetCrop` uses `prevCommittedCrop.cropW/H/X/Y` for the same reason.
5. All three exit paths (`commitCrop`, `resetCrop`, `setCropMode(null)`) clear `prevCommittedCrop: null`.

### Files Changed (Session 2)

- `src/renderer/features/canvas/store/useLayoutStore.ts` — `prevCommittedCrop` added to interface + initial state; `setCropMode`, `commitCrop`, `resetCrop` updated.

### Code State After Session 2

```
useLayoutStore.ts: prevCommittedCrop saved at setCropMode, used in commitCrop + resetCrop
Diagnostic logs: still present (not yet removed — verifying fix first)
```

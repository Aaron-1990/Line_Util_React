# Crop Image Offset Bug — Consulting Report

**Date:** 2026-03-09
**Status:** Unresolved after multiple fix attempts
**Feature:** Phase 8.5c — Non-destructive PowerPoint-style image crop
**App:** Line Optimizer (Electron + React + ReactFlow + Zustand)

---

## 1. Project Context & Tech Stack

Line Optimizer is an Electron desktop app for manufacturing line capacity analysis. The canvas is built with **ReactFlow** — a library that renders interactive node graphs. Layout images are background images (floor plans, factory layouts) imported as PNG/JPG/SVG.

| Layer            | Technology              |
| ---------------- | ----------------------- |
| Desktop shell    | Electron 28             |
| Frontend         | React 18 + TypeScript   |
| Canvas           | ReactFlow 11            |
| State management | Zustand                 |
| Build            | Vite                    |
| Database         | SQLite (better-sqlite3) |

---

## 2. Feature Goal

Implement a **non-destructive PowerPoint-style crop** for layout images on the ReactFlow canvas:

1. User right-clicks a layout image → clicks "Crop Image"
2. The node enters **crop mode**: full image is shown, an 8-handle overlay lets the user draw a crop rectangle
3. User adjusts the 8 handles to select the region they want to keep
4. User clicks **"Done Cropping"** (button in the properties panel)
5. **Expected result:**
   - The node border **shrinks** to exactly the crop region's dimensions
   - The node **repositions** on the canvas so its top-left aligns with where the crop rectangle's top-left was
   - The image inside the border shows **only the cropped portion** — no offset, no extra pixels
6. The crop is **non-destructive**: the original image data is untouched; crop values are stored as metadata

The implementation must handle:

- First crop (node at original imported size)
- Re-crop (node already shrunken from a previous Done)
- Reset Crop (restore node to full original size)
- Sequential handle drags within a single crop session

---

## 3. Architecture: Components & Responsibilities

```
LayoutPropertiesPanel.tsx    ProductionCanvas.tsx
      │ "Done" button               │ layoutNodes useMemo
      │ commitCrop(id)              │ onNodesChange handler
      │                             │
      ▼                             ▼
useLayoutStore.ts ◄──────────────────────────────────────────
  - layouts[]            (persisted state: position, size, crop)
  - cropModeLayoutId     (ephemeral: which node is in crop mode)
  - prevCommittedCrop    (ephemeral: snapshot of crop at mode entry)
  - pendingCrop          (ephemeral: live drag state)
  │
  │  setCropMode(id | null)
  │  commitCrop(id)
  │  resetCrop(id)
  │  updateLayout(id, input)
  │
  ▼
LayoutImageNode.tsx (ReactFlow node component)
  - renderImage()        → CSS transform to display crop
  - computeCropParams()  → coordinate system for CropOverlay
  - handleCropEnd()      → persists crop on mouseup
  - handleExitCrop()     → calls commitCrop() on Done
  │
  └── CropOverlay.tsx
        - 8 drag handles drawn over the image
        - Converts mouse screen pixels → image pixel crop rect
        - Reports via onCropChange (live) and onCropEnd (mouseup)

containBounds.ts
  - computeContainBounds(contentW, contentH, containerW, containerH)
  - CSS object-fit:contain math: returns {x, y, width, height}
    where the content would be placed inside the container
```

---

## 4. Data Model

```typescript
// Persisted in SQLite (project_layouts table)
interface LayoutImage {
  id: string;
  xPosition: number;     // canvas position (flow coords)
  yPosition: number;
  width: number;         // current node width (shrinks after crop)
  height: number;        // current node height
  originalWidth: number; // immutable: natural image width (px)
  originalHeight: number;// immutable: natural image height (px)
  cropX: number | null;  // image-pixel crop rect (null = no crop)
  cropY: number | null;
  cropW: number | null;
  cropH: number | null;
  imageData: string;     // base64 or SVG string
  rotation: number;      // degrees
  opacity: number;
  locked: boolean;
  visible: boolean;
  aspectRatioLocked: boolean;
}

// Ephemeral store state (not persisted)
prevCommittedCrop: { cropX, cropY, cropW, cropH } | null  // snapshot at setCropMode entry
pendingCrop: { layoutId, crop: CropRect } | null           // live drag, not yet mouseup
```

ReactFlow node for a layout image:

```typescript
{
  id: layout.id,
  type: 'layoutImage',
  position: { x: layout.xPosition, y: layout.yPosition },
  data: { layoutId: layout.id },  // reference only — SSoT pattern
  width: layout.width,
  height: layout.height,
}
```

---

## 5. The Core Math (Coordinate Spaces)

There are **three coordinate spaces** involved:

| Space               | Unit | Description                                                              |
| ------------------- | ---- | ------------------------------------------------------------------------ |
| **Image pixels**    | px   | Original image natural dimensions (e.g., 1920×872). CropRect lives here. |
| **Node/CSS pixels** | px   | Node's visual size (e.g., 800×363). Also ReactFlow flow coords.          |
| **Screen pixels**   | px   | Physical screen. Mouse events are in this space.                         |

**ReactFlow zoom** transforms between flow coords and screen pixels:
`screen_px = flow_px * zoom`

The image is rendered inside the node using **CSS object-fit:contain** semantics via `computeContainBounds`:

```typescript
// containBounds.ts
function computeContainBounds(contentW, contentH, containerW, containerH) {
  const contentAspect = contentW / contentH;
  const containerAspect = containerW / containerH;
  if (contentAspect > containerAspect) {
    // Fit by width: letterbox top/bottom
    const renderW = containerW;
    const renderH = containerW / contentAspect;
    return { x: 0, y: (containerH - renderH) / 2, width: renderW, height: renderH };
  } else {
    // Fit by height: letterbox left/right
    const renderH = containerH;
    const renderW = containerH * contentAspect;
    return { x: (containerW - renderW) / 2, y: 0, width: renderW, height: renderH };
  }
}
```

**Scale** (CSS px per image px): `scale = containBounds.width / originalImageWidth`

---

## 6. How Each Component Uses the Math

### 6a. `renderImage()` in `LayoutImageNode.tsx`

During normal rendering (crop applied, not in crop mode):

```typescript
const renderImage = () => {
  const crop = renderCrop ?? { cropX: 0, cropY: 0, cropW: originalWidth, cropH: originalHeight };

  // Fit the CROP REGION (not the full image) into the node container
  const cropBounds = computeContainBounds(crop.cropW, crop.cropH, layout.width, layout.height);
  const scale = cropBounds.width / crop.cropW;

  // Full image size at this scale
  const imgW = layout.originalWidth * scale;
  const imgH = layout.originalHeight * scale;

  // Translate so the crop region's top-left aligns with cropBounds.x/y
  const translateX = cropBounds.x - crop.cropX * scale;
  const translateY = cropBounds.y - crop.cropY * scale;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <img style={{ width: imgW, height: imgH, transform: `translate(${translateX}px, ${translateY}px)` }} />
    </div>
  );
};
```

**Key insight:** `renderImage` fits the CROP REGION (not the full image) to the node. After `commitCrop` correctly sets `layout.width = cropW * scale` and `layout.height = cropH * scale`, the crop region fills the node exactly (no letterbox), and the image origin is positioned so the correct pixels are visible.

### 6b. `computeCropParams()` in `LayoutImageNode.tsx`

Provides the coordinate system to `CropOverlay`:

```typescript
const computeCropParams = () => {
  const bounds = computeContainBounds(
    layout.originalWidth,
    layout.originalHeight, // ALWAYS original dims
    layout.width,
    layout.height // current node size
  );
  return {
    activeArea: bounds, // where image renders in node CSS space
    imageRange: { x: 0, y: 0, width: layout.originalWidth, height: layout.originalHeight },
  };
};
```

**IMPORTANT:** `activeArea` is the bounding rect (in node CSS pixels) where the full original image is rendered. `CropOverlay` uses this to map between image pixels and CSS pixels.

### 6c. `CropOverlay.tsx` coordinate conversion

```typescript
const scaleX = activeArea.width / imageRange.width; // CSS px per image px (horizontal)
const scaleY = activeArea.height / imageRange.height; // CSS px per image px (vertical)

// Mouse delta (screen px) → image pixel delta
const dxImg = dxScreen / (scaleX * zoom);
const dyImg = dyScreen / (scaleY * zoom);

// Image pixels → CSS display position for handle rendering
const toDisplayX = imgPx => activeArea.x + (imgPx - imageRange.x) * scaleX;
const toDisplayY = imgPx => activeArea.y + (imgPx - imageRange.y) * scaleY;
```

### 6d. `commitCrop()` in `useLayoutStore.ts`

Called when user clicks "Done Cropping". Resizes the node to fit the committed crop:

```typescript
commitCrop: (id: string) => {
  const layout = get().layouts.find(l => l.id === id);
  // Get crop values (pendingCrop has priority over store)
  const cropX = pendingForThis?.cropX ?? layout.cropX;
  const cropY = ...; const cropW = ...; const cropH = ...;

  // Determine scale and image canvas origin
  const prevCommittedCrop = get().prevCommittedCrop;  // snapshotted at setCropMode entry
  const prevCropW = prevCommittedCrop?.cropW ?? null;
  const prevCropH = prevCommittedCrop?.cropH ?? null;

  if (prevCropW !== null && prevCropH !== null) {
    // RE-CROP PATH: node was already cropped. Reconstruct scale from prev committed crop.
    const scaleFromW = layout.width / prevCropW;
    const aspectMatch = Math.abs(scaleFromW - layout.height / prevCropH) / scaleFromW < 0.01;
    if (aspectMatch) {
      scale = scaleFromW;
      originX = layout.xPosition - prevCommittedCrop.cropX * scale;
      originY = layout.yPosition - prevCommittedCrop.cropY * scale;
    }
  } else {
    // FIRST-CROP PATH: node at original dimensions.
    const fullBounds = computeContainBounds(originalW, originalH, layout.width, layout.height);
    scale = fullBounds.width / originalW;
    originX = layout.xPosition + fullBounds.x;
    originY = layout.yPosition + fullBounds.y;
  }

  const newWidth = cropW * scale;
  const newHeight = cropH * scale;
  const newX = originX + cropX * scale;
  const newY = originY + cropY * scale;

  // Atomic state update (one Zustand set() call for both layout and mode)
  set(state => ({
    layouts: state.layouts.map(l => l.id === id
      ? { ...l, width: newWidth, height: newHeight, xPosition: newX, yPosition: newY, cropX, cropY, cropW, cropH }
      : l
    ),
    cropModeLayoutId: null,
    pendingCrop: null,
    prevCommittedCrop: null,
  }));
};
```

---

## 7. Fix History

### v1 — Phase 8.5c original

- `commitCrop` exited crop mode but did NOT resize the node.
- **Result:** Border stayed at original size. Image appeared offset because the node was too large.

### v2 — Heuristic resize

- `commitCrop` added node resize using a heuristic to detect "already resized" state:
  - Compare `nodeW / cropW` vs `nodeH / cropH`; if equal AND `cropW < originalW`, assume re-crop.
- **Root cause of failure:** False positive when crop AR ≈ original image AR (common for proportional crops). Heuristic triggered on first-time crops, computing wrong canonical dimensions. Node stayed at original size, offset persisted.

### v3 — Remove heuristic, always use `layout.width/height` as canonical

- `commitCrop` always calls `computeContainBounds(originalW, originalH, layout.width, layout.height)` to get the image's position within the current node.
- **Result:** Border shrinks correctly. Image offset **persists** visually, though math traces as correct for simple cases.

### Session 1 (2026-03-08) — Atomic state + `onNodesChange` guard

**Root cause found:** Two separate flaws:

**Flaw 1:** `commitCrop` made TWO Zustand `set()` calls — `updateLayout()` then `set({cropModeLayoutId: null})`. This created an intermediate render where `cropModeLayoutId` was still set (crop mode) but `layout.width/height` had already updated to new (smaller) dimensions. `computeCropParams` would compute `activeArea` using the wrong node size during that render.

**Flaw 2:** `onNodesChange` in `ProductionCanvas.tsx` unconditionally wrote ALL position changes from ReactFlow back to the store — including echo events from the controlled `nodes` prop.

**Fixes applied:**

1. **Atomic `commitCrop`** — single `set()` updates `layouts` AND `cropModeLayoutId: null` simultaneously
2. **Atomic `resetCrop`** — same pattern
3. **`onNodesChange` SSoT guard** — only processes `change.dragging === true/false`; ignores `undefined` (programmatic echo). Added `draggingLayoutIds` ref to distinguish user drags from spurious `dragging===false` echoes.

**Result:** Bug persisted.

### Session 2 (2026-03-08) — `prevCommittedCrop` snapshot

**Root cause found:** In the re-crop path, `commitCrop` used `layout.cropW/H` to detect if a previous crop existed. But `handleCropEnd` runs on every mouseup DURING the same crop session, overwriting `layout.cropX/Y/W/H` with the NEW (in-progress) crop values. So `layout.cropW/H` at the time of `commitCrop` held the NEW crop, not the PREVIOUSLY COMMITTED one. The scale detection ran against the wrong crop, computing a wrong scale factor.

**Fix applied:** Added `prevCommittedCrop` field to the store:

- `setCropMode(layoutId)` snapshots `layout.cropX/Y/W/H` BEFORE `handleCropEnd` can overwrite them
- `commitCrop` and `resetCrop` use `prevCommittedCrop` (not `layout.cropW/H`) for the re-crop detection and scale reconstruction

**Result:** Mathematically the logs look correct, but **visual offset persists on first crop**.

---

## 8. Diagnostic Evidence — Current State

### Test performed: First crop on a freshly imported image

**Image:** 1920×872 px
**Node before crop:** 800×363 (imported default size)
**Crop drawn by user:** `(cropX=464.8, cropY=75.0, cropW=740.4, cropH=752.0)` in image pixels

### commitCrop log output:

```
[commitCrop] {
  crop: { x: 464.8, y: 75.0, w: 740.4, h: 752.0 },
  cropSource: 'store',
  scaleSource: 'first-crop',
  scale: 0.41628440366972475,
  after: { w: 308.21, h: 313.06, x: -655.57, y: 137.53 }
}
```

### Math verification of commitCrop output:

```
computeContainBounds(1920, 872, 800, 363):
  contentAR = 2.2018, containerAR = 2.2038
  → fit by height
  scale = 363/872 = 0.41628
  fullBounds = { x: 0.37, y: 0, w: 799.26, h: 363 }

originX = nodeX + 0.37
originY = nodeY + 0

newWidth  = 740.4  * 0.41628 = 308.21  ✓
newHeight = 752.0  * 0.41628 = 313.06  ✓
newX      = nodeX + 0.37 + 464.8 * 0.41628 = nodeX + 193.93  ✓
newY      = nodeY + 0    + 75.0  * 0.41628 = nodeY + 31.22   ✓
```

### ReactFlow node position verification:

```
[layoutNodes] pos: {x: -655.57, y: 137.53}, size: {w: 308.21, h: 313.06}, cropMode: false

[post-crop-verify] posMatch: true | sizeMatch: true
  store x: -655.57 y: 137.53 w: 308.21 h: 313.06
  rf    x: -655.57 y: 137.53 w: 308.21 h: 313.06
```

ReactFlow internal state matches the store. The node is positioned correctly.

### renderImage log after commitCrop:

```
[renderImage] isCropMode: false
  renderCrop: (464.8, 75.0, 740.4, 752.0)
  node: 308.2 × 313.1
  tx: -193.51, ty: -31.21
  scale: 0.41628
```

### Math verification of renderImage output:

```
computeContainBounds(740.4, 752.0, 308.21, 313.06):
  contentAR = 0.98457, containerAR = 0.98451
  → both nearly equal → cropBounds ≈ { x: 0, y: 0, w: 308.21, h: 313.06 }

scale = 308.21 / 740.4 = 0.41625 (≈ 0.41628 — same as commitCrop scale)

imgW = 1920 * 0.41628 = 799.26
imgH = 872  * 0.41628 = 363.0

tx = 0 - 464.8 * 0.41628 = -193.51  ✓ (expected: -193.56, diff < 0.1px)
ty = 0 - 75.0  * 0.41628 = -31.22   ✓ (log shows -31.21, diff < 0.01px)

At container (0,0): shows image pixel (193.51/0.41628, 31.21/0.41628) = (464.8, 74.97) ≈ cropX,cropY ✓
At container (308.2, 313.1): shows image pixel (1205.2, 827.0) ≈ cropX+cropW, cropY+cropH ✓
```

### Summary of diagnostic evidence:

- All numbers in the store are correct
- ReactFlow node position and size match the store (sub-0.5px accuracy)
- CSS `tx/ty` values position the image at the correct image-pixel region
- The math closes: image pixel at (0,0) of the container = (cropX, cropY) ✓
- **Yet the user sees a visual offset.**

---

## 9. What We Cannot Explain

**The logs show the implementation is mathematically correct for the first crop. The node is at the right canvas position. The image translation values correctly place the crop region at the top-left of the container. But visually the image appears offset.**

### Hypotheses we have NOT been able to confirm or rule out:

**Hypothesis A: CropOverlay handle positions are misaligned during crop mode**
The handles shown during crop mode might be drawing at CSS positions that don't match where the rendered image pixels actually are. After Done, the image renders correctly (by the math), but the user expected the result to match where the handles appeared — and there could be a discrepancy.

Possible cause: `computeCropParams` gives `activeArea` from `computeContainBounds(originalW, originalH, nodeW, nodeH)`. This is `{x: 0.37, y: 0, w: 799.26, h: 363}` for an 800×363 node with a 1920×872 image. The image renders with `tx: 0.37, ty: 0` in crop mode (full image, no crop). So the handles' top-left is at CSS `activeArea.x + cropX * scaleX = 0.37 + 464.8 * 0.41628 = 193.93`. After Done, the node top-left is at canvas `nodeX + 193.93`. These align. But there might be a sub-pixel or zoom-dependent rendering artifact making them look off.

**Hypothesis B: Zoom-dependent precision error**
The `renderImage` scale (`cropBounds.width / cropW`) is approximately equal to, but not exactly the same as, the `commitCrop` scale (`fullBounds.width / originalW`) due to floating-point arithmetic. This could cause a sub-pixel offset that grows with the zoom level. At zoom > 1, a 0.1px offset in flow coordinates becomes 0.2–0.5px on screen.

**Hypothesis C: The `overflow: hidden` + `transform` interaction**
The image uses `position: absolute; left: 0; top: 0; transform: translate(tx, ty)`. The parent has `overflow: hidden`. There's a known Chromium behavior where `overflow: hidden` with CSS transforms can have sub-pixel rendering artifacts. The actual clipping boundary might be off by 1px, revealing adjacent pixels from outside the crop region.

**Hypothesis D: The outer wrapper size vs. ReactFlow node size mismatch**
`LayoutImageNode` renders an outer div with `width: layout.width, height: layout.height`. The ReactFlow node wrapper also has `width: l.width, height: l.height` (from `layoutNodes` useMemo). These should match, but if there's any timing issue where ReactFlow's CSS doesn't update synchronously with the Zustand state change, there could be a transient misalignment that the user perceives as an offset.

**Hypothesis E: The image appears correct but the crop handles were at wrong positions**
Maybe the first crop works correctly, but the user's mental reference is wrong — they expected the handles to be at specific positions and the result doesn't match their expectation. The handles' visual positions in the 800×363 node are at `(193.93, 31.22)` to `(502.08, 344.29)` in node CSS pixels. After Done, the node moves to the position of the top-left handle. The content inside should match. But if the dark mask overlay (the semi-transparent regions outside the crop handles) obscures part of the image, the user might perceive the "visible through the window" region as not matching post-Done.

---

## 10. Current Code State

### Key files and their state:

| File                   | Lines   | State                                                                                                |
| ---------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `useLayoutStore.ts`    | 266–389 | `commitCrop` with `prevCommittedCrop` + atomic `set()`. Diagnostic `console.log` still present.      |
| `LayoutImageNode.tsx`  | 213–246 | `renderImage` with diagnostic `console.log`. Post-crop-verify `useEffect` present.                   |
| `ProductionCanvas.tsx` | 139–182 | `layoutNodes` useMemo with diagnostic `console.log`. `onNodesChange` with `draggingLayoutIds` guard. |
| `CropOverlay.tsx`      | 1–324   | Unchanged from original.                                                                             |
| `containBounds.ts`     | 1–23    | Shared utility, unchanged.                                                                           |

### Diagnostic logs in code (to be removed once bug is fixed):

- `[commitCrop:entry]` — fires at start of commitCrop
- `[commitCrop]` — fires with scale, before/after values
- `[renderImage]` — fires on every render with tx, ty, scale
- `[layoutNodes]` — fires when layoutNodes useMemo recomputes (only when node has crop)
- `[post-crop-verify]` — fires in rAF after crop exit, checks RF node vs. store

---

## 11. Key Invariants the Solution Must Maintain

1. **SSoT:** All layout data (position, size, crop) lives in `useLayoutStore.layouts[]`. ReactFlow nodes carry only `{ layoutId }` in their `data` prop.

2. **Hook Chain:** All hooks in `LayoutImageNode` and `LayoutPropertiesPanel` must come before any `if (!layout) return null` early return. TypeScript does NOT detect violations — they crash at runtime.

3. **Atomic operations:** Any store method representing ONE user action must use exactly ONE `set()` call. Two `set()` calls for one action create an intermediate render with mismatched state.

4. **`onNodesChange` guard:** Only process `change.dragging === true` (drag tick) or `false` (drag end). Skip `change.dragging === undefined` (programmatic echo from controlled `nodes` prop). Without this guard, ReactFlow echoes back its own position updates, overwriting the store with stale values.

5. **`deleteKeyCode={null}`** on the `<ReactFlow>` instance. Without it, ReactFlow's internal Delete handler fires before the custom one, emptying its selection, making the custom handler a no-op.

6. **Rotation via inner wrapper CSS only.** `rotate()` must be applied to the inner content div, NOT the ReactFlow node wrapper, so NodeResizer handles stay axis-aligned.

---

## 12. Questions for Other AI Systems

Given the diagnostic evidence in Section 8 shows the math is correct but the visual result appears wrong:

1. **Is there a fundamental flaw in the approach of resizing/repositioning the node on Done?** An alternative would be: keep the node at its original position and size, but use CSS `clip-path: inset()` or `clip-path: polygon()` to clip only the visible region, and use `translate()` to show the correct image content. This avoids needing to change `xPosition/yPosition` entirely.

2. **Can `computeContainBounds(cropW, cropH, newNodeW, newNodeH)` in `renderImage` produce non-zero `x/y` when `newNodeW = cropW * scale` and `newNodeH = cropH * scale`?** In exact math, no. But in IEEE 754 floating point, can the rounding cause the function to enter the wrong branch, producing a nonzero letterbox offset that causes visible misalignment?

3. **Is there a better coordinate model?** Instead of storing the image position indirectly (via `xPosition/yPosition` of the node + `tx/ty` computed from crop), should we store the image's absolute canvas origin (`imageOriginX/Y`) and reconstruct node position as `imageOriginX + cropX * scale`? This would make the relationship explicit and eliminate the need to "reconstruct" the origin in re-crop.

4. **For the re-crop scenario:** `computeCropParams` in `LayoutImageNode` always calls `computeContainBounds(originalW, originalH, nodeW, nodeH)`. After the first Done, `nodeW = 308, nodeH = 313`. The function returns `activeArea` assuming the full 1920×872 image fits into 308×313 (which gives `y = 86.5` letterbox — completely wrong). The image actually shows only the crop region at the original scale. How should `computeCropParams` compute `activeArea` for re-crop? It needs to account for the fact that the node shows a subsection of the image, not the full image.

---

## 13. Proposed Alternative Architecture (Not Yet Implemented)

Instead of the current "resize and reposition node on Done" model, consider a **"permanent image origin" model**:

### Persistent fields:

```typescript
interface LayoutImage {
  // Node anchor (top-left of the ORIGINAL uncropped image in canvas space)
  imageOriginX: number;
  imageOriginY: number;
  // Current display zoom level (CSS px per image px)
  imageScale: number;
  // Non-destructive crop in image pixels (null = no crop)
  cropX: number | null;
  cropY: number | null;
  cropW: number | null;
  cropH: number | null;
  // Derived (computed from above, stored for ReactFlow)
  xPosition: number; // = imageOriginX + (cropX ?? 0) * imageScale
  yPosition: number; // = imageOriginY + (cropY ?? 0) * imageScale
  width: number; // = (cropW ?? originalWidth) * imageScale
  height: number; // = (cropH ?? originalHeight) * imageScale
}
```

### Benefits:

- `imageOriginX/Y` and `imageScale` are stable across crops — no reconstruction needed
- `commitCrop` only updates `cropX/Y/W/H`; node position/size are derived values
- Re-crop is trivial: `imageOriginX/Y` and `imageScale` never change
- `computeCropParams` for CropOverlay uses `imageOriginX/Y` and `imageScale` directly — no `computeContainBounds` needed

### Drawbacks:

- Requires a new migration for `imageOriginX/Y/Scale` columns in SQLite
- Legacy imported layouts need migration (compute from existing `xPosition/width/originalWidth`)
- Node resize by the user (drag resize handles) must update `imageScale` instead of `width/height`

---

## 14. File Locations

```
src/renderer/features/canvas/
├── store/
│   └── useLayoutStore.ts           ← commitCrop, resetCrop, setCropMode
├── utils/
│   └── containBounds.ts            ← computeContainBounds
├── components/
│   ├── nodes/
│   │   ├── LayoutImageNode.tsx     ← renderImage, computeCropParams
│   │   └── CropOverlay.tsx         ← 8-handle drag UI
│   └── panels/
│       └── LayoutPropertiesPanel.tsx ← "Done Cropping" / "Reset Crop" buttons
└── ProductionCanvas.tsx            ← layoutNodes useMemo, onNodesChange

src/shared/types/
└── layout.ts                       ← LayoutImage, UpdateLayoutInput interfaces

src/main/database/repositories/
└── SQLiteLayoutRepository.ts       ← DB CRUD

docs/fixes/
├── crop-image-offset-after-done.md ← detailed fix history (4 sessions)
└── crop-offset-consulting-report.md ← this file
```

---

_Generated: 2026-03-09 | Author: Claude Code (Sonnet 4.6)_
_Status: Pending external review and reimplementation guidance_

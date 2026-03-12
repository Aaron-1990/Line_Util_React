# Crop Image: Rendering Bug Fix + Architecture Migration

## Metadata
- Designed: 2026-03-09
- Designer: Aaron Zapata
- Project: Line Optimizer
- Framework: Hibrido v2.0
- Domain: Manufacturing / Canvas UI
- Agents: frontend-developer (primary), code-reviewer (validation)

## Context

Line Optimizer implements a non-destructive PowerPoint-style image crop for layout images on a ReactFlow canvas. After 5 fix iterations across 4 sessions, the math in `commitCrop` is verified correct by logs, but the visual result still shows an offset after clicking "Done Cropping."

This spec has TWO phases executed in sequence:
1. **PHASE 1:** Diagnose and fix the rendering bug (the visual offset)
2. **PHASE 2:** Migrate to "permanent image origin" architecture to prevent future re-crop bugs

**DO NOT start Phase 2 until Phase 1 is verified working.**

---

## Reference Files

```
src/renderer/features/canvas/
  store/useLayoutStore.ts              -- commitCrop, resetCrop, setCropMode
  utils/containBounds.ts               -- computeContainBounds
  components/nodes/LayoutImageNode.tsx  -- renderImage, computeCropParams
  components/nodes/CropOverlay.tsx      -- 8-handle drag UI
  components/panels/LayoutPropertiesPanel.tsx -- Done/Reset buttons
  ProductionCanvas.tsx                 -- layoutNodes useMemo, onNodesChange

src/shared/types/layout.ts            -- LayoutImage interface
src/main/database/repositories/SQLiteLayoutRepository.ts -- DB CRUD
```

---

# PHASE 1: RENDERING BUG DIAGNOSIS AND FIX

## Problem Statement

First crop on a freshly imported image (no prior crop, no re-crop complexity):
- Image: 1920x872 px, Node: 800x363
- User draws crop: (cropX=464.8, cropY=75.0, cropW=740.4, cropH=752.0)
- commitCrop computes: newW=308.21, newH=313.06, newX=-655.57, newY=137.53
- renderImage computes: tx=-193.51, ty=-31.21, scale=0.41628
- **Math verifies correct in all logs.** ReactFlow node position matches store.
- **Visual result: image appears offset.**

Since the math is correct but the visual is wrong, the bug is in the CSS rendering pipeline, not in the calculation logic.

## BLOQUE 0: Diagnostic Investigation

**Objective:** Identify the EXACT cause of visual offset before writing any fix code.

### Investigation 1: ReactFlow node wrapper vs inner div size mismatch

**Why:** LayoutImageNode renders an outer div with explicit `width: layout.width, height: layout.height`. ReactFlow ALSO applies width/height to its own wrapper div around the custom node. If these differ by even 1px, the overflow:hidden clips at the wrong boundary.

**Action:**
```typescript
// In LayoutImageNode.tsx, TEMPORARILY add after the component mounts post-crop:
useEffect(() => {
  if (layout && !isCropMode && layout.cropX !== null) {
    const nodeEl = document.querySelector(`[data-id="${layout.id}"]`);
    if (nodeEl) {
      const rfWrapper = nodeEl as HTMLElement;
      const innerDiv = rfWrapper.querySelector('[data-crop-container]') as HTMLElement;
      if (innerDiv) {
        const rfRect = rfWrapper.getBoundingClientRect();
        const innerRect = innerDiv.getBoundingClientRect();
        console.log('[SIZE-DIAG]', {
          rfWrapper: { w: rfRect.width, h: rfRect.height },
          innerDiv: { w: innerRect.width, h: innerRect.height },
          delta: {
            w: Math.abs(rfRect.width - innerRect.width),
            h: Math.abs(rfRect.height - innerRect.height)
          },
          rfWrapperStyle: {
            width: rfWrapper.style.width,
            height: rfWrapper.style.height,
            transform: rfWrapper.style.transform
          }
        });
      }
    }
  }
}, [layout?.width, layout?.height, layout?.cropX, isCropMode]);
```

Mark the crop container div with `data-crop-container` attribute for this diagnostic.

**What to look for:**
- `delta.w > 0.5` or `delta.h > 0.5` means ReactFlow wrapper and inner div disagree on size
- Check if rfWrapper has padding, border, or box-sizing differences
- Check if rfWrapper.style.transform includes unexpected translation

### Investigation 2: CSS transform rendering verification

**Why:** The img element uses `transform: translate(tx, ty)` with `position: absolute`. The parent has `overflow: hidden`. Chromium can have sub-pixel rendering artifacts with this combination.

**Action:**
```typescript
// In LayoutImageNode.tsx renderImage(), TEMPORARILY add:
useEffect(() => {
  if (layout && !isCropMode && layout.cropX !== null) {
    const nodeEl = document.querySelector(`[data-id="${layout.id}"]`);
    if (nodeEl) {
      const imgEl = nodeEl.querySelector('img') as HTMLElement;
      const container = imgEl?.parentElement as HTMLElement;
      if (imgEl && container) {
        const imgRect = imgEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        // Where the image top-left ACTUALLY renders relative to container
        const actualOffset = {
          x: imgRect.left - containerRect.left,
          y: imgRect.top - containerRect.top
        };
        console.log('[RENDER-DIAG]', {
          expectedTx: /* tx value from renderImage */,
          expectedTy: /* ty value from renderImage */,
          actualOffset,
          imgSize: { w: imgRect.width, h: imgRect.height },
          containerSize: { w: containerRect.width, h: containerRect.height },
          zoom: /* get from ReactFlow viewport */
        });
      }
    }
  }
}, [layout?.width, layout?.height, layout?.cropX, isCropMode]);
```

**What to look for:**
- `actualOffset.x !== expectedTx` (accounting for zoom) means the browser is NOT placing the image where the CSS says
- Any significant deviation (> 1px at zoom=1) points to a CSS stacking/positioning issue
- If offsets scale with zoom, it is a precision issue in the coordinate chain

### Investigation 3: Check if LayoutImageNode inner div uses width/height from layout OR from 100%

**Why:** If the inner div uses `width: '100%', height: '100%'` it inherits from the ReactFlow wrapper. If it uses explicit `layout.width, layout.height`, it reads from Zustand. These should be identical, but timing matters.

**Action:** Read `LayoutImageNode.tsx` and document:
1. What CSS does the outermost div of the component use for width/height?
2. What CSS does the overflow:hidden container use for width/height?
3. Is there any intermediate div between the ReactFlow wrapper and the overflow container?
4. Does the component read `layout.width/height` for display, or does it rely on the parent dimensions?

### Investigation 4: Verify no double-transform from ReactFlow

**Why:** ReactFlow nodes are positioned via CSS `transform: translate(x, y)` on the node wrapper. If your inner div ALSO applies a position-related transform, they compound.

**Action:** In DevTools (or via diagnostic code), inspect the full CSS transform chain from the ReactFlow viewport down to the img element:
```
.react-flow__viewport  -> transform: translate(panX, panY) scale(zoom)
  .react-flow__node    -> transform: translate(nodeX, nodeY)
    [your outer div]   -> transform? position?
      [overflow div]   -> position?
        img            -> transform: translate(tx, ty)
```

Log each level's computed transform. There should be exactly:
- 1 transform on viewport (pan + zoom)
- 1 transform on node wrapper (node position)
- 1 transform on img (crop offset)
- NO other transforms or position:absolute/relative offsets in between

### Decision Point

After running all 4 investigations, the results will point to one of these root causes:

| Finding | Root Cause | Fix Path |
|---------|-----------|----------|
| rfWrapper size != innerDiv size | ReactFlow wrapper disagrees with Zustand | Fix: use `width: '100%'` in component, let RF wrapper be SSoT for display size |
| actualOffset != expectedTx/Ty | CSS positioning bug (extra div, extra transform) | Fix: flatten DOM, remove intermediate wrappers |
| Extra transform in chain | Double-positioning | Fix: remove the redundant transform |
| Everything matches but visual is still off | Sub-pixel rendering / GPU compositing | Fix: use `will-change: transform` on img, or switch to `clip-path: inset()` approach |

## BLOQUE 1: Apply Fix Based on Diagnosis

**This bloque depends entirely on what BLOQUE 0 reveals.** Do NOT guess. Implement only the fix that matches the diagnosed root cause.

### If root cause is wrapper size mismatch:

Refactor LayoutImageNode to use `width: '100%', height: '100%'` for its container div instead of reading `layout.width/height`. The ReactFlow node wrapper already has the correct size from `layoutNodes` useMemo. The inner div should inherit, not duplicate.

### If root cause is extra transform/positioning:

Flatten the DOM so there are exactly 3 transform levels (viewport -> node -> img). Remove any intermediate div that has `position: relative/absolute` or its own `transform`.

### If root cause is sub-pixel rendering:

Option A: Add `will-change: transform` to the img element.
Option B: Round tx/ty to whole pixels: `Math.round(tx)`, `Math.round(ty)`.
Option C: Replace `transform: translate()` with `clip-path: inset()`:
```css
/* Instead of positioning the full image and clipping with overflow:hidden */
img {
  width: originalWidth * scale;
  height: originalHeight * scale;
  clip-path: inset(
    cropY * scale          /* top */
    (originalWidth - cropX - cropW) * scale   /* right */
    (originalHeight - cropY - cropH) * scale  /* bottom */
    cropX * scale          /* left */
  );
}
```

### CHECKPOINT:
```bash
npm run type-check
# Manual test: import an image, crop it, click Done
# Verify: node border shrinks to crop region, image content matches what was inside the crop handles
# Test at zoom=1, zoom=0.5, zoom=2
```

### Success Criteria:
- [ ] First crop: no visual offset at any zoom level
- [ ] Image content inside node matches exactly what was inside crop handles
- [ ] Node position on canvas: top-left aligns with where crop handle top-left was
- [ ] No console errors

---

## BLOQUE 2: Verify Re-crop and Reset Still Work

After Phase 1 fix is applied, verify:

1. **Re-crop:** Enter crop mode on an already-cropped image, adjust handles, click Done. The node should resize to the new crop region.
2. **Reset Crop:** Click "Reset Crop" on a cropped image. Node should return to original dimensions and position.
3. **Sequential crops:** Crop -> Done -> Crop again -> Done. Each time the result should be correct.

### CHECKPOINT:
```bash
npm run type-check
# Manual test sequence:
# 1. Import image -> Crop -> Done -> Verify (no offset)
# 2. Re-crop same image -> Done -> Verify (no offset)
# 3. Reset Crop -> Verify (back to original)
# 4. Crop again -> Done -> Verify (no offset)
```

If re-crop fails but first crop works, proceed to Phase 2 (the architecture migration will fix re-crop structurally).

---

# PHASE 2: ARCHITECTURE MIGRATION TO PERMANENT IMAGE ORIGIN

**Prerequisites:** Phase 1 MUST be complete. First crop MUST work visually.

## Problem Statement (Architecture)

The current model stores `xPosition/yPosition/width/height` as primary fields and RECONSTRUCTS `imageScale` and `imageOrigin` during re-crop by reverse-engineering these values. This is fragile because:
- Floating-point accumulation across crop cycles
- Any external modification to position/size (user resize, snap-to-grid) breaks the reconstruction
- `computeCropParams` in re-crop mode computes `activeArea` assuming the full image fits in the node, but post-crop the node only shows the crop region

## BLOQUE 0: Contracts & Architecture

### New interface (layout.ts):

```typescript
interface LayoutImage {
  id: string;

  // === PRIMARY FIELDS (source of truth) ===
  // Image anchor: top-left of the FULL UNCROPPED image in canvas coordinates
  // Set once on import, NEVER changes (unless user drags the node)
  imageOriginX: number;
  imageOriginY: number;

  // Display scale: CSS pixels per image pixel
  // Set once on import based on desired display size, changes only on user resize
  imageScale: number;

  // Non-destructive crop rect in IMAGE PIXEL coordinates
  // null = no crop (show full image)
  cropX: number | null;
  cropY: number | null;
  cropW: number | null;
  cropH: number | null;

  // === DERIVED FIELDS (computed from above, stored for ReactFlow compatibility) ===
  // xPosition = imageOriginX + (cropX ?? 0) * imageScale
  // yPosition = imageOriginY + (cropY ?? 0) * imageScale
  // width     = (cropW ?? originalWidth) * imageScale
  // height    = (cropH ?? originalHeight) * imageScale
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;

  // === IMMUTABLE (set on import, never change) ===
  originalWidth: number;
  originalHeight: number;

  // === OTHER (unchanged) ===
  imageData: string;
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  aspectRatioLocked: boolean;
}
```

### Helper function:

```typescript
// Recomputes derived fields from primary fields. Call after ANY change to origin, scale, or crop.
function deriveBounds(layout: LayoutImage): Pick<LayoutImage, 'xPosition' | 'yPosition' | 'width' | 'height'> {
  const cropX = layout.cropX ?? 0;
  const cropY = layout.cropY ?? 0;
  const cropW = layout.cropW ?? layout.originalWidth;
  const cropH = layout.cropH ?? layout.originalHeight;
  return {
    xPosition: layout.imageOriginX + cropX * layout.imageScale,
    yPosition: layout.imageOriginY + cropY * layout.imageScale,
    width: cropW * layout.imageScale,
    height: cropH * layout.imageScale,
  };
}
```

### Architectural principles:
- **Single derivation direction:** primary -> derived. NEVER reverse.
- **imageOriginX/Y are stable:** only change when user DRAGS the node (not on crop)
- **imageScale is stable:** only changes when user RESIZES the node (not on crop)
- **commitCrop only writes cropX/Y/W/H** then calls deriveBounds for position/size
- **User drag:** updates imageOriginX/Y (reconstructed: `imageOriginX = newNodeX - (cropX ?? 0) * imageScale`)
- **User resize:** updates imageScale (reconstructed: `imageScale = newWidth / (cropW ?? originalWidth)`)

## BLOQUE 1: Database Migration

### SQLite migration:

```sql
ALTER TABLE project_layouts ADD COLUMN image_origin_x REAL;
ALTER TABLE project_layouts ADD COLUMN image_origin_y REAL;
ALTER TABLE project_layouts ADD COLUMN image_scale REAL;
```

### Data migration for existing layouts:

```typescript
// For each existing layout:
function migrateLayout(layout: LegacyLayoutImage): LayoutImage {
  const hasExistingCrop = layout.cropX !== null && layout.cropW !== null;

  let imageScale: number;
  let imageOriginX: number;
  let imageOriginY: number;

  if (hasExistingCrop) {
    // Reconstruct from current state (one-time, accepts floating point state as-is)
    imageScale = layout.width / layout.cropW!;
    imageOriginX = layout.xPosition - layout.cropX! * imageScale;
    imageOriginY = layout.yPosition - layout.cropY! * imageScale;
  } else {
    // No crop: node shows full image with object-fit:contain
    const bounds = computeContainBounds(
      layout.originalWidth, layout.originalHeight,
      layout.width, layout.height
    );
    imageScale = bounds.width / layout.originalWidth;
    // Image origin is at the node position + letterbox offset
    imageOriginX = layout.xPosition + bounds.x;
    imageOriginY = layout.yPosition + bounds.y;
  }

  return {
    ...layout,
    imageOriginX,
    imageOriginY,
    imageScale,
  };
}
```

### CHECKPOINT:
```bash
npm run type-check
# Verify migration runs without errors on a project with:
# - Uncropped layouts
# - Previously cropped layouts
# Verify derived bounds match existing xPosition/yPosition/width/height within 1px
```

## BLOQUE 2: Refactor useLayoutStore.ts

### New commitCrop (replaces existing):

```typescript
commitCrop: (id: string) => {
  const state = get();
  const layout = state.layouts.find(l => l.id === id);
  if (!layout) return;

  const pending = state.pendingCrop;
  const cropX = (pending?.layoutId === id ? pending.crop.x : layout.cropX) ?? 0;
  const cropY = (pending?.layoutId === id ? pending.crop.y : layout.cropY) ?? 0;
  const cropW = (pending?.layoutId === id ? pending.crop.w : layout.cropW) ?? layout.originalWidth;
  const cropH = (pending?.layoutId === id ? pending.crop.h : layout.cropH) ?? layout.originalHeight;

  // imageOriginX, imageOriginY, imageScale are UNCHANGED by crop
  const derived = deriveBounds({
    ...layout,
    cropX, cropY, cropW, cropH,
  });

  set(state => ({
    layouts: state.layouts.map(l => l.id === id
      ? { ...l, cropX, cropY, cropW, cropH, ...derived }
      : l
    ),
    cropModeLayoutId: null,
    pendingCrop: null,
    prevCommittedCrop: null,  // can potentially remove this field entirely
  }));
},
```

Note: `prevCommittedCrop` is no longer needed because we do not reconstruct scale from previous crop. The scale is a primary field.

### New resetCrop:

```typescript
resetCrop: (id: string) => {
  const layout = get().layouts.find(l => l.id === id);
  if (!layout) return;

  const derived = deriveBounds({
    ...layout,
    cropX: null, cropY: null, cropW: null, cropH: null,
  });

  set(state => ({
    layouts: state.layouts.map(l => l.id === id
      ? { ...l, cropX: null, cropY: null, cropW: null, cropH: null, ...derived }
      : l
    ),
    cropModeLayoutId: null,
    pendingCrop: null,
    prevCommittedCrop: null,
  }));
},
```

### Updated onNodesChange handler (user drag):

```typescript
// When user drags a layout node, update imageOriginX/Y
// newNodeX and newNodeY come from ReactFlow drag event
const handleLayoutDrag = (layoutId: string, newNodeX: number, newNodeY: number) => {
  const layout = get().layouts.find(l => l.id === layoutId);
  if (!layout) return;

  const cropX = layout.cropX ?? 0;
  const cropY = layout.cropY ?? 0;

  // Reverse derivation: nodeX = originX + cropX * scale
  // Therefore:           originX = nodeX - cropX * scale
  const imageOriginX = newNodeX - cropX * layout.imageScale;
  const imageOriginY = newNodeY - cropY * layout.imageScale;

  updateLayout(layoutId, {
    xPosition: newNodeX,
    yPosition: newNodeY,
    imageOriginX,
    imageOriginY,
  });
};
```

### Updated resize handler (user resize via NodeResizer):

```typescript
const handleLayoutResize = (layoutId: string, newWidth: number, newHeight: number) => {
  const layout = get().layouts.find(l => l.id === layoutId);
  if (!layout) return;

  const cropW = layout.cropW ?? layout.originalWidth;
  const imageScale = newWidth / cropW;  // new scale from width (aspect locked)

  const derived = deriveBounds({ ...layout, imageScale });

  updateLayout(layoutId, {
    imageScale,
    ...derived,
  });
};
```

### CHECKPOINT:
```bash
npm run type-check
npm run lint
```

## BLOQUE 3: Refactor LayoutImageNode.tsx

### Simplified renderImage:

```typescript
const renderImage = () => {
  const crop = {
    cropX: layout.cropX ?? 0,
    cropY: layout.cropY ?? 0,
    cropW: layout.cropW ?? layout.originalWidth,
    cropH: layout.cropH ?? layout.originalHeight,
  };

  // imageScale is now a stored primary field - no need to compute it
  const scale = layout.imageScale;

  const imgW = layout.originalWidth * scale;
  const imgH = layout.originalHeight * scale;

  // Translate so crop region top-left aligns with container top-left
  const tx = -(crop.cropX * scale);
  const ty = -(crop.cropY * scale);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <img
        src={imgSrc}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: imgW,
          height: imgH,
          transform: `translate(${tx}px, ${ty}px)`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        }}
        draggable={false}
      />
    </div>
  );
};
```

**Key simplification:** No more `computeContainBounds` call in renderImage. The scale is stored. The math is direct: shift the image left/up by `cropX * scale`, `cropY * scale`.

### Simplified computeCropParams for CropOverlay:

```typescript
const computeCropParams = () => {
  const scale = layout.imageScale;

  // In crop mode, the node shows the full image (or previous crop region).
  // activeArea: where the full image renders in the node's CSS coordinate space.
  //
  // After Phase 2 migration:
  // - Node position = imageOriginX + (cropX ?? 0) * scale
  // - Node size = (cropW ?? originalW) * scale
  // - Full image at this scale = originalW * scale, originalH * scale
  // - Full image origin relative to node top-left:
  //     x = -(cropX ?? 0) * scale
  //     y = -(cropY ?? 0) * scale

  const currentCropX = layout.cropX ?? 0;
  const currentCropY = layout.cropY ?? 0;

  return {
    activeArea: {
      x: -currentCropX * scale,
      y: -currentCropY * scale,
      width: layout.originalWidth * scale,
      height: layout.originalHeight * scale,
    },
    imageRange: {
      x: 0,
      y: 0,
      width: layout.originalWidth,
      height: layout.originalHeight,
    },
  };
};
```

### CHECKPOINT:
```bash
npm run type-check
# Manual test: import image, verify it displays correctly (no crop yet)
# Crop -> Done -> verify no offset
# Re-crop -> Done -> verify no offset
# Reset -> verify full image restored
```

## BLOQUE 4: Refactor setCropMode

### Simplified setCropMode:

```typescript
setCropMode: (id: string | null) => {
  if (id === null) {
    // Just exit crop mode, no commit
    set({ cropModeLayoutId: null, pendingCrop: null, prevCommittedCrop: null });
    return;
  }

  const layout = get().layouts.find(l => l.id === id);
  if (!layout) return;

  // In crop mode, expand node to show full image at current scale
  const fullWidth = layout.originalWidth * layout.imageScale;
  const fullHeight = layout.originalHeight * layout.imageScale;

  set(state => ({
    cropModeLayoutId: id,
    pendingCrop: null,
    prevCommittedCrop: layout.cropX !== null
      ? { cropX: layout.cropX!, cropY: layout.cropY!, cropW: layout.cropW!, cropH: layout.cropH! }
      : null,
    layouts: state.layouts.map(l => l.id === id
      ? {
          ...l,
          // Temporarily expand to full image
          xPosition: l.imageOriginX,
          yPosition: l.imageOriginY,
          width: fullWidth,
          height: fullHeight,
        }
      : l
    ),
  }));
},
```

**Key insight:** On entering crop mode, expand node to full image dimensions. The CropOverlay now has the full image visible and can place handles anywhere. On commitCrop, the node shrinks back to the crop region.

### CHECKPOINT:
```bash
npm run type-check
# Manual test: enter crop mode on uncropped image -> handles cover full image
# Enter crop mode on cropped image -> node expands to show full image, handles at previous crop position
```

## BLOQUE 5: Cleanup

1. Remove `prevCommittedCrop` from store if no longer needed (setCropMode still uses it for CropOverlay initial handle position, so keep the field but remove it from commitCrop logic)
2. Remove ALL diagnostic console.log statements:
   - `[commitCrop:entry]`
   - `[commitCrop]`
   - `[renderImage]`
   - `[layoutNodes]`
   - `[post-crop-verify]`
   - `[SIZE-DIAG]`
   - `[RENDER-DIAG]`
3. Remove the `post-crop-verify` useEffect from LayoutImageNode
4. Update `UpdateLayoutInput` type to include `imageOriginX`, `imageOriginY`, `imageScale`
5. Update `SQLiteLayoutRepository` to persist the new fields
6. Verify `handleCropEnd` (mouseup during crop session) does NOT write to `layout.cropX/Y/W/H` directly - it should only update `pendingCrop`. If it currently writes to the layout, refactor to use pendingCrop only.

### CHECKPOINT:
```bash
npm run type-check
npm run lint
grep -rn "console.log.*\[commitCrop\|renderImage\|layoutNodes\|post-crop-verify\|SIZE-DIAG\|RENDER-DIAG" src/
# Should return no results
```

---

## BLOQUE FINAL: Alternate Flows & Integration

### Test Matrix:

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | First crop | Import -> Crop -> Done | Node shrinks to crop, no offset |
| 2 | Re-crop | After #1 -> Crop -> adjust -> Done | Node resizes to new crop, no offset |
| 3 | Reset | After #2 -> Reset Crop | Node returns to full image at original size |
| 4 | Crop after reset | After #3 -> Crop -> Done | Same as #1 |
| 5 | Drag after crop | After #1 -> drag node | Node moves, image stays inside correctly |
| 6 | Resize after crop | After #1 -> resize via handles | Image scales proportionally, crop maintained |
| 7 | Multiple images | Import 3 images, crop each | Each independently correct |
| 8 | Save/reload | Crop image -> save project -> reload | Crop persists, renders correctly |
| 9 | Zoom levels | Crop at zoom 0.5, verify at zoom 1.0 and 2.0 | No zoom-dependent offset |
| 10 | Edge: tiny crop | Crop to 50x50 pixel region of 1920x872 image | Renders correctly, no performance issues |
| 11 | Edge: full-width crop | Crop full width, reduce height only | Works correctly |
| 12 | Cancel crop | Enter crop mode -> Escape / click away | Node unchanged from before entering crop mode |

### Validation commands:
```bash
npm run type-check
npm run lint
npm start
# Execute test matrix manually
```

### Final checklist:
- [ ] All 12 test scenarios pass
- [ ] No diagnostic console.log remaining
- [ ] Database migration handles existing projects
- [ ] New fields (imageOriginX/Y, imageScale) persist correctly in SQLite
- [ ] No regression on other layout features (rotation, opacity, lock, visibility)
- [ ] Performance: no noticeable lag on crop/uncrop

---

## Key Invariants (MUST MAINTAIN)

1. **SSoT:** All layout data in `useLayoutStore.layouts[]`. ReactFlow nodes carry only `{ layoutId }` in data prop.
2. **Hook ordering:** ALL hooks before any early return in LayoutImageNode and LayoutPropertiesPanel.
3. **Atomic operations:** One `set()` call per user action. Never two.
4. **onNodesChange guard:** Only process `change.dragging === true/false`. Skip `undefined`.
5. **deleteKeyCode={null}** on ReactFlow instance.
6. **Rotation via inner wrapper CSS only.** Never on the ReactFlow node wrapper.
7. **NEW: derivation direction is one-way.** Primary fields (imageOriginX/Y, imageScale, cropX/Y/W/H) -> Derived fields (xPosition, yPosition, width, height). NEVER reverse during crop operations.

---

## Implementation Command

```bash
cd ~/projects/line-optimizer

claude "Implement crop image fix and architecture migration according to docs/specs/crop-image-fix-and-migration.md. PHASE 1 FIRST: diagnose the rendering bug using the 4 investigations in BLOQUE 0, then apply the fix. DO NOT proceed to PHASE 2 until PHASE 1 first-crop works visually. Apply contracts-first methodology with checkpoints after each block."
```

## Post-Implementation Verification

```bash
npm run type-check
npm run lint
npm start
# Run full test matrix from BLOQUE FINAL
```

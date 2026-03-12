// ============================================
// LAYOUT IMAGE NODE
// ReactFlow node for background layout images
// Phase 8.5: Canvas Background Layouts
// Phase 8.5b: Added rotation CSS, keepAspectRatio
// Phase 8.5c: Non-destructive crop
// Phase 8.5c Phase 2: imageOriginX/Y + imageScale primary fields
// ============================================

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { NodeProps, NodeResizer } from 'reactflow';
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import type { LayoutNodeData } from '@shared/types/layout';
import type { CropRect } from './CropOverlay';
import { CropOverlay } from './CropOverlay';
import { useLayoutStore } from '../../store/useLayoutStore';
import { useCanvasStore } from '../../store/useCanvasStore';

/**
 * LayoutImageNode renders a background layout image (PNG, JPG, or SVG)
 * as a ReactFlow node positioned behind process objects.
 *
 * Rules:
 * - All hooks are called BEFORE any early returns (Hook Chain Audit PASS)
 * - Node is NOT selectable when hidden (visible = false)
 * - NodeResizer only shown when selected + unlocked + NOT in crop mode
 * - zIndex kept low so process objects render above
 * - Rotation applied via CSS transform on inner content wrapper (NOT the outer node)
 *   so NodeResizer handles stay axis-aligned and drag behavior stays normal
 *
 * Crop rendering (Phase 8.5c Phase 2) — primary field architecture:
 *   imageScale = CSS px per image px (primary, set at import, changes only on resize)
 *   imageOriginX/Y = canvas position of full uncropped image TL (primary, changes only on drag)
 *   setCropMode expands node to full image (originalW*imageScale × originalH*imageScale)
 *   renderImage: translateX = -(cropX??0)*imageScale, translateY = -(cropY??0)*imageScale
 *   No reverse-engineering of scale/origin anywhere in this file.
 */
export const LayoutImageNode = memo(({ data, selected, id }: NodeProps<LayoutNodeData>) => {
  // ---- All hooks BEFORE any conditional returns ----
  const layout = useLayoutStore((state) =>
    state.layouts.find((l) => l.id === data.layoutId)
  );
  const toggleLock = useLayoutStore((state) => state.toggleLock);
  const toggleVisibility = useLayoutStore((state) => state.toggleVisibility);
  const updateLayout = useLayoutStore((state) => state.updateLayout);
  const cropModeLayoutId = useLayoutStore((state) => state.cropModeLayoutId);
  const commitCrop = useLayoutStore((state) => state.commitCrop);
  const setPendingCrop = useLayoutStore((state) => state.setPendingCrop);
  // Persisted drag position from the LAST mouseup (cleared only on commit/reset/exit).
  // Used as the visual crop rect between mouseup and "Done Cropping" so the crop
  // handles stay at the released position instead of snapping back to storedCrop.
  const pendingCropFromStore = useLayoutStore((state) =>
    state.pendingCrop?.layoutId === data.layoutId ? state.pendingCrop.crop : null
  );

  // Local crop state for live preview during drag (not yet committed to store)
  const [liveCrop, setLiveCrop] = useState<CropRect | null>(null);

  const handleToggleLock = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleLock(id);
      // When locking (not unlocking), deselect the node so isPassThrough becomes true
      // and the canvas can pan freely over the locked image.
      if (!layout?.locked) {
        useCanvasStore.getState().setSelectedNode(null);
      }
    },
    [id, toggleLock, layout?.locked]
  );

  const handleToggleVisibility = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleVisibility(id);
    },
    [id, toggleVisibility]
  );

  const handleResizeEnd = useCallback(
    (_event: unknown, params: { x: number; y: number; width: number; height: number }) => {
      if (!layout) return;
      // imageScale changes on resize; derive from new node width / effective crop width.
      const newImageScale = params.width / (layout.cropW ?? layout.originalWidth);
      // imageOriginX/Y = node top-left - cropOffset * imageScale (or just node pos when no crop)
      const newImageOriginX = params.x - (layout.cropX ?? 0) * newImageScale;
      const newImageOriginY = params.y - (layout.cropY ?? 0) * newImageScale;
      updateLayout(id, {
        imageOriginX: newImageOriginX,
        imageOriginY: newImageOriginY,
        imageScale: newImageScale,
        xPosition: params.x,
        yPosition: params.y,
        width: params.width,
        height: params.height,
      });
    },
    [id, layout, updateLayout]
  );

  const handleCropChange = useCallback((crop: CropRect) => {
    setLiveCrop(crop);
    setPendingCrop(id, crop);
  }, [id, setPendingCrop]);

  const handleCropEnd = useCallback((crop: CropRect) => {
    // Persist final drag position to store BEFORE clearing live preview.
    // After mouseup: liveCrop → null, pendingCrop → final position.
    // effectiveCrop falls back to pendingCropFromStore so handles stay at released position.
    // Crop is NOT written to the DB here — only on commitCrop.
    setPendingCrop(id, crop);
    setLiveCrop(null);
  }, [id, setPendingCrop]);

  const handleCancelCrop = useCallback(() => {
    // Escape = cancel: discard any pending drag changes and restore pre-session crop.
    // pendingCrop cleared → commitCrop falls back to layout.cropX/Y/W/H (last committed crop).
    setLiveCrop(null);
    setPendingCrop(null, null);
    commitCrop(id);
  }, [commitCrop, id, setPendingCrop]);

  // Auto-heal: correct originalWidth/Height if the stored value is wrong (legacy 800x600 default).
  // Fires on every <img> load, but only calls updateLayout when dims actually differ.
  // After heal, layout.originalWidth matches naturalWidth → condition is false → no re-render loop.
  // Scales existing crop to the new coordinate space instead of destroying it (defense in depth).
  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (
        layout &&
        nw > 0 &&
        nh > 0 &&
        (Math.abs(nw - layout.originalWidth) > 1 || Math.abs(nh - layout.originalHeight) > 1)
      ) {
        const sx = nw / layout.originalWidth;
        const sy = nh / layout.originalHeight;
        updateLayout(id, {
          originalWidth: nw,
          originalHeight: nh,
          // Scale crop to the new coordinate space instead of destroying it
          ...(layout.cropX !== null ? {
            cropX: layout.cropX * sx,
            cropY: layout.cropY! * sy,
            cropW: layout.cropW! * sx,
            cropH: layout.cropH! * sy,
          } : {}),
        });
      }
    },
    [id, layout, updateLayout]
  );

  // Clear liveCrop whenever crop mode exits (regardless of what triggered the exit).
  // "Done Cropping" in LayoutPropertiesPanel calls commitCrop directly, not via CropOverlay,
  // so liveCrop could linger as stale state. This effect ensures cleanup.
  // Must be BEFORE the early return to satisfy Hook Chain Audit.
  useEffect(() => {
    if (cropModeLayoutId !== id) {
      setLiveCrop(null);
    }
  }, [cropModeLayoutId, id]);

  // Ref for the outer node div — used by the defense-in-depth native mousedown guard.
  // Hook Chain Audit: BEFORE early return.
  const outerDivRef = useRef<HTMLDivElement>(null);

  // Defense-in-depth: when this node is in crop mode, stop ALL mousedown events from
  // bubbling past the outer div to the ReactFlow node wrapper. CropOverlay's native
  // interceptor (on the overlay root) already stops handle clicks; this catches any
  // remaining clicks within the expanded node area (e.g., on the image itself).
  // Must use a NATIVE listener — React synthetic handlers fire after RF's native listener.
  // Hook Chain Audit: BEFORE early return.
  useEffect(() => {
    const el = outerDivRef.current;
    if (!el || cropModeLayoutId !== id) return;
    const stop = (e: MouseEvent) => e.stopPropagation();
    el.addEventListener('mousedown', stop);
    return () => el.removeEventListener('mousedown', stop);
  }, [cropModeLayoutId, id]);

  // Guard: layout not yet in store (e.g., during store reload)
  if (!layout) {
    return null;
  }

  const isCropMode = cropModeLayoutId === id;
  const isSvg = layout.sourceFormat === 'svg' || layout.sourceFormat === 'dxf';

  // Stored crop: what is persisted in the layout store (stable during drag)
  const hasCrop =
    layout.cropX !== null &&
    layout.cropY !== null &&
    layout.cropW !== null &&
    layout.cropH !== null;

  const storedCrop: CropRect | null = hasCrop
    ? { cropX: layout.cropX!, cropY: layout.cropY!, cropW: layout.cropW!, cropH: layout.cropH! }
    : null;

  // Effective crop: includes live drag preview (used by CropOverlay for handle position)
  // pendingCropFromStore is the middle tier — persisted on mouseup, cleared on commit/reset/exit.
  const effectiveCrop: CropRect | null = liveCrop ?? pendingCropFromStore ?? storedCrop;

  // Render crop: what the image actually renders.
  // In crop mode: null → full image fills the expanded node (setCropMode expanded it).
  // Outside crop mode: effectiveCrop → cropped view.
  const renderCrop: CropRect | null = isCropMode ? null : effectiveCrop;

  // ---- Image/SVG rendering helpers ----

  const renderImage = () => {
    // Phase 2: imageScale is the primary field — no reverse-engineering needed.
    // The node in crop mode is expanded to full image, so image fills it at (0,0).
    // Outside crop mode, the node is at crop size; image is offset so crop region shows.
    const scale = layout.imageScale;
    const imgW = layout.originalWidth * scale;
    const imgH = layout.originalHeight * scale;
    const translateX = -(renderCrop?.cropX ?? 0) * scale;
    const translateY = -(renderCrop?.cropY ?? 0) * scale;

    return (
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
        <img
          src={layout.imageData}
          alt={layout.name}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: imgW,
            height: imgH,
            // Override Tailwind Preflight's `img { max-width: 100%; height: auto; }`.
            // Without this, max-width:100% compresses imgW to the container width and
            // breaks the crop transform. (Phase 1 fix — permanent.)
            maxWidth: 'none',
            maxHeight: 'none',
            transform: `translate(${translateX}px, ${translateY}px)`,
            transformOrigin: '0 0',
            display: 'block',
            pointerEvents: 'none',
          }}
          draggable={false}
          onLoad={handleImageLoad}
        />
      </div>
    );
  };

  const renderSvg = () => {
    if (!renderCrop) {
      return (
        <div
          style={{ width: '100%', height: '100%' }}
          dangerouslySetInnerHTML={{ __html: layout.imageData }}
        />
      );
    }

    const { cropX, cropY, cropW, cropH } = renderCrop;
    const patched = layout.imageData.replace(
      /viewBox="[^"]*"/,
      `viewBox="${cropX} ${cropY} ${cropW} ${cropH}"`
    );
    return (
      <div
        style={{ width: '100%', height: '100%' }}
        dangerouslySetInnerHTML={{ __html: patched }}
      />
    );
  };

  // Compute where the image renders within the (expanded) node and which image pixels it covers.
  // setCropMode expands node to full image → activeArea fills the entire node from (0,0).
  // imageRange always covers the full image so CropOverlay can move handles in any direction.
  const computeCropParams = (): {
    activeArea: { x: number; y: number; width: number; height: number };
    imageRange: { x: number; y: number; width: number; height: number };
  } => {
    const scale = layout.imageScale;
    return {
      activeArea: { x: 0, y: 0, width: layout.originalWidth * scale, height: layout.originalHeight * scale },
      imageRange: { x: 0, y: 0, width: layout.originalWidth, height: layout.originalHeight },
    };
  };

  return (
    <div
      ref={outerDivRef}
      style={{
        width: layout.width,
        height: layout.height,
        opacity: layout.visible ? layout.opacity : 0.1,
        position: 'relative',
        cursor: layout.locked ? 'default' : isCropMode ? 'crosshair' : 'move',
        userSelect: 'none',
      }}
    >
      {/* NodeResizer: only when selected + unlocked + NOT in crop mode */}
      {selected && !layout.locked && !isCropMode && (
        <NodeResizer
          minWidth={50}
          minHeight={50}
          keepAspectRatio={layout.aspectRatioLocked}
          onResizeEnd={handleResizeEnd}
          lineStyle={{ border: '1px dashed #3B82F6' }}
          handleStyle={{
            width: 8,
            height: 8,
            background: '#3B82F6',
            borderRadius: 2,
          }}
        />
      )}

      {/* Image content wrapper — rotation applied HERE (not on outer node)
          so ReactFlow drag/resize handles remain axis-aligned.
          When locked, pointer-events:none lets drag pass through to canvas panning.
          Only the control buttons overlay (pointer-events:auto) stays clickable. */}
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: layout.rotation !== 0 ? `rotate(${layout.rotation}deg)` : undefined,
          transformOrigin: 'center center',
          overflow: 'hidden',
          pointerEvents: layout.locked ? 'none' : undefined,
        }}
      >
        {isSvg ? renderSvg() : renderImage()}
      </div>

      {/* CropOverlay: shown only in crop mode.
          activeArea/imageRange computed from stored imageScale (stable during drag). */}
      {isCropMode && (() => {
        const { activeArea, imageRange } = computeCropParams();
        return (
          <CropOverlay
            crop={effectiveCrop ?? {
              cropX: 0,
              cropY: 0,
              cropW: layout.originalWidth,
              cropH: layout.originalHeight,
            }}
            activeArea={activeArea}
            imageRange={imageRange}
            onCropChange={handleCropChange}
            onCropEnd={handleCropEnd}
            onCancel={handleCancelCrop}
          />
        );
      })()}

      {/* Control overlay - only shown when selected and NOT in crop mode.
          pointerEvents:'auto' overrides the wrapper's pointer-events:none (set when locked)
          so these buttons remain clickable even when the image is locked. */}
      {selected && !isCropMode && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'flex',
            gap: 4,
            zIndex: 10,
            pointerEvents: 'auto',
          }}
        >
          {/* Visibility toggle */}
          <button
            onClick={handleToggleVisibility}
            title={layout.visible ? 'Hide layout' : 'Show layout'}
            style={{
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              padding: '3px 5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {layout.visible ? (
              <Eye style={{ width: 14, height: 14, color: '#374151' }} />
            ) : (
              <EyeOff style={{ width: 14, height: 14, color: '#9ca3af' }} />
            )}
          </button>

          {/* Lock toggle */}
          <button
            onClick={handleToggleLock}
            title={layout.locked ? 'Unlock layout' : 'Lock layout'}
            style={{
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              padding: '3px 5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {layout.locked ? (
              <Lock style={{ width: 14, height: 14, color: '#dc2626' }} />
            ) : (
              <Unlock style={{ width: 14, height: 14, color: '#374151' }} />
            )}
          </button>
        </div>
      )}

      {/* Label shown at bottom-left when selected */}
      {selected && (
        <div
          style={{
            position: 'absolute',
            bottom: -24,
            left: 0,
            background: 'rgba(0,0,0,0.6)',
            color: 'white',
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {layout.name}{isCropMode ? ' — Cropping' : ''}
        </div>
      )}
    </div>
  );
});

LayoutImageNode.displayName = 'LayoutImageNode';

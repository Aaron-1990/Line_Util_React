// ============================================
// LAYOUT IMAGE NODE
// ReactFlow node for background layout images
// Phase 8.5: Canvas Background Layouts
// Phase 8.5b: Added rotation CSS, keepAspectRatio
// Phase 8.5c: Non-destructive crop
// Phase 8.5c-patch: Handles on Current View (no visual jump on crop entry)
// Phase 8.5c-patch #6: Unified JSX tree eliminates <img> remount on crop mode exit
// Phase 8.5c-patch #7: Replace nested overflow:hidden with clip-path:inset() — fixes empty node after Done Cropping
// ============================================

import { memo, useCallback, useEffect, useState } from 'react';
import { NodeProps, NodeResizer } from 'reactflow';
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import type { LayoutNodeData } from '@shared/types/layout';
import type { CropRect } from './CropOverlay';
import { CropOverlay } from './CropOverlay';
import { useLayoutStore } from '../../store/useLayoutStore';

/**
 * Returns the axis-aligned bounding rect (in container coords) where content
 * would be placed using "object-fit: contain" semantics.
 */
function computeContainBounds(
  contentW: number, contentH: number,
  containerW: number, containerH: number
): { x: number; y: number; width: number; height: number } {
  const contentAspect = contentW / contentH;
  const containerAspect = containerW / containerH;
  if (contentAspect > containerAspect) {
    const renderW = containerW;
    const renderH = containerW / contentAspect;
    return { x: 0, y: (containerH - renderH) / 2, width: renderW, height: renderH };
  } else {
    const renderH = containerH;
    const renderW = containerH * contentAspect;
    return { x: (containerW - renderW) / 2, y: 0, width: renderW, height: renderH };
  }
}

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
 * Crop rendering (Phase 8.5c-patch #6) — unified single JSX tree:
 *   When no crop: treat as full-image crop (0, 0, origW, origH) → same visual as object-fit:contain
 *   When cropped: standard CSS clip with computed scale/offset
 *   Single structure → React REUSES the <img> on crop mode toggle → no spurious onLoad fires
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
  const setCropMode = useLayoutStore((state) => state.setCropMode);

  // Local crop state for live preview during drag (not yet committed to store)
  const [liveCrop, setLiveCrop] = useState<CropRect | null>(null);

  const handleToggleLock = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleLock(id);
    },
    [id, toggleLock]
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
      updateLayout(id, {
        xPosition: params.x,
        yPosition: params.y,
        width: params.width,
        height: params.height,
      });
    },
    [id, updateLayout]
  );

  const handleCropChange = useCallback((crop: CropRect) => {
    setLiveCrop(crop);
  }, []);

  const handleCropEnd = useCallback(
    (crop: CropRect) => {
      setLiveCrop(null);
      updateLayout(id, {
        cropX: crop.cropX,
        cropY: crop.cropY,
        cropW: crop.cropW,
        cropH: crop.cropH,
      });
    },
    [id, updateLayout]
  );

  const handleExitCrop = useCallback(() => {
    setLiveCrop(null);
    setCropMode(null);
  }, [setCropMode]);

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
  // "Done Cropping" in LayoutPropertiesPanel calls setCropMode(null) without reaching
  // handleExitCrop, so liveCrop would linger as stale state. This effect ensures cleanup.
  // Must be BEFORE the early return to satisfy Hook Chain Audit.
  useEffect(() => {
    if (cropModeLayoutId !== id) {
      setLiveCrop(null);
    }
  }, [cropModeLayoutId, id]);

  // Guard: layout not yet in store (e.g., during store reload)
  if (!layout) {
    return null;
  }

  const isCropMode = cropModeLayoutId === id;
  const isSvg = layout.sourceFormat === 'svg' || layout.sourceFormat === 'dxf';

  // Determine effective crop (live preview takes priority)
  const hasCrop =
    layout.cropX !== null &&
    layout.cropY !== null &&
    layout.cropW !== null &&
    layout.cropH !== null;

  // Stored crop: what is persisted in the layout store (stable during drag)
  const storedCrop: CropRect | null = hasCrop
    ? { cropX: layout.cropX!, cropY: layout.cropY!, cropW: layout.cropW!, cropH: layout.cropH! }
    : null;

  // Effective crop: includes live drag preview (used by CropOverlay for handle position)
  const effectiveCrop: CropRect | null = liveCrop ?? storedCrop;

  // Render crop: what the image actually renders.
  // In crop mode: null → Branch 3 (full image with object-fit:contain). CropOverlay draws
  //   handles over the full image so user can drag freely in either direction.
  // Outside crop mode: effectiveCrop → Branch 2 (cropped view). Matches PowerPoint behavior.
  const renderCrop: CropRect | null = isCropMode ? null : effectiveCrop;

  // ---- Image/SVG rendering helpers ----

  const renderImage = () => {
    // Single-layer clip-path approach: no nested overflow:hidden containers.
    // Chromium can skip painting content positioned outside small overflow:hidden boxes
    // via negative offsets (triple-nested approach). clip-path:inset() is GPU-composited
    // and always paints correctly regardless of nesting or negative offset values.
    //
    // When no crop: clip-path: inset(0 0 0 0) = no clipping = full image visible.
    // When cropped: clip-path cuts away non-crop sides. Image stays at fullBounds position
    //   (positive left/top) — no negative offsets needed.
    const crop = renderCrop ?? {
      cropX: 0, cropY: 0,
      cropW: layout.originalWidth, cropH: layout.originalHeight,
    };
    // Always use the full-image contain-fit scale so the image stays at the same
    // visual position during crop mode entry/exit (PowerPoint behavior).
    const fullBounds = computeContainBounds(
      layout.originalWidth, layout.originalHeight,
      layout.width, layout.height
    );
    const scale = fullBounds.width / layout.originalWidth;
    const imgW = layout.originalWidth * scale;
    const imgH = layout.originalHeight * scale;

    // clip-path: inset(top right bottom left) in px, relative to the img element
    const clipTop = crop.cropY * scale;
    const clipRight = imgW - (crop.cropX + crop.cropW) * scale;
    const clipBottom = imgH - (crop.cropY + crop.cropH) * scale;
    const clipLeft = crop.cropX * scale;

    return (
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
        <img
          src={layout.imageData}
          alt={layout.name}
          style={{
            position: 'absolute',
            width: imgW,
            height: imgH,
            left: fullBounds.x,
            top: fullBounds.y,
            clipPath: `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)`,
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
      // No crop: show full SVG (same in normal mode and crop mode — no visual jump)
      return (
        <div
          style={{ width: '100%', height: '100%' }}
          dangerouslySetInnerHTML={{ __html: layout.imageData }}
        />
      );
    }

    // Branch 2 SVG: adjust viewBox to show only the crop region
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

  // Compute where the image renders within the node (activeArea) and which image pixels
  // that area covers (imageRange). Used by CropOverlay for its coordinate system.
  //
  // In crop mode renderCrop=null → Branch 3 (object-fit:contain on full image).
  // imageRange always covers the FULL image so constrainCrop() allows handles to move
  // freely in both directions — user can enlarge or shrink the crop without restriction.
  const computeCropParams = (): {
    activeArea: { x: number; y: number; width: number; height: number };
    imageRange: { x: number; y: number; width: number; height: number };
  } => {
    const bounds = computeContainBounds(
      layout.originalWidth, layout.originalHeight,
      layout.width, layout.height
    );
    return {
      activeArea: bounds,
      imageRange: { x: 0, y: 0, width: layout.originalWidth, height: layout.originalHeight },
    };
  };

  return (
    <div
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
          so ReactFlow drag/resize handles remain axis-aligned */}
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: layout.rotation !== 0 ? `rotate(${layout.rotation}deg)` : undefined,
          transformOrigin: 'center center',
          overflow: 'hidden',
        }}
      >
        {isSvg ? renderSvg() : renderImage()}
      </div>

      {/* CropOverlay: shown only in crop mode.
          activeArea/imageRange computed from storedCrop (stable) so handles
          don't jump when the live drag updates effectiveCrop. */}
      {isCropMode && (() => {
        const { activeArea, imageRange } = computeCropParams();
        return (
          <CropOverlay
            crop={effectiveCrop ?? {
              cropX: imageRange.x,
              cropY: imageRange.y,
              cropW: imageRange.width,
              cropH: imageRange.height,
            }}
            activeArea={activeArea}
            imageRange={imageRange}
            onCropChange={handleCropChange}
            onCropEnd={handleCropEnd}
            onExit={handleExitCrop}
          />
        );
      })()}

      {/* Control overlay - only shown when selected and NOT in crop mode */}
      {selected && !isCropMode && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'flex',
            gap: 4,
            zIndex: 10,
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

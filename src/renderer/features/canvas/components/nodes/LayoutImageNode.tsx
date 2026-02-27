// ============================================
// LAYOUT IMAGE NODE
// ReactFlow node for background layout images
// Phase 8.5: Canvas Background Layouts
// Phase 8.5b: Added rotation CSS, keepAspectRatio
// Phase 8.5c: Non-destructive crop (3-branch rendering)
// ============================================

import { memo, useCallback, useState } from 'react';
import { NodeProps, NodeResizer } from 'reactflow';
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import type { LayoutNodeData } from '@shared/types/layout';
import type { CropRect } from './CropOverlay';
import { CropOverlay } from './CropOverlay';
import { useLayoutStore } from '../../store/useLayoutStore';

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
 * Crop rendering (Phase 8.5c) — 3 branches:
 *   1. Crop mode active: full image + CropOverlay handles
 *   2. Has crop, not in crop mode: CSS clip (img) / viewBox adjustment (SVG)
 *   3. No crop: existing behavior (object-fit: contain)
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

  // Crop rect used for rendering (image pixel coords)
  const effectiveCrop: CropRect | null = liveCrop ?? (hasCrop
    ? { cropX: layout.cropX!, cropY: layout.cropY!, cropW: layout.cropW!, cropH: layout.cropH! }
    : null);

  // ---- Image/SVG rendering helpers ----

  const renderImage = () => {
    if (isCropMode) {
      // Branch 1: crop mode — show FULL image so handles can drag to any edge
      return (
        <img
          src={layout.imageData}
          alt={layout.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            display: 'block',
            pointerEvents: 'none',
          }}
          draggable={false}
        />
      );
    }

    if (effectiveCrop) {
      // Branch 2: cropped display — CSS positioning trick
      // We scale the full image to fill the node as if the crop rect == node bounds,
      // then shift it so the correct region is visible.
      const { cropX, cropY, cropW, cropH } = effectiveCrop;
      const imgW = layout.width * (layout.originalWidth / cropW);
      const imgH = layout.height * (layout.originalHeight / cropH);
      const imgLeft = -(cropX * layout.width / cropW);
      const imgTop = -(cropY * layout.height / cropH);

      return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
          <img
            src={layout.imageData}
            alt={layout.name}
            style={{
              position: 'absolute',
              width: imgW,
              height: imgH,
              left: imgLeft,
              top: imgTop,
              display: 'block',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
        </div>
      );
    }

    // Branch 3: no crop
    return (
      <img
        src={layout.imageData}
        alt={layout.name}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          pointerEvents: 'none',
        }}
        draggable={false}
      />
    );
  };

  const renderSvg = () => {
    if (isCropMode || !effectiveCrop) {
      // Full SVG (no viewBox adjustment in crop mode or uncropped)
      return (
        <div
          style={{ width: '100%', height: '100%' }}
          dangerouslySetInnerHTML={{ __html: layout.imageData }}
        />
      );
    }

    // Branch 2 SVG: adjust viewBox to show only the crop region
    const { cropX, cropY, cropW, cropH } = effectiveCrop;
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

      {/* CropOverlay: shown only in crop mode */}
      {isCropMode && (
        <CropOverlay
          crop={effectiveCrop ?? {
            cropX: 0,
            cropY: 0,
            cropW: layout.originalWidth,
            cropH: layout.originalHeight,
          }}
          nodeWidth={layout.width}
          nodeHeight={layout.height}
          originalWidth={layout.originalWidth}
          originalHeight={layout.originalHeight}
          onCropChange={handleCropChange}
          onCropEnd={handleCropEnd}
          onExit={handleExitCrop}
        />
      )}

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

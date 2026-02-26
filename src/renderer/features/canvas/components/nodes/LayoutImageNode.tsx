// ============================================
// LAYOUT IMAGE NODE
// ReactFlow node for background layout images
// Phase 8.5: Canvas Background Layouts
// Phase 8.5b: Added rotation CSS, keepAspectRatio
// ============================================

import { memo, useCallback } from 'react';
import { NodeProps, NodeResizer } from 'reactflow';
import { Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import type { LayoutNodeData } from '@shared/types/layout';
import { useLayoutStore } from '../../store/useLayoutStore';

/**
 * LayoutImageNode renders a background layout image (PNG, JPG, or SVG)
 * as a ReactFlow node positioned behind process objects.
 *
 * Rules:
 * - All hooks are called BEFORE any early returns (Hook Chain Audit PASS)
 * - Node is NOT selectable when hidden (visible = false)
 * - NodeResizer only shown when selected + unlocked
 * - zIndex kept low so process objects render above
 * - Rotation applied via CSS transform on inner content wrapper (NOT the outer node)
 *   so NodeResizer handles stay axis-aligned and drag behavior stays normal
 */
export const LayoutImageNode = memo(({ data, selected, id }: NodeProps<LayoutNodeData>) => {
  // All hooks BEFORE any conditional returns
  const layout = useLayoutStore((state) =>
    state.layouts.find((l) => l.id === data.layoutId)
  );
  const toggleLock = useLayoutStore((state) => state.toggleLock);
  const toggleVisibility = useLayoutStore((state) => state.toggleVisibility);
  const updateLayout = useLayoutStore((state) => state.updateLayout);

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

  // Guard: layout not yet in store (e.g., during store reload)
  if (!layout) {
    return null;
  }

  const isSvg = layout.sourceFormat === 'svg' || layout.sourceFormat === 'dxf';

  return (
    <div
      style={{
        width: layout.width,
        height: layout.height,
        opacity: layout.visible ? layout.opacity : 0.1,
        position: 'relative',
        cursor: layout.locked ? 'default' : 'move',
        userSelect: 'none',
      }}
    >
      {/* NodeResizer: only when selected and not locked.
          keepAspectRatio wires directly to layout.aspectRatioLocked. */}
      {selected && !layout.locked && (
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

      {/* Image content wrapper — rotation is applied HERE (not on outer node)
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
        {isSvg ? (
          <div
            style={{ width: '100%', height: '100%' }}
            dangerouslySetInnerHTML={{ __html: layout.imageData }}
          />
        ) : (
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
        )}
      </div>

      {/* Control overlay - only shown when selected */}
      {selected && (
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
          {layout.name}
        </div>
      )}
    </div>
  );
});

LayoutImageNode.displayName = 'LayoutImageNode';

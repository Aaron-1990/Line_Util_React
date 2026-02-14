// ============================================
// GHOST PREVIEW
// Semi-transparent shape preview during placement
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

import { memo } from 'react';
import { useToolStore } from '../store/useToolStore';
import { useShapeCatalogStore } from '../store/useShapeCatalogStore';
import { useClipboardStore } from '../store/useClipboardStore';
import { isPlaceTool, isPasteTool } from '@shared/types';

/**
 * Render a primitive shape as SVG
 */
function renderPrimitive(
  primitiveType: string | undefined,
  width: number,
  height: number
) {
  const fill = 'rgba(59, 130, 246, 0.3)'; // Blue with 30% opacity
  const stroke = 'rgba(59, 130, 246, 0.8)';

  switch (primitiveType) {
    case 'rectangle':
      return (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={8}
          fill={fill}
          stroke={stroke}
          strokeWidth={2}
          strokeDasharray="4 2"
        />
      );
    case 'triangle':
      return (
        <polygon
          points={`${width / 2},0 ${width},${height} 0,${height}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={2}
          strokeDasharray="4 2"
        />
      );
    case 'circle':
      return (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2}
          ry={height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={2}
          strokeDasharray="4 2"
        />
      );
    case 'diamond':
      return (
        <polygon
          points={`${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={2}
          strokeDasharray="4 2"
        />
      );
    default:
      return (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={8}
          fill={fill}
          stroke={stroke}
          strokeWidth={2}
          strokeDasharray="4 2"
        />
      );
  }
}

/**
 * GhostPreview
 *
 * Shows a semi-transparent preview of the shape being placed or pasted.
 * Follows the mouse cursor when in 'place' or 'paste' mode.
 */
export const GhostPreview = memo(() => {
  const { activeTool, ghostPosition } = useToolStore();
  const { copiedObject } = useClipboardStore();
  const { getShapeById } = useShapeCatalogStore();

  // Don't render if no ghost position
  if (!ghostPosition) {
    return null;
  }

  let ghostShape;
  let ghostLabel;

  if (isPlaceTool(activeTool)) {
    ghostShape = getShapeById(activeTool.shapeId);
    ghostLabel = ghostShape?.name;
  } else if (isPasteTool(activeTool) && copiedObject) {
    ghostShape = getShapeById(copiedObject.shapeId);
    ghostLabel = copiedObject.name + ' (paste)';
  }

  // No shape to render
  if (!ghostShape) {
    return null;
  }

  const width = ghostShape.defaultWidth;
  const height = ghostShape.defaultHeight;

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: ghostPosition.x - width / 2,
        top: ghostPosition.y - height / 2,
        width,
        height,
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {ghostShape.renderType === 'primitive' && renderPrimitive(ghostShape.primitiveType, width, height)}

        {ghostShape.renderType === 'svg' && ghostShape.svgContent && (
          <g
            opacity={0.5}
            dangerouslySetInnerHTML={{ __html: ghostShape.svgContent }}
          />
        )}
      </svg>

      {/* Shape name tooltip */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="text-xs bg-gray-800 text-white px-2 py-1 rounded shadow-lg">
          {ghostLabel}
        </span>
      </div>
    </div>
  );
});

GhostPreview.displayName = 'GhostPreview';

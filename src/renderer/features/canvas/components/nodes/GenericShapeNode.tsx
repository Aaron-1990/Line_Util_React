// ============================================
// GENERIC SHAPE NODE
// Polymorphic ReactFlow node that renders based on shape type
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

import { memo, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Cog,
  Box,
  ArrowRightCircle,
  CircleOff,
  ShieldCheck
} from 'lucide-react';
import { CanvasObjectWithDetails, CanvasObjectType } from '@shared/types';
import { useToolStore } from '../../store/useToolStore';

interface GenericShapeNodeData extends CanvasObjectWithDetails {
  // All data comes from CanvasObjectWithDetails
}

/**
 * Get the icon for an object type
 */
function getTypeIcon(type: CanvasObjectType) {
  switch (type) {
    case 'process':
      return <Cog className="w-3 h-3" />;
    case 'buffer':
      return <Box className="w-3 h-3" />;
    case 'source':
      return <ArrowRightCircle className="w-3 h-3" />;
    case 'sink':
      return <CircleOff className="w-3 h-3" />;
    case 'quality_gate':
      return <ShieldCheck className="w-3 h-3" />;
    default:
      return null;
  }
}

/**
 * Get the color class for an object type
 */
function getTypeColorClass(type: CanvasObjectType) {
  switch (type) {
    case 'process':
      return 'bg-blue-500 text-white';
    case 'buffer':
      return 'bg-amber-500 text-white';
    case 'source':
      return 'bg-green-500 text-white';
    case 'sink':
      return 'bg-red-500 text-white';
    case 'quality_gate':
      return 'bg-purple-500 text-white';
    default:
      return 'bg-gray-400 text-white';
  }
}

/**
 * Render the shape based on primitive type
 * Using CSS classes for dark mode support
 */
function renderPrimitive(
  primitiveType: string | undefined,
  width: number,
  height: number,
  hasColorOverride: boolean
) {
  // Use CSS classes for dark mode support
  const fillClass = hasColorOverride ? '' : 'fill-white dark:fill-gray-800';

  switch (primitiveType) {
    case 'rectangle':
      return (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={8}
          className={`transition-colors ${fillClass}`}
        />
      );
    case 'triangle':
      return (
        <polygon
          points={`${width / 2},0 ${width},${height} 0,${height}`}
          className={`transition-colors ${fillClass}`}
        />
      );
    case 'circle':
      return (
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2}
          ry={height / 2}
          className={`transition-colors ${fillClass}`}
        />
      );
    case 'diamond':
      return (
        <polygon
          points={`${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`}
          className={`transition-colors ${fillClass}`}
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
          className={`transition-colors ${fillClass}`}
        />
      );
  }
}

/**
 * Convert anchor position to ReactFlow Position
 */
function anchorToPosition(position: string): Position {
  switch (position) {
    case 'top':
      return Position.Top;
    case 'bottom':
      return Position.Bottom;
    case 'left':
      return Position.Left;
    case 'right':
      return Position.Right;
    default:
      return Position.Bottom;
  }
}

/**
 * GenericShapeNode
 *
 * A polymorphic node that can render different shapes and represent
 * different functional types (process, buffer, source, sink, quality_gate).
 */
// Default shape for fallback when shape data is missing
const DEFAULT_SHAPE = {
  id: 'default',
  categoryId: 'default',
  name: 'Default',
  source: 'builtin' as const,
  renderType: 'primitive' as const,
  primitiveType: 'rectangle' as const,
  defaultWidth: 120,
  defaultHeight: 60,
  isActive: true,
  isFavorite: false,
  usageCount: 0,
  anchors: [
    { id: 'left', shapeId: 'default', position: 'left' as const, offsetX: 0, offsetY: 0.5, isInput: true, isOutput: false },
    { id: 'right', shapeId: 'default', position: 'right' as const, offsetX: 1, offsetY: 0.5, isInput: false, isOutput: true },
  ],
};

export const GenericShapeNode = memo<NodeProps<GenericShapeNodeData>>(
  ({ data, selected, id }) => {
    const { objectType, name, colorOverride, bufferProperties, linkedLine } = data;

    // Use default shape if shape is undefined (can happen during type changes)
    const shape = data.shape ?? DEFAULT_SHAPE;

    // Get tool state to show anchors prominently in connect mode
    const activeTool = useToolStore((state) => state.activeTool);
    const connectionSource = useToolStore((state) => state.connectionSource);
    const isConnectMode = activeTool === 'connect';
    const isConnectionSource = connectionSource?.objectId === id;

    // Calculate dimensions
    const width = data.width ?? shape.defaultWidth;
    const height = data.height ?? shape.defaultHeight;

    // Determine if we have a color override
    const hasColorOverride = !!colorOverride;

    // Stroke color - matching ProductionLineNode border colors
    const strokeColor = selected
      ? '#6366F1' // primary-500
      : isConnectionSource
      ? '#10B981' // green-500 for connection source
      : '#D1D5DB'; // gray-300
    const strokeWidth = selected ? 2 : 1;

    // Generate handles from shape anchors
    // Single handle per anchor with type="source" - connectionMode="loose" allows source-to-source connections
    const anchors = shape.anchors ?? [];
    const handles = useMemo(() => {
      return anchors.map((anchor) => {
        const position = anchorToPosition(anchor.position);

        // Calculate handle position based on offset
        const style: React.CSSProperties = {};
        if (position === Position.Top || position === Position.Bottom) {
          style.left = `${anchor.offsetX * 100}%`;
        } else {
          style.top = `${anchor.offsetY * 100}%`;
        }

        // Determine handle styling based on mode - matching ProductionLineNode
        const isSelectedAnchor = connectionSource?.anchor === anchor.id && isConnectionSource;
        const handleSize = isConnectMode ? 'w-3 h-3' : 'w-2 h-2';
        const handleColor = isSelectedAnchor
          ? '!bg-green-500'
          : isConnectMode
          ? '!bg-blue-400 hover:!bg-blue-600'
          : '!bg-gray-400 hover:!bg-primary-500'; // Matches ProductionLineNode
        const handleVisibility = isConnectMode ? 'opacity-100' : 'opacity-0 hover:opacity-100';

        return (
          <Handle
            key={anchor.id}
            id={anchor.id}
            type="source"
            position={position}
            style={style}
            className={`${handleSize} ${handleColor} ${handleVisibility} transition-all duration-200 !border-2 !border-white shadow-sm`}
          />
        );
      });
    }, [anchors, isConnectMode, connectionSource, isConnectionSource]);

    // Type badge
    const typeIcon = getTypeIcon(objectType);
    const typeColorClass = getTypeColorClass(objectType);

    return (
      <div
        className={`relative transition-all duration-200 shadow-md ${
          isConnectionSource
            ? 'ring-2 ring-green-500 ring-offset-2'
            : selected
            ? 'ring-2 ring-primary-200 dark:ring-primary-800 ring-offset-2'
            : isConnectMode
            ? 'hover:ring-2 hover:ring-blue-300 hover:ring-offset-1'
            : ''
        }`}
        style={{ width, height }}
      >
        {/* Shape SVG */}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
          style={hasColorOverride ? { fill: colorOverride } : undefined}
        >
          {/* Render based on renderType */}
          {shape.renderType === 'primitive' && renderPrimitive(shape.primitiveType, width, height, hasColorOverride)}

          {shape.renderType === 'svg' && shape.svgContent && (
            <g dangerouslySetInnerHTML={{ __html: shape.svgContent }} />
          )}

          {/* Border - matching ProductionLineNode rounded rectangle style */}
          {shape.renderType === 'primitive' && shape.primitiveType === 'rectangle' && (
            <rect
              x={0}
              y={0}
              width={width}
              height={height}
              rx={8}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              className="transition-colors"
            />
          )}
        </svg>

        {/* Name Label - matching ProductionLineNode text colors */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 px-2 text-center truncate max-w-full">
            {name}
          </span>
        </div>

        {/* Type Badge */}
        {typeIcon && objectType !== 'generic' && (
          <div
            className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center ${typeColorClass} shadow-sm`}
            title={objectType}
          >
            {typeIcon}
          </div>
        )}

        {/* Buffer Capacity Indicator */}
        {objectType === 'buffer' && bufferProperties && (
          <div className="absolute -bottom-6 left-0 right-0 text-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {bufferProperties.currentWip}/{bufferProperties.maxCapacity}
            </span>
          </div>
        )}

        {/* Linked Line Indicator */}
        {objectType === 'process' && linkedLine && (
          <div className="absolute -bottom-6 left-0 right-0 text-center">
            <span className="text-xs text-blue-500 dark:text-blue-400 truncate block">
              {linkedLine.name}
            </span>
          </div>
        )}

        {/* Handles */}
        {handles}
      </div>
    );
  },
  // Custom comparison for memo
  (prevProps, nextProps) => {
    const prevData = prevProps.data;
    const nextData = nextProps.data;

    return (
      prevProps.selected === nextProps.selected &&
      prevData.id === nextData.id &&
      prevData.name === nextData.name &&
      prevData.objectType === nextData.objectType &&
      prevData.colorOverride === nextData.colorOverride &&
      prevData.width === nextData.width &&
      prevData.height === nextData.height &&
      prevData.bufferProperties?.currentWip === nextData.bufferProperties?.currentWip &&
      prevData.linkedLine?.name === nextData.linkedLine?.name
    );
  }
);

GenericShapeNode.displayName = 'GenericShapeNode';

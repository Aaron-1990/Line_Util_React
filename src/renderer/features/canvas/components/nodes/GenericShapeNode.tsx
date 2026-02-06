// ============================================
// GENERIC SHAPE NODE
// Polymorphic ReactFlow node that renders based on shape type
// Phase 7.5: Shape Catalog & Polymorphic Objects
// Phase 7.5+: Added changeover controls (ported from ProductionLineNode)
// ============================================

import { memo, useMemo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Cog,
  Box,
  ArrowRightCircle,
  CircleOff,
  ShieldCheck,
  Timer,
  TimerOff,
  Settings2
} from 'lucide-react';
import { CanvasObjectWithDetails, CanvasObjectType } from '@shared/types';
import { useToolStore } from '../../store/useToolStore';
import { useChangeoverStore } from '../../../changeover/store/useChangeoverStore';
import { useAnalysisStore } from '../../../analysis/store/useAnalysisStore';
import { useCanvasObjectStore } from '../../store/useCanvasObjectStore';
import { CANVAS_OBJECT_CHANNELS } from '@shared/constants';

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

// Utilization thresholds for border colors (matching ProductionLineNode)
const UTILIZATION_THRESHOLDS = {
  UNDERUTILIZED: 70,  // Gray below this
  HEALTHY: 85,        // Blue 70-85%
  APPROACHING: 95,    // Amber 85-95%
  // Red above 95%
};

/**
 * Get border color based on utilization
 */
function getBorderColor(utilizationPercent: number | null, selected: boolean, isConnectionSource: boolean): string {
  if (selected) return '#6366F1'; // primary-500
  if (isConnectionSource) return '#10B981'; // green-500

  if (utilizationPercent === null) return '#D1D5DB'; // gray-300

  if (utilizationPercent > UTILIZATION_THRESHOLDS.APPROACHING) return '#EF4444'; // red-500
  if (utilizationPercent > UTILIZATION_THRESHOLDS.HEALTHY) return '#F59E0B'; // amber-500
  if (utilizationPercent >= UTILIZATION_THRESHOLDS.UNDERUTILIZED) return '#3B82F6'; // blue-500

  return '#D1D5DB'; // gray-300
}

export const GenericShapeNode = memo<NodeProps<GenericShapeNodeData>>(
  ({ data, selected, id }) => {
    const { objectType, name, colorOverride, bufferProperties, processProperties } = data;

    // Use default shape if shape is undefined (can happen during type changes)
    const shape = data.shape ?? DEFAULT_SHAPE;

    // Get tool state to show anchors prominently in connect mode
    const activeTool = useToolStore((state) => state.activeTool);
    const connectionSource = useToolStore((state) => state.connectionSource);
    const isConnectMode = activeTool === 'connect';
    const isConnectionSource = connectionSource?.objectId === id;

    // Changeover stores
    const openChangeoverModal = useChangeoverStore((state) => state.openModal);
    const updateCanvasObject = useCanvasObjectStore((state) => state.updateObject);

    // Analysis results and global changeover state
    const results = useAnalysisStore((state) => state.results);
    const displayedYearIndex = useAnalysisStore((state) => state.displayedYearIndex);
    const globalChangeoverEnabled = useAnalysisStore((state) => state.globalChangeoverEnabled);

    // Get this object's result from analysis (for displayed year)
    const lineResult = results?.yearResults?.[displayedYearIndex]?.lines?.find(l => l.lineId === id);

    // Process-specific properties for changeover
    const changeoverEnabled = processProperties?.changeoverEnabled ?? true;
    const changeoverExplicit = processProperties?.changeoverExplicit ?? false;
    const timeAvailableDaily = processProperties?.timeAvailableDaily ?? 0;

    // Is this a critical override? (calculating changeover when global is OFF but line explicitly ON)
    const isCriticalOverride = !globalChangeoverEnabled && changeoverExplicit && changeoverEnabled;

    // Calculate utilization percentages
    const utilizationPercent = lineResult?.utilizationPercent ?? null;
    const hasChangeover = lineResult?.changeover && lineResult.changeover.timeUsedChangeover > 0;

    // Calculate blended efficiency from analysis results
    // Note: efficiency in assignments is already a percentage (e.g., 85 = 85%)
    const assignments = lineResult?.assignments ?? [];
    const assignedModelsCount = assignments.length;
    const blendedEfficiency = assignments.length > 0
      ? assignments.reduce((sum, a) => sum + (a.efficiency ?? 0), 0) / assignments.length
      : null;
    const hasEfficiency = blendedEfficiency !== null && blendedEfficiency > 0;
    const efficiencyDisplay = hasEfficiency ? `${blendedEfficiency.toFixed(0)}%` : '--';

    // Calculate total allocated pieces (daily)
    const totalAllocatedDaily = assignments.reduce((sum, a) => sum + (a.allocatedUnitsDaily ?? 0), 0);
    const hasAllocatedPieces = totalAllocatedDaily > 0;

    // Get operation days from year summary
    const yearSummary = results?.yearResults?.[displayedYearIndex]?.summary;
    const operationsDays = yearSummary?.operationsDays ?? 240;

    // Time available in hours
    const hoursAvailable = timeAvailableDaily > 0 ? (timeAvailableDaily / 3600).toFixed(1) : '--';

    // Production time = utilization without changeover
    const productionPercent = utilizationPercent !== null && timeAvailableDaily > 0
      ? (hasChangeover
          ? ((lineResult?.timeUsedDaily ?? 0) / timeAvailableDaily) * 100
          : utilizationPercent)
      : null;

    // Changeover time percentage
    const changeoverPercent = hasChangeover && timeAvailableDaily > 0
      ? ((lineResult?.changeover?.timeUsedChangeover ?? 0) / timeAvailableDaily) * 100
      : 0;

    // Total utilization including changeover
    const totalUtilization = hasChangeover
      ? lineResult?.changeover?.utilizationWithChangeover ?? utilizationPercent
      : utilizationPercent;

    // Changeover handlers
    const handleChangeoverClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      openChangeoverModal(id, name);
    }, [id, name, openChangeoverModal]);

    const handleChangeoverToggle = useCallback(async (e: React.MouseEvent) => {
      e.stopPropagation();
      const newEnabled = !changeoverEnabled;

      // Optimistic UI update
      if (processProperties) {
        updateCanvasObject(id, {
          processProperties: {
            ...processProperties,
            changeoverEnabled: newEnabled,
            changeoverExplicit: true,
          },
        });
      }

      // Persist to database
      try {
        await window.electronAPI.invoke(CANVAS_OBJECT_CHANNELS.SET_PROCESS_PROPS, id, {
          changeoverEnabled: newEnabled,
          changeoverExplicit: true,
        });
      } catch (error) {
        console.error('Failed to update changeover toggle:', error);
        // Revert on error
        if (processProperties) {
          updateCanvasObject(id, {
            processProperties: {
              ...processProperties,
              changeoverEnabled,
              changeoverExplicit,
            },
          });
        }
      }
    }, [changeoverEnabled, changeoverExplicit, id, processProperties, updateCanvasObject]);

    // Calculate dimensions
    const width = data.width ?? shape.defaultWidth;
    const height = data.height ?? shape.defaultHeight;

    // Determine if we have a color override
    const hasColorOverride = !!colorOverride;

    // Stroke color - dynamic based on utilization for process objects
    const strokeColor = objectType === 'process'
      ? getBorderColor(totalUtilization, selected ?? false, isConnectionSource)
      : (selected ? '#6366F1' : isConnectionSource ? '#10B981' : '#D1D5DB');
    const strokeWidth = selected ? 2 : 1;

    // Check if this is a process object (shows changeover controls)
    const isProcessObject = objectType === 'process' && processProperties;

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

    // For process objects, use a card-like layout similar to ProductionLineNode
    if (isProcessObject) {
      return (
        <div
          className={`
            px-3 py-2 rounded-lg border-2 bg-white dark:bg-gray-800 shadow-md
            min-w-[200px] transition-all duration-200
            ${isConnectionSource ? 'ring-2 ring-green-500 ring-offset-2' : ''}
            ${selected ? 'ring-2 ring-primary-200 dark:ring-primary-800 ring-offset-2 border-primary-500' : ''}
            ${isConnectMode && !isConnectionSource ? 'hover:ring-2 hover:ring-blue-300 hover:ring-offset-1' : ''}
          `}
          style={{
            borderColor: !selected ? strokeColor : undefined,
            minHeight: 80,
          }}
        >
          {/* Header with name and changeover controls */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                totalUtilization !== null
                  ? totalUtilization > 95
                    ? 'bg-red-500'
                    : totalUtilization > 85
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                  : 'bg-green-500'
              }`} />
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                {name}
              </span>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* Per-object changeover toggle */}
              <button
                onClick={handleChangeoverToggle}
                className={`p-1 rounded transition-colors ${
                  isCriticalOverride
                    ? 'text-red-500 hover:bg-red-50 ring-1 ring-red-300'
                    : !globalChangeoverEnabled
                      ? 'text-gray-400 hover:bg-gray-100 hover:text-amber-500'
                      : changeoverEnabled
                        ? 'text-amber-500 hover:bg-amber-50'
                        : 'text-gray-300 hover:bg-gray-100'
                }`}
                title={
                  isCriticalOverride
                    ? 'CRITICAL OVERRIDE: Changeover calculated even though global is OFF'
                    : !globalChangeoverEnabled
                      ? 'Global changeover is OFF. Click to set as critical override.'
                      : changeoverEnabled
                        ? 'Changeover enabled - click to exclude this line'
                        : 'Changeover disabled - click to include this line'
                }
              >
                {changeoverEnabled ? (
                  <Timer className="w-4 h-4" />
                ) : (
                  <TimerOff className="w-4 h-4" />
                )}
              </button>
              {/* Changeover matrix button */}
              <button
                onClick={handleChangeoverClick}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
                title="Edit changeover matrix"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stacked bar visualization */}
          {utilizationPercent !== null && (
            <div className="mb-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="flex-1 h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  {/* Production time (blue) */}
                  {productionPercent !== null && productionPercent > 0 && (
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${Math.min(productionPercent, 100)}%` }}
                      title={`Production: ${productionPercent.toFixed(1)}%`}
                    />
                  )}
                  {/* Changeover time (amber) */}
                  {changeoverPercent > 0 && (
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${Math.min(changeoverPercent, 100 - (productionPercent ?? 0))}%` }}
                      title={`Changeover: ${changeoverPercent.toFixed(1)}%`}
                    />
                  )}
                </div>
                <span className={`text-xs font-semibold min-w-[32px] text-right ${
                  totalUtilization !== null && totalUtilization > 95
                    ? 'text-red-600'
                    : totalUtilization !== null && totalUtilization > 85
                      ? 'text-amber-600'
                      : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {totalUtilization?.toFixed(0)}%
                </span>
              </div>
              {/* Legend for changeover */}
              {changeoverPercent > 0 && (
                <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-blue-500" />
                    <span>Prod {productionPercent?.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-amber-500" />
                    <span>C/O {changeoverPercent.toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info section */}
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
            {processProperties?.area && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Area:</span>
                <span>{processProperties.area}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="font-medium">Time:</span>
              <span>{hoursAvailable}h/day</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Efficiency:</span>
              <span className={hasEfficiency ? '' : 'text-gray-400'}>{efficiencyDisplay}</span>
            </div>
            {assignedModelsCount > 0 && (
              <div className="flex items-center gap-1 mt-1 pt-1 border-t border-gray-200 dark:border-gray-700 text-primary-600 dark:text-primary-400">
                <span>Models:</span>
                <span>{assignedModelsCount}</span>
              </div>
            )}
            {hasAllocatedPieces && (
              <>
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <span className="font-medium">Pieces:</span>
                  <span>{totalAllocatedDaily.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  <span className="font-medium">Op Days:</span>
                  <span>{operationsDays}</span>
                </div>
              </>
            )}
          </div>

          {/* Handles */}
          <Handle
            id="top"
            type="source"
            position={Position.Top}
            className={`${isConnectMode ? 'w-3 h-3' : 'w-2 h-2'} ${
              connectionSource?.anchor === 'top' && isConnectionSource
                ? '!bg-green-500'
                : isConnectMode
                ? '!bg-blue-400 hover:!bg-blue-600'
                : '!bg-gray-400 hover:!bg-primary-500'
            } ${isConnectMode ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-all duration-200 !border-2 !border-white shadow-sm`}
          />
          <Handle
            id="bottom"
            type="source"
            position={Position.Bottom}
            className={`${isConnectMode ? 'w-3 h-3' : 'w-2 h-2'} ${
              connectionSource?.anchor === 'bottom' && isConnectionSource
                ? '!bg-green-500'
                : isConnectMode
                ? '!bg-blue-400 hover:!bg-blue-600'
                : '!bg-gray-400 hover:!bg-primary-500'
            } ${isConnectMode ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-all duration-200 !border-2 !border-white shadow-sm`}
          />
          <Handle
            id="left"
            type="source"
            position={Position.Left}
            className={`${isConnectMode ? 'w-3 h-3' : 'w-2 h-2'} ${
              connectionSource?.anchor === 'left' && isConnectionSource
                ? '!bg-green-500'
                : isConnectMode
                ? '!bg-blue-400 hover:!bg-blue-600'
                : '!bg-gray-400 hover:!bg-primary-500'
            } ${isConnectMode ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-all duration-200 !border-2 !border-white shadow-sm`}
          />
          <Handle
            id="right"
            type="source"
            position={Position.Right}
            className={`${isConnectMode ? 'w-3 h-3' : 'w-2 h-2'} ${
              connectionSource?.anchor === 'right' && isConnectionSource
                ? '!bg-green-500'
                : isConnectMode
                ? '!bg-blue-400 hover:!bg-blue-600'
                : '!bg-gray-400 hover:!bg-primary-500'
            } ${isConnectMode ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-all duration-200 !border-2 !border-white shadow-sm`}
          />
        </div>
      );
    }

    // For non-process objects, use the original shape-based layout
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

          {/* Border */}
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

        {/* Name Label */}
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

        {/* Handles */}
        {handles}
      </div>
    );
  },
  // Custom comparison for memo - includes changeover fields for re-render
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
      prevData.linkedLine?.name === nextData.linkedLine?.name &&
      // Phase 7.5+: Changeover fields
      prevData.processProperties?.changeoverEnabled === nextData.processProperties?.changeoverEnabled &&
      prevData.processProperties?.changeoverExplicit === nextData.processProperties?.changeoverExplicit &&
      prevData.processProperties?.timeAvailableDaily === nextData.processProperties?.timeAvailableDaily
    );
  }
);

GenericShapeNode.displayName = 'GenericShapeNode';

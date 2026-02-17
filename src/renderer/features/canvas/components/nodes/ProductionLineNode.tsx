// ============================================
// PRODUCTION LINE NODE
// Nodo visual de una linea de produccion en el canvas
// Phase 5.6: Per-line changeover toggle + stacked bar visualization
// Phase 7.6: DEPRECATED - All nodes now use GenericShapeNode with Zustand selector
// This file is kept for backward compatibility with cached node types
// ============================================

import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Settings2, Timer, TimerOff } from 'lucide-react';
import { useChangeoverStore } from '../../../changeover/store/useChangeoverStore';
import { useAnalysisStore } from '../../../analysis/store/useAnalysisStore';
import { CANVAS_OBJECT_CHANNELS } from '@shared/constants';
import { useCanvasObjectStore } from '../../store/useCanvasObjectStore';
import { useToolStore } from '../../store/useToolStore';
import { CanvasNodeData } from '@shared/types';

// Utilization thresholds for border colors
const UTILIZATION_THRESHOLDS = {
  UNDERUTILIZED: 70,  // Gray below this
  HEALTHY: 85,        // Blue 70-85%
  APPROACHING: 95,    // Amber 85-95%
  // Red above 95%
};

/**
 * Get border color class based on utilization
 */
function getBorderColorClass(utilizationPercent: number | null, selected: boolean): string {
  if (selected) {
    return 'border-primary-500 shadow-lg ring-2 ring-primary-200 dark:ring-primary-800';
  }

  if (utilizationPercent === null) {
    return 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500';
  }

  if (utilizationPercent > UTILIZATION_THRESHOLDS.APPROACHING) {
    return 'border-red-500 hover:border-red-600';
  }
  if (utilizationPercent > UTILIZATION_THRESHOLDS.HEALTHY) {
    return 'border-amber-500 hover:border-amber-600';
  }
  if (utilizationPercent >= UTILIZATION_THRESHOLDS.UNDERUTILIZED) {
    return 'border-blue-500 hover:border-blue-600';
  }
  return 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500';
}

/**
 * ProductionLineNode
 *
 * Phase 7.6: DEPRECATED - This component is kept for backward compatibility only
 * All new nodes use GenericShapeNode with Zustand selector pattern
 */
export const ProductionLineNode = memo<NodeProps<CanvasNodeData>>(
  ({ data, selected, id }) => {
    // Phase 7.6: Retrieve full object data via Zustand selector
    const object = useCanvasObjectStore(
      (state) => state.objects.find((o) => o.id === data.objectId)
    );
    const updateCanvasObject = useCanvasObjectStore((state) => state.updateObject);

    const openChangeoverModal = useChangeoverStore((state) => state.openModal);

    // Get tool state to show handles prominently in connect mode
    const activeTool = useToolStore((state) => state.activeTool);
    const connectionSource = useToolStore((state) => state.connectionSource);
    const isConnectMode = activeTool === 'connect';
    const isConnectionSource = connectionSource?.objectId === id;

    // Get analysis results, displayed year, and global changeover state
    const results = useAnalysisStore((state) => state.results);
    const displayedYearIndex = useAnalysisStore((state) => state.displayedYearIndex);
    const globalChangeoverEnabled = useAnalysisStore((state) => state.globalChangeoverEnabled);

    // Extract process properties early for safe use in callbacks (object may be undefined during deletion)
    const processProperties = object?.processProperties;
    const changeoverEnabled = processProperties?.changeoverEnabled ?? true;
    const changeoverExplicit = processProperties?.changeoverExplicit ?? false;

    // Changeover handlers - MUST be declared before early return (Rules of Hooks)
    const handleChangeoverToggle = useCallback(async (e: React.MouseEvent) => {
      e.stopPropagation();
      const newEnabled = !changeoverEnabled;

      // Optimistically update the UI via objects[] (single source of truth)
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

    // RULES OF HOOKS: Early return AFTER all hooks are called
    if (!object) return null;

    const timeAvailableDaily = processProperties?.timeAvailableDaily ?? 72000;
    const hoursAvailable = (timeAvailableDaily / 3600).toFixed(1);

    // Find this line's result from the analysis (for the currently displayed year)
    const lineResult = results?.yearResults?.[displayedYearIndex]?.lines?.find(l => l.lineId === id);

    // Calculate percentages for stacked bar
    const utilizationPercent = lineResult?.utilizationPercent ?? null;
    const hasChangeover = lineResult?.changeover && lineResult.changeover.timeUsedChangeover > 0;

    // Production time = utilization without changeover
    const productionPercent = utilizationPercent !== null
      ? (hasChangeover
          ? ((lineResult?.timeUsedDaily ?? 0) / timeAvailableDaily) * 100
          : utilizationPercent)
      : null;

    // Changeover time percentage
    const changeoverPercent = hasChangeover
      ? ((lineResult?.changeover?.timeUsedChangeover ?? 0) / timeAvailableDaily) * 100
      : 0;

    // Total utilization including changeover
    const totalUtilization = hasChangeover
      ? lineResult?.changeover?.utilizationWithChangeover ?? utilizationPercent
      : utilizationPercent;

    // Efficiency - not available from processProperties
    const hasEfficiency = false;
    const efficiencyDisplay = '--';

    // Is this line a critical override? (calculating changeover when global is OFF but line is explicitly ON)
    const isCriticalOverride = !globalChangeoverEnabled && changeoverExplicit && changeoverEnabled;

    const handleChangeoverClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      openChangeoverModal(id, object.name);
    };

    // Border color based on utilization
    const borderClass = getBorderColorClass(totalUtilization, selected ?? false);

    return (
      <div
        className={`
          px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-800 shadow-md
          min-w-[220px] transition-all duration-200
          ${borderClass}
          ${isConnectionSource ? 'ring-2 ring-green-500 ring-offset-2' : ''}
          ${isConnectMode && !isConnectionSource ? 'hover:ring-2 hover:ring-blue-300 hover:ring-offset-1' : ''}
        `}
      >
        {/* Header con status */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              totalUtilization !== null
                ? totalUtilization > 95
                  ? 'bg-red-500'
                  : totalUtilization > 85
                    ? 'bg-amber-500'
                    : 'bg-green-500'
                : 'bg-green-500'
            }`} />
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{object.name}</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Per-line changeover toggle */}
            <button
              onClick={handleChangeoverToggle}
              className={`p-1 rounded transition-colors ${
                isCriticalOverride
                  ? 'text-red-500 hover:bg-red-50 ring-1 ring-red-300'  // Critical override
                  : !globalChangeoverEnabled
                    ? 'text-gray-400 hover:bg-gray-100 hover:text-amber-500'  // Global OFF but clickable
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
              {/* Icon shows line's own state (ON/OFF), not effective state */}
              {changeoverEnabled ? (
                <Timer className="w-4 h-4" />
              ) : (
                <TimerOff className="w-4 h-4" />
              )}
            </button>
            {/* Changeover matrix button */}
            <button
              onClick={handleChangeoverClick}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="Edit changeover matrix"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stacked bar visualization - only show after analysis */}
        {utilizationPercent !== null && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
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
              <span className={`text-xs font-semibold min-w-[36px] text-right ${
                totalUtilization !== null && totalUtilization > 95
                  ? 'text-red-600'
                  : totalUtilization !== null && totalUtilization > 85
                    ? 'text-amber-600'
                    : 'text-gray-600'
              }`}>
                {totalUtilization?.toFixed(0)}%
              </span>
            </div>
            {/* Legend for changeover */}
            {changeoverPercent > 0 && (
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
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

        {/* Info secundaria */}
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <div className="flex items-center gap-1">
            <span className="font-medium">Area:</span>
            <span>{processProperties?.area ?? '--'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">Time:</span>
            <span>{hoursAvailable}h/day</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">Efficiency:</span>
            <span className={hasEfficiency ? '' : 'text-gray-400'}>{efficiencyDisplay}</span>
          </div>
          {(object.compatibilitiesCount ?? 0) > 0 && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-primary-600 dark:text-primary-400">
              <span>Models:</span>
              <span>{object.compatibilitiesCount}</span>
            </div>
          )}
        </div>

        {/* Handles para conexiones - using type="source" for all to work with ConnectionMode.Loose */}
        <Handle
          id="top"
          type="source"
          position={Position.Top}
          isConnectable={true}
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
          isConnectable={true}
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
          isConnectable={true}
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
          isConnectable={true}
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
  // Phase 7.6: No custom comparison needed - Zustand's Object.is on selector result handles this
);

ProductionLineNode.displayName = 'ProductionLineNode';

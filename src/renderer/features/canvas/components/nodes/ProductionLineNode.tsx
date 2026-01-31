// ============================================
// PRODUCTION LINE NODE
// Nodo visual de una linea de produccion en el canvas
// Phase 5.6: Per-line changeover toggle + stacked bar visualization
// ============================================

import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Settings2, Timer, TimerOff } from 'lucide-react';
import { useChangeoverStore } from '../../../changeover/store/useChangeoverStore';
import { useAnalysisStore } from '../../../analysis/store/useAnalysisStore';
import { IPC_CHANNELS } from '@shared/constants';
import { useCanvasStore } from '../../store/useCanvasStore';

interface ProductionLineData {
  id: string;
  name: string;
  area: string;
  timeAvailableDaily: number;
  efficiency: number;
  assignedModelsCount?: number;
  changeoverEnabled?: boolean;  // Phase 5.6
  changeoverExplicit?: boolean; // Phase 5.6.1: True if user explicitly set toggle
}

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
    return 'border-primary-500 shadow-lg ring-2 ring-primary-200';
  }

  if (utilizationPercent === null) {
    return 'border-gray-300 hover:border-gray-400';
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
  return 'border-gray-300 hover:border-gray-400';
}

/**
 * ProductionLineNode
 *
 * Nodo visual que representa una linea de produccion
 *
 * Phase 5.6 features:
 * - Per-line changeover toggle icon
 * - Stacked bar visualization (production + changeover + available)
 * - Border color by utilization threshold
 */
export const ProductionLineNode = memo<NodeProps<ProductionLineData>>(
  ({ data, selected }) => {
    const hoursAvailable = (data.timeAvailableDaily / 3600).toFixed(1);
    const openChangeoverModal = useChangeoverStore((state) => state.openModal);
    const updateNode = useCanvasStore((state) => state.updateNode);

    // Get analysis results and global changeover state
    const results = useAnalysisStore((state) => state.results);
    const globalChangeoverEnabled = useAnalysisStore((state) => state.globalChangeoverEnabled);

    // Find this line's result from the analysis
    const lineResult = results?.yearResults?.[0]?.lines?.find(l => l.lineId === data.id);

    // Calculate percentages for stacked bar
    const utilizationPercent = lineResult?.utilizationPercent ?? null;
    const hasChangeover = lineResult?.changeover && lineResult.changeover.timeUsedChangeover > 0;

    // Production time = utilization without changeover
    const productionPercent = utilizationPercent !== null
      ? (hasChangeover
          ? ((lineResult?.timeUsedDaily ?? 0) / data.timeAvailableDaily) * 100
          : utilizationPercent)
      : null;

    // Changeover time percentage
    const changeoverPercent = hasChangeover
      ? ((lineResult?.changeover?.timeUsedChangeover ?? 0) / data.timeAvailableDaily) * 100
      : 0;

    // Total utilization including changeover
    const totalUtilization = hasChangeover
      ? lineResult?.changeover?.utilizationWithChangeover ?? utilizationPercent
      : utilizationPercent;

    // Efficiency (Blended OEE) will be calculated in Phase 4 after optimization
    const hasEfficiency = data.efficiency != null && !isNaN(data.efficiency) && data.efficiency > 0;
    const efficiencyDisplay = hasEfficiency ? `${(data.efficiency * 100).toFixed(0)}%` : '--';

    // Phase 5.6: Changeover toggle state
    const changeoverEnabled = data.changeoverEnabled ?? true;
    // Phase 5.6.1: Explicit override flag (true if user explicitly set the toggle)
    const changeoverExplicit = data.changeoverExplicit ?? false;

    // Is this line a critical override? (calculating changeover when global is OFF but line is explicitly ON)
    const isCriticalOverride = !globalChangeoverEnabled && changeoverExplicit && changeoverEnabled;

    const handleChangeoverClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      openChangeoverModal(data.id, data.name);
    };

    const handleChangeoverToggle = useCallback(async (e: React.MouseEvent) => {
      e.stopPropagation();
      const newEnabled = !changeoverEnabled;

      // Optimistically update the UI - also mark as explicit since user is setting it
      updateNode(data.id, { changeoverEnabled: newEnabled, changeoverExplicit: true });

      // Persist to database (the repository will set explicit=1)
      try {
        await window.electronAPI.invoke(IPC_CHANNELS.LINES_UPDATE_CHANGEOVER_ENABLED, data.id, newEnabled);
      } catch (error) {
        console.error('Failed to update changeover toggle:', error);
        // Revert on error
        updateNode(data.id, { changeoverEnabled, changeoverExplicit });
      }
    }, [changeoverEnabled, changeoverExplicit, data.id, updateNode]);

    // Border color based on utilization
    const borderClass = getBorderColorClass(totalUtilization, selected ?? false);

    return (
      <div
        className={`
          px-4 py-3 rounded-lg border-2 bg-white shadow-md
          min-w-[220px] transition-all duration-200
          ${borderClass}
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
            <span className="font-semibold text-gray-900 text-sm">{data.name}</span>
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
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex">
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
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center gap-1">
            <span className="font-medium">Area:</span>
            <span>{data.area}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">Time:</span>
            <span>{hoursAvailable}h/day</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">Efficiency:</span>
            <span className={hasEfficiency ? '' : 'text-gray-400'}>{efficiencyDisplay}</span>
          </div>
          {data.assignedModelsCount !== undefined && data.assignedModelsCount > 0 && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-200 text-primary-600">
              <span>Models:</span>
              <span>{data.assignedModelsCount}</span>
            </div>
          )}
        </div>

        {/* Handles para conexiones */}
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-gray-400 hover:!bg-primary-500"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-gray-400 hover:!bg-primary-500"
        />
      </div>
    );
  },
  // Custom comparison to ensure re-render when changeover fields change
  (prevProps, nextProps) => {
    // Return true if props are equal (skip re-render), false if different (re-render)
    const prevData = prevProps.data;
    const nextData = nextProps.data;

    return (
      prevProps.selected === nextProps.selected &&
      prevData.id === nextData.id &&
      prevData.name === nextData.name &&
      prevData.area === nextData.area &&
      prevData.timeAvailableDaily === nextData.timeAvailableDaily &&
      prevData.changeoverEnabled === nextData.changeoverEnabled &&
      prevData.changeoverExplicit === nextData.changeoverExplicit &&
      prevData.assignedModelsCount === nextData.assignedModelsCount
    );
  }
);

ProductionLineNode.displayName = 'ProductionLineNode';

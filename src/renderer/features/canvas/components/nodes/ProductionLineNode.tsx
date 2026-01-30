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

    // Effective changeover state (considers global toggle)
    // When global is OFF, changeover is disabled regardless of per-line setting
    const effectiveChangeoverEnabled = globalChangeoverEnabled && changeoverEnabled;

    const handleChangeoverClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      openChangeoverModal(data.id, data.name);
    };

    const handleChangeoverToggle = useCallback(async (e: React.MouseEvent) => {
      e.stopPropagation();
      const newEnabled = !changeoverEnabled;

      // Optimistically update the UI
      updateNode(data.id, { changeoverEnabled: newEnabled });

      // Persist to database
      try {
        await window.electronAPI.invoke(IPC_CHANNELS.LINES_UPDATE_CHANGEOVER_ENABLED, data.id, newEnabled);
      } catch (error) {
        console.error('Failed to update changeover toggle:', error);
        // Revert on error
        updateNode(data.id, { changeoverEnabled });
      }
    }, [changeoverEnabled, data.id, updateNode]);

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
                !globalChangeoverEnabled
                  ? 'text-gray-300 opacity-50 cursor-not-allowed'  // Dimmed when global is OFF
                  : changeoverEnabled
                    ? 'text-amber-500 hover:bg-amber-50'
                    : 'text-gray-300 hover:bg-gray-100'
              }`}
              title={
                !globalChangeoverEnabled
                  ? 'Global changeover is OFF - enable in control bar first'
                  : changeoverEnabled
                    ? 'Changeover enabled - click to exclude this line'
                    : 'Changeover disabled - click to include this line'
              }
              disabled={!globalChangeoverEnabled}  // Disable when global is OFF
            >
              {effectiveChangeoverEnabled ? (
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
  }
);

ProductionLineNode.displayName = 'ProductionLineNode';

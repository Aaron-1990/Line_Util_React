// ============================================
// PRODUCTION LINE NODE
// Nodo visual de una linea de produccion en el canvas
// ============================================

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Settings2 } from 'lucide-react';
import { useChangeoverStore } from '../../../changeover/store/useChangeoverStore';

interface ProductionLineData {
  id: string;
  name: string;
  area: string;
  timeAvailableDaily: number;
  efficiency: number;
  assignedModelsCount?: number;
}

/**
 * ProductionLineNode
 * 
 * Nodo visual que representa una linea de produccion
 * 
 * Principios:
 * - Pure Component: Memo para evitar re-renders innecesarios
 * - Visual Hierarchy: Nombre destacado, detalles secundarios
 * - Interactive: Responde a hover y seleccion
 */
export const ProductionLineNode = memo<NodeProps<ProductionLineData>>(
  ({ data, selected }) => {
    const hoursAvailable = (data.timeAvailableDaily / 3600).toFixed(1);
    const openChangeoverModal = useChangeoverStore((state) => state.openModal);

    // Efficiency (Blended OEE) will be calculated in Phase 4 after optimization
    // For now, show placeholder if not available
    const hasEfficiency = data.efficiency != null && !isNaN(data.efficiency) && data.efficiency > 0;
    const efficiencyDisplay = hasEfficiency ? `${(data.efficiency * 100).toFixed(0)}%` : '--';

    const handleChangeoverClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent node selection
      openChangeoverModal(data.id, data.name);
    };

    return (
      <div
        className={`
          px-4 py-3 rounded-lg border-2 bg-white shadow-md
          min-w-[200px] transition-all duration-200
          ${selected ? 'border-primary-500 shadow-lg ring-2 ring-primary-200' : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        {/* Header con status */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="font-semibold text-gray-900 text-sm">{data.name}</span>
          </div>
          {/* Changeover button */}
          <button
            onClick={handleChangeoverClick}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Edit changeover matrix"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

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
              <span>📦</span>
              <span>{data.assignedModelsCount} models</span>
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

// ============================================
// PRODUCTION LINE NODE
// Nodo visual de una linea de produccion en el canvas
// ============================================

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

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
    const efficiencyPercent = (data.efficiency * 100).toFixed(0);

    return (
      <div
        className={`
          px-4 py-3 rounded-lg border-2 bg-white shadow-md
          min-w-[200px] transition-all duration-200
          ${selected ? 'border-primary-500 shadow-lg ring-2 ring-primary-200' : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        {/* Header con status */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="font-semibold text-gray-900 text-sm">{data.name}</span>
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
            <span className="font-medium">OEE:</span>
            <span>{efficiencyPercent}%</span>
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

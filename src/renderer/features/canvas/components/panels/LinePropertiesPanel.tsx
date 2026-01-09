// ============================================
// LINE PROPERTIES PANEL
// Panel lateral con propiedades de linea seleccionada
// ============================================

import { X } from 'lucide-react';
import { useCanvasStore } from '../../store/useCanvasStore';

/**
 * LinePropertiesPanel
 * 
 * Panel lateral que muestra informacion de la linea seleccionada
 * 
 * Principios:
 * - Conditional Rendering: Solo visible si hay seleccion
 * - Read-only: Version inicial solo muestra info
 * - Slide animation: Entrada/salida suave
 */
export const LinePropertiesPanel = () => {
  const { nodes, selectedNode, setSelectedNode } = useCanvasStore((state) => ({
    nodes: state.nodes,
    selectedNode: state.selectedNode,
    setSelectedNode: state.setSelectedNode,
  }));

  if (!selectedNode) return null;

  const node = nodes.find((n) => n.id === selectedNode);
  if (!node) return null;

  const data = node.data;
  const hoursAvailable = (data.timeAvailableDaily / 3600).toFixed(1);
  const efficiencyPercent = (data.efficiency * 100).toFixed(0);

  const handleClose = () => {
    setSelectedNode(null);
  };

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg z-20 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Line Properties</h2>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Cerrar"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Name
          </label>
          <p className="mt-1 text-sm text-gray-900 font-medium">{data.name}</p>
        </div>

        {/* Area */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Area
          </label>
          <p className="mt-1 text-sm text-gray-900">{data.area}</p>
        </div>

        {/* Time Available */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Time Available
          </label>
          <p className="mt-1 text-sm text-gray-900">
            {hoursAvailable} hours/day
            <span className="text-xs text-gray-500 ml-1">
              ({data.timeAvailableDaily} seconds)
            </span>
          </p>
        </div>

        {/* Efficiency */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Efficiency (OEE)
          </label>
          <p className="mt-1 text-sm text-gray-900">{efficiencyPercent}%</p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all"
              style={{ width: `${efficiencyPercent}%` }}
            />
          </div>
        </div>

        {/* Assigned Models */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Assigned Models
          </label>
          <p className="mt-1 text-sm text-gray-900">
            {data.assignedModelsCount || 0} models
          </p>
        </div>

        {/* Status */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Status
          </label>
          <div className="mt-1 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-900">Active</span>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-gray-200 space-y-2">
          <button className="w-full btn-primary py-2">Edit Line</button>
          <button className="w-full btn bg-gray-200 text-gray-700 hover:bg-gray-300 py-2">
            Assign Models
          </button>
        </div>
      </div>
    </div>
  );
};

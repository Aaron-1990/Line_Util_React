// ============================================
// ADD LINE MODAL
// Modal para crear nueva linea de produccion
// ============================================

import { X } from 'lucide-react';
import { useState } from 'react';
import { LineForm } from '../forms/LineForm';
import { useCanvasStore } from '../../store/useCanvasStore';

interface AddLineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddLineModal = ({ isOpen, onClose }: AddLineModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { nodes, addNode } = useCanvasStore((state) => ({
    nodes: state.nodes,
    addNode: state.addNode,
  }));

  if (!isOpen) return null;

  const calculateInitialPosition = (): { x: number; y: number } => {
    if (nodes.length === 0) {
      return { x: 100, y: 100 };
    }

    // Encontrar el nodo mas a la derecha y abajo
    let maxX = 0;
    let maxY = 0;

    nodes.forEach((node) => {
      if (node.position.x > maxX) maxX = node.position.x;
      if (node.position.y > maxY) maxY = node.position.y;
    });

    // Offset pequeño con variacion aleatoria para evitar superposicion exacta
    const offsetX = 50 + Math.random() * 50;
    const offsetY = 50 + Math.random() * 50;

    // Si hay espacio a la derecha, colocar ahi
    if (maxX < 1000) {
      return { x: maxX + 250, y: Math.max(100, maxY - 100) };
    }

    // Si no, colocar debajo
    return { x: 100 + offsetX, y: maxY + 200 + offsetY };
  };

  const handleSubmit = async (data: {
    name: string;
    area: string;
    timeAvailableDaily: number;
    efficiency: number;
  }) => {
    setIsLoading(true);

    try {
      const response = await window.electronAPI.invoke('lines:create', data);

      if (response.success && response.data) {
        const position = calculateInitialPosition();

        addNode({
          id: response.data.id,
          type: 'productionLine',
          position,
          data: {
            id: response.data.id,
            name: response.data.name,
            area: response.data.area,
            timeAvailableDaily: response.data.timeAvailableDaily,
            efficiency: response.data.efficiency,
            assignedModelsCount: 0,
          },
        });

        onClose();
      } else {
        alert(`Error: ${response.error || 'Failed to create line'}`);
      }
    } catch (error) {
      console.error('Error creating line:', error);
      alert('Failed to create line. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Add Production Line</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <LineForm
          onSubmit={handleSubmit}
          onCancel={onClose}
          submitLabel="Create Line"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

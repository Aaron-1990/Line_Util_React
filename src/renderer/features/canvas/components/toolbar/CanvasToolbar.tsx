// ============================================
// CANVAS TOOLBAR
// Barra de herramientas superior del canvas
// ============================================

import { Plus, ZoomIn, ZoomOut, Maximize2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { AddLineModal } from '../modals/AddLineModal';

export const CanvasToolbar = () => {
  const reset = useCanvasStore((state) => state.reset);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleAddLine = () => {
    setIsAddModalOpen(true);
  };

  const handleZoomIn = () => {
    console.log('Zoom in clicked');
  };

  const handleZoomOut = () => {
    console.log('Zoom out clicked');
  };

  const handleFitView = () => {
    console.log('Fit view clicked');
  };

  const handleClear = () => {
    if (confirm('Limpiar todo el canvas? Esta accion no se puede deshacer.')) {
      reset();
    }
  };

  return (
    <>
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-md border border-gray-200 p-2 flex items-center gap-2">
        <button
          onClick={handleAddLine}
          className="p-2 hover:bg-primary-50 rounded transition-colors"
          title="Agregar linea de produccion"
        >
          <Plus className="w-5 h-5 text-gray-700" />
        </button>

        <div className="w-px h-6 bg-gray-300" />

        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-5 h-5 text-gray-700" />
        </button>

        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-5 h-5 text-gray-700" />
        </button>

        <button
          onClick={handleFitView}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Ajustar vista"
        >
          <Maximize2 className="w-5 h-5 text-gray-700" />
        </button>

        <div className="w-px h-6 bg-gray-300" />

        <button
          onClick={handleClear}
          className="p-2 hover:bg-red-50 rounded transition-colors"
          title="Limpiar canvas"
        >
          <Trash2 className="w-5 h-5 text-red-600" />
        </button>
      </div>

      <AddLineModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </>
  );
};

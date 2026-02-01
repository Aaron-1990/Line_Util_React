// ============================================
// CANVAS TOOLBAR
// Barra de herramientas superior del canvas
// ============================================

import { Plus, ZoomIn, ZoomOut, Maximize2, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanvasStore } from '../../store/useCanvasStore';
import { AddLineModal } from '../modals/AddLineModal';

export const CanvasToolbar = () => {
  const reset = useCanvasStore((state) => state.reset);
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleAddLine = () => {
    setIsAddModalOpen(true);
  };

  const handleImport = () => {
    navigate('/excel/import');
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
      <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-2 flex items-center gap-2">
        <button
          onClick={handleAddLine}
          className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
          title="Agregar linea de produccion"
        >
          <Plus className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>

        <button
          onClick={handleImport}
          className="p-2 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
          title="Importar desde Excel"
        >
          <Upload className="w-5 h-5 text-green-600 dark:text-green-500" />
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>

        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>

        <button
          onClick={handleFitView}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Ajustar vista"
        >
          <Maximize2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />

        <button
          onClick={handleClear}
          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
          title="Limpiar canvas"
        >
          <Trash2 className="w-5 h-5 text-red-600 dark:text-red-500" />
        </button>
      </div>

      <AddLineModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </>
  );
};

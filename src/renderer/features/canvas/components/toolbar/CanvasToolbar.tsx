// ============================================
// CANVAS TOOLBAR
// Barra de herramientas superior del canvas
// ============================================

import { Plus, ZoomIn, ZoomOut, Maximize2, Trash2, Upload, Map } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useReactFlow } from 'reactflow';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useToolStore } from '../../store/useToolStore';
import { PRODUCTION_LINE_SHAPE_ID } from '../../constants/shapes';
import { isPlaceTool } from '@shared/types/canvas-tool';

interface CanvasToolbarProps {
  showMiniMap: boolean;
  onToggleMiniMap: () => void;
}

export const CanvasToolbar = ({ showMiniMap, onToggleMiniMap }: CanvasToolbarProps) => {
  const reset = useCanvasStore((state) => state.reset);
  const navigate = useNavigate();
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  // Tool store for place tool activation
  const setPlaceTool = useToolStore((state) => state.setPlaceTool);
  const activeTool = useToolStore((state) => state.activeTool);

  // Check if currently placing a production line
  const isPlacing = isPlaceTool(activeTool) && activeTool.shapeId === PRODUCTION_LINE_SHAPE_ID;

  const handleImport = () => {
    navigate('/excel/import');
  };

  const handleZoomIn = () => {
    zoomIn({ duration: 200 });
  };

  const handleZoomOut = () => {
    zoomOut({ duration: 200 });
  };

  const handleFitView = () => {
    fitView({
      padding: 0.1,
      duration: 300,
      includeHiddenNodes: true,
      minZoom: 0.001, // Allow zooming out as far as needed
      maxZoom: 1.5,
    });
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
          onClick={() => setPlaceTool(PRODUCTION_LINE_SHAPE_ID)}
          className={`p-2 rounded transition-colors ${
            isPlacing
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
              : 'text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/30'
          }`}
          title="Add Line Manually - Click canvas to place"
        >
          <Plus className="w-5 h-5" />
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

        <button
          onClick={onToggleMiniMap}
          className={`p-2 rounded transition-colors ${
            showMiniMap
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title={showMiniMap ? 'Hide MiniMap' : 'Show MiniMap'}
        >
          <Map className="w-5 h-5" />
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
    </>
  );
};

// ============================================
// OBJECT PALETTE
// Left-side toolbar for tools and shapes
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

import { memo, useEffect, useCallback, useState } from 'react';
import {
  MousePointer2,
  Hand,
  GitBranch,
  Plus,
  Square,
  Triangle,
  Circle,
  Diamond
} from 'lucide-react';
import { useToolStore } from '../../store/useToolStore';
import { useShapeCatalogStore } from '../../store/useShapeCatalogStore';
import { isPlaceTool } from '@shared/types';
import { ShapeBrowserModal } from '../modals/ShapeBrowserModal';

/**
 * ObjectPalette
 *
 * Vertical toolbar on the left side of the canvas with:
 * - Tool selection (Select, Pan, Connect)
 * - Basic shape buttons for quick placement
 * - "More" button to open full shape browser
 */
export const ObjectPalette = memo(() => {
  const {
    activeTool,
    setSelectTool,
    setPanTool,
    setConnectTool,
    setPlaceTool
  } = useToolStore();

  const { shapes, loadCatalog } = useShapeCatalogStore();

  // State for ShapeBrowserModal
  const [isShapeBrowserOpen, setIsShapeBrowserOpen] = useState(false);

  // Load catalog on mount
  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Get basic shapes for quick access
  const basicShapes = shapes.filter(s => s.categoryId === 'basic');

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or modal is open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        isShapeBrowserOpen
      ) {
        return;
      }

      // Don't activate tool shortcuts if Ctrl/Cmd is pressed (reserved for copy/paste)
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setSelectTool();
          break;
        case 'h':
          setPanTool();
          break;
        case 'c':
          setConnectTool();
          break;
        case 'escape':
          setSelectTool();
          break;
        case 'm':
          // Open shape catalog (M for More)
          setIsShapeBrowserOpen(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectTool, setPanTool, setConnectTool, isShapeBrowserOpen]);

  const handleShapeClick = useCallback((shapeId: string) => {
    setPlaceTool(shapeId);
  }, [setPlaceTool]);

  // Check if a tool is active
  const isToolActive = (tool: string) => {
    if (tool === 'place') {
      return isPlaceTool(activeTool);
    }
    return activeTool === tool;
  };

  // Check if a shape is currently selected for placement
  const isShapeActive = (shapeId: string) => {
    return isPlaceTool(activeTool) && activeTool.shapeId === shapeId;
  };

  // Get icon for primitive type
  const getPrimitiveIcon = (primitiveType?: string) => {
    switch (primitiveType) {
      case 'rectangle':
        return <Square className="w-5 h-5" />;
      case 'triangle':
        return <Triangle className="w-5 h-5" />;
      case 'circle':
        return <Circle className="w-5 h-5" />;
      case 'diamond':
        return <Diamond className="w-5 h-5" />;
      default:
        return <Square className="w-5 h-5" />;
    }
  };

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex flex-col gap-1">
        {/* Tools Section */}
        <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 py-1">
          Tools
        </div>

        {/* Select Tool */}
        <button
          onClick={setSelectTool}
          className={`p-2 rounded-md transition-colors flex items-center gap-2 ${
            isToolActive('select')
              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
          title="Select (V)"
        >
          <MousePointer2 className="w-5 h-5" />
        </button>

        {/* Pan Tool */}
        <button
          onClick={setPanTool}
          className={`p-2 rounded-md transition-colors flex items-center gap-2 ${
            isToolActive('pan')
              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
          title="Pan (H)"
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* Connect Tool */}
        <button
          onClick={setConnectTool}
          className={`p-2 rounded-md transition-colors flex items-center gap-2 ${
            isToolActive('connect')
              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
          title="Connect (C)"
        >
          <GitBranch className="w-5 h-5" />
        </button>

        {/* Divider */}
        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

        {/* Shapes Section */}
        <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 py-1">
          Shapes
        </div>

        {/* Basic Shapes */}
        {basicShapes.map((shape) => (
          <button
            key={shape.id}
            onClick={() => handleShapeClick(shape.id)}
            className={`p-2 rounded-md transition-colors flex items-center gap-2 ${
              isShapeActive(shape.id)
                ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
            title={shape.name}
          >
            {getPrimitiveIcon(shape.primitiveType)}
          </button>
        ))}

        {/* Divider */}
        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

        {/* More Shapes Button */}
        <button
          onClick={() => setIsShapeBrowserOpen(true)}
          className="p-2 rounded-md transition-colors flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          title="More shapes (M)"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Shape Browser Modal */}
      <ShapeBrowserModal
        isOpen={isShapeBrowserOpen}
        onClose={() => setIsShapeBrowserOpen(false)}
      />
    </div>
  );
});

ObjectPalette.displayName = 'ObjectPalette';

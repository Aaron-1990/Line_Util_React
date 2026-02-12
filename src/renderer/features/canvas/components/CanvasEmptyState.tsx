// ============================================
// CANVAS EMPTY STATE
// Shown when current plant has no production lines
// Phase 7: Plant-scoped empty state with call-to-action
// ============================================

import { Factory, FileSpreadsheet, Plus } from 'lucide-react';
import { usePlantStore } from '../../plants/store/usePlantStore';
import { useNavigationStore } from '../../../store/useNavigationStore';
import { useToolStore } from '@renderer/features/canvas/store/useToolStore';
import { PRODUCTION_LINE_SHAPE_ID } from '@renderer/features/canvas/constants/shapes';

interface CanvasEmptyStateProps {
  onImportClick?: () => void;
}

export const CanvasEmptyState = ({ onImportClick }: CanvasEmptyStateProps) => {
  const plants = usePlantStore((state) => state.plants);
  const currentPlantId = useNavigationStore((state) => state.currentPlantId);
  const setView = useNavigationStore((state) => state.setView);
  const setPlaceTool = useToolStore((state) => state.setPlaceTool);

  // Find current plant from the plants array
  const currentPlant = currentPlantId ? plants.find(p => p.id === currentPlantId) : undefined;
  const plantName = currentPlant?.name || currentPlant?.code || 'this plant';

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md text-center px-6">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
          <Factory className="w-10 h-10 text-gray-400 dark:text-gray-500" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No Production Lines
        </h2>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          <span className="font-medium text-gray-700 dark:text-gray-300">{plantName}</span> doesn't have any production lines yet.
          Get started by importing data from Excel or adding lines manually.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/* Primary: Import from Excel */}
          <button
            onClick={() => {
              setView('canvas');
              // Trigger import wizard
              if (onImportClick) {
                onImportClick();
              }
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Import from Excel
          </button>

          {/* Secondary: Add Line Manually */}
          <button
            onClick={() => setPlaceTool(PRODUCTION_LINE_SHAPE_ID)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium border border-gray-300 dark:border-gray-600"
          >
            <Plus className="w-5 h-5" />
            Add Line Manually
          </button>
        </div>

        {/* Help Text */}
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-500">
          Lines added here will be associated with {plantName}.
        </p>
      </div>
    </div>
  );
};

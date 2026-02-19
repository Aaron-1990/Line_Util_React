// ============================================
// AREA LIST COMPONENT
// List of manufacturing areas with actions
// Phase 6D: Custom Areas
// ============================================

import { Edit2, Trash2 } from 'lucide-react';
import { useAreaStore } from '../store/useAreaStore';

export const AreaList = () => {
  const { getSortedAreas, openForm, openDeleteConfirm, isLoading } = useAreaStore();

  const areas = getSortedAreas();

  // For now, we'll assume 0 lines in use until backend implements the check
  // Backend should return line count when deleting or we query separately
  const getLinesInUse = (_areaId: string): number => {
    // TODO: Implement actual line count check via IPC
    return 0;
  };

  if (isLoading && areas.length === 0) {
    return (
      <div className="w-full flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500 dark:text-gray-400">Loading areas...</div>
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <div className="w-full flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">No areas defined yet</p>
          <p className="text-base text-gray-400 dark:text-gray-500">
            Click "Add Area" to create your first manufacturing area
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl px-6 py-6 space-y-2">
      {areas.map(area => (
        <div
          key={area.id}
          className="group flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-4 flex-1">
            {/* Color Swatch */}
            <div
              className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 flex-shrink-0 shadow-sm"
              style={{ backgroundColor: area.color }}
              title={area.color}
            />

            {/* Code and Name */}
            <div className="flex items-baseline gap-3">
              <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                {area.code}
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                {area.name}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => openForm(area)}
              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
              title="Edit area"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => openDeleteConfirm(area, getLinesInUse(area.id))}
              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Delete area"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

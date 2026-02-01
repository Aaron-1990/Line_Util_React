// ============================================
// AREAS PAGE
// Area catalog management view
// Phase 6D: Custom Areas
// ============================================

import { useEffect } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { useAreaStore, AreaForm, AreaList, DeleteConfirmModal } from '@renderer/features/areas';

export const AreasPage = () => {
  const { loadAreas, openForm, error, isLoading } = useAreaStore();

  // Load areas on mount
  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors duration-150">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Manufacturing Areas
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Define the manufacturing areas/process steps in your facility.
              Areas are used to group production lines and organize the canvas.
            </p>
          </div>
          <button
            onClick={() => openForm()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            <Plus className="w-4 h-4" />
            Add Area
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">Error</p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-4xl">
          <AreaList />
        </div>
      </div>

      {/* Modals */}
      <AreaForm />
      <DeleteConfirmModal />
    </div>
  );
};

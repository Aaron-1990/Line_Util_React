// ============================================
// PLANTS PAGE
// Plant management view with CRUD operations
// Phase 7: Multi-Plant Support
// ============================================

import { useEffect } from 'react';
import { Plus, AlertCircle, Factory } from 'lucide-react';
import { usePlantStore } from '@renderer/features/plants';
import { PlantList } from '@renderer/features/plants/components/PlantList';
import { PlantForm } from '@renderer/features/plants/components/PlantForm';
import { DeletePlantModal } from '@renderer/features/plants/components/DeletePlantModal';

export const PlantsPage = () => {
  const { loadPlants, openForm, error, isLoading, plants } = usePlantStore();

  // Load plants on mount
  useEffect(() => {
    loadPlants();
  }, [loadPlants]);

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors duration-150">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Factory className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Plants
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage your manufacturing plants. Each plant has its own lines, volumes, and routings.
              </p>
            </div>
          </div>
          <button
            onClick={() => openForm()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            <Plus className="w-4 h-4" />
            Add Plant
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

        {/* Summary Stats */}
        <div className="mt-4 flex gap-6 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Total Plants:</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{plants.length}</span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Active:</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
              {plants.filter(p => p.isActive).length}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-6xl">
          <PlantList />
        </div>
      </div>

      {/* Modals */}
      <PlantForm />
      <DeletePlantModal />
    </div>
  );
};

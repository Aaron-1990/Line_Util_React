// ============================================
// DELETE PLANT MODAL
// Confirmation modal for deleting plants
// Phase 7: Multi-Plant Support
// ============================================

import { AlertTriangle, X } from 'lucide-react';
import { usePlantStore } from '../store/usePlantStore';

export const DeletePlantModal = () => {
  const { deleteConfirm, closeDeleteConfirm, deletePlant, isLoading, defaultPlantId } = usePlantStore();
  const { isOpen, plant, linesInPlant } = deleteConfirm;

  if (!isOpen || !plant) return null;

  const isDefault = plant.id === defaultPlantId;
  const hasLines = linesInPlant > 0;

  const handleDelete = async () => {
    await deletePlant(plant.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeDeleteConfirm}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Delete Plant
            </h2>
          </div>
          <button
            onClick={closeDeleteConfirm}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {isDefault ? (
            <div className="text-center py-4">
              <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
              <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">
                Cannot delete the default plant
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Set another plant as default before deleting "{plant.name}".
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-900 dark:text-gray-100 mb-4">
                Are you sure you want to delete <strong>{plant.name}</strong> ({plant.code})?
              </p>

              {hasLines && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Warning:</strong> This plant has {linesInPlant} production line{linesInPlant !== 1 ? 's' : ''}.
                    Deleting the plant will also delete all associated data.
                  </p>
                </div>
              )}

              <p className="text-sm text-gray-600 dark:text-gray-400">
                This action cannot be undone. All lines, volumes, routings, and compatibilities
                associated with this plant will be permanently deleted.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={closeDeleteConfirm}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          {!isDefault && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Deleting...' : 'Delete Plant'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

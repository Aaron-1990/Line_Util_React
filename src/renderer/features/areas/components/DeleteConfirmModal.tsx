// ============================================
// DELETE CONFIRM MODAL
// Confirmation dialog for deleting areas
// Phase 6D: Custom Areas
// ============================================

import { AlertTriangle, X } from 'lucide-react';
import { useAreaStore } from '../store/useAreaStore';

export const DeleteConfirmModal = () => {
  const { deleteConfirm, isLoading, closeDeleteConfirm, deleteArea } = useAreaStore();

  if (!deleteConfirm.isOpen || !deleteConfirm.area) return null;

  const { area, linesInUse } = deleteConfirm;

  const handleConfirm = async () => {
    await deleteArea(area.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !isLoading && closeDeleteConfirm()}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Delete Area
            </h2>
          </div>
          <button
            onClick={closeDeleteConfirm}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {linesInUse > 0 ? (
            <>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                This area is currently used by{' '}
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {linesInUse} production {linesInUse === 1 ? 'line' : 'lines'}
                </span>
                .
              </p>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Warning: Deleting this area will affect these lines. Are you sure you want to continue?
                </p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Area: <span className="font-mono font-semibold">{area.code}</span> - {area.name}
              </p>
            </>
          ) : (
            <>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Are you sure you want to delete this area?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Area: <span className="font-mono font-semibold">{area.code}</span> - {area.name}
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
          <button
            type="button"
            onClick={closeDeleteConfirm}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Area'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// CONFIRM DELETE MODAL
// Modal de confirmacion para eliminar lineas
// ============================================

import { AlertTriangle } from 'lucide-react';

interface ConfirmDeleteModalProps {
  lineName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const ConfirmDeleteModal = ({
  lineName,
  onConfirm,
  onCancel,
  isDeleting = false,
}: ConfirmDeleteModalProps) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-200">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Delete Production Line</h2>
            <p className="text-sm text-gray-500">This action cannot be undone</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{lineName}</span>?
          </p>
          <p className="mt-2 text-sm text-gray-600">
            This line will be marked as inactive and removed from the canvas.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 bg-gray-50 rounded-b-lg">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-white transition-colors"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Line'}
          </button>
        </div>
      </div>
    </div>
  );
};

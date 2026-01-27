// ============================================
// CHANGEOVER MATRIX MODAL
// Modal for editing changeover times between models
// Phase 5.2: UI Components
// ============================================

import { X, Save, RotateCcw, AlertTriangle, Clock, Layers } from 'lucide-react';
import { useChangeoverStore } from '../store/useChangeoverStore';
import { MatrixTable } from './MatrixTable';
import { FamilyMatrixView } from './FamilyMatrixView';

export const ChangeoverMatrixModal = () => {
  const {
    isModalOpen,
    selectedLineName,
    matrix,
    viewMode,
    globalDefault,
    smedBenchmark,
    isLoading,
    isSaving,
    error,
    hasUnsavedChanges,
    closeModal,
    setViewMode,
    saveChanges,
    discardChanges,
    resetToFamilyDefaults,
  } = useChangeoverStore();

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!isSaving) closeModal();
        }}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Changeover Matrix
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {selectedLineName || 'Loading...'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Unsaved indicator */}
            {hasUnsavedChanges && (
              <span className="flex items-center gap-1 text-amber-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Unsaved changes
              </span>
            )}

            {/* Close button */}
            <button
              onClick={closeModal}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              disabled={isSaving}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">View:</span>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setViewMode('family')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'family'
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Layers className="w-4 h-4 inline mr-1" />
                By Family
              </button>
              <button
                onClick={() => setViewMode('model')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'model'
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Clock className="w-4 h-4 inline mr-1" />
                By Model
              </button>
            </div>
          </div>

          {/* Stats */}
          {matrix && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">
                <span className="font-medium">{matrix.models.length}</span> models
              </span>
              <span className="text-gray-600">
                <span className="font-medium">{matrix.families.length}</span> families
              </span>
              {matrix.stats.exceedsBenchmarkCount > 0 && (
                <span className="text-amber-600">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  {matrix.stats.exceedsBenchmarkCount} exceed SMED ({smedBenchmark} min)
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={resetToFamilyDefaults}
              className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isSaving || isLoading}
              title="Reset all overrides to family defaults"
            >
              <RotateCcw className="w-4 h-4 inline mr-1" />
              Reset
            </button>

            {hasUnsavedChanges && (
              <>
                <button
                  onClick={discardChanges}
                  className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={isSaving}
                >
                  Discard
                </button>
                <button
                  onClick={saveChanges}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50"
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4 inline mr-1" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto" />
                <p className="mt-2 text-sm text-gray-500">Loading matrix...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
                <p className="mt-2 text-red-600">{error}</p>
              </div>
            </div>
          ) : matrix ? (
            viewMode === 'family' ? (
              <FamilyMatrixView />
            ) : (
              <MatrixTable />
            )
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">No data available</p>
            </div>
          )}
        </div>

        {/* Footer with Legend */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-gray-100 border border-gray-300 rounded" />
                Global Default ({globalDefault} min)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-blue-100 border border-blue-300 rounded" />
                Family Default
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-green-100 border border-green-300 rounded" />
                Line Override
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-amber-100 border border-amber-300 rounded" />
                Exceeds SMED ({smedBenchmark} min)
              </span>
            </div>

            <div className="text-xs text-gray-400">
              Click cell to edit • Tab to navigate • Enter to confirm
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

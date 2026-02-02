// ============================================
// MULTI-SHEET PROGRESS TRACKER
// Shows import progress and results for multi-sheet import
// ============================================

import { CheckCircle2, XCircle, Loader2, Clock, ArrowRight } from 'lucide-react';
import { MultiSheetImportResult } from '@shared/types';

interface MultiSheetProgressTrackerProps {
  isImporting: boolean;
  importResult: MultiSheetImportResult | null;
  onFinish: () => void;
  onImportMore?: () => void;
}

export const MultiSheetProgressTracker = ({
  isImporting,
  importResult,
  onFinish,
  onImportMore,
}: MultiSheetProgressTrackerProps) => {
  // Loading state
  if (isImporting) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900">Importing Data...</h3>
          <p className="text-sm text-gray-600 mt-1">
            Please wait while we import your data
          </p>
        </div>
      </div>
    );
  }

  // Results state
  if (importResult) {
    const totalCreated =
      (importResult.plants?.created || 0) +  // Phase 7.3
      (importResult.areas?.created || 0) +
      (importResult.lines?.created || 0) +
      (importResult.models?.created || 0) +
      (importResult.compatibilities?.created || 0) +
      (importResult.volumes?.created || 0);

    const totalUpdated =
      (importResult.plants?.updated || 0) +  // Phase 7.3
      (importResult.areas?.updated || 0) +
      (importResult.lines?.updated || 0) +
      (importResult.models?.updated || 0) +
      (importResult.compatibilities?.updated || 0) +
      (importResult.volumes?.updated || 0);

    const totalErrors =
      (importResult.plants?.errors || 0) +  // Phase 7.3
      (importResult.areas?.errors || 0) +
      (importResult.lines?.errors || 0) +
      (importResult.models?.errors || 0) +
      (importResult.compatibilities?.errors || 0) +
      (importResult.volumes?.errors || 0);

    const isSuccess = importResult.success && totalErrors === 0;

    return (
      <div className="space-y-6">
        {/* Success/Error Header */}
        <div
          className={`rounded-lg p-6 text-center ${
            isSuccess ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
          }`}
        >
          {isSuccess ? (
            <>
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold text-green-800 mt-4">
                Import Successful!
              </h2>
              <p className="text-sm text-green-700 mt-1">
                Your data has been imported successfully
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-16 h-16 text-yellow-500 mx-auto" />
              <h2 className="text-2xl font-bold text-yellow-800 mt-4">
                Import Completed with Warnings
              </h2>
              <p className="text-sm text-yellow-700 mt-1">
                Some records could not be imported
              </p>
            </>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{totalCreated}</div>
            <div className="text-sm text-green-700">Created</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{totalUpdated}</div>
            <div className="text-sm text-blue-700">Updated</div>
          </div>
          <div className={`rounded-lg p-4 text-center ${totalErrors > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <div className={`text-3xl font-bold ${totalErrors > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {totalErrors}
            </div>
            <div className={`text-sm ${totalErrors > 0 ? 'text-red-700' : 'text-gray-500'}`}>
              Errors
            </div>
          </div>
        </div>

        {/* Per-Sheet Details */}
        <div className="space-y-3">
          {/* Phase 7.3: Plants created */}
          {importResult.plants && importResult.plants.created > 0 && (
            <SheetResultRow
              icon="🏢"
              title="Plants (Auto-Created)"
              created={importResult.plants.created}
              updated={importResult.plants.updated}
              errors={importResult.plants.errors}
            />
          )}
          {importResult.areas && (
            <SheetResultRow
              icon="🏷️"
              title="Process Areas (Flow Order)"
              created={importResult.areas.created}
              updated={importResult.areas.updated}
              errors={importResult.areas.errors}
            />
          )}
          {importResult.lines && (
            <SheetResultRow
              icon="🏭"
              title="Production Lines"
              created={importResult.lines.created}
              updated={importResult.lines.updated}
              errors={importResult.lines.errors}
            />
          )}
          {importResult.models && (
            <SheetResultRow
              icon="📦"
              title="Product Models"
              created={importResult.models.created}
              updated={importResult.models.updated}
              errors={importResult.models.errors}
            />
          )}
          {importResult.compatibilities && (
            <SheetResultRow
              icon="🔗"
              title="Compatibilities"
              created={importResult.compatibilities.created}
              updated={importResult.compatibilities.updated}
              errors={importResult.compatibilities.errors}
            />
          )}
          {importResult.volumes && (
            <SheetResultRow
              icon="📊"
              title={`Volumes${importResult.volumes.yearRange ? ` (${importResult.volumes.yearRange.min}-${importResult.volumes.yearRange.max})` : ''}`}
              created={importResult.volumes.created}
              updated={importResult.volumes.updated}
              errors={importResult.volumes.errors}
            />
          )}
        </div>

        {/* Timing */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Completed in {importResult.totalTime}ms</span>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t border-gray-200">
          {onImportMore && (
            <button
              onClick={onImportMore}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Import Another File
            </button>
          )}
          <button
            onClick={onFinish}
            className="btn-primary px-6 py-2 flex items-center gap-2 ml-auto"
          >
            Done
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
};

// Helper component for sheet result row
const SheetResultRow = ({
  icon,
  title,
  created,
  updated,
  errors,
}: {
  icon: string;
  title: string;
  created: number;
  updated: number;
  errors: number;
}) => {
  const hasErrors = errors > 0;

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border ${
        hasErrors ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <span className="font-medium text-gray-900">{title}</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {created > 0 && (
          <span className="text-green-700">
            <strong>{created}</strong> created
          </span>
        )}
        {updated > 0 && (
          <span className="text-blue-700">
            <strong>{updated}</strong> updated
          </span>
        )}
        {errors > 0 && (
          <span className="text-red-700">
            <strong>{errors}</strong> errors
          </span>
        )}
        {created === 0 && updated === 0 && errors === 0 && (
          <span className="text-gray-500">No changes</span>
        )}
        {hasErrors ? (
          <XCircle className="w-5 h-5 text-red-500" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        )}
      </div>
    </div>
  );
};

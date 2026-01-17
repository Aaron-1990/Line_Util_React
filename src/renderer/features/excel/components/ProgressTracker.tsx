// ============================================
// PROGRESS TRACKER
// Muestra progreso durante importacion
// ============================================

import { CheckCircle, Loader2, AlertTriangle } from 'lucide-react';

interface ImportResult {
  imported: string[];
  updated: string[];
  skipped: string[];
  errors: Array<{ row: number; name: string; error: string }>;
}

interface ProgressTrackerProps {
  isImporting: boolean;
  importResult: ImportResult | null;
  onFinish: () => void;
}

export const ProgressTracker = ({
  isImporting,
  importResult,
  onFinish,
}: ProgressTrackerProps) => {
  const isComplete = !isImporting && importResult !== null;
  const hasErrors = importResult?.errors && importResult.errors.length > 0;
  const hasSkipped = importResult?.skipped && importResult.skipped.length > 0;
  const importedCount = importResult?.imported?.length || 0;
  const updatedCount = importResult?.updated?.length || 0;
  const skippedCount = importResult?.skipped?.length || 0;
  const errorCount = importResult?.errors?.length || 0;

  const totalProcessed = importedCount + updatedCount;
  const isSuccess = isComplete && totalProcessed > 0 && !hasErrors;
  const isPartialSuccess = isComplete && totalProcessed > 0 && (hasErrors || hasSkipped);
  const isFailure = isComplete && totalProcessed === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {isImporting ? 'Importing...' : 'Import Complete'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {isImporting
            ? 'Please wait while we import your data'
            : 'Review the import results'}
        </p>
      </div>

      {/* Progress Animation */}
      {isImporting && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin mb-4" />
          <p className="text-lg font-medium text-gray-900">Importing lines...</p>
          <p className="text-sm text-gray-600 mt-2">
            This may take a few moments depending on file size
          </p>
        </div>
      )}

      {/* Success State */}
      {isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-green-900 mb-2">
            Import Successful!
          </h3>
          <p className="text-green-800">
            {importedCount > 0 && updatedCount > 0 && (
              <>Created {importedCount} and updated {updatedCount} production lines</>
            )}
            {importedCount > 0 && updatedCount === 0 && (
              <>Successfully imported {importedCount} production line{importedCount !== 1 ? 's' : ''}</>
            )}
            {importedCount === 0 && updatedCount > 0 && (
              <>Successfully updated {updatedCount} production line{updatedCount !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>
      )}

      {/* Partial Success State */}
      {isPartialSuccess && (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-yellow-900 mb-2">
              Import Completed with Warnings
            </h3>
            <p className="text-yellow-800">
              {importedCount > 0 && `Created ${importedCount}`}
              {importedCount > 0 && updatedCount > 0 && ', '}
              {updatedCount > 0 && `updated ${updatedCount}`}
              {hasSkipped && `, skipped ${skippedCount}`}
              {hasErrors && `, ${errorCount} error${errorCount !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Skipped Lines */}
          {hasSkipped && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-yellow-900 mb-2">
                Skipped Lines (Duplicates)
              </h4>
              <div className="max-h-40 overflow-y-auto">
                <ul className="text-sm text-yellow-800 space-y-1">
                  {importResult.skipped.map((name, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Errors */}
          {hasErrors && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-red-900 mb-2">
                Import Errors
              </h4>
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-red-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-red-900">
                        Row
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-red-900">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-red-900">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.errors.map((error, idx) => (
                      <tr key={idx} className="border-b border-red-100">
                        <td className="px-3 py-2 text-red-800">{error.row}</td>
                        <td className="px-3 py-2 text-red-800 font-medium">
                          {error.name}
                        </td>
                        <td className="px-3 py-2 text-red-700">{error.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Failure State */}
      {isFailure && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-red-900 mb-2">Import Failed</h3>
          <p className="text-red-800">
            No lines were imported or updated. Please check the errors and try again.
          </p>

          {hasErrors && (
            <div className="mt-6 bg-white rounded-lg p-4 max-h-60 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-red-50">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-red-900">Row</th>
                    <th className="px-3 py-2 font-semibold text-red-900">Name</th>
                    <th className="px-3 py-2 font-semibold text-red-900">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.errors.map((error, idx) => (
                    <tr key={idx} className="border-b border-red-100">
                      <td className="px-3 py-2 text-red-800">{error.row}</td>
                      <td className="px-3 py-2 text-red-800 font-medium">
                        {error.name}
                      </td>
                      <td className="px-3 py-2 text-red-700">{error.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary Stats */}
      {isComplete && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-900">{importedCount}</p>
            <p className="text-sm text-green-700">Created</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-900">{updatedCount}</p>
            <p className="text-sm text-blue-700">Updated</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-yellow-900">{skippedCount}</p>
            <p className="text-sm text-yellow-700">Skipped</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-900">{errorCount}</p>
            <p className="text-sm text-red-700">Errors</p>
          </div>
        </div>
      )}

      {/* Action */}
      {isComplete && (
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button onClick={onFinish} className="btn-primary px-6 py-2">
            Finish
          </button>
        </div>
      )}
    </div>
  );
};

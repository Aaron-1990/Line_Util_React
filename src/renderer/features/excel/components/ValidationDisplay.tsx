// ============================================
// VALIDATION DISPLAY
// Muestra resultados de validacion antes de importar
// ============================================

import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface ValidationResult {
  validCount: number;
  invalidCount: number;
  errors: Array<{ row: number; field: string; message: string }>;
  duplicates: string[];
}

interface ValidationDisplayProps {
  validationResult: ValidationResult;
  onStartImport: () => void;
  onBack: () => void;
}

export const ValidationDisplay = ({
  validationResult,
  onStartImport,
  onBack,
}: ValidationDisplayProps) => {
  const [showErrors, setShowErrors] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const { validCount, invalidCount, errors, duplicates } = validationResult;
  const hasErrors = invalidCount > 0;
  const hasDuplicates = duplicates.length > 0;
  const canImport = validCount > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Validation Results</h2>
        <p className="text-sm text-gray-600 mt-1">
          Review the validation results before importing
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Valid Lines */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-900">{validCount}</p>
              <p className="text-sm text-green-700">Valid Lines</p>
            </div>
          </div>
        </div>

        {/* Invalid Lines */}
        <div
          className={`border rounded-lg p-4 ${
            hasErrors ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <XCircle
              className={`w-8 h-8 ${hasErrors ? 'text-red-600' : 'text-gray-400'}`}
            />
            <div>
              <p
                className={`text-2xl font-bold ${
                  hasErrors ? 'text-red-900' : 'text-gray-600'
                }`}
              >
                {invalidCount}
              </p>
              <p
                className={`text-sm ${hasErrors ? 'text-red-700' : 'text-gray-500'}`}
              >
                Invalid Lines
              </p>
            </div>
          </div>
        </div>

        {/* Duplicates */}
        <div
          className={`border rounded-lg p-4 ${
            hasDuplicates
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle
              className={`w-8 h-8 ${
                hasDuplicates ? 'text-yellow-600' : 'text-gray-400'
              }`}
            />
            <div>
              <p
                className={`text-2xl font-bold ${
                  hasDuplicates ? 'text-yellow-900' : 'text-gray-600'
                }`}
              >
                {duplicates.length}
              </p>
              <p
                className={`text-sm ${
                  hasDuplicates ? 'text-yellow-700' : 'text-gray-500'
                }`}
              >
                Duplicates
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Errors Section */}
      {hasErrors && (
        <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="w-full flex items-center justify-between p-4 hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="font-semibold text-red-900">
                {invalidCount} Validation Errors
              </span>
            </div>
            {showErrors ? (
              <ChevronUp className="w-5 h-5 text-red-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-red-600" />
            )}
          </button>

          {showErrors && (
            <div className="border-t border-red-200 p-4 bg-white">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-red-900">
                        Row
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-red-900">
                        Field
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-red-900">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.map((error, idx) => (
                      <tr key={idx} className="border-b border-red-100">
                        <td className="px-3 py-2 text-red-800">{error.row}</td>
                        <td className="px-3 py-2 text-red-800 font-medium">
                          {error.field}
                        </td>
                        <td className="px-3 py-2 text-red-700">{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Duplicates Section */}
      {hasDuplicates && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowDuplicates(!showDuplicates)}
            className="w-full flex items-center justify-between p-4 hover:bg-yellow-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold text-yellow-900">
                {duplicates.length} Duplicate Names (will be skipped)
              </span>
            </div>
            {showDuplicates ? (
              <ChevronUp className="w-5 h-5 text-yellow-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-yellow-600" />
            )}
          </button>

          {showDuplicates && (
            <div className="border-t border-yellow-200 p-4 bg-white">
              <div className="max-h-40 overflow-y-auto">
                <ul className="text-sm text-yellow-800 space-y-1">
                  {duplicates.map((name, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Warning/Info */}
      {canImport && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            Ready to Import
          </h3>
          <p className="text-sm text-blue-800">
            {validCount} valid line{validCount !== 1 ? 's' : ''} will be imported.
            {hasDuplicates &&
              ` ${duplicates.length} duplicate${duplicates.length !== 1 ? 's' : ''} will be skipped.`}
            {hasErrors &&
              ` ${invalidCount} invalid line${invalidCount !== 1 ? 's' : ''} will be ignored.`}
          </p>
        </div>
      )}

      {!canImport && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-900 mb-2">
            Cannot Import
          </h3>
          <p className="text-sm text-red-800">
            No valid lines found. Please fix the errors in your Excel file and try
            again.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-6 py-2"
        >
          Back
        </button>
        <button
          onClick={onStartImport}
          disabled={!canImport}
          className="btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {canImport ? `Import ${validCount} Lines` : 'No Valid Lines'}
        </button>
      </div>
    </div>
  );
};

// ============================================
// MULTI-SHEET VALIDATION DISPLAY
// Shows validation results for multi-sheet import
// ============================================

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Factory,
  Plus,
} from 'lucide-react';
import { MultiSheetValidationResult, ImportMode, PlantValidationStatus } from '@shared/types';

interface MultiSheetValidationDisplayProps {
  validationResult: MultiSheetValidationResult;
  importMode: ImportMode;
  onStartImport: () => void;
  onBack: () => void;
}

export const MultiSheetValidationDisplay = ({
  validationResult,
  importMode,
  onStartImport,
  onBack,
}: MultiSheetValidationDisplayProps) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['cross-sheet']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const hasErrors =
    (validationResult.areas?.stats.invalid || 0) > 0 ||
    (validationResult.lines?.stats.invalid || 0) > 0 ||
    (validationResult.models?.stats.invalid || 0) > 0 ||
    (validationResult.compatibilities?.stats.invalid || 0) > 0 ||
    validationResult.crossSheetErrors.length > 0;

  const canImport = !validationResult.crossSheetErrors.length && (
    (validationResult.areas?.stats.valid || 0) > 0 ||
    (validationResult.lines?.stats.valid || 0) > 0 ||
    (validationResult.models?.stats.valid || 0) > 0 ||
    (validationResult.compatibilities?.stats.valid || 0) > 0
  );

  const renderSheetSection = (
    title: string,
    icon: string,
    sectionKey: string,
    stats: { total: number; valid: number; invalid: number; duplicates: number } | undefined,
    errors: { row: number; field: string; message: string }[] | undefined,
    duplicates: string[] | undefined
  ) => {
    if (!stats) return null;

    const isExpanded = expandedSections.has(sectionKey);
    const hasSheetErrors = stats.invalid > 0;

    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection(sectionKey)}
          className={`w-full px-4 py-3 flex items-center justify-between text-left ${
            hasSheetErrors ? 'bg-red-50 dark:bg-red-900/30' : 'bg-green-50 dark:bg-green-900/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{icon}</span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
              <div className="flex items-center gap-4 text-xs text-gray-600 mt-0.5">
                <span className="text-green-600 font-medium">
                  {stats.valid} valid
                </span>
                {stats.invalid > 0 && (
                  <span className="text-red-600 font-medium">
                    {stats.invalid} invalid
                  </span>
                )}
                {stats.duplicates > 0 && (
                  <span className="text-yellow-600 font-medium">
                    {stats.duplicates} duplicates
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasSheetErrors ? (
              <XCircle className="w-5 h-5 text-red-500" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </button>

        {isExpanded && (errors?.length || duplicates?.length) && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {/* Errors */}
            {errors && errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase">
                  Validation Errors
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {errors.map((error, idx) => (
                    <div
                      key={idx}
                      className="text-xs p-2 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded"
                    >
                      <span className="font-medium text-red-800 dark:text-red-300">
                        Row {error.row}:
                      </span>{' '}
                      <span className="text-red-700 dark:text-red-400">{error.message}</span>
                      {error.field && (
                        <span className="text-red-500 dark:text-red-400 ml-1">({error.field})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duplicates */}
            {duplicates && duplicates.length > 0 && (
              <div className="mt-3 space-y-2">
                <h4 className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase">
                  Duplicates in Sheet
                </h4>
                <div className="text-xs text-yellow-700 dark:text-yellow-400">
                  {duplicates.join(', ')}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Phase 7.3: Render plants section
  const renderPlantsSection = (plantValidation: PlantValidationStatus[] | undefined) => {
    if (!plantValidation || plantValidation.length === 0) return null;

    const existingCount = plantValidation.filter(p => p.exists).length;
    const newCount = plantValidation.filter(p => !p.exists).length;
    const isExpanded = expandedSections.has('plants');

    return (
      <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('plants')}
          className="w-full px-4 py-3 flex items-center justify-between text-left bg-blue-50 dark:bg-blue-900/30"
        >
          <div className="flex items-center gap-3">
            <Factory className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Plants Detected</h3>
              <div className="flex items-center gap-4 text-xs text-gray-600 mt-0.5">
                {existingCount > 0 && (
                  <span className="text-green-600 font-medium">
                    {existingCount} existing
                  </span>
                )}
                {newCount > 0 && (
                  <span className="text-blue-600 font-medium flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    {newCount} will be created
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 py-3 border-t border-blue-100 dark:border-blue-800 bg-white dark:bg-gray-800">
            <div className="space-y-2">
              {plantValidation.map((plant, idx) => (
                <div
                  key={idx}
                  className={`text-sm p-2 rounded flex items-center justify-between ${
                    plant.exists
                      ? 'bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800'
                      : 'bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{plant.code}</span>
                    {plant.existingName && plant.existingName !== plant.code && (
                      <span className="text-gray-500 dark:text-gray-400">({plant.existingName})</span>
                    )}
                  </div>
                  {plant.exists ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Exists
                    </span>
                  ) : (
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      <Plus className="w-3 h-3" />
                      Will be created
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Validation Results</h2>
        <p className="text-sm text-gray-600 mt-1">
          Review the validation results before importing
        </p>
      </div>

      {/* Overall Status */}
      <div
        className={`rounded-lg p-4 flex items-center gap-4 ${
          hasErrors ? 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
        }`}
      >
        {hasErrors ? (
          <>
            <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-300">
                Validation Issues Found
              </h3>
              <p className="text-sm text-red-700 dark:text-red-400">
                Please review the errors below. Valid data can still be imported.
              </p>
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-300">
                All Data Valid
              </h3>
              <p className="text-sm text-green-700 dark:text-green-400">
                Your data is ready to be imported.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Cross-Sheet Errors (Critical) */}
      {validationResult.crossSheetErrors.length > 0 && (
        <div className="border-2 border-red-500 dark:border-red-700 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('cross-sheet')}
            className="w-full px-4 py-3 flex items-center justify-between text-left bg-red-100 dark:bg-red-900/50"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-300">
                  Cross-Sheet Validation Errors
                </h3>
                <p className="text-xs text-red-700">
                  {validationResult.crossSheetErrors.length} critical error(s) - must be fixed before import
                </p>
              </div>
            </div>
            {expandedSections.has('cross-sheet') ? (
              <ChevronDown className="w-4 h-4 text-red-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-red-500" />
            )}
          </button>

          {expandedSections.has('cross-sheet') && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border-t border-red-200 dark:border-red-800">
              <div className="space-y-2">
                {validationResult.crossSheetErrors.map((error, idx) => (
                  <div
                    key={idx}
                    className="text-sm p-2 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400"
                  >
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase 7.3: Plants Detection Section */}
      {validationResult.plantValidation && validationResult.plantValidation.length > 0 && (
        <div className="space-y-3">
          {renderPlantsSection(validationResult.plantValidation)}
        </div>
      )}

      {/* Sheet-Specific Validation */}
      <div className="space-y-3">
        {renderSheetSection(
          'Process Areas (Flow Order)',
          '🏷️',
          'areas',
          validationResult.areas?.stats,
          validationResult.areas?.errors,
          validationResult.areas?.duplicates
        )}

        {renderSheetSection(
          'Production Lines',
          '🏭',
          'lines',
          validationResult.lines?.stats,
          validationResult.lines?.errors,
          validationResult.lines?.duplicates
        )}

        {renderSheetSection(
          'Product Models',
          '📦',
          'models',
          validationResult.models?.stats,
          validationResult.models?.errors,
          validationResult.models?.duplicates
        )}

        {renderSheetSection(
          'Compatibilities',
          '🔗',
          'compatibilities',
          validationResult.compatibilities?.stats,
          validationResult.compatibilities?.errors,
          validationResult.compatibilities?.duplicates
        )}
      </div>

      {/* Import Mode Reminder */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Import Mode</h3>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <strong className="capitalize">{importMode}</strong>
          {importMode === 'merge' && ' - Updates existing + Creates new'}
          {importMode === 'create' && ' - Creates new only (skips existing)'}
          {importMode === 'update' && ' - Updates existing only (skips new)'}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Back
        </button>

        <button
          onClick={onStartImport}
          disabled={!canImport}
          className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {canImport ? (
            <>
              Start Import
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4" />
              Cannot Import
            </>
          )}
        </button>
      </div>
    </div>
  );
};

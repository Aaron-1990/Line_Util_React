// ============================================
// IMPORT WIZARD
// Orquesta el flujo completo de importacion Excel
// ============================================

import { useState } from 'react';
import { FileSelector } from './FileSelector';
import { ColumnMapper } from './ColumnMapper';
import { ValidationDisplay } from './ValidationDisplay';
import { ProgressTracker } from './ProgressTracker';
import { ValidationResult } from '@shared/types';

type Step = 'select' | 'parse' | 'map' | 'validate' | 'import' | 'complete';

interface ColumnMapping {
  name: string;
  area: string;
  timeAvailableHours: string;
  efficiencyPercent: string;
}

interface ParsedData {
  rows: unknown[];
  headers: string[];
  sheetName: string;
  suggestedMapping: {
    name: string | null;
    area: string | null;
    timeAvailableHours: string | null;
    efficiencyPercent: string | null;
  };
}

// Formato para ValidationDisplay (interfaz local del componente)
interface ValidationDisplayData {
  validCount: number;
  invalidCount: number;
  errors: Array<{ row: number; field: string; message: string }>;
  duplicates: string[];
}

interface ImportResult {
  imported: string[];
  skipped: string[];
  errors: Array<{ row: number; name: string; error: string }>;
}

interface ImportWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const ImportWizard = ({ onComplete, onCancel }: ImportWizardProps) => {
  const [currentStep, setCurrentStep] = useState<Step>('select');
  const [filePath, setFilePath] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationDisplayData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step: Select File
  const handleFileSelected = async (selectedPath: string, _selectedName: string) => {
    setFilePath(selectedPath);
    setCurrentStep('parse');
    setIsLoading(true);
    setError(null);

    try {
      const response = await window.electronAPI.invoke<ParsedData>('excel:parse-file', selectedPath);

      if (response.success && response.data) {
        setParsedData(response.data);

        const { suggestedMapping } = response.data;
        const allMapped =
          suggestedMapping.name &&
          suggestedMapping.area &&
          suggestedMapping.timeAvailableHours &&
          suggestedMapping.efficiencyPercent;

        if (allMapped) {
          setColumnMapping(suggestedMapping as ColumnMapping);
          setCurrentStep('validate');
          await handleValidation(suggestedMapping as ColumnMapping, response.data);
        } else {
          setCurrentStep('map');
        }
      } else {
        setError(response.error || 'Failed to parse file');
        setCurrentStep('select');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCurrentStep('select');
    } finally {
      setIsLoading(false);
    }
  };

  // Step: Map Columns
  const handleMappingConfirmed = async (mapping: ColumnMapping) => {
    setColumnMapping(mapping);
    setCurrentStep('validate');
    await handleValidation(mapping, parsedData!);
  };

  // Step: Validate Data
  const handleValidation = async (mapping: ColumnMapping, data: ParsedData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await window.electronAPI.invoke<ValidationResult>(
        'excel:validate-data',
        data,
        mapping
      );

      if (response.success && response.data) {
        // Adapter: Convertir ValidationResult de @shared/types al formato de ValidationDisplay
        const adapted: ValidationDisplayData = {
          validCount: response.data.stats.valid,
          invalidCount: response.data.stats.invalid,
          errors: response.data.errors.map(err => ({
            row: err.row,
            field: err.field,
            message: err.message,
          })),
          duplicates: response.data.duplicates,
        };
        setValidationResult(adapted);
      } else {
        setError(response.error || 'Validation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Step: Import Data
  const handleStartImport = async () => {
    if (!columnMapping) return;

    setCurrentStep('import');
    setIsLoading(true);
    setError(null);

    try {
      const response = await window.electronAPI.invoke<ImportResult>(
        'excel:import',
        filePath,
        columnMapping
      );

      if (response.success && response.data) {
        setImportResult(response.data);
        setCurrentStep('complete');
      } else {
        setError(response.error || 'Import failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation
  const handleBack = () => {
    if (currentStep === 'map') {
      setCurrentStep('select');
      setParsedData(null);
    } else if (currentStep === 'validate') {
      setCurrentStep('map');
      setValidationResult(null);
    }
  };

  const handleFinish = () => {
    onComplete();
  };

  // Progress Steps
  const steps = [
    { key: 'select', label: 'Select File' },
    { key: 'map', label: 'Map Columns' },
    { key: 'validate', label: 'Validate Data' },
    { key: 'import', label: 'Import' },
  ];

  const stepOrder: Step[] = ['select', 'parse', 'map', 'validate', 'import', 'complete'];
  const currentStepIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => {
              const stepKey = step.key as Step;
              const stepIdx = stepOrder.indexOf(stepKey);
              const isActive = stepIdx === currentStepIndex;
              const isComplete = stepIdx < currentStepIndex;

              return (
                <div key={step.key} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                        isComplete
                          ? 'bg-primary-600 text-white'
                          : isActive
                          ? 'bg-primary-100 text-primary-600 ring-2 ring-primary-600'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <span
                      className={`mt-2 text-sm font-medium ${
                        isActive ? 'text-primary-600' : 'text-gray-600'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-4 transition-colors ${
                        isComplete ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {(currentStep === 'select' || currentStep === 'parse') && (
            <FileSelector
              onFileSelected={handleFileSelected}
              onCancel={onCancel}
            />
          )}

          {currentStep === 'map' && parsedData && (
            <ColumnMapper
              headers={parsedData.headers}
              rows={parsedData.rows.slice(0, 5)}
              suggestedMapping={parsedData.suggestedMapping}
              onMappingConfirmed={handleMappingConfirmed}
              onBack={handleBack}
            />
          )}

          {currentStep === 'validate' && validationResult && (
            <ValidationDisplay
              validationResult={validationResult}
              onStartImport={handleStartImport}
              onBack={handleBack}
            />
          )}

          {(currentStep === 'import' || currentStep === 'complete') && (
            <ProgressTracker
              isImporting={isLoading}
              importResult={importResult}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>
    </div>
  );
};

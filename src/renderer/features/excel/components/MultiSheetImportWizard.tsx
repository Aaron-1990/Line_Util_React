// ============================================
// MULTI-SHEET IMPORT WIZARD
// Orchestrates multi-sheet Excel import flow
// ============================================

import { useState } from 'react';
import { FileSelector } from './FileSelector';
import { SheetSelector, SheetType } from './SheetSelector';
import { MultiSheetValidationDisplay } from './MultiSheetValidationDisplay';
import { MultiSheetProgressTracker } from './MultiSheetProgressTracker';
import {
  ImportMode,
  DetectedSheets,
  MultiSheetParsedData,
  MultiSheetValidationResult,
  MultiSheetImportResult,
} from '@shared/types';

type Step = 'select' | 'detect' | 'sheets' | 'validate' | 'import' | 'complete';

interface MultiSheetImportWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const MultiSheetImportWizard = ({
  onComplete,
  onCancel,
}: MultiSheetImportWizardProps) => {
  const [currentStep, setCurrentStep] = useState<Step>('select');
  const [filePath, setFilePath] = useState<string>('');
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [detectedSheets, setDetectedSheets] = useState<DetectedSheets | null>(null);
  const [validationResult, setValidationResult] = useState<MultiSheetValidationResult | null>(null);
  const [importResult, setImportResult] = useState<MultiSheetImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: File Selected -> Detect Sheets
  const handleFileSelected = async (
    selectedPath: string,
    _selectedName: string,
    mode: ImportMode
  ) => {
    setFilePath(selectedPath);
    setImportMode(mode);
    setCurrentStep('detect');
    setIsLoading(true);
    setError(null);

    try {
      // Detect available sheets
      const detectResponse = await window.electronAPI.invoke<DetectedSheets>(
        'excel:detect-sheets',
        selectedPath
      );

      if (detectResponse.success && detectResponse.data) {
        const detected = detectResponse.data;
        setDetectedSheets(detected);

        // Count how many sheets were detected
        const sheetCount = [detected.lines, detected.models, detected.compatibilities].filter(
          Boolean
        ).length;

        if (sheetCount === 0) {
          setError('No compatible sheets found in this Excel file. Please ensure your file has sheets named "Lines", "Models", or "Compatibilities".');
          setCurrentStep('select');
        } else if (sheetCount === 1 && detected.lines) {
          // Single Lines sheet - use legacy single-sheet import
          // For now, just continue with multi-sheet flow
          setCurrentStep('sheets');
        } else {
          // Multi-sheet file
          setCurrentStep('sheets');
        }
      } else {
        setError(detectResponse.error || 'Failed to detect sheets');
        setCurrentStep('select');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCurrentStep('select');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Sheets Selected -> Parse & Validate
  const handleSheetsSelected = async (sheets: Set<SheetType>) => {
    setCurrentStep('validate');
    setIsLoading(true);
    setError(null);

    try {
      // Parse selected sheets
      const parseResponse = await window.electronAPI.invoke<MultiSheetParsedData>(
        'excel:parse-multi-sheet',
        filePath
      );

      if (!parseResponse.success || !parseResponse.data) {
        throw new Error(parseResponse.error || 'Failed to parse Excel file');
      }

      const parsed = parseResponse.data;

      // Filter to only selected sheets
      const filteredParsed: MultiSheetParsedData = {
        availableSheets: parsed.availableSheets,
      };

      if (sheets.has('lines') && parsed.lines) {
        filteredParsed.lines = parsed.lines;
      }
      if (sheets.has('models') && parsed.models) {
        filteredParsed.models = parsed.models;
      }
      if (sheets.has('compatibilities') && parsed.compatibilities) {
        filteredParsed.compatibilities = parsed.compatibilities;
      }

      // Validate
      const validateResponse = await window.electronAPI.invoke<MultiSheetValidationResult>(
        'excel:validate-multi-sheet',
        filteredParsed
      );

      if (validateResponse.success && validateResponse.data) {
        setValidationResult(validateResponse.data);
      } else {
        throw new Error(validateResponse.error || 'Validation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCurrentStep('sheets');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Start Import
  const handleStartImport = async () => {
    if (!validationResult) return;

    setCurrentStep('import');
    setIsLoading(true);
    setError(null);

    try {
      const importResponse = await window.electronAPI.invoke<MultiSheetImportResult>(
        'excel:import-multi-sheet',
        validationResult,
        importMode
      );

      if (importResponse.success && importResponse.data) {
        setImportResult(importResponse.data);
        setCurrentStep('complete');
      } else {
        throw new Error(importResponse.error || 'Import failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCurrentStep('validate');
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation
  const handleBack = () => {
    if (currentStep === 'sheets') {
      setCurrentStep('select');
      setDetectedSheets(null);
    } else if (currentStep === 'validate') {
      setCurrentStep('sheets');
      setValidationResult(null);
    }
  };

  const handleFinish = () => {
    onComplete();
  };

  const handleImportMore = () => {
    // Reset state for another import
    setCurrentStep('select');
    setFilePath('');
    setDetectedSheets(null);
    setValidationResult(null);
    setImportResult(null);
    setError(null);
  };

  // Progress Steps
  const steps = [
    { key: 'select', label: 'Select File' },
    { key: 'sheets', label: 'Select Sheets' },
    { key: 'validate', label: 'Validate Data' },
    { key: 'import', label: 'Import' },
  ];

  // Map step index for progress display (detect is hidden)
  const getProgressStepIndex = (step: Step) => {
    const map: Record<Step, number> = {
      select: 0,
      detect: 0,
      sheets: 1,
      validate: 2,
      import: 3,
      complete: 3,
    };
    return map[step];
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => {
              const progressIdx = getProgressStepIndex(currentStep);
              const isActive = idx === progressIdx;
              const isComplete = idx < progressIdx;

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

        {/* Loading Indicator for detect step */}
        {currentStep === 'detect' && isLoading && (
          <div className="bg-white rounded-lg shadow-sm p-12 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Analyzing Excel file...</p>
          </div>
        )}

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {currentStep === 'select' && (
            <FileSelector onFileSelected={handleFileSelected} onCancel={onCancel} />
          )}

          {currentStep === 'sheets' && detectedSheets && (
            <SheetSelector
              detectedSheets={detectedSheets}
              onSheetsSelected={handleSheetsSelected}
              onBack={handleBack}
            />
          )}

          {currentStep === 'validate' && validationResult && (
            <MultiSheetValidationDisplay
              validationResult={validationResult}
              importMode={importMode}
              onStartImport={handleStartImport}
              onBack={handleBack}
            />
          )}

          {(currentStep === 'import' || currentStep === 'complete') && (
            <MultiSheetProgressTracker
              isImporting={isLoading}
              importResult={importResult}
              onFinish={handleFinish}
              onImportMore={handleImportMore}
            />
          )}
        </div>
      </div>
    </div>
  );
};

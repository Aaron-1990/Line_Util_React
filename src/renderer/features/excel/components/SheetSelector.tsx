// ============================================
// SHEET SELECTOR
// Component to select which sheets to import from multi-sheet Excel
// ============================================

import { useState, useEffect } from 'react';
import { FileSpreadsheet, CheckSquare, Square, ArrowRight, AlertCircle } from 'lucide-react';
import { DetectedSheets } from '@shared/types';

export type SheetType = 'lines' | 'models' | 'compatibilities';

interface SheetSelectorProps {
  detectedSheets: DetectedSheets;
  onSheetsSelected: (selectedSheets: Set<SheetType>) => void;
  onBack: () => void;
}

interface SheetInfo {
  key: SheetType;
  label: string;
  description: string;
  icon: string;
  required: boolean;
}

const SHEET_INFO: SheetInfo[] = [
  {
    key: 'lines',
    label: 'Production Lines',
    description: 'Line capacity and area information',
    icon: '🏭',
    required: false,
  },
  {
    key: 'models',
    label: 'Product Models',
    description: 'Model information with annual volumes',
    icon: '📦',
    required: false,
  },
  {
    key: 'compatibilities',
    label: 'Line-Model Compatibilities',
    description: 'Which models can run on which lines',
    icon: '🔗',
    required: false,
  },
];

export const SheetSelector = ({
  detectedSheets,
  onSheetsSelected,
  onBack,
}: SheetSelectorProps) => {
  const [selectedSheets, setSelectedSheets] = useState<Set<SheetType>>(new Set());
  const [warning, setWarning] = useState<string | null>(null);

  // Auto-select all detected sheets
  useEffect(() => {
    const initialSelection = new Set<SheetType>();
    if (detectedSheets.lines) initialSelection.add('lines');
    if (detectedSheets.models) initialSelection.add('models');
    if (detectedSheets.compatibilities) initialSelection.add('compatibilities');
    setSelectedSheets(initialSelection);
  }, [detectedSheets]);

  // Check for warnings when selection changes
  useEffect(() => {
    if (selectedSheets.has('compatibilities') && !selectedSheets.has('models')) {
      // Check if models exist in DB (we'll show a soft warning)
      setWarning('Importing Compatibilities requires Models. Make sure models exist in the database or select the Models sheet.');
    } else {
      setWarning(null);
    }
  }, [selectedSheets]);

  const toggleSheet = (sheetType: SheetType) => {
    const newSelection = new Set(selectedSheets);
    if (newSelection.has(sheetType)) {
      newSelection.delete(sheetType);
    } else {
      newSelection.add(sheetType);
    }
    setSelectedSheets(newSelection);
  };

  const handleContinue = () => {
    if (selectedSheets.size === 0) return;
    onSheetsSelected(selectedSheets);
  };

  const isSheetAvailable = (key: SheetType): boolean => {
    return !!detectedSheets[key];
  };

  const getSheetDetails = (key: SheetType) => {
    const sheet = detectedSheets[key];
    if (!sheet) return null;
    return {
      sheetName: sheet.sheetName,
      rowCount: sheet.rowCount,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Select Sheets to Import</h2>
        <p className="text-sm text-gray-600 mt-1">
          Choose which data sheets you want to import from this Excel file
        </p>
      </div>

      {/* Sheet List */}
      <div className="space-y-3">
        {SHEET_INFO.map((info) => {
          const isAvailable = isSheetAvailable(info.key);
          const isSelected = selectedSheets.has(info.key);
          const details = getSheetDetails(info.key);

          return (
            <div
              key={info.key}
              onClick={() => isAvailable && toggleSheet(info.key)}
              className={`
                relative border rounded-lg p-4 transition-all cursor-pointer
                ${isAvailable
                  ? isSelected
                    ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  : 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60'
                }
              `}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <div className="flex-shrink-0 mt-0.5">
                  {isAvailable ? (
                    isSelected ? (
                      <CheckSquare className="w-5 h-5 text-primary-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )
                  ) : (
                    <Square className="w-5 h-5 text-gray-300" />
                  )}
                </div>

                {/* Icon */}
                <div className="flex-shrink-0 text-2xl">{info.icon}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{info.label}</h3>
                    {!isAvailable && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                        Not Found
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{info.description}</p>

                  {details && (
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <FileSpreadsheet className="w-3 h-3" />
                        Sheet: <strong>{details.sheetName}</strong>
                      </span>
                      <span>
                        <strong>{details.rowCount}</strong> rows
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Warning Message */}
      {warning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">{warning}</div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Import Summary</h3>
        <div className="text-sm text-gray-600">
          {selectedSheets.size === 0 ? (
            <p>No sheets selected</p>
          ) : (
            <ul className="space-y-1">
              {selectedSheets.has('lines') && detectedSheets.lines && (
                <li>
                  <strong>{detectedSheets.lines.rowCount}</strong> production lines
                </li>
              )}
              {selectedSheets.has('models') && detectedSheets.models && (
                <li>
                  <strong>{detectedSheets.models.rowCount}</strong> product models
                </li>
              )}
              {selectedSheets.has('compatibilities') && detectedSheets.compatibilities && (
                <li>
                  <strong>{detectedSheets.compatibilities.rowCount}</strong> compatibilities
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Back
        </button>

        <button
          onClick={handleContinue}
          disabled={selectedSheets.size === 0}
          className="btn-primary px-6 py-2 flex items-center gap-2"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

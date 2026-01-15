// ============================================
// FILE SELECTOR
// Drag & drop + file picker para Excel
// Import Mode: CREATE / UPDATE / MERGE
// ============================================

import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';

type ImportMode = 'create' | 'update' | 'merge';

interface FileSelectorProps {
  onFileSelected: (filePath: string, fileName: string, mode: ImportMode) => void;
  onCancel?: () => void;
}

export const FileSelector = ({ onFileSelected, onCancel }: FileSelectorProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const excelFile = files.find(
        (f) => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
      );

      if (excelFile) {
        onFileSelected(excelFile.path, excelFile.name, importMode);
      } else {
        alert('Please drop an Excel file (.xlsx or .xls)');
      }
    },
    [onFileSelected, importMode]
  );

  const handleFilePickerClick = useCallback(async () => {
    setIsSelecting(true);

    try {
      const response = await window.electronAPI.invoke<{
        path: string;
        name: string;
      } | null>('excel:select-file');

      if (response.success && response.data) {
        onFileSelected(response.data.path, response.data.name, importMode);
      }
    } catch (error) {
      console.error('Error selecting file:', error);
      alert('Failed to open file picker');
    } finally {
      setIsSelecting(false);
    }
  }, [onFileSelected, importMode]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Import from Excel</h2>
          <p className="text-sm text-gray-600 mt-1">
            Select an Excel file containing production line data
          </p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Cancel"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Import Mode Selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Import Mode</h3>
        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="radio"
              name="importMode"
              value="merge"
              checked={importMode === 'merge'}
              onChange={(e) => setImportMode(e.target.value as ImportMode)}
              className="mt-0.5 w-4 h-4 text-primary-600 focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  Update existing + Create new
                </span>
                <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                Updates lines that exist, creates new ones
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="radio"
              name="importMode"
              value="create"
              checked={importMode === 'create'}
              onChange={(e) => setImportMode(e.target.value as ImportMode)}
              className="mt-0.5 w-4 h-4 text-primary-600 focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">Create new only</span>
              <p className="text-xs text-gray-600 mt-0.5">
                Skips lines that already exist
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="radio"
              name="importMode"
              value="update"
              checked={importMode === 'update'}
              onChange={(e) => setImportMode(e.target.value as ImportMode)}
              className="mt-0.5 w-4 h-4 text-primary-600 focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">Update existing only</span>
              <p className="text-xs text-gray-600 mt-0.5">
                Skips lines that do not exist
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center transition-all
          ${
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
          }
        `}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className={`
            w-16 h-16 rounded-full flex items-center justify-center transition-colors
            ${isDragging ? 'bg-primary-200' : 'bg-gray-200'}
          `}
          >
            {isDragging ? (
              <Upload className="w-8 h-8 text-primary-600" />
            ) : (
              <FileSpreadsheet className="w-8 h-8 text-gray-600" />
            )}
          </div>

          <div>
            <p className="text-lg font-medium text-gray-900">
              {isDragging ? 'Drop file here' : 'Drag & drop Excel file'}
            </p>
            <p className="text-sm text-gray-500 mt-1">or</p>
          </div>

          <button
            onClick={handleFilePickerClick}
            disabled={isSelecting}
            className="btn-primary px-6 py-2"
          >
            {isSelecting ? 'Opening...' : 'Browse Files'}
          </button>

          <p className="text-xs text-gray-500">
            Supported formats: .xlsx, .xls
          </p>
        </div>
      </div>

      {/* Expected Format Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Expected Format</h3>
        <div className="text-xs text-blue-800 space-y-1">
          <p>• <strong>Name:</strong> Line name (required)</p>
          <p>• <strong>Area:</strong> Production area (ICT, SMT, WAVE, etc.)</p>
          <p>• <strong>Time Available:</strong> Hours per day (e.g., 23)</p>
          <p>• <strong>Efficiency:</strong> Percentage (e.g., 85)</p>
        </div>
      </div>
    </div>
  );
};

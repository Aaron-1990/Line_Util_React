// ============================================
// COLUMN MAPPER
// Mapea columnas de Excel a campos del sistema
// ============================================

import { useState, useEffect } from 'react';
import { ArrowRight, AlertCircle } from 'lucide-react';

interface ColumnMapping {
  name: string;
  area: string;
  timeAvailableHours: string;
  efficiencyPercent: string;
}

interface ColumnMapperProps {
  headers: string[];
  rows: unknown[];
  suggestedMapping: {
    name: string | null;
    area: string | null;
    timeAvailableHours: string | null;
    efficiencyPercent: string | null;
  };
  onMappingConfirmed: (mapping: ColumnMapping) => void;
  onBack: () => void;
}

export const ColumnMapper = ({
  headers,
  rows,
  suggestedMapping,
  onMappingConfirmed,
  onBack,
}: ColumnMapperProps) => {
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: suggestedMapping.name || '',
    area: suggestedMapping.area || '',
    timeAvailableHours: suggestedMapping.timeAvailableHours || '',
    efficiencyPercent: suggestedMapping.efficiencyPercent || '',
  });

  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    validateMapping();
  }, [mapping]);

  const validateMapping = () => {
    const newErrors: string[] = [];

    if (!mapping.name) newErrors.push('Name field is required');
    if (!mapping.area) newErrors.push('Area field is required');
    if (!mapping.timeAvailableHours) newErrors.push('Time Available field is required');
    if (!mapping.efficiencyPercent) newErrors.push('Efficiency field is required');

    const usedColumns = Object.values(mapping).filter(Boolean);
    const uniqueColumns = new Set(usedColumns);
    if (usedColumns.length !== uniqueColumns.size) {
      newErrors.push('Cannot map multiple fields to the same column');
    }

    setErrors(newErrors);
  };

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value }));
  };

  const handleConfirm = () => {
    if (errors.length === 0) {
      onMappingConfirmed(mapping);
    }
  };

  const isValid = errors.length === 0;

  const fieldLabels = {
    name: 'Line Name',
    area: 'Production Area',
    timeAvailableHours: 'Time Available (hours)',
    efficiencyPercent: 'Efficiency (%)',
  };

  const fieldDescriptions = {
    name: 'Unique name for the production line',
    area: 'Production area (ICT, SMT, WAVE, etc.)',
    timeAvailableHours: 'Hours available per day (e.g., 23)',
    efficiencyPercent: 'OEE percentage (e.g., 85)',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Map Columns</h2>
        <p className="text-sm text-gray-600 mt-1">
          Map Excel columns to production line fields
        </p>
      </div>

      {/* Mapping Form */}
      <div className="space-y-4">
        {(Object.keys(mapping) as Array<keyof ColumnMapping>).map((field) => (
          <div key={field} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  {fieldLabels[field]}
                </label>
                <p className="text-xs text-gray-600 mb-2">
                  {fieldDescriptions[field]}
                </p>
              </div>

              <ArrowRight className="w-5 h-5 text-gray-400 mt-2 flex-shrink-0" />

              <div className="flex-1">
                <select
                  value={mapping[field]}
                  onChange={(e) => handleMappingChange(field, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select column...</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-2">
                Mapping Issues
              </h3>
              <ul className="text-sm text-red-800 space-y-1">
                {errors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Data Preview */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">
          Data Preview (first 5 rows)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-blue-200">
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-3 py-2 text-left font-semibold text-blue-900"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b border-blue-100">
                  {headers.map((header) => (
                    <td key={header} className="px-3 py-2 text-blue-800">
                      {String((row as Record<string, unknown>)[header] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="btn bg-gray-200 text-gray-700 hover:bg-gray-300 px-6 py-2"
        >
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={!isValid}
          className="btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Validation
        </button>
      </div>
    </div>
  );
};

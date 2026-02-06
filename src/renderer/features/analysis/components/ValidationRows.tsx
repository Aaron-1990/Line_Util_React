// ============================================
// VALIDATION ROWS COMPONENT
// Phase: Optimization Results Validation
// Framework: Híbrido v2.0
// Adapted for multi-year structure
// ============================================

import React from 'react';
import { AreaValidationSummary } from '@shared/types/validation';
import {
  VALIDATION_STATUS_LABELS,
  VALIDATION_STATUS_COLORS,
  VALIDATION_ROW_LABELS
} from '@shared/constants/validation';

interface ValidationRowsProps {
  validationsByYear: Map<number, AreaValidationSummary>; // Map<year, AreaValidationSummary>
  years: number[]; // Years in display order
  modelColumns: string[]; // Model names in same order as table columns
}

/**
 * ValidationRows component
 *
 * Renders 4 validation rows at the bottom of each area results table:
 * 1. Σ DISTRIBUIDO - Sum of allocated units per model
 * 2. VOLUMEN (BD) - Annual volume from database
 * 3. COBERTURA - Coverage percentage
 * 4. ESTADO - Validation status with color indicator
 *
 * Supports multi-year display with columns per year (like YearDataCells pattern)
 */
export function ValidationRows({ validationsByYear, years, modelColumns }: ValidationRowsProps) {
  return (
    <>
      {/* Separator row */}
      <tr>
        <td className="px-4 py-2 border-t-2 border-gray-700" />
        {years.map(year => (
          <td
            key={`sep-${year}`}
            colSpan={2 + modelColumns.length * 2}
            className="border-t-2 border-gray-700 border-l"
          />
        ))}
      </tr>

      {/* Σ DISTRIBUIDO row */}
      <tr className="bg-gray-50 font-semibold">
        <td className="px-4 py-2 text-sm text-gray-700 sticky left-0 bg-gray-50 z-10">
          {VALIDATION_ROW_LABELS.DISTRIBUTED}
        </td>
        {years.map(year => (
          <ValidationYearCells
            key={`dist-${year}`}
            year={year}
            validation={validationsByYear.get(year)}
            modelColumns={modelColumns}
            rowType="distributed"
          />
        ))}
      </tr>

      {/* VOLUMEN (BD) row */}
      <tr className="bg-gray-50">
        <td className="px-4 py-2 text-sm text-gray-700 sticky left-0 bg-gray-50 z-10">
          {VALIDATION_ROW_LABELS.VOLUME}
        </td>
        {years.map(year => (
          <ValidationYearCells
            key={`vol-${year}`}
            year={year}
            validation={validationsByYear.get(year)}
            modelColumns={modelColumns}
            rowType="volume"
          />
        ))}
      </tr>

      {/* COBERTURA row */}
      <tr className="bg-gray-50">
        <td className="px-4 py-2 text-sm text-gray-700 sticky left-0 bg-gray-50 z-10">
          {VALIDATION_ROW_LABELS.COVERAGE}
        </td>
        {years.map(year => (
          <ValidationYearCells
            key={`cov-${year}`}
            year={year}
            validation={validationsByYear.get(year)}
            modelColumns={modelColumns}
            rowType="coverage"
          />
        ))}
      </tr>

      {/* ESTADO row */}
      <tr className="bg-gray-50 font-semibold">
        <td className="px-4 py-2 text-sm text-gray-700 sticky left-0 bg-gray-50 z-10">
          {VALIDATION_ROW_LABELS.STATUS}
        </td>
        {years.map(year => (
          <ValidationYearCells
            key={`status-${year}`}
            year={year}
            validation={validationsByYear.get(year)}
            modelColumns={modelColumns}
            rowType="status"
          />
        ))}
      </tr>
    </>
  );
}

// ============================================
// SUB-COMPONENT: ValidationYearCells
// Renders validation cells for a single year (similar to YearDataCells pattern)
// ============================================

interface ValidationYearCellsProps {
  year: number;
  validation: AreaValidationSummary | undefined;
  modelColumns: string[];
  rowType: 'distributed' | 'volume' | 'coverage' | 'status';
}

const ValidationYearCells = ({ year, validation, modelColumns, rowType }: ValidationYearCellsProps) => {
  // Create lookup map for quick access
  const modelValidationMap = new Map(
    validation?.models.map(m => [m.modelName, m]) || []
  );

  return (
    <>
      {/* First two columns: Tiempo Util. and Util. (%) - show "-" for validation rows */}
      <td className="px-3 py-2 text-sm text-right text-gray-400 border-l">-</td>
      <td className="px-3 py-2 text-sm text-right text-gray-400">-</td>

      {/* Pieces columns per model */}
      {modelColumns.map(modelName => {
        const modelVal = modelValidationMap.get(modelName);

        let content: React.ReactNode = '-';
        let className = 'px-3 py-2 text-sm text-right';
        let style: React.CSSProperties = {};

        if (modelVal) {
          switch (rowType) {
            case 'distributed':
              content = modelVal.distributedUnits.toLocaleString();
              className += ' text-gray-900';
              break;
            case 'volume':
              content = modelVal.volumeUnitsAnnual.toLocaleString();
              className += ' text-blue-900';
              break;
            case 'coverage':
              content = `${modelVal.coveragePercent.toFixed(1)}%`;
              className += ' font-medium text-gray-700';
              break;
            case 'status':
              const status = modelVal.status;
              const label = VALIDATION_STATUS_LABELS[status];
              const color = VALIDATION_STATUS_COLORS[status];
              content = label;
              className += ' text-center font-medium';
              style = { color };
              break;
          }
        } else {
          className += ' text-gray-400';
        }

        return (
          <td key={`${rowType}-pieces-${year}-${modelName}`} className={className} style={style}>
            {content}
          </td>
        );
      })}

      {/* Seconds columns per model - show "-" for validation rows */}
      {modelColumns.map(modelName => (
        <td key={`${rowType}-seconds-${year}-${modelName}`} className="px-3 py-2 text-sm text-right text-gray-400">
          -
        </td>
      ))}
    </>
  );
};

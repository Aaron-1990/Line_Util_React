// ============================================
// RESULTS PANEL
// Displays optimization results grouped by area
// Similar to Excel format: Resultados_SMT, Resultados_ICT, etc.
// ============================================

import { useState, useMemo } from 'react';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { X } from 'lucide-react';
import { LineUtilizationResult } from '@shared/types';

// Natural sort comparator for line names (e.g., "Line 1", "Line 2", "Line 10")
const naturalSort = (a: string, b: string): number => {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

export const ResultsPanel = () => {
  const { results, resetAnalysis } = useAnalysisStore();
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  // Group results by area
  const areaGroups = useMemo(() => {
    if (!results || !results.yearResults.length) return [];

    // Get unique areas from first year's results
    const firstYear = results.yearResults[0];
    if (!firstYear) return [];

    const areas = new Set<string>();
    firstYear.lines.forEach(line => areas.add(line.area));

    return Array.from(areas).sort();
  }, [results]);

  // Get lines for selected area across all years
  const areaResults = useMemo(() => {
    if (!results || !selectedArea) return null;

    const linesByName: Map<string, {
      lineId: string;
      lineName: string;
      area: string;
      timeAvailableDaily: number;
      yearData: Map<number, LineUtilizationResult>;
    }> = new Map();

    // Collect data for each line across all years
    results.yearResults.forEach(yearResult => {
      yearResult.lines
        .filter(line => line.area === selectedArea)
        .forEach(line => {
          if (!linesByName.has(line.lineName)) {
            linesByName.set(line.lineName, {
              lineId: line.lineId,
              lineName: line.lineName,
              area: line.area,
              timeAvailableDaily: line.timeAvailableDaily,
              yearData: new Map(),
            });
          }
          linesByName.get(line.lineName)!.yearData.set(yearResult.year, line);
        });
    });

    return {
      // Use natural sort for proper ordering (Line 1, Line 2, Line 10 instead of Line 1, Line 10, Line 2)
      lines: Array.from(linesByName.values()).sort((a, b) => naturalSort(a.lineName, b.lineName)),
      years: results.yearResults.map(yr => yr.year).sort((a, b) => a - b),
    };
  }, [results, selectedArea]);

  // Get all unique models for the selected area
  const modelsInArea = useMemo(() => {
    if (!areaResults) return [];

    const models = new Set<string>();
    areaResults.lines.forEach(line => {
      line.yearData.forEach(yearData => {
        yearData.assignments.forEach(assignment => {
          models.add(assignment.modelName);
        });
      });
    });

    return Array.from(models).sort();
  }, [areaResults]);

  // Auto-select first area
  if (areaGroups.length > 0 && !selectedArea) {
    setSelectedArea(areaGroups[0] ?? null);
  }

  if (!results) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Optimization Results
            </h2>
            <p className="text-sm text-gray-500">
              {results.yearResults.length} years analyzed |
              Avg. Utilization: {results.overallSummary.averageUtilizationAllYears}% |
              Execution: {results.metadata.executionTimeMs}ms
            </p>
          </div>
          <button
            onClick={resetAnalysis}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Area Tabs */}
        <div className="flex gap-1 px-6 py-3 border-b bg-gray-50 overflow-x-auto">
          {areaGroups.map(area => (
            <button
              key={area}
              onClick={() => setSelectedArea(area)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedArea === area
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border'
              }`}
            >
              {area}
            </button>
          ))}
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-auto p-6">
          {areaResults && (
            <div className="space-y-8">
              {/* Main Results Table - Full model breakdown */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Resultados_{selectedArea?.replace(/\s+/g, '_')}
                </h3>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                          Linea
                        </th>
                        {areaResults.years.map(year => (
                          <th
                            key={year}
                            colSpan={2 + modelsInArea.length * 2}
                            className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l"
                          >
                            {year}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 sticky left-0 bg-gray-100 z-10">

                        </th>
                        {areaResults.years.map(year => (
                          <YearSubHeaders
                            key={year}
                            year={year}
                            models={modelsInArea}
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {areaResults.lines.map((line, idx) => (
                        <tr key={line.lineId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900 sticky left-0 bg-inherit z-10">
                            {line.lineName}
                          </td>
                          {areaResults.years.map(year => (
                            <YearDataCells
                              key={year}
                              yearData={line.yearData.get(year)}
                              year={year}
                              models={modelsInArea}
                            />
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary Table */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Tabla de Resumen
                </h3>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                          Linea
                        </th>
                        {areaResults.years.map(year => (
                          <th key={`pieces-${year}`} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {year} Total Piezas
                          </th>
                        ))}
                        {areaResults.years.map(year => (
                          <th key={`seconds-${year}`} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-l">
                            {year} Total Segundos
                          </th>
                        ))}
                        {areaResults.years.map(year => (
                          <th key={`util-${year}`} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-l">
                            {year} Utilizacion (%)
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {areaResults.lines.map((line, idx) => (
                        <tr key={line.lineId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900 sticky left-0 bg-inherit z-10">
                            {line.lineName}
                          </td>
                          {/* Total Pieces per year */}
                          {areaResults.years.map(year => {
                            const yearData = line.yearData.get(year);
                            const totalPieces = yearData?.assignments.reduce(
                              (sum, a) => sum + a.allocatedUnitsDaily * getOperationsDays(),
                              0
                            ) || 0;
                            return (
                              <td key={`pieces-${year}`} className="px-4 py-2 text-sm text-right text-gray-700">
                                {Math.round(totalPieces).toLocaleString()}
                              </td>
                            );
                          })}
                          {/* Total Seconds per year */}
                          {areaResults.years.map(year => {
                            const yearData = line.yearData.get(year);
                            const totalSeconds = yearData?.assignments.reduce(
                              (sum, a) => sum + a.timeRequiredSeconds * getOperationsDays(),
                              0
                            ) || 0;
                            return (
                              <td key={`seconds-${year}`} className="px-4 py-2 text-sm text-right text-gray-700 border-l">
                                {Math.round(totalSeconds).toLocaleString()}
                              </td>
                            );
                          })}
                          {/* Utilization per year */}
                          {areaResults.years.map(year => {
                            const yearData = line.yearData.get(year);
                            const util = yearData?.utilizationPercent || 0;
                            return (
                              <td key={`util-${year}`} className={`px-4 py-2 text-sm text-right border-l font-medium ${
                                util > 100 ? 'text-red-600' :
                                util >= 70 ? 'text-green-600' :
                                util > 0 ? 'text-yellow-600' :
                                'text-gray-400'
                              }`}>
                                {util.toFixed(2)}%
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to estimate operations days (would need to come from volumes data)
const getOperationsDays = (): number => {
  // Default to 240 if not available
  return 240;
};

// Sub-component for year column sub-headers (always expanded)
const YearSubHeaders = ({
  year,
  models,
}: {
  year: number;
  models: string[];
}) => {
  return (
    <>
      <th className="px-3 py-2 text-right text-xs text-gray-500 border-l whitespace-nowrap">
        Tiempo Util.
      </th>
      <th className="px-3 py-2 text-right text-xs text-gray-500 whitespace-nowrap">
        Util. (%)
      </th>
      {models.map(model => (
        <th key={`${year}-${model}-pieces`} className="px-3 py-2 text-right text-xs text-gray-500 whitespace-nowrap">
          {model} Pzas
        </th>
      ))}
      {models.map(model => (
        <th key={`${year}-${model}-seconds`} className="px-3 py-2 text-right text-xs text-gray-500 whitespace-nowrap">
          {model} Seg
        </th>
      ))}
    </>
  );
};

// Sub-component for year data cells (always expanded)
const YearDataCells = ({
  yearData,
  year,
  models,
}: {
  yearData: LineUtilizationResult | undefined;
  year: number;
  models: string[];
}) => {
  const timeUsed = yearData?.timeUsedDaily || 0;
  const utilization = yearData?.utilizationPercent || 0;
  const assignments = yearData?.assignments || [];

  // Build lookup for quick access
  const assignmentsByModel = new Map(
    assignments.map(a => [a.modelName, a])
  );

  const utilizationColor = utilization > 100
    ? 'text-red-600 font-medium'
    : utilization >= 70
      ? 'text-green-600 font-medium'
      : utilization > 0
        ? 'text-yellow-600'
        : 'text-gray-400';

  return (
    <>
      <td className="px-3 py-2 text-sm text-right text-gray-700 border-l">
        {Math.round(timeUsed).toLocaleString()}
      </td>
      <td className={`px-3 py-2 text-sm text-right ${utilizationColor}`}>
        {utilization.toFixed(2)}%
      </td>
      {/* Pieces per model */}
      {models.map(model => {
        const assignment = assignmentsByModel.get(model);
        const pieces = assignment ? Math.round(assignment.allocatedUnitsDaily * 240) : 0;
        return (
          <td key={`${year}-${model}-pieces`} className="px-3 py-2 text-sm text-right text-gray-600">
            {pieces > 0 ? pieces.toLocaleString() : '-'}
          </td>
        );
      })}
      {/* Seconds per model */}
      {models.map(model => {
        const assignment = assignmentsByModel.get(model);
        const seconds = assignment ? Math.round(assignment.timeRequiredSeconds * 240) : 0;
        return (
          <td key={`${year}-${model}-seconds`} className="px-3 py-2 text-sm text-right text-gray-600">
            {seconds > 0 ? seconds.toLocaleString() : '-'}
          </td>
        );
      })}
    </>
  );
};

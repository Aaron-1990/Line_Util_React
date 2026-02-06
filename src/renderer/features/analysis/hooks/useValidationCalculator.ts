// ============================================
// VALIDATION CALCULATOR HOOK
// Phase: Optimization Results Validation
// Framework: Híbrido v2.0
// ============================================

import { useEffect, useState, useMemo } from 'react';
import { YearOptimizationResult } from '@shared/types';
import {
  AreaValidationSummary,
  ModelValidationRow,
  ValidationStatus
} from '@shared/types/validation';
import { DEFAULT_VALIDATION_THRESHOLDS } from '@shared/constants/validation';
import { PRODUCT_VOLUME_CHANNELS } from '@shared/constants';

/**
 * Volume data from database
 */
interface VolumeData {
  modelId: string;
  year: number;
  volume: number;
  operationsDays: number;
}

/**
 * Custom hook to calculate validation rows from analysis results
 *
 * @param yearResults - Array of optimization results for multiple years
 * @returns Map of validation summaries: Map<area, Map<year, AreaValidationSummary>>
 */
export function useValidationCalculator(
  yearResults: YearOptimizationResult[]
): Map<string, Map<number, AreaValidationSummary>> {
  const [volumesByYear, setVolumesByYear] = useState<Map<number, VolumeData[]>>(new Map());
  const [loading, setLoading] = useState(false);

  // Get all unique years from results
  const years = useMemo(() => yearResults.map(yr => yr.year), [yearResults]);

  // Fetch volumes for all years
  useEffect(() => {
    if (!years.length) return;

    setLoading(true);

    // Fetch volumes for each year in parallel
    Promise.all(
      years.map(async (year): Promise<{ year: number; volumes: VolumeData[] }> => {
        try {
          const response = await window.electronAPI.invoke<{ success: boolean; data?: VolumeData[]; error?: string }>(
            PRODUCT_VOLUME_CHANNELS.GET_BY_YEAR,
            year
          );
          return {
            year,
            volumes: (response.success && response.data ? response.data : []) as VolumeData[]
          };
        } catch (error) {
          console.error(`IPC error fetching volumes for year ${year}:`, error);
          return { year, volumes: [] };
        }
      })
    )
    .then((results) => {
      const volumeMap = new Map<number, VolumeData[]>();
      results.forEach(({ year, volumes }) => {
        volumeMap.set(year, volumes);
      });
      setVolumesByYear(volumeMap);
    })
    .finally(() => setLoading(false));
  }, [years]);

  // Calculate validation rows for all years and areas
  const validationsByAreaAndYear = useMemo((): Map<string, Map<number, AreaValidationSummary>> => {
    if (!yearResults.length || loading) return new Map();

    const resultMap = new Map<string, Map<number, AreaValidationSummary>>();

    // Process each year
    yearResults.forEach((yearResult) => {
      const volumes = volumesByYear.get(yearResult.year) || [];
      if (!volumes.length) return; // Skip years without volumes

      // Group line results by area for this year
      const areaGroups = new Map<string, typeof yearResult.lines>();
      yearResult.lines.forEach((lineResult) => {
        const area = lineResult.area;
        if (!areaGroups.has(area)) {
          areaGroups.set(area, []);
        }
        areaGroups.get(area)!.push(lineResult);
      });

      // Calculate validation for each area in this year
      areaGroups.forEach((lineResults, area) => {
        // Aggregate distributed units per model
        const modelDistribution = new Map<string, { name: string; units: number }>();

        lineResults.forEach((lineResult) => {
          lineResult.assignments.forEach((assignment) => {
            const current = modelDistribution.get(assignment.modelId) || {
              name: assignment.modelName,
              units: 0
            };

            // Get operations days from the first volume entry
            const operationsDays = volumes.length > 0 && volumes[0] ? volumes[0].operationsDays : 240;

            // Calculate annual units: daily allocation × operations days
            current.units += assignment.allocatedUnitsDaily * operationsDays;
            modelDistribution.set(assignment.modelId, current);
          });
        });

        // Create validation rows
        const validationRows: ModelValidationRow[] = [];
        let totalDistributed = 0;
        let totalVolume = 0;

        modelDistribution.forEach((distribution, modelId) => {
          const volumeData = volumes.find(v => v.modelId === modelId);
          const volumeUnits = volumeData?.volume || 0;
          const distributedUnits = Math.round(distribution.units);
          const coverageRatio = volumeUnits > 0 ? distributedUnits / volumeUnits : 0;
          const coveragePercent = coverageRatio * 100;

          const status = determineStatus(coverageRatio, DEFAULT_VALIDATION_THRESHOLDS);

          validationRows.push({
            modelId,
            modelName: distribution.name,
            distributedUnits,
            volumeUnitsAnnual: volumeUnits,
            coveragePercent,
            status,
            deltaUnits: distributedUnits - volumeUnits
          });

          totalDistributed += distributedUnits;
          totalVolume += volumeUnits;
        });

        const overallCoverage = totalVolume > 0 ? (totalDistributed / totalVolume) * 100 : 0;

        const summary: AreaValidationSummary = {
          area,
          year: yearResult.year,
          models: validationRows,
          totalDistributed,
          totalVolume,
          totalDelta: totalDistributed - totalVolume,
          overallCoverage
        };

        // Add to result map: area -> year -> summary
        if (!resultMap.has(area)) {
          resultMap.set(area, new Map());
        }
        resultMap.get(area)!.set(yearResult.year, summary);
      });
    });

    return resultMap;
  }, [yearResults, volumesByYear, loading]);

  return validationsByAreaAndYear;
}

/**
 * Determines validation status based on coverage ratio and thresholds
 *
 * @param coverageRatio - Ratio of distributed to volume (0.99 = 99%)
 * @param thresholds - Validation threshold configuration
 * @returns ValidationStatus
 */
function determineStatus(
  coverageRatio: number,
  thresholds: typeof DEFAULT_VALIDATION_THRESHOLDS
): ValidationStatus {
  if (coverageRatio >= thresholds.ok.min && coverageRatio <= thresholds.ok.max) {
    return 'ok';
  }
  if (coverageRatio > thresholds.over.min) {
    return 'over';
  }
  if (coverageRatio >= thresholds.under.min && coverageRatio < thresholds.under.max) {
    return 'under';
  }
  if (coverageRatio >= thresholds.alert.min && coverageRatio < thresholds.alert.max) {
    return 'alert';
  }
  return 'critical';
}

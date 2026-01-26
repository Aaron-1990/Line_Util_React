// ============================================
// CONSTRAINT TIMELINE VIEW
// Multi-year capacity analysis matrix
// Shows constraint evolution across years
// Enhanced with dedicated line visibility & unfulfilled demand drill-down
// ============================================

import { useMemo, useState } from 'react';
import {
  X,
  Eye,
  AlertTriangle,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  Layers
} from 'lucide-react';
import { OptimizationResult, AreaSummary, SystemConstraint, ConstrainedLineDetail } from '@shared/types';

// ============================================
// PROPS
// ============================================

interface AreaSequence {
  code: string;
  sequence: number;
}

interface ConstraintTimelineProps {
  results: OptimizationResult;
  areaSequences?: AreaSequence[];  // Optional area ordering from database
  onClose?: () => void;
  onViewDetails?: () => void;
}

// ============================================
// COLOR SCHEME (aligned with IE recommendations)
// ============================================

const UTILIZATION_COLORS = {
  healthy: '#22C55E',      // Green: < 80%
  monitor: '#F59E0B',      // Yellow: 80-90%
  action: '#F97316',       // Orange: 90-95%
  critical: '#EF4444',     // Red: 95-100%
  overflow: '#991B1B',     // Dark Red: > 100%
};

function getUtilizationColor(percent: number): string {
  if (percent > 100) return UTILIZATION_COLORS.overflow;
  if (percent >= 95) return UTILIZATION_COLORS.critical;
  if (percent >= 90) return UTILIZATION_COLORS.action;
  if (percent >= 80) return UTILIZATION_COLORS.monitor;
  return UTILIZATION_COLORS.healthy;
}

function getUtilizationBgColor(percent: number): string {
  const color = getUtilizationColor(percent);
  return `${color}20`; // 20% opacity for background
}

function getRiskLevel(percent: number): string {
  if (percent > 100) return 'Overflow';
  if (percent >= 95) return 'Critical';
  if (percent >= 90) return 'Action Req.';
  if (percent >= 80) return 'Monitor';
  return 'Healthy';
}

// ============================================
// HELPER FUNCTIONS
// ============================================

interface AreaYearData {
  area: string;
  year: number;
  utilization: number;
  isConstraint: boolean;
  constraintReason?: 'unfulfilled_demand' | 'highest_utilization';
  unfulfilledUnitsDaily: number;
  unfulfilledUnitsYearly: number;
  totalLines: number;
  linesAtCapacity: number;
  headroomHours: number; // Available hours before hitting 100%
  totalTimeAvailable: number;
  totalTimeUsed: number;
}

function calculateHeadroomHours(
  utilization: number,
  totalLines: number,
  avgTimeAvailablePerLine: number
): number {
  // If utilization >= 100%, no headroom
  if (utilization >= 100) return 0;

  // Headroom = (100% - current%) * total available time
  const totalTimeAvailable = totalLines * avgTimeAvailablePerLine;
  const headroomPercent = 100 - utilization;
  const headroomSeconds = (headroomPercent / 100) * totalTimeAvailable;

  // Convert to hours
  return headroomSeconds / 3600;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const ConstraintTimeline = ({
  results,
  areaSequences,
  onClose,
  onViewDetails
}: ConstraintTimelineProps) => {
  // State for expanded constraint detail view
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const [expandedUnfulfilled, setExpandedUnfulfilled] = useState<number | null>(null);

  // Extract years from results
  const years = useMemo(() => {
    return results.yearResults.map(yr => yr.year).sort((a, b) => a - b);
  }, [results.yearResults]);

  // Extract unique areas in flow order
  // Uses database sequences if available, otherwise falls back to hardcoded order
  const areas = useMemo(() => {
    // Fallback hardcoded order if no sequences provided
    const fallbackOrder = ['SMT', 'ICT', 'CONFORMAL', 'ROUTER', 'FINAL ASSY', 'FINAL ASSEMBLY', 'ASSEMBLY', 'TEST'];

    // Build sequence map from props (if available)
    const sequenceMap = new Map<string, number>();
    if (areaSequences && areaSequences.length > 0) {
      areaSequences.forEach(area => {
        sequenceMap.set(area.code.toUpperCase(), area.sequence);
      });
    }

    const areaSet = new Set<string>();

    results.yearResults.forEach(yr => {
      yr.areaSummary?.forEach(area => areaSet.add(area.area));
      // Fallback to lines if areaSummary not available
      if (!yr.areaSummary || yr.areaSummary.length === 0) {
        yr.lines.forEach(line => areaSet.add(line.area));
      }
    });

    return Array.from(areaSet).sort((a, b) => {
      // Use database sequences if available
      if (sequenceMap.size > 0) {
        const aSeq = sequenceMap.get(a.toUpperCase()) ?? 999;
        const bSeq = sequenceMap.get(b.toUpperCase()) ?? 999;
        if (aSeq !== bSeq) return aSeq - bSeq;
        return a.localeCompare(b);
      }

      // Fallback to hardcoded order
      const aIndex = fallbackOrder.indexOf(a.toUpperCase());
      const bIndex = fallbackOrder.indexOf(b.toUpperCase());
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [results.yearResults, areaSequences]);

  // Build matrix data: area -> year -> data
  const matrixData = useMemo(() => {
    const matrix = new Map<string, Map<number, AreaYearData>>();

    results.yearResults.forEach(yearResult => {
      const year = yearResult.year;

      // Get area summaries (prefer areaSummary, fallback to calculating from lines)
      let areaSummaries: AreaSummary[] = yearResult.areaSummary || [];

      if (areaSummaries.length === 0) {
        // Calculate from lines
        const areaMap = new Map<string, {
          totalUtil: number;
          count: number;
          unfulfilled: number;
          linesAtCapacity: number;
          totalTimeAvailable: number;
          totalTimeUsed: number;
        }>();

        yearResult.lines.forEach(line => {
          if (!areaMap.has(line.area)) {
            areaMap.set(line.area, {
              totalUtil: 0,
              count: 0,
              unfulfilled: 0,
              linesAtCapacity: 0,
              totalTimeAvailable: 0,
              totalTimeUsed: 0
            });
          }
          const data = areaMap.get(line.area)!;
          data.totalUtil += line.utilizationPercent;
          data.count += 1;
          data.totalTimeAvailable += line.timeAvailableDaily;
          data.totalTimeUsed += line.timeUsedDaily;
          if (line.utilizationPercent >= 95) {
            data.linesAtCapacity += 1;
          }
        });

        // Check unfulfilled demand per area
        yearResult.unfulfilledDemand?.forEach(ud => {
          const data = areaMap.get(ud.area);
          if (data) {
            data.unfulfilled += ud.unfulfilledUnitsDaily;
          }
        });

        areaSummaries = Array.from(areaMap.entries()).map(([area, data]) => ({
          area,
          averageUtilization: data.count > 0 ? data.totalUtil / data.count : 0,
          totalUnfulfilledUnitsDaily: data.unfulfilled,
          linesAtCapacity: data.linesAtCapacity,
          totalLines: data.count,
          isSystemConstraint: yearResult.systemConstraint?.area === area,
          totalDemandUnitsDaily: 0,
          totalAllocatedUnitsDaily: 0,
          fulfillmentPercent: 100,
        }));
      }

      // Calculate time data from lines for headroom calculation
      const timeByArea = new Map<string, { available: number; used: number; count: number }>();
      yearResult.lines.forEach(line => {
        if (!timeByArea.has(line.area)) {
          timeByArea.set(line.area, { available: 0, used: 0, count: 0 });
        }
        const t = timeByArea.get(line.area)!;
        t.available += line.timeAvailableDaily;
        t.used += line.timeUsedDaily;
        t.count += 1;
      });

      // Build matrix entries
      areaSummaries.forEach(areaSummary => {
        if (!matrix.has(areaSummary.area)) {
          matrix.set(areaSummary.area, new Map());
        }

        const timeData = timeByArea.get(areaSummary.area) || { available: 0, used: 0, count: 0 };
        const avgTimePerLine = timeData.count > 0 ? timeData.available / timeData.count : 28800; // Default 8 hours

        // Calculate unfulfilled yearly from daily
        const operationsDays = 240; // Default
        const unfulfilledYearly = areaSummary.totalUnfulfilledUnitsDaily * operationsDays;

        const headroom = calculateHeadroomHours(
          areaSummary.averageUtilization,
          areaSummary.totalLines,
          avgTimePerLine
        );

        matrix.get(areaSummary.area)!.set(year, {
          area: areaSummary.area,
          year,
          utilization: areaSummary.averageUtilization,
          isConstraint: areaSummary.isSystemConstraint || yearResult.systemConstraint?.area === areaSummary.area,
          constraintReason: yearResult.systemConstraint?.area === areaSummary.area
            ? yearResult.systemConstraint.reason
            : undefined,
          unfulfilledUnitsDaily: areaSummary.totalUnfulfilledUnitsDaily,
          unfulfilledUnitsYearly: unfulfilledYearly,
          totalLines: areaSummary.totalLines,
          linesAtCapacity: areaSummary.linesAtCapacity,
          headroomHours: headroom,
          totalTimeAvailable: timeData.available,
          totalTimeUsed: timeData.used,
        });
      });
    });

    return matrix;
  }, [results.yearResults]);

  // Calculate total unfulfilled per year
  const unfulfilledByYear = useMemo(() => {
    const byYear = new Map<number, { daily: number; yearly: number; percent: number }>();

    results.yearResults.forEach(yr => {
      const totalUnfulfilledDaily = yr.summary.totalUnfulfilledUnitsDaily || 0;
      const totalUnfulfilledYearly = yr.summary.totalUnfulfilledUnitsYearly || 0;
      const fulfillmentPercent = yr.summary.overallFulfillmentPercent || 100;

      byYear.set(yr.year, {
        daily: totalUnfulfilledDaily,
        yearly: totalUnfulfilledYearly,
        percent: 100 - fulfillmentPercent
      });
    });

    return byYear;
  }, [results.yearResults]);

  // Generate constraint movement summary
  const constraintSummary = useMemo(() => {
    const movements: { year: number; area: string; constraint: SystemConstraint }[] = [];

    results.yearResults.forEach(yr => {
      if (yr.systemConstraint) {
        movements.push({
          year: yr.year,
          area: yr.systemConstraint.area,
          constraint: yr.systemConstraint
        });
      }
    });

    if (movements.length === 0) {
      return {
        text: 'No constraints identified across all years.',
        hasConstraints: false,
        constraintYears: 0,
        totalYears: years.length,
        movements: []
      };
    }

    // Build movement string
    const movementStr = movements
      .sort((a, b) => a.year - b.year)
      .map(m => `${m.area} (${m.year})`)
      .join(' → ');

    // Find recurring constraints
    const areaCounts = new Map<string, number>();
    movements.forEach(m => {
      areaCounts.set(m.area, (areaCounts.get(m.area) || 0) + 1);
    });

    const mostConstrained = Array.from(areaCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return {
      text: `Constraint path: ${movementStr}`,
      hasConstraints: true,
      constraintYears: movements.length,
      totalYears: years.length,
      mostConstrainedArea: mostConstrained?.[0],
      mostConstrainedCount: mostConstrained?.[1],
      movements
    };
  }, [results.yearResults, years.length]);

  // Get constraint for a specific year
  const getConstraintForYear = (year: number): SystemConstraint | null => {
    const yearResult = results.yearResults.find(yr => yr.year === year);
    return yearResult?.systemConstraint || null;
  };

  // Get unfulfilled demand for a specific year
  const getUnfulfilledForYear = (year: number) => {
    const yearResult = results.yearResults.find(yr => yr.year === year);
    return yearResult?.unfulfilledDemand || [];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Multi-Year Capacity Analysis
            </h2>
            <p className="text-sm text-gray-500">
              Constraint timeline across {years.length} years ({years[0]} - {years[years.length - 1]}) |
              Execution: {results.metadata.executionTimeMs}ms
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onViewDetails && (
              <button
                onClick={onViewDetails}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Eye className="w-4 h-4" />
                View Details
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Constraint Summary Banner */}
          <div className={`p-4 rounded-lg border-2 ${
            constraintSummary.hasConstraints
              ? 'bg-amber-50 border-amber-300'
              : 'bg-green-50 border-green-300'
          }`}>
            <div className="flex items-start gap-3">
              {constraintSummary.hasConstraints ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <TrendingUp className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${
                  constraintSummary.hasConstraints ? 'text-amber-800' : 'text-green-800'
                }`}>
                  {constraintSummary.text}
                </p>
                {constraintSummary.hasConstraints && (
                  <p className="text-sm text-amber-700 mt-1">
                    {constraintSummary.constraintYears} of {constraintSummary.totalYears} years have capacity constraints.
                    {constraintSummary.mostConstrainedArea && (
                      <> Most impacted area: <strong>{constraintSummary.mostConstrainedArea}</strong> ({constraintSummary.mostConstrainedCount} years)</>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 min-w-[140px]">
                    Area
                  </th>
                  {years.map(year => (
                    <th
                      key={year}
                      className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]"
                    >
                      {year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {areas.map((area, idx) => (
                  <tr key={area} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-inherit z-10">
                      <div className="flex flex-col">
                        <span>{area}</span>
                        {years[0] !== undefined && matrixData.get(area)?.get(years[0])?.totalLines && (
                          <span className="text-xs text-gray-500">
                            ({matrixData.get(area)?.get(years[0])?.totalLines} lines)
                          </span>
                        )}
                      </div>
                    </td>
                    {years.map(year => {
                      const data = matrixData.get(area)?.get(year);
                      if (!data) {
                        return (
                          <td key={year} className="px-4 py-3 text-center text-gray-400">
                            -
                          </td>
                        );
                      }
                      return (
                        <UtilizationCell key={year} data={data} />
                      );
                    })}
                  </tr>
                ))}

                {/* Unfulfilled Demand Row */}
                <tr className="bg-gray-100 border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700 sticky left-0 bg-gray-100 z-10">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      Unfulfilled
                    </div>
                  </td>
                  {years.map(year => {
                    const data = unfulfilledByYear.get(year);
                    const hasUnfulfilled = data && data.yearly > 0;
                    return (
                      <td
                        key={year}
                        className={`px-4 py-3 text-center ${
                          hasUnfulfilled ? 'bg-red-50' : ''
                        }`}
                      >
                        {hasUnfulfilled ? (
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-bold text-red-600">
                              {data.percent.toFixed(1)}%
                            </span>
                            <span className="text-xs text-red-500">
                              {Math.round(data.yearly).toLocaleString()} units
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-green-600">0%</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Constraint Year Selector - Click to drill down */}
          {constraintSummary.hasConstraints && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-700">Constraint Drill-Down</span>
                <span className="text-xs text-gray-500 ml-2">Click a year to see dedicated/shared line breakdown</span>
              </div>
              <div className="flex flex-wrap gap-2 p-3 bg-white">
                {constraintSummary.movements?.map(({ year, area, constraint }) => (
                  <button
                    key={year}
                    onClick={() => setExpandedYear(expandedYear === year ? null : year)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      expandedYear === year
                        ? 'bg-amber-100 border-amber-400 text-amber-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {expandedYear === year ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span>{year}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                        {area}
                      </span>
                      {/* Show constraint type badge if available */}
                      {constraint.constraintType && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          constraint.constraintType === 'dedicated_line_bottleneck'
                            ? 'bg-purple-100 text-purple-700'
                            : constraint.constraintType === 'shared_capacity_constraint'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {constraint.constraintType === 'dedicated_line_bottleneck' && '🔒 Dedicated'}
                          {constraint.constraintType === 'shared_capacity_constraint' && '🔓 Shared'}
                          {constraint.constraintType === 'mixed_constraint' && '⚡ Mixed'}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Expanded Constraint Detail Panel */}
              {expandedYear !== null && (
                <ConstraintDetailPanel
                  year={expandedYear}
                  constraint={getConstraintForYear(expandedYear)}
                  unfulfilledDemand={getUnfulfilledForYear(expandedYear)}
                />
              )}
            </div>
          )}

          {/* Unfulfilled Demand Drill-Down */}
          {years.some(year => (unfulfilledByYear.get(year)?.yearly || 0) > 0) && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-semibold text-gray-700">Unfulfilled Demand Breakdown</span>
                <span className="text-xs text-gray-500 ml-2">Click a year to see top models contributing to shortfall</span>
              </div>
              <div className="flex flex-wrap gap-2 p-3 bg-white">
                {years.map(year => {
                  const data = unfulfilledByYear.get(year);
                  if (!data || data.yearly === 0) return null;
                  return (
                    <button
                      key={year}
                      onClick={() => setExpandedUnfulfilled(expandedUnfulfilled === year ? null : year)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        expandedUnfulfilled === year
                          ? 'bg-red-100 border-red-400 text-red-800'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {expandedUnfulfilled === year ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <span>{year}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                          {data.percent.toFixed(1)}% unmet
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Expanded Unfulfilled Detail Panel */}
              {expandedUnfulfilled !== null && (
                <UnfulfilledDetailPanel
                  year={expandedUnfulfilled}
                  unfulfilledDemand={getUnfulfilledForYear(expandedUnfulfilled)}
                />
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <span className="font-semibold text-gray-700">Risk Levels:</span>
            <LegendItem color={UTILIZATION_COLORS.healthy} label="< 80% Healthy" />
            <LegendItem color={UTILIZATION_COLORS.monitor} label="80-90% Monitor" />
            <LegendItem color={UTILIZATION_COLORS.action} label="90-95% Action Req." />
            <LegendItem color={UTILIZATION_COLORS.critical} label="95-100% Critical" />
            <LegendItem color={UTILIZATION_COLORS.overflow} label="> 100% Overflow" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// SUB-COMPONENTS
// ============================================

interface UtilizationCellProps {
  data: AreaYearData;
}

const UtilizationCell = ({ data }: UtilizationCellProps) => {
  const color = getUtilizationColor(data.utilization);
  const bgColor = getUtilizationBgColor(data.utilization);
  const riskLevel = getRiskLevel(data.utilization);

  return (
    <td
      className="px-2 py-2 text-center relative"
      style={{ backgroundColor: bgColor }}
    >
      {/* Constraint Badge */}
      {data.isConstraint && (
        <div className="absolute -top-1 -right-1 bg-red-700 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shadow-sm z-10">
          CONSTR.
        </div>
      )}

      <div className="flex flex-col items-center gap-1">
        {/* Utilization Percentage */}
        <span
          className="text-lg font-bold"
          style={{ color }}
        >
          {data.utilization.toFixed(0)}%
        </span>

        {/* Risk Level Badge */}
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: color,
            color: 'white'
          }}
        >
          {riskLevel}
        </span>

        {/* Headroom Hours (P2) */}
        {data.utilization < 100 && data.headroomHours > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-gray-600">
            <Clock className="w-3 h-3" />
            <span>+{Math.round(data.headroomHours)}h</span>
          </div>
        )}

        {/* Overflow indicator */}
        {data.utilization > 100 && (
          <span className="text-[10px] text-red-700 font-medium">
            OVERFLOW
          </span>
        )}
      </div>
    </td>
  );
};

interface LegendItemProps {
  color: string;
  label: string;
}

const LegendItem = ({ color, label }: LegendItemProps) => {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-3 h-3 rounded"
        style={{ backgroundColor: color }}
      />
      <span className="text-gray-600">{label}</span>
    </div>
  );
};

// ============================================
// CONSTRAINT DETAIL PANEL
// Shows dedicated vs shared line breakdown
// ============================================

interface ConstraintDetailPanelProps {
  year: number;
  constraint: SystemConstraint | null;
  // Reserved for future use - showing unfulfilled context alongside constraint
  unfulfilledDemand?: { modelId: string; modelName: string; area: string; unfulfilledUnitsDaily: number }[];
}

const ConstraintDetailPanel = ({ year, constraint }: ConstraintDetailPanelProps) => {
  if (!constraint) {
    return (
      <div className="p-4 bg-gray-50 border-t">
        <p className="text-sm text-gray-500">No constraint data available for {year}</p>
      </div>
    );
  }

  // Group constrained lines by type
  const dedicatedLines = constraint.constrainedLines?.filter(l => l.lineType === 'dedicated') || [];
  const sharedLines = constraint.constrainedLines?.filter(l => l.lineType === 'shared') || [];

  // Get constraint type label and description
  const constraintTypeLabel = {
    'dedicated_line_bottleneck': { label: 'Dedicated Line Bottleneck', icon: Lock, color: 'purple' },
    'shared_capacity_constraint': { label: 'Shared Capacity Constraint', icon: Unlock, color: 'blue' },
    'mixed_constraint': { label: 'Mixed Constraint', icon: Layers, color: 'orange' }
  }[constraint.constraintType] || { label: 'Unknown', icon: AlertTriangle, color: 'gray' };

  const IconComponent = constraintTypeLabel.icon;

  return (
    <div className="border-t bg-white">
      {/* Constraint Header */}
      <div className={`px-4 py-3 bg-${constraintTypeLabel.color}-50 border-b border-${constraintTypeLabel.color}-200`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${constraintTypeLabel.color}-100`}>
            <IconComponent className={`w-5 h-5 text-${constraintTypeLabel.color}-600`} />
          </div>
          <div>
            <h4 className={`font-semibold text-${constraintTypeLabel.color}-800`}>
              {constraint.area} - {constraintTypeLabel.label}
            </h4>
            <p className="text-sm text-gray-600 mt-0.5">
              {constraint.constraintReason}
            </p>
          </div>
        </div>
        <div className="mt-2 flex gap-4 text-sm">
          <span className="px-2 py-1 bg-white rounded border">
            Utilization: <strong>{constraint.utilizationPercent.toFixed(1)}%</strong>
          </span>
          {constraint.unfulfilledUnitsDaily > 0 && (
            <span className="px-2 py-1 bg-red-100 rounded border border-red-200 text-red-700">
              Unfulfilled: <strong>{Math.round(constraint.unfulfilledUnitsDaily).toLocaleString()}</strong> units/day
            </span>
          )}
        </div>
      </div>

      {/* Constrained Lines Breakdown */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dedicated Lines */}
        {dedicatedLines.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-purple-50 px-3 py-2 border-b flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-600" />
              <span className="font-semibold text-purple-800 text-sm">
                Dedicated Lines ({dedicatedLines.length})
              </span>
              <span className="text-xs text-purple-600 ml-auto">Cannot shift work</span>
            </div>
            <div className="divide-y">
              {dedicatedLines.map(line => (
                <ConstrainedLineRow key={line.lineId} line={line} type="dedicated" />
              ))}
            </div>
          </div>
        )}

        {/* Shared Lines */}
        {sharedLines.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-blue-50 px-3 py-2 border-b flex items-center gap-2">
              <Unlock className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-blue-800 text-sm">
                Shared Lines ({sharedLines.length})
              </span>
              <span className="text-xs text-blue-600 ml-auto">Can rebalance work</span>
            </div>
            <div className="divide-y">
              {sharedLines.map(line => (
                <ConstrainedLineRow key={line.lineId} line={line} type="shared" />
              ))}
            </div>
          </div>
        )}

        {/* No constrained lines */}
        {dedicatedLines.length === 0 && sharedLines.length === 0 && (
          <div className="col-span-2 text-center py-4 text-gray-500">
            No specific line bottlenecks identified (older optimization data)
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// CONSTRAINED LINE ROW
// ============================================

interface ConstrainedLineRowProps {
  line: ConstrainedLineDetail;
  type: 'dedicated' | 'shared';
}

const ConstrainedLineRow = ({ line, type }: ConstrainedLineRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const bgColor = type === 'dedicated' ? 'purple' : 'blue';

  return (
    <div className="bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <span className="font-medium text-gray-900 text-sm">{line.lineName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-bold"
            style={{ color: getUtilizationColor(line.utilizationPercent) }}
          >
            {line.utilizationPercent.toFixed(0)}%
          </span>
          {line.unfulfilledUnitsDaily > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
              {Math.round(line.unfulfilledUnitsDaily)} unmet
            </span>
          )}
        </div>
      </button>

      {/* Expanded: Top unfulfilled models for this line */}
      {expanded && line.topUnfulfilledModels && line.topUnfulfilledModels.length > 0 && (
        <div className={`px-3 pb-2 bg-${bgColor}-50/50`}>
          <p className="text-xs font-semibold text-gray-600 mb-1 pl-6">Top Unfulfilled Models:</p>
          <div className="pl-6 space-y-1">
            {line.topUnfulfilledModels.map(model => (
              <div
                key={model.modelId}
                className="flex items-center justify-between text-xs bg-white px-2 py-1 rounded border"
              >
                <span className="text-gray-700">{model.modelName}</span>
                <span className="text-red-600 font-medium">
                  {Math.round(model.unfulfilledUnits)} units ({model.percentOfLineUnfulfilled}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// UNFULFILLED DEMAND DETAIL PANEL
// Shows top models contributing to shortfall
// ============================================

interface UnfulfilledDemand {
  modelId: string;
  modelName: string;
  area: string;
  unfulfilledUnitsDaily: number;
  unfulfilledUnitsYearly?: number;
  demandUnitsDaily?: number;
  fulfillmentPercent?: number;
}

interface UnfulfilledDetailPanelProps {
  year: number;
  unfulfilledDemand: UnfulfilledDemand[];
}

const UnfulfilledDetailPanel = ({ year, unfulfilledDemand }: UnfulfilledDetailPanelProps) => {
  if (!unfulfilledDemand || unfulfilledDemand.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border-t">
        <p className="text-sm text-gray-500">No unfulfilled demand for {year}</p>
      </div>
    );
  }

  // Group by area and sort by unfulfilled units
  const byArea = new Map<string, UnfulfilledDemand[]>();
  unfulfilledDemand.forEach(ud => {
    if (!byArea.has(ud.area)) {
      byArea.set(ud.area, []);
    }
    byArea.get(ud.area)!.push(ud);
  });

  // Sort each area's models by unfulfilled units (descending)
  byArea.forEach(models => {
    models.sort((a, b) => b.unfulfilledUnitsDaily - a.unfulfilledUnitsDaily);
  });

  // Sort areas by total unfulfilled (descending)
  const sortedAreas = Array.from(byArea.entries()).sort((a, b) => {
    const totalA = a[1].reduce((sum, m) => sum + m.unfulfilledUnitsDaily, 0);
    const totalB = b[1].reduce((sum, m) => sum + m.unfulfilledUnitsDaily, 0);
    return totalB - totalA;
  });

  return (
    <div className="border-t bg-white p-4">
      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-500" />
        {year} Unfulfilled Demand by Area
      </h4>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sortedAreas.map(([area, models]) => {
          const totalAreaUnfulfilled = models.reduce((sum, m) => sum + m.unfulfilledUnitsDaily, 0);
          // Show top 5 models per area
          const topModels = models.slice(0, 5);
          const remainingCount = models.length - 5;

          return (
            <div key={area} className="border rounded-lg overflow-hidden">
              <div className="bg-red-50 px-3 py-2 border-b flex items-center justify-between">
                <span className="font-semibold text-red-800 text-sm">{area}</span>
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                  {Math.round(totalAreaUnfulfilled).toLocaleString()} units/day
                </span>
              </div>
              <div className="divide-y">
                {topModels.map((model, idx) => {
                  // Calculate Pareto percentage (cumulative contribution)
                  const cumulativeUnfulfilled = models
                    .slice(0, idx + 1)
                    .reduce((sum, m) => sum + m.unfulfilledUnitsDaily, 0);
                  const paretoPercent = (cumulativeUnfulfilled / totalAreaUnfulfilled) * 100;

                  return (
                    <div
                      key={model.modelId}
                      className="px-3 py-2 flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">#{idx + 1}</span>
                        <span className="text-gray-800">{model.modelName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-red-600 font-medium">
                          {Math.round(model.unfulfilledUnitsDaily).toLocaleString()}
                        </span>
                        {model.fulfillmentPercent !== undefined && (
                          <span className="text-xs text-gray-500">
                            ({model.fulfillmentPercent.toFixed(0)}% fulfilled)
                          </span>
                        )}
                        <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                          Σ {paretoPercent.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
                {remainingCount > 0 && (
                  <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50">
                    +{remainingCount} more models with unfulfilled demand
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pareto Note */}
      <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Σ %</span>
        shows cumulative contribution (Pareto) - focus on top models to address majority of shortfall
      </p>
    </div>
  );
};

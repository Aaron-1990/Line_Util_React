// ============================================
// VALUE STREAM DASHBOARD
// High-level visualization of production capacity
// Shows areas as connected flow, summary metrics, and unfulfilled demand
// ============================================

import { useMemo } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Activity,
  X,
  Eye
} from 'lucide-react';
import { YearOptimizationResult, AreaSummary } from '@shared/types';

// ============================================
// PROPS
// ============================================

interface ValueStreamDashboardProps {
  yearResult: YearOptimizationResult;
  onClose?: () => void;
  onViewDetails?: () => void;
}

// ============================================
// COLOR SCHEME (IE recommendations)
// ============================================

const UTILIZATION_COLORS = {
  underutilized: '#3B82F6',  // Blue: 0-70%
  optimal: '#22C55E',        // Green: 70-85%
  caution: '#F59E0B',        // Yellow: 85-95%
  atCapacity: '#F97316',     // Orange: 95-100%
  overloaded: '#EF4444',     // Red: >100%
  bottleneck: '#991B1B',     // Dark Red: system constraint
};

function getUtilizationColor(percent: number, isConstraint: boolean): string {
  if (isConstraint) return UTILIZATION_COLORS.bottleneck;
  if (percent > 100) return UTILIZATION_COLORS.overloaded;
  if (percent >= 95) return UTILIZATION_COLORS.atCapacity;
  if (percent >= 85) return UTILIZATION_COLORS.caution;
  if (percent >= 70) return UTILIZATION_COLORS.optimal;
  return UTILIZATION_COLORS.underutilized;
}

function getUtilizationLabel(percent: number): string {
  if (percent > 100) return 'Overloaded';
  if (percent >= 95) return 'At Capacity';
  if (percent >= 85) return 'Caution';
  if (percent >= 70) return 'Optimal';
  return 'Underutilized';
}

// ============================================
// MAIN COMPONENT
// ============================================

export const ValueStreamDashboard = ({
  yearResult,
  onClose,
  onViewDetails
}: ValueStreamDashboardProps) => {
  // Generate areaSummary from lines if not available (backward compatibility)
  const areaSummary = useMemo((): AreaSummary[] => {
    // Use new areaSummary if available
    if (yearResult.areaSummary && Array.isArray(yearResult.areaSummary)) {
      return yearResult.areaSummary;
    }

    // Otherwise, generate from existing line data
    const areaMap = new Map<string, {
      lines: typeof yearResult.lines;
      totalDemand: number;
      totalAllocated: number;
    }>();

    yearResult.lines.forEach(line => {
      if (!areaMap.has(line.area)) {
        areaMap.set(line.area, { lines: [], totalDemand: 0, totalAllocated: 0 });
      }
      const areaData = areaMap.get(line.area)!;
      areaData.lines.push(line);

      // Sum up allocations
      line.assignments.forEach(a => {
        areaData.totalDemand += a.demandUnitsDaily;
        areaData.totalAllocated += a.allocatedUnitsDaily;
      });
    });

    return Array.from(areaMap.entries()).map(([area, data]) => {
      const avgUtil = data.lines.reduce((sum, l) => sum + l.utilizationPercent, 0) / data.lines.length;
      const linesAtCapacity = data.lines.filter(l => l.utilizationPercent >= 95).length;
      const unfulfilled = data.totalDemand - data.totalAllocated;
      const fulfillment = data.totalDemand > 0 ? (data.totalAllocated / data.totalDemand) * 100 : 100;

      return {
        area,
        totalDemandUnitsDaily: data.totalDemand,
        totalAllocatedUnitsDaily: data.totalAllocated,
        totalUnfulfilledUnitsDaily: Math.max(0, unfulfilled),
        fulfillmentPercent: Math.min(100, fulfillment),
        averageUtilization: avgUtil,
        linesAtCapacity,
        totalLines: data.lines.length,
        isSystemConstraint: unfulfilled > 0 && avgUtil >= 95,
      };
    });
  }, [yearResult]);

  // Sort areas by typical production flow (if known), otherwise alphabetically
  const sortedAreaSummary = useMemo(() => {
    const flowOrder = ['SMT', 'ICT', 'CONFORMAL', 'ROUTER', 'FINAL ASSY', 'ASSEMBLY', 'TEST'];

    return [...areaSummary].sort((a, b) => {
      const aIndex = flowOrder.indexOf(a.area.toUpperCase());
      const bIndex = flowOrder.indexOf(b.area.toUpperCase());

      // If both are in the flow order, sort by that
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      // If only one is in flow order, it comes first
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      // Otherwise, alphabetical
      return a.area.localeCompare(b.area);
    });
  }, [areaSummary]);

  // Top unfulfilled models (max 10)
  const topUnfulfilledModels = useMemo(() => {
    // Use new unfulfilledDemand if available
    if (yearResult.unfulfilledDemand && Array.isArray(yearResult.unfulfilledDemand)) {
      return [...yearResult.unfulfilledDemand]
        .sort((a, b) => b.unfulfilledUnitsYearly - a.unfulfilledUnitsYearly)
        .slice(0, 10);
    }
    // Otherwise return empty (no unfulfilled data available)
    return [];
  }, [yearResult.unfulfilledDemand]);

  // Calculate summary metrics with fallbacks
  const linesAtCapacityCount = useMemo(() => {
    return yearResult.lines.filter(line => line.utilizationPercent >= 95).length;
  }, [yearResult.lines]);

  // Derive fulfillment and unfulfilled from areaSummary if not in yearResult.summary
  const summaryMetrics = useMemo(() => {
    // Use new fields if available
    const fulfillment = yearResult.summary.overallFulfillmentPercent
      ?? yearResult.summary.demandFulfillmentPercent
      ?? (areaSummary.reduce((sum, a) => sum + a.fulfillmentPercent, 0) / areaSummary.length || 100);

    const totalUnfulfilled = yearResult.summary.totalUnfulfilledUnitsYearly
      ?? (areaSummary.reduce((sum, a) => sum + a.totalUnfulfilledUnitsDaily, 0) * 240);

    const constraint = yearResult.systemConstraint
      ?? areaSummary.find(a => a.isSystemConstraint)
        ? { area: areaSummary.find(a => a.isSystemConstraint)?.area, reason: 'unfulfilled_demand' as const }
        : null;

    return {
      overallFulfillment: fulfillment,
      totalUnfulfilled: totalUnfulfilled,
      systemConstraint: constraint,
    };
  }, [yearResult.summary, yearResult.systemConstraint, areaSummary]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Value Stream Analysis - {yearResult.year}
            </h2>
            <p className="text-sm text-gray-500">
              Production capacity overview and system constraints
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
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* 1. Value Stream Flow */}
          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Value Stream Flow
            </h3>
            <div className="flex items-center gap-2 overflow-x-auto pb-4">
              {sortedAreaSummary.map((area, index) => (
                <div key={area.area} className="flex items-center gap-2 shrink-0">
                  <AreaFlowBox area={area} />
                  {index < sortedAreaSummary.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 2. Summary Metrics */}
          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Summary Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={<CheckCircle2 className="w-5 h-5" />}
                label="Demand Fulfillment"
                value={`${summaryMetrics.overallFulfillment.toFixed(1)}%`}
                color={summaryMetrics.overallFulfillment >= 95 ? 'green' :
                       summaryMetrics.overallFulfillment >= 85 ? 'yellow' : 'red'}
              />
              <MetricCard
                icon={<AlertTriangle className="w-5 h-5" />}
                label="System Constraint"
                value={summaryMetrics.systemConstraint?.area || 'None'}
                subtitle={summaryMetrics.systemConstraint?.reason === 'unfulfilled_demand'
                  ? 'Unfulfilled demand'
                  : summaryMetrics.systemConstraint?.reason === 'highest_utilization'
                    ? 'Highest utilization'
                    : undefined}
                color={summaryMetrics.systemConstraint ? 'red' : 'green'}
              />
              <MetricCard
                icon={<TrendingDown className="w-5 h-5" />}
                label="Total Unfulfilled"
                value={Math.round(summaryMetrics.totalUnfulfilled).toLocaleString()}
                subtitle="units/year"
                color={summaryMetrics.totalUnfulfilled > 0 ? 'orange' : 'green'}
              />
              <MetricCard
                icon={<Activity className="w-5 h-5" />}
                label="Lines at Capacity"
                value={`${linesAtCapacityCount} of ${yearResult.summary.totalLines}`}
                subtitle={`${((linesAtCapacityCount / yearResult.summary.totalLines) * 100).toFixed(0)}% at capacity`}
                color="blue"
              />
            </div>
          </section>

          {/* 3. Unfulfilled Demand Chart */}
          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Unfulfilled Demand by Model
            </h3>
            {topUnfulfilledModels.length > 0 ? (
              <div className="space-y-3">
                {topUnfulfilledModels.map((model) => (
                  <UnfulfilledDemandBar key={model.modelId} model={model} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 bg-green-50 rounded-lg border-2 border-green-200">
                <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                <p className="text-lg font-medium text-green-800">All Demand Fulfilled!</p>
                <p className="text-sm text-green-600 mt-1">
                  Current capacity meets all production requirements
                </p>
              </div>
            )}
          </section>

          {/* Legend */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Utilization Color Legend
            </h3>
            <div className="flex flex-wrap gap-4 text-xs">
              <LegendItem color={UTILIZATION_COLORS.underutilized} label="0-70% Underutilized" />
              <LegendItem color={UTILIZATION_COLORS.optimal} label="70-85% Optimal" />
              <LegendItem color={UTILIZATION_COLORS.caution} label="85-95% Caution" />
              <LegendItem color={UTILIZATION_COLORS.atCapacity} label="95-100% At Capacity" />
              <LegendItem color={UTILIZATION_COLORS.overloaded} label=">100% Overloaded" />
              <LegendItem color={UTILIZATION_COLORS.bottleneck} label="System Constraint" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// ============================================
// SUB-COMPONENTS
// ============================================

interface AreaFlowBoxProps {
  area: AreaSummary;
}

const AreaFlowBox = ({ area }: AreaFlowBoxProps) => {
  const color = getUtilizationColor(area.averageUtilization, area.isSystemConstraint);
  const label = getUtilizationLabel(area.averageUtilization);

  return (
    <div
      className="relative flex flex-col items-center justify-center min-w-[140px] h-24 rounded-lg border-2 px-4 py-2 transition-transform hover:scale-105"
      style={{
        backgroundColor: `${color}15`,
        borderColor: color
      }}
    >
      {/* Constraint Badge */}
      {area.isSystemConstraint && (
        <div className="absolute -top-2 -right-2 bg-red-900 text-white text-xs px-2 py-0.5 rounded-full font-medium">
          Constraint
        </div>
      )}

      {/* Area Name */}
      <div className="text-sm font-semibold text-gray-900 text-center mb-1">
        {area.area}
      </div>

      {/* Utilization */}
      <div
        className="text-2xl font-bold mb-0.5"
        style={{ color }}
      >
        {area.averageUtilization.toFixed(0)}%
      </div>

      {/* Status Label */}
      <div
        className="text-xs font-medium"
        style={{ color }}
      >
        {label}
      </div>
    </div>
  );
};

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  color: 'green' | 'yellow' | 'red' | 'orange' | 'blue';
}

const MetricCard = ({ icon, label, value, subtitle, color }: MetricCardProps) => {
  const colorClasses = {
    green: 'bg-green-50 text-green-600 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
  };

  const textColorClasses = {
    green: 'text-green-800',
    yellow: 'text-yellow-800',
    red: 'text-red-800',
    orange: 'text-orange-800',
    blue: 'text-blue-800',
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${textColorClasses[color]}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
};

interface UnfulfilledDemandBarProps {
  model: {
    modelId: string;
    modelName: string;
    area: string;
    unfulfilledUnitsDaily: number;
    unfulfilledUnitsYearly: number;
    demandUnitsDaily: number;
    fulfillmentPercent: number;
  };
}

const UnfulfilledDemandBar = ({ model }: UnfulfilledDemandBarProps) => {
  const fulfillmentPercent = Math.min(model.fulfillmentPercent, 100);
  const unfulfilledPercent = 100 - fulfillmentPercent;

  return (
    <div className="space-y-1">
      {/* Model Name and Stats */}
      <div className="flex items-center justify-between text-sm">
        <div className="font-medium text-gray-900">
          {model.modelName}
          <span className="text-xs text-gray-500 ml-2">({model.area})</span>
        </div>
        <div className="text-xs text-gray-600">
          <span className="font-medium text-green-600">{fulfillmentPercent.toFixed(1)}%</span> fulfilled
          {' | '}
          <span className="font-medium text-red-600">
            {model.unfulfilledUnitsYearly.toLocaleString()}
          </span> unfulfilled
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden">
          <div className="flex h-full">
            {/* Fulfilled portion */}
            <div
              className="bg-green-500 h-full transition-all duration-300"
              style={{ width: `${fulfillmentPercent}%` }}
            />
            {/* Unfulfilled portion */}
            <div
              className="bg-red-500 h-full transition-all duration-300"
              style={{ width: `${unfulfilledPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface LegendItemProps {
  color: string;
  label: string;
}

const LegendItem = ({ color, label }: LegendItemProps) => {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-4 h-4 rounded border"
        style={{ backgroundColor: color, borderColor: color }}
      />
      <span className="text-gray-700">{label}</span>
    </div>
  );
};

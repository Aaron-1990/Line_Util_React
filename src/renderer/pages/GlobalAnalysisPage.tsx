// ============================================
// GLOBAL ANALYSIS PAGE
// Cross-plant capacity analysis dashboard
// Phase 7: Multi-Plant Support - Sprint 5
// ============================================

import { useEffect } from 'react';
import { Globe, Play, AlertTriangle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { useGlobalAnalysisStore } from '@renderer/features/global-analysis';
import { usePlantStore } from '@renderer/features/plants';
import { useNavigationStore } from '@renderer/store/useNavigationStore';

// ===== Utilization Bar Component =====

interface UtilizationBarProps {
  plantCode: string;
  plantName: string;
  utilization: number;
  color?: string;
  isConstrained: boolean;
  constraintArea?: string;
}

const UtilizationBar = ({ plantCode, plantName, utilization, color, isConstrained, constraintArea }: UtilizationBarProps) => {
  const getBarColor = () => {
    if (utilization >= 90) return 'bg-red-500';
    if (utilization >= 80) return 'bg-amber-500';
    if (utilization >= 70) return 'bg-blue-500';
    return 'bg-gray-400';
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color || '#6B7280' }}
      />
      <div className="w-24 flex-shrink-0">
        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{plantCode}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{plantName}</div>
      </div>
      <div className="flex-1">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getBarColor()} transition-all duration-500`}
            style={{ width: `${Math.min(utilization, 100)}%` }}
          />
        </div>
      </div>
      <div className="w-16 text-right">
        <span className={`font-mono text-sm font-medium ${utilization >= 90 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
          {utilization.toFixed(0)}%
        </span>
      </div>
      <div className="w-24 text-right">
        {isConstrained && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            {constraintArea || 'Constrained'}
          </span>
        )}
      </div>
    </div>
  );
};

// ===== Alert Item Component =====

interface AlertItemProps {
  type: 'critical' | 'warning' | 'info';
  message: string;
  area?: string;
}

const AlertItem = ({ type, message, area }: AlertItemProps) => {
  const config = {
    critical: { icon: AlertCircle, bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', iconColor: 'text-red-500' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', iconColor: 'text-amber-500' },
    info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', iconColor: 'text-blue-500' },
  };

  const { icon: Icon, bg, text, iconColor } = config[type];

  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg ${bg}`}>
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconColor}`} />
      <div className={`text-sm ${text}`}>
        <span>{message}</span>
        {area && <span className="ml-1 opacity-75">({area})</span>}
      </div>
    </div>
  );
};

// ===== Main Component =====

export const GlobalAnalysisPage = () => {
  const {
    selectedYear,
    availableYears,
    plantResults,
    alerts,
    isRunning,
    progress,
    error,
    lastRunAt,
    setSelectedYear,
    setAvailableYears,
    runAllPlants,
    getNetworkSummary,
  } = useGlobalAnalysisStore();

  const { getActivePlants } = usePlantStore();
  const { setCurrentPlant, setView } = useNavigationStore();

  const activePlants = getActivePlants();
  const summary = getNetworkSummary();

  // Load available years on mount
  useEffect(() => {
    // TODO: Get available years from volumes across all plants
    const currentYear = new Date().getFullYear();
    setAvailableYears([currentYear - 1, currentYear, currentYear + 1]);
  }, [setAvailableYears]);

  // Navigate to plant
  const handleOpenPlant = (plantId: string) => {
    setCurrentPlant(plantId);
    setView('canvas');
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors duration-150">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Globe className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Global Analysis
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Cross-plant capacity utilization comparison
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Year Selector */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {availableYears.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`
                    px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                    ${selectedYear === year
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}
                  `}
                >
                  {year}
                </button>
              ))}
            </div>

            {/* Run Button */}
            <button
              onClick={runAllPlants}
              disabled={isRunning || activePlants.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running ({progress.current}/{progress.total})
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run All Plants
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {plantResults.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Globe className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
            <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
              No analysis results yet
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
              Click "Run All Plants" to analyze capacity utilization across all {activePlants.length} active plants for {selectedYear}.
            </p>
            {activePlants.length === 0 && (
              <p className="text-amber-600 dark:text-amber-400 text-sm">
                No active plants found. Create plants first.
              </p>
            )}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Network Capacity Overview */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Network Capacity Overview · {selectedYear}
              </h2>
              <div className="space-y-1">
                {plantResults.map(plant => (
                  <UtilizationBar
                    key={plant.plantId}
                    plantCode={plant.plantCode}
                    plantName={plant.plantName}
                    utilization={plant.maxUtilization}
                    color={plant.color}
                    isConstrained={plant.maxUtilization >= 90}
                    constraintArea={plant.constraintArea}
                  />
                ))}
              </div>
            </div>

            {/* Summary + Alerts Row */}
            <div className="grid grid-cols-2 gap-6">
              {/* Summary Card */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Plants</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{summary.totalPlants}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Production Lines</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{summary.totalLines}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Network Avg Utilization</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {summary.networkAvgUtilization.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Unfulfilled Demand</span>
                    <span className={`font-medium ${summary.totalUnfulfilled > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {summary.totalUnfulfilled.toLocaleString()} units
                    </span>
                  </div>
                </div>
                {lastRunAt && (
                  <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    Last run: {lastRunAt.toLocaleTimeString()}
                  </p>
                )}
              </div>

              {/* Alerts Card */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                  Alerts
                </h3>
                {alerts.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No alerts</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {alerts.slice(0, 5).map((alert, i) => (
                      <AlertItem key={i} type={alert.type} message={alert.message} area={alert.area} />
                    ))}
                    {alerts.length > 5 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 pt-2">
                        +{alerts.length - 5} more alerts
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Plant Comparison Table */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Plant Comparison
                </h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Plant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Region</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lines</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Util %</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Constraint</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Headroom</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {plantResults.map(plant => (
                    <tr
                      key={plant.plantId}
                      className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: plant.color || '#6B7280' }}
                          />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{plant.plantName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{plant.plantCode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {plant.region || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                        {plant.lineCount}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`
                          font-mono text-sm font-medium
                          ${plant.maxUtilization >= 90 ? 'text-red-600 dark:text-red-400' :
                            plant.maxUtilization >= 80 ? 'text-amber-600 dark:text-amber-400' :
                            'text-gray-900 dark:text-gray-100'}
                        `}>
                          {plant.maxUtilization.toFixed(0)}%
                        </span>
                        {plant.maxUtilization >= 90 && (
                          <AlertTriangle className="w-3.5 h-3.5 inline ml-1 text-red-500" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {plant.constraintArea || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`
                          font-mono text-sm
                          ${plant.headroomPercent <= 10 ? 'text-red-600 dark:text-red-400' :
                            plant.headroomPercent >= 30 ? 'text-green-600 dark:text-green-400' :
                            'text-gray-600 dark:text-gray-400'}
                        `}>
                          {plant.headroomPercent.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenPlant(plant.plantId)}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

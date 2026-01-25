// ============================================
// EXAMPLE: Analysis Dashboard Integration
// Shows how to integrate ValueStreamDashboard with ResultsPanel
// ============================================

import { useState } from 'react';
import { useAnalysisStore, ValueStreamDashboard, ResultsPanel } from '@renderer/features/analysis';
import { BarChart3, Activity } from 'lucide-react';

/**
 * Example 1: Simple Toggle Between Views
 * Shows either dashboard or detailed results
 */
export function SimpleAnalysisView() {
  const { results } = useAnalysisStore();
  const [viewMode, setViewMode] = useState<'dashboard' | 'details'>('dashboard');

  if (!results || !results.yearResults.length) {
    return <div>No analysis results available</div>;
  }

  const firstYear = results.yearResults[0];

  return (
    <>
      {viewMode === 'dashboard' && firstYear && (
        <ValueStreamDashboard
          yearResult={firstYear}
          onClose={() => setViewMode(null)}
          onViewDetails={() => setViewMode('details')}
        />
      )}

      {viewMode === 'details' && (
        <ResultsPanel />
      )}
    </>
  );
}

/**
 * Example 2: Multi-Year Dashboard with Tab Selection
 * Allows user to select year and view mode
 */
export function MultiYearAnalysisView() {
  const { results } = useAnalysisStore();
  const [selectedYearIndex, setSelectedYearIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'dashboard' | 'details'>('dashboard');

  if (!results || !results.yearResults.length) {
    return <div>No analysis results available</div>;
  }

  const selectedYear = results.yearResults[selectedYearIndex];

  return (
    <div className="h-full flex flex-col">
      {/* View Mode Selector */}
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div className="flex gap-2">
          {results.yearResults.map((yr, idx) => (
            <button
              key={yr.year}
              onClick={() => setSelectedYearIndex(idx)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedYearIndex === idx
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {yr.year}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setViewMode('details')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'details'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Details
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        {viewMode === 'dashboard' && (
          <ValueStreamDashboard yearResult={selectedYear} />
        )}

        {viewMode === 'details' && (
          <ResultsPanel />
        )}
      </div>
    </div>
  );
}

/**
 * Example 3: Side-by-Side View (Dashboard + Quick Stats)
 * Shows dashboard with summary stats sidebar
 */
export function SideBySideAnalysisView() {
  const { results } = useAnalysisStore();
  const [selectedYearIndex, setSelectedYearIndex] = useState(0);
  const [showDashboard, setShowDashboard] = useState(false);

  if (!results || !results.yearResults.length) {
    return <div>No analysis results available</div>;
  }

  const selectedYear = results.yearResults[selectedYearIndex];

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Year Selector + Quick Stats */}
      <div className="w-64 bg-gray-50 border-r p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Select Year</h3>
          <div className="space-y-2">
            {results.yearResults.map((yr, idx) => (
              <button
                key={yr.year}
                onClick={() => setSelectedYearIndex(idx)}
                className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  selectedYearIndex === idx
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="font-medium">{yr.year}</div>
                <div className={selectedYearIndex === idx ? 'text-blue-100' : 'text-gray-500'}>
                  {yr.summary.averageUtilization.toFixed(1)}% avg
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Quick Stats</h3>
          <div className="space-y-2 text-sm">
            <div className="bg-white rounded p-2">
              <div className="text-gray-500">Lines</div>
              <div className="font-semibold text-gray-900">
                {selectedYear.summary.totalLines}
              </div>
            </div>
            <div className="bg-white rounded p-2">
              <div className="text-gray-500">Avg Utilization</div>
              <div className="font-semibold text-gray-900">
                {selectedYear.summary.averageUtilization.toFixed(1)}%
              </div>
            </div>
            <div className="bg-white rounded p-2">
              <div className="text-gray-500">Fulfillment</div>
              <div className="font-semibold text-gray-900">
                {selectedYear.summary.overallFulfillmentPercent.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowDashboard(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Activity className="w-4 h-4" />
          View Dashboard
        </button>
      </div>

      {/* Main Content - Results Panel */}
      <div className="flex-1">
        <ResultsPanel />
      </div>

      {/* Modal Dashboard */}
      {showDashboard && (
        <ValueStreamDashboard
          yearResult={selectedYear}
          onClose={() => setShowDashboard(false)}
          onViewDetails={() => setShowDashboard(false)}
        />
      )}
    </div>
  );
}

/**
 * Example 4: Dashboard-First Flow
 * Shows dashboard on analysis completion, with link to details
 */
export function DashboardFirstView() {
  const { results, resetAnalysis } = useAnalysisStore();
  const [showDetails, setShowDetails] = useState(false);

  if (!results || !results.yearResults.length) {
    return <div>Run analysis to see results</div>;
  }

  if (showDetails) {
    return <ResultsPanel />;
  }

  // Show dashboard for first year by default
  const firstYear = results.yearResults[0];

  return (
    <ValueStreamDashboard
      yearResult={firstYear}
      onClose={resetAnalysis}
      onViewDetails={() => setShowDetails(true)}
    />
  );
}

/**
 * Example 5: Embedded Dashboard (No Modal)
 * Shows dashboard inline in the page layout
 */
export function EmbeddedDashboardView() {
  const { results } = useAnalysisStore();
  const [selectedYearIndex, setSelectedYearIndex] = useState(0);

  if (!results || !results.yearResults.length) {
    return <div>No analysis results available</div>;
  }

  const selectedYear = results.yearResults[selectedYearIndex];

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Production Analysis Results
        </h1>
        <p className="text-gray-600">
          {results.yearResults.length} years analyzed |
          Avg. Utilization: {results.overallSummary.averageUtilizationAllYears}%
        </p>
      </div>

      {/* Year Tabs */}
      <div className="flex gap-2">
        {results.yearResults.map((yr, idx) => (
          <button
            key={yr.year}
            onClick={() => setSelectedYearIndex(idx)}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              selectedYearIndex === idx
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {yr.year}
          </button>
        ))}
      </div>

      {/* Dashboard Content (no modal wrapper) */}
      <div className="bg-white rounded-lg shadow p-6 space-y-8">
        {/* Value Stream Flow */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Value Stream Flow
          </h3>
          {/* Render flow visualization here */}
        </section>

        {/* Summary Metrics */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Summary Metrics
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {/* Render metric cards here */}
          </div>
        </section>

        {/* Unfulfilled Demand */}
        <section>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Unfulfilled Demand
          </h3>
          {/* Render unfulfilled demand chart here */}
        </section>
      </div>
    </div>
  );
}

/**
 * Example 6: Conditional View Based on Results
 * Automatically shows dashboard or details based on result quality
 */
export function SmartAnalysisView() {
  const { results } = useAnalysisStore();

  if (!results || !results.yearResults.length) {
    return <div>No analysis results available</div>;
  }

  const firstYear = results.yearResults[0];

  // If there are issues (unfulfilled demand, overloaded lines), show dashboard
  const hasIssues = firstYear.summary.totalUnfulfilledUnitsYearly > 0 ||
                     firstYear.summary.overloadedLines > 0;

  // If everything is optimal, show detailed results
  if (!hasIssues && firstYear.summary.averageUtilization >= 70) {
    return (
      <div className="p-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h3 className="text-green-800 font-semibold mb-1">
            Optimal Performance
          </h3>
          <p className="text-green-700 text-sm">
            All metrics are within optimal range. View detailed results below.
          </p>
        </div>
        <ResultsPanel />
      </div>
    );
  }

  // Otherwise, show dashboard to highlight issues
  return (
    <ValueStreamDashboard
      yearResult={firstYear}
      onViewDetails={() => {
        // Navigate to details view
        console.log('Switch to details');
      }}
    />
  );
}

// ============================================
// ANALYSIS CONTROL BAR
// Fixed bar at bottom of canvas view
// Contains: DataStatusPanel, YearRangeSelector, RunAnalysisButton
// ============================================

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { DataStatusPanel } from './DataStatusPanel';
import { ChangeoverToggle } from './ChangeoverToggle';
import { YearRangeSelector } from './YearRangeSelector';
import { RunAnalysisButton } from './RunAnalysisButton';
import { useAnalysisStore } from '../store/useAnalysisStore';

export const AnalysisControlBar = () => {
  const { refreshData, isDataLoading } = useAnalysisStore();

  // Load data on mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleRefresh = () => {
    refreshData();
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50">
      {/* Bar Container */}
      <div className="bg-white border-t border-gray-200 shadow-lg">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left Section: Data Status + Changeover Toggle */}
            <div className="flex items-center gap-4">
              <DataStatusPanel />

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={isDataLoading}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                title="Refresh data counts"
              >
                <RefreshCw className={`w-4 h-4 ${isDataLoading ? 'animate-spin' : ''}`} />
              </button>

              {/* Divider */}
              <div className="w-px h-6 bg-gray-200" />

              {/* Phase 5.6: Global Changeover Toggle */}
              <ChangeoverToggle />
            </div>

            {/* Center Section: Year Range Selector */}
            <div className="flex-1 flex justify-center">
              <YearRangeSelector />
            </div>

            {/* Right Section: Run Analysis Button */}
            <div className="flex items-center">
              <RunAnalysisButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

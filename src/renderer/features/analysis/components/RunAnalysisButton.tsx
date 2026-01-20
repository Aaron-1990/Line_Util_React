// ============================================
// RUN ANALYSIS BUTTON
// Multi-state button for running analysis
// States: Disabled, Ready, Running, Complete
// ============================================

import { Play, Loader2, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { useAnalysisStore } from '../store/useAnalysisStore';

export const RunAnalysisButton = () => {
  const {
    status,
    progress,
    selectedYearsCount,
    analysisError,
    startAnalysis,
    resetAnalysis,
  } = useAnalysisStore();

  const handleClick = () => {
    if (status === 'complete' || status === 'error') {
      resetAnalysis();
    } else if (status === 'ready') {
      startAnalysis();
      // TODO: Trigger actual analysis via IPC
      // For now, simulate progress
      simulateAnalysis();
    }
  };

  // Temporary: Simulate analysis for UI testing
  const simulateAnalysis = async () => {
    const store = useAnalysisStore.getState();
    const years = getSelectedYears(store);

    for (let i = 0; i < years.length; i++) {
      store.updateProgress(years[i] ?? 0, i + 1, years.length);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    store.completeAnalysis();
  };

  const getSelectedYears = (store: ReturnType<typeof useAnalysisStore.getState>): number[] => {
    const { yearSelection, availableYears } = store;

    switch (yearSelection.mode) {
      case 'all':
        return availableYears;
      case 'single':
        return yearSelection.singleYear ? [yearSelection.singleYear] : [];
      case 'range': {
        if (!yearSelection.fromYear || !yearSelection.toYear) return [];
        const from = Math.min(yearSelection.fromYear, yearSelection.toYear);
        const to = Math.max(yearSelection.fromYear, yearSelection.toYear);
        return availableYears.filter((y) => y >= from && y <= to);
      }
      default:
        return [];
    }
  };

  // Render based on status
  switch (status) {
    case 'idle':
      return (
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-400 rounded-lg cursor-not-allowed"
        >
          <Play className="w-4 h-4" />
          <span>Run Analysis</span>
        </button>
      );

    case 'ready':
      return (
        <button
          onClick={handleClick}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Play className="w-4 h-4" />
          <span>
            Run Analysis ({selectedYearsCount} year{selectedYearsCount !== 1 ? 's' : ''})
          </span>
        </button>
      );

    case 'running':
      return (
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg cursor-wait"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>
            Analyzing {progress?.currentYear}...
            {progress && ` (${progress.currentIndex}/${progress.totalYears})`}
          </span>
        </button>
      );

    case 'complete':
      return (
        <button
          onClick={handleClick}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Analysis Complete</span>
          <RotateCcw className="w-3 h-3 ml-1 opacity-70" />
        </button>
      );

    case 'error':
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={handleClick}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Error - Retry</span>
          </button>
          {analysisError && (
            <span className="text-xs text-red-600 max-w-[200px] truncate" title={analysisError}>
              {analysisError}
            </span>
          )}
        </div>
      );

    default:
      return null;
  }
};

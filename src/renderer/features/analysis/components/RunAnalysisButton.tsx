// ============================================
// RUN ANALYSIS BUTTON
// Multi-state button for running analysis
// States: Disabled, Ready, Running, Complete
// ============================================

import { Play, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAnalysisStore } from '../store/useAnalysisStore';

export const RunAnalysisButton = () => {
  const {
    status,
    progress,
    selectedYearsCount,
    analysisError,
    runOptimization,
    resetAnalysis,
  } = useAnalysisStore();

  const handleClick = () => {
    if (status === 'complete' || status === 'error') {
      resetAnalysis();
    } else if (status === 'ready') {
      runOptimization();
    }
  };

  // Render based on status
  switch (status) {
    case 'idle':
      return (
        <button
          disabled
          title="Run Analysis"
          className="flex items-center justify-center p-2 bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-lg cursor-not-allowed"
        >
          <Play className="w-4 h-4" />
        </button>
      );

    case 'ready':
      return (
        <button
          onClick={handleClick}
          title={`Run Analysis (${selectedYearsCount} year${selectedYearsCount !== 1 ? 's' : ''})`}
          className="flex items-center justify-center p-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors shadow-sm"
        >
          <Play className="w-4 h-4" />
        </button>
      );

    case 'running':
      return (
        <button
          disabled
          title={`Analyzing${progress ? ` (${progress.currentIndex}/${progress.totalYears})` : ''}...`}
          className="flex items-center justify-center p-2 bg-primary-500 dark:bg-primary-600 text-white rounded-lg cursor-wait"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
        </button>
      );

    case 'complete':
      return (
        <button
          onClick={handleClick}
          title="Analysis Complete — click to reset"
          className="flex items-center justify-center p-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors shadow-sm"
        >
          <CheckCircle2 className="w-4 h-4" />
        </button>
      );

    case 'error':
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={handleClick}
            title={analysisError ? `Error: ${analysisError} — click to retry` : 'Error — click to retry'}
            className="flex items-center justify-center p-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors shadow-sm"
          >
            <AlertCircle className="w-4 h-4" />
          </button>
          {analysisError && (
            <span className="text-xs text-red-600 dark:text-red-400 max-w-[200px] truncate" title={analysisError}>
              {analysisError}
            </span>
          )}
        </div>
      );

    default:
      return null;
  }
};

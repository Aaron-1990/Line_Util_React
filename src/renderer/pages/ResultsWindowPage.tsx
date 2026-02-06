// ============================================
// RESULTS WINDOW PAGE
// Standalone page for Optimization Results
// Opens in a separate Electron window
// ============================================

import { useEffect, useState, useCallback } from 'react';
import { OptimizationResult } from '@shared/types';
import { WINDOW_CHANNELS, RESULTS_EVENTS } from '@shared/constants';
import { ResultsPanel } from '../features/analysis/components/ResultsPanel';
import { Loader2, RefreshCw } from 'lucide-react';

interface ResultsWindowData {
  results: OptimizationResult;
  areaSequences: { code: string; sequence: number }[];
}

export const ResultsWindowPage = () => {
  const [data, setData] = useState<ResultsWindowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load data on mount
  const loadData = useCallback(async () => {
    try {
      const response = await window.electronAPI.invoke<ResultsWindowData>(
        WINDOW_CHANNELS.GET_RESULTS_DATA
      );

      if (response.success && response.data) {
        setData(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to load results data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for data updates from main process (when new analysis is run)
  useEffect(() => {
    const unsubscribe = window.electronAPI.on(
      RESULTS_EVENTS.DATA_UPDATED,
      (newData: unknown) => {
        console.log('[ResultsWindowPage] Received updated data');
        setData(newData as ResultsWindowData);
        setIsRefreshing(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Handle close - close the window
  const handleClose = () => {
    window.close();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading results data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">!</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Unable to Load Data
          </h2>
          <p className="text-gray-600 mb-6">
            {error || 'No results data available. Please run an analysis first.'}
          </p>
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 overflow-hidden relative">
      {/* Refresh indicator overlay */}
      {isRefreshing && (
        <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-4 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="text-gray-700 font-medium">Updating results...</span>
          </div>
        </div>
      )}

      {/* Results Panel - rendered directly in standalone window */}
      <ResultsPanel
        results={data.results}
        areaSequences={data.areaSequences}
        onClose={handleClose}
        isStandaloneWindow={true}
      />
    </div>
  );
};

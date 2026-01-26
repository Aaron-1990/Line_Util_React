// ============================================
// TIMELINE WINDOW PAGE
// Standalone page for Multi-Year Capacity Analysis
// Opens in a separate Electron window
// ============================================

import { useEffect, useState } from 'react';
import { OptimizationResult } from '@shared/types';
import { WINDOW_CHANNELS } from '@shared/constants';
import { ConstraintTimeline } from '../features/analysis/components/ConstraintTimeline';
import { ResultsPanel } from '../features/analysis/components/ResultsPanel';
import { Loader2 } from 'lucide-react';

interface TimelineData {
  results: OptimizationResult;
  areaSequences: { code: string; sequence: number }[];
}

export const TimelineWindowPage = () => {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResultsPanel, setShowResultsPanel] = useState(false);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await window.electronAPI.invoke<TimelineData>(
          WINDOW_CHANNELS.GET_TIMELINE_DATA
        );

        if (response.success && response.data) {
          setData(response.data);
        } else {
          setError(response.error || 'Failed to load timeline data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle close - close the window
  const handleClose = () => {
    window.close();
  };

  // Handle view details - show results panel in this window
  const handleViewDetails = () => {
    setShowResultsPanel(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading timeline data...</p>
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
            {error || 'No timeline data available. Please run an analysis first.'}
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
    <div className="h-screen bg-gray-50 overflow-hidden">
      {/* Main Timeline View - rendered directly, not as modal */}
      <ConstraintTimeline
        results={data.results}
        areaSequences={data.areaSequences}
        onClose={handleClose}
        onViewDetails={handleViewDetails}
        isStandalone={true}
      />

      {/* Results Panel Modal (within this window) */}
      {showResultsPanel && (
        <ResultsPanel
          results={data.results}
          onClose={() => setShowResultsPanel(false)}
        />
      )}
    </div>
  );
};

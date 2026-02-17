// ============================================
// DATA STATUS PANEL
// Shows Lines/Models/Volumes/Compat counts with ready status icons
// Bug 1 Fix: Added incomplete count with warning indicator
// ============================================

import { CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useAnalysisStore } from '../store/useAnalysisStore';

interface StatusItemProps {
  label: string;
  count: number;
  isLoading?: boolean;
}

const StatusItem = ({ label, count, isLoading }: StatusItemProps) => {
  const isReady = count > 0;

  return (
    <div className="flex items-center gap-2">
      {isLoading ? (
        <Loader2 className="w-4 h-4 text-gray-400 dark:text-gray-500 animate-spin" />
      ) : isReady ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
      ) : (
        <XCircle className="w-4 h-4 text-red-400" />
      )}
      <span className="text-sm text-gray-600 dark:text-gray-300">
        <span className="font-medium">{count}</span> {label}
      </span>
    </div>
  );
};

// Bug 1 Fix: Warning status item for incomplete objects
const WarningStatusItem = ({ label, count, isLoading }: StatusItemProps) => {
  if (isLoading || count === 0) return null;  // Only show if incomplete objects exist

  return (
    <div className="flex items-center gap-2" title={`${count} objects missing required data (name, area, time, or models)`}>
      <AlertTriangle className="w-4 h-4 text-amber-500" />
      <span className="text-sm text-amber-600 dark:text-amber-400">
        <span className="font-medium">{count}</span> {label}
      </span>
    </div>
  );
};

export const DataStatusPanel = () => {
  const { dataCounts, isDataLoading, isDataReady } = useAnalysisStore();

  return (
    <div className="flex items-center gap-6">
      {/* Status Badge */}
      <div
        className={`px-3 py-1 rounded-full text-xs font-medium ${
          isDataLoading
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            : isDataReady
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
            : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
        }`}
      >
        {isDataLoading ? 'Loading...' : isDataReady ? 'Data Ready' : 'Data Incomplete'}
      </div>

      {/* Entity Counts */}
      <div className="flex items-center gap-4 border-l border-gray-200 dark:border-gray-600 pl-6">
        <StatusItem
          label="Lines"
          count={dataCounts.lines}
          isLoading={isDataLoading}
        />
        {/* Bug 1 Fix: Show incomplete count if > 0 */}
        <WarningStatusItem
          label="Incomplete"
          count={dataCounts.incomplete}
          isLoading={isDataLoading}
        />
        <StatusItem
          label="Models"
          count={dataCounts.models}
          isLoading={isDataLoading}
        />
        <StatusItem
          label="Volumes"
          count={dataCounts.volumes}
          isLoading={isDataLoading}
        />
        <StatusItem
          label="Compat"
          count={dataCounts.compatibilities}
          isLoading={isDataLoading}
        />
      </div>
    </div>
  );
};

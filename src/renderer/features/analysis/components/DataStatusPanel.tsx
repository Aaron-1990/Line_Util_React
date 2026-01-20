// ============================================
// DATA STATUS PANEL
// Shows Lines/Models/Volumes/Compat counts with ready status icons
// ============================================

import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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
        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
      ) : isReady ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
      ) : (
        <XCircle className="w-4 h-4 text-red-400" />
      )}
      <span className="text-sm text-gray-600">
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
            ? 'bg-gray-100 text-gray-600'
            : isDataReady
            ? 'bg-green-100 text-green-700'
            : 'bg-yellow-100 text-yellow-700'
        }`}
      >
        {isDataLoading ? 'Loading...' : isDataReady ? 'Data Ready' : 'Data Incomplete'}
      </div>

      {/* Entity Counts */}
      <div className="flex items-center gap-4 border-l border-gray-200 pl-6">
        <StatusItem
          label="Lines"
          count={dataCounts.lines}
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

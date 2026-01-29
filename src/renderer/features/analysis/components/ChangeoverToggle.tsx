// ============================================
// CHANGEOVER TOGGLE
// Phase 5.6: Global toggle for changeover calculation
// Compact toggle switch in Analysis Control Bar
// ============================================

import { Timer, TimerOff } from 'lucide-react';
import { useAnalysisStore } from '../store/useAnalysisStore';

export const ChangeoverToggle = () => {
  const globalChangeoverEnabled = useAnalysisStore((state) => state.globalChangeoverEnabled);
  const setGlobalChangeoverEnabled = useAnalysisStore((state) => state.setGlobalChangeoverEnabled);

  const handleToggle = () => {
    setGlobalChangeoverEnabled(!globalChangeoverEnabled);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggle}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-md
          text-xs font-medium transition-all duration-200
          border
          ${globalChangeoverEnabled
            ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
          }
        `}
        title={globalChangeoverEnabled
          ? 'Changeover calculation enabled - click to disable'
          : 'Changeover calculation disabled - click to enable'
        }
      >
        {globalChangeoverEnabled ? (
          <Timer className="w-3.5 h-3.5" />
        ) : (
          <TimerOff className="w-3.5 h-3.5" />
        )}
        <span>Changeover</span>
        <span className={`
          px-1 py-0.5 rounded text-[10px] uppercase font-semibold
          ${globalChangeoverEnabled
            ? 'bg-amber-200 text-amber-800'
            : 'bg-gray-200 text-gray-600'
          }
        `}>
          {globalChangeoverEnabled ? 'ON' : 'OFF'}
        </span>
      </button>
    </div>
  );
};

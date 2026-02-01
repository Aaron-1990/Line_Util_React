// ============================================
// CHANGEOVER TOGGLE
// Phase 5.6: Global toggle for changeover calculation
// Phase 5.6.3: Simplified UI with three buttons
// ============================================

import { useState } from 'react';
import { Timer, TimerOff, RotateCcw } from 'lucide-react';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { useCanvasStore } from '../../canvas/store/useCanvasStore';
import { IPC_CHANNELS } from '@shared/constants';

export const ChangeoverToggle = () => {
  const globalChangeoverEnabled = useAnalysisStore((state) => state.globalChangeoverEnabled);
  const setGlobalChangeoverEnabled = useAnalysisStore((state) => state.setGlobalChangeoverEnabled);
  const refreshNodes = useCanvasStore((state) => state.refreshNodes);

  const [isLoading, setIsLoading] = useState(false);

  // Enable changeover for ALL lines + set global ON
  const handleAllOn = async () => {
    setIsLoading(true);
    try {
      const response = await window.electronAPI.invoke<number>(IPC_CHANNELS.LINES_SET_ALL_CHANGEOVER, true);
      if (response.success) {
        console.log(`[ChangeoverToggle] Enabled changeover for ${response.data} lines`);
        setGlobalChangeoverEnabled(true);
        await refreshNodes();
      }
    } catch (error) {
      console.error('Failed to enable all changeover:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Disable changeover for ALL lines + set global OFF
  const handleAllOff = async () => {
    setIsLoading(true);
    try {
      const response = await window.electronAPI.invoke<number>(IPC_CHANNELS.LINES_SET_ALL_CHANGEOVER, false);
      if (response.success) {
        console.log(`[ChangeoverToggle] Disabled changeover for ${response.data} lines`);
        setGlobalChangeoverEnabled(false);
        await refreshNodes();
      }
    } catch (error) {
      console.error('Failed to disable all changeover:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset all lines to match current global state + clear sticky flags
  const handleResetAll = async () => {
    setIsLoading(true);
    try {
      // Reset to current global state (pass the target state)
      const response = await window.electronAPI.invoke<number>(
        IPC_CHANNELS.LINES_RESET_ALL_CHANGEOVER,
        globalChangeoverEnabled
      );
      if (response.success) {
        console.log(`[ChangeoverToggle] Reset ${response.data} lines to ${globalChangeoverEnabled ? 'ON' : 'OFF'}`);
        await refreshNodes();
      }
    } catch (error) {
      console.error('Failed to reset changeover toggles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Status indicator */}
      <div className={`
        flex items-center gap-1.5 px-2 py-1.5
        text-xs font-medium
        ${globalChangeoverEnabled ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}
      `}>
        {globalChangeoverEnabled ? (
          <Timer className="w-3.5 h-3.5" />
        ) : (
          <TimerOff className="w-3.5 h-3.5" />
        )}
        <span>Changeover:</span>
      </div>

      {/* All ON button */}
      <button
        onClick={handleAllOn}
        disabled={isLoading}
        className={`
          px-2.5 py-1.5 rounded-md text-xs font-medium
          transition-all duration-200 border
          ${globalChangeoverEnabled
            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700'
            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:border-amber-200 dark:hover:border-amber-700 hover:text-amber-700 dark:hover:text-amber-300'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        title="Enable changeover calculation for all lines"
      >
        All ON
      </button>

      {/* All OFF button */}
      <button
        onClick={handleAllOff}
        disabled={isLoading}
        className={`
          px-2.5 py-1.5 rounded-md text-xs font-medium
          transition-all duration-200 border
          ${!globalChangeoverEnabled
            ? 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-500'
            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        title="Disable changeover calculation for all lines"
      >
        All OFF
      </button>

      {/* Reset button */}
      <button
        onClick={handleResetAll}
        disabled={isLoading}
        className={`
          flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium
          transition-all duration-200 border
          bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border-gray-200 dark:border-gray-600
          hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-700
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        title={`Reset all lines to ${globalChangeoverEnabled ? 'ON' : 'OFF'} and clear manual overrides`}
      >
        <RotateCcw className="w-3 h-3" />
        <span>Reset</span>
      </button>
    </div>
  );
};

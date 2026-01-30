// ============================================
// CHANGEOVER TOGGLE
// Phase 5.6: Global toggle for changeover calculation
// Phase 5.6.2: Dropdown menu with batch actions
// Compact toggle switch in Analysis Control Bar
// ============================================

import { useState, useRef, useEffect } from 'react';
import { Timer, TimerOff, ChevronDown, RotateCcw, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAnalysisStore } from '../store/useAnalysisStore';
import { useCanvasStore } from '../../canvas/store/useCanvasStore';
import { IPC_CHANNELS } from '@shared/constants';

export const ChangeoverToggle = () => {
  const globalChangeoverEnabled = useAnalysisStore((state) => state.globalChangeoverEnabled);
  const setGlobalChangeoverEnabled = useAnalysisStore((state) => state.setGlobalChangeoverEnabled);
  const refreshNodes = useCanvasStore((state) => state.refreshNodes);

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setGlobalChangeoverEnabled(!globalChangeoverEnabled);
  };

  const handleResetAll = async () => {
    setIsLoading(true);
    try {
      const response = await window.electronAPI.invoke<number>(IPC_CHANNELS.LINES_RESET_ALL_CHANGEOVER);
      if (response.success) {
        console.log(`Reset ${response.data} lines to default`);
        // Refresh canvas nodes to reflect changes
        refreshNodes();
      }
    } catch (error) {
      console.error('Failed to reset changeover toggles:', error);
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const handleEnableAll = async () => {
    setIsLoading(true);
    try {
      const response = await window.electronAPI.invoke<number>(IPC_CHANNELS.LINES_SET_ALL_CHANGEOVER, true);
      if (response.success) {
        console.log(`Enabled changeover for ${response.data} lines`);
        refreshNodes();
      }
    } catch (error) {
      console.error('Failed to enable all changeover toggles:', error);
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const handleDisableAll = async () => {
    setIsLoading(true);
    try {
      const response = await window.electronAPI.invoke<number>(IPC_CHANNELS.LINES_SET_ALL_CHANGEOVER, false);
      if (response.success) {
        console.log(`Disabled changeover for ${response.data} lines`);
        refreshNodes();
      }
    } catch (error) {
      console.error('Failed to disable all changeover toggles:', error);
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center">
        {/* Main toggle button */}
        <button
          onClick={handleToggle}
          className={`
            flex items-center gap-1.5 px-2.5 py-1.5 rounded-l-md
            text-xs font-medium transition-all duration-200
            border border-r-0
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

        {/* Dropdown trigger button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            flex items-center px-1.5 py-1.5 rounded-r-md
            text-xs transition-all duration-200
            border
            ${globalChangeoverEnabled
              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }
            ${isOpen ? 'bg-amber-100' : ''}
          `}
          title="More options"
          disabled={isLoading}
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
          {/* Current state indicator */}
          <div className="px-3 py-1.5 text-[10px] uppercase text-gray-400 font-semibold border-b border-gray-100">
            Global: {globalChangeoverEnabled ? 'Enabled' : 'Disabled'}
          </div>

          {/* Toggle option */}
          <button
            onClick={handleToggle}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            {globalChangeoverEnabled ? (
              <>
                <TimerOff className="w-4 h-4 text-gray-400" />
                <span>Disable Global</span>
              </>
            ) : (
              <>
                <Timer className="w-4 h-4 text-amber-500" />
                <span>Enable Global</span>
              </>
            )}
          </button>

          <div className="h-px bg-gray-100 my-1" />

          {/* Per-line batch actions */}
          <div className="px-3 py-1.5 text-[10px] uppercase text-gray-400 font-semibold">
            Per-Line Toggles
          </div>

          <button
            onClick={handleEnableAll}
            disabled={isLoading}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            <ToggleRight className="w-4 h-4 text-green-500" />
            <span>Enable All Lines</span>
          </button>

          <button
            onClick={handleDisableAll}
            disabled={isLoading}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            <ToggleLeft className="w-4 h-4 text-gray-400" />
            <span>Disable All Lines</span>
          </button>

          <div className="h-px bg-gray-100 my-1" />

          <button
            onClick={handleResetAll}
            disabled={isLoading}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4 text-blue-500" />
            <span>Reset to Defaults</span>
          </button>

          {/* Help text */}
          <div className="px-3 py-2 text-[10px] text-gray-400 border-t border-gray-100 mt-1">
            Reset clears all explicit overrides
          </div>
        </div>
      )}
    </div>
  );
};

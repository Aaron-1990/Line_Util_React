// ============================================
// YEAR RANGE SELECTOR
// Dropdowns for From/To year with All/Range/Single radio modes
// ============================================

import { Calendar } from 'lucide-react';
import { useAnalysisStore, YearSelectionMode } from '../store/useAnalysisStore';

export const YearRangeSelector = () => {
  const {
    availableYears,
    yearSelection,
    selectedYearsCount,
    setYearSelectionMode,
    setFromYear,
    setToYear,
    setSingleYear,
  } = useAnalysisStore();

  const hasYears = availableYears.length > 0;

  const handleModeChange = (mode: YearSelectionMode) => {
    setYearSelectionMode(mode);
  };

  if (!hasYears) {
    return (
      <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
        <Calendar className="w-4 h-4" />
        <span className="text-sm">No years available</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {/* Icon */}
      <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />

      {/* Mode Selector */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        <ModeButton
          mode="all"
          label="All"
          currentMode={yearSelection.mode}
          onClick={handleModeChange}
        />
        <ModeButton
          mode="range"
          label="Range"
          currentMode={yearSelection.mode}
          onClick={handleModeChange}
        />
        <ModeButton
          mode="single"
          label="Single"
          currentMode={yearSelection.mode}
          onClick={handleModeChange}
        />
      </div>

      {/* Year Dropdowns based on mode */}
      <div className="flex items-center gap-2">
        {yearSelection.mode === 'all' && (
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {availableYears[0]} - {availableYears[availableYears.length - 1]}
          </span>
        )}

        {yearSelection.mode === 'range' && (
          <>
            <YearDropdown
              value={yearSelection.fromYear}
              years={availableYears}
              onChange={setFromYear}
              label="From"
            />
            <span className="text-gray-400 dark:text-gray-500">to</span>
            <YearDropdown
              value={yearSelection.toYear}
              years={availableYears}
              onChange={setToYear}
              label="To"
            />
          </>
        )}

        {yearSelection.mode === 'single' && (
          <YearDropdown
            value={yearSelection.singleYear}
            years={availableYears}
            onChange={setSingleYear}
            label="Year"
          />
        )}
      </div>

      {/* Selected Count Badge */}
      <div className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded text-xs font-medium">
        {selectedYearsCount} year{selectedYearsCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

// ===== Helper Components =====

interface ModeButtonProps {
  mode: YearSelectionMode;
  label: string;
  currentMode: YearSelectionMode;
  onClick: (mode: YearSelectionMode) => void;
}

const ModeButton = ({ mode, label, currentMode, onClick }: ModeButtonProps) => {
  const isActive = mode === currentMode;

  return (
    <button
      onClick={() => onClick(mode)}
      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
        isActive
          ? 'bg-white dark:bg-gray-600 text-primary-700 dark:text-primary-300 shadow-sm'
          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
      }`}
    >
      {label}
    </button>
  );
};

interface YearDropdownProps {
  value: number | null;
  years: number[];
  onChange: (year: number | null) => void;
  label: string;
}

const YearDropdown = ({ value, years, onChange, label }: YearDropdownProps) => {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : null)}
      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      aria-label={label}
    >
      <option value="" disabled>
        {label}
      </option>
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  );
};

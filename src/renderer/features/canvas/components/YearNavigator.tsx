// ============================================
// YEAR NAVIGATOR
// Navigate through years to see utilization changes on canvas
// ============================================

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAnalysisStore } from '../../analysis/store/useAnalysisStore';

export const YearNavigator = () => {
  const results = useAnalysisStore((state) => state.results);
  const displayedYearIndex = useAnalysisStore((state) => state.displayedYearIndex);
  const nextDisplayedYear = useAnalysisStore((state) => state.nextDisplayedYear);
  const prevDisplayedYear = useAnalysisStore((state) => state.prevDisplayedYear);

  // Don't show if no results or only one year
  if (!results?.yearResults || results.yearResults.length <= 1) {
    return null;
  }

  const currentYear = results.yearResults[displayedYearIndex]?.year;
  const totalYears = results.yearResults.length;
  const isFirstYear = displayedYearIndex === 0;
  const isLastYear = displayedYearIndex === totalYears - 1;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-1.5 flex items-center gap-1">
        {/* Previous Year Button */}
        <button
          onClick={prevDisplayedYear}
          disabled={isFirstYear}
          className={`
            p-1.5 rounded-md transition-colors
            ${isFirstYear
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }
          `}
          title={isFirstYear ? 'First year' : 'Previous year'}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Year Display */}
        <div className="px-3 py-1 min-w-[100px] text-center">
          <div className="text-lg font-semibold text-gray-900">
            {currentYear}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">
            {displayedYearIndex + 1} of {totalYears}
          </div>
        </div>

        {/* Next Year Button */}
        <button
          onClick={nextDisplayedYear}
          disabled={isLastYear}
          className={`
            p-1.5 rounded-md transition-colors
            ${isLastYear
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }
          `}
          title={isLastYear ? 'Last year' : 'Next year'}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

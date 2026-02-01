// ============================================
// PREDECESSOR SELECTOR
// Phase 6.5: Select predecessor areas for DAG routing
// ============================================

import { AlertCircle } from 'lucide-react';

interface PredecessorSelectorProps {
  areaCode: string;
  availablePredecessors: string[];  // Area codes that can be selected as predecessors
  selectedPredecessors: string[];   // Currently selected predecessors
  onChange: (predecessors: string[]) => void;
  getAreaColor: (areaCode: string) => string;
  disabled?: boolean;
  wouldCreateCycle?: (areaCode: string, newPred: string) => boolean;
}

export const PredecessorSelector = ({
  areaCode,
  availablePredecessors,
  selectedPredecessors,
  onChange,
  getAreaColor,
  disabled = false,
  wouldCreateCycle,
}: PredecessorSelectorProps) => {
  const handleToggle = (predCode: string) => {
    if (disabled) return;

    if (selectedPredecessors.includes(predCode)) {
      // Remove predecessor
      onChange(selectedPredecessors.filter(p => p !== predCode));
    } else {
      // Check for cycle before adding
      if (wouldCreateCycle && wouldCreateCycle(areaCode, predCode)) {
        return; // Don't allow cycle
      }
      // Add predecessor
      onChange([...selectedPredecessors, predCode]);
    }
  };

  if (availablePredecessors.length === 0) {
    return (
      <div className="text-xs text-gray-400 italic">
        This is a start area (no predecessors)
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Depends on:
      </div>
      <div className="flex flex-wrap gap-2">
        {availablePredecessors.map(predCode => {
          const isSelected = selectedPredecessors.includes(predCode);
          const color = getAreaColor(predCode);
          const wouldCycle = wouldCreateCycle && wouldCreateCycle(areaCode, predCode);

          return (
            <button
              key={predCode}
              onClick={() => handleToggle(predCode)}
              disabled={disabled || wouldCycle}
              className={`
                flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
                transition-all duration-150
                ${isSelected
                  ? 'ring-2 ring-offset-1 ring-blue-500 shadow-sm'
                  : 'opacity-60 hover:opacity-100'
                }
                ${wouldCycle ? 'cursor-not-allowed opacity-30' : ''}
                ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              `}
              style={{
                backgroundColor: isSelected ? color : `${color}40`,
                color: isSelected ? 'white' : color,
              }}
              title={wouldCycle ? `Not available - ${predCode} already runs after this area` : `Toggle dependency on ${predCode}`}
            >
              {predCode}
              {wouldCycle && <AlertCircle className="w-3 h-3" />}
            </button>
          );
        })}
      </div>
      {selectedPredecessors.length === 0 && (
        <div className="text-xs text-amber-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          No predecessors selected - this will be a start area
        </div>
      )}
    </div>
  );
};

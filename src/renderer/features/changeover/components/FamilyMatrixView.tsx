// ============================================
// FAMILY MATRIX VIEW COMPONENT
// Collapsed family-to-family view for changeover defaults
// Phase 5.2: UI Components
// ============================================

import { useState, useCallback, useRef, KeyboardEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useChangeoverStore } from '../store/useChangeoverStore';

interface EditingCell {
  fromFamily: string;
  toFamily: string;
  value: string;
}

export const FamilyMatrixView = () => {
  const {
    matrix,
    familyDefaults,
    globalDefault,
    smedBenchmark,
    setFamilyDefault,
  } = useChangeoverStore();

  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Callback ref to focus input immediately when it mounts
  const setInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      node.focus();
      node.select();
    }
    (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
  }, []);

  const toggleFamily = useCallback((family: string) => {
    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(family)) {
        next.delete(family);
      } else {
        next.add(family);
      }
      return next;
    });
  }, []);

  const getFamilyDefault = useCallback(
    (fromFamily: string, toFamily: string): number => {
      if (fromFamily === toFamily) return 0;

      const found = familyDefaults.find(
        (fd) => fd.fromFamily === fromFamily && fd.toFamily === toFamily
      );
      return found?.changeoverMinutes ?? globalDefault;
    },
    [familyDefaults, globalDefault]
  );

  const hasFamilyDefault = useCallback(
    (fromFamily: string, toFamily: string): boolean => {
      return familyDefaults.some(
        (fd) => fd.fromFamily === fromFamily && fd.toFamily === toFamily
      );
    },
    [familyDefaults]
  );

  const handleCellClick = useCallback(
    (fromFamily: string, toFamily: string, currentValue: number) => {
      // Don't allow editing diagonal (same family)
      if (fromFamily === toFamily) return;

      setEditingCell({
        fromFamily,
        toFamily,
        value: currentValue.toString(),
      });
    },
    []
  );

  const handleInputChange = useCallback((value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    setEditingCell((prev) =>
      prev ? { ...prev, value: numericValue } : null
    );
  }, []);

  const commitEdit = useCallback(async () => {
    if (!editingCell) return;

    const minutes = parseInt(editingCell.value, 10);
    if (!isNaN(minutes) && minutes >= 0 && minutes <= 480) {
      await setFamilyDefault(
        editingCell.fromFamily,
        editingCell.toFamily,
        minutes
      );
    }

    setEditingCell(null);
  }, [editingCell, setFamilyDefault]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'Enter':
          commitEdit();
          break;
        case 'Escape':
          cancelEdit();
          break;
        case 'Tab':
          e.preventDefault();
          commitEdit();
          break;
      }
    },
    [commitEdit, cancelEdit]
  );

  if (!matrix || matrix.families.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No models assigned to this line.
      </div>
    );
  }

  const families = matrix.families;

  return (
    <div className="space-y-6">
      {/* Family-to-Family Matrix */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Family-to-Family Defaults
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Set baseline changeover times between product families. These apply to all
          lines unless overridden.
        </p>

        <div className="overflow-auto">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-gray-100 border border-gray-300 px-3 py-2 text-left font-medium text-gray-600">
                  From ↓ / To →
                </th>
                {families.map((family) => (
                  <th
                    key={family.name}
                    className="sticky top-0 z-10 bg-gray-100 border border-gray-300 px-3 py-2 text-center font-medium text-gray-700"
                  >
                    <div>{family.name}</div>
                    <div className="text-xs text-gray-500 font-normal">
                      ({family.modelCount} models)
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {families.map((fromFamily) => (
                <tr key={fromFamily.name}>
                  <th className="sticky left-0 z-10 bg-gray-100 border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">
                    <div>{fromFamily.name}</div>
                    <div className="text-xs text-gray-500 font-normal">
                      ({fromFamily.modelCount} models)
                    </div>
                  </th>

                  {families.map((toFamily) => {
                    const isDiagonal = fromFamily.name === toFamily.name;
                    const value = getFamilyDefault(fromFamily.name, toFamily.name);
                    const hasDefault = hasFamilyDefault(fromFamily.name, toFamily.name);
                    const isEditing =
                      editingCell?.fromFamily === fromFamily.name &&
                      editingCell?.toFamily === toFamily.name;
                    const exceedsBenchmark = value > smedBenchmark;

                    let bgColor = 'bg-white';
                    if (isDiagonal) {
                      bgColor = 'bg-gray-200';
                    } else if (hasDefault) {
                      bgColor = exceedsBenchmark ? 'bg-amber-100' : 'bg-blue-50';
                    } else if (exceedsBenchmark) {
                      bgColor = 'bg-amber-100';
                    } else {
                      bgColor = 'bg-gray-50';
                    }

                    return (
                      <td
                        key={toFamily.name}
                        className={`
                          border border-gray-300 px-2 py-2 text-center min-w-[80px]
                          ${bgColor}
                          ${isDiagonal ? 'cursor-not-allowed' : 'cursor-pointer hover:ring-2 hover:ring-primary-300'}
                          ${exceedsBenchmark && !isDiagonal ? 'text-amber-700 font-medium' : 'text-gray-700'}
                        `}
                        onClick={() =>
                          handleCellClick(fromFamily.name, toFamily.name, value)
                        }
                        title={
                          isDiagonal
                            ? 'Same family (no changeover)'
                            : hasDefault
                            ? `${value} min (family default)`
                            : `${value} min (global default)`
                        }
                      >
                        {isEditing ? (
                          <input
                            ref={setInputRef}
                            type="text"
                            value={editingCell.value}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleKeyDown}
                            className="w-full h-full text-center text-gray-900 border-none bg-white focus:ring-2 focus:ring-primary-500 rounded"
                            style={{ minWidth: '50px' }}
                          />
                        ) : isDiagonal ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <span>
                            {value}
                            {!hasDefault && (
                              <span className="text-xs text-gray-400 ml-1">*</span>
                            )}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 mt-2">
          * Uses global default ({globalDefault} min)
        </p>
      </div>

      {/* Expandable Model Details */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Model Details by Family
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Click a family to see individual models and their line-specific overrides.
        </p>

        <div className="space-y-2">
          {families.map((family) => {
            const isExpanded = expandedFamilies.has(family.name);

            return (
              <div
                key={family.name}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleFamily(family.name)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="font-medium text-gray-700">
                      {family.name}
                    </span>
                    <span className="text-sm text-gray-500">
                      ({family.modelCount} models)
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 font-medium text-gray-600">
                            Model
                          </th>
                          <th className="text-center py-2 px-2 font-medium text-gray-600">
                            Line Overrides
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {family.models.map((model) => {
                          // Count overrides for this model
                          const overrideCount = matrix.cells.flat().filter(
                            (cell) =>
                              (cell.fromModelId === model.id ||
                                cell.toModelId === model.id) &&
                              cell.source === 'line_override'
                          ).length;

                          return (
                            <tr
                              key={model.id}
                              className="border-b border-gray-100 last:border-b-0"
                            >
                              <td className="py-2 px-2 text-gray-700">
                                {model.name}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {overrideCount > 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    {overrideCount} overrides
                                  </span>
                                ) : (
                                  <span className="text-gray-400">
                                    Uses defaults
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <p className="text-xs text-gray-500 mt-3">
                      Switch to "By Model" view to edit individual model changeover times.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

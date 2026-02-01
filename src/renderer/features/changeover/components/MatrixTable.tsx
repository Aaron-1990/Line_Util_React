// ============================================
// MATRIX TABLE COMPONENT
// Editable N×N matrix for model-to-model changeover times
// Phase 5.2: UI Components
// ============================================

import { useState, useCallback, useRef, KeyboardEvent } from 'react';
import { useChangeoverStore } from '../store/useChangeoverStore';

interface EditingCell {
  fromModelId: string;
  toModelId: string;
  value: string;
}

export const MatrixTable = () => {
  const { matrix, smedBenchmark, setCellValue } = useChangeoverStore();

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

  const handleCellClick = useCallback(
    (fromModelId: string, toModelId: string, currentValue: number) => {
      // Don't allow editing diagonal (same model)
      if (fromModelId === toModelId) return;

      setEditingCell({
        fromModelId,
        toModelId,
        value: currentValue.toString(),
      });
    },
    []
  );

  const handleInputChange = useCallback((value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setEditingCell((prev) =>
      prev ? { ...prev, value: numericValue } : null
    );
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;

    const minutes = parseInt(editingCell.value, 10);
    if (!isNaN(minutes) && minutes >= 0 && minutes <= 480) {
      setCellValue(editingCell.fromModelId, editingCell.toModelId, minutes);
    }

    setEditingCell(null);
  }, [editingCell, setCellValue]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!matrix || !editingCell) return;

      const models = matrix.models;
      const currentFromIndex = models.findIndex(
        (m) => m.id === editingCell.fromModelId
      );
      const currentToIndex = models.findIndex(
        (m) => m.id === editingCell.toModelId
      );

      let nextFromIndex = currentFromIndex;
      let nextToIndex = currentToIndex;

      switch (e.key) {
        case 'Enter':
          commitEdit();
          // Move down
          nextFromIndex = currentFromIndex + 1;
          break;
        case 'Tab':
          e.preventDefault();
          commitEdit();
          // Move right (or down and reset to first column)
          if (e.shiftKey) {
            nextToIndex = currentToIndex - 1;
            if (nextToIndex < 0) {
              nextToIndex = models.length - 1;
              nextFromIndex = currentFromIndex - 1;
            }
          } else {
            nextToIndex = currentToIndex + 1;
            if (nextToIndex >= models.length) {
              nextToIndex = 0;
              nextFromIndex = currentFromIndex + 1;
            }
          }
          break;
        case 'ArrowUp':
          commitEdit();
          nextFromIndex = currentFromIndex - 1;
          break;
        case 'ArrowDown':
          commitEdit();
          nextFromIndex = currentFromIndex + 1;
          break;
        case 'ArrowLeft':
          if (inputRef.current?.selectionStart === 0) {
            commitEdit();
            nextToIndex = currentToIndex - 1;
          }
          return;
        case 'ArrowRight':
          if (
            inputRef.current?.selectionStart === editingCell.value.length
          ) {
            commitEdit();
            nextToIndex = currentToIndex + 1;
          }
          return;
        case 'Escape':
          cancelEdit();
          return;
        default:
          return;
      }

      // Skip diagonal cells
      if (nextFromIndex === nextToIndex) {
        if (e.key === 'Tab' && !e.shiftKey) {
          nextToIndex++;
        } else if (e.key === 'Tab' && e.shiftKey) {
          nextToIndex--;
        } else {
          nextFromIndex++;
        }
      }

      // Bounds check
      if (
        nextFromIndex >= 0 &&
        nextFromIndex < models.length &&
        nextToIndex >= 0 &&
        nextToIndex < models.length &&
        nextFromIndex !== nextToIndex
      ) {
        const nextFrom = models[nextFromIndex];
        const nextTo = models[nextToIndex];
        if (nextFrom && nextTo) {
          const nextCell = matrix.cells[nextFromIndex]?.[nextToIndex];
          if (nextCell) {
            setEditingCell({
              fromModelId: nextFrom.id,
              toModelId: nextTo.id,
              value: nextCell.changeoverMinutes.toString(),
            });
          }
        }
      }
    },
    [matrix, editingCell, commitEdit, cancelEdit]
  );

  if (!matrix || matrix.models.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No models assigned to this line.
      </div>
    );
  }

  const models = matrix.models;

  return (
    <div className="overflow-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            {/* Corner cell */}
            <th className="sticky left-0 top-0 z-20 bg-gray-100 border border-gray-300 px-2 py-2 text-left font-medium text-gray-600">
              From ↓ / To →
            </th>
            {/* Column headers */}
            {models.map((model) => (
              <th
                key={model.id}
                className="sticky top-0 z-10 bg-gray-100 border border-gray-300 px-2 py-2 text-center font-medium text-gray-700 min-w-[80px] max-w-[120px]"
                title={`${model.name} (${model.family})`}
              >
                <div className="truncate">{model.name}</div>
                <div className="text-xs text-gray-500 font-normal truncate">
                  {model.family}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {models.map((fromModel, rowIndex) => (
            <tr key={fromModel.id}>
              {/* Row header */}
              <th
                className="sticky left-0 z-10 bg-gray-100 border border-gray-300 px-2 py-2 text-left font-medium text-gray-700 min-w-[120px] max-w-[150px]"
                title={`${fromModel.name} (${fromModel.family})`}
              >
                <div className="truncate">{fromModel.name}</div>
                <div className="text-xs text-gray-500 font-normal truncate">
                  {fromModel.family}
                </div>
              </th>

              {/* Data cells */}
              {models.map((toModel, colIndex) => {
                const cell = matrix.cells[rowIndex]?.[colIndex];
                if (!cell) return null;

                const isDiagonal = fromModel.id === toModel.id;
                const isEditing =
                  editingCell?.fromModelId === fromModel.id &&
                  editingCell?.toModelId === toModel.id;
                const exceedsBenchmark = cell.changeoverMinutes > smedBenchmark;

                // Determine background color based on source
                let bgColor = 'bg-white';
                if (isDiagonal) {
                  bgColor = 'bg-gray-200';
                } else if (cell.source === 'line_override') {
                  bgColor = exceedsBenchmark
                    ? 'bg-amber-100'
                    : 'bg-green-50';
                } else if (cell.source === 'family_default') {
                  bgColor = exceedsBenchmark
                    ? 'bg-amber-100'
                    : 'bg-blue-50';
                } else if (exceedsBenchmark) {
                  bgColor = 'bg-amber-100';
                } else {
                  bgColor = 'bg-gray-50';
                }

                return (
                  <td
                    key={toModel.id}
                    className={`
                      border border-gray-300 px-1 py-1 text-center
                      ${bgColor}
                      ${isDiagonal ? 'cursor-not-allowed' : 'cursor-pointer hover:ring-2 hover:ring-primary-300'}
                      ${exceedsBenchmark && !isDiagonal ? 'text-amber-700 font-medium' : 'text-gray-700'}
                    `}
                    onClick={() =>
                      handleCellClick(
                        fromModel.id,
                        toModel.id,
                        cell.changeoverMinutes
                      )
                    }
                    title={
                      isDiagonal
                        ? 'Same model (no changeover)'
                        : `${cell.changeoverMinutes} min (${cell.source.replace('_', ' ')})`
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
                      <span>{cell.changeoverMinutes}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

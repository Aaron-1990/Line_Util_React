// ============================================
// COMPATIBILITY LIST
// Display assigned models for a production line
// Phase 6B: Line-Model Compatibility UI
// ============================================

import { useEffect, useState } from 'react';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { useCompatibilityStore } from '../store/useCompatibilityStore';
import { ILineModelCompatibility } from '@domain/entities';
import { useModelStore } from '../../models/store/useModelStore';

interface CompatibilityListProps {
  lineId: string;
}

export const CompatibilityList = ({ lineId }: CompatibilityListProps) => {
  const {
    getForLine,
    loadForLine,
    deleteCompatibility,
    openForm,
    isLoading,
  } = useCompatibilityStore();

  const { models, loadModels } = useModelStore();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const compatibilities = getForLine(lineId);

  useEffect(() => {
    loadForLine(lineId);
    if (models.length === 0) {
      loadModels();
    }
  }, [lineId]);

  const handleDelete = async (compatibility: ILineModelCompatibility) => {
    if (!confirm(`Delete compatibility with ${getModelName(compatibility.modelId)}?`)) {
      return;
    }

    setDeletingId(compatibility.id);
    try {
      await deleteCompatibility(compatibility.id, lineId);
    } finally {
      setDeletingId(null);
    }
  };

  const getModelName = (modelId: string): string => {
    const model = models.find(m => m.id === modelId);
    return model ? model.name : 'Unknown Model';
  };

  const calculateRealCycleTime = (cycleTime: number, efficiency: number): number => {
    return cycleTime / (efficiency / 100);
  };

  const assignedModelIds = new Set(compatibilities.map(c => c.modelId));
  const availableModelsCount = models.filter(m => !assignedModelIds.has(m.id)).length;

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Assigned Models ({compatibilities.length})
        </h3>
        <button
          onClick={() => openForm(lineId)}
          className="btn-primary px-3 py-1 text-xs flex items-center gap-1"
          disabled={isLoading || availableModelsCount === 0}
        >
          <Plus className="w-3 h-3" />
          Assign Model
        </button>
      </div>

      {isLoading && compatibilities.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-500">
          Loading compatibilities...
        </div>
      ) : compatibilities.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-500">
          No models assigned yet
        </div>
      ) : (
        <div className="space-y-2">
          {compatibilities.map((compatibility) => {
            const realCycleTime = calculateRealCycleTime(
              compatibility.cycleTime,
              compatibility.efficiency
            );
            const isDeleting = deletingId === compatibility.id;

            return (
              <div
                key={compatibility.id}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium text-sm text-gray-900">
                    {getModelName(compatibility.modelId)}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      Pri: {compatibility.priority}
                    </span>
                    <button
                      onClick={() => openForm(lineId, compatibility)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Edit"
                      disabled={isDeleting}
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(compatibility)}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      title="Delete"
                      disabled={isDeleting}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Cycle:</span> {compatibility.cycleTime.toFixed(1)}s
                  </div>
                  <div className="text-gray-300">|</div>
                  <div>
                    <span className="font-medium">Efficiency:</span> {Math.round(compatibility.efficiency)}%
                  </div>
                  <div className="text-gray-300">|</div>
                  <div>
                    <span className="font-medium">Real:</span> {realCycleTime.toFixed(1)}s
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {compatibilities.length > 0 && availableModelsCount === 0 && (
        <div className="text-center py-3 text-xs text-gray-500 border-t border-gray-200 mt-3">
          No more models available to assign
        </div>
      )}
    </div>
  );
};

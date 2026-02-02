// ============================================
// MODEL TABLE COMPONENT
// Data table with expandable rows for volumes
// Phase 6A+: Models + Volumes Combined
// Phase 7: Added plant ownership columns
// ============================================

import { ChevronRight, ChevronDown, Pencil, Trash2, Factory } from 'lucide-react';
import { useModelStore } from '../store/useModelStore';
import { usePlantStore } from '../../plants';
import { VolumeEditor } from './VolumeEditor';
import { IProductModelV2 } from '@domain/entities';

interface ModelRowProps {
  model: IProductModelV2;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ModelRow = ({ model, isExpanded, onToggleExpand, onEdit, onDelete }: ModelRowProps) => {
  const { getVolumesForModel } = useModelStore();
  const { getPlantById } = usePlantStore();
  const volumes = getVolumesForModel(model.id);

  const yearCount = volumes.length;

  // Phase 7: Get plant info
  const primaryPlant = model.primaryPlantId ? getPlantById(model.primaryPlantId) : null;

  // Determine ownership type
  const getOwnershipType = (): 'exclusive' | 'shared' | 'transferred' | null => {
    if (!model.launchPlantId && !model.primaryPlantId) return null;
    if (model.launchPlantId !== model.primaryPlantId) return 'transferred';
    return 'exclusive';
  };

  const ownershipType = getOwnershipType();

  const ownershipBadge = ownershipType && {
    exclusive: { label: 'Exclusive', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
    shared: { label: 'Shared', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    transferred: { label: 'Transferred', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  }[ownershipType];

  return (
    <>
      {/* Main Row */}
      <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        {/* Expand/Collapse */}
        <td className="py-3 px-4 w-12">
          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </td>

        {/* Model Name */}
        <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100 font-medium">
          {model.name}
        </td>

        {/* Customer */}
        <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
          {model.customer}
        </td>

        {/* Program */}
        <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
          {model.program}
        </td>

        {/* Family */}
        <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
          {model.family}
        </td>

        {/* Primary Plant - Phase 7 */}
        <td className="py-3 px-4 text-sm">
          {primaryPlant ? (
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: primaryPlant.color || '#6B7280' }}
              />
              <span className="text-gray-900 dark:text-gray-100">{primaryPlant.code}</span>
              {ownershipBadge && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${ownershipBadge.className}`}>
                  {ownershipBadge.label}
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Factory className="w-3 h-3" />
              Unassigned
            </span>
          )}
        </td>

        {/* Volumes Count */}
        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
          {yearCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <span className="font-medium text-gray-900 dark:text-gray-100">{yearCount}</span>
              <span>{yearCount === 1 ? 'year' : 'years'}</span>
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">No volumes</span>
          )}
        </td>

        {/* Actions */}
        <td className="py-3 px-4 w-24">
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors group"
              title="Edit model"
            >
              <Pencil className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors group"
              title="Delete model"
            >
              <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Row - Volume Editor */}
      {isExpanded && (
        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <td colSpan={8} className="p-0">
            <VolumeEditor modelId={model.id} modelName={model.name} />
          </td>
        </tr>
      )}
    </>
  );
};

export const ModelTable = () => {
  const {
    getFilteredModels,
    expandedModelIds,
    toggleExpandModel,
    openModelForm,
    deleteModel,
  } = useModelStore();

  const models = getFilteredModels();

  const handleDelete = (model: IProductModelV2) => {
    if (window.confirm(`Are you sure you want to delete "${model.name}"? This will also delete all associated volumes and compatibilities.`)) {
      deleteModel(model.name);
    }
  };

  if (models.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <p>No models found. Click "Add Model" to create one.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        {/* Header */}
        <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th className="py-3 px-4 w-12"></th>
            <th className="py-3 px-4 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
              Model
            </th>
            <th className="py-3 px-4 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
              Customer
            </th>
            <th className="py-3 px-4 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
              Program
            </th>
            <th className="py-3 px-4 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
              Family
            </th>
            <th className="py-3 px-4 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
              Plant
            </th>
            <th className="py-3 px-4 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
              Volumes
            </th>
            <th className="py-3 px-4 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold w-24">
              Actions
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {models.map((model) => (
            <ModelRow
              key={model.id}
              model={model}
              isExpanded={expandedModelIds.has(model.id)}
              onToggleExpand={() => toggleExpandModel(model.id)}
              onEdit={() => openModelForm(model)}
              onDelete={() => handleDelete(model)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

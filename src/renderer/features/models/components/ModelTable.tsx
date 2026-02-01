// ============================================
// MODEL TABLE COMPONENT
// Data table with expandable rows for volumes
// Phase 6A+: Models + Volumes Combined
// ============================================

import { ChevronRight, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { useModelStore } from '../store/useModelStore';
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
  const volumes = getVolumesForModel(model.id);

  const yearCount = volumes.length;

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
          <td colSpan={7} className="p-0">
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

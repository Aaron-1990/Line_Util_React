// ============================================
// VOLUME EDITOR COMPONENT
// Inline table for volumes within expanded model row
// Phase 6A+: Models + Volumes Combined
// ============================================

import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useModelStore } from '../store/useModelStore';
import { IProductVolume } from '@domain/entities';

const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

const calculateDailyDemand = (volume: number, operationsDays: number): number => {
  if (operationsDays === 0) return 0;
  return volume / operationsDays;
};

interface VolumeEditorProps {
  modelId: string;
  modelName: string;
}

export const VolumeEditor = ({ modelId, modelName }: VolumeEditorProps) => {
  const { getVolumesForModel, openVolumeForm, deleteVolume } = useModelStore();
  const volumes = getVolumesForModel(modelId);

  // Sort volumes by year ascending
  const sortedVolumes = [...volumes].sort((a, b) => a.year - b.year);

  const handleDelete = (volume: IProductVolume) => {
    if (window.confirm(`Delete volume for year ${volume.year}?`)) {
      deleteVolume(volume.id);
    }
  };

  return (
    <div className="px-12 py-4 border-l-4 border-blue-200 dark:border-blue-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Volumes for {modelName}
        </h3>
        <button
          onClick={() => openVolumeForm(modelId)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Year
        </button>
      </div>

      {/* Volumes Table */}
      {sortedVolumes.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="py-2 px-3 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
                Year
              </th>
              <th className="py-2 px-3 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
                Volume
              </th>
              <th className="py-2 px-3 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
                Ops Days
              </th>
              <th className="py-2 px-3 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
                Daily Demand
              </th>
              <th className="py-2 px-3 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold w-20">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedVolumes.map((volume) => {
              const dailyDemand = calculateDailyDemand(volume.volume, volume.operationsDays);

              return (
                <tr
                  key={volume.id}
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-900 transition-colors"
                >
                  {/* Year */}
                  <td className="py-2 px-3 text-gray-900 dark:text-gray-100 font-medium">
                    {volume.year}
                  </td>

                  {/* Volume */}
                  <td className="py-2 px-3 text-gray-900 dark:text-gray-100">
                    {formatNumber(volume.volume)}
                  </td>

                  {/* Operations Days */}
                  <td className="py-2 px-3 text-gray-900 dark:text-gray-100">
                    {volume.operationsDays}
                  </td>

                  {/* Daily Demand */}
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                    {formatNumber(Math.round(dailyDemand))}/day
                  </td>

                  {/* Actions */}
                  <td className="py-2 px-3 w-20">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openVolumeForm(modelId, volume)}
                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors group"
                        title="Edit volume"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(volume)}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors group"
                        title="Delete volume"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
          No volumes defined. Click "Add Year" to create one.
        </div>
      )}
    </div>
  );
};

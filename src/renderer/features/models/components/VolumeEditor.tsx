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
    <div className="px-12 py-4 border-l-4 border-blue-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          Volumes for {modelName}
        </h3>
        <button
          onClick={() => openVolumeForm(modelId)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Year
        </button>
      </div>

      {/* Volumes Table */}
      {sortedVolumes.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <th className="py-2 px-3 text-left text-xs uppercase text-gray-500 font-semibold">
                Year
              </th>
              <th className="py-2 px-3 text-left text-xs uppercase text-gray-500 font-semibold">
                Volume
              </th>
              <th className="py-2 px-3 text-left text-xs uppercase text-gray-500 font-semibold">
                Ops Days
              </th>
              <th className="py-2 px-3 text-left text-xs uppercase text-gray-500 font-semibold">
                Daily Demand
              </th>
              <th className="py-2 px-3 text-left text-xs uppercase text-gray-500 font-semibold w-20">
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
                  className="border-b border-gray-100 hover:bg-white transition-colors"
                >
                  {/* Year */}
                  <td className="py-2 px-3 text-gray-900 font-medium">
                    {volume.year}
                  </td>

                  {/* Volume */}
                  <td className="py-2 px-3 text-gray-900">
                    {formatNumber(volume.volume)}
                  </td>

                  {/* Operations Days */}
                  <td className="py-2 px-3 text-gray-900">
                    {volume.operationsDays}
                  </td>

                  {/* Daily Demand */}
                  <td className="py-2 px-3 text-gray-600">
                    {formatNumber(Math.round(dailyDemand))}/day
                  </td>

                  {/* Actions */}
                  <td className="py-2 px-3 w-20">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openVolumeForm(modelId, volume)}
                        className="p-1 hover:bg-blue-100 rounded transition-colors group"
                        title="Edit volume"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(volume)}
                        className="p-1 hover:bg-red-100 rounded transition-colors group"
                        title="Delete volume"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-500 group-hover:text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="text-center py-8 text-gray-500 text-sm bg-white rounded border border-gray-200">
          No volumes defined. Click "Add Year" to create one.
        </div>
      )}
    </div>
  );
};

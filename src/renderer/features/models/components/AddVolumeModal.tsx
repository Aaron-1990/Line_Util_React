// ============================================
// ADD VOLUME MODAL COMPONENT
// Modal for adding/editing a volume year
// Phase 6A+: Models + Volumes Combined
// ============================================

import { X, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useModelStore } from '../store/useModelStore';

const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

const calculateDailyDemand = (volume: number, operationsDays: number): number => {
  if (operationsDays === 0) return 0;
  return volume / operationsDays;
};

// Generate year options (current year - 5 to current year + 10)
const generateYearOptions = (): number[] => {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let i = currentYear - 5; i <= currentYear + 10; i++) {
    years.push(i);
  }
  return years;
};

export const AddVolumeModal = () => {
  const {
    isVolumeFormOpen,
    editingVolume,
    selectedModelId,
    getVolumesForModel,
    isLoading,
    error: storeError,
    closeVolumeForm,
    createVolume,
    updateVolume,
  } = useModelStore();

  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    volume: '',  // Store as string during editing
    operationsDays: '250',  // Store as string during editing
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const yearOptions = generateYearOptions();
  const existingVolumes = selectedModelId ? getVolumesForModel(selectedModelId) : [];
  const existingYears = new Set(existingVolumes.map(v => v.year));

  // Initialize form when editing
  useEffect(() => {
    if (editingVolume) {
      setFormData({
        year: editingVolume.year,
        volume: editingVolume.volume.toString(),
        operationsDays: editingVolume.operationsDays.toString(),
      });
    } else {
      // Find first available year
      const firstAvailableYear = yearOptions.find(year => !existingYears.has(year)) || new Date().getFullYear();
      setFormData({
        year: firstAvailableYear,
        volume: '',
        operationsDays: '250',
      });
    }
    setErrors({});
  }, [editingVolume, isVolumeFormOpen]);

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const volumeNum = formData.volume === '' ? 0 : parseInt(formData.volume, 10);
    const opsDaysNum = formData.operationsDays === '' ? 0 : parseInt(formData.operationsDays, 10);

    if (!editingVolume && existingYears.has(formData.year)) {
      newErrors.year = 'Volume for this year already exists';
    }

    if (formData.volume === '' || isNaN(volumeNum) || volumeNum < 0) {
      newErrors.volume = 'Volume must be >= 0';
    }

    if (formData.operationsDays === '' || isNaN(opsDaysNum) || opsDaysNum < 1 || opsDaysNum > 366) {
      newErrors.operationsDays = 'Operations days must be between 1 and 366';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate() || !selectedModelId) return;

    const volumeNum = parseInt(formData.volume, 10);
    const opsDaysNum = parseInt(formData.operationsDays, 10);

    try {
      if (editingVolume) {
        await updateVolume(editingVolume.id, {
          volume: volumeNum,
          operationsDays: opsDaysNum,
        });
      } else {
        await createVolume({
          modelId: selectedModelId,
          year: formData.year,
          volume: volumeNum,
          operationsDays: opsDaysNum,
        });
      }
    } catch (error) {
      console.error('Failed to save volume:', error);
    }
  };

  if (!isVolumeFormOpen) return null;

  const volumeNum = formData.volume === '' ? 0 : parseInt(formData.volume, 10) || 0;
  const opsDaysNum = formData.operationsDays === '' ? 0 : parseInt(formData.operationsDays, 10) || 0;
  const dailyDemand = calculateDailyDemand(volumeNum, opsDaysNum);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !isLoading && closeVolumeForm()}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingVolume ? 'Edit Volume' : 'Add Year Volume'}
          </h2>
          <button
            onClick={closeVolumeForm}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Store Error Display */}
          {storeError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{storeError}</p>
            </div>
          )}

          {/* Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.year}
              onChange={(e) => handleChange('year', parseInt(e.target.value))}
              className={`w-full px-3 py-2 border rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.year ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isLoading || !!editingVolume}
            >
              {yearOptions.map(year => (
                <option
                  key={year}
                  value={year}
                  disabled={!editingVolume && existingYears.has(year)}
                >
                  {year} {!editingVolume && existingYears.has(year) ? '(already exists)' : ''}
                </option>
              ))}
            </select>
            {errors.year && (
              <p className="mt-1 text-sm text-red-600">{errors.year}</p>
            )}
          </div>

          {/* Volume */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Annual Volume <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.volume}
              onChange={(e) => handleChange('volume', e.target.value)}
              onFocus={(e) => e.target.select()}
              className={`w-full px-3 py-2 border rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.volume ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="50000"
              min="0"
              disabled={isLoading}
            />
            {errors.volume && (
              <p className="mt-1 text-sm text-red-600">{errors.volume}</p>
            )}
          </div>

          {/* Operations Days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Operations Days <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.operationsDays}
              onChange={(e) => handleChange('operationsDays', e.target.value)}
              onFocus={(e) => e.target.select()}
              className={`w-full px-3 py-2 border rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.operationsDays ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="250"
              min="1"
              max="366"
              disabled={isLoading}
            />
            {errors.operationsDays && (
              <p className="mt-1 text-sm text-red-600">{errors.operationsDays}</p>
            )}
          </div>

          {/* Calculated Daily Demand */}
          <div className="pt-2 pb-2 px-4 bg-blue-50 rounded-md">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 font-medium">Daily Demand:</span>
              <span className="text-blue-700 font-semibold">
                {formatNumber(Math.round(dailyDemand))} units/day
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={closeVolumeForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              <Save className="w-4 h-4" />
              {editingVolume ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

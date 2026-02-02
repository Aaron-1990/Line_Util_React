// ============================================
// PLANT FORM COMPONENT
// Modal for adding/editing plants
// Phase 7: Multi-Plant Support
// ============================================

import { useState, useEffect } from 'react';
import { X, Factory } from 'lucide-react';
import { usePlantStore } from '../store/usePlantStore';
import { CreatePlantInput, UpdatePlantInput } from '@shared/types';

// ===== Constants =====

const REGIONS = ['LATAM', 'NA', 'EMEA', 'APAC'] as const;

const COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Indigo', value: '#6366F1' },
] as const;

const TIMEZONES = [
  'America/Mexico_City',
  'America/Chicago',
  'America/New_York',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
] as const;

// ===== Component =====

export const PlantForm = () => {
  const { isFormOpen, editingPlant, closeForm, createPlant, updatePlant, isLoading, error, clearError } = usePlantStore();

  // Form state
  const [formData, setFormData] = useState<CreatePlantInput & { isDefault?: boolean }>({
    code: '',
    name: '',
    region: '',
    locationCity: '',
    locationState: '',
    locationCountry: '',
    timezone: 'America/Mexico_City',
    currencyCode: 'USD',
    defaultOperationsDays: 240,
    defaultShiftsPerDay: 2,
    defaultHoursPerShift: 8.0,
    color: '#3B82F6',
    notes: '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes or editing plant changes
  useEffect(() => {
    if (isFormOpen) {
      clearError();
      setValidationErrors({});

      if (editingPlant) {
        setFormData({
          code: editingPlant.code,
          name: editingPlant.name,
          region: editingPlant.region || '',
          locationCity: editingPlant.locationCity || '',
          locationState: editingPlant.locationState || '',
          locationCountry: editingPlant.locationCountry || '',
          timezone: editingPlant.timezone,
          currencyCode: editingPlant.currencyCode,
          defaultOperationsDays: editingPlant.defaultOperationsDays,
          defaultShiftsPerDay: editingPlant.defaultShiftsPerDay,
          defaultHoursPerShift: editingPlant.defaultHoursPerShift,
          color: editingPlant.color || '#3B82F6',
          notes: editingPlant.notes || '',
        });
      } else {
        setFormData({
          code: '',
          name: '',
          region: '',
          locationCity: '',
          locationState: '',
          locationCountry: '',
          timezone: 'America/Mexico_City',
          currencyCode: 'USD',
          defaultOperationsDays: 240,
          defaultShiftsPerDay: 2,
          defaultHoursPerShift: 8.0,
          color: '#3B82F6',
          notes: '',
        });
      }
    }
  }, [isFormOpen, editingPlant, clearError]);

  // Validation
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.code.trim()) {
      errors.code = 'Plant code is required';
    } else if (!/^[A-Z0-9]{2,6}$/.test(formData.code.trim())) {
      errors.code = 'Code must be 2-6 uppercase letters/numbers';
    }

    if (!formData.name.trim()) {
      errors.name = 'Plant name is required';
    }

    const opDays = formData.defaultOperationsDays ?? 240;
    if (opDays < 1 || opDays > 365) {
      errors.defaultOperationsDays = 'Must be between 1 and 365';
    }

    const shifts = formData.defaultShiftsPerDay ?? 2;
    if (shifts < 1 || shifts > 3) {
      errors.defaultShiftsPerDay = 'Must be 1, 2, or 3';
    }

    const hours = formData.defaultHoursPerShift ?? 8;
    if (hours < 1 || hours > 12) {
      errors.defaultHoursPerShift = 'Must be between 1 and 12';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const data: CreatePlantInput = {
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      region: formData.region || undefined,
      locationCity: formData.locationCity || undefined,
      locationState: formData.locationState || undefined,
      locationCountry: formData.locationCountry || undefined,
      timezone: formData.timezone,
      currencyCode: formData.currencyCode,
      defaultOperationsDays: formData.defaultOperationsDays,
      defaultShiftsPerDay: formData.defaultShiftsPerDay,
      defaultHoursPerShift: formData.defaultHoursPerShift,
      color: formData.color,
      notes: formData.notes || undefined,
    };

    if (editingPlant) {
      await updatePlant(editingPlant.id, data as UpdatePlantInput);
    } else {
      await createPlant(data);
    }
  };

  // Handle field change
  const handleChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error when field changes
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  if (!isFormOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeForm}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Factory className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingPlant ? 'Edit Plant' : 'Add New Plant'}
            </h2>
          </div>
          <button
            onClick={closeForm}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="px-6 py-4 space-y-6">
            {/* Error Banner */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Identification Section */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                Identification
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Plant Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                    placeholder="REY"
                    maxLength={6}
                    className={`
                      w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      placeholder-gray-400 dark:placeholder-gray-500
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${validationErrors.code
                        ? 'border-red-300 dark:border-red-700'
                        : 'border-gray-300 dark:border-gray-700'}
                    `}
                  />
                  {validationErrors.code && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.code}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Plant Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Reynosa, Tamaulipas"
                    className={`
                      w-full px-3 py-2 border rounded-lg text-sm
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      placeholder-gray-400 dark:placeholder-gray-500
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${validationErrors.name
                        ? 'border-red-300 dark:border-red-700'
                        : 'border-gray-300 dark:border-gray-700'}
                    `}
                  />
                  {validationErrors.name && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Location Section */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                Location
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.locationCity}
                    onChange={(e) => handleChange('locationCity', e.target.value)}
                    placeholder="Reynosa"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    State/Province
                  </label>
                  <input
                    type="text"
                    value={formData.locationState}
                    onChange={(e) => handleChange('locationState', e.target.value)}
                    placeholder="Tamaulipas"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.locationCountry}
                    onChange={(e) => handleChange('locationCountry', e.target.value)}
                    placeholder="MX"
                    maxLength={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-mono uppercase bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">ISO 3166-1 alpha-2 code</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Region
                  </label>
                  <select
                    value={formData.region}
                    onChange={(e) => handleChange('region', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select region...</option>
                    {REGIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Defaults Section */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                Defaults
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Operation Days/Year
                  </label>
                  <input
                    type="number"
                    value={formData.defaultOperationsDays}
                    onChange={(e) => handleChange('defaultOperationsDays', parseInt(e.target.value) || 0)}
                    min={1}
                    max={365}
                    className={`
                      w-full px-3 py-2 border rounded-lg text-sm
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${validationErrors.defaultOperationsDays
                        ? 'border-red-300 dark:border-red-700'
                        : 'border-gray-300 dark:border-gray-700'}
                    `}
                  />
                  {validationErrors.defaultOperationsDays && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.defaultOperationsDays}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Shifts/Day
                  </label>
                  <select
                    value={formData.defaultShiftsPerDay}
                    onChange={(e) => handleChange('defaultShiftsPerDay', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 shift</option>
                    <option value={2}>2 shifts</option>
                    <option value={3}>3 shifts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Hours/Shift
                  </label>
                  <input
                    type="number"
                    value={formData.defaultHoursPerShift}
                    onChange={(e) => handleChange('defaultHoursPerShift', parseFloat(e.target.value) || 0)}
                    min={1}
                    max={12}
                    step={0.5}
                    className={`
                      w-full px-3 py-2 border rounded-lg text-sm
                      bg-white dark:bg-gray-800
                      text-gray-900 dark:text-gray-100
                      focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${validationErrors.defaultHoursPerShift
                        ? 'border-red-300 dark:border-red-700'
                        : 'border-gray-300 dark:border-gray-700'}
                    `}
                  />
                  {validationErrors.defaultHoursPerShift && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validationErrors.defaultHoursPerShift}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Settings Section */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                Settings
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Timezone
                  </label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => handleChange('timezone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIMEZONES.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color
                  </label>
                  <div className="flex gap-2">
                    {COLORS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => handleChange('color', c.value)}
                        className={`
                          w-8 h-8 rounded-lg transition-all
                          ${formData.color === c.value
                            ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-900'
                            : 'hover:scale-110'}
                        `}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={2}
                placeholder="Optional notes about this plant..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : editingPlant ? 'Save Changes' : 'Create Plant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

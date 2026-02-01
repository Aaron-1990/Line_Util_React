// ============================================
// AREA FORM COMPONENT
// Modal form for creating/editing a manufacturing area
// Phase 6D: Custom Areas
// ============================================

import { X, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAreaStore } from '../store/useAreaStore';

// Color presets from Tailwind palette
const COLOR_PRESETS = [
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Teal', hex: '#14B8A6' },
];

export const AreaForm = () => {
  const {
    isFormOpen,
    editingArea,
    areas,
    isLoading,
    error: storeError,
    closeForm,
    createArea,
    updateArea,
  } = useAreaStore();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    color: COLOR_PRESETS[0]?.hex ?? '#3B82F6',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when editing
  useEffect(() => {
    if (editingArea) {
      setFormData({
        code: editingArea.code,
        name: editingArea.name,
        color: editingArea.color,
      });
    } else {
      setFormData({
        code: '',
        name: '',
        color: COLOR_PRESETS[0]?.hex ?? '#3B82F6',
      });
    }
    setErrors({});
  }, [editingArea, isFormOpen]);

  const handleChange = (field: string, value: string) => {
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

  const formatCode = (value: string): string => {
    // Convert to uppercase, replace spaces with underscores
    return value.toUpperCase().replace(/\s+/g, '_');
  };

  const handleCodeChange = (value: string) => {
    const formatted = formatCode(value);
    handleChange('code', formatted);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) {
      newErrors.code = 'Area code is required';
    } else if (!/^[A-Z_]+$/.test(formData.code)) {
      newErrors.code = 'Code must contain only uppercase letters and underscores';
    } else if (!editingArea) {
      // Check for duplicate code only when creating
      const isDuplicate = areas.some(
        a => a.code.toLowerCase() === formData.code.toLowerCase()
      );
      if (isDuplicate) {
        newErrors.code = 'An area with this code already exists';
      }
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Area name is required';
    }

    if (!formData.color.match(/^#[0-9A-F]{6}$/i)) {
      newErrors.color = 'Invalid color format (use hex format like #3B82F6)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      if (editingArea) {
        // Only allow updating name and color, not code
        await updateArea(editingArea.id, {
          name: formData.name,
          color: formData.color,
        });
      } else {
        await createArea(formData);
      }
    } catch (error) {
      console.error('Failed to save area:', error);
    }
  };

  if (!isFormOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !isLoading && closeForm()}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {editingArea ? 'Edit Area' : 'Create New Area'}
          </h2>
          <button
            onClick={closeForm}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Store Error Display */}
          {storeError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{storeError}</p>
            </div>
          )}

          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => handleCodeChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.code ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="e.g., BODY_SHOP"
              disabled={isLoading || !!editingArea}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Uppercase letters and underscores only
            </p>
            {errors.code && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.code}</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="e.g., Body Shop"
              disabled={isLoading}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Color <span className="text-red-500">*</span>
            </label>

            {/* Current Color Preview */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-sm"
                style={{ backgroundColor: formData.color }}
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => handleChange('color', e.target.value)}
                className={`flex-1 px-3 py-2 border rounded-md font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.color ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="#3B82F6"
                disabled={isLoading}
              />
            </div>

            {/* Preset Colors */}
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Preset colors:</p>
              <div className="grid grid-cols-8 gap-2">
                {COLOR_PRESETS.map(preset => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => handleChange('color', preset.hex)}
                    className={`w-full aspect-square rounded-md transition-all hover:scale-110 ${
                      formData.color.toUpperCase() === preset.hex.toUpperCase()
                        ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900'
                        : 'border-2 border-gray-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                    title={preset.name}
                    disabled={isLoading}
                  />
                ))}
              </div>
            </div>

            {errors.color && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.color}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
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
              {editingArea ? 'Update Area' : 'Create Area'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// MODEL FORM COMPONENT
// Modal form for creating/editing a model
// Phase 6A+: Models + Volumes Combined
// ============================================

import { X, Save, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useModelStore } from '../store/useModelStore';

export const ModelForm = () => {
  const {
    isModelFormOpen,
    editingModel,
    models,
    isLoading,
    error: storeError,
    closeModelForm,
    createModel,
    updateModel,
  } = useModelStore();

  const [formData, setFormData] = useState({
    name: '',
    customer: '',
    program: '',
    family: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Extract unique values for autocomplete
  const uniqueCustomers = Array.from(new Set(models.map(m => m.customer).filter(Boolean))).sort();
  const uniquePrograms = Array.from(new Set(models.map(m => m.program).filter(Boolean))).sort();
  const uniqueFamilies = Array.from(new Set(models.map(m => m.family).filter(Boolean))).sort();

  // Initialize form when editing
  useEffect(() => {
    if (editingModel) {
      setFormData({
        name: editingModel.name,
        customer: editingModel.customer,
        program: editingModel.program,
        family: editingModel.family,
      });
    } else {
      setFormData({
        name: '',
        customer: '',
        program: '',
        family: '',
      });
    }
    setErrors({});
  }, [editingModel, isModelFormOpen]);

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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Model name is required';
    } else if (!editingModel) {
      // Check for duplicate name only when creating
      const isDuplicate = models.some(m => m.name.toLowerCase() === formData.name.toLowerCase());
      if (isDuplicate) {
        newErrors.name = 'A model with this name already exists';
      }
    }

    if (!formData.customer.trim()) {
      newErrors.customer = 'Customer is required';
    }

    if (!formData.program.trim()) {
      newErrors.program = 'Program is required';
    }

    if (!formData.family.trim()) {
      newErrors.family = 'Family is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      if (editingModel) {
        await updateModel(editingModel.name, formData);
      } else {
        await createModel(formData);
      }
    } catch (error) {
      console.error('Failed to save model:', error);
    }
  };

  if (!isModelFormOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !isLoading && closeModelForm()}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {editingModel ? 'Edit Model' : 'Add Model'}
          </h2>
          <button
            onClick={closeModelForm}
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

          {/* Model Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Model Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="e.g., HEV-1000"
              disabled={isLoading || !!editingModel}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              list="customers"
              value={formData.customer}
              onChange={(e) => handleChange('customer', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.customer ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="e.g., Ford"
              disabled={isLoading}
            />
            <datalist id="customers">
              {uniqueCustomers.map(customer => (
                <option key={customer} value={customer} />
              ))}
            </datalist>
            {errors.customer && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.customer}</p>
            )}
          </div>

          {/* Program */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Program <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              list="programs"
              value={formData.program}
              onChange={(e) => handleChange('program', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.program ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="e.g., F-150"
              disabled={isLoading}
            />
            <datalist id="programs">
              {uniquePrograms.map(program => (
                <option key={program} value={program} />
              ))}
            </datalist>
            {errors.program && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.program}</p>
            )}
          </div>

          {/* Family */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Family <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              list="families"
              value={formData.family}
              onChange={(e) => handleChange('family', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.family ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="e.g., HEV"
              disabled={isLoading}
            />
            <datalist id="families">
              {uniqueFamilies.map(family => (
                <option key={family} value={family} />
              ))}
            </datalist>
            {errors.family && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.family}</p>
            )}
          </div>

          {/* Hint for new models */}
          {!editingModel && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                After creating, click the model row to expand it and add yearly volumes.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={closeModelForm}
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
              {editingModel ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

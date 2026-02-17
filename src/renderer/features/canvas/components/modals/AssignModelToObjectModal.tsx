// ============================================
// ASSIGN MODEL TO OBJECT MODAL
// Form for creating/editing canvas object model compatibility
// Phase 7.5: Unified Object Properties
// ============================================

import { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import { useCanvasObjectCompatibilityStore } from '../../store/useCanvasObjectCompatibilityStore';
import { useModelStore } from '../../../models/store/useModelStore';

export const AssignModelToObjectModal = () => {
  const {
    isFormOpen,
    editingCompatibility,
    targetObjectId,
    closeForm,
    createCompatibility,
    updateCompatibility,
    getForObject,
    isLoading,
    error,
    clearError,
  } = useCanvasObjectCompatibilityStore();

  const { models, loadModels } = useModelStore();

  // Form state
  const [selectedModelId, setSelectedModelId] = useState('');
  const [cycleTime, setCycleTime] = useState('');
  const [efficiency, setEfficiency] = useState('');
  const [priority, setPriority] = useState('1');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load models on mount
  useEffect(() => {
    if (isFormOpen && models.length === 0) {
      loadModels();
    }
  }, [isFormOpen]);

  // Initialize form when editing
  useEffect(() => {
    if (editingCompatibility) {
      setSelectedModelId(editingCompatibility.modelId);
      setCycleTime(editingCompatibility.cycleTime.toString());
      setEfficiency(editingCompatibility.efficiency.toString());
      setPriority(editingCompatibility.priority.toString());
    } else {
      // Reset form for new compatibility
      setSelectedModelId('');
      setCycleTime('');
      setEfficiency('');
      setPriority('1');
    }
    setErrors({});
  }, [editingCompatibility, isFormOpen]);

  // Clear error when field changes
  const clearFieldError = (field: string) => {
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleModelChange = (value: string) => {
    setSelectedModelId(value);
    clearFieldError('model');
  };

  const handleCycleTimeChange = (value: string) => {
    setCycleTime(value);
    clearFieldError('cycleTime');
  };

  const handleEfficiencyChange = (value: string) => {
    setEfficiency(value);
    clearFieldError('efficiency');
  };

  const handlePriorityChange = (value: string) => {
    setPriority(value);
    clearFieldError('priority');
  };

  if (!isFormOpen || !targetObjectId) return null;

  // Get already assigned model IDs
  const assignedModelIds = new Set(
    getForObject(targetObjectId).map(c => c.modelId)
  );

  // Filter out already assigned models (unless editing)
  const availableModels = models.filter(m =>
    !assignedModelIds.has(m.id) || m.id === editingCompatibility?.modelId
  );

  const calculateRealCycleTime = (): number | null => {
    const ct = parseFloat(cycleTime);
    const eff = parseFloat(efficiency);

    if (isNaN(ct) || isNaN(eff) || eff <= 0) return null;

    return ct / (eff / 100);
  };

  const realCycleTime = calculateRealCycleTime();

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const ct = parseFloat(cycleTime);
    const eff = parseFloat(efficiency);
    const pri = parseInt(priority, 10);

    if (!selectedModelId) {
      newErrors.model = 'Please select a model';
    }

    if (isNaN(ct) || ct <= 0) {
      newErrors.cycleTime = 'Cycle time must be greater than 0';
    }

    if (isNaN(eff) || eff <= 0 || eff > 100) {
      newErrors.efficiency = 'Efficiency must be between 1 and 100';
    }

    if (isNaN(pri) || pri < 1) {
      newErrors.priority = 'Priority must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const ct = parseFloat(cycleTime);
    const eff = parseFloat(efficiency);
    const pri = parseInt(priority, 10);

    if (editingCompatibility) {
      // Update existing
      await updateCompatibility(editingCompatibility.id, {
        cycleTime: ct,
        efficiency: eff,
        priority: pri,
      });
    } else {
      // Create new
      await createCompatibility({
        canvasObjectId: targetObjectId,
        modelId: selectedModelId,
        cycleTime: ct,
        efficiency: eff,
        priority: pri,
      });
    }
    // updateNode and refreshData are now handled inside the store actions
    // to avoid race condition when modal closes before this code executes
  };

  const handleCancel = () => {
    clearError();
    closeForm();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[500px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {editingCompatibility ? 'Edit Model Assignment' : 'Assign Model'}
          </h2>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Model Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Model <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedModelId}
              onChange={(e) => handleModelChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.model ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              disabled={!!editingCompatibility || isLoading}
            >
              <option value="">Select a model...</option>
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.family})
                </option>
              ))}
            </select>
            {errors.model && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.model}</p>
            )}
          </div>

          {/* Cycle Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cycle Time (seconds) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={cycleTime}
              onChange={(e) => handleCycleTimeChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.cycleTime ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="45"
              disabled={isLoading}
            />
            {errors.cycleTime && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.cycleTime}</p>
            )}
          </div>

          {/* Efficiency */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Efficiency (%) <span className="text-red-500">*</span>
              <div className="relative group">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-gray-900 text-white text-xs rounded px-2 py-1 z-10">
                  Overall Equipment Effectiveness (OEE) proxy. Accounts for availability, performance, and quality.
                </div>
              </div>
            </label>
            <input
              type="number"
              step="1"
              min="1"
              max="100"
              value={efficiency}
              onChange={(e) => handleEfficiencyChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.efficiency ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="92"
              disabled={isLoading}
            />
            {errors.efficiency && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.efficiency}</p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.priority ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="1"
              disabled={isLoading}
            />
            {errors.priority ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.priority}</p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Lower number = higher priority
              </p>
            )}
          </div>

          {/* Calculated Real Cycle Time */}
          {realCycleTime !== null && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Calculated Real Cycle Time: {realCycleTime.toFixed(2)} seconds
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                Formula: Cycle Time / (Efficiency / 100)
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              disabled={isLoading || !selectedModelId}
            >
              {isLoading ? 'Saving...' : editingCompatibility ? 'Update' : 'Assign Model'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

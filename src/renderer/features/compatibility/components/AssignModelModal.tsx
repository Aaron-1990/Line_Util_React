// ============================================
// ASSIGN MODEL MODAL
// Form for creating/editing line-model compatibility
// Phase 6B: Line-Model Compatibility UI
// ============================================

import { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import { useCompatibilityStore } from '../store/useCompatibilityStore';
import { useModelStore } from '../../models/store/useModelStore';

export const AssignModelModal = () => {
  const {
    isFormOpen,
    editingCompatibility,
    targetLineId,
    closeForm,
    createCompatibility,
    updateCompatibility,
    getForLine,
    isLoading,
    error,
  } = useCompatibilityStore();

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
  const clearError = (field: string) => {
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
    clearError('model');
  };

  const handleCycleTimeChange = (value: string) => {
    setCycleTime(value);
    clearError('cycleTime');
  };

  const handleEfficiencyChange = (value: string) => {
    setEfficiency(value);
    clearError('efficiency');
  };

  const handlePriorityChange = (value: string) => {
    setPriority(value);
    clearError('priority');
  };

  if (!isFormOpen || !targetLineId) return null;

  // Get already assigned model IDs
  const assignedModelIds = new Set(
    getForLine(targetLineId).map(c => c.modelId)
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
        lineId: targetLineId,
        modelId: selectedModelId,
        cycleTime: ct,
        efficiency: eff,
        priority: pri,
      });
    }
  };

  const handleCancel = () => {
    closeForm();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingCompatibility ? 'Edit Model Assignment' : 'Assign Model to Line'}
          </h2>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {/* Model Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedModelId}
              onChange={(e) => handleModelChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.model ? 'border-red-500' : 'border-gray-300'
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
              <p className="mt-1 text-sm text-red-600">{errors.model}</p>
            )}
          </div>

          {/* Cycle Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cycle Time (seconds) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={cycleTime}
              onChange={(e) => handleCycleTimeChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.cycleTime ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="45"
              disabled={isLoading}
            />
            {errors.cycleTime && (
              <p className="mt-1 text-sm text-red-600">{errors.cycleTime}</p>
            )}
          </div>

          {/* Efficiency */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
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
              className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.efficiency ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="92"
              disabled={isLoading}
            />
            {errors.efficiency && (
              <p className="mt-1 text-sm text-red-600">{errors.efficiency}</p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.priority ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="1"
              disabled={isLoading}
            />
            {errors.priority ? (
              <p className="mt-1 text-sm text-red-600">{errors.priority}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Lower number = higher priority
              </p>
            )}
          </div>

          {/* Calculated Real Cycle Time */}
          {realCycleTime !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm font-medium text-blue-900">
                Calculated Real Cycle Time: {realCycleTime.toFixed(2)} seconds
              </div>
              <div className="text-xs text-blue-700 mt-1">
                Formula: Cycle Time / (Efficiency / 100)
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 btn bg-gray-200 text-gray-700 hover:bg-gray-300 py-2"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary py-2"
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

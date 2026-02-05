// ============================================
// LINE FORM
// Formulario reutilizable para crear/editar lineas
// ============================================

import { useState, FormEvent } from 'react';
import { useAreaCatalog } from '../../hooks/useAreaCatalog';

interface LineFormData {
  name: string;
  area: string;
  timeAvailableDaily: number;
}

interface LineFormProps {
  initialData?: Partial<LineFormData>;
  onSubmit: (data: LineFormData) => void;
  onCancel: () => void;
  submitLabel?: string;
  isLoading?: boolean;
}

export const LineForm = ({
  initialData = {},
  onSubmit,
  onCancel,
  submitLabel = 'Create Line',
  isLoading = false,
}: LineFormProps) => {
  const { areas, loading: areasLoading } = useAreaCatalog();
  
  const [formData, setFormData] = useState<LineFormData>({
    name: initialData.name || '',
    area: initialData.area || '',
    timeAvailableDaily: initialData.timeAvailableDaily || 82800,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof LineFormData, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof LineFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.area) {
      newErrors.area = 'Area is required';
    }

    if (formData.timeAvailableDaily <= 0 || formData.timeAvailableDaily > 86400) {
      newErrors.timeAvailableDaily = 'Time must be between 0 and 86400 seconds';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const hoursAvailable = (formData.timeAvailableDaily / 3600).toFixed(2);

  // Quick shortcuts para valores comunes
  const commonHours = [20, 21, 21.5, 22, 23];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Line Name *
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={`w-full px-3 py-2 border rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="e.g. SMT Line 3"
          disabled={isLoading}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      {/* Area */}
      <div>
        <label htmlFor="area" className="block text-sm font-medium text-gray-700 mb-1">
          Production Area *
        </label>
        <select
          id="area"
          value={formData.area}
          onChange={(e) => setFormData({ ...formData, area: e.target.value })}
          className={`w-full px-3 py-2 border rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.area ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={isLoading || areasLoading}
        >
          <option value="">Select area...</option>
          {areas.map((area) => (
            <option key={area.id} value={area.code}>
              {area.name}
            </option>
          ))}
        </select>
        {errors.area && <p className="mt-1 text-sm text-red-600">{errors.area}</p>}
      </div>

      {/* Time Available */}
      <div>
        <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
          Time Available Daily *
        </label>
        
        {/* Quick shortcuts */}
        <div className="flex gap-1 mb-2">
          {commonHours.map((hours) => (
            <button
              key={hours}
              type="button"
              onClick={() => setFormData({ ...formData, timeAvailableDaily: hours * 3600 })}
              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              disabled={isLoading}
            >
              {hours}h
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="number"
            id="time"
            value={formData.timeAvailableDaily}
            onChange={(e) =>
              setFormData({ ...formData, timeAvailableDaily: parseFloat(e.target.value) || 0 })
            }
            className={`flex-1 px-3 py-2 border rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              errors.timeAvailableDaily ? 'border-red-500' : 'border-gray-300'
            }`}
            min="0"
            max="86400"
            step="0.1"
            disabled={isLoading}
          />
          <span className="text-sm text-gray-500 whitespace-nowrap">
            seconds ({hoursAvailable}h)
          </span>
        </div>
        {errors.timeAvailableDaily && (
          <p className="mt-1 text-sm text-red-600">{errors.timeAvailableDaily}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 btn-primary px-4 py-2"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
};

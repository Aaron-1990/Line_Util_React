// ============================================
// PLANT LIST COMPONENT
// Table showing all plants with actions
// Phase 7: Multi-Plant Support
// ============================================

import { Factory, MoreVertical, Pencil, Trash2, Star, ExternalLink, MapPin } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { usePlantStore } from '../store/usePlantStore';
import { useNavigationStore } from '../../../store/useNavigationStore';
import { Plant } from '@shared/types';

// ===== Plant Row Component =====

interface PlantRowProps {
  plant: Plant;
  isDefault: boolean;
  isCurrent: boolean;
}

const PlantRow = ({ plant, isDefault, isCurrent }: PlantRowProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { openForm, openDeleteConfirm, setDefaultPlant } = usePlantStore();
  const { setCurrentPlant, setView } = useNavigationStore();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleOpenPlant = () => {
    setCurrentPlant(plant.id);
    setView('canvas');
    setMenuOpen(false);
  };

  const handleEdit = () => {
    openForm(plant);
    setMenuOpen(false);
  };

  const handleDelete = () => {
    openDeleteConfirm(plant, 0); // TODO: Get actual line count
    setMenuOpen(false);
  };

  const handleSetDefault = async () => {
    await setDefaultPlant(plant.id);
    setMenuOpen(false);
  };

  // Format location string
  const locationParts = [plant.locationCity, plant.locationState, plant.locationCountry].filter(Boolean);
  const locationString = locationParts.join(', ');

  return (
    <tr className={`
      border-b border-gray-200 dark:border-gray-800
      hover:bg-gray-50 dark:hover:bg-gray-800/50
      transition-colors
      ${isCurrent ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
    `}>
      {/* Color indicator + Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: plant.color || '#6B7280' }}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {plant.name}
              </span>
              {isDefault && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded">
                  <Star className="w-3 h-3" />
                  Default
                </span>
              )}
              {isCurrent && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                  Current
                </span>
              )}
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              {plant.code}
            </span>
          </div>
        </div>
      </td>

      {/* Location */}
      <td className="px-4 py-3">
        {locationString ? (
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="w-3.5 h-3.5" />
            {locationString}
          </div>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-600">—</span>
        )}
      </td>

      {/* Region */}
      <td className="px-4 py-3">
        {plant.region ? (
          <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">
            {plant.region}
          </span>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-600">—</span>
        )}
      </td>

      {/* Defaults */}
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        <div className="space-y-0.5">
          <div>{plant.defaultOperationsDays} days/yr</div>
          <div>{plant.defaultShiftsPerDay} shifts × {plant.defaultHoursPerShift}h</div>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="relative flex items-center justify-end gap-2" ref={menuRef}>
          <button
            onClick={handleOpenPlant}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open
          </button>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 py-1">
              <button
                onClick={handleEdit}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              {!isDefault && (
                <button
                  onClick={handleSetDefault}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Star className="w-4 h-4" />
                  Set as Default
                </button>
              )}
              <hr className="my-1 border-gray-200 dark:border-gray-700" />
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                disabled={isDefault}
                title={isDefault ? 'Cannot delete default plant' : undefined}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

// ===== Plant List Component =====

export const PlantList = () => {
  const { plants, isLoading, defaultPlantId } = usePlantStore();
  const { currentPlantId } = useNavigationStore();

  if (isLoading && plants.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (plants.length === 0) {
    return (
      <div className="text-center py-12">
        <Factory className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600" />
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
          No plants yet
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Get started by adding your first manufacturing plant.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Plant
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Location
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Region
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Defaults
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {plants.map((plant) => (
            <PlantRow
              key={plant.id}
              plant={plant}
              isDefault={plant.id === defaultPlantId}
              isCurrent={plant.id === currentPlantId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

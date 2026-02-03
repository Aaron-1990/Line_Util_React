// ============================================
// LINK PROCESS MODAL
// Modal for linking a Process object to a ProductionLine
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

import { X, Search, Factory } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ProductionLine } from '@shared/types';
import { useCanvasObjectStore } from '../../store/useCanvasObjectStore';
import { useNavigationStore } from '../../../../store/useNavigationStore';

interface LinkProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasObjectId: string;
}

/**
 * LinkProcessModal
 *
 * Allows the user to link a Process canvas object to an existing ProductionLine.
 * Shows a searchable list of available lines from the current plant.
 *
 * Usage:
 * - User selects a Process object on canvas
 * - Clicks "Link to Line" button in ObjectPropertiesPanel
 * - This modal opens with list of available production lines
 * - User selects a line and clicks "Link" to confirm
 */
export const LinkProcessModal = ({ isOpen, onClose, canvasObjectId }: LinkProcessModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const currentPlantId = useNavigationStore((state) => state.currentPlantId);
  const { linkToLine } = useCanvasObjectStore();

  // Load production lines when modal opens
  useEffect(() => {
    if (isOpen && currentPlantId) {
      loadProductionLines();
    }
  }, [isOpen, currentPlantId]);

  const loadProductionLines = async () => {
    setIsLoading(true);
    try {
      const response = await window.electronAPI.invoke<ProductionLine[]>(
        'lines:get-by-plant',
        currentPlantId
      );

      if (response.success && response.data) {
        // Filter to only active lines
        const activeLines = response.data.filter((line) => line.active);
        setLines(activeLines);
      } else {
        console.error('[LinkProcessModal] Failed to load lines:', response.error);
        setLines([]);
      }
    } catch (error) {
      console.error('[LinkProcessModal] Error loading lines:', error);
      setLines([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedLineId) return;

    setIsLoading(true);
    try {
      await linkToLine(canvasObjectId, selectedLineId);
      onClose();
    } catch (error) {
      console.error('[LinkProcessModal] Error linking to line:', error);
      alert('Failed to link to production line. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedLineId(null);
    onClose();
  };

  if (!isOpen) return null;

  // Filter lines based on search query
  const filteredLines = lines.filter((line) => {
    const query = searchQuery.toLowerCase();
    return (
      line.name.toLowerCase().includes(query) ||
      line.area.toLowerCase().includes(query)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal Content */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Link to Production Line
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Lines List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : filteredLines.length === 0 ? (
            <div className="text-center py-8">
              <Factory className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {searchQuery
                  ? 'No production lines found matching your search'
                  : 'No production lines available'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLines.map((line) => (
                <button
                  key={line.id}
                  onClick={() => setSelectedLineId(line.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    selectedLineId === line.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-750 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  disabled={isLoading}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {line.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Area: {line.area}
                      </div>
                    </div>
                    {selectedLineId === line.id && (
                      <div className="ml-3">
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleLink}
            disabled={!selectedLineId || isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Linking...' : 'Link'}
          </button>
        </div>
      </div>
    </div>
  );
};

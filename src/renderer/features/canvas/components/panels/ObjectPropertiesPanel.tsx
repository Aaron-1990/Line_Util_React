// ============================================
// OBJECT PROPERTIES PANEL
// Right-side panel for editing object properties
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

import { memo, useState, useEffect } from 'react';
import { X, Cog, Box, Link2, Unlink } from 'lucide-react';
import { useToolStore } from '../../store/useToolStore';
import { useCanvasObjectStore } from '../../store/useCanvasObjectStore';
import { BufferProperties, OverflowPolicy } from '@shared/types';
import { LinkProcessModal } from '../modals/LinkProcessModal';

/**
 * ObjectPropertiesPanel
 *
 * Shows and edits properties for the selected canvas object.
 * Content changes based on objectType:
 * - generic: name, description
 * - process: name, description, linked production line
 * - buffer: name, description, capacity, buffer time, FIFO, overflow policy
 */
export const ObjectPropertiesPanel = memo(() => {
  const selectedObjectIds = useToolStore((state) => state.selectedObjectIds);
  const {
    getObjectById,
    updateObject,
    getBufferProps,
    setBufferProps,
    unlinkFromLine
  } = useCanvasObjectStore();

  // Only show panel if exactly one object is selected
  const selectedId = selectedObjectIds.length === 1 ? selectedObjectIds[0] : null;
  const object = selectedId ? getObjectById(selectedId) : null;

  // Local form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Buffer properties state
  const [bufferProps, setLocalBufferProps] = useState<Partial<BufferProperties>>({});

  // Modal state for linking process to line
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  // Sync form state with selected object
  useEffect(() => {
    if (object) {
      setName(object.name);
      setDescription(object.description ?? '');

      if (object.objectType === 'buffer') {
        loadBufferProps();
      }
    }
  }, [object?.id, object?.objectType]);

  const loadBufferProps = async () => {
    if (selectedId) {
      const props = await getBufferProps(selectedId);
      if (props) {
        setLocalBufferProps(props);
      }
    }
  };

  // Don't render if no object selected
  if (!object) {
    return null;
  }

  const handleNameChange = async () => {
    if (name !== object.name) {
      await updateObject(object.id, { name });
    }
  };

  const handleDescriptionChange = async () => {
    if (description !== object.description) {
      await updateObject(object.id, { description });
    }
  };

  const handleBufferPropChange = async (key: keyof BufferProperties, value: unknown) => {
    setLocalBufferProps((prev) => ({ ...prev, [key]: value }));
    await setBufferProps(object.id, { [key]: value });
  };

  const handleUnlinkLine = async () => {
    await unlinkFromLine(object.id);
  };

  const clearSelection = useToolStore((state) => state.clearSelection);

  return (
    <>
      {/* Link Process Modal */}
      {object?.objectType === 'process' && selectedId && (
        <LinkProcessModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          canvasObjectId={selectedId}
        />
      )}

      <div className="absolute right-4 top-20 z-20 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          {object.objectType === 'process' && <Cog className="w-4 h-4 text-blue-500" />}
          {object.objectType === 'buffer' && <Box className="w-4 h-4 text-amber-500" />}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {object.objectType.charAt(0).toUpperCase() + object.objectType.slice(1)} Properties
          </span>
        </div>
        <button
          onClick={clearSelection}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Name Field */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description Field */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionChange}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Process-specific: Linked Line */}
        {object.objectType === 'process' && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Linked Production Line
            </label>
            {object.linkedLine ? (
              <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {object.linkedLine.name}
                  </span>
                </div>
                <button
                  onClick={handleUnlinkLine}
                  className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-500"
                  title="Unlink"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => setIsLinkModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors"
                >
                  <Link2 className="w-4 h-4" />
                  Link to Line
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Connect this process to an existing production line
                </p>
              </div>
            )}
          </div>
        )}

        {/* Buffer-specific: Properties */}
        {object.objectType === 'buffer' && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Buffer Properties
            </div>

            {/* Max Capacity */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Max Capacity (units)
              </label>
              <input
                type="number"
                value={bufferProps.maxCapacity ?? 100}
                onChange={(e) => handleBufferPropChange('maxCapacity', parseInt(e.target.value) || 0)}
                min={0}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Buffer Time */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Buffer Time (hours)
              </label>
              <input
                type="number"
                value={bufferProps.bufferTimeHours ?? 4.0}
                onChange={(e) => handleBufferPropChange('bufferTimeHours', parseFloat(e.target.value) || 0)}
                min={0}
                step={0.5}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* FIFO Enforced */}
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                FIFO Enforced
              </label>
              <button
                onClick={() => handleBufferPropChange('fifoEnforced', !bufferProps.fifoEnforced)}
                className={`w-10 h-6 rounded-full transition-colors ${
                  bufferProps.fifoEnforced
                    ? 'bg-blue-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    bufferProps.fifoEnforced ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Overflow Policy */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Overflow Policy
              </label>
              <select
                value={bufferProps.overflowPolicy ?? 'block'}
                onChange={(e) => handleBufferPropChange('overflowPolicy', e.target.value as OverflowPolicy)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="block">Block (stop upstream)</option>
                <option value="overflow">Overflow (allow excess)</option>
                <option value="alert">Alert (warn only)</option>
              </select>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
});

ObjectPropertiesPanel.displayName = 'ObjectPropertiesPanel';

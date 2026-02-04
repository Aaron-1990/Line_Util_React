// ============================================
// OBJECT PROPERTIES PANEL
// Right-side panel for editing object properties
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

import { memo, useState, useEffect } from 'react';
import { X, Cog, Box, Link2, Unlink, Trash2, AlertTriangle, ChevronDown, ChevronRight, Plus, Edit2, Loader2 } from 'lucide-react';
import { useToolStore } from '../../store/useToolStore';
import { useCanvasObjectStore } from '../../store/useCanvasObjectStore';
import { useCanvasObjectCompatibilityStore } from '../../store/useCanvasObjectCompatibilityStore';
import { useAreaStore } from '../../../areas/store/useAreaStore';
import { BufferProperties, OverflowPolicy, ProcessProperties } from '@shared/types';
import { LinkProcessModal } from '../modals/LinkProcessModal';
import { AssignModelToObjectModal } from '../modals/AssignModelToObjectModal';

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
  const clearSelection = useToolStore((state) => state.clearSelection);
  const {
    getObjectById,
    updateObject,
    getBufferProps,
    setBufferProps,
    getProcessProps,
    setProcessProps,
    unlinkFromLine,
    deleteObject
  } = useCanvasObjectStore();

  // Area catalog for process properties dropdown
  const { areas, loadAreas } = useAreaStore();

  // Canvas object compatibilities (assigned models)
  const {
    loadForObject: loadCompatibilities,
    getForObject: getCompatibilities,
    deleteCompatibility,
    openForm: openAssignModelForm,
    isLoading: isCompatLoading,
  } = useCanvasObjectCompatibilityStore();

  // Only show panel if exactly one object is selected
  const selectedId = selectedObjectIds.length === 1 ? selectedObjectIds[0] : null;
  const object = selectedId ? getObjectById(selectedId) : null;

  // Local form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Buffer properties state
  const [bufferProps, setLocalBufferProps] = useState<Partial<BufferProperties>>({});

  // Process properties state
  const [processProps, setLocalProcessProps] = useState<Partial<ProcessProperties>>({});

  // Modal state for linking process to line
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Assigned models section expanded state
  const [isModelsExpanded, setIsModelsExpanded] = useState(true);

  // Sync form state with selected object
  useEffect(() => {
    if (object) {
      setName(object.name);
      setDescription(object.description ?? '');

      if (object.objectType === 'buffer') {
        loadBufferProps();
      }

      if (object.objectType === 'process') {
        loadProcessProps();
        // Load areas for dropdown if not already loaded
        if (areas.length === 0) {
          loadAreas();
        }
        // Load assigned models for process objects
        loadCompatibilities(object.id);
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

  const loadProcessProps = async () => {
    if (selectedId) {
      const props = await getProcessProps(selectedId);
      if (props) {
        setLocalProcessProps(props as Partial<ProcessProperties>);
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

  const handleProcessPropChange = async (key: keyof ProcessProperties, value: unknown) => {
    setLocalProcessProps((prev) => ({ ...prev, [key]: value }));
    await setProcessProps(object.id, { [key]: value });
  };

  // Helper to convert seconds to hours for display
  const secondsToHours = (seconds: number): number => Math.round(seconds / 3600);

  // Helper to convert hours to seconds for storage
  const hoursToSeconds = (hours: number): number => hours * 3600;

  const handleUnlinkLine = async () => {
    await unlinkFromLine(object.id);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteObject(object.id);
      clearSelection();
      setShowDeleteModal(false);
    } catch (error) {
      console.error('[ObjectPropertiesPanel] Error deleting object:', error);
      alert('Failed to delete object. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

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

      {/* Assign Model Modal */}
      <AssignModelToObjectModal />

      <div className="absolute right-4 top-20 z-20 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100% - 100px)' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
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

      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

        {/* Process-specific: Production Properties */}
        {object.objectType === 'process' && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Production Properties
            </div>

            {/* Area */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Area
              </label>
              <select
                value={processProps.area ?? ''}
                onChange={(e) => handleProcessPropChange('area', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select area...</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.code}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Available */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Time Available (hours/day)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={secondsToHours(processProps.timeAvailableDaily ?? 72000)}
                  onChange={(e) => handleProcessPropChange('timeAvailableDaily', hoursToSeconds(parseFloat(e.target.value) || 0))}
                  min={0}
                  max={24}
                  step={0.5}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* Quick select buttons */}
                <div className="flex gap-1">
                  {[20, 21, 22, 23].map((h) => (
                    <button
                      key={h}
                      onClick={() => handleProcessPropChange('timeAvailableDaily', hoursToSeconds(h))}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${
                        secondsToHours(processProps.timeAvailableDaily ?? 72000) === h
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title={`${h} hours`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Line Type */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Line Type
              </label>
              <select
                value={processProps.lineType ?? 'shared'}
                onChange={(e) => handleProcessPropChange('lineType', e.target.value as 'shared' | 'dedicated')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="shared">Shared (multiple models)</option>
                <option value="dedicated">Dedicated (single model)</option>
              </select>
            </div>

            {/* Changeover Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Changeover Enabled
              </label>
              <button
                onClick={() => handleProcessPropChange('changeoverEnabled', !processProps.changeoverEnabled)}
                className={`w-10 h-6 rounded-full transition-colors ${
                  processProps.changeoverEnabled !== false
                    ? 'bg-blue-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    processProps.changeoverEnabled !== false ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Process-specific: Assigned Models */}
        {object.objectType === 'process' && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            {/* Collapsible Header */}
            <div className="w-full flex items-center justify-between text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              <button
                onClick={() => setIsModelsExpanded(!isModelsExpanded)}
                className="flex items-center gap-2 hover:text-gray-800 dark:hover:text-gray-200"
              >
                {isModelsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Assigned Models
                <span className="text-xs text-gray-400">
                  ({getCompatibilities(object.id).length})
                </span>
              </button>
              <button
                onClick={() => openAssignModelForm(object.id)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-blue-500"
                title="Assign Model"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {isModelsExpanded && (
              <div className="space-y-2">
                {isCompatLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : getCompatibilities(object.id).length === 0 ? (
                  <div className="text-center py-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      No models assigned
                    </p>
                    <button
                      onClick={() => openAssignModelForm(object.id)}
                      className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                    >
                      + Assign a model
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {getCompatibilities(object.id).map((compat) => (
                      <div
                        key={compat.id}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-xs group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-700 dark:text-gray-300 truncate">
                            {compat.modelName}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">
                            CT: {compat.cycleTime}s · Eff: {compat.efficiency}% · Pri: {compat.priority}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openAssignModelForm(object.id, compat)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-blue-500"
                            title="Edit"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteCompatibility(compat.id, object.id)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-red-500"
                            title="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Process-specific: Linked Line (Legacy) */}
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
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md transition-colors border border-gray-300 dark:border-gray-600"
                >
                  <Link2 className="w-4 h-4" />
                  Link to Existing Line
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Or connect to an imported production line
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

        {/* Delete Button */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            onClick={handleDeleteClick}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 text-sm font-medium rounded-md transition-colors border border-red-200 dark:border-red-800"
          >
            <Trash2 className="w-4 h-4" />
            Delete Object
          </button>
        </div>
      </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Header */}
            <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Object</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-gray-900 dark:text-gray-100">{object.name}</span>?
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                This object will be removed from the canvas permanently.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
              <button
                onClick={handleCancelDelete}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Object'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

ObjectPropertiesPanel.displayName = 'ObjectPropertiesPanel';

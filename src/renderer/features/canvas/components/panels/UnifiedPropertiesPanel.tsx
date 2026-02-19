// ============================================
// UNIFIED PROPERTIES PANEL
// Single floating panel for both Lines and Canvas Objects
// Shows contextual content based on selection type
// ============================================

import { memo, useState, useEffect, useCallback } from 'react';
import {
  X,
  Factory,
  Cog,
  Box,
  Edit2,
  Trash2,
  AlertTriangle,
  Link2,
  Unlink,
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  Check,
  Circle,
} from 'lucide-react';
import { useSelectionState } from '../../hooks/useSelectionState';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useCanvasObjectStore } from '../../store/useCanvasObjectStore';
import { useCanvasObjectCompatibilityStore } from '../../store/useCanvasObjectCompatibilityStore';
import { useToolStore } from '../../store/useToolStore';
import { useAreaStore } from '../../../areas/store/useAreaStore';
import { useAnalysisStore } from '../../../analysis/store/useAnalysisStore';
import { BufferProperties, OverflowPolicy, ProcessProperties } from '@shared/types';
import { CompatibilityList } from '../../../compatibility/components/CompatibilityList';
import { AssignModelModal } from '../../../compatibility/components/AssignModelModal';
import { LinkProcessModal } from '../modals/LinkProcessModal';
import { AssignModelToObjectModal } from '../modals/AssignModelToObjectModal';

// ============================================
// TIME AVAILABLE INPUT COMPONENT
// Controlled input with local string state for proper decimal/empty handling
// ============================================

interface TimeAvailableInputProps {
  value: number; // seconds
  onChange: (seconds: number) => void;
  disabled?: boolean;
}

const TimeAvailableInput = ({ value, onChange, disabled }: TimeAvailableInputProps) => {
  // Local string state to allow empty field and proper decimal input
  const [localValue, setLocalValue] = useState('');

  // Sync with external value when it changes
  useEffect(() => {
    // value === 0 means unset — show empty field so placeholder is visible
    if (value === 0) {
      setLocalValue('');
      return;
    }
    const hours = value / 3600;
    // Show clean integer or up to 2 decimal places
    setLocalValue(Number.isInteger(hours) ? hours.toString() : hours.toFixed(2).replace(/\.?0+$/, ''));
  }, [value]);

  const handleBlur = useCallback(() => {
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 24) {
      onChange(parsed * 3600);
    } else {
      // Revert to previous valid value (empty if unset)
      if (value === 0) {
        setLocalValue('');
      } else {
        const hours = value / 3600;
        setLocalValue(Number.isInteger(hours) ? hours.toString() : hours.toFixed(2).replace(/\.?0+$/, ''));
      }
    }
  }, [localValue, onChange, value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  }, []);

  return (
    <div className="flex gap-2">
      <input
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="e.g. 21.5"
      />
      <div className="flex gap-1">
        {[20, 21, 22, 23].map((h) => {
          const isActive = Math.abs(value / 3600 - h) < 0.01;
          return (
            <button
              key={h}
              type="button"
              onClick={() => onChange(h * 3600)}
              disabled={disabled}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                isActive
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {h}h
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * UnifiedPropertiesPanel
 *
 * A single floating panel that displays properties based on what's selected:
 * - Production Line: Name, Area, Time, Assigned Models
 * - Canvas Object (Process/Buffer): Type-specific properties
 */
export const UnifiedPropertiesPanel = memo(() => {
  const selection = useSelectionState();

  // Don't render if nothing selected or multi-select
  if (selection.type === 'none' || selection.type === 'multi') {
    return null;
  }

  return (
    <aside
      className="absolute right-4 top-20 z-30 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-slide-in"
      style={{ maxHeight: 'calc(100% - 160px)' }}
      role="complementary"
      aria-label="Properties panel"
    >
      {selection.type === 'line' && <LinePropertiesContent lineId={selection.selectedId!} />}
      {selection.type === 'object' && <ObjectPropertiesContent objectId={selection.selectedId!} />}

      {/* Modals */}
      <AssignModelModal />
      <AssignModelToObjectModal />
    </aside>
  );
});

UnifiedPropertiesPanel.displayName = 'UnifiedPropertiesPanel';

// ============================================
// LINE PROPERTIES CONTENT (Process Objects)
// Phase 7.5: Now uses canvas_objects (unified structure)
// Phase 7.6: Data comes from useCanvasObjectStore.objects[] (single source of truth)
// ============================================

interface LinePropertiesContentProps {
  lineId: string;  // Actually a canvas object ID (process type)
}

const LinePropertiesContent = ({ lineId }: LinePropertiesContentProps) => {
  const { setSelectedNode } = useCanvasStore();
  const { updateObject, setProcessProps } = useCanvasObjectStore();
  // Phase 7.6: Get object data from objects[] (single source of truth)
  const objects = useCanvasObjectStore((state) => state.objects);
  const { areas, loadAreas } = useAreaStore();

  // Local state for inline editing
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [timeAvailableDaily, setTimeAvailableDaily] = useState(0);

  // Phase 7.6: Get object from objects[] instead of node.data
  const object = objects.find((o) => o.id === lineId);

  // Sync local state with selected object
  useEffect(() => {
    if (object) {
      setName(object.name || '');
      // Area and timeAvailableDaily come from processProperties
      const processProps = object.processProperties;
      setArea(processProps?.area || '');
      setTimeAvailableDaily(processProps?.timeAvailableDaily || 0);
      if (areas.length === 0) {
        loadAreas();
      }
    }
  }, [object?.id, object?.name, object?.processProperties?.area, object?.processProperties?.timeAvailableDaily, areas.length, loadAreas]);

  if (!object) return null;

  const handleClose = () => {
    setSelectedNode(null);
  };

  // Save field on blur - Phase 7.6: updateObject updates objects[], GenericShapeNode re-renders via selector
  const handleNameBlur = async () => {
    if (name.trim() && name !== object.name) {
      try {
        await updateObject(object.id, { name: name.trim() });
        // Phase 7.6: No updateNode needed - GenericShapeNode reads from objects[] via selector
      } catch (error) {
        console.error('Error updating name:', error);
        setName(object.name); // Revert on error
      }
    } else {
      setName(object.name); // Revert if empty
    }
  };

  // Phase 7.6: Update process properties for area
  const handleAreaChange = async (newArea: string) => {
    setArea(newArea);
    if (newArea && newArea !== (object.processProperties?.area || '')) {
      try {
        await setProcessProps(object.id, { area: newArea });
        // Phase 7.6: No updateNode needed - setProcessProps updates objects[], GenericShapeNode re-renders
        // Bug 1 Fix: Refresh status bar counts when area changes
        useAnalysisStore.getState().refreshData();
      } catch (error) {
        console.error('Error updating area:', error);
        setArea(object.processProperties?.area || ''); // Revert on error
      }
    }
  };

  // Phase 7.6: Update process properties for time
  const handleTimeChange = async (seconds: number) => {
    setTimeAvailableDaily(seconds);
    const currentTime = object.processProperties?.timeAvailableDaily || 0;
    if (seconds !== currentTime) {
      try {
        await setProcessProps(object.id, { timeAvailableDaily: seconds });
        // Phase 7.6: No updateNode needed - setProcessProps updates objects[], GenericShapeNode re-renders
        // Bug 1 Fix: Refresh status bar counts when time changes
        useAnalysisStore.getState().refreshData();
      } catch (error) {
        console.error('Error updating time:', error);
        setTimeAvailableDaily(currentTime); // Revert on error
      }
    }
  };

  return (
    <>
      {/* Header */}
      <PanelHeader
        icon={<Factory className="w-4 h-4 text-indigo-500" />}
        title="Line Properties"
        onClose={handleClose}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name - editable */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Area - dropdown */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Area
          </label>
          <select
            value={area}
            onChange={(e) => handleAreaChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select area...</option>
            {areas.map((a) => (
              <option key={a.id} value={a.code}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Time Available - with TimeAvailableInput component */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Time Available (hours/day)
          </label>
          <TimeAvailableInput
            value={timeAvailableDaily}
            onChange={handleTimeChange}
          />
        </div>

        {/* Completeness Checklist */}
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Data Completeness
          </label>
          <div className="mt-1.5 space-y-1">
            {[
              { label: 'Name', done: !!(object.name && object.name.trim() !== '') },
              { label: 'Area', done: !!(object.processProperties?.area && object.processProperties.area !== '') },
              { label: 'Time Available', done: (object.processProperties?.timeAvailableDaily ?? 0) > 0 },
              { label: 'Models Assigned', done: (object.compatibilitiesCount ?? 0) > 0 },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                {item.done ? (
                  <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                )}
                <span className={`text-xs ${item.done ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Assigned Models */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <CompatibilityList lineId={object.id} />
        </div>
      </div>

    </>
  );
};

// ============================================
// OBJECT PROPERTIES CONTENT
// ============================================

interface ObjectPropertiesContentProps {
  objectId: string;
}

const ObjectPropertiesContent = ({ objectId }: ObjectPropertiesContentProps) => {
  const clearSelection = useToolStore((state) => state.clearSelection);

  // Subscribe to objects array to trigger re-render when store updates
  const objects = useCanvasObjectStore((state) => state.objects);
  const {
    updateObject,
    getBufferProps,
    setBufferProps,
    getProcessProps,
    setProcessProps,
    unlinkFromLine,
    deleteObject,
  } = useCanvasObjectStore();

  const { areas, loadAreas } = useAreaStore();
  const {
    loadForObject: loadCompatibilities,
    getForObject: getCompatibilities,
    deleteCompatibility,
    openForm: openAssignModelForm,
    isLoading: isCompatLoading,
  } = useCanvasObjectCompatibilityStore();

  // Find object from the subscribed objects array (reactive)
  const object = objects.find((obj) => obj.id === objectId);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bufferProps, setLocalBufferProps] = useState<Partial<BufferProperties>>({});
  const [processProps, setLocalProcessProps] = useState<Partial<ProcessProperties>>({});
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isModelsExpanded, setIsModelsExpanded] = useState(true);

  // Sync form state with selected object
  useEffect(() => {
    if (object) {
      setName(object.name);
      setDescription(object.description ?? '');

      if (object.objectType === 'buffer') {
        loadBufferPropsAsync();
      }

      if (object.objectType === 'process') {
        loadProcessPropsAsync();
        if (areas.length === 0) {
          loadAreas();
        }
        loadCompatibilities(object.id);
      }
    }
  }, [object?.id, object?.objectType]);

  const loadBufferPropsAsync = async () => {
    const props = await getBufferProps(objectId);
    if (props) setLocalBufferProps(props);
  };

  const loadProcessPropsAsync = async () => {
    const props = await getProcessProps(objectId);
    if (props) setLocalProcessProps(props as Partial<ProcessProperties>);
  };

  if (!object) return null;

  const handleClose = () => {
    clearSelection();
  };

  const handleNameBlur = async () => {
    if (name !== object.name) {
      await updateObject(object.id, { name });
    }
  };

  const handleDescriptionBlur = async () => {
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
    // Phase 7.6: No updateNode needed - setProcessProps updates objects[], GenericShapeNode re-renders via selector

    if (key === 'area' || key === 'timeAvailableDaily') {
      useAnalysisStore.getState().refreshData();
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteObject(object.id);
      clearSelection();
    } catch (error) {
      console.error('Error deleting object:', error);
      alert('Failed to delete object.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const getIcon = () => {
    switch (object.objectType) {
      case 'process':
        return <Cog className="w-4 h-4 text-blue-500" />;
      case 'buffer':
        return <Box className="w-4 h-4 text-amber-500" />;
      default:
        return <Box className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTitle = () => {
    return `${object.objectType.charAt(0).toUpperCase() + object.objectType.slice(1)} Properties`;
  };

  return (
    <>
      {/* Header */}
      <PanelHeader icon={getIcon()} title={getTitle()} onClose={handleClose} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Process-specific properties */}
        {object.objectType === 'process' && (
          <>
            <SectionDivider title="Production Properties" />

            {/* Area */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Area</label>
              <select
                value={processProps.area ?? ''}
                onChange={(e) => handleProcessPropChange('area', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <TimeAvailableInput
                value={processProps.timeAvailableDaily ?? 0}
                onChange={(seconds) => handleProcessPropChange('timeAvailableDaily', seconds)}
              />
            </div>

            {/* Line Type */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Line Type</label>
              <select
                value={processProps.lineType ?? 'shared'}
                onChange={(e) => handleProcessPropChange('lineType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="shared">Shared (multiple models)</option>
                <option value="dedicated">Dedicated (single model)</option>
              </select>
            </div>

            {/* Changeover Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 dark:text-gray-400">Changeover Enabled</label>
              <ToggleSwitch
                checked={processProps.changeoverEnabled !== false}
                onChange={(checked) => handleProcessPropChange('changeoverEnabled', checked)}
              />
            </div>

            {/* Assigned Models */}
            <SectionDivider />
            <div>
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setIsModelsExpanded(!isModelsExpanded)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  {isModelsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  Assigned Models
                  <span className="text-xs text-gray-400">({getCompatibilities(object.id).length})</span>
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
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">No models assigned</p>
                      <button
                        onClick={() => openAssignModelForm(object.id)}
                        className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                      >
                        + Assign a model
                      </button>
                    </div>
                  ) : (
                    getCompatibilities(object.id).map((compat) => (
                      <div
                        key={compat.id}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-700 dark:text-gray-300 truncate">
                            {compat.modelName}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">
                            CT: {compat.cycleTime}s | Eff: {compat.efficiency}% | Pri: {compat.priority}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openAssignModelForm(object.id, compat)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-blue-500"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteCompatibility(compat.id, object.id)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Linked Production Line */}
            <SectionDivider title="Linked Production Line" />
            {object.linkedLine ? (
              <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">{object.linkedLine.name}</span>
                </div>
                <button
                  onClick={() => unlinkFromLine(object.id)}
                  className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-500"
                  title="Unlink"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLinkModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-300 dark:border-gray-600"
              >
                <Link2 className="w-4 h-4" />
                Link to Existing Line
              </button>
            )}
          </>
        )}

        {/* Buffer-specific properties */}
        {object.objectType === 'buffer' && (
          <>
            <SectionDivider title="Buffer Properties" />

            {/* Max Capacity */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Max Capacity (units)</label>
              <input
                type="number"
                value={bufferProps.maxCapacity ?? 100}
                onChange={(e) => handleBufferPropChange('maxCapacity', parseInt(e.target.value) || 0)}
                min={0}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Buffer Time */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Buffer Time (hours)</label>
              <input
                type="number"
                value={bufferProps.bufferTimeHours ?? 4.0}
                onChange={(e) => handleBufferPropChange('bufferTimeHours', parseFloat(e.target.value) || 0)}
                min={0}
                step={0.5}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* FIFO Enforced */}
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 dark:text-gray-400">FIFO Enforced</label>
              <ToggleSwitch
                checked={bufferProps.fifoEnforced ?? false}
                onChange={(checked) => handleBufferPropChange('fifoEnforced', checked)}
              />
            </div>

            {/* Overflow Policy */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Overflow Policy</label>
              <select
                value={bufferProps.overflowPolicy ?? 'block'}
                onChange={(e) => handleBufferPropChange('overflowPolicy', e.target.value as OverflowPolicy)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="block">Block (stop upstream)</option>
                <option value="overflow">Overflow (allow excess)</option>
                <option value="alert">Alert (warn only)</option>
              </select>
            </div>
          </>
        )}

        {/* Delete Button */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 text-sm font-medium rounded-lg transition-colors border border-red-200 dark:border-red-800"
          >
            <Trash2 className="w-4 h-4" />
            Delete Object
          </button>
        </div>
      </div>

      {/* Link Process Modal */}
      {object.objectType === 'process' && (
        <LinkProcessModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} canvasObjectId={objectId} />
      )}

      {/* Delete Confirmation */}
      {showDeleteModal && (
        <DeleteConfirmModal
          itemName={object.name}
          itemType="object"
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={isDeleting}
        />
      )}
    </>
  );
};

// ============================================
// SHARED COMPONENTS
// ============================================

interface PanelHeaderProps {
  icon: React.ReactNode;
  title: string;
  onClose: () => void;
}

const PanelHeader = ({ icon, title, onClose }: PanelHeaderProps) => (
  <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
    <div className="flex items-center gap-2">
      {icon}
      <span className="font-medium text-gray-700 dark:text-gray-300">{title}</span>
    </div>
    <button
      onClick={onClose}
      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      aria-label="Close properties panel"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

interface SectionDividerProps {
  title?: string;
}

const SectionDivider = ({ title }: SectionDividerProps) => (
  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
    {title && <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">{title}</div>}
  </div>
);

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleSwitch = ({ checked, onChange }: ToggleSwitchProps) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-10 h-6 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
  >
    <div
      className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`}
    />
  </button>
);

interface DeleteConfirmModalProps {
  itemName: string;
  itemType: 'line' | 'object';
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

const DeleteConfirmModal = ({ itemName, itemType, onConfirm, onCancel, isDeleting }: DeleteConfirmModalProps) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
      <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Delete {itemType === 'line' ? 'Line' : 'Object'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
        </div>
      </div>
      <div className="p-6">
        <p className="text-gray-700 dark:text-gray-300">
          Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-gray-100">{itemName}</span>?
        </p>
      </div>
      <div className="flex gap-3 p-6 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
);

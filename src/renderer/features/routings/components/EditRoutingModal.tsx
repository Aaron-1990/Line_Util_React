// ============================================
// EDIT ROUTING MODAL
// Edit model routing and line assignments
// Phase 6.5: Enhanced with DAG predecessor support
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Save, Info, ArrowRight, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, GitBranch, XCircle } from 'lucide-react';
import { useRoutingStore } from '../store/useRoutingStore';
import { useCompatibilityStore } from '@renderer/features/compatibility/store/useCompatibilityStore';
import { ProductionLine, ModelAreaRoutingStepInput, RoutingValidationResult } from '@shared/types';
import { PredecessorSelector } from './PredecessorSelector';

interface EditRoutingModalProps {
  isOpen: boolean;
  modelId: string;
  modelName: string;
  onClose: () => void;
}

interface LineAssignment {
  lineId: string;
  lineName: string;
  compatibilityId?: string;
  cycleTime: number;
  efficiency: number;
  priority: number;
  isNew?: boolean;
}

interface AreaAssignments {
  area: string;
  color: string;
  lines: LineAssignment[];
  predecessors: string[];  // Area codes that must complete before this one
}

export const EditRoutingModal = ({ isOpen, modelId, modelName, onClose }: EditRoutingModalProps) => {
  const {
    productionLines,
    compatibilities,
    areaCatalog,
    loadData: loadRoutingData,
    loadRoutingConfig,
    saveRoutingConfig,
    clearRouting,
    validateSteps,
    getAreaColor,
    isSaving,
  } = useRoutingStore();

  const {
    createCompatibility,
    updateCompatibility,
    deleteCompatibility,
    isLoading: isCompatibilitySaving,
  } = useCompatibilityStore();

  // State
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [areaAssignments, setAreaAssignments] = useState<Map<string, AreaAssignments>>(new Map());
  const [errors, setErrors] = useState<string[]>([]);
  const [dagValidation, setDagValidation] = useState<RoutingValidationResult | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [hasExistingRouting, setHasExistingRouting] = useState(false);
  const [routingCleared, setRoutingCleared] = useState(false);  // Track if user cleared routing (pending save)

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadRoutingData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Initialize form when data is loaded
  useEffect(() => {
    if (!isOpen || !modelId) return;

    const initializeForm = async () => {
      // Load existing DAG routing config
      const dagConfig = await loadRoutingConfig(modelId);

      // Find all compatibilities for this model
      const modelCompatibilities = compatibilities.filter(c => c.modelId === modelId);

      // Group by area
      const areasMap = new Map<string, AreaAssignments>();
      const areas: string[] = [];

      // If we have DAG config, use its order and predecessors
      if (dagConfig && dagConfig.steps.length > 0) {
        for (const step of dagConfig.steps) {
          const areaColor = areaCatalog.find(a => a.code === step.areaCode)?.color || '#6b7280';
          areasMap.set(step.areaCode, {
            area: step.areaCode,
            color: areaColor,
            lines: [],
            predecessors: step.predecessors,
          });
          areas.push(step.areaCode);
        }
      }

      // Add compatibilities to areas
      modelCompatibilities.forEach(compat => {
        const line = productionLines.find(l => l.id === compat.lineId);
        if (!line) return;

        // Create area if not from DAG config
        if (!areasMap.has(line.area)) {
          const areaColor = areaCatalog.find(a => a.code === line.area)?.color || '#6b7280';
          areasMap.set(line.area, {
            area: line.area,
            color: areaColor,
            lines: [],
            predecessors: [],
          });
          areas.push(line.area);
        }

        areasMap.get(line.area)!.lines.push({
          lineId: line.id,
          lineName: line.name,
          compatibilityId: compat.id,
          cycleTime: compat.cycleTime,
          efficiency: compat.efficiency,
          priority: compat.priority,
        });
      });

      setSelectedAreas(areas);
      setAreaAssignments(areasMap);
      setErrors([]);
      setHasExistingRouting(dagConfig !== null && dagConfig.steps.length > 0);
      setShowClearConfirm(false);
      setRoutingCleared(false);

      // Validate initial state
      validateCurrentState(areas, areasMap);
    };

    initializeForm();
  }, [isOpen, modelId, compatibilities, productionLines, areaCatalog, loadRoutingConfig]);

  // Validate DAG whenever areas or predecessors change
  const validateCurrentState = useCallback((
    areas: string[],
    assignments: Map<string, AreaAssignments>
  ) => {
    const steps: ModelAreaRoutingStepInput[] = areas.map((areaCode, index) => ({
      areaCode,
      sequence: index,
      predecessors: assignments.get(areaCode)?.predecessors || [],
    }));

    const validation = validateSteps(steps);
    setDagValidation(validation);
  }, [validateSteps]);

  // Check if adding a predecessor would create a cycle
  const wouldCreateCycle = useCallback((areaCode: string, newPredecessor: string): boolean => {
    // Build test steps with the new predecessor
    const testSteps: ModelAreaRoutingStepInput[] = selectedAreas.map((code, index) => ({
      areaCode: code,
      sequence: index,
      predecessors: code === areaCode
        ? [...(areaAssignments.get(code)?.predecessors || []), newPredecessor]
        : areaAssignments.get(code)?.predecessors || [],
    }));

    const validation = validateSteps(testSteps);
    return validation.hasCycle;
  }, [selectedAreas, areaAssignments, validateSteps]);

  if (!isOpen) return null;

  // Get available areas (not yet in routing)
  const availableAreas = areaCatalog
    .filter(a => !selectedAreas.includes(a.code))
    .sort((a, b) => a.sequence - b.sequence);

  // Get available lines for an area (lines not yet assigned)
  const getAvailableLinesForArea = (area: string): ProductionLine[] => {
    const areaData = areaAssignments.get(area);
    const assignedLineIds = new Set(areaData?.lines.map(l => l.lineId) || []);

    return productionLines
      .filter(l => l.area === area && !assignedLineIds.has(l.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  // Get area type for color coding
  const getAreaType = (areaCode: string): 'start' | 'end' | 'intermediate' => {
    if (!dagValidation) return 'intermediate';
    if (dagValidation.startNodes.includes(areaCode)) return 'start';
    if (dagValidation.endNodes.includes(areaCode)) return 'end';
    return 'intermediate';
  };

  // Add area to routing
  const handleAddArea = (areaCode: string) => {
    const area = areaCatalog.find(a => a.code === areaCode);
    if (!area) return;

    // Default behavior: if there are existing areas, depend on the last one (linear flow)
    const lastArea = selectedAreas[selectedAreas.length - 1];
    const defaultPredecessors: string[] = lastArea ? [lastArea] : [];

    const newAreas = [...selectedAreas, areaCode];
    const newMap = new Map(areaAssignments);
    if (!newMap.has(areaCode)) {
      newMap.set(areaCode, {
        area: areaCode,
        color: area.color,
        lines: [],
        predecessors: defaultPredecessors,
      });
    }

    setSelectedAreas(newAreas);
    setAreaAssignments(newMap);
    validateCurrentState(newAreas, newMap);
  };

  // Move area in sequence (for reordering display)
  const handleMoveArea = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= selectedAreas.length || toIndex >= selectedAreas.length) return;

    const newAreas = [...selectedAreas];
    const movedArea = newAreas[fromIndex];
    if (!movedArea) return;

    newAreas.splice(fromIndex, 1);
    newAreas.splice(toIndex, 0, movedArea);
    setSelectedAreas(newAreas);
  };

  // Remove area from routing
  const handleRemoveArea = (areaCode: string) => {
    // Also remove this area from any predecessors lists
    const newMap = new Map(areaAssignments);
    newMap.delete(areaCode);

    // Clean up references to removed area
    for (const [, areaData] of newMap) {
      areaData.predecessors = areaData.predecessors.filter(p => p !== areaCode);
    }

    const newAreas = selectedAreas.filter(a => a !== areaCode);
    setSelectedAreas(newAreas);
    setAreaAssignments(newMap);
    validateCurrentState(newAreas, newMap);
  };

  // Update predecessors for an area
  const handleUpdatePredecessors = (areaCode: string, predecessors: string[]) => {
    const newMap = new Map(areaAssignments);
    const areaData = newMap.get(areaCode);
    if (areaData) {
      areaData.predecessors = predecessors;
    }
    setAreaAssignments(newMap);
    validateCurrentState(selectedAreas, newMap);
  };

  // Add line to area
  const handleAddLine = (area: string, lineId: string) => {
    const line = productionLines.find(l => l.id === lineId);
    if (!line) return;

    setAreaAssignments(prev => {
      const areaData = prev.get(area);
      if (!areaData) return prev;

      // Check if line already exists (prevent duplicates)
      if (areaData.lines.some(l => l.lineId === lineId)) {
        return prev;
      }

      // Create NEW Map with NEW areaData object (immutable update)
      const newMap = new Map(prev);
      newMap.set(area, {
        ...areaData,
        lines: [
          ...areaData.lines,
          {
            lineId: line.id,
            lineName: line.name,
            cycleTime: 45,
            efficiency: 85,
            priority: 1,
            isNew: true,
          },
        ],
      });

      return newMap;
    });
  };

  // Remove line from area
  const handleRemoveLine = (area: string, lineId: string) => {
    setAreaAssignments(prev => {
      const newMap = new Map(prev);
      const areaData = newMap.get(area);
      if (!areaData) return newMap;

      areaData.lines = areaData.lines.filter(l => l.lineId !== lineId);
      return newMap;
    });
  };

  // Update line assignment
  const handleUpdateLine = (
    area: string,
    lineId: string,
    field: 'cycleTime' | 'efficiency' | 'priority',
    value: number
  ) => {
    setAreaAssignments(prev => {
      const newMap = new Map(prev);
      const areaData = newMap.get(area);
      if (!areaData) return newMap;

      const line = areaData.lines.find(l => l.lineId === lineId);
      if (!line) return newMap;

      line[field] = value;
      return newMap;
    });
  };

  // Validate form
  const validate = (): boolean => {
    // If routing was cleared, no validation needed (we're just deleting)
    if (routingCleared) {
      setErrors([]);
      return true;
    }

    const newErrors: string[] = [];

    if (selectedAreas.length === 0) {
      newErrors.push('At least one area is required for the routing');
    }

    selectedAreas.forEach(area => {
      const areaData = areaAssignments.get(area);
      if (!areaData || areaData.lines.length === 0) {
        newErrors.push(`Area "${area}" must have at least one line assigned`);
      }

      areaData?.lines.forEach(line => {
        if (line.cycleTime <= 0) {
          newErrors.push(`${line.lineName}: Cycle time must be greater than 0`);
        }
        if (line.efficiency <= 0 || line.efficiency > 100) {
          newErrors.push(`${line.lineName}: Efficiency must be between 1 and 100`);
        }
        if (line.priority < 1) {
          newErrors.push(`${line.lineName}: Priority must be at least 1`);
        }
      });
    });

    // DAG validation errors
    if (dagValidation && !dagValidation.isValid) {
      if (dagValidation.hasCycle) {
        newErrors.push(`Cycle detected in routing: ${dagValidation.cycleNodes?.join(' -> ')}`);
      }
      if (dagValidation.hasOrphans) {
        newErrors.push(`Unreachable areas detected: ${dagValidation.orphanNodes?.join(', ')}`);
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Save changes
  const handleSave = async () => {
    if (!validate()) return;

    try {
      // Get original compatibilities
      const originalCompats = compatibilities.filter(c => c.modelId === modelId);

      // Collect all current assignments
      const currentAssignments: LineAssignment[] = [];
      areaAssignments.forEach(areaData => {
        currentAssignments.push(...areaData.lines);
      });

      // Identify what to create, update, and delete
      const toCreate: LineAssignment[] = [];
      const toUpdate: { id: string; data: LineAssignment }[] = [];
      const currentIds = new Set<string>();

      currentAssignments.forEach(assignment => {
        if (assignment.compatibilityId) {
          currentIds.add(assignment.compatibilityId);
          const original = originalCompats.find(c => c.id === assignment.compatibilityId);
          if (
            original &&
            (original.cycleTime !== assignment.cycleTime ||
              original.efficiency !== assignment.efficiency ||
              original.priority !== assignment.priority)
          ) {
            toUpdate.push({ id: assignment.compatibilityId, data: assignment });
          }
        } else {
          toCreate.push(assignment);
        }
      });

      const toDelete = originalCompats.filter(c => !currentIds.has(c.id));

      // Execute compatibility operations
      for (const deleted of toDelete) {
        await deleteCompatibility(deleted.id, deleted.lineId);
      }

      for (const assignment of toCreate) {
        await createCompatibility({
          lineId: assignment.lineId,
          modelId: modelId,
          cycleTime: assignment.cycleTime,
          efficiency: assignment.efficiency,
          priority: assignment.priority,
        });
      }

      for (const { id, data } of toUpdate) {
        await updateCompatibility(id, {
          cycleTime: data.cycleTime,
          efficiency: data.efficiency,
          priority: data.priority,
        });
      }

      // Save or clear DAG routing configuration
      if (routingCleared) {
        // User cleared the routing - delete DAG data from database
        await clearRouting(modelId);
      } else if (selectedAreas.length > 0) {
        // Save the routing configuration
        const routingSteps: ModelAreaRoutingStepInput[] = selectedAreas.map((areaCode, index) => ({
          areaCode,
          sequence: index,
          predecessors: areaAssignments.get(areaCode)?.predecessors || [],
        }));
        await saveRoutingConfig(modelId, routingSteps);
      }

      // Reload data and close
      await loadRoutingData();
      onClose();
    } catch (error) {
      console.error('Failed to save routing:', error);
      setErrors(['Failed to save changes. Please try again.']);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handleClearRouting = () => {
    // Just clear local state - actual deletion happens on Save
    // This allows Cancel to rescue the user if they made a mistake
    setSelectedAreas([]);
    setAreaAssignments(new Map());
    setDagValidation(null);
    setRoutingCleared(true);
    setShowClearConfirm(false);
  };

  const isAnySaving = isSaving || isCompatibilitySaving;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Routing</h2>
            <p className="text-sm text-gray-500 mt-1">{modelName}</p>
            {/* Clear Routing Button */}
            {hasExistingRouting && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors"
                disabled={isAnySaving}
              >
                <XCircle className="w-3.5 h-3.5" />
                Clear Routing
              </button>
            )}
          </div>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Close"
            disabled={isAnySaving}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Clear Routing Confirmation Dialog */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Clear Routing for {modelName}?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                This will remove the process flow configuration (area sequence and dependencies).
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Line assignments will be preserved but will no longer be organized into a routing.
              </p>
              <p className="text-xs text-blue-600 mb-6">
                You can still click <strong>Cancel</strong> in the main modal to undo this action before saving.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={handleClearRouting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                >
                  Clear Routing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm font-medium text-red-900 mb-2">
                Please fix the following errors:
              </div>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Routing Cleared Warning */}
          {routingCleared && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                Routing will be cleared when you click Save. Click <strong>Cancel</strong> to keep the original routing.
              </span>
            </div>
          )}

          {/* DAG Validation Status */}
          {!routingCleared && dagValidation && selectedAreas.length > 0 && (
            <div className={`flex items-center gap-2 text-sm ${
              dagValidation.isValid ? 'text-green-600' : 'text-amber-600'
            }`}>
              {dagValidation.isValid ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valid routing DAG</span>
                  {dagValidation.startNodes.length > 1 && (
                    <span className="text-gray-500">
                      ({dagValidation.startNodes.length} start areas, {dagValidation.endNodes.length} end areas)
                    </span>
                  )}
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>
                    {dagValidation.hasCycle ? 'Cycle detected' : ''}
                    {dagValidation.hasCycle && dagValidation.hasOrphans ? ' & ' : ''}
                    {dagValidation.hasOrphans ? 'Unreachable areas' : ''}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Current Flow Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-700">Process Flow</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Areas in the routing. Color indicates type: <span className="text-green-600 font-medium">green = start</span>, <span className="text-purple-600 font-medium">purple = end</span>, <span className="text-blue-600 font-medium">blue = intermediate</span>.
            </p>

            {selectedAreas.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">
                No areas in routing. Add an area below to get started.
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap p-4 bg-gray-50 border border-gray-200 rounded-lg">
                {selectedAreas.map((areaCode, index) => {
                  const areaData = areaAssignments.get(areaCode);
                  const areaType = getAreaType(areaCode);
                  const isFirst = index === 0;
                  const isLast = index === selectedAreas.length - 1;

                  // Type-based border color
                  const borderColor = areaType === 'start' ? '#22c55e' :
                                      areaType === 'end' ? '#8b5cf6' :
                                      '#3b82f6';

                  return (
                    <div key={areaCode} className="flex items-center gap-2">
                      <div
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-white"
                        style={{
                          backgroundColor: areaData?.color || '#6b7280',
                          boxShadow: `0 0 0 2px ${borderColor}`,
                        }}
                      >
                        <button
                          onClick={() => handleMoveArea(index, index - 1)}
                          className={`p-0.5 rounded transition-colors ${isFirst ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'}`}
                          title="Move earlier"
                          disabled={isAnySaving || isFirst}
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>

                        <span className="px-1">{areaCode}</span>

                        {/* Predecessor count badge */}
                        {areaData && areaData.predecessors.length > 0 && (
                          <span className="bg-white/30 px-1 rounded text-[10px]" title={`Depends on: ${areaData.predecessors.join(', ')}`}>
                            {areaData.predecessors.length}
                          </span>
                        )}

                        <button
                          onClick={() => handleMoveArea(index, index + 1)}
                          className={`p-0.5 rounded transition-colors ${isLast ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'}`}
                          title="Move later"
                          disabled={isAnySaving || isLast}
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>

                        <button
                          onClick={() => handleRemoveArea(areaCode)}
                          className="hover:bg-white/20 rounded p-0.5 transition-colors ml-1"
                          title="Remove area"
                          disabled={isAnySaving}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {index < selectedAreas.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Area Section */}
          {availableAreas.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Available Areas</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {availableAreas.map(area => (
                  <button
                    key={area.code}
                    onClick={() => handleAddArea(area.code)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                    disabled={isAnySaving}
                  >
                    <Plus className="w-3 h-3" />
                    {area.code}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Line Assignments Section with Predecessor Selection */}
          {selectedAreas.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Line Assignments & Dependencies</h3>

              <div className="space-y-4">
                {selectedAreas.map((areaCode, areaIndex) => {
                  const areaData = areaAssignments.get(areaCode);
                  const availableLines = getAvailableLinesForArea(areaCode);
                  const areaType = getAreaType(areaCode);

                  // Available predecessors: all other areas except this one
                  const availablePredecessors = selectedAreas.filter(a => a !== areaCode);

                  return (
                    <div key={areaCode} className="border border-gray-200 rounded-lg">
                      {/* Area Header */}
                      <div
                        className="px-4 py-2 text-sm font-medium text-white rounded-t-lg flex items-center justify-between"
                        style={{ backgroundColor: areaData?.color || '#6b7280' }}
                      >
                        <span>{areaCode}</span>
                        <span className="text-xs opacity-75 capitalize">{areaType}</span>
                      </div>

                      {/* Predecessor Selection */}
                      {areaIndex > 0 && (
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <PredecessorSelector
                            areaCode={areaCode}
                            availablePredecessors={availablePredecessors}
                            selectedPredecessors={areaData?.predecessors || []}
                            onChange={(preds) => handleUpdatePredecessors(areaCode, preds)}
                            getAreaColor={getAreaColor}
                            disabled={isAnySaving}
                            wouldCreateCycle={wouldCreateCycle}
                          />
                        </div>
                      )}

                      {/* Lines */}
                      <div className="p-4 space-y-3">
                        {areaData?.lines.map(line => (
                          <div key={line.lineId} className="flex items-start gap-4 pb-3 border-b border-gray-100 last:border-0">
                            <div className="w-48 flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => handleRemoveLine(areaCode, line.lineId)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                                disabled={isAnySaving}
                              />
                              <span className="text-sm font-medium text-gray-900">
                                {line.lineName}
                              </span>
                            </div>

                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">
                                Cycle Time (sec)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={line.cycleTime}
                                onChange={(e) =>
                                  handleUpdateLine(areaCode, line.lineId, 'cycleTime', parseFloat(e.target.value) || 0)
                                }
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isAnySaving}
                              />
                            </div>

                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">
                                Efficiency (%)
                              </label>
                              <input
                                type="number"
                                step="1"
                                min="1"
                                max="100"
                                value={line.efficiency}
                                onChange={(e) =>
                                  handleUpdateLine(areaCode, line.lineId, 'efficiency', parseInt(e.target.value, 10) || 0)
                                }
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isAnySaving}
                              />
                            </div>

                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">
                                Priority
                              </label>
                              <input
                                type="number"
                                step="1"
                                min="1"
                                value={line.priority}
                                onChange={(e) =>
                                  handleUpdateLine(areaCode, line.lineId, 'priority', parseInt(e.target.value, 10) || 1)
                                }
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isAnySaving}
                              />
                            </div>

                            <button
                              onClick={() => handleRemoveLine(areaCode, line.lineId)}
                              className="mt-6 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove line"
                              disabled={isAnySaving}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}

                        {availableLines.length > 0 && (
                          <div className="pt-2">
                            <select
                              value=""
                              onChange={(e) => {
                                const selectedLineId = e.target.value;
                                if (selectedLineId) {
                                  handleAddLine(areaCode, selectedLineId);
                                }
                              }}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isAnySaving}
                            >
                              <option value="">+ Add line to {areaCode}...</option>
                              {availableLines.map(line => (
                                <option key={line.id} value={line.id}>
                                  {line.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {areaData?.lines.length === 0 && availableLines.length === 0 && (
                          <div className="text-sm text-gray-500 italic">
                            No lines available in this area
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="mb-1">
                Define the process flow by adding areas. For each area after the first, select which preceding areas must complete before it can start.
              </p>
              <p className="text-xs text-blue-600">
                Parallel processes: Select the same predecessors for multiple areas to indicate they can run in parallel.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            disabled={isAnySaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isAnySaving || (dagValidation !== null && !dagValidation.isValid)}
          >
            <Save className="w-4 h-4" />
            {isAnySaving ? 'Saving...' : 'Save Routing'}
          </button>
        </div>
      </div>
    </div>
  );
};

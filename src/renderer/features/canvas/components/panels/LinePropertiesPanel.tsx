// ============================================
// LINE PROPERTIES PANEL
// Panel lateral con propiedades de linea seleccionada
// Incluye edicion y eliminacion
// Phase 7.6: DEPRECATED - Use UnifiedPropertiesPanel instead
// This file is kept for backward compatibility only
// ============================================

import { X, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useCanvasObjectStore } from '../../store/useCanvasObjectStore';
import { LineForm } from '../forms/LineForm';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';
import { CompatibilityList } from '../../../compatibility/components/CompatibilityList';
import { AssignModelModal } from '../../../compatibility/components/AssignModelModal';

export const LinePropertiesPanel = () => {
  const { nodes, selectedNode, setSelectedNode, deleteNode } = useCanvasStore(
    (state) => ({
      nodes: state.nodes,
      selectedNode: state.selectedNode,
      setSelectedNode: state.setSelectedNode,
      deleteNode: state.deleteNode,
    })
  );

  // Phase 7.6: Get object data from useCanvasObjectStore (single source of truth)
  const objects = useCanvasObjectStore((state) => state.objects);
  const updateObject = useCanvasObjectStore((state) => state.updateObject);

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!selectedNode) return null;

  const node = nodes.find((n) => n.id === selectedNode);
  if (!node) return null;

  // Phase 7.6: Get object data from objects[] (single source of truth)
  const object = objects.find((o) => o.id === selectedNode);
  if (!object) return null;

  const processProperties = object.processProperties;
  // Build compatible data object from object + processProperties
  const data = {
    id: object.id,
    name: object.name,
    area: processProperties?.area ?? '',
    timeAvailableDaily: processProperties?.timeAvailableDaily ?? 72000,
    assignedModelsCount: object.compatibilitiesCount ?? 0,
  };

  const handleClose = () => {
    setSelectedNode(null);
    setIsEditing(false);
    setShowDeleteModal(false);
  };

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = async (formData: {
    name: string;
    area: string;
    timeAvailableDaily: number;
  }) => {
    setIsLoading(true);

    try {
      // Phase 7.6: Update via useCanvasObjectStore (single source of truth)
      await updateObject(data.id, {
        name: formData.name,
        processProperties: {
          area: formData.area,
          timeAvailableDaily: formData.timeAvailableDaily,
        },
      });

      setIsEditing(false);
    } catch (error) {
      console.error('Error updating line:', error);
      alert('Failed to update line. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await window.electronAPI.invoke('lines:delete', data.id);

      if (response.success) {
        deleteNode(data.id);
        setSelectedNode(null);
        setShowDeleteModal(false);
      } else {
        alert(`Error: ${response.error || 'Failed to delete line'}`);
      }
    } catch (error) {
      console.error('Error deleting line:', error);
      alert('Failed to delete line. Check console for details.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

  return (
    <>
      <div className="absolute top-0 right-0 w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-lg z-20 animate-slide-in flex flex-col" style={{ height: 'calc(100% - 60px)' }}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? 'Edit Line' : 'Line Properties'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isEditing ? (
            <LineForm
              initialData={{
                name: data.name,
                area: data.area,
                timeAvailableDaily: data.timeAvailableDaily,
              }}
              onSubmit={handleSave}
              onCancel={handleCancelEdit}
              submitLabel="Save Changes"
              isLoading={isLoading}
            />
          ) : (
            <>
              <ReadOnlyView data={data} onEdit={handleEditClick} onDelete={handleDeleteClick} />
              <CompatibilityList lineId={data.id} />
            </>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <ConfirmDeleteModal
          lineName={data.name}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          isDeleting={isDeleting}
        />
      )}

      <AssignModelModal />
    </>
  );
};

interface ReadOnlyViewProps {
  data: {
    name: string;
    area: string;
    timeAvailableDaily: number;
    assignedModelsCount?: number;
  };
  onEdit: () => void;
  onDelete: () => void;
}

const ReadOnlyView = ({ data, onEdit, onDelete }: ReadOnlyViewProps) => {
  const hoursAvailable = (data.timeAvailableDaily / 3600).toFixed(2);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</label>
        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-medium">{data.name}</p>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Area</label>
        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{data.area}</p>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Time Available
        </label>
        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
          {hoursAvailable} hours/day
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({data.timeAvailableDaily} seconds)</span>
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Assigned Models
        </label>
        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{data.assignedModelsCount || 0} models</p>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Status
        </label>
        <div className="mt-1 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-900 dark:text-gray-100">Active</span>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <button
          onClick={onEdit}
          className="w-full btn-primary py-2 flex items-center justify-center gap-2"
        >
          <Edit2 className="w-4 h-4" />
          Edit Line
        </button>
        <button
          onClick={onDelete}
          className="w-full btn bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 py-2 flex items-center justify-center gap-2 border border-red-200 dark:border-red-800"
        >
          <Trash2 className="w-4 h-4" />
          Delete Line
        </button>
      </div>
    </div>
  );
};

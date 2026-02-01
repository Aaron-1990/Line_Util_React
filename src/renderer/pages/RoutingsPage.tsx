// ============================================
// ROUTINGS PAGE
// Model routing management view
// Shows which areas each model passes through
// ============================================

import { useEffect, useState } from 'react';
import { AlertTriangle, Search, Pencil } from 'lucide-react';
import { useModelStore } from '@renderer/features/models';
import { useRoutingStore } from '@renderer/features/routings/store/useRoutingStore';
import { ProcessFlowBadges } from '@renderer/features/routings/components/ProcessFlowBadges';
import { EditRoutingModal } from '@renderer/features/routings/components/EditRoutingModal';

export const RoutingsPage = () => {
  const {
    isLoading: modelsLoading,
    searchQuery,
    familyFilter,
    getUniqueFamilies,
    setSearchQuery,
    setFamilyFilter,
    loadModels,
    getFilteredModels,
  } = useModelStore();

  const {
    isLoading: routingsLoading,
    loadData,
    getRoutingForModel,
    getAreaColors,
  } = useRoutingStore();

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [selectedModelName, setSelectedModelName] = useState<string>('');

  const families = getUniqueFamilies();
  const filteredModels = getFilteredModels();
  const areaColors = getAreaColors();

  // Load data on mount
  useEffect(() => {
    loadModels();
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = modelsLoading || routingsLoading;

  // Open edit modal
  const handleEditRouting = (modelId: string, modelName: string) => {
    setSelectedModelId(modelId);
    setSelectedModelName(modelName);
    setIsEditModalOpen(true);
  };

  // Close edit modal (data is reloaded in the modal's save handler)
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedModelId('');
    setSelectedModelName('');
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Model Routings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Process flow paths for each product model
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models, customers, programs..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Family Filter */}
        <div className="w-64">
          <select
            value={familyFilter || ''}
            onChange={(e) => setFamilyFilter(e.target.value || null)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
          >
            <option value="">All Families</option>
            {families.map((family: string) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500 dark:text-gray-400">Loading routings...</div>
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500 dark:text-gray-400">No models found.</div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 mx-6 my-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                {/* Header */}
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold w-64">
                      Model
                    </th>
                    <th className="py-3 px-4 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold w-48">
                      Family
                    </th>
                    <th className="py-3 px-4 text-left text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
                      Routing
                    </th>
                    <th className="py-3 px-4 text-right text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold w-32">
                      Actions
                    </th>
                  </tr>
                </thead>

                {/* Body */}
                <tbody>
                  {filteredModels.map((model) => {
                    const routing = getRoutingForModel(model.id, model.name);
                    const hasRouting = routing.areas.length > 0;

                    return (
                      <tr
                        key={model.id}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        {/* Model Name */}
                        <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100 font-medium">
                          {model.name}
                        </td>

                        {/* Family */}
                        <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                          {model.family}
                        </td>

                        {/* Routing */}
                        <td className="py-3 px-4">
                          {hasRouting ? (
                            <ProcessFlowBadges
                              areas={routing.areas}
                              areaColors={areaColors}
                            />
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
                              <AlertTriangle className="w-4 h-4" />
                              <span>No routing defined</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleEditRouting(model.id, model.name)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                            title="Edit routing"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit Routing Modal */}
      <EditRoutingModal
        isOpen={isEditModalOpen}
        modelId={selectedModelId}
        modelName={selectedModelName}
        onClose={handleCloseEditModal}
      />
    </div>
  );
};

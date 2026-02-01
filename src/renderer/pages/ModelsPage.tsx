// ============================================
// MODELS PAGE
// Model management view - Phase 6A+
// ============================================

import { useEffect } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { useModelStore } from '@renderer/features/models';
import { ModelTable, ModelForm, AddVolumeModal } from '@renderer/features/models';

export const ModelsPage = () => {
  const {
    isLoading,
    searchQuery,
    familyFilter,
    getUniqueFamilies,
    setSearchQuery,
    setFamilyFilter,
    openModelForm,
    loadModels,
  } = useModelStore();

  const families = getUniqueFamilies();

  // Load models on mount
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  return (
    <div className="h-full w-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900">Product Models</h1>
        <button
          onClick={() => openModelForm()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Model
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-6 py-4 bg-white border-b border-gray-200">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models, customers, programs..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Family Filter */}
        <div className="w-64">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={familyFilter || ''}
              onChange={(e) => setFamilyFilter(e.target.value || null)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
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
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading models...</div>
          </div>
        ) : (
          <div className="bg-white mx-6 my-4 rounded-lg border border-gray-200 shadow-sm">
            <ModelTable />
          </div>
        )}
      </div>

      {/* Modals */}
      <ModelForm />
      <AddVolumeModal />
    </div>
  );
};

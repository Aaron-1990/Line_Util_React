// ============================================
// SHAPE BROWSER MODAL
// Modal for exploring the full shape catalog
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

import { memo, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Star,
  Shapes,
  Cog,
  GitBranch,
  Sparkles,
  Upload,
  Square,
  Triangle,
  Circle,
  Diamond
} from 'lucide-react';
import { useShapeCatalogStore } from '../../store/useShapeCatalogStore';
import { useToolStore } from '../../store/useToolStore';
import { ShapeDefinition } from '@shared/types/shape-catalog';

interface ShapeBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Get icon component for a category
 */
function getCategoryIcon(iconName?: string) {
  switch (iconName) {
    case 'Shapes':
      return <Shapes className="w-4 h-4" />;
    case 'Cog':
      return <Cog className="w-4 h-4" />;
    case 'GitBranch':
      return <GitBranch className="w-4 h-4" />;
    case 'Sparkles':
      return <Sparkles className="w-4 h-4" />;
    default:
      return <Shapes className="w-4 h-4" />;
  }
}

/**
 * Get preview icon for primitive shape type
 */
function getPrimitivePreview(primitiveType?: string, size: number = 48) {
  const iconClass = `w-${size / 4} h-${size / 4} text-gray-400`;
  switch (primitiveType) {
    case 'rectangle':
      return <Square className={iconClass} style={{ width: size, height: size }} />;
    case 'triangle':
      return <Triangle className={iconClass} style={{ width: size, height: size }} />;
    case 'circle':
      return <Circle className={iconClass} style={{ width: size, height: size }} />;
    case 'diamond':
      return <Diamond className={iconClass} style={{ width: size, height: size }} />;
    default:
      return <Square className={iconClass} style={{ width: size, height: size }} />;
  }
}

/**
 * Render shape preview based on render type
 */
function ShapePreview({ shape, size = 64 }: { shape: ShapeDefinition; size?: number }) {
  if (shape.renderType === 'primitive') {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        {getPrimitivePreview(shape.primitiveType, size * 0.7)}
      </div>
    );
  }

  if (shape.renderType === 'svg' && shape.svgContent) {
    return (
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: shape.svgContent }}
      />
    );
  }

  if (shape.renderType === 'image' && shape.imageUrl) {
    return (
      <img
        src={shape.imageUrl}
        alt={shape.name}
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  // Fallback
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <Shapes className="w-8 h-8 text-gray-300" />
    </div>
  );
}

/**
 * Shape card component
 */
const ShapeCard = memo(({
  shape,
  onSelect,
  onToggleFavorite
}: {
  shape: ShapeDefinition;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) => {
  return (
    <div
      className="relative group bg-white dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
      onClick={onSelect}
    >
      {/* Favorite Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${
          shape.isFavorite
            ? 'text-yellow-500 hover:text-yellow-600'
            : 'text-gray-300 hover:text-yellow-400 opacity-0 group-hover:opacity-100'
        }`}
        title={shape.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star className={`w-4 h-4 ${shape.isFavorite ? 'fill-current' : ''}`} />
      </button>

      {/* Shape Preview */}
      <div className="flex items-center justify-center mb-2 bg-gray-50 dark:bg-gray-800 rounded-md p-2">
        <ShapePreview shape={shape} size={56} />
      </div>

      {/* Shape Name */}
      <div className="text-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate block">
          {shape.name}
        </span>
        {shape.usageCount > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Used {shape.usageCount}x
          </span>
        )}
      </div>
    </div>
  );
});

ShapeCard.displayName = 'ShapeCard';

/**
 * ShapeBrowserModal
 *
 * A modal for exploring the full shape catalog with:
 * - Category navigation (sidebar)
 * - Search functionality
 * - Favorites filter
 * - Grid of shape cards
 * - Click to select shape for placement
 */
export const ShapeBrowserModal = memo(({ isOpen, onClose }: ShapeBrowserModalProps) => {
  const { shapes, categories, toggleFavorite, getFavorites } = useShapeCatalogStore();
  const { setPlaceTool } = useToolStore();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Get favorites
  const favorites = useMemo(() => getFavorites(), [getFavorites, shapes]);

  // Filter shapes based on search, category, and favorites
  const filteredShapes = useMemo(() => {
    let result = shapes.filter((s) => s.isActive);

    // Filter by favorites
    if (showFavoritesOnly) {
      result = result.filter((s) => s.isFavorite);
    }

    // Filter by category
    if (selectedCategoryId) {
      result = result.filter((s) => s.categoryId === selectedCategoryId);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [shapes, showFavoritesOnly, selectedCategoryId, searchQuery]);

  // Group shapes by category for display
  const shapesByCategory = useMemo(() => {
    const grouped = new Map<string, ShapeDefinition[]>();

    for (const shape of filteredShapes) {
      const existing = grouped.get(shape.categoryId) || [];
      grouped.set(shape.categoryId, [...existing, shape]);
    }

    return grouped;
  }, [filteredShapes]);

  // Handle shape selection
  const handleSelectShape = useCallback(
    (shapeId: string) => {
      setPlaceTool(shapeId);
      onClose();
    },
    [setPlaceTool, onClose]
  );

  // Handle favorite toggle
  const handleToggleFavorite = useCallback(
    (shapeId: string) => {
      toggleFavorite(shapeId);
    },
    [toggleFavorite]
  );

  // Handle import SVG (placeholder)
  const handleImportSvg = useCallback(() => {
    // TODO: Implement SVG import
    console.log('Import SVG clicked - feature coming soon');
    alert('SVG Import feature coming soon!');
  }, []);

  // Reset filters when closing
  const handleClose = useCallback(() => {
    setSearchQuery('');
    setSelectedCategoryId(null);
    setShowFavoritesOnly(false);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  // Use portal to render at document root, avoiding z-index issues
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal Content */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Shape Catalog
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search shapes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Favorites Toggle */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              showFavoritesOnly
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            Favorites ({favorites.length})
          </button>

          {/* Import Button */}
          <button
            onClick={handleImportSvg}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import SVG
          </button>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Category Sidebar */}
          <div className="w-48 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 p-3 overflow-y-auto">
            {/* All Categories */}
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-1 ${
                selectedCategoryId === null && !showFavoritesOnly
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Shapes className="w-4 h-4" />
              All Shapes
            </button>

            {/* Category List */}
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              {categories
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map((category) => {
                  const categoryShapeCount = shapes.filter(
                    (s) => s.categoryId === category.id && s.isActive
                  ).length;

                  return (
                    <button
                      key={category.id}
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        setShowFavoritesOnly(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors mb-1 ${
                        selectedCategoryId === category.id
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {getCategoryIcon(category.icon)}
                        <span className="truncate">{category.name}</span>
                      </span>
                      <span className="text-xs text-gray-400">{categoryShapeCount}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Shapes Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredShapes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Shapes className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                  No shapes found
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : showFavoritesOnly
                    ? 'Mark shapes as favorites to see them here'
                    : 'No shapes available in this category'}
                </p>
              </div>
            ) : selectedCategoryId || searchQuery ? (
              // Single grid when filtering
              <div className="grid grid-cols-4 gap-3">
                {filteredShapes.map((shape) => (
                  <ShapeCard
                    key={shape.id}
                    shape={shape}
                    onSelect={() => handleSelectShape(shape.id)}
                    onToggleFavorite={() => handleToggleFavorite(shape.id)}
                  />
                ))}
              </div>
            ) : (
              // Grouped by category when showing all
              <div className="space-y-6">
                {Array.from(shapesByCategory.entries())
                  .sort(([a], [b]) => {
                    const catA = categories.find((c) => c.id === a);
                    const catB = categories.find((c) => c.id === b);
                    return (catA?.displayOrder ?? 99) - (catB?.displayOrder ?? 99);
                  })
                  .map(([categoryId, categoryShapes]) => {
                    const category = categories.find((c) => c.id === categoryId);
                    if (!category) return null;

                    return (
                      <div key={categoryId}>
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          {getCategoryIcon(category.icon)}
                          {category.name}
                          <span className="text-gray-400 font-normal">
                            ({categoryShapes.length})
                          </span>
                        </h3>
                        <div className="grid grid-cols-4 gap-3">
                          {categoryShapes.map((shape) => (
                            <ShapeCard
                              key={shape.id}
                              shape={shape}
                              onSelect={() => handleSelectShape(shape.id)}
                              onToggleFavorite={() => handleToggleFavorite(shape.id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredShapes.length} shape{filteredShapes.length !== 1 ? 's' : ''} available
          </div>
          <div className="text-xs text-gray-400">
            Click a shape to start placing it on the canvas
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});

ShapeBrowserModal.displayName = 'ShapeBrowserModal';

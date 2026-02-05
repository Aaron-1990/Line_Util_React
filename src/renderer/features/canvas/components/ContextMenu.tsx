// ============================================
// CONTEXT MENU
// Right-click menu for canvas objects
// Phase 7.5: Shape Catalog & Polymorphic Objects
// ============================================

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Trash2,
  Copy,
  Lock,
  Unlock,
  Settings,
  Cog,
  Box,
  ChevronRight,
  ArrowRightCircle,
  CircleOff,
  ShieldCheck,
  Edit2
} from 'lucide-react';
import { useCanvasObjectStore } from '../store/useCanvasObjectStore';
import { useCanvasStore } from '../store/useCanvasStore';
import { useToolStore } from '../store/useToolStore';
import { useNavigationStore } from '../../../store/useNavigationStore';
import { CanvasObjectType } from '@shared/types';

// Default shape for converting production lines to canvas objects
const DEFAULT_SHAPE_ID = 'rect-basic';

interface ContextMenuProps {
  x: number;
  y: number;
  objectId: string;
  onClose: () => void;
}

// Timing constants for submenu behavior
const SUBMENU_OPEN_DELAY = 100; // Delay before opening on hover (ms)
const SUBMENU_CLOSE_DELAY = 300; // Delay before closing when leaving (ms)

/**
 * ContextMenu
 *
 * Right-click context menu for canvas objects with:
 * - Convert to... submenu (with safe triangle pattern)
 * - Duplicate
 * - Delete
 * - Lock/Unlock
 * - Properties
 *
 * Submenu UX Pattern:
 * - Hover over "Convert to..." opens submenu after short delay
 * - Click on "Convert to..." toggles submenu immediately
 * - Submenu stays open while cursor is on trigger OR submenu
 * - Extended invisible zone creates "safe path" for mouse movement
 * - Longer close delay allows natural mouse movement patterns
 */
export const ContextMenu = memo<ContextMenuProps>(({ x, y, objectId, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuContainerRef = useRef<HTMLDivElement>(null);
  const [showConvertSubmenu, setShowConvertSubmenu] = useState(false);
  const [submenuPinned, setSubmenuPinned] = useState(false); // Clicked open vs hover open

  // Refs for timeout management
  const openTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if cursor is in the "safe zone" (trigger or submenu area)
  const isInSafeZoneRef = useRef(false);

  const {
    getObjectById,
    convertType,
    convertFromLine,
    duplicateObject,
    deleteObject,
    updateObject
  } = useCanvasObjectStore();

  const { nodes, setSelectedNode, deleteNode, addNode, updateNode } = useCanvasStore();
  const setSelectedObjects = useToolStore((state) => state.setSelectedObjects);
  const currentPlantId = useNavigationStore((state) => state.currentPlantId);

  // Clear all pending timeouts
  const clearAllTimeouts = useCallback(() => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  // Handle entering the submenu trigger area
  const handleTriggerEnter = useCallback(() => {
    isInSafeZoneRef.current = true;

    // Cancel any pending close
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    // Open with slight delay (prevents accidental opens when passing over)
    if (!showConvertSubmenu && !submenuPinned) {
      openTimeoutRef.current = setTimeout(() => {
        setShowConvertSubmenu(true);
      }, SUBMENU_OPEN_DELAY);
    }
  }, [showConvertSubmenu, submenuPinned]);

  // Handle leaving the submenu trigger area
  const handleTriggerLeave = useCallback(() => {
    isInSafeZoneRef.current = false;

    // Cancel any pending open
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }

    // Don't close if pinned by click
    if (submenuPinned) return;

    // Schedule close with delay (allows time to reach submenu)
    closeTimeoutRef.current = setTimeout(() => {
      if (!isInSafeZoneRef.current) {
        setShowConvertSubmenu(false);
      }
    }, SUBMENU_CLOSE_DELAY);
  }, [submenuPinned]);

  // Handle entering the submenu itself
  const handleSubmenuEnter = useCallback(() => {
    isInSafeZoneRef.current = true;

    // Cancel any pending close
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  // Handle leaving the submenu
  const handleSubmenuLeave = useCallback(() => {
    isInSafeZoneRef.current = false;

    // Don't close if pinned by click
    if (submenuPinned) return;

    // Schedule close with delay
    closeTimeoutRef.current = setTimeout(() => {
      if (!isInSafeZoneRef.current) {
        setShowConvertSubmenu(false);
      }
    }, SUBMENU_CLOSE_DELAY);
  }, [submenuPinned]);

  // Handle click on "Convert to..." trigger
  const handleTriggerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    clearAllTimeouts();

    if (showConvertSubmenu) {
      // Close and unpin
      setShowConvertSubmenu(false);
      setSubmenuPinned(false);
    } else {
      // Open and pin (click means intentional)
      setShowConvertSubmenu(true);
      setSubmenuPinned(true);
    }
  }, [showConvertSubmenu, clearAllTimeouts]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  // Try to get the object from canvas object store (for genericShape nodes)
  const canvasObject = getObjectById(objectId);

  // Try to get the node from canvas store (for productionLine nodes)
  const node = nodes.find((n) => n.id === objectId);
  const isProductionLine = node?.type === 'productionLine';

  // Close submenu when hovering over other menu items
  const handleOtherItemHover = useCallback(() => {
    clearAllTimeouts();
    isInSafeZoneRef.current = false;
    setShowConvertSubmenu(false);
    setSubmenuPinned(false);
  }, [clearAllTimeouts]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If submenu is open, close it first; otherwise close the whole menu
        if (showConvertSubmenu) {
          e.preventDefault();
          e.stopPropagation();
          clearAllTimeouts();
          setShowConvertSubmenu(false);
          setSubmenuPinned(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, showConvertSubmenu, clearAllTimeouts]);

  // Adjust menu position to stay in viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  // If neither canvas object nor production line found, don't render
  if (!canvasObject && !isProductionLine) {
    return null;
  }

  const handleConvertTo = async (newType: CanvasObjectType) => {
    if (isProductionLine) {
      // Convert production line to canvas object
      if (!currentPlantId) {
        console.error('[ContextMenu] No plant selected');
        onClose();
        return;
      }

      // Get the old node position before deleting
      const oldNode = nodes.find(n => n.id === objectId);
      const position = oldNode?.position ?? { x: 0, y: 0 };

      // convertFromLine now returns the full object with shape details
      const fullObject = await convertFromLine(objectId, newType, DEFAULT_SHAPE_ID, currentPlantId);
      if (fullObject) {
        // Remove the old production line node from canvas
        deleteNode(objectId);

        // Add the new genericShape node with complete data
        addNode({
          id: fullObject.id,
          type: 'genericShape',
          position,
          data: fullObject, // Already has CanvasObjectWithDetails including shape
        });

        // Select the newly created object so the properties panel shows
        setSelectedObjects([fullObject.id]);
      }
    } else {
      // Convert existing canvas object type
      await convertType(objectId, newType);

      // Get the updated object with new type from store (loadObjectsForPlant already ran)
      const updatedObject = getObjectById(objectId);
      if (updatedObject) {
        // Update the node data in place (don't delete/add to preserve selection)
        updateNode(objectId, updatedObject);
      }

      // Close menu first, then ensure selection is maintained after React re-renders
      onClose();

      // Re-select after a tick to ensure selection persists through any re-renders
      setTimeout(() => {
        setSelectedObjects([objectId]);
      }, 0);
      return; // Skip the onClose below since we already called it
    }
    onClose();
  };

  const handleDuplicate = async () => {
    if (isProductionLine) {
      // TODO: Duplicate production line
      console.log('[ContextMenu] Duplicate production line:', objectId);
      // For now, we don't have duplicate functionality for production lines
      // This would require duplicating the line in the database with a new ID
    } else {
      // Duplicate canvas object
      await duplicateObject(objectId);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (isProductionLine) {
      // Delete production line via IPC
      try {
        const response = await window.electronAPI.invoke('lines:delete', objectId);
        if (response.success) {
          deleteNode(objectId);
          setSelectedNode(null);
        } else {
          console.error('[ContextMenu] Failed to delete line:', response.error);
        }
      } catch (error) {
        console.error('[ContextMenu] Error deleting line:', error);
      }
    } else {
      // Delete canvas object
      await deleteObject(objectId);
    }
    onClose();
  };

  const handleToggleLock = async () => {
    if (isProductionLine) {
      // TODO: Lock production line
      console.log('[ContextMenu] Toggle lock for production line:', objectId);
      // For now, production lines don't have a locked field in the database
      // This would require adding a `locked` column to production_lines table
    } else if (canvasObject) {
      await updateObject(objectId, { locked: !canvasObject.locked });
    }
    onClose();
  };

  const handleProperties = () => {
    if (isProductionLine) {
      // Select the node to open LinePropertiesPanel
      setSelectedNode(objectId);
    } else {
      // TODO: Open properties panel for canvas objects
      console.log('Open properties for:', objectId);
    }
    onClose();
  };

  // Convert to submenu items (only for canvas objects, not production lines)
  const convertTypes: { label: string; icon: React.ReactNode; type: CanvasObjectType; disabled?: boolean }[] = [
    { label: 'Process', icon: <Cog className="w-4 h-4" />, type: 'process' },
    { label: 'Buffer', icon: <Box className="w-4 h-4" />, type: 'buffer' },
    { label: 'Source', icon: <ArrowRightCircle className="w-4 h-4" />, type: 'source', disabled: true },
    { label: 'Sink', icon: <CircleOff className="w-4 h-4" />, type: 'sink', disabled: true },
    { label: 'Quality Gate', icon: <ShieldCheck className="w-4 h-4" />, type: 'quality_gate', disabled: true },
  ];

  // Check if object is locked (for lock/unlock button)
  const isLocked = canvasObject?.locked || false;

  // Get appropriate label for properties button
  const propertiesLabel = isProductionLine ? 'Edit Line...' : 'Properties...';
  const propertiesIcon = isProductionLine ? <Edit2 className="w-4 h-4" /> : <Settings className="w-4 h-4" />;

  // Unified Context Menu for all node types
  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[180px] z-50"
      style={{ left: x, top: y }}
    >
      {/* Convert to... with submenu - Available for both production lines and canvas objects */}
      <div
        ref={submenuContainerRef}
        className="relative"
        onMouseEnter={handleTriggerEnter}
        onMouseLeave={handleTriggerLeave}
      >
        <button
          onClick={handleTriggerClick}
          className={`w-full px-3 py-2 text-left flex items-center gap-2 text-gray-700 dark:text-gray-300 ${
            showConvertSubmenu
              ? 'bg-gray-100 dark:bg-gray-700'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <span className="flex-1">Convert to...</span>
          <ChevronRight className={`w-4 h-4 transition-transform duration-150 ${showConvertSubmenu ? 'rotate-0' : ''}`} />
        </button>

        {/* Submenu with extended hover zone for safe mouse transitions */}
        {showConvertSubmenu && (
          <div
            className="absolute left-full top-0"
            style={{
              // Extended invisible hover zone creates "safe path" from trigger to submenu
              // This is the "safe triangle" pattern - a larger clickable area
              paddingLeft: '0px',
              marginLeft: '-8px', // Overlap with parent for seamless transition
              paddingTop: '0px',
              paddingBottom: '0px',
            }}
            onMouseEnter={handleSubmenuEnter}
            onMouseLeave={handleSubmenuLeave}
          >
            {/* Invisible bridge zone - helps mouse transition diagonally */}
            <div
              className="absolute"
              style={{
                left: '-20px',
                top: '-10px',
                width: '28px',
                height: 'calc(100% + 20px)',
                // Uncomment below to debug the safe zone:
                // backgroundColor: 'rgba(255, 0, 0, 0.1)',
              }}
              onMouseEnter={handleSubmenuEnter}
            />

            {/* Actual submenu content */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[150px] ml-2">
              {convertTypes.map((item) => {
                // For production lines, all types are available (no "Current" state)
                // For canvas objects, disable if already that type
                const isCurrent = !isProductionLine && canvasObject?.objectType === item.type;
                const isDisabled = item.disabled || isCurrent;

                return (
                  <button
                    key={item.type}
                    onClick={() => !isDisabled && handleConvertTo(item.type)}
                    disabled={isDisabled}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2 ${
                      isDisabled
                        ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {isCurrent && (
                      <span className="ml-auto text-xs text-gray-400">Current</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

      {/* Duplicate - Available for both types */}
      <button
        onClick={handleDuplicate}
        onMouseEnter={handleOtherItemHover}
        className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        disabled={isProductionLine} // TODO: Remove when duplicate is implemented for production lines
        title={isProductionLine ? 'Duplicate not yet available for production lines' : undefined}
      >
        <Copy className="w-4 h-4" />
        <span className={isProductionLine ? 'text-gray-400' : ''}>Duplicate</span>
        {!isProductionLine && <span className="ml-auto text-xs text-gray-400">⌘D</span>}
      </button>

      {/* Lock/Unlock - Available for both types */}
      <button
        onClick={handleToggleLock}
        onMouseEnter={handleOtherItemHover}
        className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        disabled={isProductionLine} // TODO: Remove when lock is implemented for production lines
        title={isProductionLine ? 'Lock not yet available for production lines' : undefined}
      >
        {isLocked ? (
          <>
            <Unlock className="w-4 h-4" />
            <span className={isProductionLine ? 'text-gray-400' : ''}>Unlock</span>
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            <span className={isProductionLine ? 'text-gray-400' : ''}>Lock</span>
          </>
        )}
      </button>

      {/* Divider */}
      <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

      {/* Properties - Available for both types with different labels */}
      <button
        onClick={handleProperties}
        onMouseEnter={handleOtherItemHover}
        className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
      >
        {propertiesIcon}
        <span>{propertiesLabel}</span>
      </button>

      {/* Divider */}
      <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

      {/* Delete - Available for both types */}
      <button
        onClick={handleDelete}
        onMouseEnter={handleOtherItemHover}
        className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
      >
        <Trash2 className="w-4 h-4" />
        <span>{isProductionLine ? 'Delete Line' : 'Delete'}</span>
        <span className="ml-auto text-xs text-red-400">⌫</span>
      </button>
    </div>
  );
});

ContextMenu.displayName = 'ContextMenu';

// ============================================
// CONNECTION CONTEXT MENU
// Right-click menu for canvas connections/edges
// Phase 7.5: Connect Tool
// ============================================

import { memo, useEffect, useRef } from 'react';
import {
  Trash2,
  Zap,
  Package,
  Info,
  Check,
} from 'lucide-react';
import { ConnectionType } from '@shared/types';

interface ConnectionContextMenuProps {
  x: number;
  y: number;
  edgeId: string;
  currentType: string;
  onClose: () => void;
  onTypeChange: (edgeId: string, newType: ConnectionType) => void;
  onDelete: (edgeId: string) => void;
}

// Connection type options with icons and colors
const connectionTypes = [
  {
    type: 'flow' as ConnectionType,
    label: 'Flow',
    description: 'Process flow direction',
    icon: Zap,
    color: 'text-blue-500',
  },
  {
    type: 'material' as ConnectionType,
    label: 'Material',
    description: 'Physical material movement',
    icon: Package,
    color: 'text-green-500',
  },
  {
    type: 'info' as ConnectionType,
    label: 'Info',
    description: 'Information/data flow',
    icon: Info,
    color: 'text-gray-500',
  },
];

/**
 * ConnectionContextMenu
 *
 * Right-click context menu for connections with:
 * - Change connection type (Flow, Material, Info)
 * - Delete connection
 */
export const ConnectionContextMenu = memo<ConnectionContextMenuProps>(({
  x,
  y,
  edgeId,
  currentType,
  onClose,
  onTypeChange,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

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

  const handleTypeClick = (type: ConnectionType) => {
    if (type !== currentType) {
      onTypeChange(edgeId, type);
    }
    onClose();
  };

  const handleDelete = () => {
    onDelete(edgeId);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[200px] z-50"
      style={{ left: x, top: y }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          Connection Type
        </span>
      </div>

      {/* Connection Type Options */}
      {connectionTypes.map((option) => {
        const Icon = option.icon;
        const isActive = currentType === option.type;

        return (
          <button
            key={option.type}
            onClick={() => handleTypeClick(option.type)}
            className={`w-full px-3 py-2 text-left flex items-center gap-3 ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/30'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Icon className={`w-4 h-4 ${option.color}`} />
            <div className="flex-1">
              <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                {option.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {option.description}
              </div>
            </div>
            {isActive && (
              <Check className="w-4 h-4 text-blue-500" />
            )}
          </button>
        );
      })}

      {/* Divider */}
      <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
      >
        <Trash2 className="w-4 h-4" />
        <span className="text-sm font-medium">Delete Connection</span>
        <span className="ml-auto text-xs text-red-400">⌫</span>
      </button>
    </div>
  );
});

ConnectionContextMenu.displayName = 'ConnectionContextMenu';

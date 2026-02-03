// ============================================
// SUBMENU COMPONENT
// Reusable submenu with safe triangle pattern
// Standard UX implementation for nested menus
// ============================================

import { memo, useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

// ============================================
// TIMING CONSTANTS
// ============================================

/** Delay before opening submenu on hover (prevents accidental opens) */
const SUBMENU_OPEN_DELAY = 100;

/** Delay before closing submenu when leaving (allows diagonal mouse movement) */
const SUBMENU_CLOSE_DELAY = 300;

// ============================================
// TYPES
// ============================================

export interface SubMenuItem<T = string> {
  /** Unique identifier for the item */
  id: T;
  /** Display label */
  label: string;
  /** Optional icon component */
  icon?: ReactNode;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Whether this is the currently selected/active item */
  isActive?: boolean;
  /** Optional description shown as secondary text */
  description?: string;
}

export interface SubMenuProps<T = string> {
  /** Label for the trigger button */
  triggerLabel: string;
  /** Optional icon for the trigger */
  triggerIcon?: ReactNode;
  /** Menu items to display in submenu */
  items: SubMenuItem<T>[];
  /** Callback when an item is selected */
  onSelect: (itemId: T) => void;
  /** Optional callback when submenu opens/closes */
  onOpenChange?: (isOpen: boolean) => void;
  /** Whether to close parent menu on selection (default: true) */
  closeOnSelect?: boolean;
  /** Position of submenu relative to trigger */
  position?: 'right' | 'left';
  /** Custom class for trigger button */
  triggerClassName?: string;
  /** Custom class for submenu container */
  submenuClassName?: string;
}

// ============================================
// COMPONENT
// ============================================

/**
 * SubMenu Component
 *
 * A reusable submenu with professional UX patterns:
 *
 * ## Features
 * - **Hover to open**: Opens after short delay (100ms) to prevent accidental triggers
 * - **Click to toggle**: Clicking pins the submenu open
 * - **Safe triangle pattern**: Invisible zone allows diagonal mouse movement
 * - **Smart close delay**: 300ms delay allows natural mouse movement
 * - **Pinned state**: Click-opened submenus stay open until explicitly closed
 *
 * ## Usage
 * ```tsx
 * <SubMenu
 *   triggerLabel="Convert to..."
 *   items={[
 *     { id: 'process', label: 'Process', icon: <Cog /> },
 *     { id: 'buffer', label: 'Buffer', icon: <Box /> },
 *   ]}
 *   onSelect={(id) => handleConvert(id)}
 * />
 * ```
 *
 * ## UX Pattern Documentation
 * - Open delay prevents accidental opens when mouse passes over trigger
 * - Close delay allows user to move diagonally from trigger to submenu
 * - Safe triangle (invisible bridge zone) catches diagonal mouse movements
 * - Pinned state differentiates intentional clicks from hover interactions
 * - Escape key closes submenu first, then parent menu
 */
function SubMenuInner<T = string>({
  triggerLabel,
  triggerIcon,
  items,
  onSelect,
  onOpenChange,
  closeOnSelect = true,
  position = 'right',
  triggerClassName = '',
  submenuClassName = '',
}: SubMenuProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  // Timeout refs for delayed open/close
  const openTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if cursor is in safe zone (trigger or submenu)
  const isInSafeZoneRef = useRef(false);

  // ============================================
  // TIMEOUT MANAGEMENT
  // ============================================

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

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimeouts();
  }, [clearAllTimeouts]);

  // Notify parent of open state changes
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /** Handle mouse entering trigger area */
  const handleTriggerEnter = useCallback(() => {
    isInSafeZoneRef.current = true;

    // Cancel pending close
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    // Open with delay (prevents accidental opens)
    if (!isOpen && !isPinned) {
      openTimeoutRef.current = setTimeout(() => {
        setIsOpen(true);
      }, SUBMENU_OPEN_DELAY);
    }
  }, [isOpen, isPinned]);

  /** Handle mouse leaving trigger area */
  const handleTriggerLeave = useCallback(() => {
    isInSafeZoneRef.current = false;

    // Cancel pending open
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }

    // Don't close if pinned
    if (isPinned) return;

    // Close with delay (allows reaching submenu)
    closeTimeoutRef.current = setTimeout(() => {
      if (!isInSafeZoneRef.current) {
        setIsOpen(false);
      }
    }, SUBMENU_CLOSE_DELAY);
  }, [isPinned]);

  /** Handle mouse entering submenu area */
  const handleSubmenuEnter = useCallback(() => {
    isInSafeZoneRef.current = true;

    // Cancel pending close
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  /** Handle mouse leaving submenu area */
  const handleSubmenuLeave = useCallback(() => {
    isInSafeZoneRef.current = false;

    // Don't close if pinned
    if (isPinned) return;

    // Close with delay
    closeTimeoutRef.current = setTimeout(() => {
      if (!isInSafeZoneRef.current) {
        setIsOpen(false);
      }
    }, SUBMENU_CLOSE_DELAY);
  }, [isPinned]);

  /** Handle click on trigger - toggles and pins */
  const handleTriggerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    clearAllTimeouts();

    if (isOpen) {
      setIsOpen(false);
      setIsPinned(false);
    } else {
      setIsOpen(true);
      setIsPinned(true);
    }
  }, [isOpen, clearAllTimeouts]);

  /** Handle item selection */
  const handleItemClick = useCallback((item: SubMenuItem<T>) => {
    if (item.disabled) return;

    onSelect(item.id);

    if (closeOnSelect) {
      clearAllTimeouts();
      setIsOpen(false);
      setIsPinned(false);
    }
  }, [onSelect, closeOnSelect, clearAllTimeouts]);

  /** Close submenu (for external control) */
  const close = useCallback(() => {
    clearAllTimeouts();
    isInSafeZoneRef.current = false;
    setIsOpen(false);
    setIsPinned(false);
  }, [clearAllTimeouts]);

  // ============================================
  // KEYBOARD HANDLING
  // ============================================

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, close]);

  // ============================================
  // RENDER
  // ============================================

  const isLeft = position === 'left';

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleTriggerEnter}
      onMouseLeave={handleTriggerLeave}
    >
      {/* Trigger Button */}
      <button
        onClick={handleTriggerClick}
        className={`w-full px-3 py-2 text-left flex items-center gap-2 text-gray-700 dark:text-gray-300 ${
          isOpen
            ? 'bg-gray-100 dark:bg-gray-700'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        } ${triggerClassName}`}
      >
        {triggerIcon}
        <span className="flex-1">{triggerLabel}</span>
        <ChevronRight
          className={`w-4 h-4 transition-transform duration-150 ${
            isLeft ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Submenu Container */}
      {isOpen && (
        <div
          className={`absolute top-0 ${isLeft ? 'right-full' : 'left-full'}`}
          style={{
            marginLeft: isLeft ? '8px' : '-8px',
            marginRight: isLeft ? '-8px' : '8px',
          }}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        >
          {/* Invisible Bridge Zone (Safe Triangle Pattern) */}
          <div
            className="absolute"
            style={{
              [isLeft ? 'right' : 'left']: '-20px',
              top: '-10px',
              width: '28px',
              height: 'calc(100% + 20px)',
              // Debug: uncomment to visualize
              // backgroundColor: 'rgba(255, 0, 0, 0.1)',
            }}
            onMouseEnter={handleSubmenuEnter}
          />

          {/* Submenu Content */}
          <div
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[150px] ${
              isLeft ? 'mr-2' : 'ml-2'
            } ${submenuClassName}`}
          >
            {items.map((item) => (
              <button
                key={String(item.id)}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                className={`w-full px-3 py-2 text-left flex items-center gap-2 ${
                  item.disabled
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {item.isActive && (
                  <span className="text-xs text-gray-400">Current</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Export with memo for performance
export const SubMenu = memo(SubMenuInner) as typeof SubMenuInner;

// ============================================
// HOOK: useSubMenuState
// For custom implementations that need the same logic
// ============================================

export interface UseSubMenuStateOptions {
  openDelay?: number;
  closeDelay?: number;
  onOpenChange?: (isOpen: boolean) => void;
}

export function useSubMenuState(options: UseSubMenuStateOptions = {}) {
  const {
    openDelay = SUBMENU_OPEN_DELAY,
    closeDelay = SUBMENU_CLOSE_DELAY,
    onOpenChange,
  } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const isInSafeZoneRef = useRef(false);
  const openTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    return () => clearAllTimeouts();
  }, [clearAllTimeouts]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const handleEnter = useCallback(() => {
    isInSafeZoneRef.current = true;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (!isOpen && !isPinned) {
      openTimeoutRef.current = setTimeout(() => {
        setIsOpen(true);
      }, openDelay);
    }
  }, [isOpen, isPinned, openDelay]);

  const handleLeave = useCallback(() => {
    isInSafeZoneRef.current = false;
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
    if (isPinned) return;
    closeTimeoutRef.current = setTimeout(() => {
      if (!isInSafeZoneRef.current) {
        setIsOpen(false);
      }
    }, closeDelay);
  }, [isPinned, closeDelay]);

  const handleClick = useCallback(() => {
    clearAllTimeouts();
    if (isOpen) {
      setIsOpen(false);
      setIsPinned(false);
    } else {
      setIsOpen(true);
      setIsPinned(true);
    }
  }, [isOpen, clearAllTimeouts]);

  const close = useCallback(() => {
    clearAllTimeouts();
    isInSafeZoneRef.current = false;
    setIsOpen(false);
    setIsPinned(false);
  }, [clearAllTimeouts]);

  return {
    isOpen,
    isPinned,
    isInSafeZoneRef,
    handleEnter,
    handleLeave,
    handleClick,
    close,
    clearAllTimeouts,
  };
}

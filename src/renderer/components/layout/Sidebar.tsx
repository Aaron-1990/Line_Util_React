// ============================================
// SIDEBAR COMPONENT
// Collapsible navigation sidebar
// Phase 7: Added plant selector
// ============================================

import { useEffect, useMemo, useState, useRef } from 'react';
import { LayoutGrid, Package, GitBranch, Building2, Settings, Menu, Factory, ChevronDown, Check, Plus, Globe } from 'lucide-react';
import { useNavigationStore, AppView } from '../../store/useNavigationStore';
import { usePlantStore } from '../../features/plants';

// ===== Types =====

interface NavItem {
  id: AppView;
  label: string;
  icon: typeof LayoutGrid;
  keyCode: string;
}

// ===== Constants =====

// Detect platform for keyboard shortcut display
const isMac = typeof window !== 'undefined' && window.navigator.platform.toLowerCase().includes('mac');
const MODIFIER_KEY = isMac ? '⌘' : 'Ctrl+';
const MODIFIER_TEXT = isMac ? 'Cmd' : 'Ctrl';

const NAV_ITEMS: NavItem[] = [
  {
    id: 'canvas',
    label: 'Canvas',
    icon: LayoutGrid,
    keyCode: '1',
  },
  {
    id: 'models',
    label: 'Models',
    icon: Package,
    keyCode: '2',
  },
  {
    id: 'routings',
    label: 'Routings',
    icon: GitBranch,
    keyCode: '3',
  },
  {
    id: 'areas',
    label: 'Areas',
    icon: Building2,
    keyCode: '4',
  },
  {
    id: 'plants',
    label: 'Plants',
    icon: Factory,
    keyCode: '5',
  },
  {
    id: 'global-analysis',
    label: 'Global',
    icon: Globe,
    keyCode: '6',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: Settings,
    keyCode: '7',
  },
];

// ===== Component =====

/**
 * Collapsible sidebar navigation component.
 * Supports keyboard shortcuts (Cmd/Ctrl + 1-6) for quick navigation.
 * Phase 7: Added plant selector dropdown
 */
export const Sidebar = () => {
  const { currentView, sidebarCollapsed, setView, toggleSidebar, currentPlantId, setCurrentPlant } = useNavigationStore();
  const { plants, getActivePlants, openForm: openPlantForm } = usePlantStore();
  const [plantDropdownOpen, setPlantDropdownOpen] = useState(false);
  const plantDropdownRef = useRef<HTMLDivElement>(null);

  // Get current plant for display
  const currentPlant = useMemo(() =>
    plants.find(p => p.id === currentPlantId),
    [plants, currentPlantId]
  );

  const activePlants = useMemo(() => getActivePlants(), [getActivePlants, plants]);

  // Memoize nav items with shortcuts for display
  const navItemsWithShortcuts = useMemo(() =>
    NAV_ITEMS.map(item => ({
      ...item,
      shortcut: `${MODIFIER_TEXT}+${item.keyCode}`,
      shortcutDisplay: `${MODIFIER_KEY}${item.keyCode}`,
    })),
    []
  );

  // Close plant dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plantDropdownRef.current && !plantDropdownRef.current.contains(e.target as Node)) {
        setPlantDropdownOpen(false);
      }
    };
    if (plantDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [plantDropdownOpen]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;

      if (!isCmdOrCtrl) return;

      const item = NAV_ITEMS.find(nav => nav.keyCode === event.key);
      if (item) {
        event.preventDefault();
        setView(item.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setView]);

  // Handle plant selection
  const handleSelectPlant = (plantId: string) => {
    setCurrentPlant(plantId);
    setPlantDropdownOpen(false);
  };

  // Handle add new plant
  const handleAddPlant = () => {
    setPlantDropdownOpen(false);
    openPlantForm();
    setView('plants');
  };

  return (
    <aside
      className={`
        sidebar
        h-full bg-gray-800 dark:bg-gray-900 text-gray-100 flex flex-col
        transition-all duration-300 ease-in-out border-r border-transparent dark:border-gray-800
        ${sidebarCollapsed ? 'w-12' : 'w-[200px]'}
      `}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Toggle Button */}
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2 rounded-md hover:bg-gray-700 transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Plant Selector */}
      <div className="p-2 border-b border-gray-700" ref={plantDropdownRef}>
        {sidebarCollapsed ? (
          // Collapsed: just show icon
          <button
            onClick={() => setPlantDropdownOpen(!plantDropdownOpen)}
            className="w-full flex items-center justify-center p-2 rounded-md hover:bg-gray-700 transition-colors relative"
            title={currentPlant ? `${currentPlant.name} (${currentPlant.code})` : 'Select plant'}
          >
            <Factory className="w-5 h-5" />
            {currentPlant?.color && (
              <div
                className="absolute bottom-1 right-1 w-2 h-2 rounded-full"
                style={{ backgroundColor: currentPlant.color }}
              />
            )}
          </button>
        ) : (
          // Expanded: show dropdown button
          <button
            onClick={() => setPlantDropdownOpen(!plantDropdownOpen)}
            className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-gray-700 transition-colors text-left"
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: currentPlant?.color || '#6B7280' }}
            />
            <div className="flex-1 min-w-0">
              {currentPlant ? (
                <>
                  <div className="text-sm font-medium truncate">{currentPlant.name}</div>
                  <div className="text-xs text-gray-400">{currentPlant.code}</div>
                </>
              ) : (
                <div className="text-sm text-gray-400">Select plant...</div>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${plantDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
        )}

        {/* Plant Dropdown */}
        {plantDropdownOpen && (
          <div className={`
            absolute mt-1 bg-gray-800 dark:bg-gray-850 border border-gray-700 rounded-lg shadow-xl z-50 py-1
            ${sidebarCollapsed ? 'left-12 w-48' : 'left-2 right-2 w-auto'}
          `}>
            <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
              Plants ({activePlants.length})
            </div>
            <div className="max-h-48 overflow-y-auto">
              {activePlants.map(plant => (
                <button
                  key={plant.id}
                  onClick={() => handleSelectPlant(plant.id)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                    hover:bg-gray-700 transition-colors
                    ${plant.id === currentPlantId ? 'bg-gray-700' : ''}
                  `}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: plant.color || '#6B7280' }}
                  />
                  <span className="flex-1 truncate">{plant.name}</span>
                  <span className="text-xs text-gray-500 font-mono">{plant.code}</span>
                  {plant.id === currentPlantId && (
                    <Check className="w-4 h-4 text-blue-400" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-gray-700 mt-1 pt-1">
              <button
                onClick={handleAddPlant}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Plant</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-2" role="menu">
        {navItemsWithShortcuts.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-md mb-1
                transition-colors group relative
                ${isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }
              `}
              title={sidebarCollapsed ? `${item.label} (${item.shortcut})` : undefined}
              aria-label={`${item.label} (${item.shortcut})`}
              aria-current={isActive ? 'page' : undefined}
              role="menuitem"
            >
              <Icon className="w-5 h-5 flex-shrink-0" />

              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left text-sm font-medium">
                    {item.label}
                  </span>
                  <span className="text-xs text-gray-400 group-hover:text-gray-300">
                    {item.shortcutDisplay}
                  </span>
                </>
              )}

              {/* Tooltip for collapsed state */}
              {sidebarCollapsed && (
                <div className="sidebar-tooltip">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {item.shortcutDisplay}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

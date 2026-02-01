// ============================================
// SIDEBAR COMPONENT
// Collapsible navigation sidebar
// ============================================

import { useEffect, useMemo } from 'react';
import { LayoutGrid, Package, GitBranch, Building2, Settings, Menu } from 'lucide-react';
import { useNavigationStore, AppView } from '../../store/useNavigationStore';

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
    id: 'preferences',
    label: 'Preferences',
    icon: Settings,
    keyCode: '5',
  },
];

// ===== Component =====

/**
 * Collapsible sidebar navigation component.
 * Supports keyboard shortcuts (Cmd/Ctrl + 1-4) for quick navigation.
 */
export const Sidebar = () => {
  const { currentView, sidebarCollapsed, setView, toggleSidebar } = useNavigationStore();

  // Memoize nav items with shortcuts for display
  const navItemsWithShortcuts = useMemo(() =>
    NAV_ITEMS.map(item => ({
      ...item,
      shortcut: `${MODIFIER_TEXT}+${item.keyCode}`,
      shortcutDisplay: `${MODIFIER_KEY}${item.keyCode}`,
    })),
    []
  );

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

  return (
    <aside
      className={`
        sidebar
        h-full bg-gray-800 text-gray-100 flex flex-col
        transition-all duration-300 ease-in-out
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

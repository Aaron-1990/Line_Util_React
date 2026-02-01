# Phase 6.0: Sidebar Foundation - Code Reference

Quick reference for key code patterns and usage examples.

---

## Navigation Store Usage

### Import
```typescript
import { useNavigationStore } from '../../store/useNavigationStore';
```

### Access State
```typescript
const { currentView, sidebarCollapsed } = useNavigationStore();
```

### Change View
```typescript
const { setView } = useNavigationStore();

setView('canvas');    // Navigate to canvas
setView('models');    // Navigate to models
setView('areas');     // Navigate to areas
setView('preferences'); // Navigate to preferences
```

### Toggle Sidebar
```typescript
const { toggleSidebar, setSidebarCollapsed } = useNavigationStore();

toggleSidebar();              // Toggle between collapsed/expanded
setSidebarCollapsed(true);    // Force collapse
setSidebarCollapsed(false);   // Force expand
```

---

## Adding New Views

### 1. Add View Type
```typescript
// src/renderer/store/useNavigationStore.ts
export type AppView = 'canvas' | 'models' | 'areas' | 'preferences' | 'newview';
```

### 2. Add Navigation Item
```typescript
// src/renderer/components/layout/Sidebar.tsx
const NAV_ITEMS: NavItem[] = [
  // ... existing items
  {
    id: 'newview',
    label: 'New View',
    icon: SomeIcon,
    shortcut: 'Cmd+5',
    keyCode: '5',
  },
];
```

### 3. Create Page Component
```typescript
// src/renderer/pages/NewViewPage.tsx
import { SomeIcon } from 'lucide-react';

export const NewViewPage = () => {
  return (
    <div className="h-full w-full p-6">
      <h1>New View</h1>
      {/* Your view content */}
    </div>
  );
};
```

### 4. Add to AppLayout
```typescript
// src/renderer/components/layout/AppLayout.tsx
import { NewViewPage } from '../../pages/NewViewPage';

const renderView = () => {
  switch (currentView) {
    // ... existing cases
    case 'newview':
      return <NewViewPage />;
    default:
      return <ProductionCanvas />;
  }
};
```

---

## Keyboard Shortcuts Pattern

### Add New Shortcut
```typescript
// In Sidebar.tsx or any component

useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    const isCmdOrCtrl = event.metaKey || event.ctrlKey;

    if (!isCmdOrCtrl) return;

    // Add your custom shortcut
    if (event.key === 'k') {
      event.preventDefault();
      // Your action here
      console.log('Cmd+K pressed');
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [/* dependencies */]);
```

---

## Styling Patterns

### Sidebar Item Active State
```typescript
className={`
  w-full flex items-center gap-3 px-3 py-2.5 rounded-md
  transition-colors
  ${isActive
    ? 'bg-blue-600 text-white'
    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
  }
`}
```

### Sidebar Responsive Width
```typescript
className={`
  sidebar
  h-full bg-gray-800 text-gray-100 flex flex-col
  transition-all duration-300 ease-in-out
  ${sidebarCollapsed ? 'w-12' : 'w-[200px]'}
`}
```

### Tooltip for Collapsed State
```typescript
{sidebarCollapsed && (
  <div className="sidebar-tooltip">
    <span className="font-medium">{item.label}</span>
    <span className="text-xs text-gray-400 ml-2">
      {item.shortcut.replace('Cmd', '⌘')}
    </span>
  </div>
)}
```

---

## Layout Structure

### Full App Layout
```typescript
<div className="h-screen w-screen flex overflow-hidden bg-gray-50">
  {/* Sidebar */}
  <Sidebar />

  {/* Main Content Area */}
  <main className="flex-1 flex flex-col overflow-hidden">
    {renderView()}
  </main>
</div>
```

### View Page Template
```typescript
export const SomeViewPage = () => {
  return (
    <div className="h-full w-full flex flex-col bg-gray-50">
      {/* Header (if needed) */}
      <header className="border-b bg-white p-4">
        <h1>View Title</h1>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Your content here */}
      </div>
    </div>
  );
};
```

---

## Icon Usage (lucide-react)

### Import Icons
```typescript
import {
  LayoutGrid,   // Canvas/Grid view
  Package,      // Models/Products
  Building2,    // Areas/Facilities
  Settings,     // Preferences
  Menu,         // Hamburger menu
  ChevronLeft,  // Collapse
  ChevronRight, // Expand
  Plus,         // Add
  Edit,         // Edit
  Trash2,       // Delete
  Save,         // Save
  X,            // Close
} from 'lucide-react';
```

### Render Icon
```typescript
<Icon className="w-5 h-5" />
<Icon className="w-5 h-5 text-blue-600" />
<Icon className="w-5 h-5 flex-shrink-0" />
```

---

## Color Palette Reference

### Sidebar Colors
```css
/* Background */
bg-gray-800      /* Sidebar background */
bg-gray-700      /* Hover state */
bg-gray-900      /* Tooltip background */

/* Text */
text-gray-100    /* Primary text */
text-gray-300    /* Secondary text */
text-gray-400    /* Tertiary text (shortcuts) */

/* Active/Highlight */
bg-blue-600      /* Active item background */
text-white       /* Active item text */

/* Borders */
border-gray-700  /* Sidebar borders */
```

### Placeholder Page Colors
```css
/* Models Page */
bg-blue-100      /* Icon background */
text-blue-600    /* Icon color */

/* Areas Page */
bg-green-100     /* Icon background */
text-green-600   /* Icon color */

/* Preferences Page */
bg-purple-100    /* Icon background */
text-purple-600  /* Icon color */
```

---

## Responsive Behavior

### Sidebar Breakpoints
```typescript
// Currently no responsive breakpoints (desktop app)
// Future: Could add breakpoints for different screen sizes

// Example for future tablet/mobile support:
const SIDEBAR_BREAKPOINT = 768; // px

const [windowWidth, setWindowWidth] = useState(window.innerWidth);

useEffect(() => {
  const handleResize = () => setWindowWidth(window.innerWidth);
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

// Auto-collapse on small screens
useEffect(() => {
  if (windowWidth < SIDEBAR_BREAKPOINT) {
    setSidebarCollapsed(true);
  }
}, [windowWidth]);
```

---

## Animation Timings

### CSS Transitions
```css
/* Sidebar width transition */
transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* Tooltip opacity */
transition: opacity 0.2s ease-in-out;

/* Button hover states */
transition-colors /* Uses default 150ms */
```

### JavaScript Delays
```typescript
// No artificial delays needed
// All transitions are CSS-based for performance
```

---

## Accessibility Patterns

### Focus Management
```typescript
// Auto-focus search input when opening search modal
useEffect(() => {
  if (isOpen && inputRef.current) {
    inputRef.current.focus();
  }
}, [isOpen]);
```

### Keyboard Navigation
```typescript
// Tab through items
<button
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  {/* Content */}
</button>
```

### ARIA Labels
```typescript
<button
  aria-label="Toggle sidebar"
  aria-expanded={!sidebarCollapsed}
  title="Toggle sidebar"
>
  <Menu />
</button>
```

---

## Testing Utilities

### Check Current View
```typescript
// In tests or DevTools console
const currentView = useNavigationStore.getState().currentView;
console.log('Current view:', currentView);
```

### Programmatically Navigate
```typescript
// From anywhere in the app
useNavigationStore.getState().setView('models');
```

### Check Sidebar State
```typescript
const isSidebarCollapsed = useNavigationStore.getState().sidebarCollapsed;
console.log('Sidebar collapsed:', isSidebarCollapsed);
```

---

## Common Issues & Solutions

### Issue: View doesn't update when clicking sidebar item
**Solution**: Ensure `currentView` is used in the switch statement
```typescript
// Bad - using hardcoded value
case 'canvas':
  return <ProductionCanvas />;

// Good - checking currentView state
const { currentView } = useNavigationStore();
switch (currentView) {
  case 'canvas':
    return <ProductionCanvas />;
}
```

### Issue: Sidebar doesn't collapse
**Solution**: Check that CSS transition is applied
```typescript
// Ensure this class is present on sidebar element
className="sidebar transition-all duration-300 ease-in-out"
```

### Issue: Keyboard shortcuts don't work
**Solution**: Check event listener is attached
```typescript
// Should be in useEffect
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Handler code
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [setView]); // Include dependencies
```

### Issue: Tooltips don't appear in collapsed state
**Solution**: Ensure conditional rendering is correct
```typescript
// Only show tooltip when collapsed
{sidebarCollapsed && (
  <div className="sidebar-tooltip">
    {item.label}
  </div>
)}
```

---

## Performance Optimization

### Memoize Navigation Items
```typescript
import { useMemo } from 'react';

const navItems = useMemo(() => NAV_ITEMS, []); // Static items don't need recompute
```

### Lazy Load Views
```typescript
import { lazy, Suspense } from 'react';

const ModelsPage = lazy(() => import('../../pages/ModelsPage'));

// In render:
<Suspense fallback={<div>Loading...</div>}>
  <ModelsPage />
</Suspense>
```

### Prevent Unnecessary Re-renders
```typescript
import { memo } from 'react';

export const Sidebar = memo(() => {
  // Component code
});
```

---

## File Paths Reference

All paths are absolute from project root:

```
/Users/aaronzapata/Developer/work/Line_Utilization_Desktop_App/

src/
├── renderer/
│   ├── components/
│   │   └── layout/
│   │       ├── Sidebar.tsx          # Sidebar component
│   │       ├── AppLayout.tsx        # Main layout wrapper
│   │       └── index.ts             # Barrel export
│   ├── pages/
│   │   ├── ModelsPage.tsx           # Models placeholder
│   │   ├── AreasPage.tsx            # Areas placeholder
│   │   └── PreferencesPage.tsx      # Preferences placeholder
│   ├── store/
│   │   └── useNavigationStore.ts    # Navigation state
│   ├── router/
│   │   └── index.tsx                # Router configuration
│   └── styles/
│       └── globals.css              # Global styles + sidebar CSS

docs/
└── phases/
    ├── phase-6.0-sidebar-foundation-summary.md
    ├── phase-6.0-testing-guide.md
    └── phase-6.0-code-reference.md  # This file
```

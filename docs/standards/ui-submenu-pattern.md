# SubMenu UX Pattern Standard

> **Version:** 1.0 | **Created:** 2026-02-02 | **Status:** Active

---

## Overview

This document defines the standard UX pattern for implementing nested submenus in the Line Optimizer application. All new submenu implementations should follow this pattern for consistency.

---

## The Problem with Naive Submenus

Simple hover-based submenus have common UX issues:

1. **Diagonal Mouse Movement**: User moves mouse diagonally from trigger to submenu, but crosses outside the hover area and submenu closes
2. **Accidental Opens**: User passes over trigger while moving to another item, causing unwanted submenu flash
3. **Accidental Closes**: Submenu closes too quickly when user's mouse briefly leaves the area
4. **No Click Support**: Some users prefer clicking to open menus

---

## Solution: Safe Triangle Pattern

### Core Concepts

```
┌──────────────┐
│ Trigger Item │ ───────┐
│              │   ▓▓▓▓▓│ ← Invisible bridge zone
└──────────────┘   ▓▓▓▓▓│
                   ▓▓▓▓▓├──────────────┐
                   ▓▓▓▓▓│  Submenu     │
                   ▓▓▓▓▓│  ├ Item 1    │
                   ▓▓▓▓▓│  ├ Item 2    │
                   ▓▓▓▓▓│  └ Item 3    │
                        └──────────────┘
```

The invisible bridge zone (▓) catches diagonal mouse movements, preventing premature submenu closure.

### Implementation Requirements

| Feature | Specification |
|---------|---------------|
| Open Delay | 100ms on hover (prevents accidental opens) |
| Close Delay | 300ms (allows time to reach submenu) |
| Click Behavior | Toggle + Pin (stays open until explicitly closed) |
| Safe Zone | 28px wide invisible bridge between trigger and submenu |
| Escape Key | Close submenu first, then parent menu |

---

## Using the Standard Component

### Basic Usage

```tsx
import { SubMenu, SubMenuItem } from '@/components/ui/SubMenu';

const items: SubMenuItem[] = [
  { id: 'process', label: 'Process', icon: <Cog className="w-4 h-4" /> },
  { id: 'buffer', label: 'Buffer', icon: <Box className="w-4 h-4" /> },
  { id: 'source', label: 'Source', disabled: true },
];

<SubMenu
  triggerLabel="Convert to..."
  items={items}
  onSelect={(id) => handleConvert(id)}
/>
```

### With Active State

```tsx
const items: SubMenuItem[] = [
  { id: 'process', label: 'Process', isActive: currentType === 'process' },
  { id: 'buffer', label: 'Buffer', isActive: currentType === 'buffer' },
];
```

### Left-Positioned Submenu

```tsx
<SubMenu
  triggerLabel="Options"
  items={items}
  onSelect={handleSelect}
  position="left"
/>
```

---

## Using the Hook for Custom Implementations

For cases where the standard component doesn't fit:

```tsx
import { useSubMenuState } from '@/components/ui/SubMenu';

function CustomMenu() {
  const {
    isOpen,
    isPinned,
    handleEnter,
    handleLeave,
    handleClick,
    close,
  } = useSubMenuState({
    openDelay: 100,
    closeDelay: 300,
    onOpenChange: (open) => console.log('Submenu:', open),
  });

  return (
    <div onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button onClick={handleClick}>
        Trigger
      </button>
      {isOpen && (
        <div onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
          {/* Submenu content */}
        </div>
      )}
    </div>
  );
}
```

---

## Timing Constants

```typescript
// Standard timing (don't change without UX review)
const SUBMENU_OPEN_DELAY = 100;  // ms - prevents accidental opens
const SUBMENU_CLOSE_DELAY = 300; // ms - allows diagonal movement
```

### Why These Values?

- **100ms open delay**: Fast enough to feel responsive, slow enough to prevent flash when mouse passes over
- **300ms close delay**: Matches natural mouse movement speed for diagonal paths up to ~200px

---

## State Management

### Three Key States

1. **Closed**: Default state, submenu not visible
2. **Open (Hover)**: Opened by hover, will close when mouse leaves
3. **Open (Pinned)**: Opened by click, stays open until explicitly closed

```
        hover enter          hover leave (after delay)
Closed ──────────────► Open (Hover) ──────────────► Closed
   │                        │
   │ click                  │ click
   ▼                        ▼
Open (Pinned) ◄─────────────┘
   │
   │ click or escape
   ▼
Closed
```

---

## Accessibility Considerations

1. **Keyboard Navigation**: Escape closes submenu
2. **Focus Management**: Keep focus visible when using keyboard
3. **ARIA Attributes**: Add `aria-expanded` and `aria-haspopup` for screen readers

```tsx
<button
  aria-expanded={isOpen}
  aria-haspopup="menu"
>
  Trigger
</button>
```

---

## Testing Checklist

When implementing or modifying submenus, verify:

- [ ] Hover opens submenu after ~100ms
- [ ] Moving mouse diagonally to submenu works smoothly
- [ ] Clicking trigger toggles submenu
- [ ] Clicking trigger pins submenu open (doesn't close on hover-out)
- [ ] Hovering other menu items closes submenu
- [ ] Escape key closes submenu (not parent menu)
- [ ] Second Escape closes parent menu
- [ ] No flicker when rapidly entering/leaving trigger

---

## File Locations

| File | Purpose |
|------|---------|
| `src/renderer/components/ui/SubMenu.tsx` | Reusable component + hook |
| `docs/standards/ui-submenu-pattern.md` | This documentation |
| `src/renderer/features/canvas/components/ContextMenu.tsx` | Reference implementation |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-02 | Initial standard based on ContextMenu implementation |

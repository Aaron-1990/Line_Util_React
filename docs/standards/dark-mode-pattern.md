# Dark Mode Pattern - BLOQUE 0: Contracts & Architecture

> **Framework:** Hibrido v2.0
> **Version:** 1.0
> **Date:** 2026-02-11
> **Status:** ✅ COMPLETED

---

## 1. Tailwind CSS Dark Mode System

### 1.1 Official Documentation

**Source:** [Tailwind CSS Dark Mode Docs](https://tailwindcss.com/docs/dark-mode)

Tailwind provides a `dark:` variant that allows styling elements differently when dark mode is active.

### 1.2 Configuration Method

**File:** `tailwind.config.js`

```javascript
module.exports = {
  darkMode: 'class', // ✅ CONFIRMED: Using class-based dark mode
  // ... rest of config
}
```

**How it works:**
- `darkMode: 'class'` means dark mode is triggered by adding `dark` class to `<html>` element
- Alternative: `darkMode: 'media'` (uses system `prefers-color-scheme` only)
- Our project uses **manual control** via class for user preference support

---

## 2. Theme System Architecture

### 2.1 Components Overview

```
Theme System (3-way toggle: light | dark | system)
├── useThemeStore.ts       → State management (Zustand + localStorage)
├── useApplyTheme.ts       → DOM manipulation (adds/removes 'dark' class)
└── ThemeSelector.tsx      → UI control (segmented button)
```

### 2.2 State Management

**File:** `src/renderer/store/useThemeStore.ts`

```typescript
export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system', // Default to system preference
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'line-optimizer-theme', // localStorage key
    }
  )
);
```

**Key features:**
- ✅ Persists to `localStorage`
- ✅ Supports 3 modes: `light`, `dark`, `system`
- ✅ Default: `system` (respects OS preference)

### 2.3 Theme Application Hook

**File:** `src/renderer/hooks/useApplyTheme.ts`

```typescript
export const useApplyTheme = () => {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');    // Triggers dark: variants
      } else {
        root.classList.remove('dark'); // Disables dark: variants
      }
    };

    // Handle 'system' theme
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    // Handle explicit 'light' or 'dark'
    applyTheme(theme === 'dark');
  }, [theme]);
};
```

**Key features:**
- ✅ Adds/removes `dark` class on `<html>` element
- ✅ Watches OS theme changes when mode is `system`
- ✅ Cleans up event listeners properly

### 2.4 UI Control

**File:** `src/renderer/components/ThemeSelector.tsx`

Segmented control with 3 options:
- 🌞 Light
- 🌙 Dark
- 🖥️ System

**Implementation:** Already has dark mode variants applied correctly.

---

## 3. Reference Implementation

### 3.1 Perfect Example

**File:** `src/renderer/features/plants/components/DeletePlantModal.tsx`

This modal demonstrates **PERFECT** dark mode implementation. Every style has both light and dark variants:

#### Example 1: Background Colors

```tsx
<div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl">
```

- Light: `bg-white` (pure white)
- Dark: `dark:bg-gray-900` (near black)

#### Example 2: Borders

```tsx
<div className="border-b border-gray-200 dark:border-gray-800">
```

- Light: `border-gray-200` (subtle light border)
- Dark: `dark:border-gray-800` (subtle dark border)

#### Example 3: Text Colors

```tsx
<h2 className="text-gray-900 dark:text-gray-100">
  Delete Plant
</h2>
```

- Light: `text-gray-900` (near black text)
- Dark: `dark:text-gray-100` (near white text)

#### Example 4: Icon Containers

```tsx
<div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
</div>
```

- Light: `bg-red-100` + `text-red-600`
- Dark: `dark:bg-red-900/30` + `dark:text-red-400`

#### Example 5: Alert/Info Boxes

```tsx
<div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
  <p className="text-sm text-amber-800 dark:text-amber-300">
    Warning: This plant has lines...
  </p>
</div>
```

- Background: `bg-amber-50` → `dark:bg-amber-900/20`
- Border: `border-amber-200` → `dark:border-amber-800`
- Text: `text-amber-800` → `dark:text-amber-300`

---

## 4. Standard Pattern to Apply

### 4.1 The Problem

**WRONG (current state in many files):**

```tsx
<div className="bg-white text-gray-900 border-gray-200">
  <h3>Title</h3>
  <p className="text-gray-500">Description</p>
</div>
```

❌ **Issue:** No dark mode variants → looks broken in dark mode

### 4.2 The Solution

**CORRECT (needed):**

```tsx
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700">
  <h3>Title</h3>
  <p className="text-gray-500 dark:text-gray-400">Description</p>
</div>
```

✅ **Every color/background/border** gets a `dark:` variant

---

## 5. Color Palette Reference

### 5.1 Standard Mappings

| Light Mode | Dark Mode | Usage | Example |
|------------|-----------|-------|---------|
| `bg-white` | `dark:bg-gray-800` | Cards, containers | Modal backgrounds |
| `bg-gray-50` | `dark:bg-gray-900/50` | Subtle backgrounds | Hover states |
| `bg-gray-100` | `dark:bg-gray-800/70` | Secondary backgrounds | Input backgrounds |
| `text-gray-900` | `dark:text-gray-100` | Primary text | Headings, body |
| `text-gray-700` | `dark:text-gray-300` | Secondary text | Labels |
| `text-gray-500` | `dark:text-gray-400` | Tertiary text | Descriptions |
| `border-gray-200` | `dark:border-gray-700` | Borders | Dividers, outlines |
| `border-gray-300` | `dark:border-gray-600` | Stronger borders | Input borders |

### 5.2 Semantic Colors (Info, Warning, Error, Success)

#### Blue (Info/Primary)

| Light Mode | Dark Mode | Usage |
|------------|-----------|-------|
| `bg-blue-50` | `dark:bg-blue-900/20` | Info box background |
| `bg-blue-100` | `dark:bg-blue-900/30` | Icon container |
| `text-blue-800` | `dark:text-blue-300` | Info text |
| `text-blue-600` | `dark:text-blue-400` | Info icons |
| `border-blue-200` | `dark:border-blue-800` | Info borders |

#### Red (Error/Danger)

| Light Mode | Dark Mode | Usage |
|------------|-----------|-------|
| `bg-red-50` | `dark:bg-red-900/20` | Error box background |
| `bg-red-100` | `dark:bg-red-900/30` | Icon container |
| `text-red-800` | `dark:text-red-300` | Error text |
| `text-red-600` | `dark:text-red-400` | Error icons |
| `border-red-200` | `dark:border-red-800` | Error borders |

#### Amber (Warning)

| Light Mode | Dark Mode | Usage |
|------------|-----------|-------|
| `bg-amber-50` | `dark:bg-amber-900/20` | Warning box background |
| `bg-amber-100` | `dark:bg-amber-900/30` | Icon container |
| `text-amber-800` | `dark:text-amber-300` | Warning text |
| `text-amber-600` | `dark:text-amber-400` | Warning icons |
| `border-amber-200` | `dark:border-amber-800` | Warning borders |

#### Green (Success)

| Light Mode | Dark Mode | Usage |
|------------|-----------|-------|
| `bg-green-50` | `dark:bg-green-900/20` | Success box background |
| `bg-green-100` | `dark:bg-green-900/30` | Icon container |
| `text-green-800` | `dark:text-green-300` | Success text |
| `text-green-600` | `dark:text-green-400` | Success icons |
| `border-green-200` | `dark:border-green-800` | Success borders |

---

## 6. Implementation Checklist

### 6.1 For Every Component

When reviewing/implementing dark mode:

- [ ] **Backgrounds:** Every `bg-*` has a `dark:bg-*` variant
- [ ] **Text:** Every `text-*` has a `dark:text-*` variant
- [ ] **Borders:** Every `border-*` has a `dark:border-*` variant
- [ ] **Icons:** Icon colors updated (usually same as text)
- [ ] **Shadows:** Consider if shadows need dark variants
- [ ] **Opacity:** Semi-transparent colors (`/20`, `/30`, `/50`) for dark mode

### 6.2 Common Patterns

#### Pattern 1: Modal/Dialog

```tsx
<div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl">
  <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
    <h2 className="text-gray-900 dark:text-gray-100">Title</h2>
  </div>
  <div className="px-6 py-4">
    <p className="text-gray-600 dark:text-gray-400">Content</p>
  </div>
</div>
```

#### Pattern 2: Button (Secondary)

```tsx
<button className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">
  Cancel
</button>
```

#### Pattern 3: Input Field

```tsx
<input
  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
/>
```

#### Pattern 4: Alert Box

```tsx
<div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
  <p className="text-sm text-blue-800 dark:text-blue-300">
    Info message here
  </p>
</div>
```

---

## 7. Testing Dark Mode

### 7.1 Manual Testing

1. **Toggle theme:** Use ThemeSelector to switch between Light/Dark/System
2. **Visual inspection:** Check all components in both themes
3. **Contrast check:** Ensure text is readable in both modes
4. **Borders visible:** Subtle borders should still be visible

### 7.2 System Theme Testing

1. Set theme to "System"
2. Change OS dark mode setting
3. Verify app updates automatically

---

## 8. Anti-Patterns (DO NOT DO)

### ❌ Anti-Pattern 1: Missing Dark Variants

```tsx
// WRONG
<div className="bg-white text-gray-900">
```

### ❌ Anti-Pattern 2: Inconsistent Contrast

```tsx
// WRONG - text-gray-100 on bg-white looks almost invisible in light mode
<div className="bg-white text-gray-100">
```

### ❌ Anti-Pattern 3: Hardcoded Colors

```tsx
// WRONG - inline styles bypass Tailwind's dark mode
<div style={{ backgroundColor: '#ffffff' }}>
```

### ❌ Anti-Pattern 4: Using Only Dark Variants

```tsx
// WRONG - needs light mode style too
<div className="dark:bg-gray-800">
```

---

## 9. Success Criteria (BLOQUE 0)

- [x] ✅ **Tailwind docs reviewed:** Official dark mode documentation read and understood
- [x] ✅ **Configuration verified:** `darkMode: 'class'` confirmed in `tailwind.config.js`
- [x] ✅ **Reference implementation studied:** `DeletePlantModal.tsx` analyzed as perfect example
- [x] ✅ **Theme system verified:**
  - `useThemeStore.ts` - Zustand store with localStorage persistence
  - `useApplyTheme.ts` - Hook that manages `dark` class on `<html>`
  - `ThemeSelector.tsx` - 3-way toggle UI (light/dark/system)
- [x] ✅ **Pattern documented:** Complete pattern guide created
- [x] ✅ **Color palette defined:** Standard mappings table for all common scenarios
- [x] ✅ **No framework violations:** All investigation followed standard APIs

---

## 10. Next Steps (Implementation Phases)

This document is the **CONTRACT** for dark mode implementation.

**BLOQUE 1+:** Apply this pattern to all components:
1. Identify files without dark mode variants (use Grep)
2. Apply pattern systematically (component by component)
3. Test each component in both themes
4. Run type-check after changes
5. NO WORKAROUNDS - follow this contract exactly

---

## Appendix: Reference Files

| File | Purpose |
|------|---------|
| `tailwind.config.js` | Tailwind configuration (`darkMode: 'class'`) |
| `src/renderer/store/useThemeStore.ts` | Theme state management |
| `src/renderer/hooks/useApplyTheme.ts` | DOM manipulation for theme |
| `src/renderer/components/ThemeSelector.tsx` | Theme toggle UI |
| `src/renderer/features/plants/components/DeletePlantModal.tsx` | Perfect reference implementation |

---

**END OF BLOQUE 0 - READY FOR IMPLEMENTATION**

# Usability 1: Import Excel Dialog Dark Mode Support

> **Specification for Orchestrator Execution**
> **Created:** 2026-02-10
> **Agent:** frontend-developer
> **Priority:** Medium
> **Complexity:** Low (Systematic Tailwind class updates)

---

## Metadata

- **Type:** UX Improvement / Bug Fix
- **Estimated Time:** 1-2 hours
- **Framework:** Híbrido v2.0
- **Orchestrator:** v5.0

---

## Context

The MultiSheetImportWizard and related Excel import components were built before the dark mode theme system was fully implemented. They contain **hard-coded Tailwind light mode classes** without corresponding `dark:` variants, causing poor visibility and UX in dark mode.

**Current State:**
- App has fully functional theme system (`useThemeStore`, `useApplyTheme`)
- Other dialogs (DeletePlantModal, etc.) properly implement dark mode
- Import wizard components ignore dark mode completely

**Impact:**
- Users in dark mode see bright white dialogs (eye strain)
- Poor professional appearance
- Inconsistent with rest of app

---

## BLOQUE 0: Contracts & Architecture

### Objective
Understand Tailwind dark mode system and establish pattern for consistent application.

### Investigation Steps

1. **Read Tailwind Dark Mode Documentation**
   - Official docs: https://tailwindcss.com/docs/dark-mode
   - Confirm `darkMode: 'class'` configuration in `tailwind.config.js`

2. **Study Reference Implementation**
   - File: `src/renderer/components/modals/DeletePlantModal.tsx`
   - Pattern: Every style has both light and dark variant
   - Example: `bg-white dark:bg-gray-800`

3. **Verify Theme System**
   - Store: `src/renderer/store/useThemeStore.ts` (Zustand + localStorage)
   - Hook: `src/renderer/hooks/useApplyTheme.ts` (adds/removes `dark` class on `<html>`)
   - Selector: `src/renderer/components/ui/ThemeSelector.tsx`

### Pattern to Apply

**WRONG (current state):**
```tsx
<div className="bg-white text-gray-900 border-gray-200">
```

**CORRECT (needed):**
```tsx
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700">
```

### Color Palette (Dark Mode Mappings)

| Light Mode | Dark Mode | Usage |
|------------|-----------|-------|
| `bg-white` | `dark:bg-gray-800` | Cards, containers |
| `bg-gray-50` | `dark:bg-gray-900/50` | Backgrounds, subtle fills |
| `bg-gray-100` | `dark:bg-gray-800/70` | Secondary backgrounds |
| `text-gray-900` | `dark:text-gray-100` | Primary text |
| `text-gray-500` | `dark:text-gray-400` | Secondary text |
| `border-gray-200` | `dark:border-gray-700` | Borders |
| `bg-blue-50` | `dark:bg-blue-900/20` | Info boxes |
| `text-blue-800` | `dark:text-blue-300` | Info text |
| `bg-red-50` | `dark:bg-red-900/20` | Error boxes |
| `text-red-800` | `dark:text-red-300` | Error text |
| `bg-amber-50` | `dark:bg-amber-900/20` | Warning boxes |
| `text-amber-800` | `dark:text-amber-300` | Warning text |
| `bg-green-50` | `dark:bg-green-900/20` | Success boxes |
| `text-green-800` | `dark:text-green-300` | Success text |

### Success Criteria
- [ ] Tailwind docs reviewed
- [ ] Reference implementation studied
- [ ] Pattern documented
- [ ] Color palette defined
- [ ] No framework violations

---

## BLOQUE 1: Fix MultiSheetImportWizard.tsx

### Objective
Update main wizard orchestrator component with dark mode support.

### File
`src/renderer/features/excel/components/MultiSheetImportWizard.tsx`

### Changes Required

**Line 231:** Main container
```tsx
// BEFORE
<div className="min-h-screen bg-gray-50 p-8">

// AFTER
<div className="min-h-screen bg-gray-50 dark:bg-gray-900/50 p-8">
```

**Lines 245-261:** Progress indicator circles
```tsx
// BEFORE
className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
  isComplete
    ? 'bg-primary-600 text-white'
    : isActive
    ? 'bg-primary-100 text-primary-600 ring-2 ring-primary-600'
    : 'bg-gray-200 text-gray-500'
}`}

// AFTER
className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
  isComplete
    ? 'bg-primary-600 text-white dark:bg-primary-500'
    : isActive
    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 ring-2 ring-primary-600 dark:ring-primary-500'
    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
}`}
```

**Line 292:** Content container
```tsx
// BEFORE
<div className="bg-white rounded-lg shadow-sm p-6">

// AFTER
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
```

**Line 278:** Error banner
```tsx
// BEFORE
<div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
  <p className="text-sm text-red-800">{error}</p>
</div>

// AFTER
<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
</div>
```

**Line 270:** Connector lines between steps
```tsx
// BEFORE
<div className="flex-1 h-0.5 bg-gray-300" />

// AFTER
<div className="flex-1 h-0.5 bg-gray-300 dark:bg-gray-700" />
```

**Line 257:** Step labels
```tsx
// BEFORE
<span className={`text-sm font-medium ${isComplete || isActive ? 'text-gray-900' : 'text-gray-500'}`}>

// AFTER
<span className={`text-sm font-medium ${
  isComplete || isActive
    ? 'text-gray-900 dark:text-gray-100'
    : 'text-gray-500 dark:text-gray-400'
}`}>
```

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] All backgrounds have dark variants
- [ ] All text colors have dark variants
- [ ] All borders have dark variants
- [ ] Progress indicators visible in dark mode
- [ ] Type-check passes

---

## BLOQUE 2: Fix FileSelector.tsx

### Objective
Update file picker and import mode selector with dark mode support.

### File
`src/renderer/features/excel/components/FileSelector.tsx`

### Changes Required

**Line 93:** File input container
```tsx
// BEFORE
<div className="bg-white border border-gray-200 rounded-lg p-4">

// AFTER
<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
```

**Lines 157-167:** Drop zone
```tsx
// BEFORE
<div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-gray-50">
  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
  <p className="text-sm text-gray-600 mb-2">
    Drag and drop your Excel file here, or click to browse
  </p>
  <p className="text-xs text-gray-500">
    Supports .xlsx and .xls files
  </p>
</div>

// AFTER
<div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center bg-gray-50 dark:bg-gray-900/30 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
  <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
    Drag and drop your Excel file here, or click to browse
  </p>
  <p className="text-xs text-gray-500 dark:text-gray-400">
    Supports .xlsx and .xls files
  </p>
</div>
```

**Line 206:** Info box
```tsx
// BEFORE
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
  <p className="text-sm text-blue-800">
    {/* content */}
  </p>
</div>

// AFTER
<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
  <p className="text-sm text-blue-800 dark:text-blue-300">
    {/* content */}
  </p>
</div>
```

**Line 142:** Import mode radio buttons
```tsx
// Add dark mode to radio button labels and descriptions
// Pattern: text-gray-900 → text-gray-900 dark:text-gray-100
// Pattern: text-gray-600 → text-gray-600 dark:text-gray-300
```

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] Drop zone visible in dark mode
- [ ] File input container styled
- [ ] Info boxes readable
- [ ] Radio buttons styled
- [ ] Type-check passes

---

## BLOQUE 3: Fix SheetSelector.tsx

### Objective
Update sheet selection UI with dark mode support.

### File
`src/renderer/features/excel/components/SheetSelector.tsx`

### Changes Required

**Line 107:** Header text
```tsx
// BEFORE
<h3 className="text-lg font-semibold text-gray-900 mb-2">
  Select Sheets to Import
</h3>

// AFTER
<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
  Select Sheets to Import
</h3>
```

**Line 117:** Blue notice box
```tsx
// BEFORE
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
  <p className="text-sm text-blue-800">{/* content */}</p>
</div>

// AFTER
<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
  <p className="text-sm text-blue-800 dark:text-blue-300">{/* content */}</p>
</div>
```

**Lines 141-148:** Sheet card styling
```tsx
// BEFORE
<div className={`border rounded-lg p-4 cursor-pointer transition-colors ${
  selected
    ? 'border-primary-500 bg-primary-50'
    : 'border-gray-200 bg-white hover:bg-gray-50'
}`}>

// AFTER
<div className={`border rounded-lg p-4 cursor-pointer transition-colors ${
  selected
    ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20'
    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
}`}>
```

**Line 207:** Summary section
```tsx
// BEFORE
<div className="bg-gray-50 rounded-lg p-4 mb-6">

// AFTER
<div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-6">
```

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] Sheet cards styled in dark mode
- [ ] Selected state visible
- [ ] Hover states working
- [ ] Summary section readable
- [ ] Type-check passes

---

## BLOQUE 4: Fix MultiSheetValidationDisplay.tsx

### Objective
Update validation results display with dark mode support.

### File
`src/renderer/features/excel/components/MultiSheetValidationDisplay.tsx`

### Changes Required

**Line 72:** Validation section borders
```tsx
// Add dark variants to all border-gray-200 instances
// Pattern: border-gray-200 → border-gray-200 dark:border-gray-700
```

**Lines 76, 170, 287:** Section headers
```tsx
// BEFORE
<h4 className="font-medium text-gray-900 mb-2">

// AFTER
<h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
```

**Line 371:** Info box
```tsx
// BEFORE
<div className="bg-gray-50 rounded-lg p-4">

// AFTER
<div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
```

**Success/Warning/Error badges:**
```tsx
// Pattern for success badges
bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300

// Pattern for warning badges
bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300

// Pattern for error badges
bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300
```

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] All validation sections readable
- [ ] Status badges visible
- [ ] Error messages clear
- [ ] Type-check passes

---

## BLOQUE 5: Fix MultiSheetProgressTracker.tsx (if exists)

### Objective
Update progress tracker with dark mode support.

### File
`src/renderer/features/excel/components/MultiSheetProgressTracker.tsx`

### Steps
1. Read file to identify all hard-coded light colors
2. Apply pattern systematically:
   - Backgrounds: add `dark:bg-*` variants
   - Text: add `dark:text-*` variants
   - Borders: add `dark:border-*` variants
   - Icons: add `dark:text-*` variants

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] Progress bar visible in dark mode
- [ ] Status text readable
- [ ] Type-check passes

---

## BLOQUE FINAL: Validation & Testing

### Objective
Verify all import wizard screens work correctly in both light and dark modes.

### Validation Steps

**1. Type Check**
```bash
npm run type-check
```
Expected: ✅ No errors

**2. Visual Regression Testing**

Start app:
```bash
npm start
```

**Test Procedure:**

**A. Light Mode Testing**
1. Set theme to Light (ThemeSelector in app)
2. Navigate to Excel Import: File > Import Excel Data
3. Verify all screens look correct:
   - ✅ FileSelector: Drop zone, file input, mode selector
   - ✅ SheetSelector: Sheet cards, selection state
   - ✅ ValidationDisplay: Error/warning/success states
   - ✅ ProgressTracker: Progress bars, status messages
   - ✅ Wizard: Step indicators, navigation

**B. Dark Mode Testing**
1. Set theme to Dark
2. Navigate to Excel Import
3. Verify all screens in dark mode:
   - ✅ No bright white backgrounds (eye strain test)
   - ✅ All text readable (sufficient contrast)
   - ✅ Borders visible (not invisible)
   - ✅ Icons visible
   - ✅ Interactive states work (hover, selected, disabled)
   - ✅ Error/warning/success colors distinct

**C. System Theme Testing**
1. Set theme to System
2. Toggle OS dark mode on/off
3. Verify app follows system preference

### Cross-Component Consistency Check

Compare import wizard styling with other dialogs:
```bash
# Reference: DeletePlantModal (already has dark mode)
code src/renderer/components/modals/DeletePlantModal.tsx
```

Verify same color palette used:
- ✅ `bg-gray-800` for dark cards (not `bg-gray-900`)
- ✅ `text-gray-100` for dark primary text
- ✅ `border-gray-700` for dark borders

### Success Criteria
- [ ] Type-check passes
- [ ] Light mode: no regressions
- [ ] Dark mode: all components visible and readable
- [ ] System theme: follows OS preference
- [ ] Consistent with rest of app
- [ ] No accessibility violations (WCAG AA contrast ratios)

---

## Edge Cases & Considerations

### 1. Hover States
```tsx
// Ensure hover states work in both modes
hover:bg-gray-100 dark:hover:bg-gray-700
```

### 2. Disabled States
```tsx
// Disabled elements should be visually distinct
disabled:opacity-50 disabled:cursor-not-allowed
```

### 3. Focus States (Accessibility)
```tsx
// Focus rings must be visible in both modes
focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400
```

### 4. Icon Colors
```tsx
// Icons inherit text color by default
// Ensure parent has proper dark mode text color
className="text-gray-400 dark:text-gray-500"
```

### 5. Shadows
```tsx
// Consider adjusting shadows for dark mode
shadow-sm dark:shadow-gray-900/50
```

---

## Rollback Plan

If issues arise:
1. Git revert to commit before changes
2. Identify problematic component
3. Fix specific component
4. Re-run validation

**Rollback command:**
```bash
git log --oneline -5  # Find commit before usability-1
git revert <commit-hash>
```

---

## Post-Implementation Checklist

- [ ] All 5 components updated
- [ ] Type-check passes
- [ ] Visual regression tested in both modes
- [ ] No accessibility violations
- [ ] Consistent with app theme palette
- [ ] Documentation updated (this spec)
- [ ] Git commit created with clear message
- [ ] Changes pushed to GitHub

---

## References

- **Tailwind Dark Mode Docs:** https://tailwindcss.com/docs/dark-mode
- **Reference Component:** `src/renderer/components/modals/DeletePlantModal.tsx`
- **Theme System:** `src/renderer/store/useThemeStore.ts`, `src/renderer/hooks/useApplyTheme.ts`
- **Color Palette:** Based on existing app patterns (gray-50 → gray-900/50, etc.)

---

## Implementation Command

```bash
# Execute with orchestrator v5.0
orchestrate docs/specs/usability-1-import-excel-dark-mode.md
```

---

**Expected Duration:** 1-2 hours
**Agent:** frontend-developer
**Priority:** Medium
**Blocking:** None

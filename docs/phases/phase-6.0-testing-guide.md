# Phase 6.0: Sidebar Foundation - Testing Guide

**Date**: 2026-01-31

---

## Quick Start Testing

### 1. Start the Application

```bash
npm start
```

Expected behavior:
- App launches without errors
- Sidebar appears on the left side (expanded by default)
- Canvas view is displayed by default (ProductionCanvas)

---

## Manual Testing Checklist

### Sidebar UI

#### Visual Appearance
- [ ] Sidebar is visible on the left side
- [ ] Sidebar background is dark gray (`bg-gray-800`)
- [ ] Four navigation items are visible: Canvas, Models, Areas, Preferences
- [ ] Icons are visible and properly aligned
- [ ] "Canvas" item is highlighted with blue background (active state)
- [ ] Toggle button (hamburger menu) is visible at the top

#### Sidebar Collapse/Expand
- [ ] Click toggle button to collapse sidebar
  - Sidebar animates smoothly to 48px width
  - Only icons are visible
  - Labels and shortcuts disappear
- [ ] Hover over icons in collapsed state
  - Tooltips appear with item name and shortcut
- [ ] Click toggle button again to expand
  - Sidebar animates smoothly to 200px width
  - Labels and shortcuts reappear

#### Transitions
- [ ] Sidebar width transition is smooth (300ms)
- [ ] No layout shift in main content area during transition
- [ ] No flickering or janky animations

### Navigation

#### View Switching
- [ ] Click "Canvas" in sidebar
  - ProductionCanvas is displayed
  - "Canvas" has blue highlight in sidebar
- [ ] Click "Models" in sidebar
  - Models placeholder page is displayed
  - "Models" has blue highlight in sidebar
  - Page shows Package icon with blue background
  - Text: "Models Management" and "Phase 6A" message
- [ ] Click "Areas" in sidebar
  - Areas placeholder page is displayed
  - "Areas" has blue highlight in sidebar
  - Page shows Building2 icon with green background
  - Text: "Area Catalog" and "Phase 6D" message
- [ ] Click "Preferences" in sidebar
  - Preferences placeholder page is displayed
  - "Preferences" has blue highlight in sidebar
  - Page shows Settings icon with purple background
  - Text: "Preferences" and "coming soon" message

### Keyboard Shortcuts

#### macOS
- [ ] Press `Cmd+1` → Navigate to Canvas
- [ ] Press `Cmd+2` → Navigate to Models
- [ ] Press `Cmd+3` → Navigate to Areas
- [ ] Press `Cmd+4` → Navigate to Preferences

#### Windows/Linux
- [ ] Press `Ctrl+1` → Navigate to Canvas
- [ ] Press `Ctrl+2` → Navigate to Models
- [ ] Press `Ctrl+3` → Navigate to Areas
- [ ] Press `Ctrl+4` → Navigate to Preferences

#### Shortcut Labels
- [ ] In expanded sidebar, shortcuts show as "⌘1" through "⌘4" (Mac) or "Cmd+1" (Windows/Linux)
- [ ] Shortcuts are visible in gray text on the right side
- [ ] Shortcuts become lighter on hover

### Canvas Integration

#### Canvas View Features (All Phase 5.6 features should still work)
- [ ] Canvas displays production line nodes
- [ ] Analysis Control Bar is visible at bottom
- [ ] Year Navigator appears when multi-year results available
- [ ] Timeline Status Badge appears in top-right when analysis completes
- [ ] Changeover toggle controls work
- [ ] Run Analysis button works
- [ ] Canvas drag and drop works
- [ ] Box selection works (left-click + drag)
- [ ] Pan works (middle-click or right-click + drag)
- [ ] CAD-style crosshair cursor on canvas

#### Canvas Layout
- [ ] Canvas occupies full height of main content area
- [ ] No sidebar overlap with canvas controls
- [ ] Toolbar, Analysis Control Bar, and Year Navigator positioned correctly
- [ ] ProductionCanvas reactivity works (window resize)

### Separate Windows (No Sidebar)

#### Timeline Window
- [ ] Run an analysis to generate results
- [ ] Click "Open Timeline" button
- [ ] Timeline window opens in separate Electron window
- [ ] Timeline window does NOT have sidebar
- [ ] Timeline window shows ConstraintTimeline component
- [ ] Close timeline window → no errors in main window

#### Excel Import
- [ ] Navigate to Excel import (if you have a way to trigger it)
- [ ] Import wizard does NOT have sidebar
- [ ] Import wizard flows work correctly
- [ ] After import, return to main app shows sidebar

### State Persistence

#### View State
- [ ] Switch to "Models" view
- [ ] Collapse sidebar
- [ ] Switch to "Canvas" view
- [ ] Sidebar remains collapsed
- [ ] Switch back to "Models" view
- [ ] Models page is displayed with collapsed sidebar

---

## Automated Testing

### TypeScript Compilation
```bash
npm run type-check
```

Expected: No TypeScript errors

### Build Test
```bash
npm run build
```

Expected: Clean build with no errors

---

## Edge Cases & Error Handling

### Rapid Clicks
- [ ] Click navigation items rapidly
  - No flashing or multiple renders
  - Active state updates correctly
  - No console errors

### Rapid Keyboard Shortcuts
- [ ] Press `Cmd+1`, `Cmd+2`, `Cmd+3`, `Cmd+4` rapidly
  - Views switch correctly
  - No stuck states
  - No console errors

### Sidebar Toggle During View Switch
- [ ] Click "Models" in sidebar
- [ ] Immediately toggle sidebar (before Models page renders)
  - Page renders correctly
  - Sidebar state is correct
  - No visual glitches

### Window Resize
- [ ] Resize main window to minimum size
  - Sidebar remains visible
  - Content area adjusts
  - No horizontal scroll
- [ ] Resize window to maximum size
  - Layout scales correctly
  - No weird spacing

---

## Performance Testing

### Initial Load
- [ ] Measure time from `npm start` to app display
- [ ] No slowdown compared to previous version
- [ ] No console warnings about performance

### View Switching
- [ ] Switch between views multiple times
- [ ] Each switch should be instantaneous (< 100ms)
- [ ] No memory leaks (check DevTools Memory)

### Sidebar Animation
- [ ] Toggle sidebar 10 times rapidly
- [ ] Animation remains smooth
- [ ] No janky frames
- [ ] CPU usage acceptable

---

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab through sidebar items
  - Focus states are visible
  - Focus order is logical (top to bottom)
  - Enter key activates focused item
- [ ] Escape key behavior (if applicable)

### Screen Reader (Optional)
- [ ] Enable VoiceOver (Mac) or NVDA (Windows)
- [ ] Navigation items are announced
- [ ] Active state is announced
- [ ] Toggle button purpose is clear

### Focus Management
- [ ] Click navigation item
- [ ] Focus moves to new view content (if applicable)
- [ ] Focus is not lost or trapped

---

## Browser DevTools Checks

### Console
- [ ] Open DevTools Console
- [ ] No errors on app load
- [ ] No errors when switching views
- [ ] No errors when toggling sidebar
- [ ] No warnings about React or performance

### React DevTools
- [ ] Install React DevTools extension
- [ ] Check component tree
  - `AppLayout` is root of main app
  - `Sidebar` renders correctly
  - `ProductionCanvas` or placeholder pages render correctly
- [ ] Check Zustand store (if extension available)
  - `useNavigationStore` state updates correctly

### Network Tab
- [ ] No unexpected network requests when switching views
- [ ] No failed requests

---

## Visual Regression Testing

### Take Screenshots
Capture screenshots of:
1. Sidebar expanded + Canvas view
2. Sidebar collapsed + Canvas view
3. Sidebar expanded + Models placeholder
4. Sidebar expanded + Areas placeholder
5. Sidebar expanded + Preferences placeholder

### Compare with Expected Design
- [ ] Sidebar width: 200px expanded, 48px collapsed
- [ ] Colors match design spec (gray-800 background, blue-600 active)
- [ ] Icons are correct size and aligned
- [ ] Typography matches design spec
- [ ] Spacing and padding are correct

---

## Cross-Platform Testing

### macOS
- [ ] All features work
- [ ] Cmd shortcuts work
- [ ] Tooltips show "⌘" symbol

### Windows
- [ ] All features work
- [ ] Ctrl shortcuts work
- [ ] Tooltips show "Cmd+" text (or adapt to "Ctrl+")

### Linux
- [ ] All features work
- [ ] Ctrl shortcuts work
- [ ] No rendering issues

---

## Integration Testing

### With Existing Features

#### Analysis Flow
1. [ ] Navigate to Canvas view
2. [ ] Import data (if needed)
3. [ ] Run analysis
4. [ ] Results appear correctly
5. [ ] Timeline window opens
6. [ ] Switch to Models view
7. [ ] Switch back to Canvas view
8. [ ] Results still visible
9. [ ] Year navigation still works

#### Changeover Matrix
1. [ ] Navigate to Canvas view
2. [ ] Click changeover button on a node
3. [ ] Changeover matrix modal opens
4. [ ] Make changes to matrix
5. [ ] Close modal
6. [ ] Switch to Areas view
7. [ ] Switch back to Canvas
8. [ ] Changes persisted correctly

---

## Regression Testing

### Verify Existing Features Still Work

#### Canvas Features
- [ ] Drag and drop nodes
- [ ] Box selection (left-click + drag)
- [ ] Pan canvas (middle/right-click + drag)
- [ ] Zoom controls
- [ ] Mini-map
- [ ] Line properties panel
- [ ] Canvas toolbar

#### Analysis Features
- [ ] Analysis Control Bar
- [ ] Year selection dropdowns
- [ ] Global changeover toggle
- [ ] Run Analysis button
- [ ] Status badge
- [ ] Results panel

#### Changeover Features
- [ ] Per-line changeover toggle
- [ ] Changeover matrix editor
- [ ] All ON / All OFF / Reset buttons
- [ ] Stacked bar visualization

---

## Known Issues / Limitations

Document any issues found during testing:

### Example Format
```
Issue: Sidebar tooltip doesn't appear immediately on collapsed state
Severity: Low
Steps to Reproduce:
1. Collapse sidebar
2. Hover over icon
Expected: Tooltip appears immediately
Actual: Tooltip appears after ~200ms delay
Notes: This is by design (CSS transition-opacity)
```

---

## Sign-Off

Once all tests pass, complete this checklist:

- [ ] All manual tests passed
- [ ] No console errors
- [ ] TypeScript compilation clean
- [ ] Performance acceptable
- [ ] No regressions in existing features
- [ ] Documentation updated
- [ ] Ready for commit

**Tested By**: _______________
**Date**: _______________
**Status**: ☐ Pass  ☐ Fail  ☐ Needs Revision

---

## Next Steps After Testing

1. If all tests pass:
   - Commit changes with Phase 6.0 message
   - Update CLAUDE.md with Phase 6.0 completion
   - Move to Phase 6A (Models CRUD)

2. If issues found:
   - Document issues in "Known Issues" section above
   - Fix critical issues before commit
   - Create tickets for non-critical issues

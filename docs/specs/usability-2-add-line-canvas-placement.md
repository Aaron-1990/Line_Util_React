# Usability 2: "Add Line Manually" - Use Canvas Placement Workflow

> **Specification for Orchestrator Execution**
> **Created:** 2026-02-10
> **Agent:** frontend-developer
> **Priority:** Medium
> **Complexity:** Low (Use existing Phase 7.5 infrastructure)

---

## Metadata

- **Type:** UX Improvement
- **Estimated Time:** 1-2 hours
- **Framework:** Híbrido v2.0
- **Orchestrator:** v5.0
- **Related Phase:** Phase 7.5 (Shape Catalog & Polymorphic Objects)

---

## Context

The "Add Line Manually" button currently opens a **modal form** (AddLineModal) that requires users to fill in line details (name, area, time available) before creating a production line. The system already has a modern **click-to-place canvas workflow** (Phase 7.5) where users can:

1. Select a shape from the palette
2. Click on the canvas to place it
3. Configure it via properties panel

**Current UX Problems:**
- Modal form interrupts canvas workflow
- User can't choose placement location
- Position is auto-calculated (avoiding overlap)
- Less intuitive than modern CAD-style click-to-place

**Desired UX (Phase 7.5 Pattern):**
- Button activates placement tool with production line shape pre-selected
- User clicks canvas at desired location
- Object appears with default properties
- Optional: Properties panel opens for quick configuration

---

## BLOQUE 0: Contracts & Architecture

### Objective
Understand existing Phase 7.5 click-to-place infrastructure and identify production line shape.

### Investigation Steps

1. **Study Phase 7.5 Implementation**
   - Doc: `docs/phases/phase-7.5-shape-catalog.md` (if exists)
   - File: `src/renderer/features/canvas/store/useToolStore.ts` (tool state)
   - File: `src/renderer/features/canvas/components/ProductionCanvas.tsx` (placement logic)

2. **Understand Tool System**
   ```typescript
   // Tool types
   type Tool =
     | { type: 'select' }
     | { type: 'pan' }
     | { type: 'connect' }
     | { type: 'place'; shapeId: string }

   // Activating placement
   setPlaceTool(shapeId: string) → { type: 'place', shapeId }

   // Canvas click handler
   onPaneClick → checks isPlaceTool() → creates object at click position
   ```

3. **Identify Production Line Shape**
   - Query: `SELECT * FROM shape_catalog WHERE name LIKE '%line%' OR name LIKE '%production%'`
   - Or use generic rectangle shape: `'rect-basic'`
   - Shape should have `render_type = 'rectangle'` for production line visualization

4. **Verify Current Button Locations**
   - `src/renderer/features/canvas/components/CanvasEmptyState.tsx` (line 67)
   - `src/renderer/features/canvas/components/toolbar/CanvasToolbar.tsx` (line 54-60)

### Current Flow (Modal - To Be Deprecated)

```typescript
// CanvasEmptyState.tsx (line 62-68)
<button onClick={() => setIsAddLineModalOpen(true)}>
  <Plus /> Add Line Manually
</button>

// Opens AddLineModal with LineForm
// User fills form → IPC call → Backend creates line → Frontend adds to canvas
```

### Desired Flow (Click-to-Place)

```typescript
// Option A: Pre-select production line shape
<button onClick={() => setPlaceTool('production-line-shape-id')}>
  <Plus /> Add Line Manually
</button>

// Option B: Open shape browser to category
<button onClick={() => openShapeBrowser({ category: 'machines', autoSelect: 'production-line' })}>
  <Plus /> Add Line Manually
</button>

// User clicks canvas → Object created at that location
```

### Key Files & Stores

| File | Purpose |
|------|---------|
| `useToolStore.ts` | Active tool state (select, pan, place, connect) |
| `useShapeCatalogStore.ts` | Shape definitions from database |
| `useCanvasObjectStore.ts` | Canvas object creation/deletion |
| `ProductionCanvas.tsx` | Main canvas with `onPaneClick` handler |
| `GhostPreview.tsx` | Visual cursor preview during placement |
| `ObjectPalette.tsx` | Tool/shape selector toolbar |

### Success Criteria
- [ ] Phase 7.5 click-to-place workflow understood
- [ ] Production line shape ID identified
- [ ] Tool store API verified (`setPlaceTool`)
- [ ] Existing buttons located
- [ ] No framework violations

---

## BLOQUE 1: Identify or Create Production Line Shape

### Objective
Find existing production line shape in catalog, or define default shape to use.

### Steps

1. **Query Shape Catalog**
```bash
# Via IPC or direct DB query
SELECT id, name, category, render_type FROM shape_catalog
WHERE name LIKE '%production%' OR name LIKE '%line%'
ORDER BY name;
```

2. **Fallback Options**

**Option A: Use Basic Rectangle**
- Shape ID: `'rect-basic'` (already exists in catalog)
- Dimensions: 200x100 (default from Phase 7.5)
- Render type: 'rectangle'
- Good for MVP

**Option B: Create Dedicated Production Line Shape** (if not exists)
```typescript
// Insert into shape_catalog
{
  id: 'production-line',
  name: 'Production Line',
  category: 'machines-equipment',
  render_type: 'rectangle',
  default_width: 200,
  default_height: 100,
  icon: 'Box', // Lucide icon name
  default_fill_color: '#3B82F6', // primary-500
  default_stroke_color: '#1E40AF', // primary-700
}
```

3. **Store Shape ID in Constant**
```typescript
// src/renderer/features/canvas/constants/shapes.ts (or similar)
export const PRODUCTION_LINE_SHAPE_ID = 'rect-basic'; // or 'production-line'
```

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] Production line shape ID determined
- [ ] Shape exists in catalog (or basic rect used)
- [ ] Constant exported for reuse
- [ ] Type-check passes

---

## BLOQUE 2: Update CanvasEmptyState.tsx

### Objective
Change "Add Line Manually" button in empty state to use click-to-place workflow.

### File
`src/renderer/features/canvas/components/CanvasEmptyState.tsx`

### Current Implementation (lines 62-68)
```tsx
<button
  onClick={() => setIsAddLineModalOpen(true)}
  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
>
  <Plus className="w-5 h-5" />
  Add Line Manually
</button>
```

### New Implementation
```tsx
import { useToolStore } from '@/features/canvas/store/useToolStore';
import { PRODUCTION_LINE_SHAPE_ID } from '@/features/canvas/constants/shapes';

// Inside component
const setPlaceTool = useToolStore((state) => state.setPlaceTool);

// Updated button
<button
  onClick={() => setPlaceTool(PRODUCTION_LINE_SHAPE_ID)}
  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
>
  <Plus className="w-5 h-5" />
  Add Line Manually
</button>
```

**Bonus: Add Visual Feedback**
```tsx
// Show tooltip or hint after clicking
<button
  onClick={() => {
    setPlaceTool(PRODUCTION_LINE_SHAPE_ID);
    // Optional: Show toast notification
    toast.info('Click on canvas to place production line');
  }}
  // ... className
>
```

### Changes Summary
1. Import `useToolStore` and shape constant
2. Get `setPlaceTool` from store
3. Change `onClick` from opening modal to activating placement tool
4. Optional: Add dark mode classes (already done in Issue #1)
5. Remove modal state if no longer needed

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] Button activates placement tool instead of modal
- [ ] Imports correct
- [ ] Type-check passes
- [ ] No unused variables

---

## BLOQUE 3: Update CanvasToolbar.tsx

### Objective
Change "Add Line Manually" button in toolbar to use click-to-place workflow.

### File
`src/renderer/features/canvas/components/toolbar/CanvasToolbar.tsx`

### Current Implementation (lines 54-60)
```tsx
<button
  onClick={() => setIsAddLineModalOpen(true)}
  className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
  title="Add Line Manually"
>
  <Plus className="w-5 h-5" />
</button>
```

### New Implementation
```tsx
import { useToolStore } from '@/features/canvas/store/useToolStore';
import { PRODUCTION_LINE_SHAPE_ID } from '@/features/canvas/constants/shapes';

// Inside component
const setPlaceTool = useToolStore((state) => state.setPlaceTool);

// Updated button
<button
  onClick={() => setPlaceTool(PRODUCTION_LINE_SHAPE_ID)}
  className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
  title="Add Line Manually - Click canvas to place"
>
  <Plus className="w-5 h-5" />
</button>
```

### Changes Summary
1. Import `useToolStore` and shape constant
2. Get `setPlaceTool` from store
3. Change `onClick` handler
4. Update tooltip to reflect new behavior
5. Optional: Add active state styling if tool is active

**Optional: Highlight Active State**
```tsx
const activeTool = useToolStore((state) => state.activeTool);
const isPlacing = activeTool.type === 'place' && activeTool.shapeId === PRODUCTION_LINE_SHAPE_ID;

<button
  onClick={() => setPlaceTool(PRODUCTION_LINE_SHAPE_ID)}
  className={`p-2 rounded-lg transition-colors ${
    isPlacing
      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
  }`}
  title="Add Line Manually - Click canvas to place"
>
  <Plus className="w-5 h-5" />
</button>
```

### Checkpoint
```bash
npm run type-check
```

### Success Criteria
- [ ] Toolbar button activates placement tool
- [ ] Tooltip updated
- [ ] Optional: Active state styling
- [ ] Type-check passes

---

## BLOQUE 4: Deprecate AddLineModal (Optional)

### Objective
Remove or deprecate old modal form since it's no longer used.

### File
`src/renderer/features/canvas/components/modals/AddLineModal.tsx`

### Options

**Option A: Delete File Completely**
- If no other code references it
- Cleaner codebase
- Remove from imports in parent components

**Option B: Keep for Legacy/Fallback**
- Add deprecation comment
- Keep file but unused
- May be useful for direct text input workflow later

**Recommendation:** Option A (delete) since Phase 7.5 click-to-place is superior UX.

### Steps

1. **Find All References**
```bash
# Search for AddLineModal imports
grep -r "AddLineModal" src/renderer/
```

2. **Remove Imports**
```typescript
// Remove from files that imported it
// - CanvasEmptyState.tsx
// - CanvasToolbar.tsx
// - Any other parent components
```

3. **Remove Modal State**
```typescript
// Remove state variables
// const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false);
```

4. **Delete File** (if Option A)
```bash
rm src/renderer/features/canvas/components/modals/AddLineModal.tsx
```

### Checkpoint
```bash
npm run type-check
grep -r "AddLineModal" src/renderer/  # Should return no results
```

### Success Criteria
- [ ] All references to AddLineModal removed
- [ ] No unused state variables
- [ ] File deleted (or marked deprecated)
- [ ] Type-check passes
- [ ] No import errors

---

## BLOQUE FINAL: Validation & Testing

### Objective
Verify click-to-place workflow works correctly for production line creation.

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

**A. Empty State Flow**
1. Open app (or create new project)
2. Ensure canvas is empty (no production lines)
3. Verify "Add Line Manually" button visible in empty state
4. Click "Add Line Manually"
5. **Expected:**
   - ✅ Cursor changes to placement mode
   - ✅ Ghost preview follows cursor (if GhostPreview enabled)
   - ✅ No modal opens
   - ✅ ObjectPalette shows selected shape (optional)
6. Click on canvas at desired location
7. **Expected:**
   - ✅ Production line object appears at click location
   - ✅ Object has default name (e.g., "New Rectangle" or "New Production Line")
   - ✅ Object is selected automatically
   - ✅ Properties panel opens (optional)
   - ✅ Tool returns to select mode
8. Edit name in properties panel
9. Save changes
10. **Expected:**
    - ✅ Name updates on canvas
    - ✅ Object saved to database

**B. Toolbar Flow**
1. Canvas has existing objects
2. Click "+" button in toolbar
3. **Expected:**
   - ✅ Placement mode activates
   - ✅ Ghost preview follows cursor
4. Click on canvas
5. **Expected:**
   - ✅ New production line created
   - ✅ Position calculated correctly
   - ✅ No overlap with existing objects (auto-spacing)

**C. Keyboard Shortcuts (if implemented)**
1. Press hotkey for "Add Line" (if exists)
2. Verify same behavior as button click

**D. Multi-Plant Support**
1. Create multiple plants
2. Switch between plants
3. Add line manually in each plant
4. **Expected:**
   - ✅ Line added to correct plant
   - ✅ plantId passed correctly to backend

**E. Cancel Placement**
1. Activate placement mode
2. Press Escape or click Select tool
3. **Expected:**
   - ✅ Placement mode cancelled
   - ✅ Returns to select mode
   - ✅ No object created

### Comparison with Old Modal Flow

**Old Flow (Modal):**
```
Click button → Modal opens → Fill form (name, area, time) → Submit → Line appears
```

**New Flow (Click-to-Place):**
```
Click button → Cursor changes → Click canvas → Line appears → Edit properties
```

**UX Improvements:**
- ✅ **Visual:** User sees where object will be placed
- ✅ **Spatial:** User controls exact position
- ✅ **Faster:** No form pre-fill required
- ✅ **Professional:** Matches CAD/design tools UX
- ✅ **Flexible:** Can place multiple lines quickly

### Edge Cases

**1. No Plant Selected**
- **Expected:** Placement disabled or uses default plant
- **Test:** Verify error message or auto-selection

**2. Canvas Zoom/Pan**
- **Expected:** Coordinates calculated correctly in all zoom levels
- **Test:** Place object at 50%, 100%, 200% zoom

**3. Rapid Clicks**
- **Expected:** Multiple objects created at different positions
- **OR:** Tool auto-switches to select after first placement
- **Test:** Click canvas multiple times quickly

**4. Click Outside Canvas**
- **Expected:** No object created
- **Test:** Click on toolbar, sidebar, or outside viewport

### Success Criteria
- [ ] Type-check passes
- [ ] Empty state button works
- [ ] Toolbar button works
- [ ] Placement mode activates correctly
- [ ] Objects created at click position
- [ ] Properties panel integration works
- [ ] Multi-plant support verified
- [ ] No regressions in existing canvas features
- [ ] Old modal completely removed (no dead code)

---

## Architecture Decisions

### Why Click-to-Place Over Modal?

1. **Visual Feedback:** User sees exactly where object will appear
2. **Spatial Control:** User chooses position (not auto-calculated)
3. **Modern UX:** Matches Adobe, Figma, AutoCAD, Lucidchart patterns
4. **Faster Workflow:** No form interruption, place → configure
5. **Consistent:** Aligns with Phase 7.5 polymorphic objects design
6. **Scalable:** Same workflow for all shape types (machines, sensors, etc.)

### Why Not Keep Both Options?

- **Cognitive Load:** Two ways to do same thing confuses users
- **Maintenance:** More code to maintain
- **UX Fragmentation:** Inconsistent experience
- **Recommendation:** Click-to-place is superior, deprecate modal

### Integration with Phase 7.5

This change **completes** the Phase 7.5 vision:
- ✅ All shapes use click-to-place workflow
- ✅ Production lines are no longer special case
- ✅ Unified object creation pattern
- ✅ Properties panel as configuration hub

---

## Rollback Plan

If issues arise:
1. Git revert to commit before changes
2. Restore AddLineModal functionality
3. Re-add modal state and handlers
4. Investigate click-to-place issues

**Rollback command:**
```bash
git log --oneline -5  # Find commit before usability-2
git revert <commit-hash>
```

---

## Post-Implementation Checklist

- [ ] Shape ID identified or created
- [ ] CanvasEmptyState.tsx updated
- [ ] CanvasToolbar.tsx updated
- [ ] AddLineModal deprecated/deleted
- [ ] Type-check passes
- [ ] Visual regression tested
- [ ] Multi-plant support verified
- [ ] No dead code remaining
- [ ] Documentation updated (this spec)
- [ ] Git commit created with clear message
- [ ] Changes pushed to GitHub

---

## Future Enhancements (Out of Scope)

- [ ] Hotkey for quick production line placement (e.g., "L" key)
- [ ] Template shapes (save configured line as template)
- [ ] Batch placement mode (place multiple lines before configuring)
- [ ] Smart positioning (auto-align to grid, snap to other objects)
- [ ] Copy/paste production lines

---

## References

- **Phase 7.5:** Shape Catalog & Polymorphic Objects
- **Tool Store:** `src/renderer/features/canvas/store/useToolStore.ts`
- **Canvas Logic:** `src/renderer/features/canvas/components/ProductionCanvas.tsx`
- **Object Palette:** `src/renderer/features/canvas/components/toolbar/ObjectPalette.tsx`
- **Ghost Preview:** `src/renderer/features/canvas/components/GhostPreview.tsx`

---

## Implementation Command

```bash
# Execute with orchestrator v5.0
orchestrate docs/specs/usability-2-add-line-canvas-placement.md
```

---

**Expected Duration:** 1-2 hours
**Agent:** frontend-developer
**Priority:** Medium
**Blocking:** None
**Depends On:** Phase 7.5 (already implemented)

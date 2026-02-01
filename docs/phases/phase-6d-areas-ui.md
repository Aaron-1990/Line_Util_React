# Phase 6D: Custom Areas UI

**Status**: Complete (Frontend Only - Backend Integration Pending)
**Date**: 2026-01-31
**Version**: 0.6.0-alpha

---

## Overview

Built the complete frontend UI for managing manufacturing areas in the catalog. Users can now create, edit, and delete custom manufacturing areas instead of being limited to hardcoded electronics areas.

---

## Implemented Components

### 1. Zustand Store: `useAreaStore.ts`

**Location**: `src/renderer/features/areas/store/useAreaStore.ts`

**Features**:
- CRUD operations for areas (create, update, delete)
- Modal state management (form, delete confirmation)
- Loading and error states
- Computed selector for sorted areas
- IPC integration with backend channels

**State Structure**:
```typescript
interface AreaState {
  areas: AreaCatalogItem[];
  isLoading: boolean;
  error: string | null;
  isFormOpen: boolean;
  editingArea: AreaCatalogItem | null;
  deleteConfirm: {
    isOpen: boolean;
    area: AreaCatalogItem | null;
    linesInUse: number;
  };
}
```

### 2. Area Form Modal: `AreaForm.tsx`

**Location**: `src/renderer/features/areas/components/AreaForm.tsx`

**Features**:
- Create and edit area metadata
- Code field (uppercase, underscores only, disabled when editing)
- Name field
- Color picker with 8 preset colors + custom hex input
- Visual color preview (24x24px rounded square)
- Real-time validation
- Duplicate code detection

**Color Presets**:
- Blue (#3B82F6)
- Green (#22C55E)
- Yellow (#EAB308)
- Orange (#F97316)
- Red (#EF4444)
- Purple (#A855F7)
- Pink (#EC4899)
- Teal (#14B8A6)

**Validation**:
- Code: Required, uppercase letters and underscores only
- Name: Required
- Color: Valid hex format (#XXXXXX)
- Duplicate check on code (create only)

### 3. Area List: `AreaList.tsx`

**Location**: `src/renderer/features/areas/components/AreaList.tsx`

**Features**:
- Card-style list items with hover effects
- Color swatch display (6x6 rounded square)
- Code shown in monospace font (bold)
- Name shown in gray text
- Edit and delete actions (appear on hover)
- Empty state message
- Loading skeleton

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│ [█] SMT           Surface Mount Technology    ✎  🗑 │
│ [█] ICT           In-Circuit Test             ✎  🗑 │
│ [█] WAVE          Wave Soldering              ✎  🗑 │
└─────────────────────────────────────────────────────┘
```

### 4. Delete Confirmation Modal: `DeleteConfirmModal.tsx`

**Location**: `src/renderer/features/areas/components/DeleteConfirmModal.tsx`

**Features**:
- Warning badge with AlertTriangle icon
- Shows line count if area is in use
- Amber warning banner when lines are affected
- Clear area information display
- Cancel and confirm actions

**Two Modes**:
1. **Not in use**: Simple confirmation
2. **In use**: Warning with line count

### 5. Areas Page: `AreasPage.tsx`

**Location**: `src/renderer/pages/AreasPage.tsx`

**Features**:
- Page header with description
- "Add Area" button in top-right
- Error banner (appears when errors occur)
- Scrollable content area
- Max-width container for readability
- Auto-loads areas on mount

---

## Design Specs

### Typography
- Page title: `text-2xl font-semibold`
- Description: `text-sm text-gray-600`
- Area code: `font-mono font-semibold text-gray-900`
- Area name: `text-gray-600`

### Colors
- Primary action: Blue 600 (`#3B82F6`)
- Destructive action: Red 600 (`#EF4444`)
- Warning: Amber 50/200/600
- Borders: Gray 200
- Hover: Blue 300 border

### Spacing
- Page padding: `px-6 py-4`
- List gap: `space-y-2`
- Card padding: `px-4 py-3`
- Modal padding: `p-6`

### Interactions
- Hover: Border color change + shadow
- Focus: 2px blue ring
- Action buttons: Opacity 0 → 100 on hover
- Loading: Disabled state with opacity 50%

---

## File Structure

```
src/renderer/features/areas/
├── components/
│   ├── AreaForm.tsx           # Create/edit modal
│   ├── AreaList.tsx           # List display
│   └── DeleteConfirmModal.tsx # Delete confirmation
├── store/
│   └── useAreaStore.ts        # Zustand state
└── index.ts                   # Barrel exports
```

---

## IPC Channels Used

```typescript
IPC_CHANNELS.CATALOG_AREAS_GET_ALL    // Load all areas
IPC_CHANNELS.CATALOG_AREAS_CREATE     // Create new area
IPC_CHANNELS.CATALOG_AREAS_UPDATE     // Update existing area
IPC_CHANNELS.CATALOG_AREAS_DELETE     // Delete area
```

---

## Accessibility Checklist

### Keyboard Navigation
- [x] Tab order is logical (header → list → actions)
- [x] Modal trap focus when open
- [x] Escape key closes modals
- [x] Form can be submitted with Enter key

### Screen Reader Support
- [x] Semantic HTML (buttons, forms, headings)
- [x] All buttons have clear labels
- [x] Form inputs have associated labels
- [x] Error messages are associated with fields
- [x] Color swatch has title attribute for tooltip

### Visual Design
- [x] Color is not the only indicator (text labels present)
- [x] Sufficient contrast ratios (4.5:1 for text)
- [x] Focus indicators visible
- [x] Hover states don't rely on color alone

### Form Accessibility
- [x] Required fields marked with asterisk
- [x] Error messages clear and specific
- [x] Labels properly associated (htmlFor/id)
- [x] Disabled states clearly indicated

---

## Performance Considerations

### Optimizations
1. **Computed Selectors**: Sorted areas memoized in store
2. **Minimal Re-renders**: Local state in forms prevents parent updates
3. **Conditional Rendering**: Modals only render when open
4. **Debounced Input**: Color hex input doesn't trigger on every keystroke

### Bundle Size
- Uses existing lucide-react icons (no new dependencies)
- Zustand already included in bundle
- Total additional code: ~15KB (unminified)

---

## Testing Notes

### Manual Test Cases

**Create Area**:
1. Click "Add Area"
2. Enter code: `BODY_SHOP`
3. Enter name: `Body Shop`
4. Select color preset (Blue)
5. Click "Create Area"
6. Verify area appears in list

**Edit Area**:
1. Hover over existing area
2. Click edit button
3. Modify name and color
4. Click "Update Area"
5. Verify changes applied

**Delete Area**:
1. Hover over area
2. Click delete button
3. Confirm deletion
4. Verify area removed from list

**Validation**:
1. Try creating area without code → Error shown
2. Try duplicate code → Error shown
3. Try invalid hex color → Error shown
4. Try lowercase code → Auto-converted to uppercase

### Edge Cases
- Empty state when no areas exist
- Loading state during API calls
- Error state when backend fails
- Long area names (wrapping behavior)
- Many areas (scroll behavior)

---

## Backend Integration Pending

### TODO: Backend Implementation Required

The following backend components need to be implemented:

1. **IPC Handlers** (`src/main/ipc/handlers/area-catalog.handler.ts`):
   - `CATALOG_AREAS_GET_ALL` → Get all areas from DB
   - `CATALOG_AREAS_CREATE` → Create new area
   - `CATALOG_AREAS_UPDATE` → Update existing area
   - `CATALOG_AREAS_DELETE` → Delete area (check line usage first)

2. **Repository** (`src/main/database/repositories/SQLiteAreaCatalogRepository.ts`):
   - CRUD methods for area_catalog table
   - `countLinesUsingArea(areaCode)` method
   - Sequence number auto-increment logic

3. **Database Migration** (if needed):
   - Verify `area_catalog` table exists
   - Add indexes if needed for performance

4. **Preload Registration**:
   - Register area catalog channels in `preload.ts`

### Notes for Backend Developer

- The `area_catalog` table should already exist (used in Phase 3.4 import)
- Delete should check `production_lines.area` for foreign key usage
- Return line count in delete error message for UI display
- Sequence should auto-increment (MAX + 1) on create

---

## Usage Example

```typescript
import { useAreaStore } from '@renderer/features/areas';

function MyComponent() {
  const { loadAreas, createArea, openForm } = useAreaStore();

  useEffect(() => {
    loadAreas();
  }, []);

  const handleCreate = () => {
    createArea({
      code: 'BODY_SHOP',
      name: 'Body Shop',
      color: '#3B82F6',
    });
  };

  // Or use the modal
  const handleOpenModal = () => {
    openForm(); // Opens create form
  };
}
```

---

## Next Steps

### Phase 6D Backend (Immediate)
1. Implement IPC handlers
2. Create repository methods
3. Register channels in preload
4. Test end-to-end flow

### Future Enhancements
1. Drag-and-drop reordering (sequence)
2. Duplicate area action
3. Export/import area catalog
4. Area usage statistics
5. Inline area creation from Line form

---

## Related Documentation

- Phase 6 Overview: `docs/phases/phase-6-data-management-crud.md`
- Models UI: `src/renderer/features/models/`
- IPC Channels: `src/shared/constants/index.ts`
- Database Schema: CLAUDE.md

---

## Files Modified

**New Files**:
- `src/renderer/features/areas/store/useAreaStore.ts`
- `src/renderer/features/areas/components/AreaForm.tsx`
- `src/renderer/features/areas/components/AreaList.tsx`
- `src/renderer/features/areas/components/DeleteConfirmModal.tsx`
- `src/renderer/features/areas/index.ts`
- `docs/phases/phase-6d-areas-ui.md`

**Modified Files**:
- `src/renderer/pages/AreasPage.tsx` (replaced placeholder with full implementation)

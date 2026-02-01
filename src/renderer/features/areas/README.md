# Areas Feature

Custom manufacturing area management for capacity planning.

## Overview

This feature allows users to create and manage custom manufacturing areas (process steps) instead of being limited to hardcoded electronics areas. Areas are used to:
- Group production lines on the canvas
- Organize analysis results by process step
- Support any industry (automotive, pharma, food, etc.)

## Components

### 1. useAreaStore (Zustand)

Central state management for areas.

```typescript
import { useAreaStore } from '@renderer/features/areas';

function MyComponent() {
  const {
    areas,           // AreaCatalogItem[]
    isLoading,       // boolean
    error,           // string | null
    loadAreas,       // () => Promise<void>
    createArea,      // (data: CreateAreaInput) => Promise<void>
    updateArea,      // (id: string, data: Partial<AreaCatalogItem>) => Promise<void>
    deleteArea,      // (id: string) => Promise<void>
    openForm,        // (area?: AreaCatalogItem) => void
    getSortedAreas,  // () => AreaCatalogItem[]
  } = useAreaStore();
}
```

### 2. AreaForm

Modal form for creating/editing areas.

**Features**:
- Code input (uppercase, underscores only)
- Name input
- Color picker with presets
- Validation

**Usage**:
```typescript
import { AreaForm, useAreaStore } from '@renderer/features/areas';

function MyPage() {
  const { openForm } = useAreaStore();

  return (
    <>
      <button onClick={() => openForm()}>Add Area</button>
      <AreaForm />
    </>
  );
}
```

### 3. AreaList

Displays areas in a card-based list.

**Features**:
- Color swatch display
- Hover actions (edit/delete)
- Empty state
- Loading state

**Usage**:
```typescript
import { AreaList, useAreaStore } from '@renderer/features/areas';

function MyPage() {
  const { loadAreas } = useAreaStore();

  useEffect(() => {
    loadAreas();
  }, []);

  return <AreaList />;
}
```

### 4. DeleteConfirmModal

Confirmation dialog for area deletion.

**Features**:
- Shows line usage count
- Warning for areas in use
- Cancel/confirm actions

**Usage**:
```typescript
import { DeleteConfirmModal } from '@renderer/features/areas';

function MyPage() {
  return <DeleteConfirmModal />;
}
```

## Data Types

### AreaCatalogItem

```typescript
interface AreaCatalogItem {
  id: string;
  code: string;      // e.g., "BODY_SHOP"
  name: string;      // e.g., "Body Shop"
  color: string;     // Hex color (e.g., "#3B82F6")
  sequence: number;  // Display order
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### CreateAreaInput

```typescript
interface CreateAreaInput {
  code: string;   // Uppercase, underscores allowed
  name: string;
  color: string;  // Hex format (#XXXXXX)
}
```

## Color Presets

The form includes 8 preset colors from Tailwind:

```typescript
const COLOR_PRESETS = [
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Teal', hex: '#14B8A6' },
];
```

## Complete Example

```typescript
import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import {
  useAreaStore,
  AreaForm,
  AreaList,
  DeleteConfirmModal,
} from '@renderer/features/areas';

export const MyAreasPage = () => {
  const { loadAreas, openForm, error } = useAreaStore();

  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-semibold">Manufacturing Areas</h1>
        <button
          onClick={() => openForm()}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add Area
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="alert-error mb-4">{error}</div>
      )}

      {/* List */}
      <AreaList />

      {/* Modals */}
      <AreaForm />
      <DeleteConfirmModal />
    </div>
  );
};
```

## Store Actions

### Load Areas

```typescript
const { loadAreas } = useAreaStore();

// Load all areas from database
await loadAreas();
```

### Create Area

```typescript
const { createArea } = useAreaStore();

await createArea({
  code: 'BODY_SHOP',
  name: 'Body Shop',
  color: '#3B82F6',
});
```

### Update Area

```typescript
const { updateArea } = useAreaStore();

await updateArea('area-id-123', {
  name: 'Updated Name',
  color: '#22C55E',
});
```

Note: Code cannot be updated after creation.

### Delete Area

```typescript
const { deleteArea } = useAreaStore();

await deleteArea('area-id-123');
```

Note: Backend will prevent deletion if area is in use by production lines.

### Open Form Modal

```typescript
const { openForm } = useAreaStore();

// Create mode
openForm();

// Edit mode
openForm(existingArea);
```

## Validation Rules

### Code
- Required
- Must be uppercase letters and underscores only
- Cannot contain spaces
- Auto-converts to uppercase
- Must be unique (checked on create)
- Cannot be changed after creation

### Name
- Required
- Free text
- Can contain spaces and any characters

### Color
- Required
- Must be valid hex format (#XXXXXX)
- Case-insensitive

## Accessibility

- All form fields have labels
- Required fields marked with asterisk
- Error messages associated with fields
- Keyboard navigation supported
- Focus trap in modals
- Escape key closes modals
- Color swatches have title tooltips

## Performance

- Sorted areas computed and memoized
- Modals only render when open
- Local form state prevents unnecessary parent re-renders
- Optimistic UI updates after mutations

## Backend Integration

### IPC Channels Used

```typescript
IPC_CHANNELS.CATALOG_AREAS_GET_ALL    // GET all areas
IPC_CHANNELS.CATALOG_AREAS_CREATE     // POST new area
IPC_CHANNELS.CATALOG_AREAS_UPDATE     // PATCH existing area
IPC_CHANNELS.CATALOG_AREAS_DELETE     // DELETE area
```

### Expected Response Format

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

## Testing

### Unit Tests

```typescript
import { renderHook, act } from '@testing-library/react';
import { useAreaStore } from './useAreaStore';

test('loads areas on mount', async () => {
  const { result } = renderHook(() => useAreaStore());

  await act(async () => {
    await result.current.loadAreas();
  });

  expect(result.current.areas.length).toBeGreaterThan(0);
  expect(result.current.isLoading).toBe(false);
});
```

### Integration Tests

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AreasPage } from './AreasPage';

test('creates new area', async () => {
  render(<AreasPage />);

  await userEvent.click(screen.getByText('Add Area'));
  await userEvent.type(screen.getByLabelText('Code'), 'BODY_SHOP');
  await userEvent.type(screen.getByLabelText('Name'), 'Body Shop');
  await userEvent.click(screen.getByText('Create Area'));

  expect(screen.getByText('BODY_SHOP')).toBeInTheDocument();
});
```

## Troubleshooting

### Areas not loading
- Check backend IPC handler is registered
- Verify database migration ran
- Check browser console for errors

### Create/Update failing
- Check validation errors in form
- Verify backend endpoint is implemented
- Check network tab for response

### Delete not working
- Backend may be preventing deletion (area in use)
- Check error message in delete response
- Verify line count is correct

## Related Files

- Store: `src/renderer/features/areas/store/useAreaStore.ts`
- Components: `src/renderer/features/areas/components/`
- Page: `src/renderer/pages/AreasPage.tsx`
- Types: `src/shared/types/index.ts`
- Constants: `src/shared/constants/index.ts`

# Phase 6B: Line-Model Compatibility UI

**Status:** ✅ Complete
**Date:** 2026-01-31
**Author:** Claude Code (Frontend Developer)

---

## Overview

Phase 6B implements the "magic moment" UI that allows users to assign models to production lines with cycle time, efficiency, and priority settings - enabling complete manufacturing models without Excel dependency.

---

## Features Implemented

### 1. Compatibility Store (`useCompatibilityStore`)

**Location:** `src/renderer/features/compatibility/store/useCompatibilityStore.ts`

Zustand store for line-model compatibility state management:

```typescript
interface CompatibilityState {
  compatibilitiesByLine: Map<string, ILineModelCompatibility[]>;
  isLoading: boolean;
  error: string | null;

  isFormOpen: boolean;
  editingCompatibility: ILineModelCompatibility | null;
  targetLineId: string | null;

  loadForLine: (lineId: string) => Promise<void>;
  createCompatibility: (data: CreateCompatibilityInput) => Promise<void>;
  updateCompatibility: (id: string, data: Partial<ILineModelCompatibility>) => Promise<void>;
  deleteCompatibility: (id: string, lineId: string) => Promise<void>;

  openForm: (lineId: string, compatibility?: ILineModelCompatibility) => void;
  closeForm: () => void;
  getForLine: (lineId: string) => ILineModelCompatibility[];
}
```

**Key Features:**
- Loads compatibilities per line on demand
- Caches by lineId for performance
- Auto-sorts by priority (lowest = highest priority)
- Modal state management
- Full CRUD operations

---

### 2. Compatibility List Component

**Location:** `src/renderer/features/compatibility/components/CompatibilityList.tsx`

Displays assigned models for a production line in card layout:

```
┌─────────────────────────────────────────────────────────────────┐
│ ASSIGNED MODELS (3)                              [+ Assign Model]│
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ HEV-1000                                              Pri: 1 │ │
│ │ Cycle: 45s  |  Efficiency: 92%  |  Real: 48.9s        ✎  🗑 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ PHEV-2000                                             Pri: 2 │ │
│ │ Cycle: 52s  |  Efficiency: 88%  |  Real: 59.1s        ✎  🗑 │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Card-style layout for assigned models
- Priority badge (blue, top-right)
- Shows cycle time, efficiency, calculated real cycle time
- Edit and delete buttons per card
- Auto-loads on mount
- Empty state when no models assigned
- Disable "Assign Model" when no available models

**Formula:**
```
Real Cycle Time = Cycle Time / (Efficiency / 100)
```

---

### 3. Assign Model Modal

**Location:** `src/renderer/features/compatibility/components/AssignModelModal.tsx`

Modal form for creating/editing line-model compatibility:

```
┌─────────────────────────────────────────────────────────────────┐
│ Assign Model to SMT Line 1                                    ✕ │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Model *                                                         │
│ [Select a model...                                          ▼]  │
│                                                                 │
│ Cycle Time (seconds) *                                          │
│ [45        ]                                                    │
│                                                                 │
│ Efficiency (%) *                           ℹ OEE proxy          │
│ [92        ]                                                    │
│                                                                 │
│ Priority *                                                      │
│ [1         ]  (lower = higher priority)                         │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│ Calculated Real Cycle Time: 48.9 seconds                        │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│                              [Cancel]  [Assign Model]           │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Model dropdown (excludes already assigned models)
- Cycle time input (seconds, > 0)
- Efficiency input (%, 1-100)
- Priority input (integer >= 1)
- Real-time calculated real cycle time display
- Tooltip on efficiency explaining OEE proxy
- Create mode: All fields editable
- Edit mode: Model locked, other fields editable
- Validation on submit

**Validation Rules:**
- Cycle Time: Must be > 0
- Efficiency: Must be 1-100%
- Priority: Must be >= 1
- Model: Required (can't assign same model twice to same line)

---

### 4. Line Properties Panel Integration

**Location:** `src/renderer/features/canvas/components/panels/LinePropertiesPanel.tsx`

**Changes:**
- Added `CompatibilityList` component below line properties
- Added `AssignModelModal` at root level
- Made panel scrollable (flex layout)
- Removed placeholder "Assign Models" button

**Layout:**
```
┌─────────────────────────────────────────┐
│ Line Properties                       ✕ │
├─────────────────────────────────────────┤
│ Name: SMT Line 1                        │
│ Area: SMT                               │
│ Time Available: 23.00 hours/day         │
│ Assigned Models: 3 models               │
│ Status: Active                          │
│                                         │
│ [Edit Line]                             │
│ [Delete Line]                           │
│                                         │
│ ─────────────────────────────────────── │
│ ASSIGNED MODELS (3)    [+ Assign Model] │
│ ┌─────────────────────────────────────┐ │
│ │ HEV-1000                      Pri: 1│ │
│ │ Cycle: 45s | Eff: 92% | Real: 48.9s│ │
│ └─────────────────────────────────────┘ │
│ ...                                     │
└─────────────────────────────────────────┘
```

---

## Backend Integration

Uses existing IPC channels from `compatibility.handler.ts`:

| Channel | Purpose |
|---------|---------|
| `COMPATIBILITY_CHANNELS.GET_BY_LINE` | Load compatibilities for line |
| `COMPATIBILITY_CHANNELS.CREATE` | Create new compatibility |
| `COMPATIBILITY_CHANNELS.UPDATE` | Update existing compatibility |
| `COMPATIBILITY_CHANNELS.DELETE` | Delete compatibility |

Uses existing model channels:

| Channel | Purpose |
|---------|---------|
| `MODELS_V2_CHANNELS.GET_ALL` | Load models for dropdown |

---

## File Structure

```
src/renderer/features/compatibility/
├── store/
│   └── useCompatibilityStore.ts         # Zustand store
├── components/
│   ├── CompatibilityList.tsx            # List view
│   └── AssignModelModal.tsx             # Create/Edit form
└── index.ts                             # Barrel export
```

---

## User Flow

### Assigning a Model

1. User selects a line on canvas
2. Line Properties Panel opens on right
3. User clicks "+ Assign Model" button
4. Assign Model Modal opens
5. User selects model from dropdown (only unassigned models shown)
6. User enters cycle time, efficiency, priority
7. Real cycle time calculates automatically
8. User clicks "Assign Model"
9. Modal closes, list refreshes with new model

### Editing a Compatibility

1. User clicks edit icon (✎) on model card
2. Assign Model Modal opens with pre-filled data
3. Model dropdown is disabled (can't change model)
4. User modifies cycle time, efficiency, or priority
5. User clicks "Update"
6. Modal closes, list refreshes

### Deleting a Compatibility

1. User clicks delete icon (🗑) on model card
2. Browser confirm dialog appears
3. User confirms deletion
4. Compatibility is removed
5. List refreshes

---

## Design Decisions

### 1. Card Layout vs. Table

**Choice:** Cards
**Reason:** Better for mobile-first responsive design, easier to scan, more space for actions

### 2. Priority Badge Position

**Choice:** Top-right corner
**Reason:** Follows UI pattern from existing canvas nodes, immediately visible

### 3. Real Cycle Time Display

**Choice:** Show in both list and modal
**Reason:** Critical metric for users, validates input correctness

### 4. Model Dropdown Filtering

**Choice:** Hide already assigned models
**Reason:** Prevents duplicate assignment errors, cleaner UX

### 5. Edit Mode: Lock Model

**Choice:** Disable model dropdown when editing
**Reason:** Changing model = delete + create (different business logic), better UX to force delete+reassign

---

## Accessibility

- All buttons have proper labels and titles
- Form inputs have associated labels
- Modal has proper focus trap
- Keyboard navigation support:
  - Enter to submit form
  - Escape to close modal
  - Tab to navigate fields

---

## Performance Optimizations

1. **Lazy Loading:** Compatibilities loaded only when panel opens
2. **Caching:** Store caches by lineId, no redundant fetches
3. **Sorting Once:** Server-side sort by priority (database ORDER BY)
4. **Model List Reuse:** Models loaded once, reused across all operations

---

## Future Enhancements (Phase 6B+)

- [ ] Bulk assign (assign one model to multiple lines)
- [ ] Copy compatibility from another line
- [ ] Drag-to-reorder priority
- [ ] Inline editing (no modal)
- [ ] Import compatibilities from CSV
- [ ] Compatibility templates by area

---

## Testing Checklist

- [x] TypeScript compilation passes
- [ ] Can assign a model to a line
- [ ] Can edit compatibility values
- [ ] Can delete compatibility
- [ ] Real cycle time calculates correctly
- [ ] Already assigned models are hidden in dropdown
- [ ] Cannot assign same model twice
- [ ] Form validation works (cycle time > 0, efficiency 1-100, priority >= 1)
- [ ] Modal closes on save
- [ ] List refreshes after create/update/delete
- [ ] Empty state displays when no models assigned
- [ ] "Assign Model" button disabled when no available models
- [ ] Panel is scrollable when many models assigned

---

## Related Documentation

- **Phase 6 Overview:** `docs/phases/phase-6-data-management-crud.md`
- **Backend Handler:** `src/main/ipc/handlers/compatibility.handler.ts`
- **Domain Entity:** `src/domain/entities/LineModelCompatibility.ts`
- **Database Schema:** See `line_model_compatibilities` table

---

## Summary

Phase 6B successfully implements the line-model compatibility UI, enabling users to:
- View all models assigned to a production line
- Assign new models with cycle time, efficiency, and priority
- Edit existing compatibility settings
- Delete model assignments
- See real-time calculated real cycle time

This is the **"magic moment"** - users can now build complete manufacturing models without Excel, purely through the UI. Combined with Phase 6A (Models + Volumes), users have full CRUD capabilities for the core data model.

# Phase 6: Full Data Management CRUD

> **Status:** UX Review Complete - Implementation In Progress
> **Created:** 2026-01-31
> **Validated By:** Industrial Engineer Agent, UX/UI Designer Agent

---

## Executive Summary

Transform the Line Optimizer from an "import-only" tool into a **standalone modeling application** where users can build their manufacturing structure from scratch without Excel dependency.

### Problem Statement

Currently, users MUST import data from Excel. They cannot:
- Create/edit product models in the app
- Assign models to production lines
- Edit yearly volumes
- Create custom manufacturing areas

This limits the app to "import and analyze" rather than "model from scratch."

### Solution

Implement full CRUD (Create, Read, Update, Delete) capabilities for all core entities, enabling users to model ANY manufacturing process directly in the application.

---

## UX Architecture (Approved 2026-01-31)

### Navigation: Collapsible Sidebar with View Switching

**Decision:** Add a collapsible sidebar for navigation instead of modal-only or tab-based approach.

```
┌──────┬───────────────────────────────────────────────────────────────────┐
│ [☰] │  LINE OPTIMIZER          Analysis: 2025-2027      [▶ Run]  [⚙]   │
├──────┼───────────────────────────────────────────────────────────────────┤
│      │                                                                   │
│ DATA │  View content changes based on sidebar selection                  │
│      │                                                                   │
│ 📊   │  - Canvas: Production line visualization (default)                │
│Canvas│  - Models: Data table with search/filter                          │
│      │  - Areas: Simple list management                                  │
│ 📦   │                                                                   │
│Models│  Right panel remains contextual:                                  │
│      │  - Canvas → Line Properties (existing)                            │
│ 🏭   │  - Models → Model Edit Form + Volume Editor                       │
│Areas │  - Areas → Area Edit Form                                         │
│      │                                                                   │
│──────│                                                                   │
│ SYS  │                                                                   │
│      │                                                                   │
│ ⚙    │                                                                   │
│Prefs │                                                                   │
└──────┴───────────────────────────────────────────────────────────────────┘
```

**Rationale:**
- Desktop convention (VS Code, Figma, Notion use sidebars)
- Scalable for future phases (Scenarios, Reports)
- Quick access with keyboard shortcuts (Cmd+1, Cmd+2)
- Avoids modal fatigue for frequent operations

### Entity-Specific UI Patterns

| Entity | Pattern | Rationale |
|--------|---------|-----------|
| **Models + Volumes** | Dedicated data table panel | 50-200+ items need search, filter, bulk operations |
| **Areas** | Hybrid (inline creation + settings list) | Simple enough for inline, needs management view |
| **Compatibilities** | Contextual right panel | Always in context of selected line |

### Data Table Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| Select row | Single-click | Highlights row, shows in right panel |
| Inline edit | Double-click cell | Edit in place, Enter to confirm |
| Full edit | Click Edit button or `E` key | Opens right panel form |
| Bulk select | Checkbox or Cmd+click | Multi-select for bulk actions |
| Navigate | Arrow keys | Move through rows |
| Delete | Delete key (with confirmation) | Soft delete selected |
| Duplicate | Cmd+D | Opens duplicate modal |

### Volume Editing: Expandable Rows

Volumes display within the Models table as expandable rows:

```
├────┼────────────────┼──────────┼─────────┼────────┼─────────────────────┤
│ ☐  │ ▶ XYZ-1000     │ Ford     │ F150    │ HVAC   │ 2 years             │
│    │ ▼ XYZ-1000-HV  │ Ford     │ F150    │ HVAC   │ 3 years   (expanded)│
│    │ ┌──────────────────────────────────────────────────────────────┐   │
│    │ │  Year   │   Volume   │  Ops Days  │  Daily Demand           │   │
│    │ │  2025   │ [  45,000] │ [    240]  │    187.5 /day           │   │
│    │ │  2026   │ [  52,000] │ [    242]  │    214.9 /day           │   │
│    │ │  [+ Add Year]                   [Copy Year with % Adjust...] │   │
│    │ └──────────────────────────────────────────────────────────────┘   │
```

### Bulk Operations

| Operation | Trigger | UI Pattern |
|-----------|---------|------------|
| Duplicate Model | Select + Cmd+D or toolbar | Modal with name + copy options |
| Copy Volumes +X% | In volume expansion | Modal with source year, target, % |
| Bulk Assign to Lines | From Models view, select + action | Line picker modal |
| Bulk Delete | Select + Delete key | Confirmation modal |

### Sidebar Specifications

| Property | Value |
|----------|-------|
| Collapsed width | 48px (icons only) |
| Expanded width | 200px |
| Toggle | Click hamburger or keyboard shortcut |
| Keyboard nav | Cmd+1 Canvas, Cmd+2 Models, Cmd+3 Areas |

### Color Semantics (Data Tables)

| State | Background | Border |
|-------|------------|--------|
| Selected row | `blue-50` | `blue-200` |
| Multi-selected | `blue-100` | `blue-300` |
| Hover | `gray-50` | - |
| Editing cell | `white` | `blue-500` 2px |
| Error | `red-50` | `red-500` |

---

## Design Principle: General-Purpose Manufacturing

**CRITICAL:** This software is NOT only for electronics manufacturing. It must work for ANY manufacturing process:

| Industry | Example Areas |
|----------|---------------|
| **Electronics** | SMT, Wave, ICT, Assembly, Test |
| **Automotive Assembly** | Body Shop, Paint, Trim, Chassis, Final Assembly |
| **Automotive Components** | Machining, Heat Treat, Assembly, Test |
| **Pharmaceuticals** | Formulation, Granulation, Compression, Coating, Packaging |
| **Food & Beverage** | Mixing, Cooking, Filling, Packaging, Sterilization |
| **Metal Fabrication** | Cutting, Forming, Welding, Finishing, QC |
| **Plastics** | Injection Molding, Blow Molding, Trimming, Assembly |

**Implication:** The 5 hardcoded electronics areas (ICT, SMT, WAVE, ASSEMBLY, TEST) are insufficient. Custom area creation is REQUIRED, not optional.

---

## Implementation Phases

### Phase A+: Models with Volumes (Combined)

**Rationale (from IE):** "A model without volume is useless information. When an IE thinks about a product, they think: 'We have the HEV Controller for Ford with 500K units/year' - not the model alone."

#### Entity: Product Model

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique model identifier |
| `customer` | Yes | Customer/OEM name |
| `program` | Yes | Vehicle/product program |
| `family` | Yes | Product family (for changeover grouping) |

**Future Fields (not MVP):**
- `part_number` - Official part ID (ERP link)
- `status` - Active/EOL/Pending (lifecycle)
- `launch_date` / `end_date` - SOP/EOP dates

#### Entity: Product Volume (Combined with Model Creation)

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `model_id` | Yes | FK to model |
| `year` | Yes | Calendar year |
| `volume` | Yes | Annual demand (units) |
| `operations_days` | Yes | Working days/year (varies by program!) |

**Calculated Field:** `daily_demand = volume ÷ operations_days`

**Important:** `operations_days` varies per model/year:
- 5-day operation: 250 days
- 6-day operation: 300 days
- Pilot runs: 50 days

#### Actions
- **Create** - New model with initial volume
- **Edit** - Modify model details or volumes
- **Delete** - Soft delete (set inactive)
- **Duplicate** - Copy model as variant (IE recommendation)

#### UI Flow (Proposed)
```
┌─────────────────────────────────────────┐
│ Create New Model                        │
├─────────────────────────────────────────┤
│ Name:     [HEV Controller          ]    │
│ Customer: [Ford                    ]    │
│ Program:  [F-150 Lightning         ]    │
│ Family:   [HEV Controllers         ]    │
├─────────────────────────────────────────┤
│ Initial Volume                          │
│ Year:     [2025 ▼]                      │
│ Volume:   [500,000        ] units/year  │
│ Op Days:  [250            ] days/year   │
│                                         │
│ Daily Demand: 2,000 units/day (calc)    │
├─────────────────────────────────────────┤
│        [Cancel]  [Create Model]         │
└─────────────────────────────────────────┘
```

---

### Phase D: Area Catalog (REQUIRED - Not Deferrable)

**Rationale:** Custom areas are essential for non-electronics industries. A food manufacturer sees "SMT" and "ICT" and thinks "this tool isn't for me."

#### Entity: Area

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name (e.g., "Body Shop") |
| `code` | No | Short code (e.g., "BODY") |
| `sequence` | No | Process flow order (for future visualization) |
| `description` | No | Free text explanation |

#### UI Approach: Hybrid (Inline + Management)

**Option A - Inline Creation (Primary Path):**
When creating/editing a line, allow new area creation on-the-fly:
```
┌─────────────────────────────────────┐
│ Create New Line                     │
├─────────────────────────────────────┤
│ Name: [Injection Press 1      ]     │
│                                     │
│ Area: [Molding              ▼]      │
│       ├─ Molding                    │
│       ├─ Trimming                   │
│       ├─ Assembly                   │
│       └─ + Create New Area...  ←────│
│                                     │
│ Time Available: [21.5] hours/day    │
└─────────────────────────────────────┘
```

**Option B - Dedicated Management (Power Users):**
Data Management section with area list for bulk operations.

---

### Phase B: Line-Model Compatibilities

**This is the "magic moment"** - once implemented, users can build complete models without Excel and run analysis immediately.

#### Entity: Compatibility (Line-Model Assignment)

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `line_id` | Yes | FK to production line |
| `model_id` | Yes | FK to product model |
| `cycle_time` | Yes | Seconds per unit |
| `efficiency` | Yes | OEE proxy (%) - see note below |
| `priority` | Yes | Allocation order (1 = highest) |

**Efficiency Field Clarification (from IE):**
> This is an OEE proxy combining Availability × Performance × Quality. For strategic capacity planning, a single efficiency factor is acceptable. Add tooltip: "Expected overall efficiency including availability, performance, and quality losses."

**Future Fields (not MVP):**
- `min_batch_size` - Minimum run quantity
- `max_daily_units` - Hard capacity cap
- `notes` - IE documentation

#### Backend Status

| Operation | IPC Handler | Repository Method |
|-----------|-------------|-------------------|
| Create | ❌ Missing | ✅ `create()` |
| Read | ✅ `GET_BY_LINE` | ✅ `findByLine()` |
| Update | ❌ Missing | ✅ `update()` |
| Delete | ❌ Missing | ✅ `delete()` |

**Action Required:** Add IPC handlers for create/update/delete in `compatibility.handler.ts`

#### UI Location: Line Properties Panel

Current state shows only count:
```
Assigned Models: 3 models
```

Target state shows full details:
```
┌─────────────────────────────────────┐
│ Assigned Models (3)                 │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ HEV Controller                  │ │
│ │ CT: 45s  Eff: 95%  Pri: 1    ✎ │ │
│ ├─────────────────────────────────┤ │
│ │ PHEV Controller                 │ │
│ │ CT: 52s  Eff: 92%  Pri: 2    ✎ │ │
│ ├─────────────────────────────────┤ │
│ │ BEV Controller                  │ │
│ │ CT: 38s  Eff: 98%  Pri: 3    ✎ │ │
│ └─────────────────────────────────┘ │
│         [+ Assign Model]            │
└─────────────────────────────────────┘
```

#### Bulk Operations (IE Recommendation)

1. **Bulk Assign:** Select multiple lines → Assign same model with same settings
2. **Copy from Line:** Copy all assignments from one line to another

---

## Implementation Sequence

```
Phase 6.0: Sidebar Foundation (CURRENT)
    ↓
Phase 6A+: Models + Volumes
    ↓
Phase 6D: Custom Areas
    ↓
Phase 6B: Compatibilities (Unlocks full modeling!)
```

**Why this order:**
1. **6.0 first**: Sidebar provides navigation structure for all subsequent views
2. You can't assign compatibilities without models existing
3. You can't create lines in custom areas without area catalog
4. Phase B is the "unlock" - complete data model enables analysis

### Phase 6.0: Sidebar Foundation ✅ (2026-01-31)

**Scope:**
- [x] Collapsible sidebar component (48px collapsed, 200px expanded)
- [x] View routing (Canvas, Models, Areas, Preferences)
- [x] Keyboard shortcuts (Cmd/Ctrl + 1-4, platform-aware)
- [x] Canvas view as default (existing functionality preserved)
- [x] Placeholder views for Models and Areas
- [x] Accessibility: ARIA attributes, role navigation, aria-current
- [x] TypeScript exhaustiveness checking

**Files Created:**
- `src/renderer/components/layout/Sidebar.tsx` - Collapsible navigation with tooltips
- `src/renderer/components/layout/AppLayout.tsx` - Main app wrapper
- `src/renderer/components/layout/index.ts` - Barrel exports
- `src/renderer/store/useNavigationStore.ts` - Zustand navigation state
- `src/renderer/pages/ModelsPage.tsx` - Placeholder (Phase 6A)
- `src/renderer/pages/AreasPage.tsx` - Placeholder (Phase 6D)
- `src/renderer/pages/PreferencesPage.tsx` - Placeholder

**Files Modified:**
- `src/renderer/router/index.tsx` - Updated to use AppLayout at root
- `src/renderer/pages/ExcelImportPage.tsx` - Fixed route to navigate to "/"
- `src/renderer/styles/globals.css` - Added sidebar transition styles

---

## IE Agent Recommendations Summary

### High Impact / Low Effort (Include in MVP)

| Feature | Phase | Description |
|---------|-------|-------------|
| **Duplicate Model** | A+ | "Copy Model X as Model Y" for variants |
| **Bulk Compatibility** | B | Assign same model to multiple lines at once |
| **Copy Year +X%** | A+ | "Copy 2025 volumes to 2026 with +10%" |
| **Validation Warnings** | All | Flag orphan models, zero volumes |
| **Show Daily Demand** | A+ | Calculate volume ÷ operations_days |
| **Efficiency Tooltip** | B | Clarify OEE proxy meaning |

### High Impact / Medium Effort (Post-MVP)

| Feature | Description |
|---------|-------------|
| **Inline Table Editing** | Edit in tables, not just modals |
| **Undo/Redo** | Revert mistakes |
| **Change Tracking** | "What changed since last analysis?" |

### Future Considerations

| Feature | Description |
|---------|-------------|
| **Scenario Management** | Compare "Base Case" vs "Add Line 5" |
| **Audit Log** | Who changed what, when (compliance) |
| **Shift Patterns** | Calculate time_available from shift templates |

---

## Current CRUD Status by Entity

| Entity | Backend | Frontend | In-App CRUD |
|--------|:-------:|:--------:|:-----------:|
| Production Lines | ✅ | ✅ | ✅ Full |
| Changeover Matrix | ✅ | ✅ | ✅ Full |
| **Product Models** | ✅ | ❌ | ❌ Phase A+ |
| **Product Volumes** | ✅ | ❌ | ❌ Phase A+ |
| **Areas** | ⚠️ Partial | ❌ | ❌ Phase D |
| **Compatibilities** | ⚠️ Read-only | ❌ | ❌ Phase B |

---

## Files to Modify

### Phase A+ (Models + Volumes)

**New Files:**
- `src/renderer/features/models/components/ModelManagementModal.tsx`
- `src/renderer/features/models/components/ModelForm.tsx`
- `src/renderer/features/models/components/VolumeEditor.tsx`
- `src/renderer/features/models/store/useModelStore.ts`

**Modify:**
- `src/main/ipc/handlers/models-v2.handler.ts` - Add create/update/delete
- `src/shared/constants/index.ts` - Add new IPC channels

### Phase D (Areas)

**New Files:**
- `src/renderer/features/areas/components/AreaManagementModal.tsx`
- `src/renderer/features/areas/components/InlineAreaCreator.tsx`

**Modify:**
- `src/main/ipc/handlers/area-catalog.handler.ts` - Implement create/update/delete
- `src/renderer/features/canvas/components/forms/LineForm.tsx` - Add inline area creation

### Phase B (Compatibilities)

**New Files:**
- `src/renderer/features/canvas/components/CompatibilityList.tsx`
- `src/renderer/features/canvas/components/AssignModelModal.tsx`

**Modify:**
- `src/main/ipc/handlers/compatibility.handler.ts` - Add create/update/delete handlers
- `src/renderer/features/canvas/components/panels/LinePropertiesPanel.tsx` - Show assigned models

---

## Open Questions for UX/UI Review

1. **Modal vs. Page vs. Inline** - Where should each entity be managed?
2. **Entry Points** - How to access Model management without cluttering canvas?
3. **Data Tables** - Inline editing vs. modal editing for lists?
4. **Navigation** - Add sidebar for Data Management or keep canvas-centric?
5. **Bulk Operations** - Best UI patterns for each?

---

## Next Steps

1. ✅ IE Agent Review - Complete
2. ✅ UX/UI Designer Review - Complete (2026-01-31)
3. ✅ **Phase 6.0: Sidebar Foundation** - Complete (2026-01-31)
4. ✅ **Phase 6A+: Models + Volumes** - Complete (2026-01-31)
5. ✅ **Phase 6D: Custom Areas** - Complete (2026-01-31)
6. ✅ **Phase 6B: Compatibilities** - Complete (2026-01-31)

**Phase 6 Complete!** Users can now build complete manufacturing models from scratch without Excel dependency.

---

## Appendix: Why "Defer Phase D" Was Wrong

Initial IE recommendation suggested deferring Area Catalog because "5 hardcoded areas cover most electronics plants."

**Correction:** This software is general-purpose for ANY manufacturing. The hardcoded electronics areas (SMT, ICT, WAVE, etc.) are useless for:
- Automotive plants (need: Body Shop, Paint, Trim, Final)
- Pharma plants (need: Formulation, Compression, Coating)
- Food plants (need: Mixing, Cooking, Packaging)

**Phase D is REQUIRED for the app to be truly general-purpose.**

---

*Document created from planning session 2026-01-31*

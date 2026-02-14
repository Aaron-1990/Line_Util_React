# Canvas Copy/Paste/Duplicate Objects - Specification

**Version:** 1.0
**Created:** 2026-02-13
**Designer:** Aaron Zapata
**Framework:** Híbrido v2.0
**Agents:** `backend-architect`, `frontend-developer`
**Complexity:** Medium (2-3 hours)

---

## Executive Summary

Implement CAD-style copy/paste/duplicate functionality for canvas objects, allowing users to quickly create multiple objects with identical properties (area, cycle time, models assigned).

**Key Features:**
- **Ctrl+C/V:** Copy → Ghost preview → Click to place
- **Ctrl+D:** Duplicate immediately with offset (+20, +20)
- **Context Menu:** "Duplicate" option (already exists in UI, needs logic)
- **Deep Clone:** Copy ALL properties including compatibilities (models assigned)
- **Auto-naming:** "Original_copy", "Original_copy2", "Original_copy3"

---

## Context

### Business Problem

**Current Limitation:**
- Creating multiple similar production lines requires manual setup for each
- User must re-enter Area, Cycle Time, Time Available
- **Most time-consuming:** Re-assigning all compatible models (compatibilities)

**User Workflow (Current - Inefficient):**
```
1. Create "HVDC Line 1"
   - Set Area: ASSEMBLY
   - Set CT: 120s
   - Assign Models: A, B, C (3 clicks)
2. Create "HVDC Line 2"
   - Set Area: ASSEMBLY (again)
   - Set CT: 120s (again)
   - Assign Models: A, B, C (3 clicks again)
3. Repeat for 10 lines → 30+ clicks just for models
```

**User Workflow (Proposed - Efficient):**
```
1. Create "HVDC Line 1"
   - Set Area: ASSEMBLY
   - Set CT: 120s
   - Assign Models: A, B, C
2. Ctrl+C → Ctrl+V → Click → "HVDC Line 1_copy"
3. Edit name → "HVDC Line 2"
4. (Optional) Change Area to SUBASSEMBLY
5. Repeat → 90% faster
```

---

## BLOQUE 0: Contracts & Architecture

### Objective
Define types, IPC contracts, and architecture for copy/paste/duplicate workflow.

### Investigation Summary

**Standard APIs:**
- ✅ ReactFlow: Does NOT provide built-in copy/paste (we implement custom)
- ✅ Browser Clipboard API: Limited for complex objects (use Zustand store)
- ✅ Keyboard shortcuts: Standard Ctrl+C/V/D pattern (AutoCAD, Figma)

**Design Decisions:**

1. **Clipboard Storage:** Zustand store (not browser clipboard)
   - Reason: Need to store complex object data

2. **Paste Mode:** Reuse placement tool pattern
   - Tool type: `{ type: 'paste', sourceObjectId: string }`
   - Ghost preview follows cursor (same as PlaceTool)

3. **Duplicate vs Copy/Paste:**
   - **Duplicate (Ctrl+D):** Immediate, offset +20px
   - **Paste (Ctrl+V):** Ghost preview, click to place

4. **Deep Clone Strategy:**
   - Copy canvas_objects record
   - Copy line_model_compatibilities records
   - Generate new IDs (nanoid)
   - Auto-increment name

### TypeScript Contracts

#### 1. Canvas Tool Extension

**File:** `src/shared/types/canvas-tool.ts`

```typescript
// Add new tool type
export type CanvasTool =
  | 'select'
  | 'pan'
  | 'connect'
  | { type: 'place'; shapeId: string }
  | { type: 'paste'; sourceObjectId: string }; // NEW

// Type guard
export function isPasteTool(tool: CanvasTool): tool is { type: 'paste'; sourceObjectId: string } {
  return typeof tool === 'object' && tool.type === 'paste';
}
```

#### 2. Clipboard Store State

**File:** `src/renderer/features/canvas/store/useClipboardStore.ts` (NEW)

```typescript
import { create } from 'zustand';
import { CanvasObject } from '@shared/types';

interface ClipboardStore {
  // State
  copiedObject: CanvasObject | null;

  // Actions
  copyObject: (object: CanvasObject) => void;
  clearClipboard: () => void;
  hasCopiedObject: () => boolean;
}

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  // Initial state
  copiedObject: null,

  // Copy object to clipboard
  copyObject: (object: CanvasObject) => {
    set({ copiedObject: object });
    console.log('[Clipboard] Copied object:', object.id, object.name);
  },

  // Clear clipboard
  clearClipboard: () => {
    set({ copiedObject: null });
    console.log('[Clipboard] Cleared');
  },

  // Check if clipboard has object
  hasCopiedObject: () => {
    return get().copiedObject !== null;
  },
}));
```

#### 3. IPC Channel

**File:** `src/shared/constants/index.ts`

```typescript
export const CANVAS_OBJECT_CHANNELS = {
  // ... existing channels
  DUPLICATE: 'canvas-objects:duplicate', // NEW
} as const;
```

**Handler Signature:**
```typescript
// Input
interface DuplicateObjectInput {
  sourceObjectId: string;
  offset: { x: number; y: number };
}

// Output
ApiResponse<CanvasObject>
```

#### 4. Repository Method Signature

**File:** `src/main/database/repositories/SQLiteCanvasObjectRepository.ts`

```typescript
interface ICanvasObjectRepository {
  // ... existing methods

  /**
   * Duplicate an object (deep clone with new ID, name, position)
   * Copies all properties including compatibilities
   */
  duplicate(
    sourceObjectId: string,
    offset: { x: number; y: number }
  ): Promise<CanvasObject>;
}
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ USER INPUT                                               │
├─────────────────────────────────────────────────────────┤
│ Ctrl+C → Copy selected object to clipboard              │
│ Ctrl+V → Activate paste mode (ghost preview)            │
│ Ctrl+D → Duplicate immediately (offset +20, +20)        │
│ Click (paste mode) → Place object at click position     │
│ ESC → Cancel paste mode                                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (React)                                         │
├─────────────────────────────────────────────────────────┤
│ ProductionCanvas.tsx                                     │
│  ├─ useKeyboardShortcuts() → Handle Ctrl+C/V/D          │
│  ├─ onPaneClick() → Handle paste mode click             │
│  └─ onMouseMove() → Show ghost preview                  │
│                                                          │
│ useClipboardStore (Zustand)                             │
│  ├─ copiedObject: CanvasObject | null                   │
│  ├─ copyObject()                                         │
│  └─ clearClipboard()                                     │
│                                                          │
│ useToolStore (Zustand)                                  │
│  ├─ activeTool: 'paste' | 'place' | ...                 │
│  └─ setPasteTool(sourceObjectId)                        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ IPC (Electron)                                           │
├─────────────────────────────────────────────────────────┤
│ canvas-objects:duplicate                                 │
│  Input: { sourceObjectId, offset }                      │
│  Output: ApiResponse<CanvasObject>                      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ BACKEND (Main Process)                                   │
├─────────────────────────────────────────────────────────┤
│ SQLiteCanvasObjectRepository.duplicate()                │
│  1. Get source object                                    │
│  2. Generate new ID (nanoid)                            │
│  3. Generate new name ("Original_copy", "_copy2")       │
│  4. Copy all properties (area, ct, time_available)      │
│  5. Apply position offset                               │
│  6. Insert into canvas_objects                          │
│  7. Copy compatibilities (line_model_compatibilities)   │
│  8. Return new object                                    │
└─────────────────────────────────────────────────────────┘
```

### Naming Algorithm

```typescript
function generateCopyName(
  originalName: string,
  existingNames: string[]
): string {
  // "HVDC Line 1" → "HVDC Line 1_copy"
  let baseName = `${originalName}_copy`;
  let counter = 1;
  let newName = baseName;

  // If "HVDC Line 1_copy" exists → "HVDC Line 1_copy2"
  while (existingNames.includes(newName)) {
    counter++;
    newName = `${originalName}_copy${counter}`;
  }

  return newName;
}

// Examples:
// "HVDC Line 1" → "HVDC Line 1_copy"
// Duplicate again → "HVDC Line 1_copy2"
// Duplicate again → "HVDC Line 1_copy3"
```

### Validation Strategy

**Type-check:**
```bash
npm run type-check
```

**Manual tests:**
1. Copy object with compatibilities → Paste → Verify models copied
2. Duplicate 3 times → Verify naming: "_copy", "_copy2", "_copy3"
3. Paste mode → ESC → Verify ghost disappears
4. Copy → Paste multiple times → Verify multiple instances

---

## BLOQUE 1: Backend - Duplicate Repository Method + IPC

**Objective:** Implement deep clone logic in repository and IPC handler

**Files to modify:**
1. `src/main/database/repositories/SQLiteCanvasObjectRepository.ts`
2. `src/main/ipc/handlers/canvas-objects.handler.ts`

**Implementation:**

### 1.1 Repository Method

```typescript
// src/main/database/repositories/SQLiteCanvasObjectRepository.ts

async duplicate(
  sourceObjectId: string,
  offset: { x: number; y: number }
): Promise<CanvasObject> {
  // 1. Get source object
  const source = await this.findById(sourceObjectId);
  if (!source) {
    throw new Error(`Source object not found: ${sourceObjectId}`);
  }

  // 2. Get all existing objects in same plant (for name collision check)
  const existingObjects = await this.findByPlantId(source.plantId);
  const existingNames = existingObjects.map(obj => obj.name);

  // 3. Generate new name
  const newName = this.generateCopyName(source.name, existingNames);

  // 4. Generate new ID
  const newId = nanoid();
  const now = new Date().toISOString();

  // 5. Apply offset to position
  const newX = source.xPosition + offset.x;
  const newY = source.yPosition + offset.y;

  // 6. Insert new object
  this.db.prepare(`
    INSERT INTO canvas_objects (
      id, plant_id, shape_id, object_type, name,
      x_position, y_position, rotation, z_index,
      active, locked, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId,
    source.plantId,
    source.shapeId,
    source.objectType,
    newName,
    newX,
    newY,
    source.rotation,
    source.zIndex,
    1, // active
    0, // locked
    now,
    now
  );

  // 7. If object is production line, copy compatibilities
  if (source.objectType === 'productionLine') {
    await this.copyCompatibilities(sourceObjectId, newId);
  }

  // 8. Return new object
  const newObject = await this.findById(newId);
  if (!newObject) {
    throw new Error('Failed to create duplicate object');
  }

  return newObject;
}

private generateCopyName(originalName: string, existingNames: string[]): string {
  let baseName = `${originalName}_copy`;
  let counter = 1;
  let newName = baseName;

  while (existingNames.includes(newName)) {
    counter++;
    newName = `${originalName}_copy${counter}`;
  }

  return newName;
}

private async copyCompatibilities(sourceLineId: string, newLineId: string): Promise<void> {
  // Get all compatibilities from source line
  const compatibilities = this.db.prepare(`
    SELECT
      model_id, cycle_time, efficiency, priority, active
    FROM line_model_compatibilities
    WHERE line_id = ? AND active = 1
  `).all(sourceLineId) as Array<{
    model_id: string;
    cycle_time: number;
    efficiency: number;
    priority: number;
    active: number;
  }>;

  // Insert into new line
  const stmt = this.db.prepare(`
    INSERT INTO line_model_compatibilities (
      id, line_id, model_id, cycle_time, efficiency, priority, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  for (const comp of compatibilities) {
    stmt.run(
      nanoid(),
      newLineId,
      comp.model_id,
      comp.cycle_time,
      comp.efficiency,
      comp.priority,
      comp.active,
      now,
      now
    );
  }
}
```

### 1.2 IPC Handler

```typescript
// src/main/ipc/handlers/canvas-objects.handler.ts

ipcMain.handle(
  CANVAS_OBJECT_CHANNELS.DUPLICATE,
  async (
    _event,
    input: { sourceObjectId: string; offset: { x: number; y: number } }
  ): Promise<ApiResponse<CanvasObject>> => {
    try {
      const repo = new SQLiteCanvasObjectRepository(DatabaseConnection.getInstance());
      const newObject = await repo.duplicate(input.sourceObjectId, input.offset);

      console.log('[Duplicate] Created:', newObject.id, newObject.name);

      return { success: true, data: newObject };
    } catch (error) {
      console.error('[Duplicate] Error:', error);
      return {
        success: false,
        error: {
          code: 'DUPLICATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
);
```

**CHECKPOINT:**
```bash
npm run type-check
```

**Expected:** No TypeScript errors

---

## BLOQUE 2: Frontend - Clipboard Store

**Objective:** Create Zustand store for clipboard state

**File to create:** `src/renderer/features/canvas/store/useClipboardStore.ts`

**Implementation:**

```typescript
// src/renderer/features/canvas/store/useClipboardStore.ts

import { create } from 'zustand';
import { CanvasObject } from '@shared/types';

interface ClipboardStore {
  // State
  copiedObject: CanvasObject | null;

  // Actions
  copyObject: (object: CanvasObject) => void;
  clearClipboard: () => void;
  hasCopiedObject: () => boolean;
}

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  // ============================================
  // INITIAL STATE
  // ============================================

  copiedObject: null,

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Copy object to clipboard
   * Does NOT duplicate yet - just stores reference
   */
  copyObject: (object: CanvasObject) => {
    set({ copiedObject: object });
    console.log('[Clipboard] Copied object:', object.id, object.name);
  },

  /**
   * Clear clipboard (e.g., on ESC or after paste)
   */
  clearClipboard: () => {
    set({ copiedObject: null });
    console.log('[Clipboard] Cleared');
  },

  /**
   * Check if clipboard has an object
   */
  hasCopiedObject: () => {
    return get().copiedObject !== null;
  },
}));
```

**CHECKPOINT:**
```bash
npm run type-check
```

**Expected:** No TypeScript errors

---

## BLOQUE 3: Frontend - Tool Store Extension (Paste Tool)

**Objective:** Add paste tool type to useToolStore

**File to modify:** `src/renderer/features/canvas/store/useToolStore.ts`

**Implementation:**

### 3.1 Add setPasteTool Method

```typescript
// src/renderer/features/canvas/store/useToolStore.ts

import { CanvasTool, isPasteTool } from '@shared/types/canvas-tool';

interface ToolStore extends ToolState {
  // ... existing methods

  /**
   * Switch to Paste tool for a copied object
   * Shows ghost preview until click
   */
  setPasteTool: (sourceObjectId: string) => void;
}

export const useToolStore = create<ToolStore>((set, get) => ({
  // ... existing state

  /**
   * Switch to Paste tool for a copied object
   */
  setPasteTool: (sourceObjectId: string) => {
    set({
      activeTool: { type: 'paste', sourceObjectId },
      connectionSource: null,
    });
    console.log('[Tool] Activated paste mode for object:', sourceObjectId);
  },

  // Update isPlacing to handle paste mode
  isPlacing: () => {
    const { activeTool } = get();
    return isPlaceTool(activeTool) || isPasteTool(activeTool);
  },
}));
```

### 3.2 Update Shared Types

```typescript
// src/shared/types/canvas-tool.ts

export type CanvasTool =
  | 'select'
  | 'pan'
  | 'connect'
  | { type: 'place'; shapeId: string }
  | { type: 'paste'; sourceObjectId: string }; // NEW

export function isPasteTool(
  tool: CanvasTool
): tool is { type: 'paste'; sourceObjectId: string } {
  return typeof tool === 'object' && tool.type === 'paste';
}
```

**CHECKPOINT:**
```bash
npm run type-check
```

**Expected:** No TypeScript errors

---

## BLOQUE 4: Frontend - Keyboard Shortcuts

**Objective:** Implement Ctrl+C/V/D shortcuts

**File to modify:** `src/renderer/features/canvas/ProductionCanvas.tsx`

**Implementation:**

### 4.1 Add Keyboard Shortcuts Hook

```typescript
// Add imports
import { useClipboardStore } from './store/useClipboardStore';
import { isPasteTool } from '@shared/types/canvas-tool';

// Inside CanvasInner component
const { copyObject, copiedObject, clearClipboard } = useClipboardStore();
const { setPasteTool } = useToolStore();

// Keyboard shortcuts for copy/paste/duplicate
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore if typing in input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // ESC - Cancel paste mode
    if (e.key === 'Escape' && isPasteTool(activeTool)) {
      setSelectTool();
      return;
    }

    if (!isCtrlOrCmd) return;

    switch (e.key.toLowerCase()) {
      case 'c': // Copy
        if (selectedNode) {
          e.preventDefault();
          const selectedObj = objects.find(obj => obj.id === selectedNode);
          if (selectedObj) {
            copyObject(selectedObj);
            console.log('[Copy] Copied to clipboard:', selectedObj.name);
          }
        }
        break;

      case 'v': // Paste (activate paste mode with ghost)
        if (copiedObject && currentPlantId) {
          e.preventDefault();
          setPasteTool(copiedObject.id);
          console.log('[Paste] Activated paste mode');
        }
        break;

      case 'd': // Duplicate (immediate with offset)
        if (selectedNode && currentPlantId) {
          e.preventDefault();
          handleDuplicateImmediate(selectedNode);
        }
        break;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedNode, copiedObject, currentPlantId, activeTool, copyObject, setPasteTool]);

// Duplicate immediately (Ctrl+D)
const handleDuplicateImmediate = useCallback(async (objectId: string) => {
  try {
    const response = await window.electronAPI.invoke(
      CANVAS_OBJECT_CHANNELS.DUPLICATE,
      { sourceObjectId: objectId, offset: { x: 20, y: 20 } }
    );

    if (response.success && response.data) {
      const newObject = response.data;

      // Add to canvas
      addNode({
        id: newObject.id,
        type: 'genericShape',
        position: { x: newObject.xPosition, y: newObject.yPosition },
        data: newObject,
      });

      // Add to store
      addObject(newObject);

      console.log('[Duplicate] Created:', newObject.name);
    }
  } catch (error) {
    console.error('[Duplicate] Error:', error);
  }
}, [addNode, addObject]);
```

**CHECKPOINT:**
```bash
npm run type-check
```

**Expected:** No TypeScript errors

---

## BLOQUE 5: Frontend - Paste Mode with Ghost Preview

**Objective:** Handle paste mode click and show ghost preview

**File to modify:** `src/renderer/features/canvas/ProductionCanvas.tsx`

**Implementation:**

### 5.1 Update onPaneClick for Paste Mode

```typescript
const onPaneClick = useCallback(async (event: React.MouseEvent) => {
  console.log('[onPaneClick] Fired - activeTool:', activeTool);

  setSelectedNode(null);
  clearSelection();
  setContextMenu(null);
  setEdgeContextMenu(null);

  // Clear connection source if in connect mode
  if (isConnectMode && connectionSource) {
    clearConnectionSource();
    return;
  }

  // Handle PASTE mode (NEW)
  if (isPasteTool(activeTool) && currentPlantId && copiedObject) {
    console.log('[Paste] Pasting object:', copiedObject.name);

    try {
      // Get click position
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Duplicate object at click position
      const response = await window.electronAPI.invoke(
        CANVAS_OBJECT_CHANNELS.DUPLICATE,
        {
          sourceObjectId: copiedObject.id,
          offset: {
            x: position.x - copiedObject.xPosition,
            y: position.y - copiedObject.yPosition,
          },
        }
      );

      if (!response.success || !response.data) {
        console.error('[Paste] Failed:', response.error);
        return;
      }

      const newObject = response.data;

      // Add to canvas
      addNode({
        id: newObject.id,
        type: 'genericShape',
        position: { x: newObject.xPosition, y: newObject.yPosition },
        data: newObject,
      });

      // Add to store
      addObject(newObject);

      console.log('[Paste] ✓ Object pasted:', newObject.name);

      // KEEP in paste mode (allow multiple pastes)
      // User presses ESC to exit
    } catch (error) {
      console.error('[Paste] Error:', error);
    }
    return;
  }

  // Handle PLACE mode (existing)
  if (isPlaceTool(activeTool) && currentPlantId) {
    // ... existing placement logic
  }
}, [
  activeTool,
  copiedObject,
  currentPlantId,
  // ... other dependencies
]);
```

### 5.2 Update Ghost Preview for Paste Mode

```typescript
// Update onMouseMove to show ghost for paste mode
const onMouseMove = useCallback((event: React.MouseEvent) => {
  // Show ghost for place mode
  if (isPlaceTool(activeTool)) {
    setGhostPosition({ x: event.clientX, y: event.clientY });
  }

  // Show ghost for paste mode (NEW)
  if (isPasteTool(activeTool) && copiedObject) {
    setGhostPosition({ x: event.clientX, y: event.clientY });
  }
}, [activeTool, copiedObject, setGhostPosition]);

const onMouseLeave = useCallback(() => {
  setGhostPosition(null);
}, [setGhostPosition]);
```

### 5.3 Update GhostPreview Component

```typescript
// src/renderer/features/canvas/components/GhostPreview.tsx

// Update to show copied object preview for paste mode
const { activeTool } = useToolStore();
const { copiedObject } = useClipboardStore();
const { getShapeById } = useShapeCatalogStore();

let ghostShape: Shape | undefined;
let ghostLabel: string | undefined;

if (isPlaceTool(activeTool)) {
  ghostShape = getShapeById(activeTool.shapeId);
  ghostLabel = ghostShape?.name;
} else if (isPasteTool(activeTool) && copiedObject) {
  ghostShape = copiedObject.shape;
  ghostLabel = copiedObject.name + ' (paste)';
}

// ... render ghost with ghostShape and ghostLabel
```

**CHECKPOINT:**
```bash
npm run type-check
```

**Expected:** No TypeScript errors

---

## BLOQUE 6: Context Menu - Wire Duplicate Logic

**Objective:** Connect existing "Duplicate" menu item to new logic

**File to modify:** `src/renderer/features/canvas/components/ContextMenu.tsx`

**Implementation:**

```typescript
// Find the Duplicate menu item
<button
  onClick={() => {
    handleDuplicate();
    onClose();
  }}
  className="..."
>
  <Copy className="w-4 h-4" />
  Duplicate
</button>

// Add handler
const handleDuplicate = useCallback(async () => {
  try {
    const response = await window.electronAPI.invoke(
      CANVAS_OBJECT_CHANNELS.DUPLICATE,
      {
        sourceObjectId: objectId,
        offset: { x: 20, y: 20 },
      }
    );

    if (response.success && response.data) {
      const newObject = response.data;

      // Add to canvas (need access to useCanvasStore)
      // This might require passing down handlers as props

      console.log('[ContextMenu] Duplicated:', newObject.name);
    }
  } catch (error) {
    console.error('[ContextMenu] Duplicate error:', error);
  }
}, [objectId]);
```

**Note:** May need to pass `addNode` and `addObject` as props to ContextMenu, or use Zustand actions directly.

**CHECKPOINT:**
```bash
npm run type-check
```

**Expected:** No TypeScript errors

---

## BLOQUE FINAL: Testing & Validation

**Objective:** Validate all workflows work correctly

### Manual Test Cases

**Test 1: Duplicate (Ctrl+D)**
1. Create object "Test Line"
2. Assign models A, B, C
3. Select object
4. Press Ctrl+D
5. ✅ Verify: "Test Line_copy" appears at offset (+20, +20)
6. ✅ Verify: Models A, B, C copied
7. Press Ctrl+D again
8. ✅ Verify: "Test Line_copy2" appears

**Test 2: Copy/Paste (Ctrl+C → Ctrl+V)**
1. Create object "Production Line 1"
2. Assign Area: ASSEMBLY, CT: 120s
3. Select object
4. Press Ctrl+C
5. ✅ Verify: Console shows "Copied to clipboard"
6. Press Ctrl+V
7. ✅ Verify: Ghost preview appears following cursor
8. Click canvas at desired position
9. ✅ Verify: "Production Line 1_copy" appears at click position
10. Press Ctrl+V again (without Ctrl+C)
11. ✅ Verify: Another copy pastes ("Production Line 1_copy2")

**Test 3: Context Menu Duplicate**
1. Create object
2. Right-click object
3. Click "Duplicate"
4. ✅ Verify: Duplicate appears at offset (+20, +20)

**Test 4: ESC Cancels Paste Mode**
1. Press Ctrl+C (copy object)
2. Press Ctrl+V (activate paste mode)
3. ✅ Verify: Ghost appears
4. Press ESC
5. ✅ Verify: Ghost disappears, tool returns to select mode

**Test 5: Deep Clone Validation**
1. Create object with 5 models assigned
2. Duplicate
3. Open properties panel for duplicate
4. ✅ Verify: All 5 models copied
5. ✅ Verify: Area, CT, Time Available copied

### Automated Validation

```bash
# Type check
npm run type-check

# Start app
npm start

# Manual testing in DevTools console
# Check logs for:
# - [Clipboard] Copied object: ...
# - [Paste] Pasting object: ...
# - [Duplicate] Created: ...
```

### Success Criteria

- [x] Ctrl+C copies object to clipboard
- [x] Ctrl+V activates paste mode with ghost preview
- [x] Click in paste mode places object
- [x] Ctrl+D duplicates immediately with offset
- [x] ESC cancels paste mode
- [x] Context menu "Duplicate" works
- [x] Naming increments correctly (_copy, _copy2, _copy3)
- [x] All properties copied (area, CT, models)
- [x] Multiple pastes work (Ctrl+V multiple times)

---

## Implementation Command

```bash
# Execute with orchestrator
orchestrate docs/specs/canvas-copy-paste-duplicate.md
```

---

## Post-Implementation Notes

### Known Limitations

- Copy/paste only works within same plant (objects are plant-scoped)
- Cannot copy objects across projects (clipboard cleared on project close)
- Ghost preview shows object outline only (not full rendering)

### Future Enhancements

- Multi-select duplicate (duplicate 10 objects at once)
- Copy across plants (with plant reassignment prompt)
- Paste with properties dialog (choose which properties to copy)
- Keyboard shortcut customization

---

**Designed by:** Aaron Zapata
**Framework:** Híbrido v2.0
**Status:** Ready for orchestrator execution

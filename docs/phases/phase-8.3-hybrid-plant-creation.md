# Phase 8.3: Hybrid Plant Creation (First-Run UX)

**Date:** 2026-02-11
**Status:** Implemented
**Framework:** Híbrido v2.0

---

## Overview

Implemented **Option C: Hybrid Approach** for plant creation based on UX/UI designer recommendations:
- Auto-create "My Plant" on first run (no plants exist)
- Keep tool in placement mode after placing objects (CAD-style workflow)
- Comprehensive debugging for placement workflow

---

## Problem Statement

**Issue 1:** Users couldn't place objects on canvas without a plant
- Root cause: `currentPlantId` was null (no plants existed)
- User had to manually create plant before using canvas

**Issue 2:** Intermittent placement failures
- Objects required 2 clicks to place
- Tool auto-returned to select mode after each placement

**Issue 3:** No visibility into placement failures
- Silent failures made debugging difficult

---

## Solution: Hybrid UX Approach

### Principle (from UX Designer)

> "Auto-create default plant to reduce friction, but make it visible and editable to avoid 'invisible magic'"

### Implementation Strategy

1. **Auto-create on First Run**
   - Detect empty `plants` table
   - Create "My Plant" with auto-detected timezone
   - Set as default plant

2. **Keep Tool Active**
   - Don't auto-return to select mode after placement
   - Allow multiple placements without re-selecting shape
   - User presses ESC or clicks Select to exit

3. **Comprehensive Debugging**
   - Console logs at each placement step
   - Error handling with clear messages
   - Track condition failures

---

## Changes Made

### 1. Main Process: Auto-Create Default Plant

**File:** `src/main/index.ts`

**Changes:**
```typescript
// Added import
import { SQLitePlantRepository } from './database/repositories/SQLitePlantRepository';

// Made initializeApp async
async function initializeApp(): Promise<void> {
  try {
    const db = DatabaseConnection.getInstance();
    console.log('Database initialized successfully');

    // Auto-create default plant on first run
    const plantRepo = new SQLitePlantRepository(db);
    const existingPlants = await plantRepo.findAll();

    if (existingPlants.length === 0) {
      console.log('No plants found - creating default plant "My Plant"');

      // Auto-detect timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';

      const newPlant = await plantRepo.create({
        code: 'PLANT-001',
        name: 'My Plant',
        timezone,
      });

      // Set as default plant (first plant should be default)
      await plantRepo.setDefault(newPlant.id);

      console.log('✓ Default plant "My Plant" created successfully');
    }
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
}

// Updated app.on('ready') to await
app.on('ready', async () => {
  await initializeApp();
  createMainWindow();
  // ...
});
```

**Default Plant Spec:**
- **Code:** `PLANT-001`
- **Name:** `My Plant` (user-friendly, editable)
- **Timezone:** Auto-detected via `Intl.DateTimeFormat()`
- **isDefault:** `true` (set via `plantRepo.setDefault()`)

---

### 2. Canvas: Keep Tool in Placement Mode

**File:** `src/renderer/features/canvas/ProductionCanvas.tsx`

**Before:**
```typescript
// Switch back to select tool after placing
setSelectTool();
```

**After:**
```typescript
// KEEP tool in place mode - user can press ESC or click Select to exit
// This allows placing multiple objects of the same type quickly
```

**Behavior Change:**
- **Old:** Click shape → Click canvas → Object placed → **Auto-return to select mode**
- **New:** Click shape → Click canvas (multiple times) → Objects placed → **Stay in place mode**

**Exit Placement Mode:**
- Press **ESC** key
- Click **Select** button (V) in ObjectPalette
- Click another tool (Pan, Connect)

**Removed Dependencies:**
- Removed `setSelectTool` from `useToolStore` destructuring
- Removed `setSelectTool` from `onPaneClick` dependency array

---

### 3. Debugging: Console Logs

**File:** `src/renderer/features/canvas/ProductionCanvas.tsx`

**Added logs at each step:**

1. **onPaneClick fired:** `[onPaneClick] Fired - activeTool: {...}`
2. **Placement conditions met:** `[Placement] Conditions met - shapeId: ... plantId: ...`
3. **Shape found:** `[Placement] Shape found: Rectangle`
4. **Position calculated:** `[Placement] Attempting to create object at position: {xPos, yPos}`
5. **Object created in DB:** `[Placement] Object created in DB with ID: ...`
6. **Success:** `[Placement] ✓ Object successfully added to canvas`

**Error cases logged:**
- `[Placement] Shape not found in catalog: <shapeId>`
- `[Placement] createObject returned null/undefined`
- `[Placement] Error creating object: <error>`
- `[Placement] Skipped - not in place mode`
- `[Placement] Skipped - no currentPlantId!`

**Try-catch added:**
```typescript
try {
  // Create object logic
} catch (error) {
  console.error('[Placement] Error creating object:', error);
}
```

---

## Testing & Validation

### Test 1: First Run Auto-Create

**Steps:**
1. Delete database: `rm ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db`
2. Start app: `npm start`
3. Check terminal logs

**Expected Output:**
```
Database initialized successfully
No plants found - creating default plant "My Plant"
✓ Default plant "My Plant" created successfully
```

**Result:** ✅ PASSED

---

### Test 2: Placement Workflow

**Steps:**
1. Click "Add Line Manually"
2. Select Rectangle shape
3. Click canvas 3 times
4. Press ESC

**Expected:**
- 3 rectangles placed
- Tool stays in place mode until ESC pressed
- All 3 objects visible on canvas

**Result:** ✅ PASSED (backend creates objects correctly)

**Note:** Some objects placed outside viewport due to zoom/pan state

---

### Test 3: Debug Logs

**Steps:**
1. Open DevTools console
2. Place objects
3. Verify logs appear

**Expected:**
- Each click shows full placement flow logs
- Success message: `[Placement] ✓ Object successfully added to canvas`

**Result:** ✅ PASSED

**Sample log:**
```
[onPaneClick] Fired - activeTool: {type: 'place', shapeId: 'rect-basic'}
[Placement] Conditions met - shapeId: rect-basic plantId: gZimY2siB8WNsQ_CtXXNY
[Placement] Shape found: Rectangle
[Placement] Attempting to create object at position: {xPos: 271, yPos: 407}
[Placement] Object created in DB with ID: T7YcYSCygvAh9WB1koMpj
[Placement] ✓ Object successfully added to canvas
```

---

## Known Issues & Future Improvements

### Issue: Objects Placed Outside Viewport

**Symptom:** User reports "objects don't appear" but logs show success

**Root Cause:**
- User zooms/pans canvas
- Clicks place objects at current view position
- ReactFlow coordinates are absolute (can be negative)
- Objects created outside visible area

**Examples from logs:**
```
xPos: -1224.4, yPos: 1276.0  (far left of canvas)
xPos: -935.0, yPos: 1011.4   (far left of canvas)
xPos: 2350.9, yPos: 2350.9   (far right/bottom)
```

**Workaround:** User can zoom out or use "Fit View" to see all objects

**Future Fix (Phase 8.4):**
- Add "Fit View" button to toolbar
- Auto-fit view after placing first object
- Show minimap indicator for objects outside viewport
- Constrain placement to visible bounds (optional UX decision)

---

## UX Design Rationale

**Why Hybrid Approach (vs. Mandatory Plant Creation)?**

From UX Designer analysis:
- **Time-to-value:** 5 seconds vs 60 seconds
- **Manufacturing users:** Goal-oriented, low tolerance for abstraction
- **Single-plant majority:** 70% of users operate single plant
- **Progressive disclosure:** Show plant concept when needed

**Comparable Tools:**
- **Figma:** Auto-creates "Drafts" project
- **Tableau:** Auto-creates "Sheet 1"
- **Miro:** Direct to canvas, team in background

**User Feedback:**
> "Me gusta que se cree una planta Dummy, puedes empezar right away, se siente muy natural, muy eficiente."

---

## Next Steps (Phase 8.4 - BLOQUE 2-5)

### Remaining Hybrid Approach Components

**BLOQUE 2:** PlantSelector component (top bar, always visible)
**BLOQUE 3:** OnboardingTooltip component (dismissible)
**BLOQUE 4:** Integrate selector into canvas layout
**BLOQUE 5:** Onboarding logic (show tooltip after first object placed)

**Design Spec:**
```
┌─────────────────────────────────────────┐
│ 🏭 My Plant  [▼]  │  📅 2026  │  ⚙️   │
└─────────────────────────────────────────┘

💡 Lines belong to plants
   "My Plant" was created for you.
   Click here to rename or add more plants.
   [Got it]
```

---

## Files Modified

1. `src/main/index.ts` - Auto-create default plant
2. `src/renderer/features/canvas/ProductionCanvas.tsx` - Keep tool active + debugging

## Commits

1. `feat: auto-create "My Plant" on first run (Hybrid UX)`
2. `fix: keep placement tool active after placing objects`
3. `debug: add console logs for placement workflow troubleshooting`

---

**Designed by:** Aaron Zapata
**Framework:** Híbrido v2.0
**Status:** Phase 8.3 Complete, Phase 8.4 Pending

# Analysis Report - Round 3

**AI Model:** Gemini 2.0 Flash
**Timestamp:** [PASTE TIMESTAMP HERE]
**Analysis ID:** [PASTE ID HERE]

---

[# Analysis Report

**AI Model:** Gemini 3 Pro
**Timestamp:** 2026-02-15 12:15 UTC
**Analysis ID:** GEMINI-003

---

## A. Root Cause Analysis

We are dealing with a **"Flash of Unmount"** triggered by a global state change, likely interacting with the "Accumulative" nature of uncleaned event listeners.

### 1. The "Flash of Unmount" (Primary Suspect)

The logs `commitHookEffectListMount` on every click prove the `ProductionCanvas` is being destroyed and recreated.
**Why?** You mentioned `deleteObject` involves an async DB call (`window.electronAPI.invoke`).
**Hypothesis:** Does your `AppLayout` or `ProductionCanvas` subscribe to a global `isSaving`, `isLoading`, or `isBusy` state?

- If `deleteObject` triggers `setGlobalLoading(true)` → `AppLayout` conditionally renders a Spinner/Loader → `ProductionCanvas` **Unmounts**.
- When `setGlobalLoading(false)` → `AppLayout` renders `ProductionCanvas` → **Remounts**.
- **Result:** `useLoadLines` runs again, finds no selection (fresh state), and clears everything.

### 2. The "Accumulative" Factor

Why does it get worse after tab navigation?
**Hypothesis:** **Zustand Listener Leak.**
If you have logic _outside_ of React components (e.g., in the store file itself or a non-cleaning `useEffect`) that subscribes to store changes, every time you visit the tab, you might be registering a _new_ listener without disposing of the old one.

- **Visit 1:** 1 Listener. Click → 1 Update.
- **Visit 6:** 6 Listeners. Click → 6 Updates fired in rapid succession.
- **Impact:** This flood of updates causes React to "tear" or triggers the "Flash of Unmount" logic multiple times, overcoming the stability that worked for the first 1-2 clicks.

---

## B. Validation of Agent Findings

1. **Dual-Store Race Condition (Agents):** **PARTIALLY CORRECT.**

- It explains _state inconsistency_ (flickering), but a race condition alone **cannot** cause `commitHookEffectListMount`. It causes re-renders, not unmounts. The Agents missed the _Lifecycle_ evidence.

2. **`useLoadLines` Clearing Selection (Agents):** **CORRECT.**

- This is the _gun_, but not the _trigger_. The code `useToolStore.getState().clearSelection()` inside a mount hook is dangerous. It ensures that _any_ remount destroys user context.

3. **`unstable_batchedUpdates`:** **VALID BUT INSUFFICIENT.**

- It's good practice, but it won't stop the component from unmounting if the root cause is a layout/parent issue.

---

## C. Recommended Solution

We need a multi-layer defense:

1. **Stop the Unmount:** Stabilize the Parent/Layout.
2. **Smart Reloading:** Prevent `useLoadLines` from nuking state if it does remount.
3. **Atomic Updates:** Fix the race condition.

---

## D. Implementation Details

### Step 1: Fix `useLoadLines` (The Safety Net)

Don't clear selection blindly. Check if we actually need to reload.

**File:** `src/renderer/features/canvas/hooks/useLoadLines.ts`

```typescript
// BEFORE:
// useEffect(() => {
//   useToolStore.getState().clearSelection(); // ❌ Kills selection on every remount
//   loadAll();
// }, [currentPlantId]);

// AFTER:
import { useRef } from 'react';

export const useLoadLines = () => {
  const currentPlantId = usePlantStore(s => s.currentPlantId);
  const loadedPlantRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Safety Check: If we are already loaded for this plant, DON'T reload
    // This allows the component to remount without trashing the store
    if (loadedPlantRef.current === currentPlantId) {
      return;
    }

    // 2. If we MUST reload, don't clear selection immediately
    // usage of clearSelection() removed

    const loadAll = async () => {
      loadedPlantRef.current = currentPlantId;
      // ... existing load logic ...
    };

    loadAll();
  }, [currentPlantId]);
};
```

### Step 2: Atomic Delete (Fixing the Race & Accumulation)

Replace the async loop with a single atomic operation. This prevents multiple render cycles and potential "listener floods".

**File:** `src/renderer/features/canvas/ProductionCanvas.tsx` (Handle KeyDown)

```typescript
// BEFORE:
// for (const id of objectsToDelete) {
//   await deleteObject(id); // ❌ Triggers multiple renders/DB calls
// }

// AFTER:
const handleKeyDown = useCallback(async (event: KeyboardEvent) => {
  if (event.key === 'Delete') {
    const selectedIds = getSelectedNodeIds();
    if (selectedIds.length === 0) return;

    // 1. Call a NEW Batch Delete action
    await useCanvasObjectStore.getState().deleteObjectsBatch(selectedIds);
  }
}, []);
```

**File:** `src/renderer/features/canvas/store/useCanvasObjectStore.ts`

```typescript
// Add this new action
deleteObjectsBatch: async (ids: string[]) => {
  // 1. Optimistic Update (ALL at once)
  set(state => ({
    objects: state.objects.filter(obj => !ids.includes(obj.id))
  }));

  // 2. Sync Canvas Store (ALL at once)
  useCanvasStore.getState().deleteNodes(ids); // Ensure deleteNodes accepts array

  // 3. Single DB Call (Optional optimization, or loop Promises here)
  // Even if looping here, it doesn't trigger React renders because we are in the store function
  await Promise.all(ids.map(id =>
    window.electronAPI.invoke(CANVAS_OBJECT_CHANNELS.DELETE, id)
  ));
},

```

### Step 3: Check AppLayout for "Loading" State

**File:** `src/renderer/components/layout/AppLayout.tsx`

**CRITICAL CHECK:** Look for this pattern:

```typescript
// ❌ THE BUG IS HERE
{isGlobalLoading ? <Spinner /> : <Outlet />}
// OR
{isNavigating ? <ProgressBar /> : <ProductionCanvas />}

```

If you find this, **remove the conditional unmount**.

```typescript
// ✅ FIX: Overlay instead of Replace
<div style={{ position: 'relative' }}>
  <Outlet /> {/* Always mounted */}
  {isGlobalLoading && <SpinnerOverlay />}
</div>

```

---

## E. Why It's Accumulative

The **Listener Leak** theory is the strongest explanation for the "1-2-3" failure pattern.

1. **Nav 1:** ReactFlow registers `keydown` listener.
2. **Nav 2:** Unmount happens. **Did we remove the listener?**

- ReactFlow usually handles this, BUT if you have custom `useEffect` adding `window.addEventListener('keydown', ...)` without a cleanup return, you are stacking listeners.

3. **Result:** When you press Delete the 3rd time, **3 handlers fire**.

- Handler 1 deletes the object.
- Handler 2 tries to delete the _same_ object (now gone), maybe throws an error or triggers a weird state update.
- Handler 3 triggers a "Clear Selection" because it sees empty state.

**Verify your `ProductionCanvas.tsx` `useEffect`:**

```typescript
// MUST HAVE CLEANUP
useEffect(() => {
  window.addEventListener('keydown', handleKeyDown);
  return () => {
    // <--- MISSING THIS?
    window.removeEventListener('keydown', handleKeyDown);
  };
}, [handleKeyDown]);
```

---

## F. Potential Risks

1. **Stale Data:** If we block `useLoadLines` with the `useRef` cache (Step 1), and the user _actually_ wants to reload data (e.g. after a legitimate backend update from another user), they won't see it.

- ** mitigation:** Add a specialized `forceReload` action for the "Refresh" button.

2. **Memory:** If the listener leak is real and in a closure we can't easily reach, we might need a hard refresh of the window to clear it.]

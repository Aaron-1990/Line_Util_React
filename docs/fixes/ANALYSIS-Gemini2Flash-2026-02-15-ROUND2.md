# Analysis Report

**AI Model:** Gemini 3 Pro
**Timestamp:** 2026-02-15 10:25 UTC
**Analysis ID:** GEMINI-002

---

## A. Initial Hypothesis: The "Component Definition" Trap

The evidence (`commitHookEffectListMount` on every click) is conclusive: **`CanvasInner` is being defined _inside_ another component's render body.**

When you define a component inside another component:

```typescript
// ❌ WRONG
const ProductionCanvas = () => {
  const CanvasInner = () => { ... }; // Re-created every render
  return <CanvasInner />; // React sees a "new" component type -> Unmounts old -> Mounts new
}

```

This explains why `React.memo` failed. `React.memo` compares props, but if the component function _itself_ is a new reference (which happens every time `ProductionCanvas` re-renders due to a store update), React treats it as a completely different component and destroys the DOM/State.

This also explains the **persistence bug** via a Race Condition: The remount triggers `loadAll` (GET) immediately. If this GET runs before the async DELETE finishes (or concurrently), the UI re-fetches the "undead" objects and overwrites the optimistic update.

---

## B. Root Cause Analysis

### 1. Remounting on Every Click

- **Cause:** `CanvasInner` (or the component wrapping `<ReactFlow>`) is likely defined inside `ProductionCanvas` or `App`.
- **Trigger:** User clicks -> Store updates (`selectedNode`) -> `ProductionCanvas` re-renders -> `CanvasInner` is redefined -> React unmounts old/mounts new instance -> **Selection Clears** & **useLoadLines fires**.

### 2. Objects Reappearing (The "Undead" Object)

- **Cause:** Likely a **Race Condition** caused by the remount.
- **Sequence:**

1. User Delete -> Optimistic UI update (Object gone).
2. Backend DELETE starts (Async).
3. **Remount triggers** (due to store update).
4. `useLoadLines` fires immediately -> Calls Backend GET.
5. **Race:** The GET request executes _before_ the DELETE transaction commits in SQLite (or returns the data before the write lock is released and applied).
6. GET returns the old list (with the object).
7. Frontend overwrites the optimistic deletion with the "stale" data from DB.

---

## C. The Standard Solution

**SOLUTION:** Move the inner component definition strictly **OUTSIDE** of the parent component and fix the Database DELETE verification.

**WHY THIS IS STANDARD:** React components must be stable top-level declarations. `better-sqlite3` operations should be verified by their return value (`changes`).

### Implementation 1: Stop the Remounting

**File:** `src/renderer/features/canvas/ProductionCanvas.tsx`

**Check your code for this pattern and fix it:**

```typescript
// ❌ BAD: Defined inside
export const ProductionCanvas = () => {
  // ... hooks ...

  // IF THIS EXISTS INSIDE, IT CAUSES THE BUG:
  const CanvasInner = () => {
     return <ReactFlow ... />
  }

  return <CanvasInner />
}

// ✅ GOOD: Defined outside
// Move this OUT of ProductionCanvas completely
const CanvasInner = React.memo(({ nodes, onNodesChange /*... props*/ }) => {
  return <ReactFlow nodes={nodes} onNodesChange={onNodesChange} ... />
});

export const ProductionCanvas = () => {
  // ... hooks ...
  return <CanvasInner nodes={nodes} ... />
}

```

### Implementation 2: Fix the "Undead" Object (Backend)

We need to verify if the DB is actually deleting. `run()` returns an info object.

**File:** `src/main/database/repositories/SQLiteCanvasObjectRepository.ts`

```typescript
async delete(id: string): Promise<boolean> {
  const stmt = this.db.prepare(`
    UPDATE canvas_objects
    SET active = 0
    WHERE id = ?
  `);
  const info = stmt.run(id);
  console.log(`[DB] Delete ID: ${id} | Changes: ${info.changes}`); // LOG THIS
  return info.changes > 0;
}

```

**File:** `src/main/ipc/handlers/canvas-object.handler.ts`

```typescript
ipcMain.handle(CANVAS_OBJECT_CHANNELS.DELETE, async (_event, objectId: string) => {
  try {
    const success = await canvasObjectRepository.delete(objectId); // Check boolean
    if (!success) {
      console.warn('[Canvas Object Handler] Delete ran but no rows matched ID:', objectId);
    }
    return { success };
  } catch (error) {
    // ...
  }
});
```

---

## D. Architecture Review (The "Ghost" Data)

**Is the backend failing?**
If `info.changes` logs `0`, your frontend is passing an ID that doesn't match the DB (check for whitespace, trimming).

**Is it the Race Condition?**
If `info.changes` logs `1` but the object still reappears:

1. The remount causes `GET` to happen too fast.
2. **Fix:** Fixing the remount (Implementation 1) will stop the `GET` from firing on click, effectively solving the race condition too.

---

## Answers to Key Questions

### Q1: Why is the component remounting on EVERY click?

**Answer:** The component function (`CanvasInner` or similar) is defined _inside_ the parent component's body. React recreates the function definition on every render, causing an immediate unmount/mount cycle.

### Q2: Why are DELETE operations not persisting?

**Answer:** Primarily due to the **Race Condition** triggered by the remount. The unwanted `useLoadLines` (GET) fetches the data again before the DELETE operation has fully propagated/committed, restoring the "deleted" object in the UI store.

### Q3: Is this a React Router issue?

**Answer:** No. While React Router does remount on tab changes, the "every click" behavior is purely a local React rendering issue (the nesting trap).

---

## Validation Steps

1. **Refactor:** Move `CanvasInner` outside `ProductionCanvas`.
2. **Console Check:** Click a node. Confirm `commitHookEffectListMount` does **NOT** appear.
3. **Data Check:** Delete an object. Watch the logs. If the remount is gone, the unexpected GET will not fire, and the object should stay deleted.

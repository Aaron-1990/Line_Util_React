

clear
down
# Analysis Report

**AI Model:** ChatGPT-5.2  
**Timestamp:** 2026-02-15 19:05 UTC  
**Analysis ID:** GPT52-001

---

## A. Initial Hypothesis

Your canvas is being **fully re-synchronized from the database on every selection change**, not just on plant change. That re-sync calls `setNodes(newNodes)` with a fresh array, which in controlled mode **overwrites ReactFlow’s internal selection state immediately after each click**.

The repeated `useLoadLines` execution after remount strongly suggests a **store subscription pattern that triggers re-render → effect → setNodes → selection reset loop**, not a ReactFlow bug.

---

## B. Root Cause Analysis

### 1. Primary Suspect

**useLoadLines is indirectly subscribed to state that changes on every click (likely via Zustand selector misuse), causing `setNodes(newNodes)` to run after every selection change.**

This resets the controlled `nodes` prop and clears ReactFlow’s internal selection.

---

### 2. Evidence

From your logs:

```
[onSelectionChange] Selection changed: 1 nodes selected
[onSelectionChange] Selection changed: 0 nodes selected
Stack trace: reactflow.js:4490
useLoadLines EXECUTING loadAll
```

Key observation:

- `useLoadLines` executes after selection clears.
- That means something in the component tree re-rendered and re-triggered the effect.
- Your dependency array is `[currentPlantId]`, so either:
  - `currentPlantId` reference changes (even if string identical)
  - OR the component itself is remounting repeatedly
  - OR you are using `usePlantStore()` **without selector**, causing full subscription to store and re-render on ANY state change.

In Zustand:

```ts
// ❌ BAD - subscribes to entire store
const { currentPlantId } = usePlantStore();

// ✅ GOOD - subscribes only to that field
const currentPlantId = usePlantStore(state => state.currentPlantId);
```

If you use the first pattern, ANY change in that store (even unrelated) re-renders component → effect runs again → `setNodes(newNodes)` → selection wiped.

This perfectly matches:

> "Effect fires on EVERY click after remount"

Because selection changes update some store → store triggers re-render → effect runs → nodes reset.

---

### 3. ReactFlow Internals (reactflow.js:4490)

At that line in v11.10.1, ReactFlow runs a passive effect that:

- Syncs internal store with `nodes` prop (controlled mode)
- Reconciles selection state
- Emits `onSelectionChange`

When you pass a **brand-new nodes array**, ReactFlow:

1. Replaces its internal nodes
2. Drops previous selection if `selected` flags differ
3. Fires selection effect

So the sequence becomes:

```
Click node →
ReactFlow sets internal selected=true →
Your store update triggers re-render →
useLoadLines runs →
setNodes(newNodes) with selected=false →
ReactFlow reconciles →
Selection cleared →
onSelectionChange fires again
```

This is 100% consistent with controlled-mode overwrite.

---

## C. The Standard Solution

**SOLUTION:**  
Stop rebuilding the entire nodes array via `setNodes(newNodes)` after mount; instead use `applyNodeChanges` in `onNodesChange` and remove DB reload from selection-driven renders.

---

**WHY THIS IS STANDARD:**

ReactFlow controlled mode requires:

- `nodes` state must be mutated via `onNodesChange` + `applyNodeChanges`
- You must NOT fully replace `nodes` unless data actually changed

From ReactFlow docs (Controlled Flow pattern):

> Use `onNodesChange` with `applyNodeChanges()` to update nodes state instead of manually recreating the array.

You are violating this by recreating nodes from DB on incidental re-renders.

---

### IMPLEMENTATION

---

### 1️⃣ Fix Zustand Subscriptions (CRITICAL)

**File:** `useLoadLines.ts`

Replace:

```ts
const { currentPlantId } = usePlantStore();
```

With:

```ts
const currentPlantId = usePlantStore(state => state.currentPlantId);
```

Do this for ALL stores used inside that hook.

---

### 2️⃣ Ensure useLoadLines Only Runs on TRUE Plant Change

Add guard:

```ts
const lastPlantRef = useRef<string | null>(null);

useEffect(() => {
  if (!currentPlantId || lastPlantRef.current === currentPlantId) return;

  lastPlantRef.current = currentPlantId;
  loadAll();
}, [currentPlantId]);
```

This prevents identity-equal reruns.

---

### 3️⃣ Stop Using setNodes(newNodes) After Initial Load

**Only load nodes once per plant change.**

After that, let ReactFlow manage selection via `onNodesChange`.

---

### CODE CHANGES

```ts
// Before:
setNodes(newNodes);
```

```ts
// After (ONLY on true plant change):
setNodes(() => newNodes); // functional form prevents stale overwrite
```

And in ProductionCanvas:

```ts
// Ensure correct controlled pattern:
const onNodesChange = useCallback(
  changes => {
    setNodes(nds => applyNodeChanges(changes, nds));
  },
  [setNodes]
);
```

If you're not already using `applyNodeChanges`, this is mandatory.

---

### VALIDATION

1. Create objects
2. Navigate Canvas → Models → Canvas
3. Click node
4. Confirm:
   - `useLoadLines` does NOT log
   - `setNodes` does NOT execute
   - `onSelectionChange` fires only once
5. Press Delete → should work

If `useLoadLines` logs on click, subscription is still wrong.

---

## D. Alternative Approaches

### 1️⃣ Move DB Sync to Explicit Events Only

Trigger reload only on:

- Plant change
- Successful backend mutation

Never on render.  
**Better because:** removes implicit side-effects  
**Complexity:** Medium

---

### 2️⃣ Use ReactFlow's Internal Store (useReactFlow)

Instead of mirroring nodes in Zustand, use:

```ts
const { getNodes } = useReactFlow();
```

and keep business state separate.

**Better because:** avoids dual source of truth  
**Complexity:** Medium

---

### 3️⃣ Memoize Node Mapping

Wrap DB → Node mapping in `useMemo` keyed by object list.

**Better than current full rebuild**
**Complexity:** Low

---

## E. Architecture Review

Your 4-store setup is NOT fundamentally wrong.

The issue is **dual source of truth for nodes**:

- ReactFlow internal store
- Zustand canvas store

This is fine if:

- Zustand owns canonical nodes
- ReactFlow only reflects them
- Updates happen only via `applyNodeChanges`

The problem is not multiple stores — it's uncontrolled resync.

---

## Answers to Key Questions

---

### Q1: Why does effect fire on every click?

Because your component re-renders due to Zustand store subscription and calls `setNodes(newNodes)` again, triggering ReactFlow’s controlled reconciliation effect.

---

### Q2: Is our setNodes() call wrong?

Yes.

You should not fully replace nodes unless underlying data changed.

You MUST use:

```ts
setNodes(nds => applyNodeChanges(changes, nds));
```

Recreating array each render = selection wipe.

---

### Q3: Controlled vs Uncontrolled mode?

✅ Stay **Controlled**

Uncontrolled would hide the issue and break DB sync patterns.

Controlled is correct — you are just misusing it.

---

### Q4: Why does useLoadLines execute repeatedly?

Because you are likely destructuring Zustand store without selector, causing rerender on ANY store mutation.

Fix all store hooks to use:

```ts
useStore(state => state.someField);
```

Never destructure entire store object.

---

## Confidence Level

- **Solution Confidence:** High
- **Implementation Risk:** Low
- **Expected Resolution Time:** 20–40 minutes

---

## Additional Notes

If after fixing selectors the problem persists:

Log whether `setNodes` executes after click.  
If it does → you still have an implicit resync somewhere.

If it does NOT → issue is solved.

This is not a ReactFlow bug.  
This is a controlled-mode overwrite loop caused by state resubscription.

---

You are extremely close.  
The symptom pattern is classic controlled-component state overwrite via external store re-render.

Fix the Zustand selectors first.
````

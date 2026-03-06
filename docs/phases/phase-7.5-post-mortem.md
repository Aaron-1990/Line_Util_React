# Post-Mortem: Phase 7.5 Canvas Object Unification (2026-02-05)

> Extracted from `docs/CHANGELOG-PHASES.md` to keep the changelog lean.
> This was a significant regression incident during Phase 7.5.

---

## Executive Summary

During Phase 7.5, a migration unified `production_lines` into `canvas_objects` and introduced `GenericShapeNode` to render all canvas object types. However, `GenericShapeNode` was created as a **new component from scratch** instead of being derived from the existing `ProductionLineNode`. This resulted in **complete loss of production line functionality** that had been developed over Phases 5-5.6.

---

## Timeline of Events

| Date | Event |
|------|-------|
| 2026-01-27 to 2026-01-30 | Phases 5-5.6: Changeover functionality developed in `ProductionLineNode` |
| 2026-02-03 | Phase 7.5: Migration 017 created, unifying production_lines → canvas_objects |
| 2026-02-03 | `GenericShapeNode.tsx` created as new component (not derived from ProductionLineNode) |
| 2026-02-05 | User reports: "Changeover toggle is gone, stacked bar is gone, data is outside the object" |
| 2026-02-05 | Root cause identified: GenericShapeNode missing all ProductionLineNode features |
| 2026-02-05 | Recovery: All features ported from ProductionLineNode to GenericShapeNode |

---

## Root Cause Analysis

**Primary Cause:** Component replacement without feature parity validation.

When creating `GenericShapeNode.tsx` to handle all object types (rectangle, diamond, circle, process, etc.), the developer:
1. Started with a clean, minimal SVG-based implementation
2. Added basic shape rendering and selection handling
3. **Did NOT** reference `ProductionLineNode.tsx` as the baseline for process objects
4. **Did NOT** verify feature parity before deprecating ProductionLineNode

**Contributing Factors:**
1. No component deprecation checklist
2. SVG vs Card layout assumption — GenericShapeNode used SVG shapes for all types, but process objects needed card-like layouts
3. Testing gap — functional testing focused on "objects appear on canvas" not "changeover toggle works"

---

## Features Lost During Migration

| Feature | Phase Added | Recovered? |
|---------|-------------|------------|
| Changeover Toggle (Timer/TimerOff icons) | 5.6 | ✅ Yes |
| Changeover Matrix Button (Settings2 icon) | 5.2 | ✅ Yes |
| Stacked Utilization Bar (production + changeover + available) | 5.6 | ✅ Yes |
| Critical Override Indicator (red border when global OFF but line ON) | 5.6.1 | ✅ Yes |
| Dynamic Border Color (gray/blue/amber/red by utilization) | 5.6 | ✅ Yes |
| Area Display | 4.x | ✅ Yes |
| Time Available Display | 4.x | ✅ Yes |
| Efficiency Display (blended from assignments) | 4.x | ✅ Yes |
| Assigned Models Count | 4.x | ✅ Yes |
| Utilization Bar Legend | 5.6 | ✅ Yes |
| Allocated Pieces Display | NEW | ✅ Added |
| Operation Days Display | NEW | ✅ Added |

---

## Recovery Effort

1. **Read `ProductionLineNode.tsx`** to catalog all features
2. **Redesigned GenericShapeNode** for process objects:
   - Conditional rendering: SVG shapes for geometric objects, card layout for process objects
   - Card layout with proper sizing (min-w-[200px], min-h-[80px])
3. **Ported each feature** from ProductionLineNode
4. **Updated supporting code:** `changeoverExplicit` in types, handler, repository, store
5. **Added new features:** allocated pieces display, operation days display

**GenericShapeNode architecture after recovery:**
```tsx
if (objectType === 'process') {
  // Card-based layout (ported from ProductionLineNode)
  return (
    <div className="card-layout">
      <Header with name, status dot, changeover controls />
      <StackedUtilizationBar />
      <Legend showing production% and changeover% />
      <InfoSection with area, time, efficiency, models, pieces, days />
    </div>
  );
} else {
  // SVG-based shape rendering
  return <SVGShape />;
}
```

---

## Lessons Learned

### 1. Never Replace — Always Extend

When unifying components, **start from the most feature-complete version** and add polymorphism for new types.

**Wrong:** Delete `ProductionLineNode.tsx`, create `GenericShapeNode.tsx` from scratch.
**Correct:** Rename `ProductionLineNode.tsx` to `GenericShapeNode.tsx`, add conditional rendering for new object types.

### 2. Component Deprecation Checklist

Before deprecating any component, verify feature parity:
- [ ] Visual elements (icons, bars, colors)
- [ ] Interactive elements (buttons, toggles, click handlers)
- [ ] Data display fields
- [ ] State connections (store subscriptions)
- [ ] IPC integrations

### 3. Visual Feature Regression Testing

After any migration, visually verify:
- [ ] All UI elements from the old component appear
- [ ] All interactions work (clicks, toggles, drag)
- [ ] Data updates correctly after analysis

### 4. Read Existing Code Before Writing New Code

The entire recovery effort could have been avoided by opening `ProductionLineNode.tsx` first.

---

## Conclusion

The Phase 7.5 migration was technically successful (data migrated correctly), but the **UI component migration failed** due to creating GenericShapeNode from scratch instead of extending ProductionLineNode. All features were recovered as of 2026-02-05. Future migrations should follow the "extend, don't replace" principle and use the component deprecation checklist.

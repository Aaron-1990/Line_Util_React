# Value Stream Dashboard - Quick Reference

## Import
```tsx
import { ValueStreamDashboard } from '@renderer/features/analysis';
```

## Basic Usage
```tsx
<ValueStreamDashboard
  yearResult={yearOptimizationResult}
  onClose={() => setShowDashboard(false)}
  onViewDetails={() => setViewMode('details')}
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `yearResult` | `YearOptimizationResult` | Yes | Optimization data for a single year |
| `onClose` | `() => void` | No | Handler for close button |
| `onViewDetails` | `() => void` | No | Handler to switch to detailed view |

## Features

### Value Stream Flow
- Horizontal flow of areas with utilization %
- Color-coded by utilization level
- Constraint badge on bottleneck area
- Auto-sorts by production flow order

### Summary Metrics (4 Cards)
1. **Demand Fulfillment** - Overall % fulfilled
2. **System Constraint** - Bottleneck area
3. **Total Unfulfilled** - Units/year not fulfilled
4. **Lines at Capacity** - Count of lines at 95%+

### Unfulfilled Demand Chart
- Top 10 models with unfulfilled demand
- Stacked bar (green = fulfilled, red = unfulfilled)
- Shows units/year unfulfilled
- Success message if all fulfilled

### Color Legend
- Blue: 0-70% (Underutilized)
- Green: 70-85% (Optimal)
- Yellow: 85-95% (Caution)
- Orange: 95-100% (At Capacity)
- Red: >100% (Overloaded)
- Dark Red: System Constraint

## Common Patterns

### Modal View
```tsx
{showDashboard && (
  <ValueStreamDashboard
    yearResult={selectedYear}
    onClose={() => setShowDashboard(false)}
  />
)}
```

### Toggle with ResultsPanel
```tsx
const [viewMode, setViewMode] = useState<'dashboard' | 'details'>('dashboard');

return (
  <>
    {viewMode === 'dashboard' && (
      <ValueStreamDashboard
        yearResult={selectedYear}
        onViewDetails={() => setViewMode('details')}
      />
    )}
    {viewMode === 'details' && <ResultsPanel />}
  </>
);
```

### Multi-Year Selection
```tsx
const [yearIndex, setYearIndex] = useState(0);
const selectedYear = results.yearResults[yearIndex];

<ValueStreamDashboard yearResult={selectedYear} />
```

## Accessibility Checklist
- [x] Semantic HTML
- [x] ARIA labels on buttons
- [x] Keyboard navigation
- [x] Color contrast (WCAG AA)
- [x] Screen reader friendly

## Performance
- Uses `useMemo` for expensive calculations
- Minimal re-renders
- Efficient array operations
- Lazy rendering for scrollable content

## Responsive Design
- Mobile-first approach
- Horizontal scroll for value stream flow
- Responsive grid for metric cards
- Max width 7xl (1280px)
- Max height 95vh with scroll

## Customization Points

### Area Flow Order
```tsx
const flowOrder = ['SMT', 'ICT', 'CONFORMAL', 'ROUTER', 'FINAL ASSY'];
```

### Utilization Colors
```tsx
const UTILIZATION_COLORS = {
  underutilized: '#3B82F6',  // Change here
  optimal: '#22C55E',
  // ...
};
```

### Utilization Thresholds
```tsx
if (percent >= 95) return UTILIZATION_COLORS.atCapacity;  // Adjust
if (percent >= 85) return UTILIZATION_COLORS.caution;     // Adjust
if (percent >= 70) return UTILIZATION_COLORS.optimal;     // Adjust
```

## File Locations
- Component: `/src/renderer/features/analysis/components/ValueStreamDashboard.tsx`
- Export: `/src/renderer/features/analysis/index.ts`
- Docs: `/docs/components/ValueStreamDashboard.md`
- Examples: `/docs/examples/analysis-dashboard-integration.tsx`

## Related Components
- `ResultsPanel` - Detailed line-by-line results
- `AnalysisControlBar` - Control panel for running analysis
- `YearRangeSelector` - Year selection UI

## Dependencies
- React 18+
- Tailwind CSS
- lucide-react (icons)
- TypeScript types from `@shared/types`

## Browser Support
Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

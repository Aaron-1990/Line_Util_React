# Value Stream Dashboard Component

## Overview

The `ValueStreamDashboard` is a high-level visualization component that provides production capacity analysis at the value stream level. It shows areas as connected flow boxes, summary metrics, and unfulfilled demand analysis.

## Location

`/src/renderer/features/analysis/components/ValueStreamDashboard.tsx`

## Features

### 1. Value Stream Flow Visualization
- Shows areas as connected boxes in a horizontal flow
- Each box displays:
  - Area name
  - Average utilization percentage
  - Color-coded status (underutilized, optimal, caution, at capacity, overloaded)
  - "Constraint" badge if it's the system bottleneck
- Responsive horizontal scroll for many areas
- Hover animation for better UX

### 2. Summary Metrics
Four key metrics in card format:
- **Demand Fulfillment**: Overall fulfillment percentage
- **System Constraint**: Bottleneck area and reason
- **Total Unfulfilled**: Unfulfilled units per year
- **Lines at Capacity**: Count and percentage of lines at/over 95% utilization

### 3. Unfulfilled Demand Chart
- Horizontal stacked bar chart showing fulfillment per model
- Shows top 10 models with highest unfulfilled demand
- Each bar shows:
  - Model name and area
  - Fulfillment percentage (green portion)
  - Unfulfilled units yearly (red portion)
- If no unfulfilled demand, shows success message

### 4. Color Legend
Interactive legend explaining the utilization color scheme:
- Blue (0-70%): Underutilized
- Green (70-85%): Optimal
- Yellow (85-95%): Caution
- Orange (95-100%): At Capacity
- Red (>100%): Overloaded
- Dark Red: System Constraint

## Props Interface

```typescript
interface ValueStreamDashboardProps {
  yearResult: YearOptimizationResult;
  onClose?: () => void;
  onViewDetails?: () => void;
}
```

### Required Props
- **yearResult**: `YearOptimizationResult` - Complete optimization data for a single year

### Optional Props
- **onClose**: `() => void` - Handler for close button (if provided, shows close button)
- **onViewDetails**: `() => void` - Handler to switch to detailed view (if provided, shows "View Details" button)

## Usage Examples

### Basic Usage
```tsx
import { ValueStreamDashboard } from '@renderer/features/analysis';

function MyComponent() {
  const { results } = useAnalysisStore();
  const selectedYear = results?.yearResults[0];

  if (!selectedYear) return null;

  return (
    <ValueStreamDashboard
      yearResult={selectedYear}
    />
  );
}
```

### With Close Handler
```tsx
function MyComponent() {
  const [showDashboard, setShowDashboard] = useState(false);
  const selectedYear = results?.yearResults[0];

  return (
    <>
      <button onClick={() => setShowDashboard(true)}>
        Show Dashboard
      </button>

      {showDashboard && selectedYear && (
        <ValueStreamDashboard
          yearResult={selectedYear}
          onClose={() => setShowDashboard(false)}
        />
      )}
    </>
  );
}
```

### With View Details Handler
```tsx
function MyComponent() {
  const [viewMode, setViewMode] = useState<'dashboard' | 'details'>('dashboard');
  const selectedYear = results?.yearResults[0];

  if (!selectedYear) return null;

  return (
    <>
      {viewMode === 'dashboard' && (
        <ValueStreamDashboard
          yearResult={selectedYear}
          onClose={() => setViewMode(null)}
          onViewDetails={() => setViewMode('details')}
        />
      )}

      {viewMode === 'details' && (
        <ResultsPanel />
      )}
    </>
  );
}
```

### Multi-Year Selection
```tsx
function MyComponent() {
  const { results } = useAnalysisStore();
  const [selectedYearIndex, setSelectedYearIndex] = useState(0);

  if (!results || !results.yearResults.length) return null;

  const selectedYear = results.yearResults[selectedYearIndex];

  return (
    <div>
      {/* Year Selector */}
      <div className="flex gap-2 mb-4">
        {results.yearResults.map((yr, idx) => (
          <button
            key={yr.year}
            onClick={() => setSelectedYearIndex(idx)}
            className={selectedYearIndex === idx ? 'active' : ''}
          >
            {yr.year}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      <ValueStreamDashboard
        yearResult={selectedYear}
        onViewDetails={() => console.log('Switch to details')}
      />
    </div>
  );
}
```

## Type Dependencies

The component relies on these TypeScript types from `@shared/types`:

```typescript
interface YearOptimizationResult {
  year: number;
  lines: LineUtilizationResult[];
  summary: YearSummary;
  unfulfilledDemand: UnfulfilledDemand[];
  areaSummary: AreaSummary[];
  systemConstraint: SystemConstraint | null;
}

interface AreaSummary {
  area: string;
  totalDemandUnitsDaily: number;
  totalAllocatedUnitsDaily: number;
  totalUnfulfilledUnitsDaily: number;
  fulfillmentPercent: number;
  averageUtilization: number;
  linesAtCapacity: number;
  totalLines: number;
  isSystemConstraint: boolean;
}

interface UnfulfilledDemand {
  modelId: string;
  modelName: string;
  area: string;
  unfulfilledUnitsDaily: number;
  unfulfilledUnitsYearly: number;
  demandUnitsDaily: number;
  fulfillmentPercent: number;
}

interface SystemConstraint {
  area: string;
  reason: 'unfulfilled_demand' | 'highest_utilization';
  utilizationPercent: number;
  unfulfilledUnitsDaily: number;
}
```

## Styling

The component uses:
- **Tailwind CSS** for all styling
- **lucide-react** icons (ArrowRight, AlertTriangle, CheckCircle2, TrendingDown, Activity, X, Eye)
- Responsive design (mobile-first approach)
- Smooth transitions and hover effects
- Fixed overlay pattern (modal-style)

## Accessibility

The component includes:
- Proper semantic HTML structure
- ARIA labels where appropriate (close button)
- Keyboard navigation support (buttons are focusable)
- Color contrast compliance (WCAG AA)
- Screen reader friendly text

## Performance Optimizations

- **useMemo** for expensive calculations:
  - Sorted area summary (flow order)
  - Top unfulfilled models
  - Lines at capacity count
- Minimal re-renders (memoized computations)
- Efficient array operations (no unnecessary loops)
- Lazy rendering (overflow scroll for many items)

## Customization

### Custom Area Flow Order
The component automatically sorts areas by typical production flow:
```typescript
const flowOrder = ['SMT', 'ICT', 'CONFORMAL', 'ROUTER', 'FINAL ASSY', 'ASSEMBLY', 'TEST'];
```

To customize this order, modify the `sortedAreaSummary` useMemo in the component.

### Custom Colors
To change the utilization color scheme, modify the `UTILIZATION_COLORS` constant:
```typescript
const UTILIZATION_COLORS = {
  underutilized: '#3B82F6',  // Blue: 0-70%
  optimal: '#22C55E',        // Green: 70-85%
  caution: '#F59E0B',        // Yellow: 85-95%
  atCapacity: '#F97316',     // Orange: 95-100%
  overloaded: '#EF4444',     // Red: >100%
  bottleneck: '#991B1B',     // Dark Red: system constraint
};
```

### Custom Thresholds
To adjust utilization thresholds, modify the `getUtilizationColor` function:
```typescript
function getUtilizationColor(percent: number, isConstraint: boolean): string {
  if (isConstraint) return UTILIZATION_COLORS.bottleneck;
  if (percent > 100) return UTILIZATION_COLORS.overloaded;
  if (percent >= 95) return UTILIZATION_COLORS.atCapacity;  // Change threshold here
  if (percent >= 85) return UTILIZATION_COLORS.caution;     // Change threshold here
  if (percent >= 70) return UTILIZATION_COLORS.optimal;     // Change threshold here
  return UTILIZATION_COLORS.underutilized;
}
```

## Testing

### Unit Test Structure
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ValueStreamDashboard } from './ValueStreamDashboard';

describe('ValueStreamDashboard', () => {
  const mockYearResult = {
    year: 2026,
    lines: [/* mock data */],
    summary: {/* mock data */},
    unfulfilledDemand: [/* mock data */],
    areaSummary: [/* mock data */],
    systemConstraint: null,
  };

  it('renders value stream flow', () => {
    render(<ValueStreamDashboard yearResult={mockYearResult} />);
    expect(screen.getByText('Value Stream Flow')).toBeInTheDocument();
  });

  it('shows summary metrics', () => {
    render(<ValueStreamDashboard yearResult={mockYearResult} />);
    expect(screen.getByText('Demand Fulfillment')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const handleClose = jest.fn();
    render(<ValueStreamDashboard yearResult={mockYearResult} onClose={handleClose} />);

    fireEvent.click(screen.getByLabelText('Close'));
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onViewDetails when view details button clicked', () => {
    const handleViewDetails = jest.fn();
    render(<ValueStreamDashboard yearResult={mockYearResult} onViewDetails={handleViewDetails} />);

    fireEvent.click(screen.getByText('View Details'));
    expect(handleViewDetails).toHaveBeenCalled();
  });

  it('shows success message when no unfulfilled demand', () => {
    const mockResult = { ...mockYearResult, unfulfilledDemand: [] };
    render(<ValueStreamDashboard yearResult={mockResult} />);

    expect(screen.getByText('All Demand Fulfilled!')).toBeInTheDocument();
  });
});
```

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Known Limitations

1. **Area Flow Order**: Currently uses predefined flow order. Future enhancement could allow user-defined flows.
2. **Top 10 Unfulfilled**: Only shows top 10 models. Could add pagination/expansion for more.
3. **Fixed Size**: Modal uses fixed max-width. Could add fullscreen mode for very large datasets.
4. **Single Year**: Shows one year at a time. Multi-year comparison view is a future enhancement.

## Future Enhancements

- [ ] Export dashboard as PDF/image
- [ ] Drilldown to specific area details
- [ ] Multi-year comparison view (side-by-side)
- [ ] Customizable area flow order (drag-and-drop)
- [ ] Animated transitions between years
- [ ] Tooltips on hover (detailed metrics)
- [ ] Fullscreen mode
- [ ] Print-friendly version

## Related Components

- **ResultsPanel**: Detailed line-by-line results table
- **AnalysisControlBar**: Control panel for running analysis
- **YearRangeSelector**: Year selection UI

## Support

For questions or issues with this component, contact:
- **Developer**: Aaron Zapata
- **Team**: Industrial Engineering, BorgWarner

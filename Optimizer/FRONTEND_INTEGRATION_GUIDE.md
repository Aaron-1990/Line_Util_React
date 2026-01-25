# Frontend Integration Guide - Optimizer v1.1

## Overview

The optimizer now provides detailed capacity analysis including unfulfilled demand tracking and bottleneck detection. This guide shows how to integrate these features into the Electron app.

## New Output Fields

### 1. Unfulfilled Demand Array

**Path:** `yearResults[i].unfulfilledDemand`

**Type:** Array of objects (empty if all demand fulfilled)

```typescript
interface UnfulfilledDemand {
  modelId: string;
  modelName: string;
  area: string;
  unfulfilledUnitsDaily: number;
  unfulfilledUnitsYearly: number;
  demandUnitsDaily: number;
  fulfillmentPercent: number;
}
```

**Example:**
```json
[
  {
    "modelId": "model-a",
    "modelName": "Model A",
    "area": "Final Assembly",
    "unfulfilledUnitsDaily": 150.73,
    "unfulfilledUnitsYearly": 36176.0,
    "demandUnitsDaily": 208.33,
    "fulfillmentPercent": 27.65
  }
]
```

### 2. Area Summary Array

**Path:** `yearResults[i].areaSummary`

**Type:** Array of objects (one per area)

```typescript
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
```

**Example:**
```json
[
  {
    "area": "Final Assembly",
    "totalDemandUnitsDaily": 333.33,
    "totalAllocatedUnitsDaily": 57.6,
    "totalUnfulfilledUnitsDaily": 275.73,
    "fulfillmentPercent": 17.28,
    "averageUtilization": 100.0,
    "linesAtCapacity": 1,
    "totalLines": 1,
    "isSystemConstraint": true
  }
]
```

### 3. System Constraint Object

**Path:** `yearResults[i].systemConstraint`

**Type:** Object (always present)

```typescript
interface SystemConstraint {
  area: string;
  reason: 'unfulfilled_demand' | 'highest_utilization';
  utilizationPercent: number;
  unfulfilledUnitsDaily: number;
}
```

**Example:**
```json
{
  "area": "Final Assembly",
  "reason": "unfulfilled_demand",
  "utilizationPercent": 100.0,
  "unfulfilledUnitsDaily": 275.73
}
```

### 4. Enhanced Summary Fields

**Path:** `yearResults[i].summary`

**New fields added to existing summary:**

```typescript
interface Summary {
  // ... existing fields ...
  totalUnfulfilledUnitsDaily: number;
  totalUnfulfilledUnitsYearly: number;
  overallFulfillmentPercent: number;
  systemConstraintArea: string | null;
}
```

## UI Integration Suggestions

### 1. Results Panel - Bottleneck Alert

Display prominent alert if capacity shortage detected:

```tsx
const ResultsPanel: React.FC<{ results: YearResult }> = ({ results }) => {
  const hasCapacityIssue =
    results.systemConstraint.reason === 'unfulfilled_demand';

  return (
    <div>
      {hasCapacityIssue && (
        <Alert severity="warning">
          <AlertTitle>Capacity Shortage Detected</AlertTitle>
          <strong>Bottleneck:</strong> {results.systemConstraint.area}
          <br />
          <strong>Unfulfilled:</strong>{' '}
          {results.systemConstraint.unfulfilledUnitsDaily.toFixed(1)} units/day
          <br />
          <strong>Overall Fulfillment:</strong>{' '}
          {results.summary.overallFulfillmentPercent.toFixed(1)}%
        </Alert>
      )}

      {/* Rest of results display */}
    </div>
  );
};
```

### 2. Area Summary Table

Display capacity metrics by area:

```tsx
const AreaSummaryTable: React.FC<{ areas: AreaSummary[] }> = ({ areas }) => {
  return (
    <table>
      <thead>
        <tr>
          <th>Area</th>
          <th>Demand</th>
          <th>Allocated</th>
          <th>Unfulfilled</th>
          <th>Fulfillment</th>
          <th>Avg Utilization</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {areas.map((area) => (
          <tr key={area.area} className={area.isSystemConstraint ? 'constraint' : ''}>
            <td>
              {area.isSystemConstraint && '🔴 '}
              {area.area}
            </td>
            <td>{area.totalDemandUnitsDaily.toFixed(1)}</td>
            <td>{area.totalAllocatedUnitsDaily.toFixed(1)}</td>
            <td className={area.totalUnfulfilledUnitsDaily > 0 ? 'warning' : ''}>
              {area.totalUnfulfilledUnitsDaily.toFixed(1)}
            </td>
            <td>
              <ProgressBar
                value={area.fulfillmentPercent}
                color={area.fulfillmentPercent < 90 ? 'warning' : 'success'}
              />
              {area.fulfillmentPercent.toFixed(1)}%
            </td>
            <td>{area.averageUtilization.toFixed(1)}%</td>
            <td>
              {area.linesAtCapacity > 0 && (
                <Chip
                  label={`${area.linesAtCapacity}/${area.totalLines} at capacity`}
                  color="warning"
                  size="small"
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

### 3. Unfulfilled Demand List

Show details of models with capacity shortage:

```tsx
const UnfulfilledDemandPanel: React.FC<{
  unfulfilled: UnfulfilledDemand[]
}> = ({ unfulfilled }) => {
  if (unfulfilled.length === 0) {
    return (
      <Alert severity="success">
        All demand fulfilled - no capacity shortages detected.
      </Alert>
    );
  }

  // Group by area
  const byArea = unfulfilled.reduce((acc, item) => {
    if (!acc[item.area]) acc[item.area] = [];
    acc[item.area].push(item);
    return acc;
  }, {} as Record<string, UnfulfilledDemand[]>);

  return (
    <div>
      <Alert severity="warning">
        <strong>{unfulfilled.length}</strong> model(s) have unfulfilled demand
      </Alert>

      {Object.entries(byArea).map(([area, items]) => (
        <Accordion key={area}>
          <AccordionSummary>
            <Typography>
              {area} ({items.length} model{items.length > 1 ? 's' : ''})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Demand</th>
                  <th>Unfulfilled (Daily)</th>
                  <th>Unfulfilled (Yearly)</th>
                  <th>Fulfillment</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.modelId}>
                    <td>{item.modelName}</td>
                    <td>{item.demandUnitsDaily.toFixed(1)}</td>
                    <td className="warning">
                      {item.unfulfilledUnitsDaily.toFixed(1)}
                    </td>
                    <td className="warning">
                      {item.unfulfilledUnitsYearly.toFixed(0)}
                    </td>
                    <td>
                      <ProgressBar value={item.fulfillmentPercent} />
                      {item.fulfillmentPercent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AccordionDetails>
        </Accordion>
      ))}
    </div>
  );
};
```

### 4. Summary Statistics Card

Enhanced summary with fulfillment metrics:

```tsx
const SummaryCard: React.FC<{ summary: Summary }> = ({ summary }) => {
  const hasUnfulfilled = summary.totalUnfulfilledUnitsDaily > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overall Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Metric
              label="Average Utilization"
              value={`${summary.averageUtilization.toFixed(1)}%`}
            />
          </Grid>
          <Grid item xs={6}>
            <Metric
              label="Overall Fulfillment"
              value={`${summary.overallFulfillmentPercent.toFixed(1)}%`}
              color={summary.overallFulfillmentPercent < 90 ? 'warning' : 'success'}
            />
          </Grid>

          {hasUnfulfilled && (
            <>
              <Grid item xs={6}>
                <Metric
                  label="Unfulfilled (Daily)"
                  value={`${summary.totalUnfulfilledUnitsDaily.toFixed(1)} units`}
                  color="error"
                />
              </Grid>
              <Grid item xs={6}>
                <Metric
                  label="Unfulfilled (Yearly)"
                  value={`${summary.totalUnfulfilledUnitsYearly.toFixed(0)} units`}
                  color="error"
                />
              </Grid>
              <Grid item xs={12}>
                <Metric
                  label="System Constraint"
                  value={summary.systemConstraintArea || 'None'}
                  color="warning"
                />
              </Grid>
            </>
          )}

          <Grid item xs={4}>
            <Metric
              label="Balanced Lines"
              value={summary.balancedLines}
            />
          </Grid>
          <Grid item xs={4}>
            <Metric
              label="Overloaded Lines"
              value={summary.overloadedLines}
              color={summary.overloadedLines > 0 ? 'error' : 'default'}
            />
          </Grid>
          <Grid item xs={4}>
            <Metric
              label="Underutilized Lines"
              value={summary.underutilizedLines}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
```

### 5. Canvas Visualization

Highlight bottleneck area on production canvas:

```tsx
const ProductionCanvas: React.FC<{
  lines: Line[],
  systemConstraint: SystemConstraint
}> = ({ lines, systemConstraint }) => {
  return (
    <ReactFlow>
      {lines.map((line) => {
        const isInConstraintArea = line.area === systemConstraint.area;
        const isBottleneck =
          isInConstraintArea &&
          systemConstraint.reason === 'unfulfilled_demand';

        return (
          <Node
            key={line.lineId}
            data={{
              ...line,
              isBottleneck,
              borderColor: isBottleneck ? 'red' : 'default'
            }}
            className={isBottleneck ? 'bottleneck-node' : ''}
          />
        );
      })}
    </ReactFlow>
  );
};
```

## TypeScript Type Definitions

Add to `src/shared/types/index.ts`:

```typescript
export interface UnfulfilledDemand {
  modelId: string;
  modelName: string;
  area: string;
  unfulfilledUnitsDaily: number;
  unfulfilledUnitsYearly: number;
  demandUnitsDaily: number;
  fulfillmentPercent: number;
}

export interface AreaSummary {
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

export interface SystemConstraint {
  area: string;
  reason: 'unfulfilled_demand' | 'highest_utilization';
  utilizationPercent: number;
  unfulfilledUnitsDaily: number;
}

// Extend existing YearResult interface
export interface YearResult {
  year: number;
  lines: LineResult[];
  unfulfilledDemand: UnfulfilledDemand[];  // NEW
  areaSummary: AreaSummary[];              // NEW
  systemConstraint: SystemConstraint;       // NEW
  summary: {
    // ... existing fields ...
    totalUnfulfilledUnitsDaily: number;       // NEW
    totalUnfulfilledUnitsYearly: number;      // NEW
    overallFulfillmentPercent: number;        // NEW
    systemConstraintArea: string | null;      // NEW
  };
}
```

## Example Usage

```typescript
// In your analysis results handler
const handleAnalysisComplete = (results: OptimizationResults) => {
  const yearResult = results.yearResults[0];

  // Check for capacity issues
  if (yearResult.systemConstraint.reason === 'unfulfilled_demand') {
    showNotification({
      type: 'warning',
      title: 'Capacity Shortage Detected',
      message: `${yearResult.systemConstraint.area} is the bottleneck with ${yearResult.systemConstraint.unfulfilledUnitsDaily.toFixed(1)} units/day unfulfilled.`
    });
  }

  // Display area summary
  setAreaSummary(yearResult.areaSummary);

  // Display unfulfilled demand (if any)
  if (yearResult.unfulfilledDemand.length > 0) {
    setUnfulfilledDemand(yearResult.unfulfilledDemand);
    setShowCapacityWarning(true);
  }

  // Update overall metrics
  setOverallFulfillment(yearResult.summary.overallFulfillmentPercent);
};
```

## Recommended UI Flow

1. **Run Analysis** → User clicks "Run Analysis"
2. **Show Progress** → Display optimization progress
3. **Check Results** → Analyze systemConstraint and unfulfilledDemand
4. **Alert User** → If capacity shortage, show prominent warning
5. **Display Details** → Show area summary table
6. **Expand Issues** → Allow user to drill down into unfulfilled demand
7. **Export Report** → Include capacity analysis in Excel export

## CSS Styling Suggestions

```css
/* Bottleneck highlight */
.bottleneck-node {
  border: 2px solid #d32f2f;
  box-shadow: 0 0 10px rgba(211, 47, 47, 0.3);
}

/* Area summary table */
.constraint {
  background-color: #fff3e0;
  font-weight: 600;
}

.warning {
  color: #f57c00;
}

/* Progress bars */
.fulfillment-bar.low {
  background-color: #f44336;
}

.fulfillment-bar.medium {
  background-color: #ff9800;
}

.fulfillment-bar.high {
  background-color: #4caf50;
}
```

## Testing

```typescript
// Mock data for testing
const mockResultsWithShortage: YearResult = {
  year: 2024,
  lines: [...],
  unfulfilledDemand: [
    {
      modelId: 'model-a',
      modelName: 'Model A',
      area: 'Final Assembly',
      unfulfilledUnitsDaily: 150.73,
      unfulfilledUnitsYearly: 36176.0,
      demandUnitsDaily: 208.33,
      fulfillmentPercent: 27.65
    }
  ],
  areaSummary: [
    {
      area: 'Final Assembly',
      totalDemandUnitsDaily: 333.33,
      totalAllocatedUnitsDaily: 57.6,
      totalUnfulfilledUnitsDaily: 275.73,
      fulfillmentPercent: 17.28,
      averageUtilization: 100.0,
      linesAtCapacity: 1,
      totalLines: 1,
      isSystemConstraint: true
    }
  ],
  systemConstraint: {
    area: 'Final Assembly',
    reason: 'unfulfilled_demand',
    utilizationPercent: 100.0,
    unfulfilledUnitsDaily: 275.73
  },
  summary: {
    totalLines: 3,
    totalAreas: 2,
    averageUtilization: 100.0,
    totalUnfulfilledUnitsDaily: 445.87,
    totalUnfulfilledUnitsYearly: 107008.0,
    overallFulfillmentPercent: 33.12,
    systemConstraintArea: 'Final Assembly',
    // ... other fields
  }
};
```

## Migration Checklist

- [ ] Add TypeScript type definitions
- [ ] Update results parser to handle new fields
- [ ] Create AreaSummaryTable component
- [ ] Create UnfulfilledDemandPanel component
- [ ] Add bottleneck alert to ResultsPanel
- [ ] Update SummaryCard with new metrics
- [ ] Highlight constraint area in canvas
- [ ] Add CSS styling for warnings/alerts
- [ ] Test with both fulfilled/unfulfilled scenarios
- [ ] Update Excel export to include new fields
- [ ] Add user documentation

## Questions?

Contact: Aaron Zapata (Supervisor Industrial Engineering)

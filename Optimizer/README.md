# Line Utilization Optimizer

Python-based optimizer that calculates production line utilization, identifies bottlenecks, and tracks unfulfilled demand.

## Features

- **Per-Area Optimization**: Each production area (SMT, Final Assembly, etc.) processes the full demand independently
- **Priority-Based Distribution**: Models are allocated to lines based on compatibility priority levels
- **Unfulfilled Demand Tracking**: Identifies models with demand exceeding available capacity
- **Bottleneck Detection**: Automatically identifies system constraints
- **Multi-Year Support**: Process multiple years of production data in a single run

## Usage

```bash
python optimizer.py --input data.json --output results.json
```

### Input JSON Structure

```json
{
  "lines": [
    {
      "id": "line-smt-1",
      "name": "SMT-1",
      "area": "SMT",
      "timeAvailableDaily": 28800
    }
  ],
  "models": [
    {
      "id": "model-a",
      "name": "Model A",
      "customer": "Customer 1",
      "program": "Program 1",
      "family": "Family 1"
    }
  ],
  "volumes": [
    {
      "modelId": "model-a",
      "modelName": "Model A",
      "year": 2024,
      "volume": 50000,
      "operationsDays": 240
    }
  ],
  "compatibilities": [
    {
      "lineId": "line-smt-1",
      "lineName": "SMT-1",
      "modelId": "model-a",
      "modelName": "Model A",
      "cycleTime": 300,
      "efficiency": 85,
      "priority": 1
    }
  ],
  "selectedYears": [2024, 2025]
}
```

### Output JSON Structure

```json
{
  "metadata": {
    "version": "1.0",
    "timestamp": "2026-01-25T00:45:08.297488",
    "inputYears": [2024],
    "executionTimeMs": 0
  },
  "yearResults": [
    {
      "year": 2024,
      "lines": [...],
      "unfulfilledDemand": [...],
      "areaSummary": [...],
      "systemConstraint": {...},
      "summary": {...}
    }
  ],
  "overallSummary": {...}
}
```

## Key Output Fields

### 1. Unfulfilled Demand (Per Model Per Area)

Tracks models where demand exceeds available capacity:

```json
{
  "modelId": "model-a",
  "modelName": "Model A",
  "area": "Final Assembly",
  "unfulfilledUnitsDaily": 150.73,
  "unfulfilledUnitsYearly": 36176.0,
  "demandUnitsDaily": 208.33,
  "fulfillmentPercent": 27.65
}
```

**Empty array** when all demand is fulfilled.

### 2. Area Summary

Aggregates metrics for each production area:

```json
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
```

**Fields:**
- `totalDemandUnitsDaily`: Total demand for all models in this area
- `totalAllocatedUnitsDaily`: Total units allocated across all lines
- `totalUnfulfilledUnitsDaily`: Demand - Allocated
- `fulfillmentPercent`: (Allocated / Demand) × 100
- `averageUtilization`: Average utilization across all lines in area
- `linesAtCapacity`: Count of lines with utilization ≥ 95%
- `isSystemConstraint`: True if this area is the bottleneck

### 3. System Constraint (Bottleneck)

Identifies the production area limiting overall capacity:

```json
{
  "area": "Final Assembly",
  "reason": "unfulfilled_demand",
  "utilizationPercent": 100.0,
  "unfulfilledUnitsDaily": 275.73
}
```

**Constraint Logic:**
1. If any area has unfulfilled demand → Area with highest unfulfilled demand
2. If all demand fulfilled → Area with highest average utilization

**Reasons:**
- `"unfulfilled_demand"`: Area has capacity shortage
- `"highest_utilization"`: Area is most heavily loaded (no shortage)

### 4. Summary (Overall Metrics)

Extended with demand tracking fields:

```json
{
  "totalLines": 3,
  "totalAreas": 2,
  "averageUtilization": 100.0,
  "overloadedLines": 0,
  "balancedLines": 3,
  "underutilizedLines": 0,
  "totalModels": 2,
  "assignedModels": 2,
  "unassignedModels": 0,
  "totalAllocatedUnits": 220.8,
  "demandFulfillmentPercent": 27.77,
  "totalUnfulfilledUnitsDaily": 445.87,
  "totalUnfulfilledUnitsYearly": 107008.0,
  "overallFulfillmentPercent": 33.12,
  "systemConstraintArea": "Final Assembly"
}
```

**New Fields:**
- `totalUnfulfilledUnitsDaily`: Sum of unfulfilled demand across all areas
- `totalUnfulfilledUnitsYearly`: Daily × operations days
- `overallFulfillmentPercent`: (Allocated / Total Demand) × 100 across all areas
- `systemConstraintArea`: Name of bottleneck area

## Algorithm

### Per-Area Distribution

Each production area independently processes the **full demand** for all compatible models:

1. Group production lines by area (SMT, Final Assembly, etc.)
2. For each area:
   - Collect all line-model compatibilities
   - Process models by priority level (1, 2, 3, ...)
   - Distribute each model's demand across compatible lines
   - Track remaining demand after allocation

### Priority-Based Allocation

Models are assigned to lines based on `priority` values:

- **Priority 1** models allocated first
- **Priority 2** models allocated second
- And so on...

Within each priority level, models are processed in order, and each model is distributed across all compatible lines before moving to the next model.

### Utilization Calculation

For each line:

```python
adjusted_cycle_time = cycle_time / (efficiency / 100)
time_required = allocated_units × adjusted_cycle_time
utilization = (time_used / time_available) × 100
```

### Bottleneck Detection

After all allocations:

1. Calculate unfulfilled demand per area
2. If unfulfilled demand exists:
   - **Constraint** = Area with highest unfulfilled demand
3. Else:
   - **Constraint** = Area with highest average utilization

## Example Scenarios

### Scenario 1: No Unfulfilled Demand

All demand is met. System constraint is the area with highest utilization (closest to capacity).

```json
{
  "unfulfilledDemand": [],
  "systemConstraint": {
    "area": "SMT",
    "reason": "highest_utilization",
    "utilizationPercent": 90.69,
    "unfulfilledUnitsDaily": 0
  }
}
```

### Scenario 2: Capacity Shortage

Final Assembly has insufficient capacity. It becomes the system constraint.

```json
{
  "unfulfilledDemand": [
    {
      "modelId": "model-a",
      "area": "Final Assembly",
      "unfulfilledUnitsDaily": 150.73,
      "fulfillmentPercent": 27.65
    }
  ],
  "systemConstraint": {
    "area": "Final Assembly",
    "reason": "unfulfilled_demand",
    "utilizationPercent": 100.0,
    "unfulfilledUnitsDaily": 275.73
  }
}
```

### Scenario 3: Multiple Areas with Unfulfilled Demand

Both SMT and Final Assembly have capacity shortages. The area with **higher unfulfilled demand** is the constraint.

```json
{
  "unfulfilledDemand": [
    { "area": "SMT", "unfulfilledUnitsDaily": 170.13 },
    { "area": "Final Assembly", "unfulfilledUnitsDaily": 275.73 }
  ],
  "systemConstraint": {
    "area": "Final Assembly",
    "reason": "unfulfilled_demand",
    "unfulfilledUnitsDaily": 275.73
  }
}
```

## Testing

### Test Files

- `test_priority_input.json` - Basic priority distribution test (all demand fulfilled)
- `test_unfulfilled_input.json` - Capacity shortage test (unfulfilled demand)

### Run Tests

```bash
# Test 1: Priority distribution (no shortage)
python optimizer.py --input test_priority_input.json --output test_priority_output.json

# Test 2: Capacity shortage (unfulfilled demand)
python optimizer.py --input test_unfulfilled_input.json --output test_unfulfilled_output.json
```

### Verify Results

```python
import json

data = json.load(open('test_unfulfilled_output.json'))
year_result = data['yearResults'][0]

# Check unfulfilled demand
print(f"Unfulfilled demand entries: {len(year_result['unfulfilledDemand'])}")

# Check system constraint
constraint = year_result['systemConstraint']
print(f"Bottleneck: {constraint['area']} ({constraint['reason']})")

# Check area summary
for area in year_result['areaSummary']:
    print(f"{area['area']}: {area['fulfillmentPercent']:.1f}% fulfilled")
```

## Changelog

### v1.1 (2026-01-25)

**New Features:**
- Track unfulfilled demand per model per area
- Calculate area-level summaries (demand, allocated, fulfillment %)
- Identify system constraint (bottleneck) automatically
- Add overall fulfillment percentage
- Report lines at capacity per area

**Output Changes:**
- Added `unfulfilledDemand` array to year results
- Added `areaSummary` array to year results
- Added `systemConstraint` object to year results
- Added `totalUnfulfilledUnitsDaily`, `totalUnfulfilledUnitsYearly`, `overallFulfillmentPercent`, `systemConstraintArea` to summary

**Backward Compatibility:**
- All existing fields preserved
- New fields added without breaking existing structure

## Requirements

- Python 3.7+
- No external dependencies (uses standard library only)

## License

Internal tool for BorgWarner production optimization.

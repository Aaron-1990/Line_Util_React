# Optimizer Algorithm Changelog

## 2026-01-25: Unfulfilled Demand Tracking & Bottleneck Detection

### Purpose
Add visibility into capacity constraints by tracking unfulfilled demand and automatically identifying system bottlenecks.

### New Features

#### 1. Unfulfilled Demand Tracking (Per Model Per Area)
After allocating models to lines in each area, the optimizer now tracks any remaining demand that couldn't be fulfilled due to capacity constraints.

**Output Structure:**
```json
{
  "unfulfilledDemand": [
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
}
```

Empty array when all demand is fulfilled.

#### 2. Area-Level Summary
Aggregates key metrics for each production area:

**Fields:**
- `totalDemandUnitsDaily`: Total demand for all models in this area
- `totalAllocatedUnitsDaily`: Total units successfully allocated
- `totalUnfulfilledUnitsDaily`: Demand minus allocated
- `fulfillmentPercent`: Percentage of demand met
- `averageUtilization`: Average line utilization in area
- `linesAtCapacity`: Count of lines ≥ 95% utilization
- `totalLines`: Total lines in area
- `isSystemConstraint`: True if this area is the bottleneck

#### 3. System Constraint (Bottleneck) Detection
Automatically identifies the production area limiting overall capacity.

**Logic:**
1. If any area has unfulfilled demand → Area with highest unfulfilled demand
2. If all demand fulfilled → Area with highest average utilization

**Output:**
```json
{
  "systemConstraint": {
    "area": "Final Assembly",
    "reason": "unfulfilled_demand",
    "utilizationPercent": 100.0,
    "unfulfilledUnitsDaily": 275.73
  }
}
```

**Reasons:**
- `"unfulfilled_demand"`: Area has insufficient capacity
- `"highest_utilization"`: Area is most heavily loaded (no capacity shortage)

#### 4. Enhanced Summary Metrics
Added to existing `summary` object:
- `totalUnfulfilledUnitsDaily`: Total unfulfilled across all areas
- `totalUnfulfilledUnitsYearly`: Daily × operations days
- `overallFulfillmentPercent`: Global fulfillment rate
- `systemConstraintArea`: Name of bottleneck area

### Implementation Details

**File: `optimizer.py`**

**Added:**
- `unfulfilled_demand_tracker` dict (line 223): Tracks unfulfilled demand per area per model
- Unfulfilled demand calculation after area processing (lines 302-311)
- Unfulfilled demand list builder (lines 396-417)
- Area summary calculator (lines 419-473)
- System constraint detector (lines 475-512)
- Overall metrics calculator (lines 514-527)

**Modified:**
- `run_optimization_for_year()` return structure (lines 529-552)
- Added new fields to output while preserving existing structure
- Updated docstring (lines 18-27)

### Test Coverage

**Test File: `test_unfulfilled_input.json`**
- 3 lines (2 SMT, 1 Final Assembly)
- 2 models with high demand (exceeds capacity)
- Validates unfulfilled demand tracking
- Confirms bottleneck detection (Final Assembly has highest unfulfilled)

**Results:**
```
SMT fulfillment: 48.96%
Final Assembly fulfillment: 17.28%
System Constraint: Final Assembly (unfulfilled_demand)
```

### Backward Compatibility

All existing output fields preserved:
- `lines` array unchanged
- `summary` existing fields unchanged
- New fields added without breaking structure

Existing integrations continue to work without modification.

### Business Value

Production planners can now:
- **Identify bottlenecks**: See which area limits overall capacity
- **Quantify shortages**: Know exact unfulfilled demand per model per area
- **Prioritize investments**: Focus capacity improvements on constraint areas
- **Track fulfillment**: Monitor demand satisfaction by area
- **Detect capacity issues**: See which lines are at capacity (≥95%)

### Example Scenarios

**Scenario 1: No Capacity Shortage**
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

**Scenario 2: Capacity Shortage**
```json
{
  "unfulfilledDemand": [
    { "area": "Final Assembly", "unfulfilledUnitsDaily": 275.73 }
  ],
  "systemConstraint": {
    "area": "Final Assembly",
    "reason": "unfulfilled_demand",
    "unfulfilledUnitsDaily": 275.73
  }
}
```

---

## 2026-01-22: Per-Area Demand Processing Fix

### Problem
The original algorithm treated all production lines as alternatives and consumed demand globally. When a product (e.g., PIM 400V with 223 units/day) was assigned to a line in one area (Conformal 1), the global demand was reduced to zero, leaving no demand for lines in other areas (Router).

This was incorrect for sequential manufacturing processes where products must go through ALL areas in sequence (SMT → ICT → Conformal → Router → Final Assembly).

### Solution
Modified the algorithm to process demand **per area** instead of globally:

1. **Group lines by area** (lines 205-215)
   - Lines are now organized by their area attribute
   - Each area is processed independently

2. **Independent demand tracking** (lines 217-256)
   - Each area maintains its own `remaining_demand_in_area` dictionary
   - Every area starts with the FULL demand for all models
   - Demand is only consumed within the area

3. **Sequential flow support**
   - The same product can now be assigned to lines in multiple areas
   - Each area calculates its own utilization based on its capacity and cycle times
   - Products flow through all areas as in real manufacturing

### Key Changes in `optimizer.py`

#### Function: `run_optimization_for_year()`

**Added:**
- Area grouping logic (lines 205-215)
- Per-area processing loop (lines 217-256)
- Per-area demand tracking
- Area-specific fulfillment calculation (lines 277-294)

**Modified:**
- Algorithm documentation (lines 180-189)
- Summary statistics calculation (lines 258-323)
- Added `totalAreas` to summary output (line 346)
- Added `totalModels` and `assignedModels` to summary (lines 351-352)

### Verification

Test scenario:
- **Product**: PIM 400V (223 units/day)
- **Areas**: Conformal, Router
- **Lines**:
  - Conformal 1 (cycle time: 60s, efficiency: 85%)
  - Router 1 (cycle time: 45s, efficiency: 90%)
  - Router 2 (cycle time: 45s, efficiency: 90%, priority: 2)

**Before fix:**
- Conformal 1: 223 units allocated
- Router 1: 0 units (no demand remaining)
- Router 2: 0 units (no demand remaining)

**After fix:**
- Conformal 1: 223 units allocated (72.88% utilization)
- Router 1: 223 units allocated (51.62% utilization)
- Router 2: 0 units (Router 1 has higher priority)

### Impact

- **Correct utilization**: Each area now shows realistic utilization based on assigned products
- **Sequential processing**: Products correctly flow through all required areas
- **Priority preserved**: Within each area, priority-based allocation still works
- **Output structure**: Unchanged - fully backward compatible with frontend
- **Performance**: No significant impact - O(areas × lines × models) complexity

### Business Value

Enables accurate line utilization analysis for sequential manufacturing processes. Production planners can now:
- See which areas are bottlenecks
- Identify underutilized lines in specific areas
- Plan capacity improvements per area
- Validate that products go through all required processes

### Technical Notes

- Each area processes the full demand independently
- `totalAllocatedUnits` in summary now represents sum across all areas (not just global demand)
- Demand fulfillment is calculated as average across all areas
- Unassigned models are those that appear in no area assignments
- The algorithm maintains transactional consistency per area

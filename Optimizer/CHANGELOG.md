# Optimizer Algorithm Changelog

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

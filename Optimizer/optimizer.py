#!/usr/bin/env python3
"""
Line Utilization Optimizer
Reads JSON input from Electron app and calculates line utilization percentages.

Usage:
    python optimizer.py --input data.json --output results.json

Input JSON structure:
{
    "lines": [{ "id", "name", "area", "timeAvailableDaily" }],
    "models": [{ "id", "name", "customer", "program", "family" }],
    "volumes": [{ "modelId", "modelName", "year", "volume", "operationsDays" }],
    "compatibilities": [{ "lineId", "lineName", "modelId", "modelName", "cycleTime", "efficiency", "priority" }],
    "selectedYears": [2024, 2025, ...]
}

Output JSON structure:
{
    "metadata": { "version", "timestamp", "inputYears", "executionTimeMs" },
    "yearResults": [{
        "year": 2024,
        "lines": [{ "lineId", "lineName", "area", "utilizationPercent", "assignments": [...] }],
        "unfulfilledDemand": [{ "modelId", "modelName", "area", "unfulfilledUnitsDaily", "unfulfilledUnitsYearly", "demandUnitsDaily", "fulfillmentPercent" }],
        "areaSummary": [{ "area", "totalDemandUnitsDaily", "totalAllocatedUnitsDaily", "totalUnfulfilledUnitsDaily", "fulfillmentPercent", "averageUtilization", "linesAtCapacity", "totalLines", "isSystemConstraint" }],
        "systemConstraint": { "area", "reason", "utilizationPercent", "unfulfilledUnitsDaily" },
        "summary": { "totalLines", "averageUtilization", "totalUnfulfilledUnitsDaily", "totalUnfulfilledUnitsYearly", "overallFulfillmentPercent", "systemConstraintArea", ... }
    }],
    "overallSummary": { ... }
}
"""

import json
import argparse
import sys
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict


@dataclass
class ModelAssignment:
    """Represents a model assigned to a production line"""
    modelId: str
    modelName: str
    allocatedUnitsDaily: float
    demandUnitsDaily: float
    timeRequiredSeconds: float
    cycleTime: float
    efficiency: float
    priority: int
    fulfillmentPercent: float


@dataclass
class ProductionLine:
    """Represents a production line with its capacity and assigned models"""
    id: str
    name: str
    area: str
    timeAvailableDaily: float
    timeUsedDaily: float = 0.0
    assignments: List[ModelAssignment] = field(default_factory=list)

    @property
    def utilizationPercent(self) -> float:
        if self.timeAvailableDaily == 0:
            return 0.0
        return (self.timeUsedDaily / self.timeAvailableDaily) * 100

    def add_model(self, model_id: str, model_name: str, daily_demand: float,
                  cycle_time: float, efficiency: float, priority: int) -> float:
        """
        Add a model to this line, calculating how many units can be produced.

        Args:
            model_id: Model identifier
            model_name: Model name
            daily_demand: Daily demand in units
            cycle_time: Cycle time in seconds per unit
            efficiency: Line efficiency for this model (0-100)
            priority: Priority (lower = higher priority)

        Returns:
            Number of units allocated to this line
        """
        # Calculate adjusted cycle time (accounting for efficiency/OEE)
        adjusted_cycle_time = cycle_time / (efficiency / 100.0)

        # Calculate available time
        available_time = self.timeAvailableDaily - self.timeUsedDaily

        if available_time <= 0:
            return 0.0

        # Calculate how many units we can produce
        max_units = available_time / adjusted_cycle_time
        allocated_units = min(max_units, daily_demand)

        if allocated_units <= 0:
            return 0.0

        # Calculate time used
        time_used = allocated_units * adjusted_cycle_time
        self.timeUsedDaily += time_used

        # Calculate fulfillment percentage
        fulfillment = (allocated_units / daily_demand * 100) if daily_demand > 0 else 100.0

        # Create assignment record
        assignment = ModelAssignment(
            modelId=model_id,
            modelName=model_name,
            allocatedUnitsDaily=round(allocated_units, 2),
            demandUnitsDaily=round(daily_demand, 2),
            timeRequiredSeconds=round(time_used, 2),
            cycleTime=cycle_time,
            efficiency=efficiency,
            priority=priority,
            fulfillmentPercent=round(fulfillment, 2)
        )
        self.assignments.append(assignment)

        return allocated_units


def load_input_data(input_path: str) -> Dict[str, Any]:
    """Load and validate input JSON file"""
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    required_keys = ['lines', 'models', 'volumes', 'compatibilities', 'selectedYears']
    for key in required_keys:
        if key not in data:
            raise ValueError(f"Missing required key in input: {key}")

    return data


def get_volumes_by_year(volumes: List[Dict], year: int) -> Dict[str, Dict]:
    """
    Get volumes for a specific year, indexed by modelId.
    Returns dict: { modelId: { volume, operationsDays, dailyDemand } }
    """
    result = {}
    for vol in volumes:
        if vol['year'] == year:
            daily_demand = vol['volume'] / vol['operationsDays'] if vol['operationsDays'] > 0 else 0
            result[vol['modelId']] = {
                'volume': vol['volume'],
                'operationsDays': vol['operationsDays'],
                'dailyDemand': daily_demand,
                'modelName': vol.get('modelName', 'Unknown')
            }
    return result


def get_compatibilities_by_line(compatibilities: List[Dict]) -> Dict[str, List[Dict]]:
    """
    Index compatibilities by lineId.
    Returns dict: { lineId: [compat1, compat2, ...] }
    """
    result: Dict[str, List[Dict]] = {}
    for compat in compatibilities:
        line_id = compat['lineId']
        if line_id not in result:
            result[line_id] = []
        result[line_id].append(compat)

    # Sort each line's compatibilities by priority (lower = higher priority)
    for line_id in result:
        result[line_id].sort(key=lambda x: x.get('priority', float('inf')))

    return result


def run_optimization_for_year(
    lines_data: List[Dict],
    volumes_by_model: Dict[str, Dict],
    compats_by_line: Dict[str, List[Dict]],
    year: int
) -> Dict[str, Any]:
    """
    Run optimization for a single year.

    Algorithm (PER AREA):
    1. Group lines by area
    2. For each area independently:
       - Get all compatible models for lines in that area
       - Distribute the FULL demand for each model across lines in that area
       - Each area processes the complete volume (products go through all processes)
    3. Track remaining demand PER AREA (not globally)
    4. Calculate unfulfilled demand and identify bottleneck area
    """
    print(f"\n{'='*60}")
    print(f"Processing year: {year}")
    print(f"{'='*60}")

    # Create production line objects
    lines: Dict[str, ProductionLine] = {}
    for line_data in lines_data:
        lines[line_data['id']] = ProductionLine(
            id=line_data['id'],
            name=line_data['name'],
            area=line_data['area'],
            timeAvailableDaily=line_data['timeAvailableDaily']
        )

    # Group lines by area
    lines_by_area: Dict[str, List[str]] = {}
    for line_id, line in lines.items():
        area = line.area
        if area not in lines_by_area:
            lines_by_area[area] = []
        lines_by_area[area].append(line_id)

    print(f"\nAreas found: {list(lines_by_area.keys())}")
    for area, line_ids in lines_by_area.items():
        print(f"  {area}: {len(line_ids)} lines")

    # Track unfulfilled demand per area per model
    unfulfilled_demand_tracker: Dict[str, Dict[str, float]] = {}  # {area: {model_id: unfulfilled_units}}

    # Process each area independently
    for area, line_ids_in_area in lines_by_area.items():
        print(f"\n--- Processing Area: {area} ---")

        # ===================================================================
        # MODEL-CENTRIC DISTRIBUTION (Priority-Based)
        # ===================================================================
        # Step 1: Collect ALL compatibilities for this area
        # We need this FIRST to know which models have compatible lines in this area
        area_compatibilities = []
        models_with_compats_in_area = set()  # Track which models have compatible lines here

        for line_id in line_ids_in_area:
            compats = compats_by_line.get(line_id, [])
            for compat in compats:
                # Skip if no volume for this model
                if compat['modelId'] in volumes_by_model:
                    area_compatibilities.append({
                        'lineId': line_id,
                        'modelId': compat['modelId'],
                        'modelName': compat.get('modelName', 'Unknown'),
                        'cycleTime': compat['cycleTime'],
                        'efficiency': compat['efficiency'],
                        'priority': compat.get('priority', 999)
                    })
                    models_with_compats_in_area.add(compat['modelId'])

        # Track remaining demand PER AREA - ONLY for models that have compatible lines here
        remaining_demand_in_area: Dict[str, float] = {}
        for model_id in models_with_compats_in_area:
            vol_info = volumes_by_model[model_id]
            remaining_demand_in_area[model_id] = vol_info['dailyDemand']

        print(f"  Models with compatibilities in {area}: {len(models_with_compats_in_area)}")

        # Step 2: Get unique priority levels, sorted (1, 2, 3, ...)
        priority_levels = sorted(set(c['priority'] for c in area_compatibilities))
        print(f"  Priority levels in {area}: {priority_levels}")

        # Step 3: Process each priority level
        for priority_level in priority_levels:
            print(f"\n  Processing Priority {priority_level} models:")

            # Get all model-line pairs at this priority level
            compats_at_priority = [c for c in area_compatibilities if c['priority'] == priority_level]

            # Group by model to get unique models at this priority
            models_at_priority = {}
            for compat in compats_at_priority:
                model_id = compat['modelId']
                if model_id not in models_at_priority:
                    models_at_priority[model_id] = []
                models_at_priority[model_id].append(compat)

            # Process each model at this priority level
            for model_id, compatible_lines in models_at_priority.items():
                demand = remaining_demand_in_area.get(model_id, 0)

                if demand <= 0:
                    continue

                vol_info = volumes_by_model[model_id]
                model_name = vol_info.get('modelName', 'Unknown')
                print(f"    Model {model_name} (demand: {demand:.0f} units/day)")

                # Distribute this model's demand across all compatible lines (at this priority)
                print(f"      Compatible lines: {[c['lineId'] for c in compatible_lines]}")
                for compat in compatible_lines:
                    line_id = compat['lineId']
                    line = lines[line_id]

                    current_demand = remaining_demand_in_area.get(model_id, 0)
                    if current_demand <= 0:
                        print(f"      -> {line.name}: SKIPPED (demand fulfilled)")
                        break  # Model fully allocated

                    # Debug: show line capacity before allocation
                    available_time = line.timeAvailableDaily - line.timeUsedDaily
                    adjusted_ct = compat['cycleTime'] / (compat['efficiency'] / 100.0)
                    max_units = available_time / adjusted_ct if adjusted_ct > 0 else 0
                    print(f"      -> {line.name}: avail_time={available_time:.0f}s, adjusted_ct={adjusted_ct:.1f}s, max_units={max_units:.0f}, current_demand={current_demand:.0f}")

                    # Try to allocate model to this line
                    allocated = line.add_model(
                        model_id=model_id,
                        model_name=compat['modelName'],
                        daily_demand=current_demand,
                        cycle_time=compat['cycleTime'],
                        efficiency=compat['efficiency'],
                        priority=compat['priority']
                    )

                    if allocated > 0:
                        remaining_demand_in_area[model_id] -= allocated
                        print(f"         ALLOCATED: {allocated:.0f} units ({(allocated/vol_info['dailyDemand']*100):.1f}% of total demand), remaining={remaining_demand_in_area[model_id]:.0f}")
                    else:
                        print(f"         ALLOCATED: 0 units (line full or no capacity)")

        # After processing all models in this area, track unfulfilled demand
        unfulfilled_demand_tracker[area] = {}
        for model_id, remaining_units in remaining_demand_in_area.items():
            if remaining_units > 0.01:  # Use small threshold to avoid floating point issues
                unfulfilled_demand_tracker[area][model_id] = remaining_units
                vol_info = volumes_by_model[model_id]
                model_name = vol_info.get('modelName', 'Unknown')
                total_demand = vol_info['dailyDemand']
                fulfillment = ((total_demand - remaining_units) / total_demand * 100) if total_demand > 0 else 0
                print(f"  Unfulfilled: {model_name} - {remaining_units:.1f} units/day ({100-fulfillment:.1f}% unmet)")

    # Calculate summary statistics
    total_utilization = 0.0
    overloaded = 0
    balanced = 0
    underutilized = 0

    for line in lines.values():
        util = line.utilizationPercent
        total_utilization += util

        if util > 100:
            overloaded += 1
        elif util >= 70:
            balanced += 1
        else:
            underutilized += 1

    avg_utilization = total_utilization / len(lines) if lines else 0

    # Calculate demand fulfillment per area
    # Since each area processes full demand independently, we calculate per-area fulfillment
    area_fulfillments = []
    for area, line_ids_in_area in lines_by_area.items():
        area_demand = 0.0
        area_allocated = 0.0
        for line_id in line_ids_in_area:
            line = lines[line_id]
            for assignment in line.assignments:
                area_demand += assignment.demandUnitsDaily
                area_allocated += assignment.allocatedUnitsDaily

        area_fulfillment = (area_allocated / area_demand * 100) if area_demand > 0 else 100.0
        area_fulfillments.append(area_fulfillment)
        print(f"  {area} fulfillment: {area_fulfillment:.1f}%")

    # Overall fulfillment is average across areas
    fulfillment = sum(area_fulfillments) / len(area_fulfillments) if area_fulfillments else 100.0

    # Count models that appear in assignments (any assignment means the model is being processed)
    assigned_models = set()
    for line in lines.values():
        for assignment in line.assignments:
            assigned_models.add(assignment.modelId)

    total_models = len(volumes_by_model)
    unassigned = total_models - len(assigned_models)

    # Calculate total demand and allocated (sum across all areas)
    total_demand = sum(v['dailyDemand'] for v in volumes_by_model.values()) * len(lines_by_area)  # Each area processes full demand
    total_allocated = sum(line.timeUsedDaily / (compat['cycleTime'] / (compat['efficiency'] / 100.0))
                         for line in lines.values()
                         for compat in compats_by_line.get(line.id, [])
                         if any(a.modelId == compat['modelId'] for a in line.assignments))

    # Simpler calculation: sum all allocated units across all lines and assignments
    total_allocated = sum(assignment.allocatedUnitsDaily
                         for line in lines.values()
                         for assignment in line.assignments)

    print(f"\nYear {year} Summary:")
    print(f"  Average Utilization: {avg_utilization:.1f}%")
    print(f"  Overloaded (>100%): {overloaded}")
    print(f"  Balanced (70-100%): {balanced}")
    print(f"  Underutilized (<70%): {underutilized}")
    print(f"  Models Assigned: {len(assigned_models)}/{total_models}")
    print(f"  Average Demand Fulfillment: {fulfillment:.1f}%")

    # Build result structure
    lines_result = []
    for line in lines.values():
        lines_result.append({
            'lineId': line.id,
            'lineName': line.name,
            'area': line.area,
            'timeAvailableDaily': line.timeAvailableDaily,
            'timeUsedDaily': round(line.timeUsedDaily, 2),
            'utilizationPercent': round(line.utilizationPercent, 2),
            'assignments': [asdict(a) for a in line.assignments]
        })

    # Sort lines by name for consistent output
    lines_result.sort(key=lambda x: x['lineName'])

    # Build unfulfilled demand list
    unfulfilled_demand_list = []
    for area, models_unfulfilled in unfulfilled_demand_tracker.items():
        for model_id, unfulfilled_units_daily in models_unfulfilled.items():
            vol_info = volumes_by_model[model_id]
            model_name = vol_info.get('modelName', 'Unknown')
            total_demand_daily = vol_info['dailyDemand']
            operations_days = vol_info.get('operationsDays', 240)

            unfulfilled_yearly = unfulfilled_units_daily * operations_days
            allocated_daily = total_demand_daily - unfulfilled_units_daily
            fulfillment_percent = (allocated_daily / total_demand_daily * 100) if total_demand_daily > 0 else 0

            unfulfilled_demand_list.append({
                'modelId': model_id,
                'modelName': model_name,
                'area': area,
                'unfulfilledUnitsDaily': round(unfulfilled_units_daily, 2),
                'unfulfilledUnitsYearly': round(unfulfilled_yearly, 2),
                'demandUnitsDaily': round(total_demand_daily, 2),
                'fulfillmentPercent': round(fulfillment_percent, 2)
            })

    # Build area-level summary
    area_summary_list = []
    area_utilizations = {}  # Track for bottleneck calculation

    for area, line_ids_in_area in lines_by_area.items():
        area_lines = [lines[lid] for lid in line_ids_in_area]

        # Calculate total demand and allocated for this area
        total_demand_daily = 0.0
        total_allocated_daily = 0.0
        total_utilization = 0.0
        lines_at_capacity = 0

        for line in area_lines:
            total_utilization += line.utilizationPercent
            if line.utilizationPercent >= 95.0:
                lines_at_capacity += 1

            for assignment in line.assignments:
                # Each assignment represents demand for that model in this area
                # We need to count unique model demands once, not sum duplicates
                pass

        # Calculate demand from volumes (each model's full demand goes to each area)
        models_in_area = set()
        for line_id in line_ids_in_area:
            for compat in compats_by_line.get(line_id, []):
                if compat['modelId'] in volumes_by_model:
                    models_in_area.add(compat['modelId'])

        for model_id in models_in_area:
            total_demand_daily += volumes_by_model[model_id]['dailyDemand']

        # Calculate allocated from assignments
        for line in area_lines:
            for assignment in line.assignments:
                total_allocated_daily += assignment.allocatedUnitsDaily

        total_unfulfilled_daily = total_demand_daily - total_allocated_daily
        avg_utilization = total_utilization / len(area_lines) if area_lines else 0
        fulfillment_percent = (total_allocated_daily / total_demand_daily * 100) if total_demand_daily > 0 else 100.0

        area_utilizations[area] = avg_utilization

        area_summary_list.append({
            'area': area,
            'totalDemandUnitsDaily': round(total_demand_daily, 2),
            'totalAllocatedUnitsDaily': round(total_allocated_daily, 2),
            'totalUnfulfilledUnitsDaily': round(total_unfulfilled_daily, 2),
            'fulfillmentPercent': round(fulfillment_percent, 2),
            'averageUtilization': round(avg_utilization, 2),
            'linesAtCapacity': lines_at_capacity,
            'totalLines': len(area_lines),
            'isSystemConstraint': False  # Will be set below
        })

    # Identify system constraint (bottleneck)
    system_constraint = None
    constraint_reason = None

    # Find areas with unfulfilled demand
    areas_with_unfulfilled = {}
    for area, models_unfulfilled in unfulfilled_demand_tracker.items():
        if models_unfulfilled:  # Has unfulfilled demand
            total_unfulfilled = sum(models_unfulfilled.values())
            areas_with_unfulfilled[area] = total_unfulfilled

    # DEBUG: Show all areas with unfulfilled demand
    print(f"\n=== SYSTEM CONSTRAINT DETERMINATION for Year {year} ===")
    if areas_with_unfulfilled:
        print(f"Areas with unfulfilled demand:")
        for area, unfulfilled in sorted(areas_with_unfulfilled.items(), key=lambda x: -x[1]):
            print(f"  {area}: {unfulfilled:.1f} units/day unfulfilled")
    else:
        print("No areas with unfulfilled demand")

    if areas_with_unfulfilled:
        # Constraint is area with highest unfulfilled demand
        constraint_area = max(areas_with_unfulfilled.items(), key=lambda x: x[1])[0]
        constraint_reason = "unfulfilled_demand"
        print(f"Selected constraint: {constraint_area} (highest unfulfilled: {areas_with_unfulfilled[constraint_area]:.1f})")
        system_constraint = {
            'area': constraint_area,
            'reason': constraint_reason,
            'utilizationPercent': round(area_utilizations.get(constraint_area, 0), 2),
            'unfulfilledUnitsDaily': round(areas_with_unfulfilled[constraint_area], 2)
        }
    elif area_utilizations:
        # No unfulfilled demand - check if any area is at/over capacity (>=100%)
        max_util_area = max(area_utilizations.items(), key=lambda x: x[1])
        constraint_area = max_util_area[0]
        max_util_percent = max_util_area[1]

        if max_util_percent >= 100:
            # Only mark as constraint if actually at capacity
            constraint_reason = "highest_utilization"
            print(f"Highest utilization area at capacity: {constraint_area} ({max_util_percent:.1f}%)")
            system_constraint = {
                'area': constraint_area,
                'reason': constraint_reason,
                'utilizationPercent': round(max_util_percent, 2),
                'unfulfilledUnitsDaily': 0
            }
        else:
            # All areas under 100% and no unfulfilled demand = NO CONSTRAINT
            print(f"No constraint - all areas have available capacity (highest: {constraint_area} at {max_util_percent:.1f}%)")
            system_constraint = None

    # Mark constraint area in summary
    if system_constraint:
        for area_sum in area_summary_list:
            if area_sum['area'] == system_constraint['area']:
                area_sum['isSystemConstraint'] = True
                break

    # Calculate total unfulfilled demand across all areas
    total_unfulfilled_daily = sum(sum(models.values()) for models in unfulfilled_demand_tracker.values())

    # Calculate operations days (use first model's operations days as reference, typically 240)
    operations_days = 240
    if volumes_by_model:
        first_model = next(iter(volumes_by_model.values()))
        operations_days = first_model.get('operationsDays', 240)

    total_unfulfilled_yearly = total_unfulfilled_daily * operations_days

    # Overall fulfillment percent (considering all areas)
    total_demand_all_areas = sum(v['dailyDemand'] for v in volumes_by_model.values()) * len(lines_by_area)
    overall_fulfillment_percent = ((total_demand_all_areas - total_unfulfilled_daily) / total_demand_all_areas * 100) if total_demand_all_areas > 0 else 100.0

    return {
        'year': year,
        'lines': lines_result,
        'unfulfilledDemand': unfulfilled_demand_list,
        'areaSummary': area_summary_list,
        'systemConstraint': system_constraint,
        'summary': {
            'totalLines': len(lines),
            'totalAreas': len(lines_by_area),
            'averageUtilization': round(avg_utilization, 2),
            'overloadedLines': overloaded,
            'balancedLines': balanced,
            'underutilizedLines': underutilized,
            'totalModels': total_models,
            'assignedModels': len(assigned_models),
            'unassignedModels': unassigned,
            'totalAllocatedUnits': round(total_allocated, 2),
            'demandFulfillmentPercent': round(fulfillment, 2),
            'totalUnfulfilledUnitsDaily': round(total_unfulfilled_daily, 2),
            'totalUnfulfilledUnitsYearly': round(total_unfulfilled_yearly, 2),
            'overallFulfillmentPercent': round(overall_fulfillment_percent, 2),
            'systemConstraintArea': system_constraint['area'] if system_constraint else None
        }
    }


def main():
    parser = argparse.ArgumentParser(description='Line Utilization Optimizer')
    parser.add_argument('--input', required=True, help='Path to input JSON file')
    parser.add_argument('--output', required=True, help='Path to output JSON file')
    args = parser.parse_args()

    start_time = datetime.now()
    print(f"Line Utilization Optimizer")
    print(f"Started at: {start_time.isoformat()}")
    print(f"Input: {args.input}")
    print(f"Output: {args.output}")

    try:
        # Load input data
        data = load_input_data(args.input)

        print(f"\nInput data loaded:")
        print(f"  Lines: {len(data['lines'])}")
        print(f"  Models: {len(data['models'])}")
        print(f"  Volumes: {len(data['volumes'])}")
        print(f"  Compatibilities: {len(data['compatibilities'])}")
        print(f"  Selected Years: {data['selectedYears']}")

        # Index compatibilities by line
        compats_by_line = get_compatibilities_by_line(data['compatibilities'])

        # Process each selected year
        year_results = []
        total_avg_util = 0.0

        for year in sorted(data['selectedYears']):
            # Get volumes for this year
            volumes_by_model = get_volumes_by_year(data['volumes'], year)

            if not volumes_by_model:
                print(f"\nWarning: No volume data for year {year}, skipping...")
                continue

            # Run optimization
            result = run_optimization_for_year(
                lines_data=data['lines'],
                volumes_by_model=volumes_by_model,
                compats_by_line=compats_by_line,
                year=year
            )

            year_results.append(result)
            total_avg_util += result['summary']['averageUtilization']

        # Calculate overall summary
        end_time = datetime.now()
        execution_time_ms = int((end_time - start_time).total_seconds() * 1000)

        overall_avg_util = total_avg_util / len(year_results) if year_results else 0

        output = {
            'metadata': {
                'version': '1.0',
                'timestamp': end_time.isoformat(),
                'inputYears': data['selectedYears'],
                'executionTimeMs': execution_time_ms
            },
            'yearResults': year_results,
            'overallSummary': {
                'yearsProcessed': len(year_results),
                'averageUtilizationAllYears': round(overall_avg_util, 2),
                'totalLinesAnalyzed': len(data['lines'])
            }
        }

        # Write output
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        print(f"\n{'='*60}")
        print(f"Optimization Complete!")
        print(f"{'='*60}")
        print(f"Years processed: {len(year_results)}")
        print(f"Average utilization (all years): {overall_avg_util:.1f}%")
        print(f"Execution time: {execution_time_ms}ms")
        print(f"Results written to: {args.output}")

    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

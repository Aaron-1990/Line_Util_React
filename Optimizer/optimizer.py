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
        "summary": { "totalLines", "averageUtilization", ... }
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

    # Process each area independently
    for area, line_ids_in_area in lines_by_area.items():
        print(f"\n--- Processing Area: {area} ---")

        # Track remaining demand PER AREA (each area gets full demand)
        remaining_demand_in_area: Dict[str, float] = {}
        for model_id, vol_info in volumes_by_model.items():
            remaining_demand_in_area[model_id] = vol_info['dailyDemand']

        # ===================================================================
        # MODEL-CENTRIC DISTRIBUTION (Priority-Based)
        # ===================================================================
        # Step 1: Collect ALL compatibilities for this area
        area_compatibilities = []
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
                for compat in compatible_lines:
                    line_id = compat['lineId']
                    line = lines[line_id]

                    current_demand = remaining_demand_in_area.get(model_id, 0)
                    if current_demand <= 0:
                        break  # Model fully allocated

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
                        print(f"      -> {line.name}: {allocated:.0f} units ({(allocated/vol_info['dailyDemand']*100):.1f}% of total demand)")

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

    return {
        'year': year,
        'lines': lines_result,
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
            'demandFulfillmentPercent': round(fulfillment, 2)
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

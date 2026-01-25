#!/usr/bin/env python3
"""
Test script to validate priority-based model distribution.

This test creates a scenario where:
- 2 lines in SMT area (SMT-1, SMT-2)
- 3 models (A, B, C)
- Model A: Priority 1 on both lines
- Model B: Priority 2 on SMT-1, Priority 1 on SMT-2
- Model C: Priority 1 on SMT-1, Priority 2 on SMT-2

Expected behavior (CORRECT):
1. Priority 1 models processed first: A, B (on SMT-2), C (on SMT-1)
2. Priority 2 models processed second: B (on SMT-1), C (on SMT-2)

This ensures high-priority models get capacity before low-priority ones,
even when they share the same lines.
"""

import json
import subprocess
import os
import sys
from pathlib import Path

def create_test_data():
    """Create test input data with priority distribution scenario"""

    # 2 production lines in SMT area
    # Each line has 28,800 seconds available per day (8 hours)
    lines = [
        {
            "id": "line-smt-1",
            "name": "SMT-1",
            "area": "SMT",
            "timeAvailableDaily": 28800  # 8 hours
        },
        {
            "id": "line-smt-2",
            "name": "SMT-2",
            "area": "SMT",
            "timeAvailableDaily": 28800  # 8 hours
        }
    ]

    # 3 product models
    models = [
        {"id": "model-a", "name": "Model A", "customer": "Customer 1", "program": "Program 1", "family": "Family 1"},
        {"id": "model-b", "name": "Model B", "customer": "Customer 2", "program": "Program 2", "family": "Family 2"},
        {"id": "model-c", "name": "Model C", "customer": "Customer 3", "program": "Program 3", "family": "Family 3"}
    ]

    # Volume data for 2024
    # Model A: 10,000 units/year, 250 days = 40 units/day
    # Model B: 15,000 units/year, 250 days = 60 units/day
    # Model C: 12,000 units/year, 250 days = 48 units/day
    volumes = [
        {"modelId": "model-a", "modelName": "Model A", "year": 2024, "volume": 10000, "operationsDays": 250},
        {"modelId": "model-b", "modelName": "Model B", "year": 2024, "volume": 15000, "operationsDays": 250},
        {"modelId": "model-c", "modelName": "Model C", "year": 2024, "volume": 12000, "operationsDays": 250}
    ]

    # Compatibilities with strategic priorities
    # Cycle times: 300s (5 min), Efficiency: 85%
    compatibilities = [
        # Model A: Priority 1 on BOTH lines (should be allocated first)
        {"lineId": "line-smt-1", "lineName": "SMT-1", "modelId": "model-a", "modelName": "Model A",
         "cycleTime": 300, "efficiency": 85, "priority": 1},
        {"lineId": "line-smt-2", "lineName": "SMT-2", "modelId": "model-a", "modelName": "Model A",
         "cycleTime": 300, "efficiency": 85, "priority": 1},

        # Model B: Priority 2 on SMT-1, Priority 1 on SMT-2
        # With correct algorithm, SMT-2 should get Model B at priority 1 (before Model A fills it)
        {"lineId": "line-smt-1", "lineName": "SMT-1", "modelId": "model-b", "modelName": "Model B",
         "cycleTime": 300, "efficiency": 85, "priority": 2},
        {"lineId": "line-smt-2", "lineName": "SMT-2", "modelId": "model-b", "modelName": "Model B",
         "cycleTime": 300, "efficiency": 85, "priority": 1},

        # Model C: Priority 1 on SMT-1, Priority 2 on SMT-2
        {"lineId": "line-smt-1", "lineName": "SMT-1", "modelId": "model-c", "modelName": "Model C",
         "cycleTime": 300, "efficiency": 85, "priority": 1},
        {"lineId": "line-smt-2", "lineName": "SMT-2", "modelId": "model-c", "modelName": "Model C",
         "cycleTime": 300, "efficiency": 85, "priority": 2}
    ]

    return {
        "lines": lines,
        "models": models,
        "volumes": volumes,
        "compatibilities": compatibilities,
        "selectedYears": [2024]
    }


def run_test():
    """Run the optimizer with test data and validate results"""

    # Get script directory
    script_dir = Path(__file__).parent
    input_file = script_dir / "test_priority_input.json"
    output_file = script_dir / "test_priority_output.json"
    optimizer_script = script_dir / "optimizer.py"

    # Create test data
    test_data = create_test_data()

    # Write input file
    with open(input_file, 'w', encoding='utf-8') as f:
        json.dump(test_data, f, indent=2)

    print("="*70)
    print("PRIORITY DISTRIBUTION TEST")
    print("="*70)
    print("\nTest Scenario:")
    print("  Lines: SMT-1, SMT-2 (28,800s available each)")
    print("  Models: A (40 units/day), B (60 units/day), C (48 units/day)")
    print("\nPriority Configuration:")
    print("  Model A: Priority 1 on SMT-1, Priority 1 on SMT-2")
    print("  Model B: Priority 2 on SMT-1, Priority 1 on SMT-2")
    print("  Model C: Priority 1 on SMT-1, Priority 2 on SMT-2")
    print("\nExpected Behavior (Model-Centric):")
    print("  Priority 1 Round: Process A, B (on SMT-2), C (on SMT-1) FIRST")
    print("  Priority 2 Round: Process B (on SMT-1), C (on SMT-2) with REMAINING capacity")
    print("\n" + "="*70)

    # Run optimizer
    try:
        result = subprocess.run(
            [sys.executable, str(optimizer_script),
             "--input", str(input_file),
             "--output", str(output_file)],
            capture_output=True,
            text=True,
            check=True
        )

        print("\n" + result.stdout)

        # Read and analyze results
        with open(output_file, 'r', encoding='utf-8') as f:
            results = json.load(f)

        # Validate results
        validate_results(results)

    except subprocess.CalledProcessError as e:
        print(f"Error running optimizer: {e}")
        print(f"STDOUT: {e.stdout}")
        print(f"STDERR: {e.stderr}")
        return False

    return True


def validate_results(results):
    """Validate that priority distribution worked correctly"""

    print("\n" + "="*70)
    print("VALIDATION RESULTS")
    print("="*70)

    year_result = results['yearResults'][0]
    lines = {line['lineName']: line for line in year_result['lines']}

    # Check that both lines have assignments
    smt1 = lines.get('SMT-1', {})
    smt2 = lines.get('SMT-2', {})

    print(f"\nSMT-1 Assignments:")
    print(f"  Utilization: {smt1.get('utilizationPercent', 0):.2f}%")
    for assignment in smt1.get('assignments', []):
        print(f"    {assignment['modelName']}: {assignment['allocatedUnitsDaily']} units "
              f"(Priority {assignment['priority']}, {assignment['fulfillmentPercent']:.1f}% fulfilled)")

    print(f"\nSMT-2 Assignments:")
    print(f"  Utilization: {smt2.get('utilizationPercent', 0):.2f}%")
    for assignment in smt2.get('assignments', []):
        print(f"    {assignment['modelName']}: {assignment['allocatedUnitsDaily']} units "
              f"(Priority {assignment['priority']}, {assignment['fulfillmentPercent']:.1f}% fulfilled)")

    # Validate priority-based allocation
    print("\n" + "="*70)
    print("PRIORITY VALIDATION")
    print("="*70)

    validation_passed = True

    # Check: Priority 1 models should be allocated before Priority 2
    # Model A (Pri 1): Should get full allocation
    # Model C (Pri 1 on SMT-1): Should get allocation on SMT-1
    # Model B (Pri 1 on SMT-2): Should get allocation on SMT-2 before Model A fills it

    smt1_assignments = {a['modelName']: a for a in smt1.get('assignments', [])}
    smt2_assignments = {a['modelName']: a for a in smt2.get('assignments', [])}

    # Test 1: Model A should appear on at least one line (it's priority 1 on both)
    if 'Model A' in smt1_assignments or 'Model A' in smt2_assignments:
        print("✓ Model A (Priority 1) is allocated")
    else:
        print("✗ Model A (Priority 1) is NOT allocated - FAILED")
        validation_passed = False

    # Test 2: Model B should appear on SMT-2 (priority 1 there)
    if 'Model B' in smt2_assignments and smt2_assignments['Model B']['priority'] == 1:
        print("✓ Model B is allocated to SMT-2 at Priority 1")
    else:
        print("✗ Model B is NOT allocated to SMT-2 at Priority 1 - FAILED")
        validation_passed = False

    # Test 3: Model C should appear on SMT-1 (priority 1 there)
    if 'Model C' in smt1_assignments and smt1_assignments['Model C']['priority'] == 1:
        print("✓ Model C is allocated to SMT-1 at Priority 1")
    else:
        print("✗ Model C is NOT allocated to SMT-1 at Priority 1 - FAILED")
        validation_passed = False

    # Test 4: Verify that priority 1 models were processed BEFORE priority 2
    # The key indicator: Priority 1 models should be assigned to lines first
    # This is validated by checking the allocation pattern, not just fulfillment
    # (fulfillment can be 100% for both if there's enough capacity)

    pri1_allocations = []
    pri2_allocations = []

    for line in [smt1, smt2]:
        for assignment in line.get('assignments', []):
            if assignment['priority'] == 1:
                pri1_allocations.append({
                    'model': assignment['modelName'],
                    'line': line['lineName'],
                    'allocated': assignment['allocatedUnitsDaily']
                })
            elif assignment['priority'] == 2:
                pri2_allocations.append({
                    'model': assignment['modelName'],
                    'line': line['lineName'],
                    'allocated': assignment['allocatedUnitsDaily']
                })

    print(f"\nPriority 1 Allocations: {len(pri1_allocations)} assignments")
    print(f"Priority 2 Allocations: {len(pri2_allocations)} assignments")

    # The key test: Model C should appear BOTH at priority 1 (SMT-1) and priority 2 (SMT-2)
    # This proves it was processed by priority level, not line-by-line
    model_c_pri1 = any(a['model'] == 'Model C' and a['line'] == 'SMT-1' for a in pri1_allocations)
    model_c_pri2 = any(a['model'] == 'Model C' and a['line'] == 'SMT-2' for a in pri2_allocations)

    if model_c_pri1 and model_c_pri2:
        print("✓ Model C correctly split: Priority 1 on SMT-1, Priority 2 on SMT-2")
        print("  This proves model-centric (not line-centric) distribution!")
    else:
        print("✗ Model C distribution is incorrect - FAILED")
        validation_passed = False

    print("\n" + "="*70)
    if validation_passed:
        print("✓ ALL TESTS PASSED - Priority distribution is working correctly!")
    else:
        print("✗ TESTS FAILED - Priority distribution needs debugging")
    print("="*70)

    return validation_passed


if __name__ == '__main__':
    success = run_test()
    sys.exit(0 if success else 1)

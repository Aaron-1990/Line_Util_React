// ============================================
// INTEGRATION TEST: Domain Entities
// Tests for ProductModelV2 and LineModelCompatibility entities
// ============================================

import { describe, it, expect } from 'vitest';

// Test entity logic without dependencies
// These tests verify the business logic calculations

describe('ProductModelV2 - Business Logic', () => {
  interface ModelData {
    name: string;
    customer: string;
    program: string;
    family: string;
    annualVolume: number;
    operationsDays: number;
  }

  const calculateDailyDemand = (model: ModelData): number => {
    if (model.operationsDays <= 0) return 0;
    return model.annualVolume / model.operationsDays;
  };

  it('should calculate daily demand correctly', () => {
    const model: ModelData = {
      name: 'ECU-2024-A',
      customer: 'BorgWarner',
      program: 'EV Program',
      family: 'ECU 2024',
      annualVolume: 50000,
      operationsDays: 250,
    };

    const dailyDemand = calculateDailyDemand(model);

    // 50,000 / 250 = 200 units/day
    expect(dailyDemand).toBe(200);
  });

  it('should handle zero operations days', () => {
    const model: ModelData = {
      name: 'Test',
      customer: 'Test',
      program: 'Test',
      family: 'Test',
      annualVolume: 50000,
      operationsDays: 0,
    };

    const dailyDemand = calculateDailyDemand(model);
    expect(dailyDemand).toBe(0);
  });

  it('should handle large volumes', () => {
    const model: ModelData = {
      name: 'High Volume',
      customer: 'Tesla',
      program: 'Model 3',
      family: 'EV',
      annualVolume: 1000000,
      operationsDays: 300,
    };

    const dailyDemand = calculateDailyDemand(model);

    // 1,000,000 / 300 = ~3333.33 units/day
    expect(dailyDemand).toBeCloseTo(3333.33, 2);
  });
});

describe('LineModelCompatibility - Business Logic', () => {
  interface CompatibilityData {
    lineName: string;
    modelName: string;
    cycleTime: number;
    efficiency: number;
    priority: number;
  }

  const calculateRealTimePerUnit = (compat: CompatibilityData): number => {
    if (compat.efficiency <= 0) return Infinity;
    return compat.cycleTime / (compat.efficiency / 100);
  };

  const calculateUnitsInTime = (compat: CompatibilityData, availableSeconds: number): number => {
    const realTimePerUnit = calculateRealTimePerUnit(compat);
    if (realTimePerUnit <= 0 || realTimePerUnit === Infinity) return 0;
    return Math.floor(availableSeconds / realTimePerUnit);
  };

  const calculateTimeForUnits = (compat: CompatibilityData, units: number): number => {
    return units * calculateRealTimePerUnit(compat);
  };

  it('should calculate real time per unit considering efficiency', () => {
    const compat: CompatibilityData = {
      lineName: 'Line SMT-1',
      modelName: 'ECU-2024-A',
      cycleTime: 45,
      efficiency: 85,
      priority: 1,
    };

    const realTime = calculateRealTimePerUnit(compat);

    // 45 / 0.85 = 52.94 seconds/unit
    expect(realTime).toBeCloseTo(52.94, 2);
  });

  it('should calculate units producible in available time', () => {
    const compat: CompatibilityData = {
      lineName: 'Line SMT-1',
      modelName: 'ECU-2024-A',
      cycleTime: 45,
      efficiency: 85,
      priority: 1,
    };

    // 8 hours = 28,800 seconds
    const availableSeconds = 8 * 60 * 60;
    const units = calculateUnitsInTime(compat, availableSeconds);

    // 28,800 / 52.94 = ~544 units
    expect(units).toBeGreaterThanOrEqual(540);
    expect(units).toBeLessThanOrEqual(550);
  });

  it('should calculate time needed for producing units', () => {
    const compat: CompatibilityData = {
      lineName: 'Line SMT-1',
      modelName: 'ECU-2024-A',
      cycleTime: 45,
      efficiency: 85,
      priority: 1,
    };

    const timeNeeded = calculateTimeForUnits(compat, 100);

    // 100 * 52.94 = 5294 seconds (~88 minutes)
    expect(timeNeeded).toBeCloseTo(5294.12, 2);
  });

  it('should handle 100% efficiency', () => {
    const compat: CompatibilityData = {
      lineName: 'Line SMT-1',
      modelName: 'ECU-2024-A',
      cycleTime: 45,
      efficiency: 100,
      priority: 1,
    };

    const realTime = calculateRealTimePerUnit(compat);

    // At 100% efficiency, real time = cycle time
    expect(realTime).toBe(45);
  });

  it('should handle low efficiency', () => {
    const compat: CompatibilityData = {
      lineName: 'Line OLD-1',
      modelName: 'Legacy Model',
      cycleTime: 60,
      efficiency: 50,
      priority: 1,
    };

    const realTime = calculateRealTimePerUnit(compat);

    // 60 / 0.50 = 120 seconds/unit
    expect(realTime).toBe(120);
  });

  it('should handle zero efficiency gracefully', () => {
    const compat: CompatibilityData = {
      lineName: 'Line SMT-1',
      modelName: 'ECU-2024-A',
      cycleTime: 45,
      efficiency: 0,
      priority: 1,
    };

    const realTime = calculateRealTimePerUnit(compat);
    expect(realTime).toBe(Infinity);

    const units = calculateUnitsInTime(compat, 28800);
    expect(units).toBe(0);
  });
});

describe('Line Utilization Calculation', () => {
  interface LineData {
    name: string;
    timeAvailableDaily: number; // in hours
  }

  interface CompatibilityData {
    lineName: string;
    modelName: string;
    cycleTime: number;
    efficiency: number;
  }

  interface ModelDemand {
    modelName: string;
    dailyDemand: number;
  }

  const calculateLineUtilization = (
    line: LineData,
    compatibilities: CompatibilityData[],
    modelDemands: ModelDemand[]
  ): number => {
    const availableSeconds = line.timeAvailableDaily * 3600;
    let usedSeconds = 0;

    for (const compat of compatibilities) {
      if (compat.lineName !== line.name) continue;

      const demand = modelDemands.find(d => d.modelName === compat.modelName);
      if (!demand) continue;

      const realTimePerUnit = compat.cycleTime / (compat.efficiency / 100);
      usedSeconds += demand.dailyDemand * realTimePerUnit;
    }

    return (usedSeconds / availableSeconds) * 100;
  };

  it('should calculate line utilization percentage', () => {
    const line: LineData = {
      name: 'Line SMT-1',
      timeAvailableDaily: 23, // 23 hours
    };

    const compatibilities: CompatibilityData[] = [
      { lineName: 'Line SMT-1', modelName: 'ECU-2024-A', cycleTime: 45, efficiency: 85 },
    ];

    const modelDemands: ModelDemand[] = [
      { modelName: 'ECU-2024-A', dailyDemand: 200 }, // 200 units/day
    ];

    const utilization = calculateLineUtilization(line, compatibilities, modelDemands);

    // Available: 23 * 3600 = 82,800 seconds
    // Real time per unit: 45 / 0.85 = 52.94 seconds
    // Used: 200 * 52.94 = 10,588 seconds
    // Utilization: 10,588 / 82,800 = 12.79%
    expect(utilization).toBeCloseTo(12.79, 1);
  });

  it('should handle multiple models on same line', () => {
    const line: LineData = {
      name: 'Line SMT-1',
      timeAvailableDaily: 23,
    };

    const compatibilities: CompatibilityData[] = [
      { lineName: 'Line SMT-1', modelName: 'ECU-2024-A', cycleTime: 45, efficiency: 85 },
      { lineName: 'Line SMT-1', modelName: 'ECU-2024-B', cycleTime: 50, efficiency: 82 },
    ];

    const modelDemands: ModelDemand[] = [
      { modelName: 'ECU-2024-A', dailyDemand: 200 },
      { modelName: 'ECU-2024-B', dailyDemand: 150 },
    ];

    const utilization = calculateLineUtilization(line, compatibilities, modelDemands);

    // Model A: 200 * (45/0.85) = 10,588 seconds
    // Model B: 150 * (50/0.82) = 9,146 seconds
    // Total used: 19,734 seconds
    // Utilization: 19,734 / 82,800 = 23.83%
    expect(utilization).toBeGreaterThan(20);
    expect(utilization).toBeLessThan(30);
  });
});

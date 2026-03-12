// ============================================
// EXCEL EXPORTER SERVICE
// Phase 9: Export Optimization Results to Excel
//
// Workbook sheet order:
//   1. "Capacity Analysis"    — Multi-Year matrix (mirrors ConstraintTimeline)
//   2. "Results_{AREA}" × N   — Line breakdown + validation rows (mirrors Resultados tab)
//   3. "Summary_{AREA}" × N   — Totals + utilization + C/O impact
//   4. "Unfulfilled Demand"   — Unfulfilled demand detail by model/area/year
//   5. "Overall Summary"      — Aggregate stats across all years
//
// Validation rows (Σ DISTRIBUIDO / VOLUMEN / COBERTURA / ESTADO) are computed
// from ModelAssignment.demandUnitsDaily + allocatedUnitsDaily — no DB query needed.
// operationsDays: from YearSummary.operationsDays, falls back to 240.
// ============================================

import * as XLSX from 'xlsx';
import type { OptimizationResult, ExportResultsRequest } from '@shared/types';

// Validation thresholds — mirrors DEFAULT_VALIDATION_THRESHOLDS in shared/constants/validation
const VALIDATION_THRESHOLDS = {
  ok:       { min: 0.99, max: 1.01 },
  over:     { min: 1.01 },
  under:    { min: 0.85, max: 0.95 },
  alert:    { min: 0.70, max: 0.85 },
  critical: { max: 0.70 },
} as const;

type ValidationStatus = 'ok' | 'over' | 'under' | 'alert' | 'critical';

const VALIDATION_LABELS: Record<ValidationStatus, string> = {
  ok:       'OK',
  over:     'OVER',
  under:    'UNDER',
  alert:    'ALERT',
  critical: 'CRITICAL',
};

interface ModelValidation {
  modelName: string;
  distributedUnits: number;  // annual
  volumeUnitsAnnual: number; // annual
  coveragePercent: number;
  status: ValidationStatus;
  deltaUnits: number;
}

export class ExcelExporter {
  /**
   * Build a complete Excel workbook from optimization results and return as a Buffer.
   * No file I/O — the caller writes the buffer to disk.
   */
  exportToBuffer(request: ExportResultsRequest): Buffer {
    const { results, areaSequences } = request;
    const wb = XLSX.utils.book_new();

    const years = results.yearResults.map((yr) => yr.year).sort((a, b) => a - b);
    const sequenceMap = this.buildSequenceMap(areaSequences);
    const sortedAreas = this.getSortedAreas(results, sequenceMap);

    this.addCapacityAnalysisSheet(wb, results, sortedAreas, years);

    for (const area of sortedAreas) {
      this.addResultsSheet(wb, results, area, years);
      this.addSummarySheet(wb, results, area, years);
    }

    this.addUnfulfilledDemandSheet(wb, results, sortedAreas);
    this.addOverallSummarySheet(wb, results);

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // ---- Sheet builders ----

  private addCapacityAnalysisSheet(
    wb: XLSX.WorkBook,
    results: OptimizationResult,
    sortedAreas: string[],
    years: number[]
  ): void {
    const rows: unknown[][] = [];

    rows.push(['Multi-Year Capacity Analysis']);
    rows.push([`Generated: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`]);
    rows.push([`Years: ${years.join(', ')} | Execution: ${results.metadata.executionTimeMs}ms`]);
    rows.push([]);
    rows.push(['Area', 'Year', 'Avg Util %', 'Risk Level', 'Unfulfilled Units/Day', 'Fulfillment %', 'System Constraint']);

    for (const area of sortedAreas) {
      for (const yr of results.yearResults.slice().sort((a, b) => a.year - b.year)) {
        const s = yr.areaSummary.find((a2) => a2.area === area);
        if (!s) continue;
        rows.push([
          area,
          yr.year,
          parseFloat(s.averageUtilization.toFixed(1)),
          this.getRiskLevel(s.averageUtilization),
          parseFloat(s.totalUnfulfilledUnitsDaily.toFixed(1)),
          parseFloat(s.fulfillmentPercent.toFixed(1)),
          s.isSystemConstraint ? 'YES' : '',
        ]);
      }
    }

    rows.push([]);
    rows.push(['OVERALL', 'Year', 'Avg Util %', 'Overloaded Lines', 'Balanced Lines', 'Underutilized Lines', 'Demand Fulfillment %']);
    for (const yr of results.yearResults.slice().sort((a, b) => a.year - b.year)) {
      const s = yr.summary;
      rows.push([
        'OVERALL',
        yr.year,
        parseFloat(s.averageUtilization.toFixed(1)),
        s.overloadedLines,
        s.balancedLines,
        s.underutilizedLines,
        parseFloat(s.demandFulfillmentPercent.toFixed(1)),
      ]);
    }

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Capacity Analysis');
  }

  private addResultsSheet(
    wb: XLSX.WorkBook,
    results: OptimizationResult,
    area: string,
    years: number[]
  ): void {
    const sortedModels = this.getModelsForArea(results, area);
    const { linesByName, sortedLines } = this.buildLineData(results, area);

    const rows: unknown[][] = [];
    rows.push([`Resultados_${area.replace(/\s+/g, '_')}`]);
    rows.push([]);

    // Header row 1 — year groups
    const header1: unknown[] = ['Linea'];
    for (const year of years) {
      header1.push(year);
      header1.push(...Array(1 + sortedModels.length * 2).fill(''));
    }
    rows.push(header1);

    // Header row 2 — sub-columns
    const header2: unknown[] = [''];
    for (const _year of years) {
      header2.push('Tiempo Util.');
      header2.push('Util. (%)');
      sortedModels.forEach((m) => header2.push(`${m} Pzas`));
      sortedModels.forEach((m) => header2.push(`${m} Seg`));
    }
    rows.push(header2);

    // Data rows — one per line
    for (const lineName of sortedLines) {
      const yearMap = linesByName.get(lineName)!;
      const row: unknown[] = [lineName];

      for (const year of years) {
        const opsdays = this.getOperationsDays(results, year);
        const ld = yearMap.get(year);
        row.push(Math.round(ld?.timeUsedDaily ?? 0));
        row.push(parseFloat((ld?.utilizationPercent ?? 0).toFixed(2)));

        const byModel = new Map((ld?.assignments ?? []).map((a) => [a.modelName, a]));
        sortedModels.forEach((m) => {
          const a = byModel.get(m);
          row.push(a ? Math.round(a.allocatedUnitsDaily * opsdays) : 0);
        });
        sortedModels.forEach((m) => {
          const a = byModel.get(m);
          row.push(a ? Math.round(a.timeRequiredSeconds * opsdays) : 0);
        });
      }
      rows.push(row);
    }

    // ---- Validation rows (mirrors ValidationRows UI component) ----
    // Separator
    rows.push([]);

    const validationByYear = new Map<number, ModelValidation[]>();
    for (const year of years) {
      validationByYear.set(year, this.computeValidation(results, area, year));
    }

    const validationRowDefs: { label: string; field: keyof ModelValidation | 'status' }[] = [
      { label: 'Sigma DISTRIBUIDO', field: 'distributedUnits' },
      { label: 'VOLUMEN (BD)',       field: 'volumeUnitsAnnual' },
      { label: 'COBERTURA',         field: 'coveragePercent' },
      { label: 'ESTADO',            field: 'status' },
    ];

    for (const { label, field } of validationRowDefs) {
      const row: unknown[] = [label];
      for (const year of years) {
        const validations = validationByYear.get(year) ?? [];
        const byModel = new Map(validations.map((v) => [v.modelName, v]));

        row.push('-');  // Tiempo Util. — N/A
        row.push('-');  // Util. %      — N/A

        sortedModels.forEach((m) => {
          const v = byModel.get(m);
          if (!v) { row.push('-'); return; }
          switch (field) {
            case 'distributedUnits':  row.push(Math.round(v.distributedUnits)); break;
            case 'volumeUnitsAnnual': row.push(Math.round(v.volumeUnitsAnnual)); break;
            case 'coveragePercent':   row.push(`${v.coveragePercent.toFixed(1)}%`); break;
            case 'status':            row.push(VALIDATION_LABELS[v.status]); break;
            default: row.push('-');
          }
        });

        // Seg columns — N/A for validation rows
        sortedModels.forEach(() => row.push('-'));
      }
      rows.push(row);
    }

    const sheetName = `Results_${area.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25)}`;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }

  private addSummarySheet(
    wb: XLSX.WorkBook,
    results: OptimizationResult,
    area: string,
    years: number[]
  ): void {
    const { linesByName, sortedLines } = this.buildLineData(results, area);

    const rows: unknown[][] = [];
    rows.push([`Tabla de Resumen — ${area}`]);
    rows.push([]);

    const header: unknown[] = ['Linea'];
    years.forEach((y) => header.push(`${y} Total Piezas`));
    years.forEach((y) => header.push(`${y} Total Segundos`));
    years.forEach((y) => header.push(`${y} Utilizacion (%)`));
    years.forEach((y) => header.push(`${y} C/O Impact (%)`));
    rows.push(header);

    for (const lineName of sortedLines) {
      const yearMap = linesByName.get(lineName)!;
      const row: unknown[] = [lineName];

      years.forEach((year) => {
        const opsdays = this.getOperationsDays(results, year);
        const ld = yearMap.get(year);
        const total = ld?.assignments.reduce((s, a) => s + a.allocatedUnitsDaily * opsdays, 0) ?? 0;
        row.push(Math.round(total));
      });
      years.forEach((year) => {
        const opsdays = this.getOperationsDays(results, year);
        const ld = yearMap.get(year);
        const total = ld?.assignments.reduce((s, a) => s + a.timeRequiredSeconds * opsdays, 0) ?? 0;
        row.push(Math.round(total));
      });
      years.forEach((year) => {
        const ld = yearMap.get(year);
        row.push(parseFloat((ld?.utilizationPercent ?? 0).toFixed(1)));
      });
      years.forEach((year) => {
        const ld = yearMap.get(year);
        const impact = ld?.changeover?.changeoverImpactPercent;
        row.push(impact != null ? parseFloat(impact.toFixed(1)) : '-');
      });

      rows.push(row);
    }

    const sheetName = `Summary_${area.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24)}`;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }

  private addUnfulfilledDemandSheet(
    wb: XLSX.WorkBook,
    results: OptimizationResult,
    sortedAreas: string[]
  ): void {
    const rows: unknown[][] = [];

    rows.push(['Unfulfilled Demand — Detail by Model']);
    rows.push([`Generated: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`]);
    rows.push([]);
    rows.push([
      'Area', 'Model', 'Year',
      'Demand/Day', 'Allocated/Day', 'Unfulfilled/Day',
      'Unfulfilled/Year', 'Fulfillment %', 'Status',
    ]);

    for (const area of sortedAreas) {
      for (const yr of results.yearResults.slice().sort((a, b) => a.year - b.year)) {
        const opsdays = yr.summary.operationsDays ?? 240;

        // unfulfilledDemand contains only models with unmet demand; use it as the detail source
        const areaUnfulfilled = yr.unfulfilledDemand.filter((u) => u.area === area);

        if (!areaUnfulfilled.length) {
          // All models fully satisfied — emit a summary row
          const areaSummary = yr.areaSummary.find((s) => s.area === area);
          rows.push([
            area,
            '(all models)',
            yr.year,
            '-', '-', 0, 0,
            parseFloat((areaSummary?.fulfillmentPercent ?? 100).toFixed(1)),
            'OK',
          ]);
          continue;
        }

        // Sort worst fulfillment first
        const sorted = areaUnfulfilled.slice().sort((a, b) => a.fulfillmentPercent - b.fulfillmentPercent);

        for (const u of sorted) {
          const status = this.getValidationStatus(u.fulfillmentPercent / 100);
          rows.push([
            area,
            u.modelName,
            yr.year,
            parseFloat(u.demandUnitsDaily.toFixed(1)),
            parseFloat((u.demandUnitsDaily - u.unfulfilledUnitsDaily).toFixed(1)),
            parseFloat(u.unfulfilledUnitsDaily.toFixed(1)),
            Math.round(u.unfulfilledUnitsYearly ?? u.unfulfilledUnitsDaily * opsdays),
            parseFloat(u.fulfillmentPercent.toFixed(1)),
            VALIDATION_LABELS[status],
          ]);
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Unfulfilled Demand');
  }

  private addOverallSummarySheet(
    wb: XLSX.WorkBook,
    results: OptimizationResult
  ): void {
    const rows: unknown[][] = [];
    rows.push(['Overall Summary']);
    rows.push([]);
    rows.push([
      'Year', 'Avg Util %', 'Overloaded Lines', 'Balanced Lines',
      'Underutilized Lines', 'Demand Fulfillment %', 'Operations Days',
      'Total Lines', 'Total Areas',
    ]);

    for (const yr of results.yearResults.slice().sort((a, b) => a.year - b.year)) {
      const s = yr.summary;
      rows.push([
        yr.year,
        parseFloat(s.averageUtilization.toFixed(1)),
        s.overloadedLines,
        s.balancedLines,
        s.underutilizedLines,
        parseFloat(s.demandFulfillmentPercent.toFixed(1)),
        s.operationsDays ?? 240,
        s.totalLines,
        s.totalAreas,
      ]);
    }

    if (results.yearResults.length) {
      rows.push([]);
      rows.push([
        'ALL YEARS',
        parseFloat(results.overallSummary.averageUtilizationAllYears.toFixed(1)),
        '', '', '', '', '', results.overallSummary.totalLinesAnalyzed, '',
      ]);
    }

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Overall Summary');
  }

  // ---- Validation computation ----

  /**
   * Compute per-model validation data for a given area + year.
   * Uses ModelAssignment.demandUnitsDaily and allocatedUnitsDaily — no DB required.
   * Sums allocated across all lines for each model (matching useValidationCalculator logic).
   */
  private computeValidation(
    results: OptimizationResult,
    area: string,
    year: number
  ): ModelValidation[] {
    const yr = results.yearResults.find((r) => r.year === year);
    if (!yr) return [];

    const opsdays = yr.summary.operationsDays ?? 240;
    const linesInArea = yr.lines.filter((l) => l.area === area);

    // Aggregate per model: sum allocated, take demand from first occurrence
    const modelMap = new Map<string, { name: string; allocatedDaily: number; demandDaily: number }>();

    for (const line of linesInArea) {
      for (const a of line.assignments) {
        const existing = modelMap.get(a.modelId);
        if (existing) {
          existing.allocatedDaily += a.allocatedUnitsDaily;
        } else {
          modelMap.set(a.modelId, {
            name: a.modelName,
            allocatedDaily: a.allocatedUnitsDaily,
            demandDaily: a.demandUnitsDaily,
          });
        }
      }
    }

    const result: ModelValidation[] = [];
    for (const [, m] of modelMap) {
      const distributedUnits = m.allocatedDaily * opsdays;
      const volumeUnitsAnnual = m.demandDaily * opsdays;
      const ratio = volumeUnitsAnnual > 0 ? distributedUnits / volumeUnitsAnnual : 0;
      const coveragePercent = ratio * 100;
      result.push({
        modelName: m.name,
        distributedUnits,
        volumeUnitsAnnual,
        coveragePercent,
        status: this.getValidationStatus(ratio),
        deltaUnits: distributedUnits - volumeUnitsAnnual,
      });
    }

    return result.sort((a, b) => a.modelName.localeCompare(b.modelName));
  }

  // ---- Helpers ----

  private buildSequenceMap(areaSequences: { code: string; sequence: number }[]): Map<string, number> {
    const map = new Map<string, number>();
    areaSequences.forEach((a) => map.set(a.code.toUpperCase(), a.sequence));
    return map;
  }

  private getSortedAreas(results: OptimizationResult, sequenceMap: Map<string, number>): string[] {
    const firstYear = results.yearResults[0];
    if (!firstYear) return [];
    const areas = new Set<string>();
    firstYear.lines.forEach((l) => areas.add(l.area));
    return Array.from(areas).sort((a, b) => {
      const aSeq = sequenceMap.get(a.toUpperCase()) ?? 999;
      const bSeq = sequenceMap.get(b.toUpperCase()) ?? 999;
      if (aSeq !== bSeq) return aSeq - bSeq;
      return a.localeCompare(b);
    });
  }

  private getModelsForArea(results: OptimizationResult, area: string): string[] {
    const models = new Set<string>();
    results.yearResults.forEach((yr) =>
      yr.lines.filter((l) => l.area === area).forEach((l) =>
        l.assignments.forEach((a) => models.add(a.modelName))
      )
    );
    return Array.from(models).sort();
  }

  private buildLineData(
    results: OptimizationResult,
    area: string
  ): {
    linesByName: Map<string, Map<number, OptimizationResult['yearResults'][0]['lines'][0]>>;
    sortedLines: string[];
  } {
    const linesByName = new Map<string, Map<number, OptimizationResult['yearResults'][0]['lines'][0]>>();
    results.yearResults.forEach((yr) => {
      yr.lines.filter((l) => l.area === area).forEach((l) => {
        if (!linesByName.has(l.lineName)) linesByName.set(l.lineName, new Map());
        linesByName.get(l.lineName)!.set(yr.year, l);
      });
    });
    const sortedLines = Array.from(linesByName.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
    return { linesByName, sortedLines };
  }

  private getOperationsDays(results: OptimizationResult, year: number): number {
    const yr = results.yearResults.find((r) => r.year === year);
    return yr?.summary.operationsDays ?? 240;
  }

  private getRiskLevel(percent: number): string {
    if (percent > 100) return 'Overflow';
    if (percent >= 95) return 'Critical';
    if (percent >= 90) return 'Action Req.';
    if (percent >= 80) return 'Monitor';
    return 'Healthy';
  }

  private getValidationStatus(ratio: number): ValidationStatus {
    const t = VALIDATION_THRESHOLDS;
    if (ratio >= t.ok.min && ratio <= t.ok.max) return 'ok';
    if (ratio > t.over.min) return 'over';
    if (ratio >= t.under.min && ratio < t.under.max) return 'under';
    if (ratio >= t.alert.min && ratio < t.alert.max) return 'alert';
    return 'critical';
  }
}

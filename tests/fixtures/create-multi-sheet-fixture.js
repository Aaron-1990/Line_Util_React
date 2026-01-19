// ============================================
// Script to create multi-sheet Excel test fixture
// Run with: node create-multi-sheet-fixture.js
// ============================================

const XLSX = require('xlsx');

// Lines data
const linesData = [
  { 'Line Name': 'Line SMT-1', 'Area': 'SMT', 'Time Available (hours)': 23 },
  { 'Line Name': 'Line SMT-2', 'Area': 'SMT', 'Time Available (hours)': 22.5 },
  { 'Line Name': 'Line ICT-1', 'Area': 'ICT', 'Time Available (hours)': 21.17 },
  { 'Line Name': 'Line ICT-2', 'Area': 'ICT', 'Time Available (hours)': 20 },
  { 'Line Name': 'Line WAVE-1', 'Area': 'WAVE', 'Time Available (hours)': 23 },
];

// Models data
const modelsData = [
  { 'Model Name': 'ECU-2024-A', 'Customer': 'BorgWarner', 'Program': 'EV Program', 'Family': 'ECU 2024', 'Annual Volume': 50000, 'Operations Days': 250, 'Active': true },
  { 'Model Name': 'ECU-2024-B', 'Customer': 'Tesla', 'Program': 'Hybrid', 'Family': 'ECU 2024', 'Annual Volume': 30000, 'Operations Days': 300, 'Active': true },
  { 'Model Name': 'DCM-2025-A', 'Customer': 'Ford', 'Program': 'F-150 EV', 'Family': 'DCM 2025', 'Annual Volume': 75000, 'Operations Days': 250, 'Active': true },
  { 'Model Name': 'INV-2024-X', 'Customer': 'GM', 'Program': 'Ultium', 'Family': 'Inverter', 'Annual Volume': 100000, 'Operations Days': 280, 'Active': true },
  { 'Model Name': 'OBC-2025-B', 'Customer': 'Rivian', 'Program': 'R1T', 'Family': 'OBC', 'Annual Volume': 25000, 'Operations Days': 220, 'Active': true },
];

// Compatibilities data
const compatibilitiesData = [
  { 'Line Name': 'Line SMT-1', 'Model Name': 'ECU-2024-A', 'Cycle Time (sec)': 45, 'Efficiency (%)': 85, 'Priority': 1 },
  { 'Line Name': 'Line SMT-1', 'Model Name': 'ECU-2024-B', 'Cycle Time (sec)': 50, 'Efficiency (%)': 82, 'Priority': 2 },
  { 'Line Name': 'Line SMT-2', 'Model Name': 'DCM-2025-A', 'Cycle Time (sec)': 60, 'Efficiency (%)': 88, 'Priority': 1 },
  { 'Line Name': 'Line SMT-2', 'Model Name': 'INV-2024-X', 'Cycle Time (sec)': 55, 'Efficiency (%)': 90, 'Priority': 2 },
  { 'Line Name': 'Line ICT-1', 'Model Name': 'ECU-2024-A', 'Cycle Time (sec)': 30, 'Efficiency (%)': 90, 'Priority': 1 },
  { 'Line Name': 'Line ICT-1', 'Model Name': 'ECU-2024-B', 'Cycle Time (sec)': 32, 'Efficiency (%)': 88, 'Priority': 2 },
  { 'Line Name': 'Line ICT-2', 'Model Name': 'DCM-2025-A', 'Cycle Time (sec)': 28, 'Efficiency (%)': 92, 'Priority': 1 },
  { 'Line Name': 'Line ICT-2', 'Model Name': 'OBC-2025-B', 'Cycle Time (sec)': 35, 'Efficiency (%)': 85, 'Priority': 2 },
  { 'Line Name': 'Line WAVE-1', 'Model Name': 'ECU-2024-A', 'Cycle Time (sec)': 20, 'Efficiency (%)': 95, 'Priority': 1 },
  { 'Line Name': 'Line WAVE-1', 'Model Name': 'INV-2024-X', 'Cycle Time (sec)': 25, 'Efficiency (%)': 93, 'Priority': 2 },
];

// Create workbook
const wb = XLSX.utils.book_new();

// Add Lines sheet
const linesSheet = XLSX.utils.json_to_sheet(linesData);
XLSX.utils.book_append_sheet(wb, linesSheet, 'Lines');

// Add Models sheet
const modelsSheet = XLSX.utils.json_to_sheet(modelsData);
XLSX.utils.book_append_sheet(wb, modelsSheet, 'Models');

// Add Compatibilities sheet
const compatSheet = XLSX.utils.json_to_sheet(compatibilitiesData);
XLSX.utils.book_append_sheet(wb, compatSheet, 'Compatibilities');

// Write file
XLSX.writeFile(wb, 'multi-sheet-production-data.xlsx');
console.log('Created: multi-sheet-production-data.xlsx');

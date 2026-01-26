#!/usr/bin/env node
// ============================================
// Script to add Areas sheet to Excel file
// Usage: node scripts/add-areas-sheet.js [input-file] [output-file]
// ============================================

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Default file paths
const DEFAULT_INPUT = path.join(__dirname, '../tests/fixtures/Copia de multi-year-production-data(Rev3).xlsx');
const DEFAULT_OUTPUT = path.join(__dirname, '../tests/fixtures/Copia de multi-year-production-data(Rev4).xlsx');

const inputFile = process.argv[2] || DEFAULT_INPUT;
const outputFile = process.argv[3] || DEFAULT_OUTPUT;

console.log('📄 Adding Areas sheet to Excel file');
console.log(`   Input:  ${inputFile}`);
console.log(`   Output: ${outputFile}`);

// Read the workbook
if (!fs.existsSync(inputFile)) {
  console.error(`❌ Input file not found: ${inputFile}`);
  process.exit(1);
}

const workbook = XLSX.read(fs.readFileSync(inputFile), { type: 'buffer' });

// Check if Areas sheet already exists
if (workbook.SheetNames.some(name => name.toLowerCase().includes('area'))) {
  console.log('⚠️  Areas sheet already exists, skipping creation');
  console.log('   Copying file without changes...');
  fs.copyFileSync(inputFile, outputFile);
  console.log(`✅ File copied to: ${outputFile}`);
  process.exit(0);
}

// Extract unique areas from Lines sheet
const linesSheetNames = ['Lines', 'lines', 'Lineas', 'lineas'];
let linesSheet = null;

for (const name of workbook.SheetNames) {
  if (linesSheetNames.some(n => name.toLowerCase().includes(n.toLowerCase()))) {
    linesSheet = workbook.Sheets[name];
    break;
  }
}

const uniqueAreas = new Set();
if (linesSheet) {
  const data = XLSX.utils.sheet_to_json(linesSheet, { header: 1 });
  const headers = data[0] || [];
  const areaIndex = headers.findIndex(h => h && h.toLowerCase().includes('area'));

  if (areaIndex >= 0) {
    for (let i = 1; i < data.length; i++) {
      const area = data[i]?.[areaIndex];
      if (area && typeof area === 'string' && area.trim()) {
        uniqueAreas.add(area.trim().toUpperCase());
      }
    }
  }
}

console.log(`   Found ${uniqueAreas.size} unique areas in Lines sheet`);

// Create Areas sheet data
// Default manufacturing flow order - user can modify
const defaultFlowOrder = {
  'SMT': 1,
  'WAVE': 2,
  'ICT': 3,
  'CONFORMAL': 4,
  'ROUTER': 5,
  'FINAL ASSEMBLY': 6,
  'FINAL ASSY': 6,
  'ASSEMBLY': 7,
  'TEST': 8,
};

const defaultColors = {
  'SMT': '#34d399',
  'WAVE': '#fbbf24',
  'ICT': '#60a5fa',
  'CONFORMAL': '#f472b6',
  'ROUTER': '#a78bfa',
  'FINAL ASSEMBLY': '#f87171',
  'FINAL ASSY': '#f87171',
  'ASSEMBLY': '#f472b6',
  'TEST': '#a78bfa',
};

// Build areas data
const areasData = [
  ['Area Code', 'Area Name', 'Sequence', 'Color'],
];

// Sort areas by default flow order, then alphabetically for unknown areas
const sortedAreas = Array.from(uniqueAreas).sort((a, b) => {
  const seqA = defaultFlowOrder[a] ?? 999;
  const seqB = defaultFlowOrder[b] ?? 999;
  if (seqA !== seqB) return seqA - seqB;
  return a.localeCompare(b);
});

let sequence = 1;
for (const area of sortedAreas) {
  const seq = defaultFlowOrder[area] ?? sequence++;
  const color = defaultColors[area] || '#9ca3af';
  areasData.push([area, area, seq, color]);
}

console.log('   Creating Areas sheet with default process flow order:');
sortedAreas.forEach((area, idx) => {
  console.log(`     ${idx + 1}. ${area} (sequence: ${areasData[idx + 1][2]})`);
});

// Create new worksheet
const areasSheet = XLSX.utils.aoa_to_sheet(areasData);

// Add to workbook at the beginning
const newSheetNames = ['Areas', ...workbook.SheetNames];
workbook.SheetNames = newSheetNames;
workbook.Sheets['Areas'] = areasSheet;

// Write the workbook
XLSX.writeFile(workbook, outputFile);

console.log(`\n✅ Excel file updated successfully!`);
console.log(`   Output file: ${outputFile}`);
console.log('\n📝 The Areas sheet defines the manufacturing process flow order.');
console.log('   Modify the Sequence column to change the order.');
console.log('   Lower sequence numbers appear first (upstream processes).');
console.log('   Example flow: SMT (1) → WAVE (2) → ICT (3) → ... → FINAL ASSEMBLY (6)');

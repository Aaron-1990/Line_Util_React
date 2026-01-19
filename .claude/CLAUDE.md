# Line Optimizer - Claude CLI Knowledge Base

## Multi-Sheet Excel Import
- **Specification**: `docs/specs/multi-sheet-excel-import.md`
- **Status**: Ready for implementation
- **Agent**: `@fullstack-developer` (recommended) or `@backend-architect` → `@frontend-developer` (split approach)
- **Priority**: High
- **Designed**: 2026-01-19
- **Context**: Extends existing single-sheet Excel import to support importing Lines, Models, and Compatibilities from a single multi-sheet Excel file. Critical for loading complete datasets needed by Python optimization algorithm.
- **Estimated Complexity**: Complex (12 bloques, 2-3 semanas manual, 2-3 horas con CLI)

### Business Value
Enables rapid data loading for production line optimization analysis. Current manual process takes hours; multi-sheet import reduces to <5 minutes. Essential for Phase 4 (Python Integration) where algorithm requires complete dataset (Lines + Models + Compatibilities).

### Technical Highlights
- **3 new database tables**: product_models, line_model_compatibilities (with foreign keys)
- **Cross-sheet validation**: Detects invalid references between sheets
- **Transactional import**: Rollback on error, no partial data
- **Backward compatible**: Single-sheet import still works
- **Performance**: <2s for 1,000 rows total

### Dependencies
- Requires: Phase 3.1-3.3 (Single-Sheet Import) ✅ completed
- Blocks: Phase 4 (Python Integration) until complete
- Python algorithm: `main_5.py` expects data structure defined here

### Architecture Decisions
- **No Processes table**: Algorithm assigns by individual line, not sequential flow
- **Volumes in Models**: Simplifies import (Annual Volume + Operations Days)
- **Efficiency in Compatibilities**: OEE varies by line-model pair
- **Priority in Compatibilities**: Same model, different priority per line

### Implementation Command

**Full-stack approach (recommended)**:
```bash
cd ~/projects/line-optimizer

claude "@fullstack-developer implement multi-sheet-excel-import according to docs/specs/multi-sheet-excel-import.md. Apply contracts-first methodology with checkpoints after each block. Use Framework Híbrido v2.0."
```

**Split approach (backend first, then frontend)**:
```bash
# Step 1: Backend (Blocks 1-5)
claude "@backend-architect implement multi-sheet import backend (Blocks 1-5) according to docs/specs/multi-sheet-excel-import.md. Focus on database migration, domain entities, repositories, parsers, validators, and IPC handlers."

# Step 2: Frontend (Blocks 6-9)
claude "@frontend-developer implement multi-sheet import UI (Blocks 6-9) according to docs/specs/multi-sheet-excel-import.md. Use TypeScript types from backend. Extend ImportWizard with SheetSelector, multi-sheet validation display, and progress tracking."

# Step 3: Testing (Block 10)
claude "@test-generator implement integration tests (Block 10) according to docs/specs/multi-sheet-excel-import.md. Coverage target >80%."
```

### Post-Implementation Verification

```bash
# 1. Type check
npm run type-check

# 2. Run tests
npm test

# 3. Manual verification
npm start
# Import test fixture: tests/fixtures/multi-sheet-production-data.xlsx
# Verify in DB:
sqlite3 ~/Library/Application\ Support/Line\ Optimizer/line-optimizer.db << 'EOF'
SELECT COUNT(*) as lines FROM production_lines;
SELECT COUNT(*) as models FROM product_models;
SELECT COUNT(*) as compatibilities FROM line_model_compatibilities;
EOF

# 4. Test Python integration
cd python
python src/main_5.py
# Expected: Algorithm runs, calculates line utilization
```

### Success Metrics
- [ ] All 3 sheets import successfully
- [ ] Cross-sheet validation detects invalid references
- [ ] Transactional rollback works (no partial data on error)
- [ ] Performance: <2s for 1,000 rows
- [ ] Test coverage >80%
- [ ] Backward compatible with single-sheet import
- [ ] Python algorithm runs with imported data

### Related Features
- **Phase 3.1-3.3**: Single-Sheet Excel Import (prerequisite)
- **Phase 4**: Python Integration (depends on this)
- **Future**: Excel Export functionality

---

## Project Context

**Line Optimizer** is a desktop application for optimizing production line utilization in electronics manufacturing at BorgWarner.

**Tech Stack**:
- Electron 28 + React 18 + TypeScript
- SQLite (local database)
- Zustand (state management)
- ReactFlow (canvas)
- Vite (build)

**Current Phase**: 3.4 (Multi-Sheet Excel Import)

**Developer**: Aaron Zapata (Supervisor Industrial Engineering, BorgWarner)

**Development Framework**: Híbrido v2.0 (Contracts-First + Checkpoints + Alternate Flows)

# Architectural Migrations: Checklist Especial

> Extracted from global Framework Hibrido v2.1 — applies to Line Optimizer.
> For the generic framework methodology, see `~/.claude/CLAUDE.md`.
> Last updated: 2026-03-05

---

## Contexto

Migraciones arquitectonicas (cambiar DB schema, refactorizar state management, unificar sistemas duplicados) son **HIGH-RISK, HIGH-REWARD**.

**Riesgo:** Romper features existentes, crear dual sources of truth, dejar migracion a medias
**Reward:** Arquitectura limpia, menos tech debt, features futuros mas rapidos

---

## Senales de que Necesitas Migracion Arquitectonica

- Codigo nuevo y viejo coexisten (production_lines VIEW + canvas_objects)
- Mismo dato existe en multiples lugares (ReactFlow nodes + Zustand store)
- Workarounds acumulados para mantener compatibilidad
- "Temporal" solutions que llevan meses
- Edge cases explotan por inconsistencias (Bug 5: Mac wake)

---

## BLOQUE 0 Extendido para Migraciones (OBLIGATORIO)

Ademas del BLOQUE 0 normal, agregar:

### Pre-Migration Audit

```bash
# 1. Identificar TODOS los archivos que usan sistema viejo
rg "production_lines|old_system_name" --type ts

# 2. Contar referencias
rg "production_lines" --type ts | wc -l

# 3. Identificar VIEWs, tablas, stores afectados
sqlite3 db.sqlite "SELECT * FROM sqlite_master WHERE type='view';"

# 4. Buscar edge cases documentados
rg "Bug.*|TODO.*migration|FIXME.*legacy" docs/
```

### Definir Strategy

- [ ] **Scope:** Cuantos archivos? Cuantas tablas/stores?
- [ ] **Order:** Del menos al mas riesgoso (repositories → handlers → UI)
- [ ] **Rollback:** Git tag checkpoint ANTES de empezar
- [ ] **Incremental:** UN archivo/tabla a la vez, commit despues de cada uno
- [ ] **Compatibility:** Mantener sistema viejo hasta que TODO este migrado?
- [ ] **Timeline:** Tiempo estimado? Podemos completar sin interrupciones?

### Dual Source of Truth Analysis

```markdown
## Current Architecture (Pre-Migration)

Source of Truth A: [old system]
├── Used by: [list files]
├── Updated by: [list operations]
└── Edge cases: [list scenarios]

Source of Truth B: [new system]
├── Used by: [list files]
├── Updated by: [list operations]
└── Edge cases: [list scenarios]

Conflicts:
- [ ] Scenario 1: [describe conflict]
- [ ] Scenario 2: [describe conflict]
```

### Regression Test Definition

```markdown
## Critical Workflows (Must NOT break)

1. [Workflow name]
   - Steps: [1, 2, 3...]
   - Expected: [result]
   - Tests: [old system, new system, hybrid state]
```

---

## BLOQUE 1-N: Incremental Migration

Para CADA archivo/tabla a migrar:

```markdown
#### BLOQUE [N]: Migrate [filename]
**Risk level:** Low | Medium | High
**Dependencies:** [files that depend on this]
**Affected systems:** [list]

**Changes:**
- [specific change 1]
- [specific change 2]

**CHECKPOINT Integrado:**
```bash
# 1. Type-check
npm run type-check

# 2. Test affected workflow
[specific test commands]

# 3. Verify no regressions
[regression test commands]

# 4. Commit if pass
git add [filename]
git commit -m "refactor: migrate [filename] from [old] to [new]"
```

**Rollback if fails:**
```bash
git revert HEAD
```
```

---

## BLOQUE FINAL: Cleanup & Verification

```markdown
## Post-Migration Cleanup

- [ ] Remove old system (VIEWs, tables, deprecated stores)
- [ ] Grep: old system NO aparece en codigo
  ```bash
  rg "production_lines|old_system" --type ts
  # Expected: 0 matches (except in archived migrations)
  ```
- [ ] Update documentation (README, CHANGELOG)
- [ ] Run FULL regression suite
- [ ] Performance comparison: new >= old
- [ ] Remove "compatibility" code/comments
```

---

## Safety Protocols (CRITICAL)

### ANTES de Empezar:

```bash
# 1. Commit todo trabajo pendiente
git status  # debe estar limpio

# 2. Crear checkpoint tag
git tag -a v[version]-pre-[migration-name] -m "Safety checkpoint before [migration]"

# 3. Push checkpoint
git push origin v[version]-pre-[migration-name]
```

### DURANTE Migracion:

- ✅ UN archivo a la vez
- ✅ Commit despues de cada archivo que pase tests
- ✅ Si un BLOQUE falla, revert ese commit (NO todo)
- ✅ Tests ANTES de siguiente archivo
- ❌ NUNCA cambiar 10+ archivos en un commit
- ❌ NUNCA eliminar sistema viejo hasta que nuevo este 100% migrado

### SI Falla Completamente:

```bash
# Rollback a checkpoint
git reset --hard v[version]-pre-[migration-name]

# O usa branch experimental
git checkout -b experiment/[migration-name]
# Si funciona: merge
# Si falla: delete branch, stay on main
```

---

## Caso de Estudio: Phase 7.5 (Line Optimizer)

**Migracion:** `production_lines` table → `canvas_objects` polymorphic system

**Estado final:**
- ✅ Migration 017 ejecutada (data migrated, VIEW created)
- ✅ 12+ archivos TS migrados al nuevo sistema
- ✅ VIEW eliminada en Phase 7.5

**Lecciones:**
1. VIEW solo funciona para SELECT, falla en DELETE/UPDATE — migrar codigo ANTES de eliminar VIEW
2. Migrar incremental (repos → handlers → UI) reduce riesgo
3. Commit despues de cada archivo facilita rollback selectivo

**Post-mortem completo:** `docs/phases/phase-7.5-post-mortem.md`

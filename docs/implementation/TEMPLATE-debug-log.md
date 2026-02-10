# Phase X.Y - Debug Log

> **Template para documentación en tiempo real durante implementación**
> **Copiar este archivo como:** `phase-X.Y-feature-name-debug-log.md`

---

## Metadata

**Feature:** [Nombre del feature]
**Start Date:** YYYY-MM-DD HH:MM
**Estimated Duration:** X horas
**Status:** In Progress / Complete
**Agent:** [Agent principal usado]

---

## Timeline

### [HH:MM] Phase Started
**Goal:** [Objetivo principal de la fase]
**Approach:** [Estrategia general]
**Files to modify:** (estimado)
- src/main/...
- src/renderer/...

---

### [HH:MM] BLOQUE 0 - Contracts Defined
**Interfaces created:**
```typescript
// Interfaces principales
```
**IPC channels:** (si aplica)
- CHANNEL_NAME: 'channel:name'
**Checkpoint:** ✅ / ❌ npm run type-check

---

### [HH:MM] BLOQUE 1 - [Nombre]
**Action:** [Qué se implementó]
**Files:**
- path/to/file.ts (+XX lines)
**Result:** ✅ / ❌ [Resultado]
**Checkpoint:** ✅ / ❌ [Comando de validación]

---

### [HH:MM] 🔴 Bug/Issue Encontrado
**Symptom:** [Descripción del problema]
**Expected:** [Comportamiento esperado]
**Actual:** [Comportamiento real]
**Terminal log:**
```
[Copy-paste log importante del terminal]
```
**Impact:** [Bloqueante / No bloqueante]

---

### [HH:MM] Debug Attempt 1
**Approach:** [Qué se intentó]
**Code changed:**
```typescript
// Código relevante
```
**Result:** ✅ / ❌ [Funcionó o no]
**Why it failed:** [Si falló, por qué]
**Insight:** [Qué aprendimos]

---

### [HH:MM] 🤔 Decisión Arquitectónica
**Context:** [Situación que requiere decisión]
**Options considered:**
1. Option A - [Pro/Con]
2. Option B - [Pro/Con]
**Decision:** [Qué se eligió y por qué]
**ADR created:** (si aplica) docs/architecture/adr/adr-XXX-name.md

---

### [HH:MM] ✅ Solution Found
**Final approach:** [Qué funcionó]
**Code:**
```typescript
// Solución final
```
**Result:** ✅ [Descripción del éxito]
**Time spent debugging:** X min/horas
**Attempts:** N

---

### [HH:MM] BLOQUE FINAL - Testing
**Test 1:** [Nombre del test]
- Steps: [Pasos]
- Expected: [Resultado esperado]
- Actual: ✅ / ❌ [Resultado real]

**Test 2:** [Nombre del test]
- Steps: [Pasos]
- Expected: [Resultado esperado]
- Actual: ✅ / ❌ [Resultado real]

---

### [HH:MM] Phase Complete
**Status:** ✅ Complete / ⚠️ Partial / ❌ Blocked
**Checkpoint:** ✅ All tests passed
**Next steps:** [Si hay pending items]

---

## Summary

### Metrics
- **Total time:** X horas
  - Design/Planning: Xh
  - Implementation: Xh
  - Debugging: Xh (XX% of total)
- **Files modified:** N
- **Lines changed:** +XXX / -YYY
- **Debug attempts:** N
- **Tests passed:** M/N

### Key Learnings
1. [Learning 1]
2. [Learning 2]
3. [Learning 3]

### Blockers Encountered
- [Blocker 1] - Resolved by [solución]
- [Blocker 2] - Resolved by [solución]

### Technical Debt Created
- [ ] [Item 1 to fix later]
- [ ] [Item 2 to fix later]

---

## Notes

**Important decisions:**
- [Decision 1 with rationale]
- [Decision 2 with rationale]

**Terminal logs saved:**
- See [HH:MM] entries above for important logs

**Related ADRs:**
- docs/architecture/adr/adr-XXX-name.md

---

**Consolidation:**
- [ ] Copy timeline to docs/phases/phase-X.Y.md
- [ ] Update docs/CHANGELOG-PHASES.md
- [ ] Link ADRs in phase doc
- [ ] Commit all changes

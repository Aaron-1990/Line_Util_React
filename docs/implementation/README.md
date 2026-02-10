# Implementation Folder

> **Purpose:** Real-time documentation during feature implementation

---

## What Goes Here

**Debug logs for phases in progress:**
- `phase-8.2-close-project-debug-log.md`
- `phase-9-pdf-reports-debug-log.md`

**NOT here:**
- ❌ Final documentation (goes in `docs/phases/`)
- ❌ Specifications (goes in `docs/specs/`)
- ❌ Testing guides (goes in `docs/testing/`)

---

## How to Use

### 1. Starting a New Phase

**If phase is complex (> 3 hours, involves debugging):**

```bash
# Copy template
cp docs/implementation/TEMPLATE-debug-log.md \
   docs/implementation/phase-X.Y-feature-name-debug-log.md

# Edit metadata
# Start working
```

**If phase is simple (< 1 hour, straightforward):**
- Skip debug log
- Document directly in `docs/phases/phase-X.Y.md` at the end

### 2. During Implementation

**Update debug log when:**
- ✅ You complete a BLOQUE (~1 hour of work)
- ✅ You find a bug
- ✅ You resolve a bug
- ✅ Terminal shows important logs (copy-paste them!)
- ✅ You make an architectural decision

**Don't update for:**
- ❌ Every line of code
- ❌ Syntax errors
- ❌ While thinking

**Frequency:** Every ~1 hour or when something significant happens

### 3. After Phase Complete

**Consolidation process:**

1. Read your debug log
2. Copy timeline to `docs/phases/phase-X.Y-feature.md`
3. Add narrative and context
4. Link any ADRs created
5. Update `docs/CHANGELOG-PHASES.md`
6. Delete or archive debug log (optional)

**Time saved:** ~1.5 hours (30 min consolidating vs 2 hours remembering)

---

## Template Guide

### TEMPLATE-debug-log.md

**Sections to fill:**

| Section | When | Required |
|---------|------|----------|
| Metadata | Start of phase | ✅ Yes |
| Timeline entries | Every ~1 hour | ✅ Yes |
| Bug/Debug sections | When debugging | Only if debugging |
| Decisions | When deciding | Only if major decision |
| Summary | End of phase | ✅ Yes |

**Keep it simple:**
- Timestamp + what happened (1-2 lines)
- Copy-paste important terminal logs
- Write insights immediately (fresh memory)

---

## Example: Phase 8.1 (Retrospective)

**What we SHOULD have logged:**

```markdown
# Phase 8.1 - Debug Log

[14:00] Started implementation
[15:00] Backend complete ✅
[16:00] Frontend complete ✅
[16:30] Bug: plantas persisten despues restart
[16:45] Intento 1: clear despues Save As → .lop vacio ❌
[17:00] Terminal: "Active database switched to: test.lop"
[17:15] Insight: getInstance() cambia con replaceInstance()
[17:30] Intento 2: clear antes Save As → .lop sin datos ❌
[17:45] Decision: path-based clearing (crear ADR-008)
[18:00] Intento 3: clear por path → Funciona ✅

Summary:
- 6 horas total
- 3 intentos debugging
- Solucion: path-based clearing
```

**Result:** 30 min consolidando vs 2 horas recordando

---

## Current Files

| File | Phase | Status | Notes |
|------|-------|--------|-------|
| TEMPLATE-debug-log.md | N/A | Template | Copy this for new phases |
| (none yet) | - | - | First debug log will be Phase 8.2+ |

---

## Guidelines

### When to Create Debug Log

**✅ Create for:**
- Phases > 3 hours
- Multiple debugging attempts expected
- Architectural decisions needed
- > 10 files modified

**❌ Skip for:**
- Simple changes (< 1 hour)
- Everything works first try
- Trivial bug fixes

### What Makes a Good Entry

**Good entries:**
```markdown
[15:30] Bug: type error in FeaturePage.tsx:45
[15:45] Fixed: added null check to response.data
[16:00] Checkpoint passed ✅
```

**Bad entries:**
```markdown
[15:30] I am now thinking about the problem
[15:35] Still thinking
[15:40] Maybe I should try something
```

### Integration with Framework

**This follows Framework Híbrido v2.0:**
- BLOQUE 0 → Log contract definition
- BLOQUE 1-N → Log each implementation block
- BLOQUE FINAL → Log testing results
- Document in real-time = Less time at end

---

## Questions?

**"Do I need this for every phase?"**
- No, only complex phases (> 3 hours, debugging expected)

**"How often do I update?"**
- Every ~1 hour or when something significant happens

**"What if I forget to update?"**
- No problem, update when you remember
- Better to have partial log than no log

**"Can I delete debug logs after consolidation?"**
- Yes, they're temporary
- Or keep for reference (up to you)

---

**Created:** 2026-02-08
**Part of:** Framework de Desarrollo Híbrido v2.0
**Standard applies to:** All Aaron's projects

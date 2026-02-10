# Architecture Decision Records (ADR)

> **Purpose:** Document important architectural decisions with context and rationale

---

## What is an ADR?

An **Architecture Decision Record** (ADR) captures:
- **What** decision was made
- **Why** it was chosen
- **What alternatives** were considered and rejected
- **What are the consequences** (good and bad)

---

## When to Create an ADR

### ✅ Create ADR for:

- **Major architectural decisions**
  - Database schema changes
  - IPC communication patterns
  - State management approach
  - Technology selection

- **Non-obvious choices**
  - "Why path-based clearing instead of getInstance()?"
  - "Why Zustand instead of Redux?"
  - "Why SQLite instead of PostgreSQL?"

- **Decisions with trade-offs**
  - Performance vs simplicity
  - Flexibility vs complexity
  - Current needs vs future scalability

### ❌ Don't create ADR for:

- Code style choices (use linter config)
- Trivial decisions with one obvious answer
- Decisions easily reversed (use comments in code)

---

## How to Use

### 1. During Implementation

**When you face an architectural decision:**

```bash
# 1. Stop and think: "Is this a major decision?"
# 2. If yes, create ADR immediately

# Copy template
cp docs/architecture/adr/TEMPLATE-adr.md \
   docs/architecture/adr/adr-008-short-name.md

# 3. Fill out template (5-10 min)
# 4. Link from debug log
# 5. Continue implementation
```

**Timing:** Create ADR WHEN you make the decision, not after.

### 2. Numbering

**Sequential numbering:**
- ADR-001, ADR-002, ADR-003, etc.
- Never reuse numbers
- Gaps are OK (if ADR is deleted/superseded)

**Current number:** (check latest ADR in this folder)

### 3. Status Lifecycle

```
Proposed → Accepted → Deprecated/Superseded
```

**Proposed:** Decision being considered
**Accepted:** Decision approved and implemented
**Deprecated:** No longer valid (explain why)
**Superseded:** Replaced by newer ADR (link to it)

---

## Template Guide

### Essential Sections

| Section | Purpose | Required |
|---------|---------|----------|
| Context | Why this decision needed | ✅ Yes |
| Decision | What we chose | ✅ Yes |
| Alternatives | What we rejected | ✅ Yes |
| Consequences | Trade-offs | ✅ Yes |

### Optional Sections

| Section | When to Use |
|---------|-------------|
| Implementation | Complex changes |
| Validation | Measurable success criteria |
| References | External resources cited |

---

## Example: ADR-008 (From Phase 8.1)

**Context:** After "Save As", we need to clear global DB but active instance switches to .lop.

**Decision:** Use path-based clearing (get path before, clear by path after).

**Alternatives Rejected:**
1. Clear getInstance() after Save As → Clears .lop instead of global DB
2. Clear before Save As → Exports empty data to .lop
3. Track original instance → Instance is closed after replaceInstance()

**Consequences:**
- ✅ Reliable clearing regardless of active instance
- ❌ More complex than simple getInstance()
- ❌ Requires new IPC channel

**See:** `adr-008-path-based-database-clearing.md` (would be created if Phase 8.1 used ADRs)

---

## Current ADRs

| Number | Title | Status | Phase | Date |
|--------|-------|--------|-------|------|
| TEMPLATE | Template | N/A | N/A | 2026-02-08 |
| (none yet) | - | - | - | - |

**Next ADR number:** 001

---

## Integration with Debug Logs

**During implementation:**

1. Face architectural decision
2. Create ADR immediately (5-10 min)
3. Reference ADR in debug log:
   ```markdown
   [15:30] Decision made - Path-based clearing
   ADR: docs/architecture/adr/adr-008-path-based-clearing.md
   ```
4. Link ADR from phase doc later

**Benefits:**
- Decisions documented when fresh
- Rationale captured before implementation
- Future developers see "why not X?"

---

## Best Practices

### Keep It Concise

**Good:**
```markdown
## Decision
Use path-based clearing.

## Alternative 1: Clear getInstance()
Rejected: getInstance() returns .lop after replaceInstance()
```

**Too verbose:**
```markdown
## Decision
After extensive analysis of the singleton pattern and careful
consideration of the implications of mutable state in a
long-running Electron application, we have determined that
the optimal approach involves... [3 paragraphs]
```

### Focus on "Why Not X?"

**The most valuable part of an ADR is explaining rejected alternatives:**

```markdown
## Alternative 1: Track original instance
**Rejected because:** Instance is closed after replaceInstance()

## Alternative 2: Re-open global DB
**Rejected because:** Race condition with app quit
```

**Future developers will think of these same alternatives and wonder why we didn't use them.**

### Update Status When Deprecated

**If ADR becomes obsolete:**

```markdown
# ADR-001: Use SQLite

**Status:** ~~Accepted~~ Superseded by ADR-015 (PostgreSQL migration)
**Superseded:** 2026-03-15
**Reason:** Needed multi-user concurrent access
**See:** docs/architecture/adr/adr-015-postgresql-migration.md
```

---

## Questions?

**"Do I need ADR for every decision?"**
- No, only architectural decisions with trade-offs

**"How long should an ADR be?"**
- 1-2 pages max, focus on "why" not "what"

**"Can I update ADRs?"**
- Metadata/status: Yes
- Decision content: No (create new ADR instead)

**"What if I'm not sure if decision is 'architectural'?"**
- Ask: "Will future developers wonder why we did this?"
- If yes → ADR
- If no → Code comment or skip

---

## Resources

**ADR methodology:**
- https://adr.github.io/
- https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions

**Line Optimizer specific:**
- Framework: `~/.claude/CLAUDE.md` (Global standards)
- Debug logs: `docs/implementation/`
- Phase docs: `docs/phases/`

---

**Created:** 2026-02-08
**Part of:** Framework de Desarrollo Híbrido v2.0
**Standard applies to:** All Aaron's projects

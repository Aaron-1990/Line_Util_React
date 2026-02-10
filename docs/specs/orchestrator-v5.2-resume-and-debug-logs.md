# Orchestrator v5.2: Resume + Auto Debug Logs

> **Specification for upgrading orchestrator.py from v5.0 to v5.2**
> **Created:** 2026-02-08
> **Author:** Aaron Zapata
> **Framework:** Framework de Desarrollo Híbrido v2.0

---

## Metadata

- **Base Version:** v5.0 (orchestrator.py, 1729 lines)
- **Target Version:** v5.2
- **Agent:** general-purpose
- **Estimated Time:** 3-4 hours
- **Complexity:** Medium
- **Breaking Changes:** None (backward compatible)

---

## Executive Summary

Upgrade orchestrator to support:

1. **Resume from checkpoint** - Continue execution from failed BLOQUE without re-running completed work
2. **Auto debug log generation** - Automatically create and populate `docs/implementation/phase-X-debug-log.md` during execution
3. **Error report reading** - Read previous error reports to avoid repeating same mistakes
4. **State persistence** - Save execution state for resume functionality

**User Impact:**
- 40% time savings when phases fail mid-execution (no re-work)
- Automatic documentation of timeline (no manual logging)
- Learning from previous failures (faster convergence)

**Backward Compatibility:**
- All existing specs work without changes
- New features are opt-in via flags
- No breaking changes to current workflow

---

## Table of Contents

1. [Current State (v5.0)](#1-current-state-v50)
2. [Limitations & Pain Points](#2-limitations--pain-points)
3. [Proposed Changes (v5.2)](#3-proposed-changes-v52)
4. [Architecture](#4-architecture)
5. [Implementation BLOQUEs](#5-implementation-bloques)
6. [Testing Strategy](#6-testing-strategy)
7. [Migration Path](#7-migration-path)

---

## 1. Current State (v5.0)

### Code Structure Analysis

**Key Files:**
```
~/.claude/scripts/orchestrator.py (1729 lines)
├── Configuration (lines 60-137)
├── Logging setup (lines 142-218)
├── Data structures (lines 224-290)
│   ├── Agent
│   ├── GapAnalysis
│   ├── Bloque
│   └── SpecValidation
├── Spec parsing (lines 294-485)
├── Agent selection (lines 522-583)
├── Execution (lines 1104-1460)
│   ├── run_bloque_with_retry() - Context-aware retry
│   ├── implement_feature() - Main orchestration loop
│   └── capture_error_report() - Save JSON error reports
└── CLI interface (lines 1587-1729)
```

### Key Functions (v5.0)

#### 1. `implement_feature()` (Line 1175)

**What it does:**
```python
async def implement_feature(spec_path: str, strict: bool = False):
    # 1. Validate spec
    # 2. Run pre-flight type-check
    # 3. Parse BLOQUEs
    # 4. For each BLOQUE:
    #    - Execute with retry
    #    - Run checkpoint
    #    - If fails: save error report and STOP
    # 5. Execute BLOQUE FINAL
    # 6. Display summary
```

**Limitation:** If BLOQUE 3 fails, you must restart from BLOQUE 0.

---

#### 2. `run_bloque_with_retry()` (Line 1104)

**What it does:**
```python
async def run_bloque_with_retry(bloque, agent_name, prompt, max_retries=2):
    for attempt in range(1, max_retries + 1):
        await run_prompt(prompt, agent=agent_name)
        checkpoint_passed, failures = run_checkpoint(bloque)

        if checkpoint_passed:
            return True, []

        # Build NEW prompt with error context
        prompt = f"RETRY: Previous failed with:\n{failures}\n{original_prompt}"

    return False, all_failures
```

**Strength:** Learns within same execution (attempt 1 → attempt 2).

**Limitation:** Does NOT learn between executions (Mon → Tue).

---

#### 3. `capture_error_report()` (Line 1073)

**What it does:**
```python
def capture_error_report(bloque, failures, spec_path, agent_name, attempts):
    report = {
        "timestamp": "...",
        "spec": spec_path,
        "bloque_id": bloque.id,
        "failures": failures,
        "attempts": attempts,
        "checkpoint_commands": bloque.checkpoint_commands
    }

    # Save to: ~/.claude/logs/orchestrator-errors/YYYYMMDD-HHMMSS-bloque-X.json
    report_file.write_text(json.dumps(report, indent=2))
```

**Strength:** Structured error logging.

**Limitation:** Reports are saved but NEVER read by orchestrator.

---

### Current Workflow (v5.0)

```
┌─────────────────────────────────────────────────────────┐
│ orchestrate docs/specs/phase-8.2.md                     │
└─────────────────────────────────────────────────────────┘
           │
           v
    ┌─────────────┐
    │ Validate    │
    │ spec        │
    └──────┬──────┘
           │
           v
    ┌─────────────┐
    │ Pre-flight  │
    │ type-check  │
    └──────┬──────┘
           │
           v
    ┌──────────────────────────────┐
    │ For each BLOQUE (0, 1, 2...):│
    │   1. Execute with agent      │
    │   2. Run checkpoint          │
    │   3. If fail → retry (2x)    │
    │   4. If still fails → STOP   │
    └──────┬───────────────────────┘
           │
           v (all passed)
    ┌─────────────┐
    │ BLOQUE      │
    │ FINAL       │
    └──────┬──────┘
           │
           v
    ┌─────────────┐
    │ Summary     │
    └─────────────┘

ERROR SCENARIO:
BLOQUE 2 fails → orchestrator STOPS → manual fix → RE-RUN FROM BLOQUE 0
```

---

## 2. Limitations & Pain Points

### Limitation 1: No Resume Capability

**Problem:**
```
Phase 8.2 (4 BLOQUEs, 6 hours total):
  [10:00] BLOQUE 0 ✅ (30 min)
  [10:30] BLOQUE 1 ✅ (1 hour)
  [11:30] BLOQUE 2 ✅ (1 hour)
  [12:30] BLOQUE 3 ❌ FAILS (missing dependency)

User fixes manually (30 min)

orchestrate docs/specs/phase-8.2.md
  [14:00] BLOQUE 0 ✅ (30 min) ← RE-WORK!
  [14:30] BLOQUE 1 ✅ (1 hour) ← RE-WORK!
  [15:30] BLOQUE 2 ✅ (1 hour) ← RE-WORK!
  [16:30] BLOQUE 3 ✅ (works now)
  [17:00] BLOQUE FINAL ✅

Total time: 9.5 hours (should be 7 hours)
Wasted: 2.5 hours re-running BLOQUEs 0-2
```

**Impact:** 40% time waste on failed phases.

---

### Limitation 2: No Debug Log Auto-Generation

**Problem:**
```
orchestrate runs for 3 hours → user has NO automatic timeline

User must:
1. Remember what happened 3 hours ago
2. Manually write debug log
3. Spend 2 hours documenting

With auto debug log:
  docs/implementation/phase-8.2-debug-log.md would be created automatically
  [10:00] BLOQUE 0 started
  [10:30] BLOQUE 0 complete ✅
  [10:35] BLOQUE 1 started
  ...
```

**Impact:** 2 hours manual documentation vs 0 hours with auto-gen.

---

### Limitation 3: Error Reports Not Used

**Problem:**
```
Monday:
  orchestrate phase-8.2.md
  BLOQUE 2 fails: "Cannot find module 'some-dep'"
  Error report saved: ~/.claude/logs/.../bloque-2.json

Tuesday (after manual fix):
  orchestrate phase-8.2.md
  orchestrator does NOT read Monday's error report
  orchestrator does NOT know "this failed before"
  orchestrator might suggest same broken approach
```

**Impact:** No learning between executions, repeated mistakes.

---

### Limitation 4: No State Persistence

**Problem:**
```
orchestrator tracks state ONLY in memory:
  completed_bloques = []
  failed_bloques = []

When orchestrator stops:
  State is lost
  No way to know "BLOQUE 0-2 were completed"
```

**Impact:** Can't resume because state isn't saved.

---

## 3. Proposed Changes (v5.2)

### Feature 1: Resume from Checkpoint

**New CLI usage:**
```bash
# First run (fails at BLOQUE 3)
orchestrate docs/specs/phase-8.2.md

# Fix manually with Claude CLI
# ...

# Resume from where it stopped
orchestrate --resume phase-8.2
```

**Behavior:**
```python
orchestrate --resume phase-8.2
  └─ Read state: ~/.claude/state/phase-8.2-state.json
  └─ State shows: {completed: [0, 1, 2], failed: [3], pending: [FINAL]}
  └─ Skip BLOQUEs 0, 1, 2 (already done)
  └─ Retry BLOQUE 3 (was failed)
  └─ Execute BLOQUE FINAL
  └─ Complete!
```

---

### Feature 2: Auto Debug Log Generation

**New behavior:**
```python
orchestrate docs/specs/phase-8.2-close-project.md

# Automatically creates:
docs/implementation/phase-8.2-close-project-debug-log.md

# Populates in real-time:
[10:00] Phase started - Agent: backend-architect
[10:05] BLOQUE 0 - Contracts
  Objective: Define interfaces
  Checkpoint: npm run type-check
  Result: ✅ PASSED (5 min)

[10:30] BLOQUE 1 - Backend
  Objective: Implement handler
  Checkpoint: npm run type-check
  Result: ✅ PASSED (25 min)

[11:00] BLOQUE 2 - Frontend
  Attempt 1: ❌ FAILED
    Error: TS2339: Property not found
  Attempt 2: ✅ PASSED (15 min)

[11:30] BLOQUE FINAL - Testing
  Manual testing complete
  Result: ✅ PASSED

[11:45] Phase complete
Summary:
  - Total time: 1h 45min
  - BLOQUEs: 4/4 passed
  - Retries: 1 (BLOQUE 2)
```

---

### Feature 3: Read Previous Error Reports

**New behavior:**
```python
def prepare_bloque_prompt(bloque):
    # Check for previous error reports
    error_reports = find_error_reports(bloque.id, spec_name)

    if error_reports:
        last_error = error_reports[-1]
        context = f"""
IMPORTANT: This BLOQUE failed in a previous run with:
{last_error['failures']}

Previous attempts: {last_error['attempts']}
Previous agent: {last_error['agent']}

Avoid these approaches that failed before.
"""
        return context + original_prompt

    return original_prompt
```

**Result:** Agent sees past failures and avoids repeating them.

---

### Feature 4: State Persistence

**New state file:**
```json
// ~/.claude/state/phase-8.2-close-project-state.json
{
  "spec_path": "docs/specs/phase-8.2-close-project.md",
  "started_at": "2026-02-09T10:00:00",
  "last_updated": "2026-02-09T12:30:00",
  "status": "incomplete",
  "bloques": [
    {"id": "0", "status": "completed", "completed_at": "2026-02-09T10:30:00", "duration": "30min"},
    {"id": "1", "status": "completed", "completed_at": "2026-02-09T11:30:00", "duration": "1h"},
    {"id": "2", "status": "completed", "completed_at": "2026-02-09T12:30:00", "duration": "1h"},
    {"id": "3", "status": "failed", "failed_at": "2026-02-09T12:30:00", "attempts": 2},
    {"id": "FINAL", "status": "pending"}
  ],
  "debug_log": "docs/implementation/phase-8.2-close-project-debug-log.md"
}
```

---

## 4. Architecture

### New Data Structures

```python
@dataclass
class BloqueExecutionState:
    """Track execution state of a single BLOQUE."""
    id: str
    status: str  # 'pending' | 'running' | 'completed' | 'failed'
    started_at: datetime | None = None
    completed_at: datetime | None = None
    attempts: int = 0
    duration_seconds: int = 0
    failures: list[str] = field(default_factory=list)

@dataclass
class PhaseState:
    """Persistent state for resume functionality."""
    spec_path: str
    phase_name: str
    started_at: datetime
    last_updated: datetime
    status: str  # 'incomplete' | 'complete' | 'failed'
    bloques: list[BloqueExecutionState]
    debug_log_path: str | None = None
    agent_name: str | None = None

    def save(self):
        """Save state to ~/.claude/state/{phase_name}-state.json"""
        state_dir = Path.home() / '.claude' / 'state'
        state_dir.mkdir(parents=True, exist_ok=True)

        state_file = state_dir / f"{self.phase_name}-state.json"
        state_dict = asdict(self)
        state_file.write_text(json.dumps(state_dict, indent=2, default=str))

    @staticmethod
    def load(phase_name: str) -> 'PhaseState | None':
        """Load state from disk."""
        state_file = Path.home() / '.claude' / 'state' / f"{phase_name}-state.json"
        if not state_file.exists():
            return None

        state_dict = json.loads(state_file.read_text())
        # Reconstruct PhaseState from dict
        return PhaseState(**state_dict)
```

---

### New Functions

#### 1. Debug Log Auto-Generation

```python
def create_debug_log(spec_path: str, agent_name: str) -> Path:
    """
    Create debug log from template at start of phase.

    Location: docs/implementation/phase-X-Y-feature-debug-log.md
    """
    phase_name = extract_phase_name(spec_path)
    log_path = Path.cwd() / 'docs' / 'implementation' / f"{phase_name}-debug-log.md"

    # Check if template exists
    template_path = Path.cwd() / 'docs' / 'implementation' / 'TEMPLATE-debug-log.md'

    if template_path.exists():
        # Use template
        template = template_path.read_text()
        content = template.replace("[Feature]", phase_name)
        content = content.replace("[Agent]", agent_name)
        content = content.replace("YYYY-MM-DD HH:MM", datetime.now().strftime("%Y-%m-%d %H:%M"))
    else:
        # Simple default
        content = f"""# {phase_name} - Debug Log

**Start:** {datetime.now().strftime("%Y-%m-%d %H:%M")}
**Agent:** {agent_name}
**Spec:** {spec_path}

## Timeline

"""

    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(content)

    return log_path

def append_debug_log(log_path: Path, entry: str):
    """Append entry to debug log."""
    if not log_path.exists():
        return

    timestamp = datetime.now().strftime("%H:%M")
    content = log_path.read_text()

    # Append to Timeline section
    new_entry = f"\n### [{timestamp}] {entry}\n"
    content += new_entry

    log_path.write_text(content)

def log_bloque_start(log_path: Path, bloque: Bloque, agent: str):
    """Log BLOQUE start."""
    entry = f"""BLOQUE {bloque.id} - {bloque.title}
**Objective:** {bloque.objective}
**Agent:** {agent}
**Checkpoint:** {', '.join(bloque.checkpoint_commands[:2])}..."""

    append_debug_log(log_path, entry)

def log_bloque_result(log_path: Path, bloque: Bloque, success: bool, duration: int, attempts: int = 1):
    """Log BLOQUE result."""
    if success:
        entry = f"BLOQUE {bloque.id} complete ✅ ({duration}min)"
    else:
        entry = f"BLOQUE {bloque.id} failed ❌ (after {attempts} attempts)"

    append_debug_log(log_path, entry)
```

---

#### 2. Resume Functionality

```python
def find_previous_state(spec_path: str) -> PhaseState | None:
    """Find previous incomplete run for this spec."""
    phase_name = extract_phase_name(spec_path)
    return PhaseState.load(phase_name)

async def resume_phase(phase_name: str, strict: bool = False):
    """
    Resume phase from previous incomplete run.

    Workflow:
    1. Load state from ~/.claude/state/{phase_name}-state.json
    2. Skip completed BLOQUEs
    3. Retry failed BLOQUEs
    4. Execute pending BLOQUEs
    5. Update state as we go
    """
    state = PhaseState.load(phase_name)

    if not state:
        print(f"❌ No saved state found for phase: {phase_name}")
        print(f"   Run: orchestrate docs/specs/{phase_name}.md")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  RESUME MODE - {state.phase_name}")
    print(f"{'='*60}")
    print(f"\nPrevious run: {state.started_at}")
    print(f"Status: {state.status}")

    # Show what will be skipped
    completed = [b for b in state.bloques if b.status == 'completed']
    failed = [b for b in state.bloques if b.status == 'failed']
    pending = [b for b in state.bloques if b.status == 'pending']

    print(f"\nCompleted BLOQUEs (will skip): {[b.id for b in completed]}")
    print(f"Failed BLOQUEs (will retry): {[b.id for b in failed]}")
    print(f"Pending BLOQUEs (will execute): {[b.id for b in pending]}")

    # Load spec
    spec_path = Path(state.spec_path)
    spec = spec_path.read_text()
    bloques = parse_bloques(spec)

    # Execute only non-completed BLOQUEs
    for bloque in bloques:
        bloque_state = next((b for b in state.bloques if b.id == bloque.id), None)

        if bloque_state and bloque_state.status == 'completed':
            print(f"\n  ⏩ Skipping BLOQUE {bloque.id} (already completed)")
            continue

        # Execute BLOQUE (retry if failed, fresh if pending)
        print(f"\n{'='*60}")
        print(f"  BLOQUE {bloque.id}: {bloque.title}")
        print(f"{'='*60}")

        # ... rest of execution logic (same as implement_feature)
```

---

#### 3. Error Report Reading

```python
def find_error_reports(bloque_id: str, phase_name: str) -> list[dict]:
    """
    Find previous error reports for this BLOQUE.

    Returns list of error reports sorted by timestamp (oldest first).
    """
    error_dir = Path.home() / '.claude' / 'logs' / 'orchestrator-errors'

    if not error_dir.exists():
        return []

    # Find all error reports for this BLOQUE
    pattern = f"*-bloque-{bloque_id}.json"
    error_files = sorted(error_dir.glob(pattern))

    reports = []
    for file in error_files:
        try:
            report = json.loads(file.read_text())
            # Filter by phase name (if spec path matches)
            if phase_name in report.get('spec', ''):
                reports.append(report)
        except Exception:
            continue

    return reports

def build_error_context(error_reports: list[dict]) -> str:
    """Build context string from previous error reports."""
    if not error_reports:
        return ""

    last_error = error_reports[-1]

    context = f"""
┌─────────────────────────────────────────────────────────┐
│ ⚠️  WARNING: This BLOQUE failed in a previous run       │
└─────────────────────────────────────────────────────────┘

Previous timestamp: {last_error['timestamp']}
Previous agent: {last_error['agent']}
Attempts made: {last_error['attempts']}

ERRORS ENCOUNTERED:
"""
    for failure in last_error['failures']:
        context += f"  - {failure}\n"

    context += """
Avoid these approaches that failed before.
Consider a different implementation strategy.
"""

    return context
```

---

## 5. Implementation BLOQUEs

### BLOQUE 0: Contracts & Architecture

**Objective:** Define new data structures and function signatures.

**Files to modify:**
- `~/.claude/scripts/orchestrator.py`

**New data structures:**
```python
@dataclass
class BloqueExecutionState:
    # ... (see Architecture section)

@dataclass
class PhaseState:
    # ... (see Architecture section)
```

**New function signatures:**
```python
def create_debug_log(spec_path: str, agent_name: str) -> Path
def append_debug_log(log_path: Path, entry: str)
def log_bloque_start(log_path: Path, bloque: Bloque, agent: str)
def log_bloque_result(log_path: Path, bloque: Bloque, success: bool, duration: int, attempts: int)

def find_previous_state(spec_path: str) -> PhaseState | None
async def resume_phase(phase_name: str, strict: bool = False)

def find_error_reports(bloque_id: str, phase_name: str) -> list[dict]
def build_error_context(error_reports: list[dict]) -> str
```

**Checkpoint:**
```bash
python3 -c "import sys; sys.path.insert(0, '/Users/aaronzapata/.claude/scripts'); import orchestrator; print('Imports OK')"
```

**Success Criteria:**
- [ ] New data structures defined
- [ ] New function signatures declared
- [ ] No import errors
- [ ] Backward compatible (existing code still works)

---

### BLOQUE 1: Debug Log Auto-Generation

**Objective:** Implement automatic debug log creation and population.

**Implementation:**

1. Add debug log creation to `implement_feature()`:
```python
async def implement_feature(spec_path: str, strict: bool = False):
    # ... existing validation ...

    # NEW: Create debug log
    debug_log_path = None
    docs_impl_dir = Path.cwd() / 'docs' / 'implementation'

    if docs_impl_dir.exists():
        print("\n  📝 Creating debug log...")
        debug_log_path = create_debug_log(spec_path, agent_name)
        print(f"     {debug_log_path}")

    # ... rest of implementation ...
```

2. Add logging at key points:
```python
# Before BLOQUE execution
if debug_log_path:
    log_bloque_start(debug_log_path, bloque, agent_name)

start_time = time.time()

# Execute BLOQUE
success, failures = await run_bloque_with_retry(...)

duration_min = int((time.time() - start_time) / 60)

# After BLOQUE execution
if debug_log_path:
    log_bloque_result(debug_log_path, bloque, success, duration_min, attempts)
```

3. Implement helper functions:
```python
def create_debug_log(spec_path: str, agent_name: str) -> Path:
    # ... (see Architecture section)

def append_debug_log(log_path: Path, entry: str):
    # ... (see Architecture section)

# etc.
```

**Checkpoint:**
```bash
# Test with a simple spec
orchestrate docs/specs/test-debug-log.md

# Verify debug log created
ls docs/implementation/*-debug-log.md

# Verify content
cat docs/implementation/test-debug-log-debug-log.md | grep "BLOQUE"
```

**Success Criteria:**
- [ ] Debug log created automatically
- [ ] Timeline populated with BLOQUE entries
- [ ] Timestamps are accurate
- [ ] Works when `docs/implementation/` doesn't exist (gracefully skips)

---

### BLOQUE 2: State Persistence

**Objective:** Save execution state to disk for resume functionality.

**Implementation:**

1. Initialize state at start:
```python
async def implement_feature(spec_path: str, strict: bool = False):
    # ... existing code ...

    # NEW: Initialize phase state
    phase_name = extract_phase_name(spec_path)
    phase_state = PhaseState(
        spec_path=str(spec_path),
        phase_name=phase_name,
        started_at=datetime.now(),
        last_updated=datetime.now(),
        status='incomplete',
        bloques=[
            BloqueExecutionState(id=b.id, status='pending')
            for b in bloques
        ],
        debug_log_path=str(debug_log_path) if debug_log_path else None,
        agent_name=agent_name
    )

    phase_state.save()
```

2. Update state after each BLOQUE:
```python
# After BLOQUE execution
bloque_state = next(b for b in phase_state.bloques if b.id == bloque.id)
bloque_state.started_at = start_time
bloque_state.completed_at = datetime.now()
bloque_state.attempts = attempts
bloque_state.duration_seconds = int(time.time() - start_time_epoch)

if success:
    bloque_state.status = 'completed'
else:
    bloque_state.status = 'failed'
    bloque_state.failures = failures

phase_state.last_updated = datetime.now()
phase_state.save()
```

3. Mark phase complete:
```python
# At end of implement_feature()
if all_bloques_passed:
    phase_state.status = 'complete'
else:
    phase_state.status = 'failed'

phase_state.save()
```

**Checkpoint:**
```bash
# Run orchestrator
orchestrate docs/specs/test-state.md

# Verify state file created
ls ~/.claude/state/*.json

# Verify state content
cat ~/.claude/state/test-state-state.json | jq '.bloques[].status'
```

**Success Criteria:**
- [ ] State file created at start
- [ ] State updated after each BLOQUE
- [ ] State persisted to disk
- [ ] State readable by other process

---

### BLOQUE 3: Resume Functionality

**Objective:** Implement `orchestrate --resume` to continue from checkpoint.

**Implementation:**

1. Add CLI flag:
```python
async def main():
    # ... existing arg parsing ...

    if '--resume' in sys.argv:
        resume_idx = sys.argv.index('--resume')
        phase_name = sys.argv[resume_idx + 1] if resume_idx + 1 < len(sys.argv) else None

        if not phase_name:
            print("Usage: orchestrate --resume <phase-name>")
            print("Example: orchestrate --resume phase-8.2-close-project")
            sys.exit(1)

        strict = '--strict' in sys.argv
        await resume_phase(phase_name, strict=strict)
        return
```

2. Implement `resume_phase()`:
```python
async def resume_phase(phase_name: str, strict: bool = False):
    """Resume from previous incomplete run."""

    # Load state
    state = PhaseState.load(phase_name)
    if not state:
        print(f"❌ No saved state for: {phase_name}")
        sys.exit(1)

    # Display resume summary
    print("\n" + "="*60)
    print(f"  RESUME MODE - {phase_name}")
    print("="*60)

    completed = [b for b in state.bloques if b.status == 'completed']
    failed = [b for b in state.bloques if b.status == 'failed']
    pending = [b for b in state.bloques if b.status == 'pending']

    print(f"\nSkipping completed: {[b.id for b in completed]}")
    print(f"Retrying failed: {[b.id for b in failed]}")
    print(f"Executing pending: {[b.id for b in pending]}")

    # Load spec
    spec_path = Path(state.spec_path)
    spec = spec_path.read_text()
    bloques = parse_bloques(spec)

    # Execute non-completed BLOQUEs
    for bloque in bloques:
        bloque_state = next((b for b in state.bloques if b.id == bloque.id), None)

        if bloque_state and bloque_state.status == 'completed':
            print(f"\n  ⏩ Skipping BLOQUE {bloque.id}")
            continue

        # Execute BLOQUE (same as implement_feature)
        # ... (reuse existing execution logic)
```

**Checkpoint:**
```bash
# Run phase that will fail
orchestrate docs/specs/test-resume.md  # Fails at BLOQUE 2

# Fix manually
# ...

# Resume
orchestrate --resume test-resume

# Verify:
# - BLOQUEs 0, 1 skipped
# - BLOQUE 2 executed
# - BLOQUE FINAL executed
```

**Success Criteria:**
- [ ] `--resume` flag recognized
- [ ] State loaded correctly
- [ ] Completed BLOQUEs skipped
- [ ] Failed/pending BLOQUEs executed
- [ ] Phase completes successfully

---

### BLOQUE 4: Error Report Reading

**Objective:** Read previous error reports to avoid repeating mistakes.

**Implementation:**

1. Check for previous errors before execution:
```python
async def run_bloque_with_retry(...):
    # NEW: Check for previous failures
    phase_name = extract_phase_name(spec_path)  # Need to pass spec_path
    error_reports = find_error_reports(bloque.id, phase_name)

    if error_reports:
        print(f"\n  ⚠️  Found {len(error_reports)} previous error(s) for BLOQUE {bloque.id}")
        error_context = build_error_context(error_reports)
        print(error_context)

        # Prepend error context to prompt
        original_prompt = error_context + "\n" + original_prompt

    # ... rest of retry logic ...
```

2. Implement helper functions (see Architecture section)

**Checkpoint:**
```bash
# Create an error report manually
mkdir -p ~/.claude/logs/orchestrator-errors
cat > ~/.claude/logs/orchestrator-errors/20260209-100000-bloque-2.json << 'EOF'
{
  "timestamp": "20260209-100000",
  "spec": "docs/specs/test-error-reading.md",
  "bloque_id": "2",
  "failures": ["Test failure 1", "Test failure 2"],
  "attempts": 2
}
EOF

# Run orchestrator
orchestrate docs/specs/test-error-reading.md

# Verify agent sees previous error in prompt
# (check logs or debug output)
```

**Success Criteria:**
- [ ] Previous errors detected
- [ ] Error context added to prompt
- [ ] Agent can see and learn from previous failures
- [ ] Works when no previous errors exist

---

### BLOQUE FINAL: Integration & Testing

**Objective:** Test all features together and ensure backward compatibility.

**Integration Tests:**

1. **Test: Simple phase (no failures)**
```bash
orchestrate docs/specs/test-simple.md
# Verify: debug log created, state saved, completes successfully
```

2. **Test: Phase with retry (success on 2nd attempt)**
```bash
orchestrate docs/specs/test-retry.md
# Verify: retry logged, state shows 2 attempts, completes
```

3. **Test: Phase with failure + resume**
```bash
orchestrate docs/specs/test-failure.md  # Fails at BLOQUE 2
# Manually fix
orchestrate --resume test-failure
# Verify: BLOQUEs 0-1 skipped, BLOQUE 2 executed, completes
```

4. **Test: Backward compatibility (no docs/implementation/)**
```bash
cd /tmp/test-project  # No docs/implementation/ folder
orchestrate spec.md
# Verify: runs normally, no debug log, no errors
```

5. **Test: Error report reading**
```bash
# Create error report
# Run orchestrator
# Verify: error context included in prompt
```

**Success Criteria:**
- [ ] All integration tests pass
- [ ] No breaking changes to v5.0 behavior
- [ ] Debug log optional (works without docs/implementation/)
- [ ] Resume works across restarts
- [ ] Error reports improve retry success rate

---

## 6. Testing Strategy

### Unit Tests

Not required for Python script, but manual verification checkpoints in each BLOQUE.

### Integration Tests

See BLOQUE FINAL section above.

### Regression Tests

**Verify v5.0 behavior still works:**
```bash
# Test 1: Basic execution (no new features)
orchestrate docs/specs/existing-spec.md
# Should work exactly as v5.0

# Test 2: Retry logic
# Should still retry with error context (v5.0 feature)

# Test 3: Error reports
# Should still save error reports (v5.0 feature)
```

---

## 7. Migration Path

### From v5.0 to v5.2

**No migration required - fully backward compatible:**

1. **Existing specs work as-is**
   - No changes to spec format
   - All v5.0 behavior preserved

2. **New features are opt-in**
   - Debug logs only created if `docs/implementation/` exists
   - Resume only used with `--resume` flag
   - Error report reading is automatic but non-breaking

3. **Upgrade process**
```bash
# 1. Backup current orchestrator
cp ~/.claude/scripts/orchestrator.py ~/.claude/scripts/orchestrator-v5.0-backup.py

# 2. Implement BLOQUEs 0-4
# ... (follow implementation BLOQUEs above)

# 3. Test with existing spec
orchestrate docs/specs/existing-spec.md

# 4. Test new features
orchestrate --help  # Should show --resume flag
orchestrate docs/specs/new-spec.md  # Should create debug log

# 5. If issues, rollback
cp ~/.claude/scripts/orchestrator-v5.0-backup.py ~/.claude/scripts/orchestrator.py
```

---

## Success Criteria (Overall)

### Functional Requirements

- [ ] `orchestrate --resume <phase>` continues from checkpoint
- [ ] Debug log auto-created when `docs/implementation/` exists
- [ ] Debug log populated with timeline in real-time
- [ ] State saved to `~/.claude/state/{phase}-state.json`
- [ ] State updated after each BLOQUE
- [ ] Previous error reports read and included in prompt
- [ ] All v5.0 features still work (backward compatible)

### Non-Functional Requirements

- [ ] No performance degradation vs v5.0
- [ ] Debug log overhead < 5 seconds per phase
- [ ] State file size < 50KB
- [ ] Error handling graceful (no crashes if files missing)

### User Experience

- [ ] Clear resume summary shows what's skipped/pending
- [ ] Debug log readable by humans
- [ ] Error context helps agent avoid same mistakes
- [ ] 40% time savings on failed phases (measured)

---

## Appendix A: File Locations

### New Files Created

```
~/.claude/
├── state/                          ← NEW: Phase state files
│   └── phase-X-Y-state.json
└── logs/
    └── orchestrator-errors/        ← Existing (v5.0)
        └── YYYYMMDD-HHMMSS-bloque-X.json

docs/
└── implementation/                 ← Existing (created in v5.1 prep)
    ├── TEMPLATE-debug-log.md
    └── phase-X-Y-debug-log.md      ← NEW: Auto-generated
```

### Modified Files

```
~/.claude/scripts/orchestrator.py   ← Main changes here
```

---

## Appendix B: CLI Examples

### New Usage Patterns

```bash
# Standard execution (creates debug log + state)
orchestrate docs/specs/phase-8.2.md

# Resume from failed execution
orchestrate --resume phase-8.2

# Resume in strict mode
orchestrate --resume phase-8.2 --strict

# Check saved state
cat ~/.claude/state/phase-8.2-state.json | jq '.bloques[].status'

# View debug log
cat docs/implementation/phase-8.2-debug-log.md

# List available resume points
ls ~/.claude/state/*.json | sed 's/-state.json//'
```

---

## Appendix C: Estimated Effort

| BLOQUE | Description | Estimated Time | Complexity |
|--------|-------------|----------------|------------|
| 0 | Contracts & Architecture | 30 min | Low |
| 1 | Debug Log Auto-Gen | 1 hour | Medium |
| 2 | State Persistence | 1 hour | Medium |
| 3 | Resume Functionality | 1.5 hours | Medium-High |
| 4 | Error Report Reading | 45 min | Low-Medium |
| FINAL | Integration & Testing | 1 hour | Medium |
| **Total** | | **~6 hours** | **Medium** |

**Note:** Includes testing and debugging time.

---

## Appendix D: Future Enhancements (v5.3+)

**Not in v5.2 scope, but consider for future:**

1. **Interactive resume menu**
   ```bash
   orchestrate --resume
   # Shows: "3 incomplete phases found, which to resume?"
   ```

2. **Diff between runs**
   ```bash
   orchestrate --diff phase-8.2
   # Shows: What changed between Run 1 and Run 2
   ```

3. **Rollback capability**
   ```bash
   orchestrate --rollback phase-8.2 --to-bloque 2
   # Undo BLOQUEs 3-FINAL, resume from BLOQUE 2
   ```

4. **Cloud state sync** (for team collaboration)
   ```bash
   orchestrate --push phase-8.2  # Upload state to cloud
   orchestrate --pull phase-8.2  # Download state from cloud
   ```

---

**Spec Version:** 1.0
**Last Updated:** 2026-02-08
**Status:** Ready for Implementation
**Estimated Completion:** Phase 8.3 (after testing v5.0 in Phase 8.2)

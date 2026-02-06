---
description: Start a new feature using Framework Hibrido v2.0
---

# New Feature: $ARGUMENTS

Apply Framework Hibrido v2.0 methodology:

## BLOQUE 0: Contracts & Architecture

Before writing any implementation code:

1. **INVESTIGATE** official documentation of involved libraries
2. **SEARCH** for standard APIs for the use case
3. **Define interfaces** in `src/shared/types/`
4. **Define IPC channels** (if needed) in `src/shared/constants/index.ts`
5. **Declare architectural principles** for this feature
6. **Identify trade-offs** and dependencies

### Validation Checklist
- [ ] Read official documentation
- [ ] Standard API exists for this
- [ ] Interfaces defined in shared types
- [ ] Type-check passes
- [ ] NO workarounds required

Run type-check before proceeding:

```bash
npm run type-check
```

## After BLOQUE 0 is Validated

Proceed with implementation blocks:

### BLOQUE 1: [First Component]
- Implement with checkpoints
- Run type-check after completion

### BLOQUE 2-N: [Additional Components]
- Continue incremental implementation
- Checkpoint after each block

### BLOQUE FINAL: Alternate Flows
- Test happy path
- Test edge cases
- Verify error handling

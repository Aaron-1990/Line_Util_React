---
description: Run quick validation checkpoint
---

Execute checkpoint validation for Framework Hibrido v2.0:

```bash
npm run type-check && npm run lint
```

## Report Status

After running the commands, report:

### If ALL PASS:
- Confirm ready for next block
- State what was validated

### If ANY FAIL:
- List specific errors
- Identify files and line numbers
- Suggest fixes before proceeding

## Reminder

Do NOT proceed to the next block until checkpoint passes.

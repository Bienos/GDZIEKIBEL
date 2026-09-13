@AGENTS.md

# Claude-specific instructions

When compacting a long session, preserve only:

- current task ID and goal,
- files intentionally changed,
- tests/commands run and observed results,
- unresolved blocker(s),
- any new permanent decision that must be written to an ADR/contract before completion.

Do not preserve conversational scratchpad or unrelated exploration as project memory.

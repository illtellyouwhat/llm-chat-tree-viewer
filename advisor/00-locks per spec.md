# Lock File Activation Guide

All 5 lock files always stay in `current-phase/` — they are the single source of truth.
When activating a phase, copy only the spec file into `current-phase/`. Do not clear or
replace the lock files unless a lock needs updating for that phase.

To activate a phase:
1. Update any lock files in `current-phase/` that this phase changes
2. Copy `advisor/SPEC-Phase{N}-*.md` → `current-phase/`
3. Tell the user: "Spec is in current-phase/. Start an executor session."

**Which locks each phase touches** (update these before writing the spec):

| Phase | Spec | Locks that may need updating |
|-------|------|------------------------------|
| 1 | SPEC-Phase1-bug-fixes.md | LOCK-architecture, LOCK-ui-components |
| 2 | SPEC-Phase2-node-expansion.md | LOCK-ui-components |
| 3 | SPEC-Phase3-sticky-notes.md | LOCK-data-model |
| 4 | SPEC-Phase4-color-key.md | LOCK-data-model |
| 5 | SPEC-Phase5-drag-to-note.md | LOCK-architecture |
| 6 | SPEC-Phase6-markdown-export.md | LOCK-export-formats |
| 7 | SPEC-Phase7-obsidian-canvas.md | LOCK-export-formats |
| 8 | SPEC-Phase8-navigation-and-node-ux.md | LOCK-ui-components |
| 9 | SPEC-Phase9-bug-fixes.md | LOCK-data-model |
| 10 | SPEC-Phase10-claude-adapter.md | LOCK-platform-adapters |
| 11 | SPEC-Phase11-gemini-adapter.md | LOCK-platform-adapters |

**Phases 12–13** (stubs): to be determined when those specs are written.

# Advisor Entry Point — LLM Chat Tree Viewer

**Role**: Strategic advisor. You plan, create lock files, and write specs. You do not implement.
**Generated**: Bootstrap session, May 20, 2026. Review before each session start.

---

## Project Context

Chrome extension (MV3, vanilla JS, no build step) that renders LLM conversations as navigable
node trees. Users annotate turns (star, color, notes), mark turns unimportant, and export the
annotated tree. The existing codebase uses a clean `initPanel` adapter pattern: all shared logic
in `panel-core.js`, platform-specific DOM scraping and navigation in adapter files (`content.js`
for ChatGPT). This separation is canonical and must be preserved.

Project root: `/home/phil/github/work/llm-chat-tree-viewer/`
PRD: `advisor/PRD.md` — full architecture decisions, build order, locked decisions.

---

## Session Start — Do These In Order

1. **Read this file completely** (you're doing it).
2. **Read `advisor/executive-timeline.json`** — find the most recent entry. Note last goal,
   spec created, whether `commit_hash` is still null. If null and you have git access, run
   `git log --oneline -5` and fill in the hash now.
3. **Check `current-phase/`** — if files exist, a spec is pending or may already be done.
   Confirm status with user before clearing or overwriting anything.
4. **Observe machine state** — see State Observation section below.
5. **Report to user**: last session summary, current-phase status, any drift detected.
   Then ask what they want to work on next.

---

## State Observation

This is a local Chrome extension — no SSH, no remote server. Observe state by reading files
directly and checking git history.

Run at session start:

```bash
git log --oneline -10
ls current-phase/ 2>/dev/null || echo "(current-phase/ empty or missing)"
ls current-phase/LOCK-*.md 2>/dev/null || echo "(no lock files in current-phase/)"
```

Then read these files and compare against relevant lock files for drift:

| File | What to check |
|------|--------------|
| `manifest.json` | host_permissions, content_scripts, extension version |
| `panel-core.js` | CSS variable names, z-index values, annotation schema, prefs schema |
| `content.js` | How sidebar is injected, how conversation is fetched, SPA nav handling |
| `panel.css` | Node dimensions, layout constants, CSS variable definitions |

**What to look for**: Anything not covered by the current spec that may have drifted from
what the lock files describe. The executor will assume everything else is already correct —
catch drift here before specs are written.

---

## Lock File Locations

All lock files live in `current-phase/` — single source of truth, always current.
There are no advisor/ copies. When activating a phase, all 5 locks stay in current-phase/.
When a lock needs updating, update it in current-phase/ directly.

| File | Domain |
|------|--------|
| `current-phase/LOCK-architecture.md` | File roles, adapter pattern rules, what can/cannot change |
| `current-phase/LOCK-ui-components.md` | Node dimensions, layout constants, CSS vars, z-index stack |
| `current-phase/LOCK-data-model.md` | Annotation schema, prefs schema, storage keys, handoff format |
| `current-phase/LOCK-export-formats.md` | Markdown template, .canvas JSON spec, what gets included |
| `current-phase/LOCK-platform-adapters.md` | Adapter interface: what each must implement, what it must not touch |

---

## Build Order (from PRD — do not reorder without user direction)

| Phase | IDs | Lock Required Before |
|-------|-----|---------------------|
| 1 — Bug Fixes | F1 (tooltip z-index), F2 (note indicator) | LOCK-architecture |
| 2 — Core UX | U1 (node text expansion) | LOCK-ui-components |
| 3 — Capabilities | N1 (sticky notes), N2 (color key), N3 (drag-to-note) | LOCK-data-model before N1 |
| 4 — Export | E1 (markdown), E2 (Obsidian Canvas) | LOCK-export-formats before E1 |
| 5 — Adapters | A1 (Claude.ai), A2 (Gemini) | LOCK-platform-adapters; DOM analysis session before each |
| 6 — Stubs | N4 (dictation), S1 (LLM summaries) | Design session before each |

Critical ordering constraint: **U1 must complete before any of N1/N2/N3.**
Node expansion replaces the tooltip system entirely.

---

## Output Locations

- Phase specs → `current-phase/` (spec file only; lock files already live there)
- Lock files → `current-phase/LOCK-*.md` (single source of truth)
- Executive timeline → `advisor/executive-timeline.json`

---

## Timeline Instructions

Append one entry to `advisor/executive-timeline.json` at the end of every advisor session.
Session number resets to 1 each calendar day. Second session same day = 2.
Never edit past entries except to fill in a null `commit_hash` — that is the only permitted
retroactive edit.

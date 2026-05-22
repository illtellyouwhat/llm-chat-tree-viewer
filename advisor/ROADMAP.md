# Spec Roadmap — LLM Chat Tree Viewer

**Created:** May 20, 2026 — Session 1 (bootstrap)
**Maintained by:** Advisor. Update when phases complete, scope changes, or decisions shift.

---

## Summary Table

| Phase | ID(s) | Spec File | Locks Required | Build Dependency | Status |
|-------|-------|-----------|---------------|-----------------|--------|
| 1 — Bug Fixes | F1, F2 | SPEC-Phase1-bug-fixes.md | LOCK-architecture | None | **Ready** |
| 2 — Core UX | U1 | SPEC-Phase2-node-expansion.md | LOCK-ui-components | Phase 1 shipped | **Ready** |
| 3 — Sticky Notes | N1 | SPEC-Phase3-sticky-notes.md | LOCK-data-model | Phase 2 shipped | **Ready** |
| 4 — Color Key | N2 | SPEC-Phase4-color-key.md | LOCK-data-model | Phase 3 shipped | **Ready** |
| 5 — Drag-to-Note | N3 | SPEC-Phase5-drag-to-note.md | LOCK-data-model | Phase 3 shipped | **Ready** |
| 6 — Markdown Export | E1 | SPEC-Phase6-markdown-export.md | LOCK-export-formats | Phase 3 shipped | **Ready** |
| 7 — Obsidian Canvas | E2 | SPEC-Phase7-obsidian-canvas.md | LOCK-export-formats | Phase 6 shipped | **Done** |
| 8 — Navigation + Node UX | — | SPEC-Phase8-navigation-and-node-ux.md | LOCK-architecture + LOCK-ui-components | Phase 7 shipped | **Ready** |
| 9 — Bug Fixes | — | SPEC-Phase9-bug-fixes.md | LOCK-architecture + LOCK-data-model | Phase 8 shipped | **Ready** |
| 10 — Claude.ai Adapter | A1 | SPEC-Phase10-claude-adapter.md | LOCK-platform-adapters | DOM analysis session | **NOT READY** |
| 11 — Gemini Adapter | A2 | SPEC-Phase11-gemini-adapter.md | LOCK-platform-adapters | Phase 10 shipped + DOM analysis | **NOT READY** |
| 12 — Dictation Stub | N4 | SPEC-Phase12-dictation-stub.md | — | Design session | **NOT READY** |
| 13 — LLM Summaries | S1 | SPEC-Phase13-llm-summaries.md | — | Design session | **NOT READY** |

**Ready** = spec exists in `advisor/` as a complete draft, executable as-is.
**NOT READY** = prerequisite session required before spec can be written.

---

## Activation Procedure

When a phase is ready to send to the executor:

1. Confirm `current-phase/` is clear (check with user if anything is there)
2. Copy `advisor/SPEC-{phase}.md` → `current-phase/SPEC-{phase}.md`
3. Copy each required `advisor/LOCK-{domain}.md` → `current-phase/LOCK-{domain}.md`
4. Tell the user: "Spec and locks are in current-phase/. Start an executor session in executor/."

---

## What Each Phase Does

**F1** — Tooltip positioning bug: moves toward tooltip exits the node. Fix: reposition below cursor.
Also: belt-and-suspenders `pointer-events: none` inline on the tooltip element in content.js.

**F2** — Note existence indicator: nodes give no visual signal a note exists. Fix: small colored dot
(`.cttv-note-dot`) absolutely positioned in top-right corner of node outer, visible when `ann.notes` exists.
Managed by render loop and `refreshNode()`.

**U1** — Node text expansion: replaces tooltip system entirely. On hover, node expands vertically
(in-place, 80px wide, grows downward) to show full node text with scroll. CSS max-height transition.
Click-to-pin: node stays expanded after mouse leaves. ESC unpins all. All tooltip code removed.

**N1** — Floating sticky notes: canvas-level notes inside `#cttv-body`, draggable. New storage key
`cttv-canvas-${conversationId}`. New toolbar button to create notes. No node attachment.

**N2** — Color key: a draggable canvas element (like N1 notes) showing color → user-defined label
mapping. Stored globally in `cttv-colorkey` (not per-conversation). Editable inline.

**N3** — Text drag-to-note: user drags selected text from ChatGPT conversation into a note.
Requires `dragstart` listener in content.js and message passing for the popout case.

**E1** — Markdown export: annotated turns only, in tree traversal order. New section in settings.
Triggers download of `.md` file.

**E2** — Obsidian Canvas export: full tree as `.canvas` JSON. Nodes positioned using tree layout
scaled to canvas coordinates. Colors mapped to Obsidian color codes. Notes appended to node text.

**Phase 8** — Navigation + node UX: click-to-navigate restored (pin mechanic removed); node text always
visible with 2-line clamp; hover expands width to 220px + unclamped scroll view. `refreshNode()` height
bug fixed.

**Phase 9** — Three independent bugs: (1) tool node text no longer contaminates assistant display text;
(2) `selectionchange` makes drag-to-note reliable; (3) sticky notes gain `resize: both` + dimension save.

**A1** — Claude.ai adapter: requires real DOM inspection session first. Do not write from assumptions.

**A2** — Gemini adapter: same requirement. Wait for A1 learnings.

**N4** — Dictation stub: UI only, no actual dictation. Requires note UI to be stable (after N1/N2).

**S1** — LLM summaries: stub + settings page design. OpenRouter API key flow not designed yet.

---

## Notes on NOT READY Specs

**A1/A2:** Do not infer ChatGPT DOM structure applies to either platform. Each requires a live
inspection session: open DevTools on the target platform, inspect conversation section structure,
identify data attributes and API endpoints, then write the spec.

**N4/S1:** These are stubs — minimal UI placeholders. Still require design sessions because stub
boundaries (what UI exists, what fires on click) must be decided before implementation.

---

## Spec Versioning

Each spec references specific lock file versions. If a lock file is updated after a spec is written,
re-verify the spec is still valid before activation. Lock file `Version:` field is the reference.

If you activate a stale spec (lock updated after spec was written), review the delta and update
the spec before handing to executor.

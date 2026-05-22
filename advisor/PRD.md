# LLM Chat Tree Viewer — Project Grounding Document

**Project type:** Chrome extension — fix, extend, and port  
**Current version:** 0.1 (ChatGPT-only, collaborator codebase)  
**Session opened:** May 20, 2026  
**Advisor role:** Strategic decisions, lock files, specs  
**Executor role:** Claude Code (or equivalent) — implements from specs only

---

## Reading Order (Every Session)

1. **This file** — project context and rules
2. **HISTORY-executive-timeline.md** — most recent entry only, to understand current state
3. **Relevant LOCK-*.md** — skim all, read the one(s) for your current phase
4. **Active SPEC-*.md** — your implementation instructions

---

## What This Project Is

A Chrome sidebar extension that renders LLM conversations as navigable node trees. Each conversation turn is a node. Clicking a node navigates to that turn in the chat. Users can annotate turns (star, color, notes), mark turns as unimportant, and eventually export the whole annotated tree.

The existing codebase uses a clean `initPanel` adapter pattern. Platform-specific DOM scraping and navigation logic lives in adapter files (`content.js` for ChatGPT). All shared sidebar logic lives in `panel-core.js`. This separation is intentional and must be preserved.

**The sidebar is the surface. This is not a canvas application.**

---

## Critical Rules — Never Violate

1. **Fix and extend, not rebuild.** The existing codebase is the foundation. New capabilities layer on top. Do not rewrite working code to "clean it up."

2. **Executor reads locks as immutable truth.** If a spec conflicts with a lock file, the executor surfaces the conflict — it does not resolve it by guessing.

3. **Locks update before specs.** Never create a spec against stale locks.

4. **No cross-contamination between projects.** The Supabase/archive project is a separate system. Do not import decisions or assumptions from it here.

5. **Platform adapters require DOM analysis first.** Do not write a Claude.ai or Gemini adapter without a real DOM inspection session. Do not assume the ChatGPT adapter maps to either.

6. **U1 before N1/N2/N3.** The node text expansion feature (U1) replaces the tooltip system. Features that depend on node hover behavior must be built after U1, not before.

---

## Architecture Decisions (Locked — Do Not Relitigate)

| Decision | What it means |
|----------|--------------|
| Export targets: markdown + Obsidian Canvas | No Miro, no Excalidraw, no other canvas tool |
| LLM summaries via OpenRouter | Stubbed — not in scope until settings UI is designed |
| Text drag-to-note is cross-frame | Requires content script `dragstart` listener → message → sidebar. Not a one-liner. |
| Platform adapters are independent | Claude.ai is first after ChatGPT. Gemini is second. DOM analysis required before each. |
| No server-side infrastructure | Chrome extension only. API keys in `chrome.storage.local`. |
| No Supabase annotation sync | Out of scope. Future consideration only. |
| `initPanel` adapter pattern is canonical | All shared logic in `panel-core.js`. Platform differences live in adapter files only. |

---

## File Inventory (Codebase as of Session Open)

| File | Role |
|------|------|
| `manifest.json` | Extension manifest (MV3). Currently: ChatGPT host permissions only. |
| `background.js` | Service worker. Handles popout window lifecycle, action button click. |
| `content.js` | ChatGPT adapter. Injects sidebar, fetches conversation API, handles SPA navigation. |
| `bridge.js` | Runs in MAIN world. Fires React click events for branch navigation. |
| `panel-core.js` | Shared sidebar logic: tree parsing, layout, rendering, annotations, prefs, settings. |
| `panel-standalone.js` | Popout window adapter. Receives handoff data from content.js. |
| `panel.html` | Popout window shell. |
| `panel.css` | All sidebar styles. |

---

## Feature Set and Build Order

The build order is fixed by dependencies, not preference. Do not reorder without advisor approval.

### Phase 1 — Bug Fixes (Blockers)
| ID | Feature | Why Now |
|----|---------|---------|
| F1 | Hover tooltip z-index / pointer-events bug | Tooltip disappears when cursor moves toward it. Blocks all UX testing. |
| F2 | Note existence indicator on nodes | Nodes give no visual signal that a note exists. Trivial after F1. |

### Phase 2 — Core UX
| ID | Feature | Why Now |
|----|---------|---------|
| U1 | Node text expansion on hover | Replaces tooltip system entirely. Animated grow, max height, internal scroll, click-to-pin. Must exist before N1/N2/N3. |

### Phase 3 — New Capabilities (ChatGPT, platform-agnostic)
| ID | Feature | Dependency | Notes |
|----|---------|------------|-------|
| N1 | Floating sticky notes | U1 complete | Canvas-level notes, not attached to nodes. Draggable, repositionable. |
| N2 | Color key / legend | N1 complete | Sticky-note-like object with user-editable color meanings. |
| N3 | Text drag-to-note | N1 complete | Cross-frame. Content script `dragstart` → message → sidebar. Scope carefully. |

### Phase 4 — Export
| ID | Feature | Dependency |
|----|---------|------------|
| E1 | Text / markdown export | N1 complete (notes must exist to export) |
| E2 | Obsidian Canvas export | E1 complete (shares data collection logic) |

### Phase 5 — Platform Adapters
| ID | Platform | Dependency | Notes |
|----|---------|------------|-------|
| A1 | Claude.ai | E2 complete (or parallel) | DOM analysis session required first |
| A2 | Gemini | A1 complete | DOM analysis session required first |

### Phase 6 — Stubs (Design Before Implement)
| ID | Feature | Notes |
|----|---------|-------|
| N4 | Dictation on notes | Stub UI in note component. Implement after note UI stable. |
| S1 | LLM mini-summaries via OpenRouter | Settings page design required first. API key in `chrome.storage.local`. |

---

## Lock Files — Planned Domains

These will be created as the relevant phases approach. The advisor creates them; the executor reads them as immutable.

| Lock File | Domain | Created Before |
|-----------|--------|----------------|
| `LOCK-architecture.md` | File roles, adapter pattern rules, what can/cannot change | Phase 1 specs |
| `LOCK-ui-components.md` | Node dimensions, layout constants, CSS variable names, z-index stack | Phase 2 (U1) |
| `LOCK-data-model.md` | Annotation schema, prefs schema, storage key naming, handoff format | Phase 3 (N1) |
| `LOCK-export-formats.md` | Markdown template, `.canvas` JSON spec, what gets included | Phase 4 (E1) |
| `LOCK-platform-adapters.md` | What each adapter must implement, what it must not touch in core | Phase 5 (A1) |

---

## Workflow

```
User describes what to build
        ↓
Advisor updates relevant LOCK-*.md (if constraints changed)
        ↓
Advisor creates SPEC-[phase].md
        ↓
User passes PROMPT-claude-code-header.md + SPEC to executor
        ↓
Executor implements, reports back
        ↓
User passes executor report to advisor
        ↓
Advisor updates HISTORY-executive-timeline.md
        ↓
Next phase
```

**Advisor and executor do not cross-talk.** Communication is through files only.

---

## Principles

- **Precision over speed.** One well-specified phase beats three rushed ones.
- **Preserve working code.** If it works, don't touch it.
- **Surface conflicts, don't resolve them.** Executor asks; advisor decides.
- **DOM analysis before adapter code.** Always.
- **Test on ChatGPT before touching adapters.** Platform-agnostic features must be verified on the known-working platform first.

---

## Current State (Session Open)

- **Phase:** Pre-phase. Lock files not yet created.
- **Next step:** Advisor creates `LOCK-architecture.md`, then creates `SPEC-F1-tooltip-fix.md` and `SPEC-F2-note-indicator.md`.
- **Executor has not been engaged yet.**
- **No inventory exists yet.** Request one from executor after first implementation phase completes.

---

## User Context

- Preference for epistemic humility. Flag precision claims; don't present estimates as facts.
- Values the fullest picture over sycophantic agreement. Challenge assumptions.
- Working in Claude Projects (this conversation is the advisor session).
- Executor: Claude Code or equivalent agentic coding tool.

---

*Document version: 1.0 — May 20, 2026*  
*Author: Advisor session*  
*Next update: After Phase 1 (F1+F2) completes
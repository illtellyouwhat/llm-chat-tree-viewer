# LOCK-platform-adapters.md
## LLM Chat Tree Viewer — Platform Adapter Constraints

**Status**: 📋 DRAFT
**Last Updated**: 2026-05-20
**Version**: 1.0
**Purpose**: What each adapter must implement, what it must not touch, file naming, manifest changes.

---

## Adapter Interface Contract

Every platform adapter (content.js, claude-content.js, gemini-content.js) must implement exactly
the same `initPanel()` call pattern. See LOCK-architecture.md for the full adapter object schema.

The adapter is responsible for:
1. **Building the panel HTML** — identical structure to content.js panel innerHTML
2. **Calling `initPanel(adapter)`** with platform-specific callbacks
3. **Bootstrapping** in `boot()`: prefs → conversationId → annotations → conversation data, in that order
4. **Navigating to a node** in `onNodeClick()` using platform-specific DOM/API

Note: tooltip element was removed in Phase 2 (U1). Do not include it.

The adapter is NOT responsible for:
- Tree parsing, layout, or rendering (panel-core.js handles this)
- Annotation storage or retrieval (panel-core.js handles this)
- Settings UI (panel-core.js handles this)
- Import/export (panel-core.js handles this)

---

## File Naming Convention

| Platform | Adapter File |
|----------|-------------|
| ChatGPT | `content.js` (existing) |
| Claude.ai | `claude-content.js` |
| Gemini | `gemini-content.js` |

Adapters are independent files. No adapter may import from or reference another adapter.

---

## Manifest Changes Per New Adapter

When a new adapter ships, `manifest.json` must be updated:

1. **`host_permissions`**: Add the platform's origin.
   - Claude.ai: `"https://claude.ai/*"`
   - Gemini: `"https://gemini.google.com/*"`

2. **`web_accessible_resources`**: Add the adapter's content.js equivalent and any needed files.
   Example: `{ "resources": ["panel.html", "panel-core.js"], "matches": ["https://claude.ai/*"] }`

3. **No `content_scripts`**: Adapters are injected programmatically by background.js, same as ChatGPT.
   `background.js` must be updated to handle the new host when action is clicked.

---

## What Adapters Must Implement (Platform-Specific)

Each adapter must implement these platform-specific pieces. None of these live in panel-core.js.

### Conversation Data Fetching
Retrieve the conversation's full structure in a format parseable by `parseTree()`. The data object
must have a `.mapping` property structured identically to ChatGPT's `/backend-api/conversation/{id}`
response: `{ mapping: { [nodeId]: { id, parent, children, message: { author, content, metadata } } } }`.

If the platform does not expose an API, the adapter must construct this mapping from the DOM.
This is why DOM analysis is required before writing each adapter — do not assume.

### Branch Navigation
When `onNodeClick(nodeId)` fires, the adapter must navigate to that conversation turn using
platform-specific DOM manipulation or API calls. What works for ChatGPT (React event dispatch via
bridge.js, EID lookup, section[data-turn-id]) does not generalize.

### SPA Route Handling
The adapter must detect when the user navigates to a different conversation without a page reload
and reload the panel accordingly. The mechanism is platform-specific.

### Streaming Completion Detection
The adapter must detect when a new assistant response finishes streaming and trigger a conversation
reload. The mechanism is platform-specific (ChatGPT uses `aria-live` status div).

---

## What Adapters Must NOT Do

- Contain any tree parsing, layout math, or node rendering logic
- Read or write to `chrome.storage.local` directly for annotation or prefs data (use `initPanel` API)
- Bypass the `initPanel` boot sequence order
- Reference ChatGPT-specific DOM attributes (`data-turn-id`, `data-message-id`, `data-turn`) unless
  the platform happens to use them (verify in DOM analysis — do not assume)
- Modify `panel-core.js` to accommodate platform needs — surface the need to the advisor instead

---

## DOM Analysis Requirement

**Before writing any new adapter spec**, a DOM analysis session is required:
1. Open the target platform in Chrome with DevTools
2. Start a conversation with multiple turns and at least one branch (edit a message)
3. Inspect: What DOM elements represent turns? What data attributes do they carry?
4. Inspect: Is there an API endpoint for conversation data? What does it return?
5. Inspect: How do branch navigation controls work? What events do they fire?
6. Document findings in a session note before the advisor writes the spec

This is a mandatory gate. The spec cannot be written without this data.

---

## Panel HTML Requirement

Each adapter must inject the same panel HTML structure as content.js. The `panel-core.js` event
wiring (`getElementById` calls) depends on these exact element IDs existing in the DOM:
- `#cttv-panel`, `#cttv-resize-handle`, `#cttv-header`, `#cttv-body`, `#cttv-map`
- `#cttv-error`, `#cttv-menu`, `#cttv-notes-dialog`, `#cttv-settings-dialog`
- All child elements with their expected IDs (see content.js panel innerHTML for the full list)

The HTML is identical across adapters. Do not alter it for platform-specific reasons.

---

**Document Version**: 1.1
**Last Updated**: 2026-05-22
**Approved By**: Phil

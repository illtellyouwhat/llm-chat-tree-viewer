# LOCK-architecture.md
## LLM Chat Tree Viewer — Architecture Constraints

**Status**: ✅ LOCKED
**Last Updated**: 2026-05-22
**Version**: 1.1
**Purpose**: File roles, adapter pattern rules, injection mechanism, what may and may not change.

---

## File Roles

| File | Role | May it import/require other extension files? |
|------|------|---------------------------------------------|
| `background.js` | Service worker. Manages popout window lifecycle, injects scripts/CSS on action click. | No |
| `content.js` | ChatGPT adapter. Builds panel HTML, calls `initPanel()`. Handles ChatGPT-specific: conversation API fetch, SPA navigation, EID-based DOM lookup, branch switching via `cttv-click-branch`. No tooltip — removed in Phase 2. | No — panel-core.js is injected before it |
| `bridge.js` | Runs in MAIN world. Listens for `cttv-click-branch` custom event, clicks branch navigation buttons in ChatGPT React DOM. No access to extension APIs. | No |
| `panel-core.js` | Shared sidebar logic: tree parsing, layout, rendering, annotation CRUD, prefs management, settings UI event wiring, import/export. Called by adapter via `initPanel()`. | No |
| `panel-standalone.js` | Popout window adapter. Loads after panel-core.js (via panel.html). Calls `initPanel()` with popout-specific callbacks. No ChatGPT DOM access. | No |
| `panel.html` | Popout window shell. Loads panel-core.js then panel-standalone.js. | — |
| `panel.css` | All sidebar styles — shared by both inline panel and popout. Injected by background.js for inline panel; linked by panel.html for popout. | — |

**Future adapter files** follow the naming convention `{platform}-content.js` (e.g., `claude-content.js`, `gemini-content.js`).

---

## Injection Mechanism

The inline panel is NOT declared in `manifest.json` as a content script. It is injected programmatically by `background.js` on extension action click:

```
background.js (action.onClicked):
  1. scripting.executeScript → bridge.js in MAIN world
  2. scripting.executeScript → [panel-core.js, content.js] in ISOLATED world
  3. scripting.insertCSS    → panel.css
```

Consequence: panel-core.js is always available as a global function `initPanel` when content.js runs. New adapters follow the same sequence; they do NOT add themselves to manifest `content_scripts`.

The popout window (panel.html) loads panel-core.js and panel-standalone.js via `<script>` tags in document order. No injection needed.

---

## The `initPanel` Adapter Contract

`initPanel(adapter)` is the canonical entry point. All shared logic lives inside it.

**Adapter object (required fields):**

```js
{
  onNodeClick(nodeId: string): void,
  // Called on normal (non-shift) click. Adapter handles navigation.

  onAnnotationsSaved(): void,
  // Called after annotations written to chrome.storage.local.
  // Adapter notifies other contexts (e.g., popout notifies tab).

  onPrefsSaved(prefs: object): void,
  // Called after prefs written to storage. Adapter notifies other contexts.

  boot(api: {
    loadConversationData(data: object, selectedId: string|null): void,
    loadAnnotations(callback: () => void): void,
    applyPrefs(prefs: object): void,
    setConversationId(id: string): void,
    selectNode(nodeId: string, scrollIntoView: boolean): void
  }): void
  // Called at end of initPanel. Adapter bootstraps: load prefs, set conversation ID,
  // load annotations, load conversation data — in that order.
}
```

**Return value from `initPanel()`:**

```js
{
  selectNode(nodeId: string, scrollIntoView: boolean): void,
  loadConversationData(data: object, selectedId: string|null): void,
  loadAnnotations(callback: () => void): void,
  applyPrefs(prefs: object): void,
  setConversationId(id: string): void,
  getMapping(): object,
  getNodes(): object,
  getTree(): object,
  getSelectedId(): string | null,
  refreshAllNodes(): void
}
```

---

## Parity Rule

The inline panel (content.js) and the popout (panel-standalone.js) are the **same map in two windows**. They must always look and behave identically.

- Any change to appearance, behavior, prefs, or data loading MUST work identically in both.
- Boot sequence must be: load prefs → setConversationId → loadAnnotations → load/render conversation.
- Message-driven updates (conversationReloaded, annotationsUpdated, prefsUpdated) must produce identical results to a direct reload.

---

## What `panel-core.js` May NOT Do

- Access platform-specific DOM selectors (e.g., `section[data-turn-id]`, `main`, ChatGPT API paths)
- Reference platform-specific URLs or hostnames
- Call `chrome.scripting`, `chrome.tabs`, or `chrome.windows` directly
- Contain adapter-specific logic of any kind
- Know which platform it is running on

---

## What Adapter Files May NOT Do

- Contain shared sidebar logic: tree parsing, rendering, annotation storage, prefs management
- Call `renderMap`, `parseTree`, `layoutTree`, or any `panel-core.js` internal directly
- Directly manipulate `.cttv-node-outer` or annotation data without going through `initPanel` API
- Share code with other adapters — each adapter is independent
- Skip the boot sequence order (prefs before data, always)

---

## No Build Step

This project uses NO bundler, NO transpiler, NO module system. All files are plain scripts injected in sequence. Do not introduce `import`/`export`, CommonJS `require`, or any build toolchain.

---

**Document Version**: 1.1
**Last Updated**: 2026-05-22
**Approved By**: Phil

# Debugging Lessons — Design Patterns for Better Specs

This document records bugs found during live testing, what caused them, how they were fixed,
and what spec or design habit would have prevented each one. Use this when writing future specs
to catch these categories of mistake before they reach the executor.

---

## 1. Satellite Note Not Appearing After Creation

### Issue
After saving a node annotation note via the Notes dialog, the satellite node (the blue preview
card to the right of the conversation node) did not appear. It only appeared after the user
separately added a star or changed the color on the same node.

### Fix
Added `refreshNode(id)` call to the `cttv-notes-save` click handler, after `saveAnnotations()`.

### Underlying Problem
The codebase has two distinct concerns that must both happen after any annotation change:

1. **Data write** — update `cttvAnnotations[id]` in memory and persist to `chrome.storage`
2. **Visual refresh** — call `refreshNode(id)` to rebuild the DOM elements for that node

The star and color handlers in the menu click handler did both correctly (refresh before save).
The notes save handler was written to do only the data write. The visual refresh was never
specified and never written.

This pattern is extremely common in UI code: any function that owns a piece of data must
explicitly schedule a re-render of everything that depends on that data. There is no automatic
reactivity here — it is vanilla JS.

### Spec Rule
**Every annotation mutation must be followed by `refreshNode(id)`.**
When writing a spec for any feature that writes to `cttvAnnotations`, explicitly state:
"After saving, call `refreshNode(id)` to update the DOM." Do not assume the executor will
infer this — they will follow the existing code pattern for whichever handler they look at,
and those patterns are inconsistent.

---

## 2. No Delete Button on Satellite Notes

### Issue
Satellite notes (the annotation preview cards to the right of nodes) had no way to delete
them from the canvas. Sticky notes had an × button; satellite notes did not.

### Fix
Added a `<button class="cttv-sticky-delete">×</button>` to `createSatelliteEl()`. The click
handler removes the satellite element, removes the connecting SVG edge, deletes `ann.notes`
from the annotation object, and calls `saveAnnotations()`.

### Underlying Problem
The satellite note was specced and built as a read/edit surface (click to open dialog) but
the deletion path was never designed. It was assumed the Notes dialog would handle deletion
implicitly (clearing the textarea and saving). That works, but requires the user to know
the satellite is clickable and understand that clearing the field deletes the note — not
obvious.

### Spec Rule
**Every user-visible object that can be created must have an explicit destruction path.**
When speccing a new element type, include: how it is created, how it is edited, and how it
is deleted. For canvas elements specifically, a visible × button is the established convention
in this codebase (sticky notes set the pattern). Reference that convention explicitly in specs.

---

## 3. WSL2 / Windows File Sync — Changes Not Reaching Chrome

### Issue
Code edits made in WSL (at `/home/phil/github/work/llm-chat-tree-viewer/`) were not being
picked up by Chrome after the user copied files via Windows Explorer and reloaded the
extension. The extension appeared to work correctly but was running stale code.

### Root Cause
Windows Explorer caches file metadata and content when browsing the WSL2 filesystem via the
`\\wsl$\` network path. When copying files, Explorer may read from its cache rather than
the live filesystem, silently copying a stale version of the file. The copy succeeds, the
file timestamps may look correct, but the bytes on the Windows side are old.

### Fix
Load the Chrome extension directly from the WSL repo path. In Chrome's "Load unpacked"
dialog, navigate to `\\wsl$\Ubuntu\home\phil\github\work\llm-chat-tree-viewer`. Chrome reads
the files directly at extension reload time — no copy step, no cache risk.

### Dev Environment Rule
**Never copy extension files via Windows Explorer from WSL. Always point Chrome directly at
the WSL repo.** The path format is `\\wsl$\<distro>\home\phil\github\work\llm-chat-tree-viewer`.
After any code change: reload the extension in `chrome://extensions/` (↺ button). That is
the only step needed — no file copies, no page refresh unless testing injection.

---

## 4. Canvas Export Missing Annotation Fidelity

### Issue
The Obsidian Canvas export did not faithfully represent the state of the sidebar:
- Stars were lost (used as a fallback color only, no text indicator)
- Notes were appended inline to the conversation node text rather than appearing as
  separate satellite nodes to the right (the sidebar visual)
- Sticky notes (floating canvas notes) were not exported at all
- The color key was not exported

### Fix
Rewrote the canvas export loop:
- Stars: prepend `⭐` to node text; keep yellow background (`color: '3'`) for starred nodes
  with no explicit color
- Unimportant: prepend `👁` to node text
- Notes: create a separate satellite text node (color `'5'`, blue) at `x + NODE_W + SAT_GAP`
  with a right→left edge connecting to the conversation node. Remove the inline append.
- Sticky notes: export as floating yellow nodes (`color: '3'`) arranged in a row below
  the bottom of the conversation tree
- Column stride widened from 300→500 to give satellite nodes room without overlapping the
  next column

### Underlying Problem
The canvas export was written as a one-pass loop that only knew about the conversation tree.
It had no concept of the two other visual layers (annotation satellites, floating canvas notes).
Each time a new visual element is added to the sidebar, the canvas export must be explicitly
updated to represent it — this never happens automatically.

### Spec Rule
**The canvas export is a separate rendering system. Every new visual element type must be
explicitly designed for canvas output at the time it is designed for the sidebar.**
When speccing a new element (e.g. a new annotation type, a new floating widget), include a
section: "Canvas export representation." For connected elements (satellite notes) describe
the node geometry and edge direction. For floating elements (sticky notes, color key) describe
placement relative to the tree. Do not defer canvas export as a follow-up — it creates debt
that is hard to backfill accurately.

---

## Summary: Spec Checklist Additions

When writing any spec that involves visual elements or annotation data, explicitly address:

| Question | Why |
|---|---|
| What calls `refreshNode` after this data changes? | Vanilla JS has no reactivity — refresh must be explicit |
| How does the user delete this element? | Creation without deletion is an incomplete feature |
| What does this look like in the canvas export? | Canvas is a separate renderer; it must be kept in sync |
| Are any floating/canvas-layer elements involved? | These are invisible to the export unless explicitly handled |

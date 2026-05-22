# Next Phase — Deferred Feature Notes

Ideas captured during live testing sessions. Not specced yet — needs advisor design session before executor work.

---

## Sticky Note Edit/Preview Toggle

**What**: Sticky notes are currently plain textareas. When a note contains markdown links (`[text](url)`), there's no way to click them — you just see raw markdown. Satellite (annotation) notes already render clickable links as of the session this was deferred.

**Desired behavior**: Sticky notes should have an edit/preview toggle:
- Default state: rendered preview (text + clickable links styled like satellite notes)
- Click-to-edit: textarea appears, preview hides
- Blur or Escape: back to preview

**Why deferred**: Surface area is meaningful — affects drag, resize, the textarea-based save flow, and the overall note UX. Worth its own spec rather than a quick add-on.

**Prior art in codebase**: The notes dialog (`cttv-notes-dialog`) has a preview toggle (`cttv-notes-preview-toggle`) that controls whether annotation notes show as satellite cards. The sticky note toggle could reuse the `renderMarkdownLinks()` helper added for satellite notes.

---

## Scroll-to-Node Reliability (ChatGPT lazy rendering)

**What**: Clicking a node in the sidebar scrolls ChatGPT, but not reliably to the correct turn. Requires multiple clicks to land on the right turn.

**Suspected cause**: ChatGPT uses virtual/lazy rendering. Turns far from the current scroll position aren't in the DOM. `scrollToTurn()` in `content.js` finds the element and scrolls to it, but the target turn may not be rendered yet at the time of the first scroll. A retry/poll loop after the first scroll is probably needed.

**Why deferred**: Needs investigation of the actual ChatGPT DOM scroll and render behavior before writing a spec.

# LOCK-export-formats.md
## LLM Chat Tree Viewer — Export Format Constraints

**Status**: ✅ LOCKED
**Last Updated**: 2026-05-22
**Version**: 1.1
**Purpose**: E1 markdown and E2 Obsidian Canvas output format specifications.

---

## E1 — Markdown Export

**Filename**: `cttv-export-{conversationId}.md`
**Trigger**: "Export annotated turns (Markdown)" button in settings
**Scope**: Annotated turns only — nodes with `star`, `color`, or `notes` set. Root node excluded.
**Order**: Tree traversal order (depth-first, children in order)

### File Structure

```markdown
# Chat Tree Export
**Conversation:** https://chatgpt.com/c/{conversationId}
**Exported:** {ISO datetime, space-separated, seconds precision}

---

## ★ Turn — {User|Assistant}       ← star prefix only when ann.star is true
**Notes:** {ann.notes}              ← only when notes present
**Color:** {label}                  ← only when color set; label from colorKey or COLOR_NAMES fallback

> {truncated node text, 300 chars, blockquoted}
> {continuation lines also blockquoted}

---

```

### Color Label Resolution

When `ann.color` is set, resolve label in this order:
1. `colorKey[hex]` — user-defined label (from `cttv-colorkey`)
2. Fallback table: `#e55`→`Red`, `#e93`→`Orange`, `#9c9`→`Green`, `#69f`→`Blue`, `#c6f`→`Purple`
3. Raw hex if neither applies

### Text Truncation

`truncate(text, 300)`: cut at last word boundary before 300 chars, append `...`. Newlines within
the blockquote become `\n> ` so each line is blockquoted.

---

## E2 — Obsidian Canvas Export

**Filename**: `cttv-canvas-{conversationId}.canvas`
**Trigger**: "Export as Obsidian Canvas" button in settings
**Scope**: All nodes including root. Deep clone of `cttvTree`, layout assigned via `layoutTree()`.

### Canvas Layout Constants (in-code, not exported)

| Constant   | Value | Purpose |
|------------|-------|---------|
| `STRIDE_X` | 500   | Column spacing for node x positions |
| `STRIDE_Y` | 200   | Row spacing for node y positions |
| `NODE_W`   | 250   | Standard node width |
| `NODE_H`   | 100   | Minimum node height |
| `SAT_GAP`  | 30    | Gap between main node and satellite |
| `SAT_W`    | 200   | Satellite node width |
| `SAT_H`    | 100   | Satellite node height (fixed) |

**Coordinates**: `x = node.col × STRIDE_X`, `y = node.depth × STRIDE_Y`.

### Canvas JSON Structure

```json
{
  "nodes": [ CanvasNode, ... ],
  "edges": [ CanvasEdge, ... ]
}
```

### Main Conversation Nodes

**Normal nodes** (not `ann.unimportant`):

```json
{
  "id":     "{node.id}",
  "type":   "text",
  "text":   "{nodeText}",
  "x":      {Math.round(node.col * STRIDE_X)},
  "y":      {Math.round(node.depth * STRIDE_Y)},
  "width":  250,
  "height": {dynamic — see below},
  "color":  "{obsidianColorCode or empty string}"
}
```

**nodeText**: For root node, `"START"`. Otherwise `node.text` (full text, no truncation).
If `ann.star`, prepend `"⭐ "`. No prefix for `ann.unimportant`.

**Height**: Fixed at `NODE_H` (100px) regardless of text length. Full text is in the node
and scrollable/resizable in Obsidian. `STRIDE_Y = 200` leaves 100px whitespace between rows
so the tree and arrows remain readable.

**Unimportant nodes** (`ann.unimportant === true`): same `text` field (full text, no prefix),
but fixed minimal dimensions:

```json
{
  "width":  60,
  "height": 30
}
```

This makes them visually invisible at normal zoom while preserving the full text for recovery
by resizing in Obsidian.

### Satellite Note Nodes

For nodes where `ann.notes` is set, a satellite node is exported to the right:

```json
{
  "id":     "sat-{node.id}",
  "type":   "text",
  "text":   "📝 {ann.notes}",
  "x":      {Math.round(node.col * STRIDE_X + NODE_W + SAT_GAP)},
  "y":      {Math.round(node.depth * STRIDE_Y)},
  "width":  200,
  "height": 100,
  "color":  "5"
}
```

**Satellite height** (dynamic):
```js
Math.max(SAT_H, Math.min(400, Math.ceil(ann.notes.length / 33) * 22 + 24))
```
Min 100px (SAT_H), max 400px. Scales to fit the note text at SAT_W = 200px.

Edge from main node right → satellite node left:

```json
{
  "id":       "sat-edge-{node.id}",
  "fromNode": "{node.id}",
  "fromSide": "right",
  "toNode":   "sat-{node.id}",
  "toSide":   "left",
  "color":    ""
}
```

Satellite notes export for ALL nodes, including unimportant ones.

### Tree Edges

```json
{
  "id":       "edge-{parentId}-{childId}",
  "fromNode": "{parentId}",
  "fromSide": "bottom",
  "toNode":   "{childId}",
  "toSide":   "top",
  "color":    ""
}
```

### Sticky Canvas Notes

Free-floating `cttvCanvasNotes` exported below the tree in a 4-column grid:

- Start y: `(maxDepth + 2) * STRIDE_Y`
- x: `(i % 4) * 280`
- y offset per row: `200`
- width: `note.width || 250`, height: `150`, color: `"3"` (yellow)
- Skipped if `note.text` is empty/whitespace.

### Color Key

If `cttvColorKey` has any labeled entries, exported as a group + header + per-color nodes
at `x = -230`. Group id `colorkey-group`, header id `colorkey-header`, color items
`colorkey-{hex without #}`.

### Obsidian Color Mapping

| Annotation hex | Obsidian color code |
|---------------|-------------------|
| `#e55` (Red) | `"1"` |
| `#e93` (Orange) | `"2"` |
| `#9c9` (Green) | `"4"` |
| `#69f` (Blue) | `"5"` |
| `#c6f` (Purple) | `"6"` |
| starred (no color) | `"3"` (yellow) |
| no annotation | `""` (empty string) |

Priority: `ann.color` checked first; `ann.star` used only when no color is set.

---

**Document Version**: 1.1
**Last Updated**: 2026-05-22
**Approved By**: Phil

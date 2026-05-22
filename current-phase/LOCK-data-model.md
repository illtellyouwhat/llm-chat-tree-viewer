# LOCK-data-model.md
## LLM Chat Tree Viewer — Data Model Constraints

**Status**: ✅ LOCKED
**Last Updated**: 2026-05-20
**Version**: 1.1
**Purpose**: Annotation schema, prefs schema, storage key naming, canvas objects schema, handoff format.

---

## Storage Keys

| Key | Type | Scope | Description |
|-----|------|-------|-------------|
| `cttv-prefs` | object | Global | User preferences (colors, display options) |
| `cttv-ann-${conversationId}` | object | Per conversation | Node-level annotations |
| `cttv-canvas-${conversationId}` | object | Per conversation | Canvas-level objects (sticky notes) |
| `cttv-colorkey` | object | Global | Color → user label mapping |
| `cttv-handoff` | object | Session | Popout handoff data; volatile, overwritten on each detach |

**Naming rules:**
- Prefix all keys with `cttv-`
- Per-conversation keys use `${conversationId}` suffix
- Global keys have no suffix
- Never use keys that don't match this pattern

**Conversation ID format:** alphanumeric + hyphens, extracted from URL path `/c/{id}`.

---

## Annotation Schema (`cttv-ann-${conversationId}`)

Top-level object: `{ [nodeId: string]: NodeAnnotation }`. Keys are ChatGPT API mapping node IDs.

```
NodeAnnotation {
  star?:          boolean       // node is starred (⭐ indicator)
  color?:         string        // one of the five hex values: "#e55" | "#e93" | "#9c9" | "#69f" | "#c6f"
  notes?:         string        // freetext note; trimmed before save; omitted if empty
  unimportant?:   boolean       // node displayed as small circle
  notesPreview?:  boolean       // false = hide node text in hover preview; true/absent = show it
}
```

**Sparse storage rule**: Only non-default values are stored. Before writing, filter out entries where all fields are falsy. This is implemented in `saveAnnotations()` — do not change this behavior.

**Default state**: An annotation with no fields set is equivalent to no annotation. `cttvAnnotations[id]` returning `undefined` is normal.

---

## Prefs Schema (`cttv-prefs`)

```
Prefs {
  userColor?:      string    // hex color, default: '#99cc99'
  assistantColor?: string    // hex color, default: '#9999cc'
  userOnly?:       boolean   // show user turns only (collapse assistants), default: false
}
```

Hex validation in `applyPrefs()`: `/^#[0-9a-fA-F]{3,8}$/`. Values failing this test fall back to defaults.

---

## Canvas Objects Schema (`cttv-canvas-${conversationId}`)

```
CanvasData {
  stickyNotes?:   StickyNote[]
}

StickyNote {
  id:      string   // unique within conversation; use Date.now().toString() or similar
  x:       number   // px from left edge of #cttv-body content area
  y:       number   // px from top edge of #cttv-body content area
  text:    string   // note content; may be empty string
  color?:  string   // optional background color hex (from annotation palette or custom)
  width?:  number   // default 180px if absent
  height?: number   // saved after user resize; default auto if absent
}
```

**Position semantics**: x/y are stored as offsets from `#cttv-body` top-left, independent of scroll position. When rendering, add `#cttv-body`'s current scroll offsets.

---

## Color Key Schema (`cttv-colorkey`)

```
ColorKey {
  "#e55"?: string    // user-defined label for red annotation color
  "#e93"?: string    // user-defined label for orange
  "#9c9"?: string    // user-defined label for green
  "#69f"?: string    // user-defined label for blue
  "#c6f"?: string    // user-defined label for purple
  _visible?: boolean // whether the color key panel is currently shown
  _x?:       number  // draggable panel x position (px from #cttv-body left)
  _y?:       number  // draggable panel y position (px from #cttv-body top)
}
```

All fields optional. Absent = no label defined for that color. Empty string = user cleared label.
Not per-conversation: one color key for the whole user.

`_visible`, `_x`, `_y` are internal display state stored alongside labels in the same object.
Canvas export filters them out via `k !== '_visible' && typeof label === 'string'`.

---

## Handoff Schema (`cttv-handoff`)

```
Handoff {
  conversationId: string
  data:           object    // raw ChatGPT /backend-api/conversation/{id} response
  selectedId:     string | null    // currently selected node ID, or null
}
```

Written by content.js on detach. Read by panel-standalone.js on boot. Overwritten on each detach; do not treat as persistent.

---

## JSON Export Format (existing, settings panel)

The existing raw annotation export (settings "Export annotations..." button) produces:

```json
{
  "cttv-ann-{conversationId}": {
    "_url": "https://chatgpt.com/c/{conversationId}",
    "nodeId1": { "star": true, "notes": "..." },
    ...
  }
}
```

The `_url` field is added on export and stripped on import. Do not change this format.

E1 and E2 are NEW exports (markdown and canvas) that produce separate file formats.

---

## Node Object (in-memory, not stored)

Produced by `parseTree()`, consumed by layout and rendering functions.

```
TreeNode {
  id:       string       // ChatGPT mapping node ID
  eid?:     string       // turn_exchange_id from metadata
  role:     'user' | 'assistant' | 'root'
  text:     string       // display text (combined chain text for assistant nodes only)
  icons:    string[]     // subset of ['image', 'code', 'file']
  children: TreeNode[]
  col?:     number       // assigned by layoutTree()
  depth?:   number       // assigned by layoutTree()
}
```

Root node always has `id: '__root__'`, `role: 'root'`, `text: 'START'`.

---

**Document Version**: 1.2
**Last Updated**: 2026-05-22
**Approved By**: Phil

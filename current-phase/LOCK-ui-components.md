# LOCK-ui-components.md
## LLM Chat Tree Viewer — UI Component Constraints

**Status**: ✅ LOCKED
**Last Updated**: 2026-05-20
**Version**: 1.2
**Purpose**: Node dimensions, layout constants, CSS variable names, z-index stack, color palette.

---

## Layout Constants (panel-core.js)

These are JS constants inside `initPanel()`. Do not change without a lock file update.

| Constant | Value | Meaning |
|----------|-------|---------|
| `NODE_W` | 220 | Node width in px (permanent — no hover width change) |
| `NODE_H` | 60 | Node height in px |
| `NODE_GAP` | 20 | Gap between columns in px |
| `SATELLITE_W` | 220 | Satellite note node width (= NODE_W) |
| `SATELLITE_GAP` | 20 | Gap between node right edge and satellite left edge |
| `NODE_STRIDE_X` | 480 | `NODE_W + SATELLITE_GAP + SATELLITE_W + NODE_GAP` |
| `NODE_STRIDE_Y` | 80 | Vertical step between rows (`NODE_H + NODE_GAP`) |
| `PADDING` | 20 | Map outer padding in px |

Tree layout: `x = PADDING + col * NODE_STRIDE_X`, `y = PADDING + depth * NODE_STRIDE_Y`.

NODE_STRIDE_X is sized so each column slot fits: node (220) + gap (20) + satellite (220) + column gap (20) = 480. Satellite for the rightmost column fits within `totalW = (maxCol+1) * NODE_STRIDE_X + PADDING*2` naturally.

---

## Node DOM Structure

```
.cttv-node-outer[data-id]          80×60px, position:absolute, border-radius:12px, z-index:1
  └── .cttv-node.cttv-node-{role}  100%×100%, border-radius:10px, flex column, align-center, justify-end, padding-bottom:5px
      ├── .cttv-note-dot            [ADDED F2] 6px circle, position:absolute on outer, top:3px right:3px
      ├── .cttv-node-star           [optional] 26×26px circle, font-size:19px, emoji ⭐
      └── .cttv-node-icons          [optional] flex row, gap:3px; each icon 17×17px
```

**Unimportant node** inner style: `width:40px;height:40px;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);`

**Selected node** (.cttv-selected on outer): `box-shadow: 0 0 8px 5px rgba(255, 220, 0, 0.6)`

---

## Z-Index Stack

| Layer | Element | z-index |
|-------|---------|---------|
| Map SVG edges | `<svg>` inside `#cttv-map` | 0 |
| Multi-selection highlight | `.cttv-selection-highlight` | 0 |
| Node outers (normal) | `.cttv-node-outer` | 1 |
| Note dot | `.cttv-note-dot` | 2 |
| Node outer (expanded/hovered) — U1 | `.cttv-node-outer` hover state | 10 |
| Sticky notes (N1) | `.cttv-sticky-note` | 20 |
| Panel | `#cttv-panel` | 99999 |
| Tooltip (deprecated after U1) | `#cttv-tooltip` | 100000 |
| Context menu, notes dialog, settings | `#cttv-menu`, `#cttv-notes-dialog`, `#cttv-settings-dialog` | 100001 |

**Rule**: Nothing in `panel-core.js` may use a z-index above 99 within `#cttv-map` except as noted. Nothing in adapters may use z-index above 99998.

---

## Panel Dimensions

| Property | Value |
|----------|-------|
| Default panel width | 33vw |
| Min resize width | 200px |
| Max resize width | 80vw |
| Panel z-index | 99999 |
| Panel background | `rgb(33,33,33)` |
| Panel font | monospace, 12px |
| Panel text color | `#eee` |
| Border left | `1px solid #444` |

---

## Body / Map Area

| Property | Value |
|----------|-------|
| `#cttv-body` padding | 12px |
| `#cttv-body` overflow | auto |
| `#cttv-body` position | relative |
| Background dots | `radial-gradient(circle, #444 1px, transparent 1px)`, `background-size: 24px 24px` |
| Map position | relative (contains absolutely-positioned nodes) |
| Map sizing | computed: `(maxCol+1) * STRIDE_X + 2*PADDING` wide, `(maxDepth+1) * STRIDE_Y + 2*PADDING` tall |

---

## Node Color Palette

**Role colors** (default, overridable via prefs):

| Role | Default color | Pref key |
|------|--------------|---------|
| User | `#99cc99` | `userColor` |
| Assistant | `#9999cc` | `assistantColor` |
| Unknown | `#888888` | — |

Applied via dynamic `<style id="cttv-prefs-style">` element injected by `applyPrefs()`.

**Annotation colors** (border on `.cttv-node` inner div, 3px solid):

| Color value | Visual |
|-------------|--------|
| `#e55` | Red |
| `#e93` | Orange |
| `#9c9` | Green |
| `#69f` | Blue |
| `#c6f` | Purple |

These exact values appear in the context menu DOM (`data-color` attributes). Do not change.

---

## Note Dot — REMOVED (Phase 10)

`.cttv-note-dot` is removed. Replaced by satellite note nodes. Do not recreate it.

---

## Node Expansion (U1 + Phase 8 + Phase 10)

`.cttv-node-outer` transition: `max-height 0.18s ease` (width transition removed — width is permanent)

Default state:
- `max-height: 60px; width: 220px; z-index: 1` (width never changes — no hover width expand)

Hover expanded state:
- `max-height: 260px; z-index: 10` (width stays 220px)
- `overflow: hidden; border-radius: 12px` (unchanged)

`.cttv-node-text` element (child of `.cttv-node` inner):
- Always visible (not toggled by JS)
- Default: `-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden`
- Hover class `.cttv-node-text-expanded`: `display: block; overflow-y: auto; max-height: 220px; white-space: pre-wrap`
- `font-size: 10px; line-height: 1.4; word-break: break-word`
- `padding: 4px 6px 4px; box-sizing: border-box; width: 100%`
- `flex-shrink: 0; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1)`

**Pin mechanic removed (Phase 8)**: No `.cttv-pinned` class, no pin-on-click. Click always navigates.

---

## Satellite Note Nodes (Phase 10)

When a node has `ann.notes`, a satellite element is rendered to its right.

**Satellite element** (`.cttv-satellite-note[data-satellite-for="{nodeId}"]`):
- `position: absolute` inside `#cttv-map`
- `left: nodeX(n) + NODE_W + SATELLITE_GAP`, `top: nodeY(n)`
- `width: SATELLITE_W (220px)`, `min-height: NODE_H (60px)`, `max-height: NODE_H`
- `background: #1a2535; border: 1px solid #88ccff; border-radius: 12px`
- `overflow: hidden; transition: max-height 0.18s ease; cursor: pointer; z-index: 1`

**Satellite text** (`.cttv-satellite-text`):
- Same layout as `.cttv-node-text`: 2-line clamp, always visible
- `color: #cce8ff; border-top: 1px solid rgba(136,204,255,0.2)`
- Hover adds `.cttv-satellite-text-expanded` (same as `.cttv-node-text-expanded`)

**Hover**: `max-height → 260px`, `z-index → 10`, add `.cttv-satellite-text-expanded`
**Mouseleave**: restore `max-height → 60px`, `z-index → 1`, remove class
**Click**: opens the notes dialog for that node (same as right-click → Notes)

**SVG connector**: horizontal `<path>` from `(nodeX+NODE_W, nodeY+NODE_H/2)` to `(nodeX+NODE_W+SATELLITE_GAP, nodeY+NODE_H/2)`, `stroke="#88ccff"`, `stroke-width="1.5"`. Element carries `data-satellite-edge-for="{nodeId}"` for targeted remove in `refreshNode()`.

**Managed by**: `renderMap()` (initial render) and `refreshNode()` (incremental updates when note is added, changed, or cleared).

---

## Header and Controls

| Element | Style |
|---------|-------|
| Header padding | `8px 12px` |
| Header border | `1px solid #444` bottom |
| Control buttons (settings, detach, close) | `font-size: 19px`, no border/background, `#aaa` color, hover `#fff` |
| Settings dialog | `position: absolute; inset: 0; z-index: 100001; background: rgb(33,33,33)` |

---

**Document Version**: 1.2
**Last Updated**: 2026-05-20
**Approved By**: Phil — Phase 10 node width + satellite design confirmed

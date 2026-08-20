# Library Board & Two-Page Split — Design

**Date:** 2026-08-03
**Status:** Approved, building
**Extends:** `2026-08-03-vocabulary-library-design.md`

## Purpose

The word-wall grid (previous iteration) solved "see most of the library on one screen" but
is static — a dense list, not something George can interact with. He wants the app split
into two full-screen views (Translator / Library), and the Library rebuilt as a dynamic,
horizontally-navigable board that uses the whole screen, lets him move words between
categories and reorder categories directly, and restores opposite-pairs as a dedicated,
recall-friendly display (as in his original `Hebrew Table.xlsx`).

## Decisions

| Question | Decision |
|---|---|
| Board layout | Category lanes — horizontal-scrolling columns, Trello-style |
| Opposites | Dedicated lane, pinned first, pairs shown joined; word appears there only, not duplicated in its topic lane |
| Pairing mechanism | Drag one tile onto another anywhere on the board to link them; drag out of the Opposites lane to unpair |
| Recategorizing | Drag a tile into a different lane; updates `cat` |
| Reordering categories | Drag lane headers; custom order persists |
| Page split | Single file, top nav (Translator / Library) swaps full-screen views, no reload |
| Fallback controls | ✎/✕ hover buttons kept on every tile for edit/delete without dragging |

## Architecture

### Pages

A top-level nav bar (two buttons: Translator, Library) toggles a `data-view` attribute on
`<body>`; CSS shows/hides the two top-level view containers. Last-viewed page persists in
`localStorage` (`hvr_activeview`). All existing Translator markup/behavior (input box, three
translate modes, word cards, saved messages) moves under a `#viewTranslator` container
unchanged. The Library panel becomes `#viewLibrary`, full viewport width (no 980px cap).

### Lanes

All 18 lanes render always (17 `CATS` entries + synthetic `Opposites`), even when empty —
an empty lane is still a valid drop target. Default order: `Opposites` first, then `CATS` in
existing order. Order is stored in `hvr_laneorder` (array of lane names); a lane not yet in
a stored order is appended before `Uncategorised` the first time it's seen.

Each lane is a fixed-max-height column with its own internal vertical scroll (so a 240-word
lane doesn't dominate); the board scrolls horizontally between lanes. Tiles inside a lane
keep the He/pronunciation/English content from the word-wall design, in a more compact
row-oriented shape suited to the lane's width.

**Opposites lane membership is computed, not stored as a separate list**: any entry with a
non-empty `opp` field whose `opp` target also points back is rendered in the Opposites lane
(as a joined pair) and skipped when rendering its normal `cat` lane.

### Drag and drop

Native HTML5 drag-and-drop (`draggable`, `dragstart`/`dragover`/`drop`), no library.

- **Tile → lane body**: sets `lib[key].cat` to the target lane; if the tile currently has an
  `opp` partner, dragging it out of the Opposites lane into a normal lane clears `opp` on
  both sides (unpair) before applying the category move.
- **Tile → another tile**: sets `opp` on both entries to point at each other (overwriting any
  previous pairing on either side — the last drag wins). Both tiles re-render into the
  Opposites lane.
- **Lane header → lane header**: reorders `hvr_laneorder` by splicing the dragged lane to the
  drop target's position; `Opposites` and `Uncategorised` are draggable like any other lane
  (no special-casing, simpler code, no functional downside).

### Fallback controls

Every tile keeps the existing hover ✎ (opens the shared editor popup — unchanged, still
handles category reassignment and text edits) and ✕ (delete) from the word-wall design.
Drag is additive, not a replacement for these.

### What's unchanged underneath

Library data model (`hvr_library`), harvesting, the shared edit popup, XLSX export (its
Browse sheet already treats opposites as a distinct block — this UI change brings the live
app in line with what export already did), Translator behavior. Only new field usage:
`opp` becomes writable at runtime via drag, not just via seed/manual edit.

## Non-goals

Manual "add word" form inside the board (words still arrive via reading or the ⊕ on reading
cards); per-lane color theming; a pannable/zoomable canvas; touch-drag polish beyond what
native HTML5 DnD gives for free.

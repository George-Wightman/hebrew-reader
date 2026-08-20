# Excel-Style Grid Library — Design

**Date:** 2026-08-03
**Status:** Approved, building
**Supersedes the Library UI in:** `2026-08-03-library-board-design.md`

## Why this replaces the lane board

The lane board and the word-wall grid before it both failed the same test: George cannot
take in the library at a glance, and it is less accessible than the spreadsheet it was meant
to improve on. The root cause is density. Each word was rendered as a *card* — three lines
plus padding, ~60px tall, with Hebrew script as the largest element. His spreadsheet gives
each word a single ~19px row of plain text. That is roughly a 6× difference; the card
designs fit ~40 words on screen where the sheet fits ~250.

Two further problems: the Hebrew script dominated visually but is not yet useful to him
(he cannot read it fluently), and fixed-width lanes left short categories as half-empty
columns while forcing a rigid one-category-per-column structure.

## Decisions

| Question | Decision |
|---|---|
| Row format | Pronunciation leads (normal weight), English beside it (grey), Hebrew ~10px pushed right |
| Layout | Free placement on a true coordinate grid — blocks positioned by the user, drag to move |
| Opening layout | Mirrors `Hebrew Table.xlsx` block-for-block |
| Flavours | Restored as its own category (was wrongly folded into Food & drink) |
| Loose-ends block | Not recreated — those words are correctly filed by meaning |

## Architecture

### Grid model

An invisible coordinate grid of **90px columns × 19px rows**. Each block stores
`{col, row}`; blocks render absolutely positioned and snapped to the grid.

- **Height is automatic** — `1 + wordCount` rows. Never manually set.
- **Width is by type** — 2 units for a normal block, 4 for the opposites block (pairs need
  two pronunciation+meaning columns, as in the sheet's A–D).
- Dragging a block header moves it. On drop, if the target area overlaps another block, the
  block slides down to the first clear row rather than covering words.
- Canvas scrolls both axes and grows with content.

Persisted in `hvr_blocklayout` as `{ "<Category>": {col, row} }`.

### Block rendering

Header (category name + count), then one `<div>` per word at 19px line height:

```
gadol      big                        גדול
```

Opposites blocks render `gadol big ↔ katan small` across the 4-unit width.

### Opening layout

On first run, blocks are placed to mirror the spreadsheet: **Opposites** (4 wide) at column
0, then **Weather**, **Time**, **Flavours** left-to-right in the sheet's order, each 2 units
wide with a 1-unit gap. Remaining categories auto-place to the right, then wrap.

### Interactions retained

Drag a word row between blocks to recategorise; drag a word onto another to pair them as
opposites; hover a row for ✎ / ✕; search filters rows in place; XLSX export unchanged.

### Density controls

- **Zoom** — scales the whole grid (font and row height together).
- **Hebrew size** — off / tiny / full, so the script can grow back as it becomes useful.

## Category audit (bundled fix)

Categories were assigned by inserting `@n|Category` sentinel keys into `DICT` **by line
number**, so section boundaries are approximate and some words sit in the wrong section.
Separately, `SEED` and `DICT` disagree on several words (e.g. `נעים` — Describing words in
one, Weather in the other; `עבודה` — Work & study vs Everyday things).

Fix: a `CAT_FIX` override map applied after the sentinel pass, correcting specific words
without re-typing the dictionary, plus reconciling `SEED` to agree with it. Audited by
dumping every category's word list and reviewing for misfits.

## Out of scope

Manual block resizing (width follows type); freeform blocks not backed by a category;
auto-tidy of the user's chosen layout.

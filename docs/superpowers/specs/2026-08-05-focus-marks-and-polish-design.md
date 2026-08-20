# Focus Marks, Density and Critical Explainer — Design

**Date:** 2026-08-05
**Status:** Approved, building
**Amends:** `2026-08-03-excel-grid-design.md` (Library rows), `2026-08-05-explain-merge-design.md`
(the `notes` prompt rules)

## Why

Four refinements from real use:

1. **Nothing to mark words with.** No way to flag the words George keeps forgetting, so the
   Library is a flat list where everything has equal weight.
2. **The Library page no longer fits on one screen** — 1002px of content in a 694px viewport.
   The `.libnote` instruction paragraph (501 chars, 75px) is onboarding text he's outgrown; it
   grew when the sentence pad was documented into it.
3. **Gemini calls only signal via a line of status text** at the top, easy to miss, so it isn't
   obvious the app is waiting on the network.
4. **The explainer pads.** It confirms what's already correct, which is wasted reading — if a
   word is right, it's right because he knew it. He wants criticism, and bluntness when a
   sentence is genuinely wrong.

## Decisions

| Question | Decision |
|---|---|
| Highlight trigger | A **★ button in the existing hover row**, never a bare click — see below |
| Highlight persistence | Persists across sessions, in `hvr_focus` |
| Highlight appearance | Bold text + coloured left edge on the row |
| Marked-count | Shown in the Library header; clicking it filters the grid to marked words only |
| Instructions paragraph | Moved behind a `?` toggle in the header, collapsed by default, state remembered |
| Loading signal | Click-through pulsing ring inside the viewport edge, on a shared helper |
| Reduced motion | Static ring instead of pulsing |
| Explainer tone | Critical only. No confirming what's right. Blunt when the sentence is wrong. |
| No-rewrite rule | **Unchanged.** Still never supplies the corrected sentence. |

## Why ★-on-hover and not click-to-toggle

Library rows are draggable, and this has already caused real damage once: accidental drags on
19px rows scrambled the Opposites block, which is why `pairWords()` now requires a `confirm()`.
Binding highlight to a bare row click walks straight back into that failure mode — every
slightly-off drag attempt would silently toggle a mark, and unlike pairing there'd be no
confirmation to catch it.

So marking reuses the **existing `.rowact` hover pattern** that already carries ✎ and ✕. No new
gesture, no drag ambiguity, and consistent with how every other per-row action in the grid works.

## Architecture

### Focus marks

Store `hvr_focus`: `{ "<hebrew>": 1 }`. A plain set keyed by the same Hebrew key the library uses,
so it survives recategorising, pairing, and editing without needing to be kept in sync.

- `focusAll()` / `focusSave()` / `focusToggle(key)` — same shape as the existing `knownAll()` /
  `aliasAll()` stores.
- `buildRow()` gains a ★ in its `.rowact` group. Filled (★) when marked, hollow (☆) when not.
- A marked row gets class `.gfocus`: `font-weight: 600` plus a 3px accent left border.
- The Library header shows `N marked` when non-zero. Clicking it toggles a **filter mode** showing
  only marked words; clicking again clears the filter. Filter state is in memory only — it's a
  view, not a preference, and coming back to a mysteriously-empty-looking Library after a reload
  would be confusing.
- Filter composes with the existing search box: both narrow the same set.
- Settings gains **Clear all marks**, beside the existing resets. It touches nothing but
  `hvr_focus`.

Marks are deliberately **not** exported to XLSX. The export mirrors the vocabulary table; a
personal working-set flag isn't part of that, and adding a column would shift the layout the
export was built to match.

### Instructions toggle

`.libnote` gets `display: none` by default, with a `?` button in `.boardhead` toggling it.
State in `hvr_notesopen`. Default **collapsed** — the reverse of today, since the text has served
its purpose and the reason for this change is reclaiming the space.

### Loading ring

A single fixed element, `#busyRing`, `pointer-events: none` (it must never intercept a click),
`z-index` above the grid but below the read-aloud overlay:

```
inset ring via box-shadow, app accent colour
animation: 1.6s ease-in-out infinite alternate on opacity
@media (prefers-reduced-motion: reduce) -> no animation, fixed low opacity
```

Driven by `busy(on)` — a single helper both the pad's Gemini path and any future call site use,
rather than each remembering to toggle it. It is **reference-counted**, not a boolean: two
overlapping calls must not have the first one to finish switch the ring off while the second is
still running.

Status text stays but shortens — the ring now carries "something is happening", so the text
doesn't have to.

### Critical-only explainer

The `notes` rules in the merged prompt change from *"two or three sentences about the sentence as
a whole; if anything reads oddly, say why"* to:

- Report **only** what is wrong, weak, or would confuse a native speaker.
- **Do not confirm what is correct.** No praise, no restating what worked. If a word is right,
  he already knew it.
- If the sentence does not make sense, **say that plainly and first** — don't soften it.
- If genuinely nothing is wrong, say so in a handful of words. Don't pad.

Unchanged and still binding: no rewritten Hebrew sentence anywhere; every Hebrew word mentioned
carries its pronunciation in English letters; no grammar jargon; under 90 words.

## Error handling

- **`hvr_focus` holds a word later deleted from the library** — the mark is simply never rendered.
  Harmless; no cleanup pass needed, and cleaning it up would lose the mark if the word returns.
- **Filter active with zero marked words** — cannot occur: the count is only clickable when at
  least one word is marked, and un-marking the last one while filtered drops the filter.
- **Gemini call throws before its `finally`** — `busy()` is reference-counted and decremented in a
  `finally`, so the ring cannot be left stuck on.

## Testing

1. ★ toggles a mark; it survives a reload; the row renders bold with the accent edge.
2. Marking does **not** fire from a drag — dragging a row to another block recategorises it and
   leaves its mark untouched.
3. Header count is accurate; clicking it filters to marked words only; clicking again restores.
4. Filter and search compose rather than fighting.
5. Un-marking the last word while filtered exits the filter rather than showing an empty grid.
6. `?` toggles the instructions; collapsed by default; state survives reload.
7. The Library page fits the viewport with instructions collapsed.
8. Ring appears during a live Gemini call and is gone afterwards, including on failure.
9. Ring never blocks a click (verify `elementFromPoint` through it).
10. **Live API:** notes contain no confirmation of correct words, no rewritten Hebrew sentence,
    and a deliberately nonsensical sentence is called out plainly.
11. Regression: pad, read-aloud, keep/drafts, export, drag-recategorise, drag-to-pair, grid
    geometry.

## Out of scope

- Marks in the sentence pad — the mark means "a word I'm working on", which is a property of the
  vocabulary, not of a draft sentence.
- Multiple mark colours or categories of mark. One flag, one meaning.
- Exporting marks to XLSX (see above).

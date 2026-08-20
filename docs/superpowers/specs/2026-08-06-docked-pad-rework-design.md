# Docked Pad, Single AI Provider, Archive Drawer — Design

**Date:** 2026-08-06
**Status:** Approved, building

## Why

The app is organised by **data type** (translator / library / archive) but the work is a single
continuous task: understand what grandad said, then write back. Every tab switch is George paying
for an organising principle that doesn't match what he's doing — he isn't "visiting the library",
he's reaching for a word mid-sentence.

Two concrete consequences:

- **The pad is a guest on the Library page.** It sits below the grid, so it's the first thing
  pushed off-screen as the library grows — exactly backwards, since it's the thing being produced.
  At 115 words it already doesn't fit; it only gets worse.
- **The received message is reference material too**, but it lives a tab away from where the reply
  is written.

Plus two smaller items: two AI providers where one suffices, and the Archive occupying a top-level
tab despite being occasional.

## Decisions

| Question | Decision |
|---|---|
| AI provider | **Gemini only.** Anthropic key removed entirely. |
| Copy-prompt / paste-result | **Kept** — the no-key, no-quota escape hatch |
| Archive | Collapsible drawer at the foot of the Library page, not a tab |
| Pad | **Fixed dock at the bottom of the window, on every tab**, never scrolled away |
| Message context | One collapsed line above the pad, expandable |
| Decoration | None. Wins come from hierarchy and density, not colour. |

## 1. Single AI provider

`aiBtn` ("Translate with AI") currently calls `api.anthropic.com` with `store.key`. It moves to
`geminiRequest()` — the same shared retry stack the pad and audio transcription already use, so it
inherits model fallback, the backup key, `thinkingLevel: minimal`, and the 429 messaging for free.

The Anthropic key field and its note leave Settings. `store.userDict` is untouched — that's the
personal-corrections store and unrelated. Copy-prompt / paste-result stay exactly as they are.

## 2. Archive as a drawer

`#viewArchive` stops being a view and becomes a collapsible section at the foot of the Library
page, using the same disclosure pattern as the sentence pad. The `navArchive` button is removed and
`VIEWS` returns to two entries. `renderArchive()` is unchanged and is called when the drawer opens.
Open/closed state persists in `hvr_archopen`, default closed.

## 3. The docked pad

The pad moves out of `#viewLibrary` and becomes a `position: fixed` strip pinned to the bottom of
the window, rendered once and visible on both tabs. Switching tabs changes what sits *behind* it —
the message on one, the word grid on the other — while the sentence being written stays put.

**Layout mechanics:**

- Fixed to the bottom edge, full width, above page content but below the busy ring and the
  read-aloud overlay (`z-index` 40 / 55 / 60 respectively).
- `max-height: 45vh` with internal scrolling, so a long draft or a big drafts list can never
  swallow the whole window.
- **`body` gets a bottom padding equal to the pad's live height**, so page content is never hidden
  underneath it. Measured and applied by `syncPadOffset()` after every render, toggle, and window
  resize — a fixed guess would drift the moment the pad's content changes height.
- Collapsed, it is a single bar showing the title and word count — enough to prove it's there
  without costing vertical space.

**Message context line:** `render()` records the last message's translation and source to
`hvr_lastmsg`. The pad shows a single truncated line — *"Replying to: …"* — which expands to the
full English translation plus the Hebrew transcript. It does **not** reproduce the per-word gloss;
that's what the Translator tab is for, and duplicating it would cost the vertical space this whole
change is trying to reclaim. Hidden entirely when no message has been read yet.

## Error handling

- **Pad height changes** (draft list grows, explanation appears/clears, textarea dragged) — every
  such path calls `syncPadOffset()`; missing one leaves content hidden behind the dock, which is why
  it's called from `renderPad`, the toggle, `padRenderDrafts`, the explanation show/clear, and a
  window `resize` listener.
- **Very short viewport** — the 45vh cap plus internal scroll means the pad can always be collapsed
  back to its bar.
- **No message read yet** — the context line is hidden rather than showing an empty "Replying to:".
- **Gemini unavailable** — unchanged; falls back to copy-prompt exactly as the pad already does.

## Testing

1. "Translate with AI" produces a glossed message via Gemini; no request goes to anthropic.com.
2. Anthropic field gone from Settings; `store.userDict` still saves and loads.
3. Copy-prompt / paste-result still work with no key configured.
4. Archive drawer opens/closes from the Library page, state persists, `renderArchive` still lists
   and promotes correctly. No third nav button; `setView("archive")` no longer resolves.
5. Pad is visible on **both** tabs, keeps its text across a tab switch, and stays pinned while the
   grid scrolls.
6. `body` padding matches the pad's height when collapsed, expanded, and after drafts render — no
   content trapped underneath.
7. Read-aloud overlay and busy ring both still sit above the pad.
8. Context line appears after reading a message, expands, and is absent on a fresh install.
9. Regression: grid geometry, focus marks, filter, drag-recategorise, drag-to-pair, export,
   audio transcription, Explain, Keep/drafts, dismissed-word memory, archive backfill.

## Out of scope

- Merging the two tabs into one studio view — rejected as the bigger gamble; revisit only if the
  dock proves insufficient.
- Any decorative restyling. Hierarchy and density only.

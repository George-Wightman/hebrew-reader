# Word-Tile Feedback, and Fixing the Explanation API Call

**Date:** 2026-08-08
**Status:** Approved, building

## Why

Three reports from real use, one of them a genuine bug of mine.

1. **The explanation call got slower and returned `HTTP 503`.** George suspected the audio work
   broke it. Checked rather than assumed: `geminiRequest` is byte-for-byte unchanged — same
   `GEMINI_MODELS`, same `thinkingLevel: "minimal"`, same loop; `geminiTTS` was added as a sibling
   and never touched it. `thinkingLevel: "minimal"` is also still valid (and is now the *default*
   for Gemini 3.6 Flash), so the speed config isn't being silently rejected via the 400-retry path.
   **But there is a real gap that is mine:** when 5xx retry was added for audio, it was never
   back-ported to the text path, so a single transient 503 is an instant hard failure.
2. **The feedback is a wall of prose.** George wants a word-by-word view of the corrected sentence,
   colour-coded by what happened to each word, with per-word explanations on demand.
3. **The reply-context box shows more than it's worth**, and should default to one line.

## Decisions

| Question | Decision |
|---|---|
| Model for explanations | **Flash-Lite first**, Flash as fallback — scoped per-call, not global |
| Transcription's model order | **Unchanged** (Flash first) — lite is likely worse at audio |
| 5xx handling | Retry 3× with backoff, `>=500` only; 429/400 behaviour untouched |
| Corrected sentence | **Shown**, reversing the earlier "never write it out" rule |
| Prose notes | **Kept**, below the tiles |
| Explanation on edit | **Kept and marked stale**, not cleared — reverses the earlier rule |
| Reply box | Collapsed by default; fix the never-resets bug |

## 1. API fixes

**5xx retry.** `geminiFetchWithRetry(url, body)` — up to 3 attempts, 700ms then 1400ms backoff,
retrying only `status >= 500`. Anything else returns immediately so the existing `429`
(break to next model/key) and `400` (retry without the speed config) logic is completely unchanged.
This mirrors `ttsFetchWithRetry` deliberately; the two exist separately because their surrounding
loops differ, but the retry policy is identical on purpose.

**Model order, scoped.** `geminiRequest(parts, models)` takes an optional model list, defaulting to
the existing `GEMINI_MODELS`. A new `GEMINI_MODELS_FAST = ["gemini-flash-lite-latest",
"gemini-flash-latest"]` is passed **only** by the pad's explain call.

Justification from George's own AI Studio dashboard: `gemini-flash-latest` → Gemini 3.6 Flash at
**20 requests/day**; `gemini-flash-lite-latest` → Gemini 3.5 Flash Lite at **500/day**, and lite is
faster. For explanations that trade is clearly right. **Audio transcription keeps Flash first** —
degrading transcription quality while fixing an unrelated speed complaint would be a bad trade made
invisibly.

**Timing.** `geminiRequest` records elapsed ms and the model that actually answered into
`lastGeminiTiming`. The pad shows it: *"done in 2.4s · flash-lite"*. The next "it feels slow" report
then comes with a number attached — the same move that turned the opaque TTS quota problem into a
fixable one.

## 2. The JSON contract

```json
{"sentence": [{"hebrew":"אני","translit":"ani","english":"I","status":"ok"},
              {"hebrew":"לשחק","translit":"lesachek","english":"to play",
               "status":"fixed","was":"limshoch","why":"..."}],
 "words":   [{"hebrew":"...","translit":"...","english":"...","category":"..."}],
 "notes":   "..."}
```

`words` and `notes` keep their exact current shape, so `padIngest()` (Pending) and the prose
paragraph need no changes at all.

`sentence` is new: one entry per word of the **corrected** sentence, in Hebrew reading order.

| `status` | Meaning | Colour |
|---|---|---|
| `ok` | He got this word right | green |
| `translated` | He wrote English; this is the Hebrew | blue |
| `fixed` | He used the wrong Hebrew word or form | red |
| `added` | Hebrew needs this word; he omitted it | amber |

`was` and `why` are required for everything except `ok`, and ignored on `ok`.

## 3. Rendering

`padRenderTiles(sentence)` builds a `.padtiles` row (`direction: rtl`) of `.ptile` elements reusing
the Translator card's visual language: Hebrew large, transliteration, English. Status drives a
colour class.

- `ok` tiles are inert — no cursor, no click, nothing to say. That is the point: the earlier rule
  against praising correct words still holds, it's just expressed visually now.
- Non-`ok` tiles are buttons. Clicking opens that word's `why` in **one shared detail panel below
  the row** — replacing its contents, never stacking — with the struck-through `was` above it.
  Clicking the active tile again closes it.

**Dock height is the real constraint.** The pad is a fixed-height dock and this adds a tile row, a
detail panel and the retained prose. `syncPadOffset()` must be called on every tile open/close, the
same discipline the dock already requires everywhere else.

## 4. Staleness: kept, not cleared

The earlier rule wiped the explanation on any edit, reasoning that a stale explanation would be
trusted and so was worse than none. That reasoning is sound but the cure was too strong: it made
feedback unusable *while applying it*, which is exactly when it's needed.

New behaviour: `padExplainFor` still records the text the explanation describes, but on divergence
the panel is **marked stale rather than destroyed** — dimmed via a `.stale` class, with a banner
reading *"You've edited since this — press Explain to refresh."* It survives until Explain is
pressed again. The original correctness concern is met by making staleness impossible to miss,
rather than by deleting the content.

## 5. Reply box

Two changes:
- `padRenderReply()` **never resets `padReplyFull` to hidden when a message exists** — so once
  expanded, it stays expanded across every subsequent message. That is a real bug and is very
  likely why the box "shows the translation and the Hebrew" unprompted. It now resets the panel and
  the caret on every render.
- Collapsed is the default state, as it was always meant to be.

## 6. Failure modes

| Condition | Behaviour |
|---|---|
| Transient 503/500 | Retried up to 3×; only a persistent failure surfaces to the user |
| Reply has no `sentence` array | Tiles skipped, prose notes and Pending ingest still render — old-shape replies degrade, never throw |
| A `sentence` entry missing `hebrew` | That tile is skipped rather than rendering an empty card |
| Non-`ok` entry with no `why` | Tile renders and is coloured, but isn't clickable |
| Quota exhausted on both models | Existing copy-prompt fallback, untouched |
| Kept draft's saved note | `padShowRawNote` path unchanged — drafts saved before this round still restore |

## 7. Testing

1. `geminiFetchWithRetry` retries a 500 and succeeds on attempt 2; gives up after 3; does **not**
   retry 400 or 429; incurs no delay on a non-retryable status.
2. The pad's explain call requests flash-lite first; transcription still requests flash first.
3. Timing is recorded and rendered in the status line.
4. Tiles render one per `sentence` entry, in order, with the right colour per status.
5. `ok` tiles are not clickable; non-`ok` tiles open their `why` in the shared panel; clicking the
   active tile closes it; opening another replaces rather than stacks.
6. A reply with no `sentence` key still ingests words and shows notes.
7. Editing after an explanation marks it stale (dimmed + banner) and does **not** clear it;
   pressing Explain again clears the stale state.
8. `padRenderReply` leaves the full panel collapsed on a fresh render even after a previous expand.
9. `syncPadOffset` is called on tile open/close, so nothing hides under the dock.
10. Regression: Learn session, translator read, library grid, archive drawer, drafts save/restore.

## Out of scope

- Changing what the Translator page's word cards look like — tiles reuse their styling, not their code
- Hover-preview of explanations (click only; reliable, and works the same on touch)
- Any change to `padIngest`, Pending, or the alias-learning path

# Pad Status, Teaching Feedback, Prefix Stripping and Speed — Design

**Date:** 2026-08-06
**Status:** Approved, building
**Amends:** `2026-08-05-explain-merge-design.md` (notes rules, model config),
`2026-08-05-focus-marks-and-polish-design.md` (critical-only tone — partially reversed, see below)

## Why

Five problems from real use:

1. **The "Checking…" status is at the top of the page.** `padStatus()` writes to `#libStatus` in
   the Library header, but the pad is far below it — so the one signal that a call is running is
   off-screen exactly when you're looking at the pad.
2. **The pad wastes vertical space**, which is what stops the page fitting one screen.
3. **The critical-only feedback doesn't teach.** It names the error but not the remedy, so there's
   nothing to carry into the next sentence.
4. **Pending gets prefixed forms** — `ha-gever` (הגבר), `ba-gina` (בגינה) — when the library should
   hold base words: `gever` (גבר), `gina` (גינה).
5. **Calls take ~10 seconds.**

## The speed finding

Measured, not assumed. The current call on the real prompt:

| Variant | Time | Thinking tokens | Output tokens |
|---|---|---|---|
| `gemini-flash-latest`, default | **10,228 ms** | 2,021 | 281 |
| `gemini-flash-latest` + `thinkingLevel: "minimal"` | **2,250 ms** | 0 | 258 |

**The model was never the problem — the reasoning budget was.** ~88% of generated tokens were
invisible thinking. `thinkingBudget: 0` (the 2.5-era control) is **rejected outright by 3.x with
`400 Request contains an invalid argument`**; 3.x uses `thinkingLevel`, and `"minimal"` is
accepted and returns 0 thinking tokens.

Quality did not degrade — it improved. The fast reply volunteered *"say האיש (ha-ish) for
'the guy/man'"* and *"Beboker needs the prefix ב (ba)"*, which is precisely the teaching register
requested in item 3. No model change is needed; `gemini-flash-latest` stays.

## Decisions

| Question | Decision |
|---|---|
| Status location | A line inside the pad, beside the action buttons |
| Edge pulse | Kept — ambient signal, complementary to the in-pad text |
| Feedback tone | Critical **and** instructive: name the fault, give the better option, give the rule |
| Whole-sentence rewrite | Still not supplied — guidance is word/pattern level |
| Prefix handling | Prompt asks for base forms **and** a client-side stripper as a net |
| Multi-word phrases | **Exempt from stripping** |
| Model | Unchanged (`gemini-flash-latest`, `gemini-flash-lite-latest` fallback) |
| Speed | `thinkingLevel: "minimal"`, with a retry that drops the config on a 400 |

## Architecture

### Status in the pad

`padStatus()` retargets from `#libStatus` to a new `#padStatus` span in the pad's action row.
`setLibStatus()` remains for genuinely Library-scoped messages (opposites reset, word edits) so
the two don't get conflated.

### Spacing

Reductions in `.padstrip-head` padding, `.padlabel` margins, and `#padInput` min-height. Target
is roughly 40–50px, enough to bring the page back inside one screen alongside the collapsed
instructions from the previous round.

### Teaching feedback

The `notes` rules change from *"only say what is wrong; do not confirm what is correct"* to:

1. Lead with what is wrong or would confuse a native speaker — **unchanged**, still blunt, still
   no praise for what already works.
2. **Then give the better option and the rule behind it**, so the pattern transfers to the next
   sentence rather than fixing only this one.
3. Do **not** hand over a complete rewritten sentence. Word-level guidance and the reason for it;
   he assembles the result and decides whether to take the advice.
4. Unchanged: every Hebrew word carries its pronunciation, no grammar jargon, under 90 words.

**This partially reverses the previous round's critical-only decision**, at explicit request:
*"still critical but give me guidance and tell me what would be better and I will choose if I
implement that."* The earlier no-rewrite rule was about not having the work done for him; the
boundary now sits at *whole-sentence* rewriting rather than at all guidance.

### Prefix stripping

Two independent layers, because neither alone is reliable:

- **Prompt:** ask for the base dictionary form, without ה/ב/ל/ו/מ/ש/כ prefixes — גבר (gever), not
  הגבר (ha-gever).
- **Client net — `stripPrefixEntry(hebrew, translit)`:** if the transliteration begins with a
  known prefix followed by a hyphen (`ha-`, `ba-`, `be-`, `bi-`, `la-`, `le-`, `li-`, `mi-`,
  `me-`, `ve-`, `she-`, `ka-`, `ke-`) **and** the Hebrew begins with that prefix's letter, remove
  both. The model hyphenates exactly at the morpheme boundary, which makes this reliable in
  practice without needing morphological analysis.

Guards, both necessary:

- **Multi-word Hebrew is exempt.** `בזמן האחרון` (bazman ha'acharon, "recently") is a real idiom
  beginning with a prefix letter; stripping would destroy it.
- **The remainder must be substantial** — at least 2 Hebrew characters — so a short word isn't
  reduced to a fragment.

**Alias learning must use the stripped pair.** If the typed gap was `hagever` and the stored word
becomes גבר/`gever`, learning `hagever → גבר` would be wrong: the pad would then render גבר and
silently lose the ה. Instead the alias is learned as `gever → גבר`, and `padLookup`'s existing
prefix tier resolves `hagever` by stripping `ha`, finding `gever`, and prepending ה. Writing
behaviour is therefore unchanged; only what lands in the library differs.

### Speed

`generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } }` on every request.

Because model APIs churn — a dated model name has already been retired underneath this app once —
a `400` response while the config is present triggers **one retry without it**. A future model
that wants different wording degrades to "slower but working" rather than breaking. Non-400
failures keep the existing behaviour: try the next model, then fall back to copy/paste.

## Error handling

- **400 caused by `thinkingConfig`** — retried once without it, per model.
- **429 / network / no key** — unchanged; next model, then copy-prompt fallback.
- **Prefix stripping produces an empty or 1-character remainder** — stripping is abandoned and the
  original form is stored, since a fragment is worse than a prefixed word.
- **Status text and edge pulse** are independent; neither failing affects the other.

## Testing

1. `padStatus` writes inside the pad and is visible without scrolling; `setLibStatus` still
   targets the Library header.
2. Pad height reduced; Library page fits a 900px viewport.
3. **Live API:** `thinkingLevel: "minimal"` returns 0 thinking tokens, completes in roughly a
   quarter of the previous time, and still yields parseable JSON with both `words` and `notes`.
4. **Live API:** notes name the fault *and* offer a better option with its reason, and contain no
   full rewritten Hebrew sentence.
5. `stripPrefixEntry` unit cases: `ha-gever`/הגבר → `gever`/גבר; `ba-gina`/בגינה → `gina`/גינה;
   `mistakel`/מסתכל unchanged; multi-word `bazman ha'acharon`/`בזמן האחרון` unchanged; a
   short word whose remainder would be under 2 characters unchanged.
6. Typing `hagever` still resolves to הגבר in the pad after the base form is stored — the prefix
   tier covers it, and the learned alias is the stripped pair.
7. A 400 from the thinking config falls back to an un-configured retry rather than failing.
8. Regression: Library grid, focus marks, filter, drag-recategorise, drag-to-pair, export,
   read-aloud, keep/drafts, grid geometry.

## Out of scope

- Changing model. The measurement shows it isn't the bottleneck.
- Stripping prefixes from words already in the library — a migration would rewrite entries the
  user has already reviewed and possibly edited. New words only.
- Morphological analysis beyond the hyphen heuristic.

# Merging Ask + Explain — Design

**Date:** 2026-08-05
**Status:** Approved, building
**Amends:** `2026-08-05-sentence-pad-design.md` (the Ask-about-gaps mechanism) and
`2026-08-05-sentence-explainer-design.md` (the trigger, payload, and response shape sections —
the pedagogy rules in that spec are unchanged and still binding)

## Why

Two separate buttons, two separate calls, for jobs that overlap. Worse: **Explain couldn't see
your whole sentence.** It only ever looked at words already resolved — anything still a gap was
explicitly excluded ("ignore these") — so a sentence with any unknown word could only be
partially explained, and you had to Ask, wait, then Explain, to get commentary on the complete
idea.

Designing the merge surfaced a second, more concrete problem: **Read Aloud reads your raw typed
text, not the Hebrew it resolved to.** Type `playing minecraft`, get those words resolved into
Hebrew — Read Aloud still says "playing minecraft" in English, mid-sentence, into what's supposed
to be a spoken Hebrew reply. That's the sharper version of what George described wanting fixed.

## Decisions

| Question | Decision |
|---|---|
| Calls | One button, one request, replacing both Ask and Explain |
| What's sent | The raw sentence exactly as typed — English placeholders included |
| What comes back | One JSON reply: unknown-word entries (as today) + short notes |
| The "no rewrite" rule | **Unchanged and still binding.** See below — it holds structurally now, not just by prompt instruction |
| Main readable content | Built by the app from resolved words, mechanically — never AI-authored |
| Read Aloud | Now uses that same resolved line instead of the raw textarea |
| All-gaps input | No longer refused — resolving gaps is now the point of clicking |
| Empty input | Still refused |

## Why the "no rewrite" rule gets stronger, not weaker

Previously the boundary was enforced entirely by prompt instruction — a rule the model could, in
principle, ignore. Under this design the **main line is never AI output**. It's assembled by the
app, word by word, from George's own tokens and each resolved word's stored pronunciation — the
exact mechanism that already drives the Hebrew line today, just reused for transliteration. The
AI's only surface area is the unknown-word lookup (unchanged from today) and a short prose
`notes` field, which carries the same hard rules as before: no rewritten sentence, every Hebrew
word glossed with pronunciation, no jargon, under 90 words. Testing must still confirm the model
holds to that, exactly as required in the explainer spec — the guardrail moved from "the only
thing standing between us and a rewrite" to "a backstop on a field that's already structurally
safe."

## Architecture

### The merged prompt

Sent whenever the button is clicked, unless the pad is empty:

- Beginner framing, unchanged from the explainer spec (male, casual family register, learning to
  *speak*, can't yet read the script fluently).
- **What he typed:** the raw textarea value, verbatim — this is the change. Previously gaps were
  either isolated out (Ask) or excluded (Explain).
- **Uncertainty notes:** from the existing `padUncertainty()` — words matched by sound or picked
  from an ambiguous set — unchanged from the explainer spec.
- Requests **one JSON object**:
  ```
  {"words": [{"hebrew": "...", "translit": "...", "english": "...", "category": "..."}],
   "notes": "..."}
  ```
  `words` — one entry per word with no Hebrew, in the order they appear. Same shape as today's
  Ask response, so it plugs into the existing `padIngest()` unchanged.
  `notes` — two or three sentences on anything that reads oddly across the **whole** sentence,
  now free to reference the words it just identified. Same hard rules as the explainer spec:
  no rewritten sentence, every Hebrew word mentioned carries its pronunciation, no jargon, under
  90 words.

### Handling the reply

1. `padIngest({words: ...})` — **unchanged**. Flags new words to Pending, learns the spelling
   George used as an alias, exactly as it does today.
2. `rebuildTrIndex()`, then re-tokenise the sentence — the words just aliased now resolve.
3. **Build the main line** — new, mechanical, no AI:
   ```
   for each token:
     if marked known (hvr_known)      -> show the typed word as-is
     if resolved to a Hebrew word     -> look up its pronunciation, in order:
                                          DICT[heb][0]  (built-in dictionary)
                                          -> lib[heb].tr        (already in the library)
                                          -> pendingAll()[heb].tr  (just flagged, not yet approved)
                                          -> take the text before "/" if the result is a
                                             slash pair (e.g. "rotze/rotza" -> "rotze") —
                                             masculine first, consistent with the existing
                                             "he is male" convention in these prompts
     if still unresolved (a real gap) -> show the typed word as-is (nothing better exists)
   ```
   The three-tier fallback matters: a word the AI *just* identified sits in Pending, not the
   library, until George approves it — the line has to read correctly before that approval, or
   the whole point of "resolve and read immediately" is lost.
4. Display the main line prominently in `#padExplain`, replacing the old English mirror. The
   `notes` text renders below it, in the existing quieter style.

### Read Aloud

Rebuilt to call the same main-line builder rather than reading `#padInput` directly. This works
**independent of whether Explain was ever clicked** — if every word is already resolved (from
earlier aliases or approved library entries), Read Aloud is correct with no network call. If gaps
remain, it shows what's typed for those words (nothing better exists) and displays a small
warning above the line — *"N words below don't have Hebrew yet"* — rather than silently reading
English into what's meant to be a Hebrew reply. This is the concrete fix for the bug this design
surfaced.

### Staleness

Unchanged mechanism from the explainer spec: any edit to the pad clears the current notes. The
main line itself isn't "stale" in the same sense — it's rebuilt live from current pad state on
every render, same as the Hebrew line always has been.

### The removed button

"Ask about N words" is removed. Its job — flag unknown words to Pending — is now always part of
what the remaining button does. The button's label stays **Explain this**, since resolving
unknown words is now a means to the actual end, not a separate action.

## Error handling

- **Empty pad** — refused, as today.
- **All words are gaps** — **no longer refused.** This is the behaviour change: resolving them
  is now exactly what the click is for.
- **No Gemini key / network failure** — falls back to the existing copy-prompt / paste-result
  path, unchanged in mechanism. The pasted reply is expected to be the same merged JSON shape.
- **Malformed reply** (missing `words` or `notes`) — treat a missing key as empty rather than
  throwing: no words to ingest, or no notes to show, but never a hard failure that blocks the
  pad.

## Testing

1. **Live-API check that the no-rewrite rule still holds**, now with gap words in the sentence —
   the `notes` field must never contain a full alternate Hebrew sentence, across several
   deliberately-imperfect test sentences that include unresolved words.
2. Unknown words from the merged reply still land in Pending and still learn aliases — regression
   against the existing `padIngest()` behaviour, unchanged code path.
3. The main line reflects George's own word order and any ambiguous-word choice currently
   selected — never reordered, never substituted for "what a native would say."
4. Transliteration fallback order: a freshly-flagged Pending word's line uses the AI's `translit`
   immediately, before any approval.
5. A slash-paired transliteration renders as its masculine (first) segment.
6. Read Aloud reflects resolved words with **no Explain click and no network call**, when those
   words were already known from an earlier session.
7. Read Aloud shows the gap warning when unresolved words remain, and reads the typed word for
   those slots rather than failing.
8. All-gap input no longer refused; empty input still refused.
9. Regression: Library grid, Keep, drafts, drag-recategorise, drag-to-pair, export, and grid
   geometry all unaffected.

## Out of scope

- Everything already ruled out in the explainer spec still applies: no scoring, no streaks, no
  mistake log, no automatic firing while typing.
- The main line is not editable — it's derived, same reasoning as the Hebrew line always having
  been derived rather than typed.

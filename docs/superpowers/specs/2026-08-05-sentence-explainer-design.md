# Sentence Explainer — Design

**Date:** 2026-08-05
**Status:** Approved, building
**Extends:** `2026-08-05-sentence-pad-design.md`

## Why

The sentence pad is a **one-way mirror**. It confidently assembles Hebrew, and George has no way
to see back through it — he can't read the script fluently enough to audit what it produced.
It can be wrong in at least four ways he cannot currently detect:

1. **Ambiguous pick.** `shly` resolves to שלי *(my)*, but שלו *(his)* and שלה *(hers)* are the
   next candidates. He raised this himself: *"im not sure how it translated that."*
2. **Sound match landing near-but-wrong.** The skeleton matcher is deliberately loose.
3. **Gender agreement.** אוהב vs אוהבת, רוצה vs רוצה — forms he may pick by accident.
4. **Word order.** The pad renders in the order typed and never reorders; Hebrew does not always
   follow English.

He then reads that unaudited sentence aloud into a voice note. The explainer closes the hole.

**This reverses a decision** in the sentence-pad spec, which ruled out grammar checking on the
grounds that a wrong correction teaches worse than none. That reasoning still stands — and this
is not correction. It is **back-translation**: show him what his Hebrew literally says, and let
him find the mismatch against what he meant. He does the noticing, which is the part that
teaches.

## Decisions

| Question | Decision |
|---|---|
| How far it goes | Describe what he wrote, and explain *why* something reads oddly. **Never supply the rewrite.** |
| Trigger | An **Explain this** button. Never automatic. |
| Reading level | Pitched at a beginner and scaffolding upward — see Pedagogy below |
| Placement | A third line under the Hebrew, empty until asked |
| What's analysed | The assembled Hebrew, **plus the pad's own uncertainty data** |
| Staleness | Explanation clears the moment the sentence is edited |
| Scoring / streaks / mistake log | Out of scope. He asked to understand, not to be marked. |

## Pedagogy — binding constraints on the prompt

George is a beginner whose goal is **speaking**. The explanation is worthless if it's pitched
over his head, so these are requirements, not style preferences:

- **Every Hebrew word mentioned carries its pronunciation.** `למשוך (limshoch)`, never bare
  `למשוך`. He cannot yet read the script at speed; bare Hebrew in an explanation is a dead end.
- **No linguistic jargon.** Not "pa'al present participle", not "construct state", not
  "segolate". If a concept genuinely needs a name, introduce it in plain words first.
- **Two or three sentences, not a lecture.** One idea at a time; scaffolding, not a grammar
  reference.
- **Concentrate on the words carrying risk.** Notes on what the pad guessed at or what he's
  likely to have got wrong — not on the words he's already confident about.
- **Explain in terms of what he already knows**, building outward from it.

## Architecture

### Trigger and placement

An **Explain this** button beside Ask / Read aloud / Keep. Output renders into a third block
below the Hebrew line, hidden until there is something to show.

### Payload — the part that justifies building this in-app

The prompt carries more than the sentence. The pad **knows things a generic AI chat cannot**:
which words were matched by sound rather than exact spelling, and which words had alternatives
it silently chose between. That uncertainty ships with the request:

> he typed `shly`; the app matched it to שלי (sheli) by sound, but it could also have been
> שלו (shelo) or שלה (shela)

This turns a generic explanation into one about **his specific risk points**, and is the whole
reason the feature belongs in the app rather than in a browser tab.

Sent: the transliteration he typed, the Hebrew assembled from it, and the per-word uncertainty
list. Not sent: his library, his history, or anything else.

### Response shape

1. **The mirror** — one line, literal English of what the Hebrew actually says.
2. **Notes** — two or three sentences on the risky words and any oddness, each explaining *why*.

The prompt must **actively suppress the model's instinct to correct**. Models default to being
helpful and will volunteer a fixed sentence unless firmly and repeatedly told not to. This is
the single most likely thing to go wrong, and must be verified against the live API rather than
assumed.

### Staleness

The explanation is stored with the exact text it described. Any edit to the pad clears it
immediately. An explanation describing a sentence no longer on screen is worse than none,
because it would be trusted.

### Gaps

If the sentence still contains unresolved gaps, the explainer says so and analyses only the
Hebrew that actually exists, rather than quietly explaining a sentence with holes in it.

### Paths and failure

One click when a Gemini key is present; otherwise it copies the prompt for the same
paste round-trip the word lookup already uses. Any failure — no key, no network, bad JSON —
falls back to copy-paste with a plain message. The pad must never be blocked by this feature.

### Persistence

The current explanation lives in memory only (it dies with the sentence anyway). An explanation
is saved **alongside a Kept draft**, so a sentence revisited later still carries what was learned
about it.

## Error handling

- **Empty pad** — button does nothing, with a status line saying so.
- **Sentence is all gaps** — refuses and says there's no Hebrew to explain yet.
- **Network / key failure** — status explains, prompt goes to the clipboard, paste box offered.
- **Malformed reply** — the response is prose, not JSON, so there is no parse step to fail; a
  non-empty reply is displayed as-is. An empty reply reports that nothing came back.

## Testing

1. The prompt contains the uncertainty data (typed spelling, chosen Hebrew, alternatives).
2. **Against the live API:** the reply describes and explains, and does **not** contain a
   rewritten Hebrew sentence. This is the load-bearing test.
3. Every Hebrew word in the reply is accompanied by a pronunciation.
4. Editing the sentence clears a previous explanation.
5. A sentence with gaps produces the gaps warning.
6. No key / dead network falls back to copy-paste without breaking the pad.
7. Regression: Library grid, Ask, Read aloud, Keep, export, and grid geometry all unaffected.

## Out of scope

- **Rewriting the sentence for him.** The explicit boundary of the feature.
- **Scoring, streaks, or a mistake log.**
- **Automatic analysis while typing** — comments on half-formed sentences and burns quota on
  drafts about to change.
- **Offline explanation.** Impossible without a model; the copy-paste path is the offline story.

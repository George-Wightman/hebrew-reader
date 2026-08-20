# Learn Page, Phase 1: Scaffolding While You're On A Card

**Date:** 2026-08-11
**Status:** Approved, building
**Part of:** the four-phase Learn overhaul (scaffolding → speaking → tracking → exercises)

## Why

George is committing seriously to Hebrew and the Learn page isn't carrying its weight. Three
complaints, all the same complaint underneath: **when you don't know the answer, the page has
nothing to offer you except the answer.**

1. Tapping a word gives you no way to find out what it means or why it takes that form.
2. There is no middle ground between "say it perfectly" and "reveal it" — no hint, no partial credit.
3. On audio-first cards the prompt is spoken once and then gone, so a long sentence has to be held
   entirely in your head while you think. George: *"I cant remember all that."*

This phase adds support **without** removing difficulty. Retrieval only builds memory when it's
effortful, so nothing here makes the answer easier to reach — it makes being stuck productive
instead of a dead end.

## Decisions

| Question | Decision |
|---|---|
| Where word explanations come from | The bank item itself, generated in the call that already exists — **zero extra API requests** |
| Tap behaviour on a word chip | Opens a panel: meaning, why, **and** the grade buttons — replaces the 3-state tap cycle |
| Cost of a hint | Caps that card's best grade at "Nearly" — visible, never silent |
| Notes box | Freeform, audio-first cards only, kept on reveal, never persisted |
| Old banked sentences | Backfilled on demand, one call, cached forever — never automatically |

## 1. Word explanations for free

The expensive-looking part is the cheap part. `learnTokens()` (`hebrew-reader.html:5336`) already
pairs each Hebrew word with its transliteration and its library entry, so **meaning is already
available locally, offline, for every word George owns.** The genuine gap is grammar: why *ktzat*
and not *katan*, why that prefix, why that verb form.

That gap closes for nothing. `learnTopUp()` already spends **one** API request to generate ~12 bank
items which are then stored and reused permanently. Adding a per-word gloss to that same call's JSON
costs **zero additional requests** — the free-tier limit is requests per day, not tokens. Every
sentence generated from now on carries its own explanations, forever, offline.

New field on each generated item:

```json
{"type":"sentence","he":"","tr":"","en":"",
 "gloss":[{"he":"קצת","tr":"ktzat","en":"a bit","why":"Adverb — doesn't agree with the noun, unlike an adjective."}]}
```

`why` is written **only where there is genuinely something to say** (verb form, attached prefix,
gender agreement, word order). Filling it for every word would bury the interesting cases in noise,
so the prompt says to leave it empty otherwise.

**Alignment is by Hebrew string, never by index.** An index-aligned gloss array that comes back one
element short would silently attach every explanation to the wrong word — the same failure
`learnTokens` already guards against by refusing to build chips when the Hebrew and transliteration
word counts disagree. Lookup is a map keyed on the bare Hebrew word; a miss falls through the chain
below rather than guessing.

**Resolution order for a tapped word:**

1. `item.gloss` entry matching that Hebrew word
2. His library entry (`lib[key]` → `tr`, `en`)
3. The built-in `DICT`
4. An "Explain this word" button — one API call, written back onto the bank item, never asked twice

Steps 1–3 are instant, free and work offline, and will cover the overwhelming majority of taps.
Step 4 exists for old banked sentences (generated before this change) and genuinely unknown words.

## 2. Tapping a word

Word chips currently cycle through three grading states on tap — one tap "missed", two "nearly".
That mechanic is being **replaced**, not extended, for two reasons: George's request is that tapping
a word explains it, and a hidden 3-state cycle you have to remember is a worse grading control than
explicit buttons.

Tapping a chip opens one shared panel below the row (replacing its contents, never stacking — the
same discipline the sentence pad's tiles already use):

- The Hebrew word, large, RTL
- Transliteration and English
- The `why` note, when there is one
- **Got it / Nearly / Missed** for that word
- "Explain this word" only when nothing was found locally and a key is configured

Picking a grade closes the panel and paints the chip. Untapped words still count as "Got it", so a
clean sentence remains a single keypress — the property that made per-word grading worth having in
the first place. The cost is one extra tap on a word you got wrong, and it buys the explanation
that made you tap it.

The panel changes card height, so `syncPadOffset()` is called on every open and close.

## 3. Progressive hints

A **Hint** button sits next to "Show me" before the reveal. Each press gives strictly less than the
full answer, and what it gives depends on what the card is asking for:

| Card | Hint 1 | Hint 2 |
|---|---|---|
| Say the word | First letter of the Hebrew | — (next step is the reveal) |
| Build the sentence | First letter of each Hebrew word, in order | Full transliteration |
| Hear and answer | Replays slower | Full transliteration |
| Reply to grandad | Transliteration of the question | Words from your library that fit |

**A hint caps that card at "Nearly."** A hinted answer is not the same as a recalled one, and letting
it record as "Got it" would stretch that word's interval on evidence that doesn't exist — the exact
way an SRS schedule quietly rots. The cap is stated on screen when the hint is taken, never applied
silently. This is a deliberate desirable difficulty: help is always available, and always honest
about what it cost.

On a card with word chips the cap applies **per word at commit time**: any word that would have
committed as "Got it" commits as "Nearly" instead, while words explicitly marked "Missed" still
commit as missed. A hint never makes a grade better than it would have been — only worse or equal.

## 4. The notes box

On **Hear and answer** and **Reply to grandad** only — the two card types that speak the prompt once
and show no text. The other two keep their English prompt on screen throughout, so there is nothing
to forget.

A single freeform textarea between the audio controls and "Show me". One box, not two: splitting
"what I heard" from "what I think it means" adds a decision and a click at exactly the moment
working memory is already full.

- **Does not autofocus.** The drill is still "say it out loud first"; grabbing the keyboard would
  turn a speaking exercise into a typing one.
- **Survives the reveal**, becoming read-only and sitting directly above the revealed Hebrew — so
  comparing your guess to the real answer is just look up, look down. Frozen because its value is
  being an honest record of what you thought *before* you knew.
- **Never saved.** Moving to the next card rebuilds the whole card and the note goes with it.
  Nothing is graded, compared or stored — George: *"it doesnt neciserily need to be marked."*

The existing keyboard handler already ignores its shortcuts whenever a textarea has focus
(`hebrew-reader.html:5858`), so Space/R/1-2-3 need no change.

## 5. Failure modes

| Condition | Behaviour |
|---|---|
| Bank item has no `gloss` (every item generated before today) | Falls through to library → DICT → the on-demand button; nothing breaks |
| `gloss` present but a word isn't in it | That one word falls through the same chain |
| `gloss` malformed or not an array | Ignored entirely, treated as absent |
| No Gemini key | Steps 1–3 still work; the "Explain this word" button is not shown |
| On-demand explain fails | Button re-enables with the reason; the panel keeps showing meaning |
| Hint pressed on a card with no transliteration | That hint step is skipped rather than shown blank |
| Card has no chips (`learnTokens` returned null) | Whole-card grade buttons as today, no tap-to-explain |

## 6. Testing

1. A generated item's `gloss` renders in the panel: Hebrew, translit, English, `why`.
2. Gloss lookup matches by Hebrew string — a gloss array in a different order still maps correctly,
   and a short array attaches nothing to the wrong word.
3. An item with no `gloss` resolves from the library, and from `DICT` for a non-library word.
4. The on-demand explain button appears only when 1–3 all miss **and** a key exists; its result is
   written to the bank and a second tap makes no network call.
5. Tapping a chip opens the panel; tapping another replaces rather than stacks; grading closes it.
6. Untapped words still commit as "Got it"; a graded word commits its grade.
7. Each hint level shows the right content per card kind, and taking one caps the committed grade at
   1 even if "Got it" is pressed — on chip cards, per word, while explicit "Missed" marks survive.
8. The hint cap is stated on screen at the moment the hint is taken.
9. The notes box appears on listen/reply only, doesn't autofocus, goes read-only on reveal, and is
   empty on the next card.
10. Space/R/1-2-3 do nothing while the notes box has focus, and work normally when it doesn't.
11. `syncPadOffset()` runs on panel open/close so nothing hides under the docked pad.
12. Regression: full session of every card kind, translator, library grid, archive, drafts,
    export/import.

## Out of scope

- Anything involving the microphone — that is Phase 2, and it will revisit grading
- Time tracking, streaks, history, the progress screen — Phase 3
- New card types, chunks, session shaping — Phase 4
- Changing `learnTargets` or the FSRS scheduler's maths
- Backfilling glosses for the existing bank in bulk (on demand only, to protect the daily quota)

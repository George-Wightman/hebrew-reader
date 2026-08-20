# Learn Page: Difficulty You Can Actually Reach

**Date:** 2026-08-11
**Status:** Approved, building

## Why

George, after the first real run: *"they are using words that only appeared in hte messages from my
gfs grandad so its not somehting i have practice with... Some sentences like the SS are wayy too
hard for my level, like seriously hard... i honestly have no chance of being able to do the
sentences that come up."*

The example was `אשמח לשמוע אותך` — a future-tense verb, an infinitive, and an inflected preposition,
built from three words he had never met. That is not a tuning problem. It's two decisions of mine
compounding into something unusable.

**1. Never-drilled words are served newest-first.** `learnTargets` sorts fresh words by `added`
descending, with the comment *"Strengthen the words we just added"*. That was right when the library
grew slowly from words he was studying. It is exactly wrong now: **the newest words are the ones
that just arrived from grandad's voice notes**, so the queue systematically hands him the least
familiar vocabulary he owns.

**2. Practice sentences are generated from those same words.** `learnTopUp` sends the target list as
"WORDS HE IS WORKING ON RIGHT NOW" and asks for sentences using them. So the sentences aren't merely
*containing* unfamiliar words — they're **composed entirely of his least familiar words**, with no
check anywhere that he knows any of them.

George's own diagnosis is the one the code is missing:

> *"them beign in the library odes not mean I undertand them or haeve ever used them"*

The library is a record of **what grandad said**, not of **what George knows**. The app has been
treating those as the same thing.

## What we already have and never used

| Signal | Where | What it tells us |
|---|---|---|
| `src: "seed"` | library | **The 77 words imported from his own Hebrew Table.xlsx** — the ones he actually sat down and studied. His words, not grandad's |
| `arch[k].seen` | archive | How many times a word has genuinely appeared in real messages |
| `arch[k].first` / `.last` | archive | First and last real-world exposure |
| `lib[k].added` | library | When it entered the library |
| `srs[k].prod` | scheduler | Whether he can actually produce it |

The Learn page reads only the last of these. George confirmed the seed words are the right anchor:
*"they were the first words in the library... These are my strongest words (not all that strong) so
using these in sentences (with grammer and filler words) we can then build up more complex sentences
incorporating new words (after training)."*

**Deliberately not importing the spreadsheet** — he asked me not to, and he's right: the app already
seeded from it, so the marker exists. Importing again would duplicate what's there.

## Decisions

| Question | Decision |
|---|---|
| Order of never-drilled words | **Most familiar first** — reverses today's newest-first |
| Sentences | **Gated, then graded** (George's choice) |
| Gate | Every *content* word must be **ready**; grammar and filler words are exempt |
| "Ready" | Production strength `progressing` or `strong` — the existing model, no new scoring |
| Grade | Among servable sentences, always serve the easiest available |
| Generation | Build only from **ready** words, and state his level explicitly in the prompt |
| Existing bank | Cleared again — every sentence in it was generated from the wrong word set |

## 1. Familiarity, and the new ordering

`wordFamiliarity(k)` returns a sortable score, highest = most familiar:

- **Seed words** (`src === "seed"`) get a large constant bonus. These are his own study list
- **Real exposure**: `arch[k].seen`, capped so one heavily-repeated word can't dominate
- **Age**: days since `added` (or `arch.first` if older), so long-held words outrank new arrivals
- **Drill history**: successful reps raise it, misses lower it

Fresh words are then sorted by this **descending**, replacing the `added`-descending sort. The
practical effect: his 77 Excel words lead the queue, then words grandad has used repeatedly over
weeks, then last night's arrivals last — rather than first.

## 2. The gate

`wordReady(k)`: production strength is `progressing` or `strong`. A word he has never drilled, or
keeps missing, is not ready — regardless of how long it has sat in the library.

A bank item is **servable** only if every one of its content words is ready. **Grammar and filler
words are exempt**, using the existing `STOPLIST` (את, של, אני…), because George explicitly wants
sentences built from *"these... (with grammer and filler words)"*. Without that exemption almost
nothing would ever pass.

**The consequence is intended and should be stated plainly: for the first few sessions there will be
no sentences at all.** Nothing is ready yet, so the session is word cards and phrases. Sentences
appear as words graduate. That is what "build up to it" means, and hiding it would just make the app
look broken.

## 3. The grade

Among servable items, sort by difficulty ascending:

1. Fewer content words first
2. Then by the *weakest* word in the sentence — a sentence is as hard as its hardest word
3. Then least-recently-seen, to keep variety

So the first sentence he ever sees is the shortest one made of the words he knows best.

## 4. Generation

Two changes to `learnTopUp`'s prompt, both aimed at the same failure:

- **Build from ready words, not target words.** The list sent as the vocabulary to use becomes the
  *ready* set. New words enter sentences only after they've been drilled into readiness — which is
  the whole progression George asked for.
- **State the level.** The current prompt says "short everyday sentences" and nothing about
  grammatical complexity. It will now specify: present tense, 3–6 words, no inflected prepositions,
  no future or subjunctive, one clause. Explicitly: *assume he is a near-beginner.*

If fewer than 8 words are ready, generation is **skipped entirely** rather than producing sentences
from a pool too thin to be natural — the session runs on words and phrases, and says so.

## 5. Showing him where he is

The start screen gains one honest line: how many words are ready for sentences, and how many are
still to train. The progression stops being mysterious — he can see the gate moving.

## 6. Failure modes

| Condition | Behaviour |
|---|---|
| Nothing ready yet (fresh start) | Word and phrase cards only; start screen says sentences unlock as words are trained |
| Ready set large but bank empty | Generates on the next session; runs on words meanwhile |
| Every banked sentence gated out | Those items stay banked, unserved, and become servable later — never deleted |
| A ready word later decays to weak | Sentences containing it stop being served until it recovers |
| Archive missing for a word | Familiarity falls back to library `added` alone; never throws |
| Library has no seed words (someone cleared it) | Ordering still works, just without the seed bonus |

## 7. Testing

1. `wordFamiliarity` ranks seed > high-exposure > old > new, and is stable with missing archive data.
2. `learnTargets` returns fresh words most-familiar-first — the reverse of today.
3. `wordReady` is false for new and weak words, true for progressing and strong.
4. Gating: a sentence with one unready content word is not servable; the same sentence with only
   unready *stoplist* words is servable.
5. Grading: among servable items the shortest/easiest comes first.
6. With nothing ready, a session contains no sentence or shadow cards and still fills to size.
7. As words become ready, sentences start appearing.
8. Generation is skipped below 8 ready words, and uses the ready set above it.
9. The start screen states the ready count.
10. Regression: all six card kinds, mic, hints, stats, shapes.

## Out of scope

- Re-importing the spreadsheet — already seeded, and George asked me not to
- Any change to the FSRS maths
- Judging grammatical difficulty automatically beyond word-readiness and length
- A manual "I already know this word" control — readiness should be earned, not asserted

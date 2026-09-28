# Common words first, and a scene before each place

**Date:** 2026-09-28
**Scope:** a new `FREQ_RANK` table and `FREQ_DICT` glosses; `wordFamiliarity`,
`learnTargets`, a frequency intake, `campStretchPool`, `campEvidence` and the chapter
prompts; a "common words you can say" figure; `learnBuild` / `learnTopUp` /
`sentenceCommission` for introducing new words inside sentences; a listening scene on
every map node; `breadthBrief` and the `generate-node-content` skill.

## Where this came from

He watched a video arguing that the best way to learn a language is frequency lists plus
comprehensible input, and asked whether the app does it:

> is that something we've thought about, something we've included? Uh, do a, kind of a
> deep research on these things … How can we incorporate that into the app? Is it good
> practice?

The research is `reports/Frequency lists and comprehensible input.md` (notes in
`research_notes/`). Having read its summary he approved six changes, with one condition
that reaches past them:

> Build one, then yeah, two and three sound good, but I've got to add the caveat. The
> whole granddad voice note thing, that's kind of out the window. … The app is my Hebrew
> learning tool. The voice note feature is like an add-on. … I haven't used in months. So
> the whole granddad voice note thing should not be a core feature.

> The figure about, you can say, 412 of the 1,000 … is cool. … The introducing the common
> words in sentences, absolutely. I like the idea of a short story or dialogue to listen
> to at the start of each node to kind of set the context right. Um, that would need to be
> done... sensitively … if it's relying on the, the voice on my phone uh, that might be a
> bit weird

Three decisions, asked before he went to bed:

- **Voice notes stop steering; the reader stays.** Grandad's usage no longer decides word
  order, the chapter planner's brief, or the framing of any writing prompt. The reader
  itself keeps working as a side feature.
- **Scenes are spoken by the phone's own voice**, with each speaker given a different
  pitch and pace and the text showing who is talking. Short, mostly two people.
- **Built and tested overnight, not published.** Everything is committed locally; nothing
  is pushed until he has read the summary.

## What the research document got right, and what it missed

Checked against the code before building on it.

**Right.** There is no frequency ranking anywhere (a search for `freq|corpus|zipf` finds
comments only). The "every word known but one" gate is real and is exactly the online
i+1 rule: `bankServable` admits one not-ready word, from the session's `carry` set, only
when everything else is `strong`. New words are ordered by `wordFamiliarity`, which reads
source, Duolingo unit, **grandad's `seen` count** and drill history. No "% known" figure
exists; `cardTier` colours reader cards one at a time.

**Understated.** Grandad is wired in more deeply than word order. The phrase "He replies
to WhatsApp voice notes from his partner's grandad" frames five separate writing prompts
(breadth writer, planner, writer, survey, chapter plan), and `listen` items are defined as
"something grandad says to him". The chapter survey is told that grandad's unsaid words
are "the single most important thing in this record". Removing voice notes as a core
idea means rewriting those framings, not only deleting one term.

**Missed.** The daily `carry` set is his three weakest words, and bank sentences are
written for words that are already ready — so no sentence in the bank carries a word he
has never met. Pointing `carry` at new words does nothing by itself; the writer has to be
commissioned for them first. That is Phase 4's real work.

## Phase 1 — the ranking

The source is Pinto's *Frequency Dictionary of Spoken Hebrew* (FDOSH: the top 5,000
lemmas of OpenSubtitles 2018, MIT licence). Its lemmas are the analyser's citation forms
— verbs as past third-person (`ידע`, `הלך`) — while the app keys verbs by present tense
or infinitive, so nothing lines up without a mapping.

Built offline, once:

1. **Automatic match** of each lemma to the app's own dictionary keys (`DICT` ∪
   `DUO_DICT`, 2,630 keys): the lemma itself, then its likely present and infinitive
   forms from the pa'al / pi'el / hif'il / hitpa'el / nif'al templates.
2. **Hand review of ranks 1–1,250**, line by line. Dropped: the glued single letters,
   `כול`, pronouns and every `STOPLIST` word (the app already treats them as known);
   subtitle-drama words (אלוהים, עזאזל, הרג, רצח, מוות, אקדח); English names; analyser
   debris (`והיי`, `תרא`, `העליי`); and homographs where the app's key means something
   else (שום = garlic in the app, but "any/no" in the list; קשר = midfielder; מר =
   bitter). Fixed: FDOSH's known faults — `סדר` restored to `בסדר`, `הכיל` to `הכל`.
   Added: **137 common words the app had no gloss for** (חייב, חיים, מצטער, כדאי,
   אכפת, מושג, בחייך, נמאס, הלוואי…), glossed by hand in the house transliteration.
   After probing his real library, four more were dropped for the same reason: אל is
   "don't" in speech (the app glosses it "to, into"), אף is "nobody/never", האם is
   subtitle-formal, and נמצא is "is located", not the app's "to be found".
3. **Automatic matches only for ranks 1,251–3,000**, minus the bad ones caught on a
   scan. No new glosses past 1,250.
4. **Inflected finite forms dropped** (`חשבתי`, `אעשה`, `עשית`): the app should teach
   the word, not one conjugation of it.
5. **One lemma, many keys.** `ידע` covers יודע and לדעת; each key gets the lemma's rank,
   and a key claimed by an earlier lemma is not re-ranked by a later one.

Result: **1,245 ranked lemmas**. The 1,000th reaches FDOSH rank 1,845. Stored as
`FREQ_LIST` — a compact string, one lemma per space, its keys joined by `|` — from which
`FREQ_RANK = {key: rank}` and `FREQ_LEMMAS` are built at load. `FREQ_DICT` holds the 137
new glosses and merges into `DICT` beside `DUO_DICT`, never overwriting. The builder and
its review files live in `tools/freq/` so the list can be rebuilt or corrected.

Prefixed words were added with care. A key like `מחדש` or `מעט` is matched before
`libKeyFor` tries peeling a prefix, so it *changes* how existing sentences resolve (מעט
was resolving to עט, "pen"). The build flags every such overlap; each was checked, and
the lexicalised ones that would steal an ordinary word (`הערב`, `הפעם`, `במקום`,
`לעולם`, `החוצה`, `המשך`, `הרגל`) were dropped instead.

## Phase 2 — the ranking chooses the next new word; grandad stops choosing

- **`wordFamiliarity` loses the grandad term.** `min(20, seen) × 8` was the only place
  voice notes steered ordering. It goes. (The function still takes `arch` for the age
  term's first-sighting date, which is harmless.)
- **Frequency orders new words, not reviews.** A separate `wordFreqBonus(k)` — 160 at
  rank 1, falling linearly to 0 past rank 1,600 — is added only in `learnTargets`'s
  never-drilled sort. `practiceNeeds`, which orders due words, does not read it: due-ness
  keeps deciding reviews, as the research recommends.
- **Frequency intake.** `libAddFreqIfNeeded` adds the highest-ranked words he has no
  form of (`src: "freq"`, `freq: rank`, `shelf: "reserve"`, no SRS record) until at least
  `FREQ_INTAKE_FLOOR` (6) never-drilled words **commoner than the next missing one** are
  waiting. The first version counted any six waiting words; run against his real library
  it added nothing, because 47 ranked words already sat undrilled — so נכון, כמו, חייב
  and חיים, all top fifty and none of them in his library at all, would have waited
  weeks behind rarer ones. The form added is the present tense where the dictionary has
  one, else the infinitive — never the past (the first draft picked היה, "was", for the
  commonest verb in the language).
- **Stretch words by frequency.** `campStretchPool` still takes units past his Duolingo
  unit, but orders them by rank before unit, so the two stretch words a node borrows are
  the commonest ones ahead of him.
- **The chapter planner is briefed with common words, not grandad's.** `campEvidence`
  replaces "WORDS HIS GRANDAD ACTUALLY USES THAT HE STILL CANNOT SAY" with "COMMON HEBREW
  WORDS HE CANNOT SAY YET" — the 24 highest-ranked words not ready — and the survey and
  plan prompts are told to prefer them.
- **A voice note no longer grows a node on the map** (`CAMP_SPAWN_FROM_NOTES = false`),
  and the app's name drops "Voice Note" (title, manifest, README).
- **Every writing prompt loses the WhatsApp framing.** One constant, `LEARNER_CONTEXT`,
  replaces the five copies: everyday spoken Hebrew for real life with his partner's
  family and friends. `listen` becomes "something someone says to him".

## Phase 3 — "you can say N of the 1,000 most common words"

`freqCoverage(lib, srs, n)` counts the first *n* ranked lemmas where any of the lemma's
keys is in his library and `wordReady` — the same "ready" that gates sentences, so the
figure moves exactly when a word becomes usable. Grammar words are outside the list, so
the figure is honest about content words and says so in its tooltip.

Shown twice: a chip on the Practice start card ("312 of the top 1,000") and a tile in
Progress. No bar, no gate — the research is clear that comprehension rises in a straight
line with coverage, so a threshold would claim a cliff that does not exist.

## Phase 4 — new common words arrive inside sentences

The day's soft-launched words (the first `NEW_WORD_CARDS` never-drilled targets, which
are now the commonest) join the daily `carry` set, so a sentence carrying one of them —
with every other word strong — is servable in the same session as its word card. After
the shuffle, a launched word's card is moved ahead of any sentence carrying it: meet it,
then use it.

The bank has no such sentences, so `learnTopUp` gains an introduce pass. `introWords`
names the next `INTRO_AHEAD` (3) words the session will launch; any with fewer than
`INTRO_MIN_EACH` (2) unseen carrying sentences is commissioned through the existing
`sentenceCommission` with a new `intro` list — its own prompt section ("new to him —
the sentence must make the word's meaning guessable from the words around it"), counted
by `commissionAcceptable` against the same one-carried-word budget as rescue. Rescue and
introduce share one commission when both are starved, so this adds no calls on a day
rescue already runs.

## Phase 5 — a scene before each place

Each map node gets a short listening scene: 4–6 lines, one or two speakers, set in the
node's situation, written so almost every word is one he can already say or is one of
the node's own. Shown at the top of the node sheet — the moment he is deciding what to
open — as Hebrew lines with the speaker named, a play button that reads the whole scene,
tap-a-line to hear one, and a Show English toggle. Not graded: it sets the context, it is
not a test.

- **Voices.** `speakHeAs(text, voice)` is `speakHe` with pitch and rate set per
  speaker: the first speaker at the natural pitch, the second lower and a touch slower.
  The Pixel voice honours pitch; where a browser ignores it, the speaker name on each line
  still says who is talking.
- **Generation.** `campSceneEnsure(node)` runs alongside `campWarm` when the sheet opens,
  once per node, one `GEMINI_MODELS` (Flash-first) call — the node has only one scene, so
  the stronger writer is worth its pool. It shares an in-flight promise, per the
  per-minute rule. A daily claim of `SCENE_RUNS_PER_DAY` (4) caps it.
- **The gate, in code.** `sceneAcceptable(scene, node, lib, srs)`: every Hebrew token
  resolves (`libKeyFor`, then `bankStripPrefixes`) or is declared in the scene's gloss;
  at most `SCENE_NEW_MAX` (3) declared new words in the whole scene; and at least 85% of
  content tokens are ready or node words. Failing scenes are not stored.
- **Review.** The lines go through `learnReviewItems` as listen items; if the reviewer
  drops any line, the scene is discarded and tried again next open.
- Stored on the node (`node.scene`), so it syncs with the campaign.

## Phase 6 — frequency weights what gets written

- `breadthBrief`'s `write` list is due words with no sentence; they are now ordered by
  rank before being cut to eight, so the writer's slots go to common words first.
- The `generate-node-content` skill replaces "everyday words 4–6 sentences, rare nouns
  1–2" (a judgement) with rank bands from `FREQ_RANK`.

## Deferred, with reasons

- **Re-ranking with DictaBERT over raw subtitles.** Would fix FDOSH at the source, but it
  is a large offline job, and the hand review already removes the faults that matter for
  a learner at ~500 words. Revisit if the list visibly misorders.
- **A native-speaker check of the 137 new glosses.** Worth doing; it is his girlfriend's
  call and a spot-check, not a list review (see her memory note). Flagged in the summary.
- **Coverage figure on voice notes.** Proposed in the research; dropped because voice
  notes are no longer a core feature.
- **Testing imported Duolingo words most-common first.** Small and plausible, but it
  touches the unproven budget that was tuned on 2026-09-23; not worth disturbing tonight.
- **Multi-word expressions.** No Hebrew list exists; would be built by hand. Separate job.
- **Removing voice-note cards from sessions.** They only appear when a kept recording
  uses a session word; with no new notes arriving they are already effectively absent,
  and he chose to keep the reader.

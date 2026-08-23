# The campaign: a path that is written as you walk it

**Date:** 2026-08-23
**Scope:** the Learn home screen, and replacing the hand-authored Path with a
generated campaign. Umbrella design; phased for implementation at the end.

## Where this came from

Two sessions of use after the level rework. George:

> "the current path is too rigid and predetermined. THere needs to be a middle
> ground that I cant quite see, a more dynamic path that continuesly develops,
> shows progress in that visual path moving through space ... there could be like
> a 'fog' ... The campaign is where new stuff is learned the quick sessions are
> where we drill and implement everything into session."

And, decisively:

> "I think the current path is a proof of concept, if nothing survives thats fine,
> it walked so the campaign can run."

So nothing is preserved for its own sake. `PATH_SECTIONS` goes.

## What was actually wrong with the Path

Seven faults, and they compound. They are worth writing down because several of
them are easy to rebuild by accident.

**1. Frozen at beginner.** `pathGenerateContent` still hard-codes
`"HIS LEVEL: NEAR-BEGINNER … 3 to 6 words per sentence, one clause"` — the exact
constant deleted from the Learn generator when levels landed. Learn scales; the
campaign cannot.

**2. Grammar was a property of the y-coordinate.** The old contract said so
outright: *"Grammar advances with DEPTH, roughly every three rows … A section's
tense is a property of how far down it sits."* Past tense arrives at row 8 whether
you are ready at row 4 or drowning at row 12. This is the rigidity, and it is
structural rather than cosmetic.

**3. 224 lessons, seven shapes.** Every one of 32 sections ran the same seven
steps in the same order. Worse, lesson 5 already called `learnTargets(4)` — the
campaign was reaching into the Learn scheduler and calling it a different
exercise.

**4. It ignored the one irreplaceable input.** The library grows from real voice
notes. The campaign taught `מיטה` because a human decided row 3 needed furniture.
What a real person actually says to George fed the sentence bank and nothing else.

**5. A dead node walled a branch.** `pathUnlocked` needs every `requires` fully
done, so one section that cannot generate blocks everything behind it.

**6. Nothing behind you was a story.** Completion was
`{section: {lesson: {pct, ts}}}`; a finished node turned green. No trail, no
distance travelled.

**7. It could not grow.** Contract rule 6 was append-only, by hand. 32 sections
and then the campaign ends.

## The design

### 1. A campaign lesson is a Learn session with a narrower target pool

The single change that makes the rest cheap. Same builder, same card kinds, same
level quota, same soft launch, same bank — `learnTargets()` simply draws from the
node's words instead of the whole library.

This deletes `pathLessonCards`, `PATH_LESSON_DEFS`, and most of
`pathGenerateContent`, and removes the second, parallel notion of difficulty. It
is the honest version of what lesson 5 was already doing by hand. Everything that
improves one now improves the other.

Sessions stop being seven fixed steps and become "however many it takes for these
words to stick".

### 2. A node is a situation, and its words are chosen at runtime

Word selection, in priority order:

1. Words from real voice notes (`hvr_archive`) that are not strong yet
2. Library words that are weak or never drilled
3. `DICT` words for the situation, to fill out

**Roughly 70% new, 30% carried forward from nodes already passed.** George
expected later nodes to strengthen earlier ones — that only happens if the carry
is deliberate. And there is a hard reason it must be: `bankServable` requires
every content word of a sentence to be `progressing` already, so a node built
entirely of new words cannot produce a single sentence until they are drilled in
isolation. The carry is what makes a node functional from its first lesson, and
reinforcement is the bonus.

### 3. The generation pipeline

The budget is not the constraint George assumed it might be, but its SHAPE
matters: `AI_POOL_CAPS` is 20 Flash and 500 Flash-Lite per key per day. Flash is
the scarce one. So the pipeline is Lite-first, with Flash spent on the single
hardest reasoning step. A chapter every week or two against 500 Lite calls a day
is enormous headroom.

| | Call | Model | Job |
|---|---|---|---|
| 1 | Survey | Lite | State the evidence: what is strong, what has decayed, what grandad has said lately that George does not know, what earlier chapters covered, the measured level and its direction |
| 2 | Plan | Flash | Turn the brief into 4–6 nodes: theme, target level, candidate words, and one line of *why* |
| 3 | Critique | Lite | Read the plan cold — repetition against earlier chapters, difficulty, whether the words exist, whether it progresses. Returns edits |
| 4–N | Build | Lite | One call per node: sentences, listen lines, replies, glosses, and the graduation conversation, at that node's level |

Survey is separate from Plan on purpose. Handing a model raw storage dumps and
asking for a curriculum in one shot produces a curriculum that ignores half the
input. Making it state the evidence in its own words first, then plan against that
statement, is the same device the drafting prompt already uses when it
self-critiques — and it is what makes the plan actually respond to recent use.

Critique mirrors `learnReviewItems` exactly, including its failure rule: a
reviewer that rejects everything is far more likely to be a malformed reply than a
genuinely broken plan, so an empty response falls back to the unedited plan.

### 4. Nodes carry their reason, and the reason is on the map

The plan call returns one line per node, and it is displayed:

> **At the doctor** — *he's mentioned this three times and has none of the words*
> **What you bought** — *he has the past tense; he's never used it about money*

This is the cheapest thing that makes a generated path feel authored rather than
sampled, and it makes the app legible: you can see why it is asking. A
hand-authored path can never tell you that.

### 5. A campaign log, so the path has an arc

Planning each chapter from current state alone gives a path with no memory —
chapter 9 quietly redoes chapter 2. A few lines per completed chapter (theme, what
it taught, how it went) are stored and fed into the Survey call, so the plan can
reason the way a teacher does: *"past tense has been done with shopping and
travel; time to use it about people."*

Perhaps fifty tokens per chapter of storage, and it is the difference between a
path and a shuffle.

### 6. Chapters, fog, and the trail

Four zones, each with its own rule.

**Behind** — finished chapters collapse into a ribbon: small dots plus the
chapter's theme. Scroll up to see the whole road.

**Current chapter** — 4–6 nodes, fully drawn, one of them live. Each node closes
with its own conversation, which is its graduation; passing it turns the node
gold. George: *"the conversation being a kind of 'graduation' from that node, then
the node turns gold."*

**Next chapter** — real names, real nodes, dimmed and not startable. Seeing what
is coming is most of what makes a path feel like a path.

**Beyond** — silhouettes under fog with a theme hint only. These are placeholders
emitted as a sketch by the Plan call, not decided content. When George reaches
them they are planned properly against fresh evidence, so the sketch can change —
the path visibly shifts because of what he has been doing.

### 7. Opening the next chapter

Chapters are 4–6 nodes. The next opens when

    Math.max(3, Math.floor(n * 0.7))

nodes are gold: 3 of 4 (75%), 3 of 5 (60%), 4 of 6 (67%) — George's "60-75%
depending on size", exactly. Un-walked nodes stay on the map and stay startable;
they are not lost, just behind you.

There is no `requires` wall anywhere. A node that cannot generate costs a node,
never a branch.

### 8. Gold is not permanent

A gold node whose words decay below `progressing` reopens — gold back to teal,
with a marker. This is the SRS made visible, and it is a far better answer to
"revisit" than the old `star: true` duplicate sections.

Crucially the map only REPORTS decay; it does not repair it. Decayed words are
already overdue, so `learnTargets` pulls them into ordinary quick sessions
automatically. That is the clean division George described: **the campaign is
where new things are learned, quick sessions are where decay is repaired**, and
the map is what tells you repair is needed.

### 9. Edges are computed, not authored

The old contract said *"Every edge means 'you need those words for this'"* — but a
human had to notice it and draw it. Every node's word list is known, and so is
which earlier node introduced each word, so the edge falls out for free. The map's
shape then genuinely means vocabulary dependency instead of representing it by
hand.

Layout keeps the old contract's readability rules, now as computation rather than
as instructions to a human: fixed column x-positions, one horizontal band per
chapter, edges only between adjacent bands, at most one merge per chapter. Tight
enough to compute, loose enough not to look like a graph dump.

### 10. The home screen is the map

The Learn page becomes the map, opened pre-zoomed to the current node with the
action card already on screen. Pinching out to see the whole road is a reward,
never a prerequisite — nobody should have to navigate a map to start a session.

Only two numbers are on it: the streak, and minutes per day over the last week.
George: *"the only stat that I care about is the streak and the tracker of how
many minutes I have spent in the past week ... the others I dont look at."*
Everything else — bands, spoken accuracy, tiles, totals — moves behind a **stats
node on the map itself**, a place you visit rather than a panel that greets you.

Quick sessions live on the same screen as a secondary action: 5 cards or 15.

## Three rules that keep it trustworthy

Generative systems lose people when they feel arbitrary.

1. **Revealed is fixed.** Once a chapter is out of the fog it never re-plans. A
   map that rearranges while you walk it is not a path. Only fog may change.
2. **Cold start is authored.** On day one there is no evidence to plan from. The
   first chapter is a fixed, known-good four nodes — greetings, people, your day,
   asking for things. The generator is earned.
3. **Keep an airbag.** A handful of authored chapters held in reserve for when
   generation fails or quota is gone. Not the spine — the fallback. A campaign
   that can show an empty map is worse than one that occasionally shows a generic
   chapter.

## Phasing

Too large for one implementation plan. Three independently shippable phases.

**Phase 1 — the home screen.** Map as the front door, pre-zoomed, streak and
weekly minutes on it, everything else behind a stats node, quick sessions as the
secondary action. Runs against the EXISTING path data, so it ships value with no
generator risk and proves the layout before anything is gutted.

**Phase 2 — the generative chapter engine.** Replace `PATH_SECTIONS` with
generated chapters: the pipeline, the campaign log, node reasons, fog and sketch,
computed edges, 70/30 word carry, outcome-based completion, the 70% chapter
threshold, cold start and airbag.

**Phase 3 — the living map.** Decay reopening and its marker; nodes spawned by a
real voice note arriving with unknown words; a weekly review call that digests the
week's sessions into a teacher's observation ("you are consistently missing
feminine plural agreement") and can spawn a node to target it.

Phase 3's voice-note spawning is the thing no other app can do, and it is the
reason the campaign is worth generating rather than authoring at all.

## What must not break

- A session must always be startable: offline, with no key, on a fresh library.
  Word cards come from `DICT` and need no network, so a node is always openable.
- No sentence may ever be served containing a word George has not drilled.
  `bankServable` is unchanged and remains the gate.
- Progress already made must survive the rebuild, or be explicitly and visibly
  retired. Word strength lives in `hvr_srs` and is untouched by any of this; only
  `hvr_path*` is at risk, and what it holds is section bookkeeping rather than
  learning.
- Every existing test continues to pass.

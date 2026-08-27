# The node drills what you are actually missing, and nothing is left behind

**Date:** 2026-08-26
**Scope:** node session construction (`campBuild`, `campWeakWords`), the carry rule
inside nodes, node completion states, and how a word left behind reaches a later node.

## Where this came from

George, after using the campaign for a few days:

> "I feel like its giving me my confidenter words a lot and not the weaker ones, its
> in the node that I want to be drilling those specific weak words."

> "I feel Im struggling to progress to the next chapter of hte path at the moment."

On what "done" should mean:

> "I dont want a situation where I have to just drill the same like 2 words 10 times to
> pass gold, If its a situation wehre Ive drilled a decent few times and it seems to be
> improving it should let me pass, maybe not gold, but that white/ gold (shown when a
> words decays) or a different colour combo, like youve been here, done it but not
> masstered, maybe to progress we dont need 100% but for gold we do."

And the condition he attached to accepting a lower bar for progression:

> "I owuld like to endsure that when I am doing nodes down the line htat hte weaker
> words for earlier nodes are deliberately drilled too. So I can progress to the next
> chapter at 70% of words learnt, but those words Im still weaker on are also included
> in future node usage so I keep drilling htem without having ot return to the node"

The commit of 2026-08-25 (`56e6e06`) was aimed at this same complaint and fixed four
real mechanisms. It did not fix this one, because the fault is not in what the node
*builds* — it is in which words it decides to build *for*.

## What is actually wrong

Four findings, each verified against the code rather than reasoned about.

**1. The node targets never-met words ahead of failing ones.** `campWeakWords`
(`hebrew-reader.html:15843`) sorts by `rank = { new: 0, weak: 1, progressing: 2,
strong: 3 }` ascending, so `new` sorts before `weak`. Probed on a node holding three
new words and two genuinely weak ones, both solo cards and all three AI rescue
commissions went to the **new** words; the two he keeps failing got nothing.

This matters because the two bands need opposite treatment. A new word reaches
`progressing` after a single meeting — the first-meeting branch in `srsApply` parks it
at `stab` 1–2 with `diff` untouched — so it clears on its own. A weak word needs about
three clean answers to get `diff` under 6.5 and the miss ratio under 0.4. The node
spends its attention on the words that were never the problem.

**2. The teaching gate is stricter than the consolidation gate, exactly where teaching
is the point.** `bankServable` accepts a sentence with one not-ready word only when
every other content word is `strong`. Probed directly:

| sentence | verdict |
|---|---|
| teaches a weak word, support words `progressing` | rejected |
| teaches a weak word, support words `strong` | accepted |
| no not-ready word at all | accepted |

Inside a node — where the words are by definition not yet strong — teaching sentences
are therefore scarce and consolidation sentences pass freely. `campBuild` step 3 fills
the leftover room with the latter. That is the "confidenter words a lot", precisely.

**3. Nothing else covers these words either.** `rescueWords` is global and capped at
`RESCUE_MAX = 3` — the whole library's three worst. His 2026-08-20 backup holds 241
words: 103 new, 42 weak, 17 progressing, 79 strong. A given node's blockers are
essentially never in the global top three, so daily practice does not reach them.

(The 79 strong also disproves a plausible-sounding theory worth recording so it is not
re-investigated: `sentenceCommission` no-ops when fewer than `READY_MIN_FOR_SENTENCES`
= 8 strong words exist. He is far above that. Generation is not switched off; it is
aimed at the wrong words.)

**4. A word left behind never appears in a later node's practice.** `campBuild` builds
its not-ready allowance from `campWeakWords(node)` — this node's own words, nothing
else — so a sentence using a word left over from an earlier node is refused by the gate,
and `campWarm` never asks for one to be written in the first place. The two other routes
back are also shut (`campPickCarry` requires `wordReady`; `campPickWords` rejects
anything in `taken`), but those closures are correct and stay: a word left behind should
come back as something the sentences *use*, not as a lesson restaged from the start.

The four compound: the words that block a node are the ones it de-prioritises, no other
part of the app reaches them, and once the chapter moves on they are gone.

Note also that `campNodeStale` is `conversation passed && not all words ready` and never
checks whether the node was *ever* complete — so a node he passed the conversation on
but never took to 100% already renders with the warm ring and the caption *"You had
this. Some of it has slipped"*, which is false. The state he asked for already exists;
it is mislabelled and it counts for nothing.

## Spending: what this is allowed to cost

Stated once, up front, because every phase below leans on it and a future reader should
not "optimise" it back down. George:

> "it would be useful to be more aggressive on the API usage ... Since we are talking
> about allowing the system to use 2 words ... in a sentence we will need to be bespoke
> sentences for each session, in this those sentences will need to be reviewed. Not to
> mention how to integrate words from older nodes into newer ones when they arent on
> similar topics, this will take more API usage, which I am ahppy to use."

`AI_POOL_CAPS` is `{ strong: 20, fast: 500 }` per key per day and real use runs at a
handful. `sentenceCommission` already costs three calls — plan (lite), write (strong,
falling back to lite), review (lite) — and the review step is the native-speaker pass
that already exists; it does not need building, it needs to survive Phase 2.

Budget after this work: a node session commissions bespoke material **every time** it
runs rather than only when the shelf is bare, at three calls a batch and up to two
batches; chapter planning keeps its existing three; debt bridging adds at most three
more. A heavy day lands near ten lite calls against five hundred. Generating fresh and
throwing away what the reviewer rejects is always the right trade here — a rejected
batch costs three calls, a bad card costs a session.

## Phase 1 — Drill the word that is actually stuck

Invert the `campWeakWords` ordering: `weak` first, then `new`. One line, and it
redirects both the solo cards and the commissioning at the words that block the node.

Raise what gets written. `campWarm` currently commissions for `weak.slice(0,
RESCUE_MAX)` — three. A node holds at most six or seven words; commission for **all**
of its stuck words, in as many batches as that takes, on every session rather than only
when `campHasRescue` says the shelf is empty. Fresh material per session is the point:
a node drilling the same five rescue sentences for a week is the "same lesson over and
over" complaint in a new costume.

`CAMP_SOLO_CARDS` stays at 2. Isolated recall is the drill that already failed him; the
solo card exists to put the word cleanly in front of him once, and the sentences do the
work.

## Phase 2 — Let a node teach with the words it is teaching

Inside node sessions only, relax the carry rule twice:

- support words may be `progressing` rather than `strong`;
- **two** of the node's own words may appear in one sentence.

George chose the second explicitly. It is the riskier half — the strict gate exists
because "a sentence with one weak word and two half-learned ones is the impossible card
this gate was built to stop" — so it is bounded: at most two not-ready words, at least
one of them must be `progressing` rather than `new`, and every remaining content word
must still be `wordReady`. A sentence made of two words he has never met is still
refused.

Daily practice keeps today's stricter rule untouched. The relaxation is passed in as an
argument, so the two callers cannot drift into sharing one rule by accident.

The generator has to be relaxed in step with the gate, or it will keep writing material
the session then refuses. Two changes inside `sentenceCommission`:

- `commissionAcceptable` hard-codes `carried <= 1`. It takes a limit instead, so a node
  batch may return two and a daily batch still may not.
- Node commissioning may scaffold from `progressing` as well as `strong`, which is the
  same relaxation the serve-time gate is getting and widens the usable pool from 79
  words to 96 on his current library. `READY_MIN_FOR_SENTENCES` is then measured
  against that wider pool.

The reviewer pass is what makes this safe to do at all. Loosening a *local* structural
rule while a native speaker still reads every survivor for naturalness is a very
different bet from loosening both. Nothing here touches `learnReviewItems`, and a batch
it rejects wholesale is a batch worth losing.

## Phase 3 — Walked, and gold

Two tiers, replacing one.

- **Walked** — conversation passed, and ≥ 70% of the node's words ready. Counts toward
  opening the next chapter. Warm ring, not gold.
- **Gold** — conversation passed, and 100% ready. Unchanged.

70% matches the `campThreshold` the chapter rule already uses, so one number means one
thing across the map rather than two similar numbers meaning different things.

`campChapterGold` currently counts `campNodeDone`; chapter completion switches to
counting walked-or-better while gold keeps its present meaning everywhere it is drawn.

Split the two senses of the warm ring, which are currently one state wearing one
caption: a node that *was* gold and has decayed says it has slipped; a node that has
been walked but never mastered says so instead. The visual treatment already exists and
does not change — only which node gets it, and what it says.

## Phase 4 — Nothing is left behind

Make a left-behind word reachable by a later node, which is the condition George
attached to accepting the lower bar.

An earlier draft of this phase put debt into a later node's `words`. George corrected it:

> "I dont want weak / progressing words from earlier nodes to 'reappear' as the target
> words for future nodes, I only want them to show up in practice alongside other new
> words from the node. Same way as I build my vocav I want the sentences to naturally
> get more complex, I want those older words to naturally be integrating into sentences."

He is right, and the distinction is exactly the one the data model already draws. A node
has `words` — what it teaches, what its progress counts, what gates its gold — and
`carry` — *"words this node also uses"*, shown on the sheet as **also uses** and handed
to conversation generation as `extra`. Debt is the second thing. Re-teaching a word as a
target would restage a lesson he has already had; using it as an ingredient is how
vocabulary actually consolidates, and it is what makes the sentences get longer over
time instead of staying three words wide forever.

So: **debt never enters `words`.** `campPickWords` and its `taken` filter are untouched,
and node progress, readiness and gold are unaffected by debt. A debt word improves the
ordinary way — per-word commit already grades every word in a sentence it appears in.

`campDebtWords(node, srs)` — words belonging to earlier walked-but-not-gold nodes, still
not `wordReady`, excluding this node's own. Capped at three, and preferring the ones
closest to recovery, so effort lands where it converts rather than on the hopeless case.

Computed at **session** time, not chapter-plan time. Debt changes as he practises, so
baking it into a plan would freeze a snapshot — and computing it live means the chapters
already sitting on his map benefit immediately, with no regeneration.

It reaches the sentences in two places, and needs both or it does nothing:

- **Generation.** `campWarm` passes debt as additional permitted vocabulary the batch
  *may* weave in where it fits — never must. This is the honest answer to the off-topic
  problem: a sentence forcing "grandfather" into ordering food is nonsense the reviewer
  would rightly reject, so the instruction is permission, not obligation, and the
  reviewer stays the judge of whether it landed naturally.
- **Serving.** `campBuild`'s not-ready allowance includes debt words, or every sentence
  written with one in it is refused by the gate on the way to the card. Phase 2's bound
  still holds: at most two not-ready words in a sentence, one of which must be
  `progressing` rather than `new`.

`campBuild` prefers a sentence carrying a debt word over an equivalent one without, so
what generation produces actually gets served rather than sitting behind consolidation.

## Deferred, with reasons

- **Widening `rescueWords` beyond three.** It is the daily session's budget, and the
  node is the right place to fix node vocabulary. Revisit only if the weak pile keeps
  growing once these four phases have run.
- **Loosening the reviewer to match the looser structural gate.** Explicitly not done.
  Phase 2 relaxes what the app will *build*; the native speaker still decides what is
  worth saying. Relaxing both at once is how "confident nonsense" gets taught, and the
  reviewer rejecting most of a batch is a correct outcome, not a problem to tune away.
- **Letting a node session drill words outside its own list.** Considered as an
  alternative to Phase 4 and rejected: a node that quietly teaches words it does not
  claim would make the map lie, which is the fault `campPickWords`' no-top-up rule
  already exists to prevent. Debt should be visible in the node that owns it.
- **Changing the `weak` band thresholds** (`diff >= 6.5`, miss ratio `0.4`). They are
  read by the daily session, the library dots and the map colouring; moving them to fix
  a node problem would change meaning across the whole app.
- **Re-teaching debt as a later node's target word.** Considered and rejected by George
  directly — see Phase 4. It would restage a lesson he has already sat through, and
  make a node's progress bar count words the node does not claim to teach.
- **Letting the chapter planner place debt thematically.** Followed from the rejected
  design above: once debt is an ingredient rather than a target, it does not need a
  theme that fits, only a sentence that reads naturally — which the reviewer already
  judges. Would also have frozen debt at plan time, when it changes every session.
- **Biasing `campPickCarry` toward debt.** It runs at chapter-plan time and has the same
  staleness problem, and its output is authored into the node. Session-time debt does
  the same job without rewriting anything already on the map.
- **Auto-passing a node whose words are all strong** already exists (`campNodeKnown` /
  `campAutoPass`) and is untouched.

## Verification

`hebrew-reader.html?selftest` — 442 passing before this work.

Phase 1 needs a test asserting a weak word outranks a new one in `campWeakWords`; that
single assertion is the whole of finding 1. Phase 2 needs the bounded relaxation tested
from both ends — two node words accepted, two *new* words still refused — and
`commissionAcceptable` tested at both limits, so the generator and the gate cannot
drift apart. Phase 3 needs a walked node to count toward chapter completion while still
not reading as gold. Phase 4 needs `campDebtWords` to find a walked node's outstanding
word and to skip a gold node's, and — the assertion that actually protects George's
correction — a test that a debt word never appears in `node.words` and never moves
`campNodeProgress`.

Prompt changes cannot be unit-tested and must be checked against a real call before the
phase is committed — the reviewer rejecting everything looks identical to the reviewer
never running.

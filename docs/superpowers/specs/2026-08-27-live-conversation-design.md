# A conversation that answers what you actually said

## Where this came from

George, pasting a real node conversation:

```
Shalom! Ma nishma hayom?
אני טוב תודה ואתה
אתה עובד היום?
Ata oved hayom?
כן אני עובד היום
איפה אתה עובד? בבית?
Eifo ata oved? Babayit?
כן בבית
ואחרי העבודה, מה אתה עושה?
Ve'acharei ha'avoda, ma ata ose?
```

> I think it marked one of my answers as incorrect. The problem is their is no real
> responsivness, like if I get it out right wrong htere is a little bit, but if I say
> something that is kind of correct but actualyl more advanced/ different there is no
> dynamic part of it. Ive said before m happy to use more API calls so maybe that is
> somehting we can consider given there is just one per node, out of hte 500 it could be
> feasable ot burn 8 per. My only hold back there would be hte latency nad delay.

And on the shape it should take:

> I'm envisioning a larger rework of hte current system. Lets take a wider look at it. I
> think the more guided real live dialoge is the route I would prefer to go down, or at
> least see how it works. For context thos in hte real conversation flow there is not
> marking page. I dont have ot manually mark my answers its pretty smooth from message to
> message. factor that in

And, given a worked example back:

> The conversation is about work, it asks me if I worked today, I respond ken, ani oved
> hayom bebayt. The conversation will respond to that and reply something like, "at home,
> nice, how was it?" So its responsive to what I say. Similar to if I ask a responding
> question the app with asnwer me. The 6 best point can be a good conversation strucutre,
> like 6 minimum or like 6 things to hit on, but It doesnt neciserily have to be 6 max or
> jsut super rigid.

## What the code actually said

Two separate failures with one root cause, and the first one is not what it looks like.

**It is already trying to accept alternatives.** `learnMakeConversation` asks for 2–3
`alts` per turn, and grading is not sequence alignment — `convoContentCoverage` strips a
candidate to its content words and asks whether those appeared anywhere in what was said,
with extra words costing nothing. There is a comment in the file quoting George's
*previous* report of this exact complaint. That work is real and stays.

**But coverage is lexical, not semantic.** `learnSuggested = coverage >= 0.8 ? 2 :
coverage >= 0.4 ? 1 : 0`. On a two-content-word model answer each word is worth 50%, so
one synonym is the whole difference between right and wrong. Against a scripted
`הכל בסדר תודה`, saying `אני טוב תודה` hits `תודה`, misses `בסדר`, scores 0.5, and lands
on "Nearly". Saying it *better* scores exactly the same as saying it wrong.

**And nothing reacts.** The transcript above is the proof: he ended a turn with `ואתה?`
and the next line ignored it completely, because the next line is fixed before he opens
his mouth. The only adaptive branch in the whole feature is `learnGrade`'s
`c.kind === "conversation" && grade === 0 && c.item.rhe && !c.repaired` — fail, and they
repeat the turn once more simply. Succeed, or succeed interestingly, and nothing happens.

Root cause of both: **the model is not in the loop at the moment he answers.**

**The latency budget already exists.** `learnRenderCard`'s conversation branch renders a
`…` and calls `setTimeout(() => learnGrade(learnSuggested), 1100)`. That is a typing
indicator, spending 1100ms doing nothing. A call fired when the mic stops has that window
free; anything under ~1.1s costs nothing at all against today, and a slower one reads as
someone composing — which is what the `…` is already pretending.

**Conversation turns never feed the level system.** `learnAdvance` records
`levelRecord(...)` only for `sentence`, `listen` and `reply`. `conversation` is absent. So
the one surface where he is most likely to reach past what was asked is the one surface
that never measures him.

**Node gold already separates the two things.**
`campNodeDone = campNodeWordsReady(n, srs) && campConvoPassed(id)` — whether the node's
words are learned is checked against the SRS, *independently* of the conversation. This
matters more than it looks: it means the conversation does not have to force its target
words to be uttered, so the fix does not rebuild the lexical trap one level up.

## The design

A conversation stops being six scripted turns and becomes six **beats** — things to cover
— realised live.

### The data

The planning call returns both halves in one request, at the same cost as today:

```js
beats: [{
  intent: "they ask whether you're working today",  // what this turn is FOR
  want:   "say whether you are, and where",         // what he should convey
  must:   ["עובד"],                                 // node words this beat aims at
  lvl:    2,                                        // target level for the beat
  qhe, qtr, qen,          // ── the fallback: a fully scripted realisation of
  he, tr, en, alts[]      //    this beat, i.e. exactly today's turn format
}]
```

The bottom half **is** the current turn shape. Every conversation already in `convoAll()`
therefore reads as a beat sheet with `intent` missing and behaves exactly as it does
today. No migration, nothing to regenerate, and the fallback path is not a degraded mode
bolted on — it is literally the current app.

### The turn loop

Their opening line comes from beat 1's `qhe`: no call, instant, unchanged. Then per turn,
one call fired the moment the mic stops, into the existing `…` slot:

- **in** — the thread so far, his actual transcript (`c._said`, already captured), the
  current beat's `intent`, the next beat's `intent`, his vocabulary list, and how many
  beats remain against how many turns have gone
- **out** — `grade` (did he convey the intent), `lvl` (how advanced what he said actually
  was), `beatHit`, their next line, and `newWords` for anything outside the list

The judge is asked *did he convey this*, never *did he use these words*, and told
explicitly that a synonym, a richer construction or volunteered extra content is a pass.

### Beats are a floor, not a ceiling

Six beats to cover, twelve turns maximum. Between beats the conversation may breathe —
follow up on something volunteered, answer a question asked back — and it ends when the
beats are covered or the cap is reached.

Three things follow:

**Repair dissolves.** "You didn't hit the beat" simply means the next line approaches it
again, which is what a person does. The `c.repaired` flag, the `rhe/rtr/ren` fields and
the one-retry limit all stop being special cases. `convoShowRepair` goes.

**Gold moves from turns to beats.** `learnFinish` currently computes
`pct = Math.round(100 * s.got / s.cards.length)`, which with a variable-length
conversation quietly punishes one that went well enough to run long — more turns, more
chances to stumble, lower percentage. It becomes beats covered over beats planned,
against the same `PATH_PASS_PCT` of 60.

**The session has to be able to grow.** `learnSession.cards` is built once by
`learnBuild` / `campBegin` and `learnAdvance` ends on `s.i >= s.cards.length`. A
conversation that grows appends to it. Conversations get their own progress treatment —
beats covered — rather than `learnRoadStrip(i, total)` silently re-scaling its waymarks
mid-exchange.

### Cost

Six beats, up to twelve turns, one call each on `GEMINI_MODELS_FAST` — lite-first, 500 a
day, and the faster model besides. Two conversations a day is ~24 of 500. George budgeted
8 per node; there is far more headroom than that.

### Failure is a non-event

Call fails, times out, quota gone, no signal → use the next beat's scripted `qhe` and
grade with today's local `convoBestMatch`. **`G4` from `docs/audit-2026-08-27.md` becomes
a prerequisite rather than a nice-to-have**: no `fetch` in the file has a timeout, and
here a hung request would stall the conversation mid-sentence with a `…` that never
resolves.

## Phases

Each stands alone and can be reverted alone.

**Phase 1 — the beat-sheet format.** Extend the planning prompt to return `intent`,
`want`, `must` and `lvl` alongside the existing scripted fields. Read conversations as
beat sheets everywhere. No live calls. Behaviour identical, so this ships safe and proves
the format round-trips through storage and sync.

**Phase 2 — the live turn.** `fetchWithTimeout` first (G4). Then the per-turn call:
judge + next line, fired into the `…` slot, with the scripted line as the timeout
fallback. Variable-length sessions, beats-covered gold gate, repair removed.

**Phase 3 — the level gap.** Conversation turns feed `levelRecord`, using the `lvl` the
judge reports for what he actually said rather than the beat's target.

## Deferred, with reasons

**Fully live dialogue with no beat sheet.** Considered and rejected. It drops the
guarantee that a node's target words are ever reached for, makes offline conversation
impossible, and removes any pre-generated line to fall back to. The beat sheet costs one
call already being spent and keeps all three.

**Re-planning the beats mid-conversation.** The fixed sheet is what guarantees node words
appear; re-planning dissolves it for no gain George asked for.

**Generating turn 1 live.** There is nothing to react to yet, and a pre-written opener is
what keeps the conversation starting instantly.

**Making `must` words a pass condition.** This would rebuild the lexical trap the whole
spec exists to remove. `campNodeWordsReady` already gates gold on the SRS independently,
so the words are checked — properly, against real practice — without the conversation
having to police them.

**Scoring the SRS from the model answer.** Today `learnGrade` writes `srsAnswer` for each
word in `t.uses`, which are the words in *its* answer — so answering differently schedules
words he never uttered. Phase 2 derives them from his transcript instead. Noted here
rather than as its own phase because it is one line inside the Phase 2 change.

## The risk to watch

The model may enjoy a tangent too much and never land the remaining beats. Bounded, not
eliminated: every call is told how many beats remain against how many turns have gone and
instructed to converge as that ratio worsens, and the twelve-turn cap stops it running
away. This is the failure mode to watch on the first real run.

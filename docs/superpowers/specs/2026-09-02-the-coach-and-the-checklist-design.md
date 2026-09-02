# The coach and the checklist

## Where this came from

Five flags raised inside one session on *Liking & wanting*, all within about four minutes
of each other, all about the compose mode shipped on 2026-08-30. They are one complaint
told five ways, and the fifth one names the fix.

On the second screen — the flag that started this:

> When doing these sentences builders the page before this one showing me the reply from
> the coach is much nicer than the one it jarringly changes to here when I press reply lm
> the message from the coach is full screen. There shouldn't be 2 it should just be one
> screen when the coach replies I can reply directly underneath, no need for the different
> page

On being cut off:

> Also the conversation abruptly ended when I went to press reply and moved to the next
> sentence builder which was a bit jarring

On the shape of a session, which turned out to be the whole design:

> I really like this sentence builder thing, but think having them all as one iss too much,
> for instance should b 2 words once the convo hits it mark (which I think should be
> communicated better like what's the coach looking for) the session ends then the next
> time I do a sentence builder it used the next set doing all at once is too much. Plus
> requiring the coach to do 6 or whatever arbitrary amount it is feels odd in practice

Two plain bugs, flagged one card apart:

> The conversation scrolls to the top when the page changes

> And the same words have just repeated for some reason at the end of this session

And then, asked what a session should be instead, the answer this spec is built on:

> More dynamic. So its not like its 3 session strapped together. Maybe there is a
> checklist from the coach, I start with 2 words for my opening sentence, then there are 2
> more words I should incorporate into my replies (not strictly hte next one but inth
> ecoming ones (maybe one at a time) there could be other challenges too like using
> certain grammer or tense (tho tense may be a little hard for me) this way there is a
> dynamic challenge element and it doesnt feel like multiple htings bolted together. The
> api calls worked amazing ofr generating responces so they can be used well here. I would
> alos like the reponse from coach ot be automatically read aloud

On who opens, and where the words come from:

> its me that starts the flow the AI responds. Plus I envision this replacing hte current
> convesation mode in the nodes, in which case I need to start with the nodes words, for
> more general open ended sentence building (whatever we call this mode) outside nodes
> yeah the AI could pick from library

## What the code actually said

**The second screen is a real second card, and it was deliberate.** `composeNextCard` with
kind `"same"` builds a *new* card whose `item.qhe` is the coach's line, and
`learnRenderCard` clears `#lCard` and rebuilds from nothing. The original spec's reason —
*"the thread has a record of each turn rather than one card being rewritten under him"* —
is sound, but the record does not have to live in the card list to exist. That is the
whole of this change.

**The abrupt ending has a precise cause.** `composeNextKind` returns `"round"` or `"end"`
the moment `give` arrives or the exchange cap is reached, and it does so *regardless of
whether `say` was a question*. `asked` is computed but only consulted in the branch that
keeps him in the round. So a coach that asks something on its last permitted exchange
produces exactly what he described: a question on screen and a button reading *Next words*.

**"6 or whatever arbitrary amount" is `COMPOSE_ROUNDS × COMPOSE_EXCHANGE_CAP`.** Three
rounds of up to three turns, worst case nine cards. The counts are told to the model in the
prompt — `"Round 2 of 3, exchange 3 of at most 3"` — so the arbitrariness he is reacting to
is not imagined; it is literally in the coach's instructions, and it is what makes the coach
stop mid-thought.

**The scroll bug is an omission, not a regression.** `convoThread` ends with
`requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; })`. `learnRenderCompose`
builds the same `.lbubbles` element — which is `max-height: 190px; overflow-y: auto` in CSS —
and never scrolls it. Every repaint therefore shows the top of the thread.

**The repeated words are two bugs sharing one symptom.** The fallback in `composeNextCard`
is `composeOpening(pool.filter(k => (c.give || []).indexOf(k) === -1), srs)` — it excludes
only *this* round's pair, so round 3 falls back onto exactly the weakest-first pair that
opened round 1. And `composeNormalise` filters `give` on pool membership alone, so a coach
that names words he used two rounds ago passes unchallenged. Both paths lead to the same
place, which is why it showed up at 7/7.

**Auto-play already exists and compose is simply not in the list.** `learnSpeakPrompt`
handles `note`, `listen`, `shadow`, `reply` and `conversation`. It is called at the end of
`learnRenderCard` — after the point where compose returns early. So the coach has never
spoken, and adding it is joining an existing pattern rather than building one.

**`composeCredit` already returns exactly what a checklist needs.** It resolves his
transcript to library keys through `bankUses`/`libKeyFor`, drops anything the coach flagged
in `bad`, and returns the surviving keys. A word ticks when it appears in that return value.
No new detection, and the existing safety rule — *the app derives the keys, the model only
judges them* — is untouched.

## The design

### A session is one conversation with four word objectives

`COMPOSE_ROUNDS` and `COMPOSE_EXCHANGE_CAP` are both deleted. In their place:

```js
const COMPOSE_OBJECTIVES = 4;   // the checklist
const COMPOSE_OPENING    = 2;   // of those, the ones the first sentence is built from
const COMPOSE_TURN_CAP   = 8;   // backstop, not a target
```

Four words go on the table at the start and stay there for the whole session. Two of them
are what he opens with; all four are the checklist. **All four are visible from turn one** —
that is the direct answer to *"which I think should be communicated better like what's the
coach looking for"*. A drip-feed would have been more surprising and less legible, and
legibility is the thing being asked for.

The session ends when all four are landed. Not on a count.

### The words are picked locally, and he opens

No opening AI call. He speaks first and the coach responds — *"its me that starts the flow
the AI responds"* — so there is nothing for a call to react to, and a session that opened
with a spinner would be worse than one that opens with four words and a microphone.

`composeObjectives(pool, srs)` picks the four. It is a thin wrapper over the existing
`composeOpening(pool, srs, n)`, which already takes a count and already sorts weakest-first
by production band — so there is no second copy of that rule, and `composeOpening`'s own test
stands. The wrapper exists to give the future out-of-node mode a named seam to replace.

The coach no longer picks words at any point, so **`give` leaves the response schema
entirely** and both repeat bugs leave with it.

Across sessions this rotates itself with no new state: landing a word raises its `prod`
strength, so weakest-first returns a different set next time. A word he never manages to
land stays weakest and comes back, which is the correct behaviour rather than a gap.

**The word source is the one thing built to be swapped.** `composeObjectives` takes a pool
and returns objectives; the out-of-node mode, when it comes, supplies a different pool and
may choose them with a model. Nothing else in the session loop knows where the words came
from.

### The card grows in place

One `compose` card per session, holding the exchange:

```js
{ kind: "compose",
  pool:       [...],              // the node's nine
  objectives: [k1, k2, k3, k4],
  landed:     { k1: true },       // app-derived, never the model's assertion
  turns:      [ { said, out } ],  // the record the old card list used to be
  closing:    false,              // the list is done and one answer is still owed
  _stage, _said, _out }
```

`turns.length` is the turn counter. `composeHistory` reads `c.turns` instead of walking
`s.cards`. `learnAdvance` fires once, when the session ends.

The four stages stay what they are — `ask` → `heard` → `sending` → `reply` — but `reply`
stops being a terminus. It now carries the correction, the coach's line **and the microphone
underneath it**, and speaking again advances the same card to the next turn. There is no
*Answer them* button because there is no page to go to. The `_stage` field stays on the card
rather than in a module variable for the reason it already is: a repaint has to put back what
was on screen.

The visible consequence is the one he asked for — *"when the coach replies I can reply
directly underneath"* — and the thread above accumulates as it did before.

### The session never ends on an unanswered question

This is the rule, stated as an invariant because that is how the flag was phrased:

> The session never ends on a turn where the coach asked him something — except at
> `COMPOSE_TURN_CAP`.

Mechanically, after each turn is judged and ticks are applied:

1. `turns.length >= COMPOSE_TURN_CAP` → **end.** The backstop, and the one case where a
   dangling question is allowed. The prompt for that turn was already told it was the last,
   so it should not arise.
2. Any objective outstanding → **continue.**
3. All objectives landed, and the coach's reply asked him something → **continue for one
   more turn**, with `closing: true` set on the card. That turn's prompt says the checklist
   is complete and this is the last exchange, so the coach answers what he says and signs
   off. Then it ends whatever comes back.
4. All objectives landed, nothing asked → **end.**

The prompt is told when it is on the last turn, rather than left to infer it:

```js
lastTurn = (turns.length + 1 >= COMPOSE_TURN_CAP) || c.closing
```

On a last turn the instruction is to answer what he said and sign off without asking
anything — which is the same move the old `lastExchange` flag made, aimed at the end of a
session rather than the end of a round.

**Whether the coach asked something is a new `ask` field it reports about its own reply**,
not inferred. The old code inferred it from `say.he` being non-empty, which is true of every
reply the coach ever writes and therefore means nothing. A self-report is reliable for this
and is low-stakes in a way `bad` is not: the worst a wrong `ask` can do is grant or withhold
one turn, where a wrong word key would reach `srsAnswer`.

### The coach gets pointed before it runs out of room

When turns start running short against words still outstanding —

```js
turnsLeft = COMPOSE_TURN_CAP - turns.length
pointed   = outstanding.length > 0 && turnsLeft <= outstanding.length + 1
```

— the prompt switches register: instead of *ask him one thing about what he just said*, it
becomes *ask him something that word is the natural answer to*. The coach stops making
conversation and starts making room.

This is the honest version of a backstop. It does not drop an objective or swap it out —
that would hand the model authority over what the session was for — and it does not silently
extend the cap. It makes the last few turns count, and if a word still does not land, the
end screen says so plainly.

### Ticking

A word ticks when it is in `composeCredit`'s return value: detected in his transcript by
`bankUses`, and not flagged by the coach in `bad`. So **a tick means he said it and said it
right**, which is what makes the checklist worth looking at. A misused word stays on the
table with the correction visible above it, and the next attempt is the actual lesson.

Crediting itself is unchanged. Every word he says correctly still writes
`srsAnswer(…, 2, "prod")`, objective or not — the collateral crediting that makes this mode
worth more than a sentence card. The checklist is a layer over that, not a replacement for
it. **Compose still never records a miss.**

### What it looks like

The words on the table are already `.lgive`, already laid out in front of him, already
present for the whole round. They become the checklist without becoming a widget.

**A landed word turns gold.** §3: gold means *you did this* — streaks, finished towns,
mastered words, the Got it button. This is that, exactly. Unlanded words stay in the current
ink. No checkboxes, no rules, no ✓ (§2 — no emoji in the world layer), and no caption
explaining what the gold means, because gold already means this everywhere else in the app.

The order is fixed with the opening two first, so position carries which is which without a
label — §4, *the arrangement carries the meaning*. The card's one ask line names the task
for where he is: build a sentence with the first two on turn one, keep going and work in
what is still on the table after that.

**The road draws objectives, not cards.** `learnRenderCard` currently draws
`Math.min(COMPOSE_ROUNDS - 1, c.round)` of `COMPOSE_ROUNDS`; it draws landed of
`objectives.length` instead. Same reasoning the conversation's road already uses — the card
list grows as he goes, so waymarks drawn from it build themselves behind him and say nothing
about how far is left. Objectives landed is the thing that is actually true about progress
here, and it is the same fact the gold on the table shows, in the world's own register.

### The coach speaks

`learnSpeakPrompt` gains a `compose` branch that speaks the newest coach line via
`playHe`. Joining `reply` and `conversation` rather than inventing anything: it is the same
device voice (`speakHe` → `HE_VOICE`), and there is no setting to add because there is no
setting for the others.

Guarded on turn index — `learnRenderCard` runs on repaint, resize and every stage change, and
speaking on each of those would have the coach repeating itself over him. The card records
which turn it last spoke and does not speak that one twice.

### And the thread stays where he left it

`learnRenderCompose` gets the line `convoThread` has had since it was written:

```js
requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
```

### The name

The node sheet button becomes **The coach**, and the end screen says the same. *Build
sentences* described the exercise; what is actually different about this mode is that
something answers you, and once it replaces the legacy conversation (below) *the coach* is
still the right name — so this is not a rename to be done twice.

The card kind stays `compose` and so do all the function names. Renaming internals across a
1MB file to match a button is churn with a splice risk attached, and §7 is explicit about
what large structural edits cost here.

## Phases

Each stands alone and can be reverted alone.

**Phase 1 — the checklist replaces the rounds.** `composeObjectives`, the card holding
`turns` and `landed`, the end decision above, the pointed prompt, `give` out of the schema
and `ask` into it. The prompt loses all round and exchange language. Flags 1, 2, 3 and 5.

This is where the two-screen jump disappears, because a session that is one card cannot
navigate to a second one.

**Phase 2 — the coach speaks and the thread holds its place.** `learnSpeakPrompt` and the
one `scrollTop` line. Flag 4, and his request. Small, and deliberately separate: it is the
only part that can be judged by ear rather than read, and it should be shippable on its own
if Phase 1 needs another pass.

**Phase 3 — the end screen reports the checklist.** What he landed, what he did not, the
level he built at. The existing screen already says *"4 words levelled · you built at level
3.3 · you're measured at 2"*; it gains the objectives, and stays a report of movement rather
than a score (§4).

## Testing

Driven with plain objects, per the suite's standing rule about localStorage isolation.

1. **A word ticks only when it was used correctly** — a transcript containing two objectives
   where the coach flagged one in `bad` ticks exactly one of them, and the other stays
   outstanding. The behavioural heart of the checklist.
2. **The session never ends on an unanswered question** — all objectives landed with
   `ask: true` continues and sets `closing`; the same state with `ask: false` ends; and the
   turn after `closing` ends regardless of `ask`.
3. **The cap ends it anyway** — at `COMPOSE_TURN_CAP` with objectives still outstanding, the
   session ends, and the prompt for that turn was built with the last-turn instruction.
4. **Pointed mode turns on when room runs short** — the predicate is right at the boundary
   and off before it.
5. **Objectives are distinct and weakest-first** — `composeObjectives` returns
   `COMPOSE_OBJECTIVES` distinct pool words in production-band order, and returns what it can
   when the pool is smaller than four.
6. **A malformed reply is survivable** — the existing `composeNormalise` contract, extended
   to `ask` and with `give` gone.

Existing tests that assert the round machinery — `composeNextCard: three rounds…`,
`composeNextKind: the exchange is a floor…`, `composeNextCard: staying in the round…`,
`composeNextCard: a coach that declines to choose…`, and the `give` half of
`composeNormalise: the coach may only hand over words from the pool` — describe behaviour
this spec deletes and are removed with it. `composeCredit`, `composeBank` and the
no-target-to-align-against tests are untouched and must still pass.

## Deferred, with reasons

**Grammar and tense challenges on the checklist.** His own idea — *"there could be other
challenges too like using certain grammer or tense (tho tense may be a little hard for
me)"* — and he asked for it to be kept for a later review of feature ideas rather than
dropped. The reason to hold it: a word objective is verified by the app from his own
transcript, so a tick can never lie to him. A grammar objective can only be ticked on the
coach's say-so, which puts an item on the list that is the model's opinion rather than a
measurement. Worth doing, worth doing deliberately, and worth doing after the word version
has been used enough to know what the rhythm feels like.

**The out-of-node open-ended mode.** *"for more general open ended sentence building
(whatever we call this mode) outside nodes yeah the AI could pick from library"* — a
different word source, a different entry point, no node lesson record, and an AI word-picking
call this spec does not need. Its own spec. `composeObjectives` is shaped so that mode
supplies a pool rather than restructuring the session.

**Replacing the legacy conversation with this.** *"I envision this replacing hte current
convesation mode in the nodes"*, and separately: *"the sentence builder co versation feature
is really really good and I think we should take a deeper look at how we can use those
dynamics to improve/ completely revamp the existing conversation feature"*. This is the
agreed Phase 2 of the wider piece of work and is explicitly not in this spec — the coach has
to be right first. It also has a real question behind it that this spec does not answer: the
conversation has strengths of its own (his words: *"which still has strengths"*), including
pre-generated content that works offline, and a migration has to decide what happens to
those rather than assuming they are replaced.

**A composite score, an exercise-type bonus on `srsGain`, and a crude offline scorer.** All
argued and rejected in the 2026-08-30 spec; nothing here changes those arguments.

**Alternating the two API keys per call.** Still deferred, and now slightly less pressing:
one continuous conversation with a turn cap of 8 fires at most 8 calls where three rounds of
three exchanges could fire 9, and they are spread across human composition time. Should still
be sized against measured behaviour rather than a prediction.

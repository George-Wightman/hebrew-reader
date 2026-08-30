# Composing sentences with a coach

## Where this came from

George, opening the idea:

> Ive had an idea for a new excersize type/ a new ractice mode. Where I am given 2 words
> for a node and ahve to make a sentence from them its also a way for hte app to learn to
> other words I ight be aware of that havent came up organically.

On the shape it should take:

> My vision for htis isnt to completely rip the conversation feature but to have it like
> Im sitting down with a coach, they are giving me a couple of words and telling me ot
> make a sentence, I say hte sentence then they reply, ask me a quesiton aobut what I
> said/ push me to make some improvments etc, a light back and forth

On where it sits in a node — which turned out to describe the code exactly:

> Im not sure how it works currently in the code, but in my head to unlock the
> conversation I have ot reach a certain level of strength with teh words from practice,
> maybe hte composing sentence idea is jsut nother way to level up my strength, and it
> give a bonus over translating sentences, the same way recognising and responding in a
> conversation is a harder skill that having time ot translate a word. So optional but a
> good way to develop that strength.

Rejecting an earlier design where three sentences were composed first and reviewed after,
to hide API latency:

> So I think I have slightly soured on hte do 3 get feedback at the end, I owuld have
> forgotten what the first sentence was by then... Build it like this, we will see what
> the latency is like when its in practice

And the idea that turned out to be the most valuable one in the thread:

> I also think this is a good change to level up other words. For instance if I say
> "ha-autobus ha-adom" we would level up bus and red, even if hte target was just bus.

## What the code actually said

**His model of the node gate is precisely what is implemented.** There is no "practice
lesson passed" flag to satisfy:

```js
campNodeWordsReady = words.every(k => STOPLIST.has(k) || wordReady(k, srs))
wordReady(k, srs)  = srsStrengthOf(srs, k, "prod") is "progressing" or "strong"
```

Six words reaching an SRS production band, and nothing else. Which means a new mode does
not need to be a gate, or to know a gate exists — it writes `srsAnswer` like every other
card and the node opens when the words are ready, whichever surface got them there.

**Every existing card has a target string, and this one does not.** `learnExpectedHe`
returns `c.item.he`; `alignSpoken` aligns against it; `learnTokens` pairs Hebrew to
translit by index; `convoContentCoverage` scores against candidate answers. None of that
applies to "say anything, using these two words". This is the first genuinely open-ended
card in the app and it is why `compose` cannot be a `LEARN_KINDS` entry with a new label.

**The word pool is bigger than a node's six.** `CAMP_WORDS_PER_NODE = 6` plus
`CAMP_CARRY_PER_NODE = 3` — and carry words exist precisely to make sentences possible.
Nine is enough to choose combinations from.

**The turn loop already exists.** `convoLiveTurn` sends the thread, his transcript and the
current intent, and gets back a judgment plus the next line, fired into the `…` slot with
`CONVO_LIVE_TIMEOUT_MS`. A coach that responds to a sentence is that loop with a different
opening move, not new machinery.

**And `srsGain` already prevents the obvious abuse of collateral crediting:**

```js
srsGain(R, diff) = max(1, min(SRS_GAIN_MAX, 1 + SRS_GAIN * (1 - R) * byDiff))
```

Gain scales with `(1 - R)`. A word answered again while `R` is near 1 — the same word, the
same session — grows stability by ≈1, which is to say not at all. Saying *ha-otobus
ha-adom* three times cannot inflate either word. The scheduler defends this for free.

## The design

### One round

The coach puts two or three of the node's words on the table. He says a sentence using
them. One call judges what he said, credits it, and produces the coach's reply — a
reaction, a question about what he said, or a push to extend it. A short back-and-forth
follows, and when it has run its course the coach hands over new words and the next round
begins. Three rounds is a session.

`COMPOSE_ROUNDS = 3`. The exchange within a round is capped at `COMPOSE_EXCHANGE_CAP = 3`
turns, not fixed at it: a clean, interesting sentence may earn one reply and move on; a
thin one may earn two more. The same "beats are a floor, not a ceiling" argument the
conversation settled, and the same risk — a coach enjoying a tangent — bounded the same
way, by telling every call how many rounds remain against how many turns have gone.

**The round count is authoritative, not the coach.** `done` and `give` are what the model
*wants*; the session ends after `COMPOSE_ROUNDS` regardless, and the exchange moves on at
the cap whether or not `give` arrived. A model that never volunteers to move on must not
be able to run the session forever — the twelve-turn cap in the conversation exists for
exactly this and is the precedent.

### The call

One per turn, mirroring `convoLiveTurn` in shape and cost:

**In** — the node's nine-word pool with each word's strength, his measured level, the words
handed over this round, the thread so far, his actual transcript, and how many rounds and
exchanges remain.

**Out**

```js
{
  lvl:  3,                       // LEVEL_RUBRIC 1-5, for what HE produced
  ok:   "clean" | "minor" | "wrong",
  used: [{ he: "אוטובוס", ok: true }, { he: "אדום", ok: true }],
  fix:  "האוטובוס האדום נוסע",   // the corrected sentence, or null when clean
  why:  "one line on what was off",
  say:  { he, tr, en },          // the coach's next line
  give: ["…", "…"],              // next round's words, or null to stay in this one
  done: false,                   // the coach ending the session
  newWords: [{ he, tr, en }]     // anything he said that is not in the library
}
```

`lvl` reuses `LEVEL_RUBRIC` verbatim, so compose feeds `levelRecord` in exactly the same
currency as every other card rather than inventing a second scale.

**The coach chooses `give`.** This dissolves the word-pairing problem rather than solving
it: George's worry was that a node might not hold enough words to pair a verb with a noun,
and picking at random would produce combinations that cannot make a sentence. The thing
selecting the words is now the thing that knows Hebrew, and it costs nothing — `give`
rides on the call that was already responding to the previous sentence. (Part-of-speech
data exists via `normalisePos` and the forms index, but only for words that have been
through the forms queue, so a rule built on it would be right only sometimes.)

### What it writes

Three rules, each mechanical, and deliberately no composite score:

**SRS.** `srsAnswer(srs, k, 2, "prod")` for every word in `used` marked correct — which
includes words he was never asked for. **Compose can never record a miss.** He was not
asked about *adom*; volunteering it wrongly is not evidence that he has lost it, and the
correction is what teaches the agreement. Only retrieval is scored here; grammar belongs
to the forms system.

**Level.** `levelRecord(st, lvl, ok !== "wrong")`, identical to every other card.

**Bank.** If `ok !== "wrong"` **and** `lvl >= learnerLevel()` **and** every content word is
in the library → bank `fix || he` as a `sentence` item, through the existing
`bankNearDuplicate` guard. The corrected version, never the raw one: banking a sentence
with an agreement error would teach him the error every time it came round. There is an
upside worth naming — drilling him later on the corrected form of *his own* mistake is
better material than a generated sentence, because it is his mistake, spaced.

### Why there is no score

George asked for a rubric or an equation. The rules above are the rubric; collapsing them
into one number is the part being deliberately refused.

A level-4 attempt with one agreement error is **better practice** than a flawless level-1,
and any single number ranking those two has to choose an arbitrary weighting. Worse, a
visible score invites optimising it, and the way to optimise a blended accuracy-and-
complexity score is to write the same safe sentence every time — the exact behaviour the
mode exists to break. This is the style guide's own **report movement, not currency**: XP
was proposed and binned once already because the app has a level that *measures*
capability, and paying for volume is what the SRS spends real effort refusing to do.

Where a number is genuinely useful it is used: `lvl` decides banking, and the end screen
can honestly show the average level he built against the level he is measured at — "you
built at 3.3, you are measured at 2". The only way to game that is to write harder
sentences.

### Why there is no bonus multiplier

His instinct — that free composition should be worth more than translating a sentence — is
right, and the mechanism is already there without touching the scheduler.

`srsCalibration` exists to check the scheduler's predictions against what actually happens.
An exercise-type multiplier on `srsGain` would inflate stability without evidence and
silently degrade that calibration, so the app would stop being able to tell whether it is
right about him. The bonus is structural instead: **one compose sentence credits three to
five words where a `sentence` card credits the words in one target sentence**, and it
credits them on unprompted recall, which is harder retrieval than a card that shows him the
English and asks for the Hebrew. If it should *feel* more rewarding, that is the end
screen's job, not the scheduler's.

### The card

It looks like the conversation, because it **is** one — `convoBubble` / `convoThread`, the
same `…` while the coach thinks, the same mic. Reusing that presentation is both the
cheapest option and the one the style guide asks for: no new visual register on the paper,
and "one signal, not four weak ones" rather than a fourth layer explaining a fifth.

The one new element is the words being handed over. Per **the arrangement carries the
meaning**, they should read as the coach placing words on the table — set apart from the
thread rather than captioned inside it — and they stay visible for the whole round, since
they are the constraint he is working against, not an instruction he reads once.

No emoji glyph on the card itself, per §2.

**He never grades himself here.** No Got it / Nearly / Missed. `learnMicGrades` and
`learnTokens` both return false/null for `compose` — there is no target to align against,
and offering a manual grade for "was my own sentence good" would be asking the one question
learners are worst at answering. The judge decides; the correction is the feedback.

### Where it lives

A fourth button on the node sheet, beside *Meet the words*, *Practise* and *The
conversation*. Working name **"Build sentences"** — a naming call, not a design one.

It gets its own lesson id and records a `pathLessonRec` like any other session — which is
harmless, because `campConvoPassed` reads only `CAMP_CONVO_LESSON` and `campNodeDone` reads
only that plus `campNodeWordsReady`. So the record exists for the node sheet to show later
without any of it touching gold. That is the whole payoff of optional: nothing new to be
stuck behind, and it is allowed to have hard requirements — including needing a connection.

### Failure

There is no scripted fallback, and unlike the conversation there cannot be one: the coach
has nothing to react to until he speaks. So the button says it needs a connection, and says
so before he taps it rather than after.

A crude offline marker was considered and rejected. Target-word usage can be checked
mechanically, but grammar cannot, and crediting the SRS from an unchecked sentence is the
one thing that can quietly corrupt the scheduler. Practise still works offline; compose
does not have to.

## Phases

Each stands alone and can be reverted alone.

**Phase 1 — the round, without dialogue.** Words handed over, he composes, one call judges,
SRS and level credited (collateral words included), next words handed over. Three rounds,
no back-and-forth. This is the whole of the scoring design and most of the value, and it
proves the judge before any conversational machinery is added.

The call returns the full schema above from the start — Phase 1 simply shows `say` as the
coach's one reaction and does not append a follow-up card for him to answer. So Phase 2
changes the session loop, not the prompt or the contract, and Phase 1 is not a throwaway
shape to be unpicked.

**Phase 2 — the coach answers.** The exchange loop: `say`, the growing session (as the live
conversation already does — `learnSession.cards` appends and `learnAdvance` ends on
`s.i >= s.cards.length`), the exchange cap, and the coach deciding when to move on.

**Phase 3 — good sentences join the bank.** The banking rule above.

## Testing

The parts with arithmetic or branching, driven with plain objects:

1. **Collateral crediting credits and never penalises** — a `used` list with one correct
   and one incorrect word writes exactly one `srsAnswer` at grade 2, and nothing for the
   other. The most important test here: it is the rule that protects the scheduler.
2. **The banking gate** — refuses `ok: "wrong"`, refuses `lvl` below `learnerLevel()`,
   refuses a sentence containing a word not in the library, and banks `fix` rather than
   `he` when both are present.
3. **The round/exchange counter** — the cap is respected, `give` starts a new round, and
   three rounds ends the session.
4. **A malformed or missing reply is survivable** — no `used`, no `lvl`, `done` absent: the
   turn is a no-op rather than a throw, matching `convoLiveNormalise`'s existing contract.

## The risk to watch

**Speech recognition has nothing to anchor to.** `learnAdjudicate` rescues a mangled
transcript by telling the model what he was *supposed* to say and asking whether the
transcript is consistent with it. On a compose card there is no expected list, so that
rescue is unavailable, and the coach may end up replying to a sentence he never said —
which is more disorienting than being marked wrong.

Partly mitigated by showing the transcript before it is sent, with the mic re-runnable.
Not eliminated. This is the first thing to watch on a real run, and if it bites, typing
through the pad's translit→Hebrew path is the fallback worth considering — it already does
lookup and unknown-word ingestion.

Worth noting the standing evidence: five `learnAdjudicate` calls captured across two flags
all returned `{"said":[]}`, so the rescue may be doing less than assumed even where it
does apply. George's open flag asks for that to be counted properly; it is not this spec's
job, but it bears on how much is being given up here.

## Deferred, with reasons

**Composing three sentences and reviewing them at the end.** The original design, and it
had real advantages: latency hidden entirely behind human composition time, roughly one
call a minute, and a review that could see patterns across all three. George rejected it on
a stronger ground — *"I owuld have forgotten what the first sentence was by then"* —
and feedback arriving after the moment has passed is worth less than feedback that is
merely slower.

**Making it a gate.** The node already gates on SRS strength alone. A second gate adds a
place to be stuck for no pedagogical gain, and forces the mode to work offline.

**A composite score, and an exercise-type bonus on `srsGain`.** Argued above.

**Part-of-speech-constrained word pairing.** Replaced by letting the coach choose, which is
free and better informed.

**A crude offline scorer.** Argued above.

**Alternating the two API keys per call.** Latency is now visible — three or four calls per
round, three rounds, perhaps 2.4 calls/minute against a 5/min limit, which is under it but
could burst. The key loop in `geminiSend` is outermost, so a throttled model sleeps on key
1 while key 2 sits idle, and fixing that would roughly double burst headroom. Deliberately
not done yet: George's own call — *"we will see what the latency is like when its in
practice"* — and it should be sized against measured behaviour rather than a prediction.

**Compose in the daily session.** Node-only to begin with, where the word pool is small and
thematic. Whether it belongs in `learnBuild` is a question for after it has been used.

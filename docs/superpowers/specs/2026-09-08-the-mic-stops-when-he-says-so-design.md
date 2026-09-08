# The mic stops when he says so

## Where this came from

Three flags raised on 2026-09-08, within 40 minutes of each other, in one practice
sitting. All three are the same thing from different angles: the app deciding something
on his behalf that he was in the middle of deciding himself.

**Flag `1788876252673-y3qub`, 14:03** — the coach's mic:

> "There's a bit of a problem. I was just using the coach and I'm trying to speak in
> Hebrew but it's obviously listening for English. I'm not sure if there's anything we
> can do about that but it's quite annoying cuz I said the talking about the red book in
> this instance and I said Adam and as you can see here he just didn't pick it up cuz I
> was using the voice like right now I'm using the voice to tell you this"

**Flag `1788875975076-2ue53`, 13:58** — grading, and the mic ending early:

> "I feel like the app is always giving me nearly when I straight up got it wrong, like
> in this case the last 2 words I did not get, then for some reason it changed at the lat
> second. Can we also change that the lesson doesn't continue when I stop talking I have
> to press the red button to continue please"

and, on the grade buttons, in the follow-up conversation:

> "when I press the word on some excersizes the order is 'got it' 'nearly' 'missed', then
> on other pages its theo other way around. Can we look at this and change it to be
> 'missed' 'nearly' 'Got it' order please"

**Flag `1788873957185-k3xe3`, 13:25** — the "why" button:

> "The 'why is it phrased like that' button has become obsolete I would prefer a 'ask
> coach' button instead that pulls up coach since the automatic info it gave is not what
> I wanted to ask about"

and, on scope:

> "I think the button should just open coach and I ask him a question doesnt need any
> preamble 'why is it like that' is actually usless for a whole sentence, Im usually
> askign about a specific word choice so I would need to specifiy anyway"

## What the evidence actually showed

The second flag's captured context is the useful part, because it contains the whole
failure in one card.

Expected: `אני לא עייף אני רק חושב` — six words.
Transcript: `אני לא עייף אני יותר` — five.
Status as he saw it: `matched, matched, matched, matched, near, near`.

Traced through the code, `alignSpoken` got this **right**. Both `רק` and `חושב` came out
of the alignment as `missed`. The `alts` rescue had nothing to work with (`alts: []`) and
`heSoundAlike` correctly declined (`soundPairs: []`). Then `learnAdjudicate` fired
asynchronously *after the reveal*, asked `gemini-flash-lite-latest` whether he had
probably said them, got `{"said":[4,5]}` back, and silently rewrote both marks while he
was reading the card.

That is exactly his "for some reason it changed at the lat second" — not a figure of
speech, a literal description of the DOM changing under him.

Two things are wrong there, and only one of them is the model's fault:

1. **`חושב` had no evidence anywhere.** Not in the transcript, not in the runners-up, not
   in the sound tiers. The adjudicator's prompt already says *"if the transcript shows
   something that does not sound like it, or shows nothing at all, leave the index out."*
   Flash-lite ignored it, and there is no code-level guard behind the instruction.
   `GEMINI_MODELS_FAST` puts flash-lite first deliberately, so the weakest model in the
   app is the one making this call.

2. **He never finished the sentence.** `micRecGet` sets `r.continuous = false`, so
   Chrome's endpointer decides when he has stopped. He paused to think, it ended the
   attempt, and the last two words were never spoken. The card's own live label already
   reads *"Listening — press Stop when you've finished"*, which is currently untrue.

So the two halves of that flag are one bug seen twice. The endpointer truncated him;
five independent softening layers then treated the truncation as a mishearing, because
**every layer in this area can only soften and nothing can push back**. That asymmetry
was deliberate and well argued — it fixed a real false-negative problem — but with a
truncating mic in front of it, it has overshot.

His own rule, given in the follow-up, is the one this spec implements:

> "If its not there I didnt say it, and with the edit above if its not htere its becuase
> I didnt say it not hte mic stopping early."

That sentence contains the ordering: **fix the mic first, and only then is a missing word
safe to read as evidence.**

### The coach mic

`coachDockListen` hard-codes `lang: "en-GB"`. The comment there is right about the common
case — he asks in English — and wrong about this one. His questions routinely *contain*
Hebrew, which is precisely when the coach is least able to help: he said *adom* (אדום)
and en-GB printed the English name "Adam".

The asset that solves this is already in the file, and is already load-bearing. From
`learnScoreSpoken`:

> "The he-IL recogniser transcribes English perfectly well — the finding that made this
> worth building."

The English-word detector was built on that claim. If it holds, `he-IL` is strictly
better here: it keeps the English and stops destroying the Hebrew.

A second option was considered and dropped on his call — telling the coach in its prompt
that the transcript came from an English recogniser, so it should read English-looking
words as possible transliterations. George: *"if A works C would be redundant right?"* He
is right. It is kept in Deferred as the fallback if `he-IL` turns out to mangle English
in real use, which only his device can settle.

### The "why" button

`learnWhy` is a one-shot canned question: it fires, the answer replaces the button, and
there is no follow-up. On the card he flagged it explained adjective agreement and
*smikhut* — competent, and not what he wanted to ask.

The replacement already exists and needs no new machinery. `coachDockOpen(true)` is
already wired to a button on the compose card, the dock already reads its context from
`uhHere()` / `uhReportFor()` at send time, and it already opens listening. It is the same
thing the nav magnifier does, which is what he asked for: *"same as the button at the
top"*.

## Phase 1 — the mic listens until he stops it

`micListen` gains a `continuous` option. The drill card passes it; the coach dock does
not, because the dock genuinely wants the endpointer — "dash a quick question" is its
whole design, and an unattended end there means he finished talking.

In continuous mode:

- `r.continuous = true`, so Chrome keeps the stream open through pauses.
- An `onend` that **we did not ask for** restarts the recogniser and keeps accumulating,
  rather than resolving. Text already finalised is carried across the restart in a
  prefix, because `e.results` resets with the new session.
- A `no-speech` error does not end the attempt in continuous mode — that error *is* the
  thinking pause he described. Every other error still ends it, because `not-allowed` and
  `network` are not going to fix themselves on a retry.
- Two backstops, so a forgotten mic can never hold the device open: a wall-clock cap
  (`MIC_HOLD_MAX_MS`, 90s) and a restart cap. Hitting either resolves normally with
  whatever was heard, exactly as an endpointer end does today.

`micStop()` sets the intent flag before calling `stop()`, so the restart logic can tell
his press from the endpointer.

The card's existing label — "Listening — press Stop when you've finished" — becomes true
rather than aspirational. No new UI.

## Phase 2 — a word that is not there was not said

`alignSpoken` already distinguishes two kinds of miss in its traceback and then throws
the distinction away, marking both `missed`:

- a **substitution** — a said word was consumed at that position (`יותר` for `רק`);
- a **deletion** — no said word aligned there at all (`חושב`).

It now returns a parallel `gap[]` array recording which. `learnScoreSpoken` carries it
onto `learnSpoken`.

`learnAdjudicateWanted` then **never asks about a gap index**, and `learnAdjudicate`
refuses to soften one even if the model volunteers it anyway. That is his rule stated in
code: if nothing in the top transcript *or* any runner-up put a word at that position,
the app does not get to decide he probably said it.

Note what this deliberately leaves alone. The `alts` and `heSoundAlike` rescues run
*before* this and can still clear a gap index — a word absent from the top transcript but
present in a runner-up is real evidence, and that is the homophone case (`אטי` / `איתי`)
the whole layer was built for. By the time the adjudicator runs, any surviving gap has
already failed every local test. The rescue keeps its designed purpose and loses only the
case where it had nothing at all to go on.

Substitutions are still adjudicated. Phase 3 is what makes that safe to keep.

## Phase 3 — a late rescue says so

When `learnAdjudicate` softens a mark it currently mutates `spoken.status[i]` and
repaints. It now also writes a line on the card, in the same place and register as the
existing `.lmicsoft` note:

> "The mic may have missed רק — softened to Nearly."

This is not decoration. A silent mutation is what produced "for some reason it changed at
the lat second", and it is also why an over-generous rescue has been invisible for as
long as it has. Making it legible costs one line and turns the substitution path — which
Phase 2 deliberately keeps — into something he can see and argue with.

The existing "That's not what I meant" affordance (`learnAmendRender`) already handles
the arguing, so nothing new is needed for that.

## Phase 4 — the grade buttons read the same way everywhere

Whole-card grading renders **Missed, Nearly, Got it**. The tapped-word panel renders
**Got it, Nearly, Missed**, on a comment arguing that "Got it" belongs first because it
undoes a mis-tap.

That argument is defensible in isolation and wrong in context — the two rows sit a tap
apart on the same card, and he hits both in the same session. The panel is reordered to
match the card.

**This is a display change only.** The two rows use different encodings and that must
survive untouched: whole-card grades are `0 Missed / 1 Nearly / 2 Got it`, while
`learnMarks` uses `0 Got it / 1 Missed / 2 Nearly` — an encoding `learnAdjudicate`
depends on when it moves a mark from `1` to `2`. Only the array order changes; every
label stays bound to the value it already had.

It also lands the right way round on the style guide's rule that gold means "you did
this": the card's order already ends on gold, and the panel now agrees.

## Phase 5 — the button opens the coach

`learnWhy` and its button are deleted. In their place, on the same cards under the same
condition, a link button reading **"Ask the coach"** that calls `coachDockOpen(true)` —
identical to the compose card's existing handoff and to the nav magnifier.

No preamble and no seeded question, on his instruction: *"doesnt need any preamble"*. The
dock captures the card context itself when he sends.

**The sweep he asked for.** Two other buttons match the pattern:

- **"Why is it this word?"** in the tapped-word panel (`learnExplainWord`). Structurally
  the same one-shot, but it is **kept**, because it is not the thing he complained about
  and it does a second job: it writes `tr`/`en`/`why` back through `learnSaveGloss`, so
  the panel is permanently richer afterwards. It is also already specific to one word,
  which is the exact objection he raised against the sentence-level one. An "Ask the
  coach" button is added *alongside* the explanation instead, so a follow-up is possible
  where he says he actually has one: *"Im usually askign about a specific word choice"*.
- **"Explain this"** on the sentence pad (`padAskExplain`). Left alone — different
  surface, different job. See Deferred.

## Deferred, with reasons

- **Telling the coach its transcript came from an English recogniser.** Redundant if
  Phase 1's `he-IL` switch works, on George's own reading. Held as the fallback if
  `he-IL` degrades his English in practice; only his Pixel can settle that.
- **A per-call language toggle on the dock mic.** More UI, and it makes him decide
  mid-flow which language he is about to use — which is the thing the dock exists to
  avoid.
- **Racing two recognisers, one per language.** Not possible: there is one
  `micRecInstance` by design and `micRecBusy` locks it.
- **A code-level sanity check on the adjudicator's whole answer** (e.g. rejecting a reply
  that rescues every index it was asked about). Heuristic, and Phase 2 removes the case
  that actually bit. Revisit only if Phase 3 shows the substitution path still over-soft.
- **A stronger model for the adjudicator.** It is on the fast pool deliberately —
  `AI_POOL_CAPS.fast` is 500/day against strong's 20, and this call can fire on every
  imperfect card. Phase 2 is a guard that costs nothing per call, which is the better
  trade.
- **A "no, I got that wrong" tap that hardens a mark back.** Phase 3 makes the softening
  visible first. Whether hardening is needed is a question the visible version can
  actually answer; building both at once would be guessing.
- **`padAskExplain` on the sentence pad.** The pad is decoding a transcript, not
  practising a card; the coach dock's context is drill context. Converting it would
  change what the pad is for, which is not what the flag asked.

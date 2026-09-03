# The coach you can ask

## Where this came from

George, opening a wider conversation about the coach:

> I really like the Coach aspect of the nodes. I think hte ways its responsive, it gives
> something back, its dynamic is exactly the type of learning/ scafholding enviroment that
> I want to develop more of in the app.

That conversation began as a much larger one — a home base, a hot air balloon following the
path, the map zoomed out onto a table in a room, the whole visual atmosphere reworked. He
shelved it himself:

> The desk idea may have been too far fetched Im jsut tryingto think of some unifying
> principle that can bring in the stats page, the words page into a more unified view, but
> the way it is might also be hte best way to go about it. and it can fall to the bottom of
> the list for now

What he kept is this spec:

> I want it to be a more dynamic "chat" like option, not a generic prompt that is set,
> somehting that I can type and interact with, somehting that I can click on and go "why is
> this happening" or " why is it using this word and not this other one, and whats the
> difference" and it will give me a dynamic and responsive responce. This doesnt have to be
> with the best mode a lite call would do, it jsut needs to have hte page info, whic his
> already similar to the flag feature ... I think this gives me that, the coach is always
> with me, without it meaning nothing effect.

On the thread, asked what should happen to a conversation as he moves around the app:

> I would like 1 thread that follows, but more jsut for my viewing, it doesnt need to be
> resubmitted to the current chat every time, if it was a conversation from a different
> thread it goes to a lighter/ faded colour, then after the app is closed and opened it
> resets dont want a crazy long conversation. Maybe after like 30 mins or sum whatever is
> easier. But hte thread, so that instance of coach should be returned for context to the
> API each time so I can ask follow ups, but previous threads shoould be stored so I can
> read and copy information for anew prompt for instance.

On the model, unprompted and decisive:

> I think we only use the cheap model for this. Its asking a question I would genuinely
> rather use multiple cheap than a expensive here and save the expensive for hte coach
> sentence sessions where they earn their keep. Telling me why a word was chosen or a small
> thing isnt a big deal so just use the cehaper models and use multiple calls to verify it.

And on where the coach should be — the distinction the whole design turned on:

> I want the coach to be there, but I want him to have came to me with the answer not me
> request it. For instance on the tab that sits at the bottom of hte screen already by
> default where I can selec to do a 5 or 15 card session there should be a blue box (the
> coaches blue from end screens) that tells me the forecast/ whats to come. Similarly on the
> node sheet, there should be a what do I need to do to get to gold. This should include
> like, how much further on each word before I max this node out, be useful and informative.
> So I want to be able to ask the coach about what I am doing at all times, I also want him
> to be useful where it is needed wothit me asking

## What the code actually said

**The askable coach already exists, and it is better built than the conversation assumed.**
`uhAsk` (with `uhAskParts`, `uhSourceText`, `uhSourceOf`, `uhRulesOn`) fetches the app's own
source out of the service worker cache, extracts the exact function bodies of whichever
rules the panel currently on screen actually invoked — walked out of the report by
`uhRulesOn`, not guessed — appends the constants those rules read from `UH_RULE_CONSTS`, and
sends that with the panel's state. Offline, free, and grounded in the function that made the
decision. **The plumbing he described as needed is already there.**

What is missing is precisely the five things that make it not feel like what he described:

1. **It is one-shot.** `uhAnswer` is a single `{q, a, err, busy}` and it is set to `null` in
   `uhGo`, `uhBackOne`, `uhJump` and the `popstate` handler. There is no thread, so his own
   example — *"why is it using this word and not this other one, and whats the difference"* —
   is the one question shape it cannot take, because it is a follow-up.
2. **It is not the coach.** Its prompt is a code explainer instructed *"Do not suggest edits
   to the app"*. The coach's voice lives in `learnCoachPrompt` and `composePrompt` — "a warm,
   brisk Hebrew coach". `learnCoachNote`'s own comment is emphatic that there is to be
   **one voice in this app, not a second one wearing the same name**, and right now there
   are two.
3. **You have to go to it**, through a magnifier, into a modal that covers the app.
4. **Every subject in the registry is retrospective.** `UH.session`, `UH.card`, `UH.node`,
   `UH.word`, `UH.campaign`, `UH.content`, `UH.raw` — all current or past state. Nothing can
   answer *what is coming*, because no report describes it. This is the one genuinely new
   thing in this spec.
5. **It runs on the strong pool.** `uhAsk` passes `null` models, and carries a comment
   arguing for it: *"this is reasoning about code, and the weaker model would be a false
   economy against a cap of 20 a day that real use never approaches."*

**That comment is now wrong, and this spec deliberately reverses it.** It was written when
this was a rare debug question. It stops holding the moment the thing becomes what he pokes
all day. `AI_POOL_CAPS` is `{ strong: 20, fast: 500 }` — 25x — and `GEMINI_MODELS_FAST` is
lite-first with `gemini-flash-latest` as its own fallback, so a lite failure already
escalates with no new code. Recorded here so a later reader does not "fix" it back.

**There is no coach blue.** `.lcoach` is `font-family: var(--display)` with
`border-left: 2px solid var(--gold-soft)` — the world's serif and a soft gold rule, no colour
of its own. The teal box he may be remembering is `.lheard`, which is what the recogniser
heard him say. Every comment on the coach's styling says the same thing: *"the coach's voice,
so the world's serif rather than the interface sans — this is a person talking to him, not
the app reporting."* The coach's identity in this app is **typographic, not chromatic**, and
that is kept — see "The coach's mark" below.

**Gold is exactly computable, and half of it is a true countdown.**
`campNodeDone = campNodeWordsReady(n, srs) && campCoachMastered(n)`:

- `campNodeWordsReady` — every non-`STOPLIST` **own** word at production band `progressing`
  or `strong` (`wordReady`). Carry words excluded on purpose.
- `campCoachMastered` — every non-`STOPLIST` own word present in `coachLandedAll()`, said
  live and correctly at some point. Short-circuits to `true` for a `campNodeAuto` node.

So "what do I need to get to gold" is two lists, both free, both offline, and the second is an
**exact** count. The first is not a countdown and must not pretend to be — a band comes from
stability, difficulty and recent miss rate, not an answer tally. What can be said truthfully
is already computed: `whySrsStrength` returns `{ rule, verdict, because: [{test, actual,
pass}], next }`, and `next` is a plain-English sentence about what would actually move it.
Style guide §4 — *a metric must never contradict its own caption* — is the reason this
distinction is drawn rather than smoothed over.

**The node sheet already carries a weaker version of this box.** `campOpenNode` ends with a
`pp-gate` line: *"N words still to say live with the coach for gold."* It is right as far as
it goes and says nothing about the words that are not ready. It is replaced, not joined.

## The design

### One coach, two modes, one voice

**Asked** — the nav control (which absorbs the magnifier) and a long-press on the drill card.
Opens pointed at whatever he is looking at; `uhHere()` already resolves this correctly
(current card, else the open node sheet, else the campaign).

**Unasked** — the coach speaks first in two places: the forecast on the action card, and what
stands between him and gold on the node sheet.

Same voice, same thread, same store. The only difference is who spoke first.

### The thread

One transcript. The **live thread is one sitting**, and a sitting ends two ways:

- **On app open.** The live thread is archived at load, before anything renders.
- **After `COACH_IDLE_MS` (30 minutes).** Checked when he asks, not on a timer.

Both, because both are trivial and he asked for "whatever is easier". Within a sitting,
moving between card, word and node **does not cut the thread** — the coach is told the
subject changed and carries on. That is what makes the follow-up he described work.

```js
const COACH_KEY        = "hvr_coach";
const COACH_IDLE_MS    = 30 * 60 * 1000;
const COACH_TURN_MAX   = 24;   // backstop within one sitting
const COACH_PAST_MAX   = 6;    // sittings kept
const COACH_RENDER_MAX = 20;   // turns drawn, newest kept
```

Store shape, persisted continuously so a hard close loses nothing:

```js
{ live: [ { q, a, err, subject, ts } ], liveAt: 0, past: [ [ ...turns ], ... ] }
```

**Only the live thread is resubmitted.** Past sittings render above it **faded** — readable
and copyable, never sent. And within the live thread, **only the current subject's report is
sent in full**; past subjects contribute their question-and-answer text only. So a sitting
that walks six words is one report plus twelve short exchanges, not six reports.

### What it runs on, and how it is kept honest

`GEMINI_MODELS_FAST`, per his call. No verify pass — and that omission is deliberate, because
a second lite call checking the first is exactly the pattern
`2026-09-03-the-judge-was-weaker-than-the-writer-design.md` identified as the bug: *"The
judge is weaker than the writer."* Two models of the same weight on the same fragment share
their failure modes and agree confidently when both are wrong.

His instinct to go cheap is nonetheless right here, and for a reason worth naming: that spec
is about **Hebrew naturalness**, a knowledge task where model strength buys real accuracy.
This is a **reading task** — the numbers and the source of the deciding function are both in
the prompt. Lite is good at quoting what it was handed.

So the guard is **mechanical, not a second opinion**:

```js
coachUncited(answer, payload) -> [ "8.3", ... ]
```

Every numeric literal in the answer that does not appear anywhere in what was sent. Pure,
and therefore testable without a call. Deliberately a **substring** check and deliberately
**high-precision, low-recall**: small integers he might be counting with ("2 words left")
appear in the payload almost always, so what this actually catches is a distinctive invented
figure — a threshold, a stability, a difficulty — which is the failure that matters.

On a non-empty result: **one** retry, naming the offending figures. If the retry is also
uncited, the answer still renders, with a quiet line saying some figures in it are not in
what the app gave it. It never costs him the answer — the evidence is on the same screen
underneath, which is the existing design's own argument for why showing a model's reading of
a fragment is safe at all.

This is the same move `composeCredit` already makes and the reason it is safe: **the app
derives, the model only points.**

### The coach's mark

Not a new colour. `.lcoach`'s treatment — the display serif, a soft rule, quiet ground —
becomes the coach's mark everywhere he speaks, including the two unasked boxes.

The argument against the blue he asked for is style guide §3, where colour has jobs: gold
means *you did this*, teal means *you can act on this*. A forecast box in gold claims credit
for something not yet done; in teal it becomes another button. The serif already says "a
person is talking" and does something a colour cannot — **it reads correctly on paper and in
a panel alike**, so the coach is one person on the map and on the node sheet without either
register borrowing the other's clothes. The container changes; the voice does not.

### The two unasked boxes

Both **render completely without AI**. The computed facts are the content; the coach's
sentence is a layer over them that fills in or does not. This is exactly the
`learnRenderFacts` / `learnCoachNote` split already proven on the end screen, and it is what
makes both boxes work offline and on a dead key.

Both **cache against their own facts** — the line is generated once per fact-set, not per
glance. Ten app opens is one call. That also stops the coach having a new personality every
time he looks at it, which is its own kind of wrong.

**The node sheet — what stands between him and gold.** A pure function:

```js
campGoldPlan(node, srs, landed) ->
  { gold, auto, need, ready, landedN, notReady: [{ key, band, next }], toLand: [key] }
```

`notReady` carries `whySrsStrength(...).next` per word — the honest "what would move this"
rather than a fabricated countdown. `toLand` is the exact list, and its count is the true
countdown. Replaces the `pp-gate` line.

**The action card — the forecast.** A new registry subject, `UH.forecast`, built from facts
the app already computes: `srsDueCount`, the words `learnTargets` would actually choose,
servable sentence count, nodes one word from gold via `campGoldPlan`, and `contentThinNow`.
It is a real report in its own right — readable in the panel, answerable by the coach — and
the box on the action card renders from the same function.

## Phases

Each stands alone and can be reverted alone.

**Phase 1 — the thread.** `uhAsk` becomes a conversation on the fast pool, with the store,
the archiving, the faded past, the citation check and its one retry. The nav control absorbs
the magnifier. The largest change and the one everything else hangs off.

**Phase 2 — the gold box.** `campGoldPlan` and the node sheet. Pure computation; ships and is
useful with no AI at all.

**Phase 3 — `UH.forecast`.** The report, and its link from the root.

**Phase 4 — the forecast box** on the action card, with the coach's cached line over it.

**Phase 5 — the drill card.** A long-press on the card opens the coach pointed at it, with a
one-time hint. Deliberately last and deliberately a gesture: style guide §4 records that this
card lost a glyph, a label and a direction pill to *one signal, not four weak ones*, and a
sixth control on it would be re-adding what that argument removed. The coach is already one
nav tap away mid-card, so what this buys is reach, not access.

## Testing

Driven with plain objects, per the suite's standing rule about localStorage isolation. Tests
that must touch a real store restore it in a `finally`.

1. **`coachUncited` catches an invented figure and not a counted one** — an answer quoting
   `6.5` against a payload containing it returns empty; one quoting `8.3` returns it. The
   behavioural heart of the guard.
2. **A sitting ends on idle and on load** — a store whose `liveAt` is older than
   `COACH_IDLE_MS` archives before the next turn is appended; a fresh load archives a
   non-empty `live` regardless of age.
3. **Only the live thread is sent** — the prompt built from a store with past sittings
   contains the live turns and not the archived ones.
4. **One report, not six** — a live thread spanning three subjects sends the current
   subject's report and the earlier subjects' text only.
5. **`campGoldPlan` is exact about landings and honest about bands** — a node with four of
   six words landed returns `toLand` of exactly the two, and a not-ready word carries
   `whySrsStrength`'s own `next` rather than a count.
6. **`campGoldPlan` respects the auto pass** — a `campNodeAuto` node reports `gold` without
   requiring landings, matching `campCoachMastered`.
7. **The forecast report survives an empty app** — no library, no campaign, no schedule
   yields a report rather than a throw.
8. **The turn cap holds** — a sitting at `COACH_TURN_MAX` stops growing.

## Deferred, with reasons

**The desk, the room, and the visual atmosphere rework.** His own call, quoted above. The
unifying principle he was reaching for is real and this spec does not deliver it — it
delivers the coach that would live in that room. Worth returning to with the coach already
built, because by then what the room needs to hold will be known rather than guessed.

**A coach mark or logo on every surface.** Considered and rejected under style guide §4:
a mark on every panel advertises a unification instead of delivering one. The serif does the
work, and the nav control is the one place a mark is earned.

**Folding in the AI star and the flag.** The star is a log — "did the call fire, did it
fail" — and it is how the coach itself gets diagnosed when the coach is what is broken. The
flag goes to me, not to the model. Both are different jobs wearing a similar shape, and
absorbing them would cost the one feedback channel that works.

**Grammar and tense objectives on the compose checklist.** Still deferred, still for the
reason the 2026-09-02 spec gave: a word objective is verified from his own transcript, a
grammar objective can only be ticked on the model's say-so.

**The naming collision.** The node sheet's compose button is called *The coach*, and so now is
the app-wide one. Left alone in this spec rather than renamed halfway: renaming the compose
entry point is a one-line change worth making deliberately, with him, once he has used both
and can say which one deserves the name.

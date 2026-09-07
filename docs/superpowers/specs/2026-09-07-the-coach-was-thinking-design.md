# The coach was thinking when nobody asked it to

## Where this came from

George, mid-flag, at the end of a coach lesson on 2026-09-07 (`lEnd`, node
`c2-0-1qt5` "Family & home"):

> "Okay so on that lesson the loading times were like 9+s for each call. That
> ain't it. Maybe we should switch the models used to flashlite for the first
> call to get a quick response then the evaluation is with rh stronger model?"

And, on how to settle it:

> "Measure first, decide after."

And on the budget:

> "Run the split arm, but only on flashlite. Ive somehow used 13 or 20 for flash
> on this API key."

## The answer

**`gemini-flash-latest` rejects the thinking control this app has been sending
it, and has been falling back to unbounded thinking on every call.**

`GEMINI_THINKING` was `{ thinkingConfig: { thinkingLevel: "minimal" } }`. Measured
against the live API on 2026-09-07:

```
gemini-flash-latest       thinkingLevel "minimal"  ->  HTTP 400
                          "Thinking level MINIMAL is not supported for this model."
gemini-flash-lite-latest  thinkingLevel "minimal"  ->  200, 0 thinking tokens
```

`geminiSend` walks `for (const cfg of [GEMINI_THINKING, null])` and consumes the
400 with `if (resp.status === 400 && cfg) continue;`. So every Flash call was
**two round trips**, and the second carried no thinking control at all — Flash ran
at its default reasoning budget on the one path George sits and waits for.

The fallback worked exactly as designed. That was the problem: it is silent, so a
permanently degraded path looked identical to a slow model, for weeks.

## Measured

Driven through the app's own `composePrompt` in a local instance, against the
turn from the flag (`כן השולחן יותר נוח מהמיטה`, node `c2-0-1qt5`, level 3).
The reconstructed prompt was verified byte-identical to the request the app really
sent, against the 400 characters `FLAG_AI_PREVIEW` had kept.

| | ms | thinking tokens |
|---|---|---|
| **App as shipped, Flash** | **4,506** (from the flag's own log) | unbounded |
| Flash + `thinkingBudget: 0` | **1,116** | 0 |
| Lite + `minimal` (the app's Lite path) | 1,339 | 0 |
| Flash + `thinkingLevel: "low"` | 1,800 | 0 |

Flash with a control it accepts is **faster than Lite** — so the tier inversion
the flag proposed is unnecessary, and so is splitting the call.

## What was wrong with my first hypothesis

I proposed that the cost was output serialisation: the schema asks for ten fields,
and on a clean turn the whole `best` block is generated and rendered nowhere,
because `learnRenderCard` only prints it when it matches `fix`. Three reps each on
Lite:

| arm | median |
|---|---|
| baseline | 1,092 ms |
| `best` removed | 1,195 ms |
| `say` declared first | 1,095 ms |

**No measurable difference.** The dead `best` field is still waste and still worth
removing on its own merits, but it was not the latency, and shipping that change
would have "fixed" the problem by touching something unrelated to it.

Streaming is real but second-order: `say.he` complete at 698–803 ms against
906–982 ms for the full JSON.

## Why it took an API key to find

It should not have. The app already computed the evidence and discarded it —
`lastGeminiTiming` carried `thinking: !!cfg`, which was `false` on every single
Flash call, and that variable never reached `aiLogNote`. The 400 was swallowed by
`continue` with nothing logged at all. `usageMetadata.thoughtsTokenCount` was
returned by every response and read past.

So the same fix carries the instrumentation that would have surfaced it:

- `think` — which control actually won (`low`, `minimal`, `budget0`, `default`).
- `thoughtTok` / `outTok` / `inTok` — off `usageMetadata`.
- `skipped` — what the model refused, which was previously invisible.

All four ride the flag through `flagContext`, and `skipped` renders at the top
level of the under-the-hood log in the error colour, on a row that otherwise reads
as a success. A refused control is a finding, not a detail.

## The change

**`thinkingChain(model)` replaces the `GEMINI_THINKING` constant.** Per-model,
ordered best-first, ending in the bare request:

- Flash: `low` → `budget 0` → bare
- Lite: `minimal` → `budget 0` → bare

`low` rather than `budget 0` for Flash, despite `budget 0` measuring faster on a
single sample. Both produced 0 thinking tokens on the coach turn, so on that prompt
they are the same request — but `budget 0` forecloses reasoning outright, and this
model both judges George's Hebrew and writes the Hebrew he imitates. `low` spends
nothing when nothing is needed and can still think on a turn that earns it.

The bare request stays last and stays reachable. It is the churn escape hatch, and
churn is not hypothetical here: the note this constant used to carry said
`thinkingBudget: 0` was "rejected outright by 3.x" and `minimal` was the answer.
Both halves of that have now inverted for one of the two models. A list that can be
extended is the shape this wants; one constant is what let it rot.

## Tests

- `thinkingChain: each model is offered a control it will actually accept` —
  asserts Flash is never offered `minimal` (rather than that it *is* offered `low`,
  which would pass on a chain offering both), that the bare request is last and
  appears exactly once, and that a real control precedes it.
- `geminiSend: a refused thinking control is recorded, not silently swallowed` —
  a 400 on the first config must leave a record, the winning control must be named,
  thinking tokens must come off `usageMetadata`, and a clean call must leave
  `lastThinkingSkips` empty so a stale entry cannot report a bug that did not happen.

Verified by mutation: reverting `thinkingChain` to the old single-config behaviour
takes the suite from 741/741 to 740/741, failing on the first of those.

## Deferred, with reasons

- **The 10-second tail.** One Lite call in fifteen took 10,301 ms, with 9,915 of it
  before the first token — a server-side stall, not generation. Flash returned a 503
  "high demand" on one of four attempts. Some of George's 9 s is Google having a bad
  moment, and the app shows an undifferentiated "…" throughout. Worth a progressive
  indicator; not this change.
- **Streaming.** Worth roughly 200–300 ms on `say.he` and a much better felt
  experience, but it is a rewrite of how `composeAdvance` receives a turn. After
  this lands and the real numbers are back.
- **Dropping `best` from the schema.** Measured as not a latency fix. It is still a
  field generated and shown to nobody on clean turns, so it should go — on
  correctness grounds, in its own change.
- **The transliteration scheme.** Both models returned `ha-shulchan`,
  `ve-ha-shulchan he-hadash shelkha`, `no'ach`, `me-ha-mita`. CLAUDE.md's scheme is
  `kh`, article joined, no hyphen: `hashulkhan`, `no'akh`, `mehamita`.
  `composePrompt` never states the scheme at all, so the coach has been teaching a
  second spelling to the one person who reads the transliteration to speak from.
  Real bug, adjacent, and not a latency one.
- **`formsAsk`'s comment claimed "full thinking on purpose"** and never had it —
  `geminiSend` applies its config to every caller and there has never been a
  per-call-site opt-out. Comment corrected to say what is true; the behaviour left
  alone, because "morphology is where reasoning pays" is a claim to measure, not to
  fix in passing.
- **No standalone harness.** One was specced and half-built before George said
  "just use the origional app dont need to build a whole thing". He was right: the
  app's own `composePrompt` in a local instance is both less code and better
  evidence, since it cannot drift from what ships.

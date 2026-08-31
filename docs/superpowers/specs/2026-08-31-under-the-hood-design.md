# Under the hood — a way to ask the app why

## Where this came from

George, after an episode where a node's sentences existed but would not serve, and it
took three round trips to work out why:

> "maybe for each node a small bug icon when I open them so I can view the 'backend' of
> the content"

Then, thinking about it further:

> "looking into this debugging approach I think its somehting I want ot incorporate more
> generally accross the app. The AI icon nad hte flags are genuinely some of hte most
> impactful features in the app. So if htere was a more universal debugging feature that
> let me extract specific peices of information, identify exactly what I wanted chaning i
> feel our conversations could be more productive and issues easier to diagnose when they
> arent clear. I want the information, if its in the code/ underground I want a way to
> view it (not all the time, but an option to see why somehting is behaving a certain
> way, Be that word strength, data or any other variable)"

And, deciding what the feature is actually for:

> "this could be a really cool and useful feature for me to better understand how the app
> is working ot better tune it to my vision"

That last line is what this is designed against. It is not only a bug-reporting tool.
The app makes a few hundred judgements a day — this word is weak, that sentence cannot
be served, this node is not ready — and every one of them is currently invisible. A
person cannot tune what they cannot see.

## What already exists, and why this is not a rewrite

`flagContext()` is already three quarters of the plumbing, and the design leans on it
rather than around it. On every flag it silently captures the current view, the screen,
the card kind and its Hebrew, `n of total`, the prod/recv SRS band of every word on the
card, session position, the node and its words, content status (`claudeItems`, `thin`,
version seen), and the last few AI calls with request and response previews. It renders
in the flag modal as `JSON.stringify(ctx, null, 1)`.

Three things are missing from it, and they are the whole feature:

1. **It only fires when a flag is raised.** There is no way to simply look.
2. **It is fixed to the card in front of you.** It cannot be pointed at a word, a node,
   a bank item or the scheduler.
3. **It answers "what", never "why".** `דירה (2/1)` reports the band. It does not say
   which threshold decided it, how far off the next band is, or what would move it.

The third is the one that cost the three round trips, and it is the one this spec is
mostly about.

## Shape: one nav control, drilling down

Rejected: a bug glyph on each surface. It reads as less work and is more — the expensive
part of this feature is the reports, which both approaches need identically, and the
glyph approach then additionally needs wiring into the node sheet, every library word
row, the drill card, the compose card, the conversation card and the session summary,
each with a tap target that does not fight an existing tap. The routing that makes one
control sufficient already exists inside `flagContext()`.

So: a third `.navstar` beside the flag and the AI star, in the interface register
(style guide §1 — flat, sans, teal, no emoji), with a magnifier glyph. It opens
**already pointed at whatever is in front of you**.

George: *"A definitly but make sure it easily navigatable"* — hence §"Navigation" below
being specified in more detail than its size would otherwise justify.

## Phase 1 — the spine: two registries and a shell

### The WHY registry — one function per rule, not per subject

This is what makes the feature affordable. Every judgement the app makes reduces to the
same shape: some conditions, the actual values, the thresholds, a verdict, and what
would change it. So one renderer draws every explanation in the app.

```js
whySrsStrength(rec) → {
  verdict: "progressing",
  because: [
    { test: "stability ≥ 21d",       actual: "12d",           pass: false },
    { test: "difficulty ≤ 5",        actual: "4.1",           pass: true  },
    { test: "recent misses ≤ 0.15",  actual: "0.17 (1 of 6)", pass: false }
  ],
  next: "2 clean answers moves it to strong",
  rule: "srsStrength"            // names the source function, for Phase 5
}
```

Every `why` function is **pure** — it takes the record or the item, never reads a store.
That is what lets the self-test suite drive them with plain objects, per `CLAUDE.md`'s
isolation rule.

Phase 1 ships `whySrsStrength` and `whyWordReady`. `whyBankServable`, `whyNodeState`
and `whyBankDifficulty` follow in Phase 2.

### The INSPECT registry — one function per subject

`inspectWord(key, lib, srs)` and friends return a plain object:

```js
{ title, subtitle, sections: [ { name, rows: [ {label, value, why, to} ] } ] }
```

`why` is a WHY result, rendered as a drillable row. `to` is `{kind, id}` — the subject
tapping the row navigates into. Rows with neither are inert and render without a `›`.

Also pure: state is passed in.

### The shell

One modal, reusing the existing `.modal-backdrop` / `.ailog` furniture rather than
inventing a third panel style. Sticky header, scrolling body, sticky footer.

### Navigation

The rows below are specified because George raised navigability twice, and a
drill-down whose navigation is an afterthought is worse than a flat wall.

- **A stack** of `{kind, id}`. Push on drill-in, pop on back. The breadcrumb is the
  stack rendered.
- **`‹` back is always in the same place** — left of the breadcrumb, in the sticky
  header, thumb-reachable on a phone held one-handed.
- **Every crumb is tappable** as a jump: `Campaign › Family & home › דירה`.
- **`›` on every row that goes deeper, and only those.** The commonest failure of a
  drill-down interface is not knowing what is tappable. Inert rows get no chevron and
  no hover state.
- **Android hardware back steps out one level**, via a `history.pushState` per level and
  a `popstate` listener. No modal in this app does this today; it is worth doing here
  because this is the only one that is ever more than one level deep, and on a phone
  installed to the home screen the hardware back is the reflex.
- **Sections are collapsed by default** except the first. A node opens as four headings,
  not forty lines.
- **Root carries a search box** — Hebrew, transliteration, English gloss or node name,
  matched by the same logic as `renderStrengthList`, jumping straight to that subject.
  This is the "elsewhere" case; it replaces a tab bar in one row.

### Phase 1 subjects

`word` and `rule` only. That proves the spine end to end on the subject George named
first, and a word is the subject with the richest WHY.

## Phase 2 — campaign, node, bank item

The three-round-trip episode, made visible.

- `campaign` — every live node with its state, `have/need`, banked count, servable
  count, and when it last commissioned. A node reading `0 banked · never commissioned`
  is the entire episode in one line.
- `node` — state and why, progress and why, per-word bands each drillable to its rule,
  the carry list, content status, and the last AI call for that node.
- **The blocked-stock breakdown.** `bankServable()` has five distinct early returns.
  The node panel counts items by which one rejected them:
  - nothing but filler
  - a content word is not ready and is not carried
  - more unready words than `maxCarried`
  - two never-met words in one sentence
  - a support word is only progressing where strong is required

  This is George's *"what's blocking each bank item"*, and it is the thing a screenshot
  structurally cannot carry.
- `bankItem` — the sentence, its level, `bankDifficulty` decomposed, per-word bands,
  and whether it is carrying a word and for whom.

## Phase 3 — the card in front of you

`card` and `session` as subjects, so the inspector opens usefully mid-drill: kind, which
side it grades (`KIND_SIDE`), position in the session, the sentence and its level, what
it is carrying, and each content word's band.

Plus the one thing that does not exist anywhere in the app today:

> **If you get it right** — הולך → strong in 2 more · עייף first record
> **If you get it wrong** — הולך → weak (miss rate would reach 0.40)

Computed by running the same band rules against the record as it would be after a
hit and after a miss. The scheduler stops being a black box that can only be argued
with after the fact.

## Phase 4 — content, raw state, and the flag

- `content` — the ingestion pipeline: version seen, version available, last check,
  `claudeItems`, `thin`, and why the last ingest did or did not bank anything.
- **`Raw state ›` at the root** — all `hvr_*` keys, each expandable to its JSON.
  George: *"if its in the code/ underground I want a way to view it … or any other
  variable."* The subjects above are the ones that can be predicted; this is the escape
  hatch for the ones that cannot. It is a generic renderer over the key list, and it is
  the difference between "the things I thought of" and "everything".
- **Copy** — the current level as plain text, to the clipboard.
- **Flag this** — opens the flag modal with the current inspector report already in
  `ctx`, riding the existing straight-to-GitHub flag push. A flag raised from a node
  then carries the node's full report rather than the current card's snapshot.
- **`flagContext()` is rebuilt on the registry.** Today it hand-rolls its own word, node
  and content snapshot; that is two pieces of code answering the same question and they
  will drift. After this phase it composes `inspectHere()` instead.

## Phase 5 — ask it a question

George:

> "what would be cool is to have a feature where if i hada quick questions I could press
> a pop up ask it and it would ping it to the API along with the segment of code. that
> way I can have live answers to the things Im thinking and come to you more informed"

This is better than it was pitched, because **the app can read its own source**. `sw.js`
caches the shell under its own path, so `fetch("./hebrew-reader.html")` is served from
cache — instantly, offline, no network cost. And the WHY registry already names the rule
behind every explanation (`rule: "srsStrength"`), so the payload does not need a guessed
"segment of code": it can extract that function's real body by name.

**`sourceOf(name)`** — fetches the shell once per session, caches the text, and slices
from `^(async )?function <name>(` to the next top-level `function`/`const`. Reliable
because the file is LF throughout and every function in it is declared at column zero
(the same fact `CLAUDE.md`'s duplicate-definition grep relies on).

The question box sits in the sticky footer of every level. Sending it composes:

1. the current inspector report, as text
2. the source of every function named by a `rule` on that level, plus the constants
   they read (`RECENT_STRONG_MAX`, `AI_POOL_CAPS`, …)
3. George's question
4. a system line stating plainly that this is a fragment of a much larger app, that it
   must answer from the code shown and say so when the code shown is not enough

Routed through `geminiRequest` — so it is logged to the AI log like every other call,
with no new bookkeeping — on the **strong** pool (`gemini-flash-latest`). `AI_POOL_CAPS.strong`
is 20/day against real usage in the low single digits, and this is a reasoning task about
code where the weaker model would be a false economy. It is a single interactive call, so
per-minute burst is not a concern, and it takes `FETCH_TIMEOUT_MS`, not `GEN_TIMEOUT_MS`
— George is sitting in front of it.

**The answer is not trusted, and the design says so.** A model handed a fragment will
invent confidently, and George arriving with a wrong theory is worse than arriving with
none. Three mitigations, of which the third is the one that matters:

- the answer renders *beside* the report it was given, not instead of it, so it is
  checkable against the numbers on the same screen
- the call is in the AI log like any other, request and response
- **the Q&A is attached to the flag.** When George does bring it to me, I see the
  question and the answer he was given, and can correct a wrong one in a line instead of
  arguing against a prior I cannot see. The risk becomes a channel.

## Testing

Inspectors and WHY functions are pure, so they test cheaply against plain objects with
no store to restore.

The test that matters is that **the explanations do not lie**. Feed `srsBandRecord("weak")`
into `whySrsStrength` and assert it returns `weak` *and* names the threshold that failed;
same for each band. If `RECENT_STRONG_MAX` is later changed and the explainer is not, that
test fails. An inspector that confidently explains a rule the app no longer follows is
worse than no inspector — it would send both of us down a hole with evidence.

Also asserted: `bankServable`'s blocked-reason attribution agrees with `bankServable`
itself (an item the breakdown calls blocked must actually return false), and the
navigation stack pops to the right subject.

## Deferred, with reasons

- **A bug glyph on each surface.** The nav control's auto-routing covers it, and the
  glyph approach is more work, not less. Revisit only if a real "which one did you mean"
  ambiguity shows up in use — the library word grid is the only plausible candidate, and
  root search already reaches it.
- **Editing state from the inspector.** The Strength modal already does the one edit
  worth having, and the inspector links to it. A debugging tool that mutates what it
  measures is a bad debugging tool.
- **A tab bar.** Root search covers the jump case in a single row, without dividing the
  panel against the context-routing that is the point of it.
- **A live-updating panel.** Snapshot on open, with an explicit refresh. A panel that
  changes underneath you while you read it is harder to reason about and harder to quote
  accurately into a conversation.
- **Sending the whole file to Gemini in Phase 5.** It is over a megabyte. Targeted
  extraction by rule name is both cheaper and better — the answer is grounded in the
  function that actually made the judgement rather than diluted across the whole app.

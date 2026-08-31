# Content written where the context is, rescue written where the moment is

## Where this came from

George, after two commissions in a row banked nothing:

> the reason I went for hte gemini API is that its free and can be automatic and for
> htinks like hte conversation mode and htis teacher and stuff like hte sentence pad and
> translation that seems to be the right call. However for populating hte content in the
> nodes it seems like its too janky, not smart enoguh and too slow for the use case/ Im
> trying to run 3 prompts for one task wehn no one task has the context to understand the
> problem.

> Could it ake more sense to Maybe have the API lay out the plan, in detial for whta it
> wants each node to be using hte existing infastructure, they you (a very smart capable
> Claude Code model) use those templates for those nodes to generate like 15-30 different
> sentences at varying lavels for each node.

> will need some sort of notification in app that says "Time to go to Claude, the plans
> are laid out" the nI can jsut come to a new chat and tell you its time and oyull know
> what to do

And on where the file should live:

> Well Im hte only one accessing hte repo yeah its public but these are simple enough
> entences that I dont htink it matters just do it wherever it makes sense to do it

## The evidence this rests on

Not a preference. From 2026-08-30, in his own AI log:

```
banked nothing — every item failed the vocabulary gate
  10 written, 10 rejected
banked nothing — every item failed the vocabulary gate
  12 written, 12 rejected
Writing practice sentences … ok: true  model: gemini-flash-lite-latest  ms: 137280
```

Two full commissions producing nothing, and a single write taking 137 seconds. The
planner-blindness behind that is fixed (`2026-08-31-a-perfect-session-that-moved-nothing`),
but the shape of the job remains a poor fit: three chained calls, each holding a slice of
the problem, on the weakest model in the pool, under a 5/min limit, against a hard
vocabulary constraint.

## The split, and it is not "Claude instead of Gemini"

The useful axis is **slow-changing vs reactive**, not which model is better.

| work | why it goes there |
|---|---|
| **Node breadth** — 15–30 sentences per node across levels | Slow-changing, wants the whole library in context, and quality compounds. **Claude, batched.** |
| **Rescue** — a sentence for the word he failed *yesterday* | Depends on state that does not exist at generation time. **Cannot be pre-baked. Gemini, on demand.** |
| **Interactive** — conversation, the coach, the pad, transcription | Must be live. **Gemini.** |

The rescue row is the part of George's proposal that needs correcting: pre-generation
cannot know which words will be stuck in three days, so `sentenceCommission` stays exactly
where it is. What changes is that it stops being the *only* source of node material, and
stops being asked to supply breadth it was never good at.

## Why this is better, and it is not mainly writing quality

**The gates can be run before he ever sees the output.** `commissionAcceptable`,
`bankUnknowns`, `bankNearDuplicate` and `bankServable` are functions in `hebrew-reader.html`.
Generated content can be loaded into a browser running the app against his real synced
state and filtered through the app's own code, so the rejection rate is zero by
construction. Gemini writes blind and discovers the rejection afterwards — which is
precisely the failure being replaced.

That is the whole argument. Everything else (a stronger model, the full 270-word library
rather than a 40-word scaffold slice, no per-minute limit, no 45-second timeout) is a
bonus on top of a verification loop that did not previously exist.

## The mechanism

**No new credentials and no export step.** The sync token is read-only, and it does not
need to be anything else:

1. Claude **reads** his live state from `progress.json` in the private sync repo — library,
   SRS, campaign nodes, existing bank. This already works.
2. Claude **writes** `content/nodes.json` into the `hebrew-reader` repo and pushes. The app
   is served from that repo, so the file lands next to it on Pages.
3. The app **fetches its own** `./content/nodes.json` on load and ingests what is new.

Same-origin, no token in the browser, and it rides the deploy that already exists. The
repo is public and George has explicitly accepted that for this content.

### The file

Exactly the shape `learnIngest` already accepts, so there is no second ingestion path:

```json
{ "version": 1,
  "generated": "2026-08-31",
  "items": [ { "he":"", "tr":"", "en":"", "type":"sentence", "lvl":3,
               "gloss":{}, "for":"" } ] }
```

`version` is a monotonic integer. `hvr_content_v` stores the last ingested one; a file at or
below it is not re-read. That is an optimisation, not a correctness mechanism —
`learnIngest` already rejects an exact `he` match and a near-duplicate, so re-ingesting is
harmless, just wasteful over a growing bank.

Items gain `src: "claude"` in the bank. Provenance is worth having: in a month the honest
question is whether this content actually outperforms the commissioned kind, and that
cannot be answered if the two are indistinguishable.

### Telling him it is time

A line on the Learn start screen, and only when it is true — the style guide's *standing
instructions become wallpaper* rule means a permanent "ask Claude" banner would be read
once and never again. It appears when nodes in the live chapter are genuinely short of
servable material, and says which ones, so the message is a fact rather than a nag.

### Commissioning stands down when it is not needed

Without this the jankiness George is complaining about does not actually go away:
`campWarm` fires on every node open, three calls, regardless of how much good material the
node already has. It now skips when the node's servable stock is already ample, and still
runs when the node is genuinely short or has stuck words with nothing written for them.

Rescue is untouched. This only stops the *breadth* commission that pre-baked content has
already satisfied.

## Phases

**Phase 1 — the app ingests a content file.** Fetch, version gate, `learnIngest`, `src`
provenance. Additive and failure-tolerant: no file, bad JSON, or offline is a no-op, never
an error on the start screen.

**Phase 2 — the notice.** `contentThinNodes()` reports live-chapter nodes short of servable
material; the start screen says so when there are any.

**Phase 3 — commissioning stands down.** `campWarm` skips the breadth commission for a node
that already has ample servable stock.

**Phase 4 — the skill.** `generate-node-content`, so "it's time" in a fresh chat is enough.
It encodes: read the sync blob, pick the nodes that are short, generate against the full
library, **verify in-browser through the app's own gates**, optionally run
`learnReviewItems` as a second opinion, bump `version`, push.

## Testing

- The version gate: a file at or below `hvr_content_v` is skipped; above it ingests and
  stores the new number.
- A malformed or missing file is a silent no-op — the start screen must never show an
  error because a static asset was unavailable.
- `src: "claude"` survives into the banked item.
- `contentThinNodes` reports a starved node and stays quiet for a well-stocked one.
- The stand-down predicate: ample stock skips, stuck-word-with-nothing-written does not.

## Deferred, with reasons

**Having Gemini plan the nodes and Claude only write them.** George's original shape. The
planning is the cheap part and the context is the expensive part, so splitting there keeps
the weakness (a planner that cannot see the vocabulary) while adding a handoff. Claude does
both; `campPlan` continues to own *which nodes exist*, which is a different question.

**Deleting the Gemini commission path.** It is the rescue writer and cannot be pre-baked.
It is also the fallback if nobody visits Claude for a fortnight.

**A private home for the content.** Offered and declined.

**Automatic scheduled generation.** A cron that regenerates without him asking would remove
the one moment where a human looks at the output before it reaches the drill. Worth
revisiting once there is evidence the content is reliably good.

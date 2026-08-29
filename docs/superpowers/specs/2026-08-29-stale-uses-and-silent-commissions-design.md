# The node had the sentences all along, and could not see them

## Where this came from

George, flagging mid-session on a Family & home listen card:

> This session I have done contains the exact same sentences and words as before.
> Literally nothing has changed. I saw the API ran but nothing was changed

and, in the same batch of flags:

> I feel like the API key should be constantly preloading new sentences, we should have
> like 2-3 lessons in advance worth of content for each node.

## What his own data actually said

Read out of the synced `progress.json` rather than reasoned about. Two separate faults
were hiding behind one complaint.

**Sessions ran on 26, 27, 28 and 29 August** (`hvr_srslog`). The newest bank item written
by the live pipeline is from **25 August**. Four session-days, nothing banked.

**But the node was never actually empty.** The bank holds nine unseen sentences covering
חדר, דלת, שולחן and מיטה — the node's own stuck words — written 23 August. The node
session cannot see any of them.

### Fault one: `uses` is derived data, cached forever, and the library grows

`learnIngest` computes `uses = bankUses(it.he, lib)` once, at write time, and stores it.
Nothing ever recomputes it. `libKeyFor` resolves a token only if the word is **in the
library**, so a sentence written before its words arrive records them as absent — permanently.

The node's words entered the library on **2026-08-26** with `src: "path"`, which is when
the node was reached. The sentences for them were written **2026-08-23**. So:

| item | stored `uses` | words actually in the text |
|---|---|---|
| `יש חדר אחד` | `["יש","אחד"]` | חדר |
| `השולחן גדול` | `["גדול"]` | שולחן |
| `הדלת אדומה` | `[]` | דלת |
| `המיטה גדולה?` | `[]` | מיטה |

`campBuild` ranks on `hits = uses.filter(isNodeWord).length` and then drops everything
scoring zero, so all nine are filtered out of the node session. The four items that DO
survive are all about דירה — and דירה is the one node word that joined the library on
9 August, *before* the batch was written. That is the whole of "the exact same sentences":
a pool of four, three of them already seen.

Worse, the three items whose `uses` came out completely empty fail `bankPrune`'s
`(it.uses || []).some(u => lib[u])` as well, so they are invisible everywhere in the app,
not merely inside the node.

This is not a one-off. The pipeline writes material for a node ahead of arriving at it —
which is the behaviour George is asking for MORE of — and node words enter the library
only on arrival. Every node is set up to hit this.

### Fault two: a commission that produces nothing says nothing

`sentenceCommission` has four `return 0` paths (no briefs, writer returned nothing, every
draft failed the vocabulary gate, reviewer kept none) and `campWarm` wraps the lot in
`.catch(() => 0)`. All four are silent and indistinguishable from "there was nothing to do".

`hvr_ai_q` reads `strong: 0` for 29 August, but `aiQNote` records only on success or a
429 — a timeout or a 5xx on `gemini-flash-latest` leaves no trace at all, and
`GEN_TIMEOUT_MS` is 45s for exactly the calls involved. `hvr_ailog` is device-local and in
the sync exclusion list, so it is not in what can be fetched. **Which of the four paths is
firing cannot be determined from stored data**, and guessing at a fix without that is how
this file's own history says things go wrong.

## Phase 1 — make `uses` self-healing

`uses` is derived from `he` and `lib`. Treat it as derived rather than stored:

- `bankUsesRefresh(bank, lib)` — pure; returns a new array with every item's `uses`
  recomputed by the existing `bankUses`, plus whether anything changed. Returns new
  objects rather than mutating, so callers and the suite see no surprises.
- `bankPrune` refreshes before it filters. This is the load-bearing half: every read path
  in the app goes through `bankPrune`, so after this no reader can see a stale `uses`,
  and the fault cannot silently return for the next node.
- One repair-and-save at load, so the corrected `uses` is persisted and syncs to his
  phone rather than being recomputed independently on each device.

Deliberately NOT fixed by re-running `libKeyFor` at every call site: `uses` is read in
sixteen places and the point is to have one authority, not sixteen.

## Phase 2 — make a failed commission name its stage

One log line per outcome, through the existing `aiLogNote`, so it appears in the AI star's
log George already reads:

- `sentencePlan` returned no briefs
- the writer returned no items
- N drafted, all N rejected by the vocabulary gate
- N reviewed, none kept

This is instrumentation, not a fix. It converts the next silent failure into a named one,
which is what the fix for fault two has to be built on. Whatever it names can then be
addressed with evidence.

## Testing

`bankUsesRefresh` is pure and gets the test that would have caught this: an item written
against a library that does not yet contain its word, the word then added, and the
assertion that the refreshed `uses` now names it and the item survives `bankPrune`. Driven
with plain objects, no real store — per CLAUDE.md there is no localStorage isolation
between tests.

Verification: suite green, duplicate-function grep clean, and the real check — with his
synced bank and library loaded, the Family & home node's servable pool goes from 4 items
to 13.

## Deferred, with reasons

- **Fixing fault two.** Not deferred out of scope but out of honesty: the failing stage is
  not yet known. Phase 2 is what makes it knowable.
- **Preloading 2-3 lessons ahead per node.** Wanted, and the reason fault one exists at
  all — writing further ahead widens exactly the window where a node's words are not yet
  in the library. Worth doing only once `uses` is self-healing, or it deepens the bug.
- **Whether the Gemini ASR-verification pass earns its call.** Separate flag, separate
  question, and answerable from `hvr_srslog` without touching this code.

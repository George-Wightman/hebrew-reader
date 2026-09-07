# The blob grows with his vocabulary, so compress before storing more

## Where this came from

George, opening the ask:

> "Okay so create a plan of attack for integrating the storage feature and hte
> converation/ recent pages save for flags and your knowledge for helping me."

And, when the ordering of that plan of attack was in question:

> "Is their any way we can increase storage I feel like htis has been an issue
> thats came up before"

That second line settles the first. He is not asking for two independent
features that happen to be requested in the same breath — he is asking whether
there is room to add the second one at all, because storage has already come up
before. It has: the 1MB Contents-API cliff (`2026-09-02`) and `hvr_flags`
carrying 105.6KB of resolved-flag context that `flagSlimForSync` then trimmed
down by 66.2KB (`2026-09-07`, see
`2026-09-07-noticing-when-it-runs-worse-design.md`) were both storage problems
found the hard way. This spec is the plan of attack he asked for, and its answer
to "what comes first" is: shrink what is already there before anything new rides
along with it.

## What "the storage feature" and "the conversation / recent pages save" are

Unpacked, the ask names three things:

1. **The storage feature** — compression. The blob is approaching the point
   where every word he learns costs real headroom, and nothing currently claws
   any of it back except one-time trims.
2. **The conversation save, for flags** — a record of what was actually said in
   a coach session, so a flag raised about a conversation carries the
   conversation, not a timestamp that has to be cross-referenced against
   `content/nodes.json` after the fact.
3. **Recent pages, for flags** — a record of which screens he passed through on
   the way to raising a flag, because the flag itself only ever says where he
   *is*, and the thing he is flagging usually happened a screen or two earlier.

Both (2) and (3) exist to feed "your knowledge for helping me" — they are
inputs to the flag context I already read at the start of every session, not
new user-facing features. That is why they belong in the same plan as
compression rather than beside it: they are new synced payload, arriving right
after the payload that is already 97% of a 1MB ceiling gets a plan to shrink it.

## Measurements, 2026-09-07

**The vocabulary is the thing that grows, and it grows linearly, forever.**

| | words | bytes in `hvr_library` + `hvr_srs` |
|---|---|---|
| today | 544 | ~400 KB (753 B/word) |
| projected | 1,000 | ~736 KB |
| projected | 2,000 | ~1.47 MB |

2,000 words is not a stress case — it is conversational Hebrew, which is the
actual goal of the app. Nothing about that projection assumes anything going
wrong; it is what success looks like, measured.

**Almost all of it is one shape of data.** Inside `hvr_library`:

| field | share |
|---|---|
| `forms` | 40.5% |
| `formsMeta` | 45.6% |
| `tr` / `en` / `cat` | under 6% |

`forms` and `formsMeta` together are 86% of the library, and they are grammar
tables and provenance about those tables — `formsMeta.lemma` repeating the key
the object is already stored under, `forms.sg.he` repeating it again, `state`
almost always the same string (`"verified"`) across thousands of entries. That
is close to the most compressible shape of data there is.

**Which is exactly what gzip found.** Run on the real blob: 1,018,405 bytes raw
to 125,171 bytes gzipped — **8.1×**.

**And three stores are pure overhead.** `hvr_convo` (30.7 KB), `hvr_lastmsg`,
and `hvr_laneorder` have zero references anywhere in `hebrew-reader.html`.
`syncKeys()` is a prefix scan over `hvr_`, so a store outlives the feature that
wrote it and keeps riding every sync until something names it explicitly.
31.6 KB, today, for nothing anything reads.

## Two things this is not

**Not a fix for an imminent crash.** The 1MB Contents-API cliff is already
handled on pull: `syncBlobText` falls through to the Git Data blob endpoint
(100MB ceiling) whenever the Contents API answers `content: ""` — found and
fixed 2026-09-02, recorded in `2026-09-07-noticing-when-it-runs-worse-design.md`.
Reading a blob past 1MB already works. Compression is not about avoiding a read
failure that would otherwise be imminent; it is about the growth *curve* —
`flagSlimForSync` bought back 66.2KB once, worth about ninety words, by
trimming data that already existed. Compression buys back 8× on data that keeps
being created, for as long as he keeps learning words. One is a discount;
the other changes the slope.

**Not a `localStorage` problem.** The device-side store is measured at roughly
785 KB against browsers' typical 5–10MB `localStorage` ceiling — nowhere near
full. Every constraint in this document is about the GitHub sync path: the
Contents API's 1MB inline-read cutoff, and `syncPush`'s `PUT`, whose own limit
is unverified (see below). `localStorage` headroom is not the resource being
spent anywhere in this plan.

## Why compression has to be the first of the three layers

The plan does three things, in a deliberate order: drop the dead keys, then
compress the wire behind a migration, and only then add the two new synced
stores that the conversation-and-trail ask actually wants.

That ordering is not caution for its own sake. A session record and a screen
trail both need a size budget — how many turns, how many conversations, how
many screens — and that budget only means something once it is set against the
space actually available. Designing `SESS_MAX` or `TRAIL_MAX` against a blob at
97% of its cutoff produces numbers chosen to avoid tipping it over. Designing
the same constants against a blob at 16% produces numbers chosen because they
are the right amount of history to keep. The new stores in this plan are sized
the second way, which is only possible if compression has already landed by
the time they are designed. Compression first is not a preference — it is what
makes the rest of this a design decision instead of a rationing exercise.

## The compression design

**An envelope, not raw gzip bytes.** The compressed blob is
`{ app, schema: 2, enc: "gzip", updated, device, body }` — a self-describing
JSON wrapper around a base64 gzip payload, rather than gzip bytes on their own.
Raw would save the second base64 pass, but the file would stop being JSON, and
`blob.app !== "hebrew-reader"` in `syncPull` is the exact check that catches a
token pointed at the wrong repo. Keeping that check alive costs roughly 25% —
167 KB against 1,018 KB is still six times the headroom he has ever used, so
that trade is not close.

**`CompressionStream` / `DecompressionStream`, native, no library.** Both are
available in Chrome 80+ and therefore on his Pixel; a browser without them
writes the old plain-JSON format instead of failing. Compression is not allowed
to cost him a sync — a device that cannot compress still syncs, just at the old
size.

**The migration is gated by two devices, not a version flag in code.** There is
no way to make an old build safely receive a compressed file — a device that
cannot decode the envelope sees `content` it cannot parse, which looks exactly
like a bad token, not like "your app is out of date." The only safe sequencing
is: ship a build that can *read* both formats, wait until every device has
actually loaded it, and only then ship a build that *writes* the new one. George
has exactly two devices, so the gate is a human confirmation — "have you opened
the app on both the Pixel and the laptop" — not a feature flag, because a flag
can't observe what a browser has actually fetched.

**Slim, then compress, then encode — in that order, inside `syncPush`.**
`syncSnapshotForPush` already decides what is worth sending (dropping resolved
flags' `ctx`, stubbing bank items sourced from the public `content/nodes.json`).
Compressing before that would faithfully preserve, at 8× cost, exactly the
bytes that step exists to drop.

## The open question: `syncPush`'s actual ceiling

`syncPush` writes through the Contents API's `PUT`, and unlike the *read* path,
this endpoint's real size limit has never been measured. It has never mattered
because the blob has never approached it from the write side — but "never
mattered yet" is not "verified," and it should be said plainly rather than
assumed.

The plan settles this cheaply, during Task 3, while sync is already under test:
`PUT` a disposable ~2MB payload to `sizetest.json` in the sync repo — never
`progress.json` — record whether it succeeds, then delete it. Compression
answers the practical question regardless of the outcome: post-compression the
real payload is ~170KB, comfortably clear of any plausible limit. If the test
finds `PUT` capped below what an uncompressed future blob could ever have
reached, that is a note for a later spec — `syncPush` would need the same
Git Data blob fallback `syncBlobText` already has for reads — not a blocker
here, because compression is what keeps that scenario hypothetical rather than
live.

## Session capture: what "the conversation... save" stores

**`hvr_sessions`**, written once, when a conversation ends — not per turn.
`composeEnds` already marks that moment; `c.turns` already holds everything
that was said. There is no new capture path, only a new place to keep what
already exists in memory for the length of one session and nowhere afterward.

This exists because reconstructing one was already necessary, and it was
detective work. Chasing the Flash-thinking latency flag (`2026-09-07`, see
`2026-09-07-the-coach-was-thinking-design.md`) meant rebuilding the turn that
prompted it out of `hvr_coachlanded` timestamps cross-referenced against
`content/nodes.json`, because nothing had stored what was actually said. George,
on why: "storing the conversations would give you real material to work with
in cases like this."

**Bounded on both axes, and not the prompt.** `SESS_MAX = 8` conversations,
`SESS_TURN_MAX = 12` turns each, keeping the *end* of a longer conversation —
the turn he just finished is the one a flag is about, never the opening. What
is kept per turn is what he said, what the coach answered, and how it was
judged (`ok`/`why`). What is **not** kept is the ~6KB prompt that produced each
turn: it is regenerable from `composePrompt` on demand, and storing it would
spend the budget compression just bought on the one part of a turn that isn't
actually the record of the conversation.

**Synced, unlike `hvr_ailog`.** The AI log is device-local and capped at 20,
which is why the `think`/`thoughtTok`/`skipped` fields added by the Flash fix
only reach me if a flag is raised within `FLAG_AI_CALLS` (3) calls of the
problem — see `2026-09-07-noticing-when-it-runs-worse-design.md`. A session
record that stayed device-local would inherit exactly that luck-dependency.
`hvr_sessions` rides the sync blob for the same reason `hvr_health` does: so it
reaches me cold, without George doing anything, and without a flag having to
land inside a narrow window. It needs a `MERGE_RULES` entry keyed by id
(device + timestamp) for the same reason `hvr_flags` and `hvr_health` do —
without one, the array default lets whichever device syncs second silently
erase the other device's conversations.

## The trail: what "recent pages" stores

**`hvr_trail`**, device-local, `TRAIL_MAX = 30`. Deliberately *not* synced as
its own store — it is a fact about the device currently in his hand, the same
reasoning already applied to `hvr_ailog`, and it reaches me by riding inside a
flag's context rather than traveling on every sync regardless of whether a flag
was ever raised.

**Consecutive time on one screen is one entry with a moving `last`, not a
heartbeat**, and returning to a screen is a new visit rather than an update to
the old one — "he went back" is the part worth keeping. It is recorded on every
card render (`learnRenderCard`), not from `uhHere`, which only runs when the
inspector itself opens — hooking there would only ever show the screens he
opened the inspector *from*, never the screens he actually moved through on the
way to the thing he wants to flag.

This is the direct answer to a pattern already on record: the Flash-latency
flag was raised on the lesson-end screen (`lEnd`) about turns that happened
several screens earlier, on the card screen (`lCard`). A flag says where he is;
the trail says where he had just been, which is most of what "you aren't left
guessing" means for a flag raised after the fact.

## Flags: the trail is copied, the session is referenced

`flagContext` gains two fields: `ctx.trail` (the last `TRAIL_MAX` screen
visits, copied in full — it is small and bounded) and `ctx.sessionId` (a
reference to the most recent entry in `hvr_sessions`, not a copy of it).

The distinction matters because a sitting can raise more than one flag.
Copying the conversation into every flag raised during it would put the same
turns in the sync payload once per flag — exactly the kind of bloat this whole
plan exists to remove. Referencing it by id costs a few bytes per flag and lets
the reader look the conversation up once, in the one place it actually lives.

**The flag reader needs the same fallback the app has, again.** `syncBlobText`
already falls through to the Git Data blob endpoint when the Contents API
serves an empty inline body — fixed once, in the app, on 2026-09-02, and again
in the `check-hebrew-flags` skill itself on 2026-09-07 (see
`2026-09-07-noticing-when-it-runs-worse-design.md`) after the skill was found
to have the exact same un-fallbacked read the app once had. Compression adds a
third thing that read has to handle: the `{enc:"gzip"}` envelope. A skill that
does not decompress does not error — it parses garbage or finds no `hvr_flags`
key and reports "no new flags," which is silent and indistinguishable from
good news, from the one tool whose entire job is noticing problems. The skill
must be taught to decode both formats in the same change that teaches
`syncPush` to write the compressed one, not afterward.

## Deferred, with reasons

- **The 10-second tail.** Still open from
  `2026-09-07-the-coach-was-thinking-design.md`: one Lite call in fifteen took
  10.3s, almost all of it server-side stall before the first token. Worth a
  progressive loading indicator; unrelated to storage and not part of this
  change.
- **`best` generated and rendered nowhere on clean turns.** Also still open
  from the same spec — measured as not a latency fix, but still dead output on
  every clean turn and worth removing on correctness grounds, in its own
  change.
- **The transliteration scheme absent from `composePrompt`.** Also still open:
  the coach's own prompt never states the `kh`/joined-article/`ve-` scheme this
  file's `CLAUDE.md` requires, so both Gemini models have been returning
  `ha-shulchan`-style transliteration to the one person who reads it to speak
  from. A real bug, adjacent to compression only in that it was found the same
  day, and not touched here.
- **`syncPush`'s size limit, if the sizetest probe finds it low.** Addressed
  above as an open question to settle during Task 3; a positive finding of a
  low ceiling gets its own follow-up spec for a Git-Data-blob write path,
  rather than being designed against here on a guess.

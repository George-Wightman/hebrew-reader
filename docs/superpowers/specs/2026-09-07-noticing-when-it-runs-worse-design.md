# Noticing when it runs worse

## Where this came from

George, after the Flash thinking-config fix landed on 2026-09-07:

> "To prevent stuff like this before we need to address some of htose changes we
> spoke about earlier, a deeper memory and stuff, and I want you to address the
> code on how we can prevent this stuff from happeningin the future/ ID the issues
> more accuratley"

And, on storage:

> "Is their any way we can increase storage I feel like htis has been an issue
> thats came up before"

## The class of bug this is for

`gemini-flash-latest` refused the thinking control the app sent it, `geminiSend`
fell back to a bare request, and Flash ran at its default reasoning budget on
every coach turn for weeks. Nothing broke. Nothing was logged. The only symptom
was "it feels slow", and the only reason it was found is that George raised a flag
and someone sat down with an API key.

The app is full of paths shaped like that — fallbacks that succeed at lower
quality or speed:

| path | what silently degrades |
|---|---|
| `thinkingChain` walk | the model refuses the control; the bare request runs at default budget |
| `geminiSend` model walk | Flash → Lite on 503, timeout, or exhausted quota |
| `aiModelsFor` | drops to `GEMINI_MODELS_FAST` when the strong pool is low |
| 429 minute-limit | up to three sleeps per model per key, folded invisibly into `ms` |

Each is individually correct — that is the point of a fallback. Collectively they
make "works, but worse" the app's default failure mode, and nothing counts how
often it happens or tells anyone it is happening.

## Two things that turned out already solved

Recorded because they were on the way to being "fixed" a second time.

**Silent storage writes are not silent.** `lsSet` already calls `storageFailed(k, e)`
and returns a boolean; the alarm names the key and tells him to export. The empty
`catch` in `flagSave` / `aiLogSave` / `aiQSave` wraps only `JSON.stringify`, which
does not throw here. There is nothing to fix.

**The 1MB sync cliff is already handled.** `syncBlobText` falls through to the Git
Data blob endpoint (100MB) when the Contents API answers with `content: ""` —
found at 94% on 2026-09-02. `progress.json` is at 1,018,405 bytes, 97.1% of that
cutoff, and pull survives it.

## What is actually missing

**The evidence is device-local, capped at 20, and never synced.**

`hvr_ailog` holds the last 20 calls and is deliberately excluded from the sync
blob. The `think` / `thoughtTok` / `skipped` fields added with the Flash fix
therefore only reach me if George happens to raise a flag within three AI calls of
the problem occurring — `FLAG_AI_CALLS` is 3. A degradation that has been running
for a month, on every call, still reaches me only by luck.

That is the gap. Not "the app does not know" — it knows, and now says so on the
call — but "nothing accumulates it anywhere I can read without being handed a key."

## The change

### 1. A health ledger, synced

`hvr_health`: a small capped ring of degradation events, in the sync blob, so it
rides `progress.json` and can be read cold at the start of any session — the same
way `check-hebrew-flags` already reads his flags. No key, no browser, no George
noticing anything was wrong.

```
[ { ts, kind, detail, n, dev }, ... ]     newest last, capped at HEALTH_MAX
```

**Coalesced, or a per-call event floods it.** `thinking-refused` fired on every
Flash call for weeks; thirty of those is not thirty facts. A repeat of the same
`kind|detail` within `HEALTH_COALESCE_MS` bumps `n` and `ts` on the existing entry
instead of appending. So the ring holds *kinds of problem*, with a count and a last
-seen, which is what the question "is this still happening" actually needs.

**Merged like flags, not summed.** `mergeHealth` keys on `dev|kind|detail` and takes
the higher `n` per device, then caps. Summing across devices would double-count
every time either device re-pushed; keying by device keeps each side's count honest
and lets the reader add them up if they want a total.

**In-memory mirror first.** `healthNote` updates a module-level array before it
tries to persist, and the report reads that. A ledger whose whole job is recording
failures must not go blind in the one case where storage is the thing failing.

Writers, all inside `geminiSend` and `aiModelsFor`:

- `thinking-refused` — a model turned down the control we asked for.
- `model-downshift` — the model that answered was not the one we asked for first.
- `pool-downgrade` — `aiModelsFor` chose the fast pool because the strong pool was low.

Readers:

- `UH.root`, so it appears in the report every flag already carries.
- The AI modal, under the quota line, so he can see it himself.
- `progress.json`, which is the point.

### 2. Resolved flags shed their context at the wire

`hvr_flags` is 105KB of a 1,018KB blob. `FLAG_MAX` is 40 and he is at 35, so the
count is not the problem — the payload is. Each flag carries `ctx`: a full
under-the-hood report, three AI calls at 400 characters each, the transcript, the
card. For a flag already marked addressed, that has done its job.

`flagSlimForSync` drops `ctx` from resolved flags only. His words, the timestamp
and the resolved state all survive; 26 of 35 flags shed their diagnostics, worth
about 78KB.

**At the push and nowhere else**, following `bankSlimForSync` exactly. The comment
on `bankDropStubs` records what happened the one time slimming ran before the merge:
the device's own items became stubs, and all 330 pre-baked sentences were deleted
and pushed empty. Slimming belongs at the wire.

### 3. My own flag reader gets the same fallback the app has

`check-hebrew-flags` reads `.content` from the Contents API with no blob fallback —
the exact bug the app fixed on 2026-09-02. At 97.1% of the cutoff it breaks within
a handful of flags, and it breaks by returning nothing, which is indistinguishable
from "no new flags". The tool for noticing problems must not fail silently; skill
updated to fall through to the blob endpoint.

## Storage headroom, measured

| | bytes | % of the 1MB Contents cutoff |
|---|---|---|
| today | 1,018,405 | 97.1% |
| after `flagSlimForSync` | ~938,000 | ~89% |
| gzipped, then base64 | 166,896 | **15.9%** |

Gzip is **8.1x** on this data. `CompressionStream("gzip")` is available in Chrome
and on his Pixel, and would turn "nearly full" into six times the room he has ever
used.

**Deliberately not in this change.** It is a format migration: both devices must be
able to read the new format before either writes it, and my own tooling has to
decompress too. That is its own spec with its own transition plan, not a passenger
on this one. `localStorage` is not the constraint either way — about 785KB against
a 5–10MB limit.

## Tests

- `healthNote` coalesces a repeat inside the window and appends outside it.
- The ring never grows past `HEALTH_MAX`, oldest dropped first.
- `mergeHealth` keys on device and takes the higher count, rather than summing.
- `healthNote` records into the in-memory mirror even when the store write fails.
- `flagSlimForSync` strips `ctx` from resolved flags, keeps `text`/`ts`/`resolved`,
  and leaves unresolved flags untouched.

## Deferred, with reasons

- **Compression.** Measured at 8.1x and worth doing. Own spec, own migration.
- **Conversation storage.** George's earlier ask — store coach sessions so there is
  real material rather than turns reconstructed from `hvr_coachlanded` timestamps.
  Bigger, and the budget question above should be settled by compression first, so
  it is not designed around a constraint that is about to lift.
- **Syncing `hvr_ailog` itself.** Tempting and rejected: 20 full prompts and replies
  is tens of KB of mostly-noise, and the health ledger carries the signal from it at
  a fraction of the size. If a specific call needs inspecting, that is what a flag is
  for.
- **An automated canary that probes the API's assumptions.** Considered and rejected
  as unnecessary: every real call already tests them, and `thinking-refused` is that
  test's result. A dedicated probe would spend quota to learn what ordinary use
  already reports.
- **The 10-second tail** and **the transliteration scheme**, both still open from
  `2026-09-07-the-coach-was-thinking-design.md`.

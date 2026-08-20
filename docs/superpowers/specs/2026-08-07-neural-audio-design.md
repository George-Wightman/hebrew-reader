# Real Neural Hebrew Audio, Cached Forever

**Date:** 2026-08-07
**Status:** Approved, building

## Why

The only Hebrew voice available (Windows' `Microsoft Asaf`) is flat, robotic, and runs too fast to
be useful for the Hear-and-answer drill — already addressed once this round with a slower default
rate and a manual slow-replay control, but the ceiling on that voice is low regardless of rate.
Gemini's TTS models produce genuinely natural Hebrew speech and are reachable on George's existing
free key. The design question is entirely about **cost and architecture**, not whether this is
worth doing.

## What was ruled out, and why

George's own first idea was to record a full sentence, visually find the word boundaries in the
waveform, and splice reusable word clips out of it to build new sentences later. Checked against how
Gemini's TTS actually responds: **it returns a raw PCM waveform with no timing metadata at all** —
no word boundaries, no phoneme marks. Finding a cut point means guessing from the waveform, and
Hebrew — like most languages — has no silence between words in fluent speech, so a guessed cut lands
mid-**coarticulation** (the acoustic shape of a word bleeding into its neighbours) and produces an
audible click. The word also carries whatever pitch contour it had in its *original* sentence
position, which will be wrong in a new one. This is a real, historically legitimate technique —
**unit-selection concatenative synthesis** — but production systems that made it work relied on
tens of thousands of purpose-recorded, hand-labelled units. Doing it opportunistically from a
handful of AI-generated sentences would sound worse than the Windows voice, not better.

Google Cloud Text-to-Speech (not Gemini's) does expose real word-timing via SSML `<mark>` tags,
which would make splicing legitimate. Checked and ruled out: its free tier still requires a linked
billing account with a card, which is the exact line this app has drawn since it began.

## Decisions

| Question | Decision |
|---|---|
| Splicing sentence audio into words | Rejected — no timing data, coarticulation makes it worse than doing nothing |
| Storage | `IndexedDB` (`Blob`s), not `localStorage` — audio is too heavy for the ~5MB budget |
| When to generate | Lazily, on first play — **plus** an explicit "farm" action George can run to front-load |
| What plays while new audio generates | The Windows voice, immediately, every time — never a wait |
| Slow mode on real audio | `<audio>.playbackRate`, reusing the one cached clip — no second recording, no second call |
| Quota discovery | Empirical — keep generating until a 429 on both keys, not a hardcoded guess |
| Word-level audio | Yes — every library word gets its own clean standalone clip, used for Say-the-word and doubling as a rough fallback for a sentence that hasn't earned real audio yet |

## Architecture

**Cache**: `IndexedDB` database `hvr_audio_v1`, one object store `clips`, storing `Blob`s directly
(no base64 round-trip). Keys are built from identities the app already has:

- `"word:" + libraryKey` — one clip per library word
- `"sentence:" + bankItemId + ":a"` — the answer/reveal audio for word/sentence/listen/reply cards
- `"sentence:" + bankItemId + ":q"` — the question audio, **only for reply cards**, whose prompt
  (`qhe`) and reveal (`he`) are genuinely different text

**Listen cards deliberately reuse the `:a` slot for both their prompt and their reveal** — both
moments speak the identical `c.item.he`, so keying them separately would silently double-generate
(and double-spend) the same clip.

**Gemini call** — `geminiTTS(text)`, a sibling to the existing `geminiRequest()`: same key-fallback
shape (primary key, then backup), a different request body (`generationConfig.responseModalities:
["AUDIO"]` with a prebuilt voice), and a different response shape (`inlineData.data`, base64 PCM,
not `.text`). **The 24kHz/16-bit/mono PCM Gemini returns has no header**, so a 44-byte WAV header is
written once at cache-write time (`pcmToWavBlob`) — a mechanical, fully-specified transform, not
something that needs live verification.

**Playback** — one entrypoint, `playHe(cacheKey, text, slow)`, used everywhere the Learn page
currently calls `speakHe()` directly:

1. Check the cache. **Hit** → play the real clip (`<audio>.playbackRate` for slow), and — since
   we're here anyway — call `audioEnsure()` too, which no-ops immediately because the cache already
   has it.
2. **Miss** → speak via the Windows voice immediately, and kick off a background `audioEnsure()` for
   next time. The card is never silent and never waits.

`audioEnsure(cacheKey, text)` is the single place that actually calls `geminiTTS` and writes the
cache; both `playHe`'s lazy path and the farm loop below call through it, so there is exactly one
place quota-spending logic lives.

**Circuit breaker** — a session-scoped flag, `audioQuotaDead`. The first 429 that survives both
keys trips it; every subsequent `audioEnsure` call that session is a no-op. This is what makes
"discover the real limit empirically" safe rather than a slow-motion retry storm against a spent key.

## The farming action

A "**Build up audio library**" button in Settings, next to the other maintenance actions. It walks
**every** library word and **every** bank item's audio needs, skips anything already cached, and
calls `audioEnsure` on the rest **one at a time, in sequence** — deliberately not in parallel, so the
circuit breaker can actually stop it mid-run rather than a burst of concurrent requests all failing
together. Reports live progress and a final count: how many were generated, and — if the circuit
breaker tripped — that it ran until today's limit and can be re-run tomorrow for more.

This is genuinely the same code path as the lazy hook, run in a loop, not a second implementation.

## Error handling

| Condition | Behaviour |
|---|---|
| No Gemini key | `playHe` and the farm button both no-op past the cache check straight to the Windows voice; unchanged from today |
| `IndexedDB` unavailable (private browsing, disabled) | Every cache call resolves to "miss" / "failed silently"; behaves exactly as if audio were never cached |
| 429 on both keys | Circuit breaker trips for the rest of the session; farm loop stops and reports it |
| Any other TTS error (400, empty reply, bad model) | That one item is skipped, loop continues — one bad item never stops the whole backfill |
| Corrupted/partial cached blob | Treated as a miss, never thrown |
| Autoplay blocked by the browser | `.play()` rejection is swallowed, not surfaced as an error |

## Confirmed live, 2026-08-07

George's first real attempt failed on the very first request, and the captured diagnostic
(added specifically because the original code discarded 429 bodies) revealed the actual cause:

> `HTTP 400: {"error":{"code":400,"message":"Model tried to generate text, but it should only be
> used for TTS. Make sure your instructions are clear to only generate audio from a given text
> transcript.","status":"INVALID_ARGUMENT"}}`

Not a quota problem at all. Sending the bare word as the entire prompt (e.g. `"שלום"`) reads as an
open conversational turn, and the model tries to *reply* to it rather than vocalise it —
`responseModalities:["AUDIO"]` alone isn't a strong enough constraint on its own. Worst on exactly
the short, greeting-like words this hit first, since a greeting invites a response.

Fixed with two additions to the request body: a `systemInstruction` establishing the model's only
role as reading text aloud verbatim, and wrapping the content itself as `"Read this aloud,
verbatim: " + text` rather than sending it bare. Both were verified to land correctly in the
request shape with a stubbed `fetch`.

## The real quota, confirmed from George's own AI Studio dashboard

Not a guess anymore. **Gemini 2.5 Flash TTS: 3 requests/minute, 10/day.** (3.1 Flash TTS carries the
same numbers; Pro TTS shows 0/0 — unavailable on this tier at all.) Far tighter than text
generation's 20/day, and small enough that the original farm loop — which called `audioEnsure` back
to back with no pacing — blew through the per-minute cap before ever approaching the daily one.
That is what "exhausted on the very first request" actually was; it was never a billing gate.

Fixed with `audioRateLimitWait(key)`, called immediately before every `fetch` inside `geminiTTS`:
tracks up to 3 request timestamps per API key in a rolling 60-second window, and awaits the
remainder of that window before proceeding once the cap is reached. Paced **per key**, not
globally — each configured Google account is an independent project with its own independent limit.
Best-effort rather than a hard mutex (a rare off-by-one under concurrent callers just risks an
occasional 429, already absorbed by the existing retry chain) — real atomicity would be solving a
problem that doesn't exist at this scale.

**Two more fixes that came directly out of trying to read the first real error message:**
- The Settings backdrop closed itself when George tried to drag-select the error text to copy it —
  a classic click-outside-to-close bug, where a selection drag that starts inside the modal and
  releases past its edge still fires `click` with `target === the backdrop`. Fixed by requiring
  the `mousedown` to have *also* started on the backdrop before a `click` there closes anything.
- Added a dedicated **Copy error** button next to the farm status so this never depends on manual
  selection again, and increased the captured-error truncation from 300 to 700 characters — the
  original cutoff landed exactly where the useful part (the named quota metric) began.

## Retrying transient server errors

A genuine `HTTP 500` ("An internal error has occurred") turned up twice, independently — once on
the very first live call this app ever made, and again later. A 500 is Google's own server, not a
request problem, so unlike a 400 (which no amount of retrying fixes), the honest response is a
short retry with backoff: `ttsFetchWithRetry()` attempts up to 3 times total for a `>=500` status
only, waiting 700ms then 1400ms between attempts, re-checking the per-key rate limiter before each
retry since it is still a genuine request against the real quota.

**Real consequence worth knowing, not a bug:** because retries count against the same 3/minute
budget as fresh items, a persistently-failing server can make even a *few* failing items consume
the whole per-minute allowance on retries alone — so the farm loop's "3 consecutive failures" stop
condition can take minutes in the worst case, not seconds, when Google's backend is genuinely
having a bad stretch. This is correct behaviour given the real rate limit, not something to
engineer around.

## What can and can't be verified here

Chromium's `IndexedDB` is real in this environment, so cache read/write, key correctness, the
in-flight dedupe, the circuit breaker, and the WAV header bytes are all genuinely testable with a
stubbed `fetch` — the same pattern already used for `geminiRequest`. **What cannot be verified here
is the live request/response shape against Google's real endpoint, or how the audio actually
sounds** — both need a pass from George on his own machine after this ships. The request/response
shape is built from Google's published TTS documentation, flagged in-code as unverified against a
live call, with the existing fallback chain meaning a wrong shape fails closed (silently falls back
to the Windows voice) rather than breaking anything.

## Testing

1. `pcmToWavBlob` produces byte-correct RIFF/WAVE headers for known input lengths.
2. Cache key generation is correct and stable for all four card kinds, including the listen
   reuse-same-slot case and the reply two-key case.
3. `audioGet`/`audioPut` round-trip a real `Blob` through `IndexedDB`.
4. `audioEnsure` does not fire a second concurrent request for a key already in flight.
5. A 429 on both keys trips `audioQuotaDead`; every subsequent call that session short-circuits
   with zero further `fetch` calls.
6. `playHe` on a cache hit plays the cached clip; on a miss it calls the Windows voice immediately
   and still triggers background generation.
7. No key configured: `playHe` never touches `IndexedDB` or the network.
8. The farm loop skips already-cached items, generates the rest in sequence, stops cleanly on the
   circuit breaker, and reports accurate counts.
9. Regression: the whole Learn session flow, Translator, pad, library grid, archive, export.

## Out of scope

- Any UI to browse or manually clear individual cached clips (Settings' existing bulk resets are
  sufficient — clearing `IndexedDB` entirely can be a follow-up if it's ever actually needed)
- Choosing between multiple prebuilt Gemini voices — one sensible default, changeable later as a
  single constant
- Splicing, in any form

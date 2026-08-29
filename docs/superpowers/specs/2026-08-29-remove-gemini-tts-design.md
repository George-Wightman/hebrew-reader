# Deleting the Gemini TTS path — the phone's own voice was always going to win

## Where this came from

A flag George raised mid-session, surfaced via `check-hebrew-flags`:

> We should just remove any TTS calls, when on my phone i get free built in Google TTS
> (pixel) so its useless nad jsut confusing, delete it all together.

And, when asked whether he ever practises on Windows (whose fallback voice is more
robotic):

> I mostly use the Phone now. The windows has a more robotic voice as a fall back so
> removing this is fine. The TTS never really worked anyway and isnt feasable given usage
> limits.

## What the code actually said

Gemini TTS (`geminiTTS`, `GEMINI_TTS_MODELS`, `audioEnsure`, the farm) has been broken
since 2026-08-07 — every model in `GEMINI_TTS_MODELS` returns `HTTP 400`. A fix was
attempted on 2026-08-21 (moving the read-verbatim instruction out of `systemInstruction`,
which Google was rejecting) but never verified live, and CLAUDE.md already flags it as
unconfirmed. The "Build up audio library" Settings button was pulled on 2026-08-13 after
an audit found it "a live-looking control wired to a dead endpoint" — but the machinery
behind it (`audioFarmRun`, `audioCoverage`, `audioJobList`) was left in place, dormant,
on the theory that real neural audio was "revivable if Google's TTS ever stops erroring."
George's flag overturns that theory outright: even working, it would cost quota
(`gemini-3.1-flash-tts-preview` is 10/day, the tightest pool in the app) to reproduce
something his phone already does for free, unlimited, and — per his own report — well.

**The `clips` IndexedDB store is shared and must not be touched wholesale.** It holds
synthesised `word:`/`sentence:<id>:a`/`sentence:<id>:q` clips *and* `note:<id>` — real
recordings of his partner's grandad's WhatsApp voice notes. `audioClearAll()` exists but
has no caller; nothing today wipes the store, and this change must not become the thing
that does.

**A bug this removal incidentally fixes.** `rekeyWord` (hebrew-reader.html:5233) tries to
carry a word's clip across a rename with `audioGet(from)` — but clips are keyed
`"word:" + key`, and `from` is the bare key. The prefix has never matched, so renaming a
word has never actually moved its audio; it silently orphans the clip every time. Dies
with the rest of the cache-filling code rather than being fixed, since generation ends.

## What's changing

**Deleted outright** (request layer, cache-filling, dead farm, Settings UI + handlers,
library-button distinction, three self-tests pinning TTS response shape) — see chat for
the full symbol list. **Untouched**: the `clips` store itself, `audioGet/Put/Del`,
`playAudioBlob`, `playNote`, note recording/pruning, `speakHe`/`HE_VOICE`/`hasHeVoice`.

`playHe(cacheKey, text, slow)` keeps its signature (seven call sites, no churn) but drops
straight to `speakHe(text, slow)`; `cacheKey` becomes an unused parameter. Same for
`playLibraryAudio`, which loses its clip branch and just speaks — no more "AI recording"
vs "Windows voice" distinction in the status line or button colour, per George's own call
("drop the distinction entirely").

**One-time purge**, gated like the existing `hvr_*_v1` migration flags: on next load,
enumerate the `clips` store and delete every key whose prefix is `word:` or `sentence:` —
an explicit allow-list of the two prefixes being retired, not a deny-list of `note:`, so a
future key shape can never be caught by accident. `note:` keys are never enumerated for
deletion, let alone touched.

## Testing

The purge is the only part of this change that can destroy data (a real recording, if a
future key ever collided with the allow-list), so it's the only part getting a dedicated
test: seed a fake store with `word:x`, `sentence:a:a`, `sentence:b:q`, and `note:c`, run
the purge, assert the first three are gone and `note:c` survives untouched. Per
CLAUDE.md, this drives a plain object/fake store, not the real IndexedDB.

Verification: self-test suite green; the duplicate-function grep clean (structural
removal across ~15 symbols); Settings opens with no console error (removed handlers
against removed elements is exactly the failure mode this file has hit before — a
dangling `onclick` throws at load and silently breaks every handler registered after it);
a word card still speaks via the device voice; a real voice note still plays after the
purge runs.

## Deferred, with reasons

- **Reviving Gemini TTS if Google ever fixes the account-level issue.** Explicitly
  rejected, not merely postponed — George doesn't want it even working, given the quota
  cost versus a free unlimited phone voice.
- **The generation pipeline producing zero new bank content since 2026-08-23**, and
  **preloading 2-3 sessions of content ahead using idle quota**, and **whether the Gemini
  ASR-verification pass on graded answers is worth its call.** All three are separate
  flags from the same session; this spec covers TTS deletion only, first because it's
  bounded and because clearing dead TTS failures out of the AI log makes the generation
  diagnosis (next) easier to read.

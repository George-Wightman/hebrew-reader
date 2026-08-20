# Loading Indicator + Backup Gemini Key — Design

**Date:** 2026-08-06
**Status:** Approved, building
**Amends:** `2026-08-06-audio-transcription-design.md`, `2026-08-05-explain-merge-design.md`
(consolidates their separate Gemini call paths into one)

## Why

Two gaps from real use:

1. **The audio drop zone gives no feedback.** After a paste, the zone just sits static — the only
   signal is the edge pulse, easy to miss when looking at the zone itself waiting for confirmation
   that the paste registered.
2. **One Gemini key means one quota.** 20 requests/day is tight enough that George is expecting to
   hit it. A second key from a different Google account doubles the practical daily budget.

## Decisions

| Question | Decision |
|---|---|
| Indicator location | Inside the drop zone itself, replacing its content during the call |
| Zone interaction during a call | Disabled — no stacking a second paste on an in-flight one |
| Backup key storage | Separate field, `hvr_geminikey2`, optional |
| Fallback order | Exhaust every model on the primary key **before** touching the backup |
| Retry architecture | Consolidated into one `geminiRequest(parts)` used by every call site |

## Why consolidate the retry loop rather than add a key to each call site

`transcribeAudio` and `padAskExplain` each currently run their own model-fallback /
thinking-config-retry loop. Adding a second key to both independently would create two places that
must be kept in sync — the exact failure pattern that has bitten this app before (opposites
rendering through a different builder than plain words; the star losing its visibility rule in one
of two call sites). One shared function, one place the key list lives.

## Architecture

### `geminiRequest(parts)`

Replaces `geminiAsk(prompt, key)` and the bespoke loop inside `transcribeAudio`. Takes a Gemini
`parts` array (a `{text}` object for ordinary calls, `{text}` + `{inline_data}` for audio) so both
callers build their own payload and share everything downstream of that.

```
keys = [primary, backup].filter(present)
for key in keys:
  for model in GEMINI_MODELS:
    for cfg in [thinkingConfig, none]:
      try request
      if ok -> return text
      if 400 and cfg present -> next cfg (config was the problem)
      if 429 -> break to next model (this model on this key is spent)
      other -> throw
  # every model on this key is spent -> next key
throw with the most specific message available
```

`padAskExplain` passes `[{text: prompt}]`. `transcribeAudio` passes
`[{text: audioPrompt()}, {inline_data: {mime_type, data}}]`. Both existing behaviours (retry
without thinking config on 400, try the next model on 429) are preserved exactly — the only new
axis is the outer key loop.

### Settings

A second password field, "Backup Gemini API key (optional)", beside the existing one. Empty by
default; when empty the key list is just `[primary]` and behaviour is identical to today.

### Loading indicator

`transcribeAudio` toggles the drop zone into a busy state at entry and restores it in `finally`:

- Zone content swaps to a spinner + "Transcribing…".
- `pointer-events: none` and a disabled-looking style, so a second file can't be dropped mid-call.
- The existing edge pulse (`busy()`) is unaffected — this is a second, more local signal, not a
  replacement.

## Error handling

- **Both keys exhausted** — the 429 message must say so distinctly from "the one key is
  exhausted", since the remedy differs (wait vs. nothing left to try).
- **Backup key present but invalid** — surfaces as a normal auth failure on that key when reached;
  no special-casing, it just fails like any bad key would, after the primary's models are spent.
- **Indicator restore** — in `finally`, so a thrown error still returns the zone to its normal
  state rather than leaving it stuck showing "Transcribing…".

## Testing

1. `geminiRequest` tried against mocked responses: primary exhausted (429 on both its models) →
   backup used; primary succeeds → backup never called; both exhausted → distinct message.
2. No backup key configured → behaviour identical to before (regression).
3. Drop zone shows the spinner state during a call and reverts after, on both success and failure.
4. Zone is inert (no new drop/paste accepted) while a call is in flight.
5. Regression: `padAskExplain`'s existing tests (thinking-config retry, model fallback, no-key,
   429 messaging) still pass through the new shared function.

## Out of scope

- More than two keys. Two matches the actual need (two Google accounts) without building a
  general key-rotation system nobody asked for.
- Automatic key rotation or usage tracking across the two keys — the app doesn't know remaining
  quota ahead of a call; it only learns via a 429.

# Audio → Transcription — Design

**Date:** 2026-08-06
**Status:** Approved, building

## Why

The loop starts with grandad's WhatsApp voice note and George transcribing it by hand. That's the
slowest, most tedious step and it gates everything downstream. WhatsApp lets him **copy the voice
note to the clipboard**, so paste is the natural entry point.

## Proven before designing

Tested against his real file (`WhatsApp Ptt 2026-08-05 at 22.27.46.ogg`, 110KB, Ogg Opus mono
48kHz) using his existing Gemini key:

| Test | Result |
|---|---|
| Transcript only | 6.4s, correct Hebrew, 1,423 audio tokens |
| Transcript + translation + 43 glossed words, one call | 8.6s, valid JSON, all categories present |

`audio/ogg` is accepted natively — **no format conversion needed**. The combined response shape is
deliberately identical to what `renderAIWords()` already consumes.

## Decisions

| Question | Decision |
|---|---|
| Primary input | **Ctrl+V paste** of a file copied from WhatsApp |
| Also supported | Drag-and-drop, and click-to-pick |
| Privacy | One-off notice on first use, remembered thereafter (`hvr_audioconsent`) |
| Call shape | **One call** returning transcript + translation + words |
| Audio storage | Never stored — read, sent, discarded |
| No key / no quota | Feature unavailable, stated plainly (see below) |

## The limitation that has no workaround

Every other AI feature degrades to copy-prompt/paste-result when there's no key or no quota. **Audio
cannot.** You can't paste a sound file into a chat window and get JSON back. So:

- **No key** → the feature refuses and points at Settings. It does not silently do nothing.
- **429** → says the daily limit is spent and he'll need to transcribe by hand today.

This is a real reduction in robustness compared with the rest of the app and is accepted
deliberately, not overlooked.

## Architecture

### Entry points

All three funnel into one `transcribeAudio(file)`:

1. **Paste** — a `paste` listener on `document`. It acts **only** when
   `e.clipboardData.files` contains an audio file, so ordinary text pasting into the textarea is
   completely unaffected. Active only while the Translator view is showing.
2. **Drop** — dragover/drop on the drop zone.
3. **Click** — the zone opens a hidden `<input type="file" accept="audio/*">`.

### MIME detection

`file.type` is unreliable for clipboard files (often empty on Windows), so the extension is the
fallback:

```
ogg|oga|opus -> audio/ogg      mp3 -> audio/mp3     wav -> audio/wav
m4a|mp4      -> audio/mp4      aac -> audio/aac     flac -> audio/flac
aiff|aif     -> audio/aiff     webm -> audio/webm
```

Unrecognised extension with no usable `file.type` → refuse with the actual extension named.

### Flow

```
file -> guard: key present? size <= 10MB? consent given?
     -> FileReader.readAsDataURL -> strip "data:...;base64," prefix
     -> POST inline_data + prompt, thinkingLevel: minimal
     -> parse JSON
     -> #input.value = transcript
     -> renderAIWords(data)     // existing: renders cards, harvests to Pending
```

`renderAIWords()` reads `#input.value` for `result.source`, so the transcript **must** be written
before it is called.

### Size cap

10MB raw. Base64 inflates by ~4/3, so that's ~13.5MB of request body, inside the inline-data
limit. At roughly 2.5KB/sec for Opus that's over an hour of audio — far beyond any voice note.
Oversized files are refused with their actual size shown, not a generic failure.

### Consent gate

On first use only: a `confirm()` explaining the audio is sent to Google and that the free tier may
use it to improve their products. Accepting sets `hvr_audioconsent`; declining aborts and does not
set it, so the choice isn't locked in by a misclick. No further prompting after acceptance.

### Failure handling

- **Malformed JSON but text returned** — salvage: put the raw text in `#input` so an 8-second call
  isn't lost to a parse error, and say so.
- **429** — the daily-limit message; no fallback path exists.
- **No key** — refuse, point at Settings.
- **FileReader error / empty file** — named error, `busy()` cleared in `finally` so the ring can't
  stick on.

## Testing

Live API contract is already proven above; the remaining tests use mocked responses to avoid
burning the 20/day quota:

1. Extension → MIME mapping, including empty `file.type` (the clipboard case).
2. Paste with a non-file clipboard payload does **not** intercept normal text pasting.
3. Consent gate fires once; declining aborts and re-prompts next time; accepting never re-prompts.
4. No-key and 429 messages are specific, not generic.
5. Mocked good response: transcript lands in `#input`, cards render, new words reach Pending.
6. Mocked malformed JSON: transcript still surfaces.
7. Oversized file refused with its size named.
8. Busy ring clears on both success and failure.
9. Regression: existing Read / Copy-prompt / Paste-result / AI-translate paths untouched.

## Out of scope

- Local/offline transcription. The browser's speech API listens to a microphone, not a file, and
  routes through Google anyway; a local Whisper model would be a 40–150MB CDN download, breaking
  the single-file offline design.
- Storing or replaying audio in the app.
- Speaker separation, timestamps, or partial/streaming transcription.

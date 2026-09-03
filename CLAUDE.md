# Hebrew Reader — working notes

One 1MB+ single-file HTML app (`hebrew-reader.html`), no build step, no framework.
These are the mechanical gotchas that have each cost real time before. They apply
to any change, however small — the deliberate feature pipeline lives in the
`brainstorm-to-ship` skill, but these rules are not conditional on using it.

## Verifying a change actually landed

**A plain reload is not enough.** `sw.js` is stale-while-revalidate: it serves the
cached shell instantly and only tells the page a new version exists after the fact.
Before every verification reload, in the page:

```js
navigator.serviceWorker.getRegistrations()
  .then(rs => Promise.all(rs.map(r => r.unregister())))
  .then(() => caches.keys())
  .then(ks => Promise.all(ks.map(k => caches.delete(k))));
```

Then navigate with a query string not used before. This applies on `localhost`
*and* on the live GitHub Pages URL after a push — Pages also needs a moment to
rebuild, so if the live site still shows the old build, poll rather than assume
the push failed.

Confirm content with `read_page` / `get_page_text` / `javascript_tool`, not
screenshots — the Browser pane's screenshot can lag a beat behind the live DOM,
and it occasionally stops compositing entirely (`preview_stop` then
`preview_start` fixes that).

## Line endings and structural edits

The file is **LF throughout** (`.gitattributes` says `* -text`, so git does no
conversion). Don't assume CRLF from an old note — check the file as committed:
`git show <rev>:hebrew-reader.html | python -c "import sys; d=sys.stdin.buffer.read(); print(d.count(b'\r\n'), d.count(b'\n'))"`.

After any large structural edit (moving code, splicing between two markers,
multi-hundred-line rewrites), confirm no function got duplicated — a bad splice
has silently produced a repeated definition before, where the later one quietly
wins and every test still passes:

```bash
grep -oE "^(async )?function [A-Za-z0-9_]+" hebrew-reader.html | sort | uniq -d
```

Must print nothing.

## The self-test suite

Open `hebrew-reader.html?selftest`. `document.title` becomes `selftest
<pass>/<total>`; failures land on `window.__selftest.failures`. Read it
programmatically rather than trusting the screenshot.

**There is no localStorage isolation between tests.** A test that writes to a
real store (not a passed-in plain object) must restore what it found in a
`finally` block, or it leaves synthetic data sitting in the app's real state
forever. Prefer driving pure functions with plain objects; only touch a real
store when the thing under test is the store itself. The same applies to any
reassigned global — `geminiFetchWithRetry`, `syncPull`, `sessionBusy` are all
plain function declarations that tests swap and must put back.

Async tests **run one at a time** as of 2026-08-30. They did not before:
`runSelfTests` started every test synchronously and only awaited afterwards, so
two async tests stubbing the same global clobbered each other and each failed
with the other's error. If you see failures whose messages belong to a different
test, suspect a stale cached build first (above) — that symptom now has two
causes and only one of them is still in the code.

## Audio is the device, and only the device

Practice audio comes from the **device's own TTS voice** (`speakHe` → `HE_VOICE`).
There is no longer any other path: Gemini TTS was deleted outright on 2026-08-29
(`62e57f5`, spec `2026-08-29-remove-gemini-tts-design.md`) after George pointed out
his Pixel does it free and unlimited. `geminiTTS`, `GEMINI_TTS_MODELS`, `ttsBody`,
`audioEnsure`, `audioFatal`, `audioQuotaDead` and the Settings "Generate a test
clip" button are all **gone — grep returns nothing**. Don't go looking for them,
and don't ask George whether TTS works; the question no longer means anything.

Two things follow:

- **If audio is silent, it is the device.** No Hebrew voice installed, muted,
  Bluetooth routing. There is no API in this path to blame and no quota to check.
  A stale AI-log entry mentioning `gemini-3.1-flash-tts-preview` predates the
  deletion — one such entry on a 2026-08-30 flag cost a session real time before
  someone checked whether the code still existed.
- George practises on a Pixel, so `speechRateFor` takes the
  `SPEECH_RATE_NATURAL` branch (0.90 / 0.65). The slower Windows figures only
  apply to the flat SAPI voice.

`playHe(cacheKey, text, slow)` keeps its old signature and ignores `cacheKey`; the
`clips` IndexedDB store still exists but now holds only `note:` keys — the real
voice-note recordings, which are untouched by any of this.

## Transliteration: one scheme, and it is not negotiable

He reads the transliteration — it is the line he actually produces from — so a second
convention is not a cosmetic inconsistency, it teaches two spellings for one sound.
`content/nodes.json` carried both until v4: items 0–76 used `ha-cheder` / `achshav` /
`eich`, and 77–329 used `hakheder` / `akhshav` / `eikh`, split exactly at a batch
boundary.

**The scheme is:**

- `kh` for ח and כ, never `ch` — `khaver`, not `chaver`.
- The article and single-letter prepositions **join** the word: `harekhov`, `bakheder`,
  `la'avoda`. No hyphen.
- **Apostrophe before a vowel**, so the join stays readable: `ha'ir`, `ha'otobus`,
  `la'ir` — never `hair`, which reads as the English word.
- The conjunction ו is `ve-` as it is actually spoken, not the formal `u-`/`va-`:
  `ve'ani`, `vegvina`. (The noun `uga`, cake, is not a conjunction — do not "fix" it.)

Anything written for the app follows this, including sentences you hand him in chat.

## AI usage

Gemini quota is `AI_POOL_CAPS = { strong: 20, fast: 500 }` per key per day.
Real usage runs at a small fraction of that. Default to using it generously —
an extra call, a second opinion, a validation pass — rather than economizing
against a budget that isn't actually tight.

**Per-minute is the limit that actually bites, not per-day.** `gemini-flash` is
**5 requests/minute** on the free tier. On 2026-08-29 a node commissioned twice
over put six requests through it in seconds while the day sat at 12 of 20. So
bursts matter and volume does not: anything that can fire twice for one node must
share one in-flight promise (`campWarmDecide`, `campConvoMaking`) rather than
racing.

And background generation is not an interactive call. `FETCH_TIMEOUT_MS` is 20s,
which `sentenceWrite` cannot meet; it and the other heavy writers take
`GEN_TIMEOUT_MS` (45s). A timeout used to escape `geminiSend`'s model loop
entirely and was reported as "daily free limit reached" — it now falls through to
`gemini-flash-lite` like any other failure, and says what it was.

## Style

`docs/style-guide.md` is a hard read-first for anything touching the map, the
drill card, or any other part of the visual/world layer. It is not needed for
scheduler, storage, or plumbing work.

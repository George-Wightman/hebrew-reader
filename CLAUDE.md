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
store when the thing under test is the store itself.

## Audio is the device, not the API

Practice audio comes from the **device's own TTS voice** (`speakHe` → `HE_VOICE`),
not from Gemini. `playHe` looks for a cached neural clip first and calls
`audioEnsure` to make one, but that path has been broken since 2026-08-07 and
was re-verified broken on 2026-08-21: every model in `GEMINI_TTS_MODELS` returns
`HTTP 400 "Developer instruction is not enabled for this model"`, Google
rejecting the `systemInstruction` field. So it always falls through.

Two things follow, and both have already misled one session:

- **Audio costs no API quota**, and no amount of newly generated bank material
  leaves anything "waiting to be synthesised". If audio is silent, the cause is
  the device — no Hebrew voice installed, muted, or routed to Bluetooth — not
  the key and not the quota.
- George practises on a Pixel, so `speechRateFor` takes the
  `SPEECH_RATE_NATURAL` branch (0.90 / 0.65). The slower Windows figures only
  apply to the flat SAPI voice.

## AI usage

Gemini quota is `AI_POOL_CAPS = { strong: 20, fast: 500 }` per key per day.
Real usage runs at a small fraction of that. Default to using it generously —
an extra call, a second opinion, a validation pass — rather than economizing
against a budget that isn't actually tight.

## Style

`docs/style-guide.md` is a hard read-first for anything touching the map, the
drill card, or any other part of the visual/world layer. It is not needed for
scheduler, storage, or plumbing work.

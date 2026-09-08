---
name: check-hebrew-flags
description: Use when George asks to check his flags, his notes, his feedback, or "things to change" from the Hebrew Reader app — fetches and shows the in-app flags he raised mid-session via the flag control next to the AI star, filtered to what's actually new.
---

# check-hebrew-flags

## What this is

The Hebrew Reader has an in-app flag control (left of the AI star) George taps mid-session
to record a thought — usually a change or a feature idea, not a bug — without leaving the
card he is on. Each flag carries his sentence plus the moment it arrived: the card on
screen, the node and chapter, the SRS state of the words on that card, and the last few AI
calls. See `docs/superpowers/specs/2026-08-28-flagging-things-to-change-design.md` for the
full design, and `docs/superpowers/specs/2026-08-29-resolving-flags-design.md` for how
addressed flags are cleared.

Flags live in the `hvr_flags` localStorage key, which rides the app's existing
cross-device sync into `progress.json` in a private GitHub repo. This skill is the read
side of that pipeline: fetch the file, filter out what's already handled, show the rest.

**Two things can mark a flag handled, and both matter — check both, every time:**

- **`resolved: true` on the flag itself.** George tapped "Mark addressed" in the app. This
  is shared state; it's in the same file you just fetched.
- **The flag's id appears in the local ledger** at
  `C:\Users\gwigh\.claude\projects\C--Users-gwigh-My-Drive--georgewight03-gmail-com--Hebrew-Learning\state\handled-flags.json`.
  This is *my* bookkeeping, not his — I write to it after shipping a fix for something a
  flag named, and it's how a flag stops being re-shown even before he's opened the app to
  tap anything. My token is deliberately read-only (his choice), so I cannot write
  `resolved` into his repo myself; this ledger is the only durable way I have to remember
  "I already did this."

Never assume "no new flags" without having checked both. A flag that's neither resolved
nor in the ledger is genuinely new and should be surfaced.

## Where the credentials live

- **Repo:** `George-Wightman/hebrew-reader-sync` (private, holds only sync data — words,
  SRS state, flags — never API keys or the sync token itself; the app's own code keeps
  those out of the synced blob).
- **Token:** a read-only, Contents-scoped, fine-grained GitHub PAT, stored in a plaintext
  file at
  `C:\Users\gwigh\.claude\projects\C--Users-gwigh-My-Drive--georgewight03-gmail-com--Hebrew-Learning\secrets\hebrew-reader-sync-token.txt`.
  This path is deliberately outside both the memory folder and this Drive-synced project
  directory — never git-tracked, never touches Drive. Read the file to get the token;
  never print it, never write it into any file inside this repo, never echo it back to
  George in chat.

## Steps

1. Read the token from the path above.
2. Fetch the file — write it to the session scratchpad, not `/tmp`, since the parsing step
   below runs under a Windows-native Python that cannot open MSYS-style `/tmp/...` or
   `/c/...` paths (found the hard way: `curl -o` under Git Bash writes the file fine at
   that path, but `open()` from plain `python` needs a real `C:\...` path to read it back):

   ```bash
   TOKEN=$(cat "/c/Users/gwigh/.claude/projects/C--Users-gwigh-My-Drive--georgewight03-gmail-com--Hebrew-Learning/secrets/hebrew-reader-sync-token.txt")
   curl -s -w "\ncode:%{http_code}\n" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/vnd.github+json" \
     "https://api.github.com/repos/George-Wightman/hebrew-reader-sync/contents/progress.json" \
     -o "$SCRATCH/hvr_progress_raw.json"
   unset TOKEN
   ```

   (`$SCRATCH` is this session's scratchpad directory, given in the system prompt.)

   **The one-megabyte cliff — this WILL bite.** The Contents API inlines a file as base64
   only up to 1MB; above that it answers `200 OK` with `content: ""` and
   `encoding: "none"`. On 2026-09-07 `progress.json` was at 1,018,405 bytes, **97.1% of
   that cap**. `flagSlimForSync` bought it back to ~89.7%, but it will creep up again.

   The app already survives this (`syncBlobText` falls through to the Git Data blob
   endpoint, which carries the same file to 100MB under the same token and the same
   Contents permission) — this skill did not, and it would have failed in the worst
   possible way: an empty `content` decodes to nothing, `hvr_flags` reads as `[]`, and
   the run reports **"no new flags"**. Silence that looks exactly like good news, from
   the tool whose job is noticing problems.

   So step 4 must handle it. If `content` is empty and `encoding` is `"none"`, refetch by
   sha:

   ```bash
   TOKEN=$(cat "/c/Users/gwigh/.claude/projects/C--Users-gwigh-My-Drive--georgewight03-gmail-com--Hebrew-Learning/secrets/hebrew-reader-sync-token.txt")
   SHA=$(python -c "import json,io;print(json.load(io.open(r'<SCRATCH>\hvr_progress_raw.json',encoding='utf-8'))['sha'])")
   curl -s -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
     "https://api.github.com/repos/George-Wightman/hebrew-reader-sync/git/blobs/$SHA" \
     -o "$SCRATCH/hvr_progress_raw.json"
   unset TOKEN
   ```

   The blob response has the same `{content, encoding}` shape, base64 wrapped at 60
   columns — so the decode below needs no change beyond stripping whitespace, which
   `base64.b64decode` does not do by itself. Use
   `base64.b64decode("".join(raw["content"].split()))`.

3. **Handle the status before parsing anything:**
   - **403** ("Resource not accessible by personal access token"): the token's Contents
     permission isn't actually granted. Tell George plainly and ask him to check/regenerate
     the token with Contents set to Read-only — do not report "no flags", since a broken
     token and an empty backlog look identical if you don't check this first.
   - **404**: no `progress.json` yet — either sync has never run, or a fresh repo. Also not
     "no flags" — say so.
   - **401**: the token itself is invalid or expired.
   - **200**: proceed.
4. Decode, parse, and filter. The file is `{app, schema, updated, device, keys: {...}}`
   where every value under `keys` is itself a JSON *string* (it's a raw localStorage dump)
   — so `hvr_flags` needs parsing twice. Use the Windows-style path here, not the `/c/...`
   one bash used above — this is a plain `python` invocation, and it does not understand
   MSYS paths:

   ```bash
   python -c "
   import json, base64, time
   raw = json.load(open(r'C:\Users\gwigh\AppData\Local\Temp\claude\...\scratchpad\hvr_progress_raw.json', encoding='utf-8'))
   # Empty content means the file crossed 1MB — refetch by sha (see step 2), don't
   # carry on: '' decodes to nothing and every flag silently reads as absent.
   assert raw.get('content'), 'empty content — over 1MB, refetch via git/blobs/' + raw.get('sha','')
   blob = json.loads(base64.b64decode(''.join(raw['content'].split())).decode('utf-8'))
   flags = json.loads(blob['keys'].get('hvr_flags') or '[]')
   health = json.loads(blob['keys'].get('hvr_health') or '[]')

   ledger = {}
   try:
       ledger = json.load(open(r'C:\Users\gwigh\.claude\projects\C--Users-gwigh-My-Drive--georgewight03-gmail-com--Hebrew-Learning\state\handled-flags.json', encoding='utf-8'))
   except FileNotFoundError:
       pass

   new_flags = [f for f in flags if not f.get('resolved') and f.get('id') not in ledger]
   new_flags.sort(key=lambda f: f.get('ts', 0), reverse=True)
   for f in new_flags:
       age_min = round((time.time()*1000 - f.get('ts', 0)) / 60000)
       when = f'{age_min}m ago' if age_min < 60 else f'{round(age_min/60)}h ago'
       ctx = f.get('ctx') or {}
       where = ctx.get('node') or ''
       card = ctx.get('card') or {}
       if card:
           where = (where + ' - ' if where else '') + f\"{card.get('kind','')} {card.get('n','')}/{card.get('of','')} - {card.get('he','')}\"
       print(f'[{when}] {f.get(\"text\",\"\")}')
       if where: print(f'    about: {where}')
   resolved_ct = sum(1 for f in flags if f.get('resolved'))
   ledger_ct = sum(1 for f in flags if not f.get('resolved') and f.get('id') in ledger)
   print(f'\n{len(new_flags)} new, {resolved_ct} marked addressed in-app, {ledger_ct} handled by me previously, {len(flags)} total')
   "
   ```

   (Substitute the actual scratchpad path for `...` — get it from the system prompt, don't
   guess it. Use whichever of `python3` / `python` is on PATH; this project's other tooling
   uses plain `python`.)

   **Prefix the command with `PYTHONIOENCODING=utf-8`** (`PYTHONIOENCODING=utf-8 python -c
   "..."`). Without it, printing a flag whose context carries Hebrew (`card.get('he')`)
   throws `UnicodeEncodeError` on Windows' default console codepage and the whole run
   dies partway through — found the hard way on the very first real flag that had Hebrew
   in its context.

5. Present the **new** flags to George in the response — newest first, his own words
   verbatim, one line of context under each. If a flag's `ctx.ai` array is non-empty and
   the flag reads like it's about an AI call going wrong, pull that detail in too rather
   than making him ask for it — that's the entire reason the context is captured. Mention
   the resolved/handled counts briefly so he knows the filtering is happening, not just
   trust it silently.

   `ctx.sessionId` is not always there, and its absence is not a gap in the data — it's
   the app declining to guess. `sessAll()` only gains an entry when a conversation
   *ends* (`composeEnds`), so a bare "last entry" would silently point at whatever
   conversation happened to finish last, however unrelated or however old. The app
   instead attaches `sessionId` only when that last entry ended within the previous
   half hour — the same window `COACH_IDLE_MS` uses to decide a sitting is over — and
   carries `sessionAt` alongside it so you can see how fresh it actually is. When it's
   there, look it up in `blob['keys']['hvr_sessions']` (same double-parse as
   `hvr_flags` and `hvr_health` — it's a JSON string under `keys`, holding a JSON
   array) and show the last three turns of that conversation under the flag: what he
   said, what the coach answered, how it was judged. That's the material that used to
   take cross-referencing timestamps against `content/nodes.json` to reconstruct by
   hand — now it's just the session the id points at.

   `ctx.sessionLive: true` means something different and is worth saying plainly: he
   was still mid-conversation when he flagged, and those turns are not in
   `hvr_sessions` at all yet — they only get written when the conversation ends. Don't
   go looking for a session id here or report "no conversation found"; say he was
   still talking, and if the flag itself needs that context, the flag's own text is
   all there is until he finishes.

   And when a flag carries **neither** `sessionId` nor `sessionLive` — no error, just
   nothing there — that means no conversation ended in the last half hour and none was
   in progress either. That's itself worth knowing rather than skipping past: it says
   the flag isn't about a recent coaching exchange, so don't manufacture context that
   isn't there by reaching for an old session anyway.

   When a flag carries `ctx.trail`, read the last few entries as where he had just been.
   A flag raised on `lEnd` about something that happened on `lCard` is the normal case,
   not the exception — most flags are written a screen or two after the thing that
   actually prompted them, so the trail is often more informative than the screen the
   flag itself was raised from.
6. **Read `hvr_health` every time, even when there are no new flags.** This is the store
   that exists because a flag could not have told you: on 2026-09-07 `gemini-flash-latest`
   had been refusing the app's thinking control and silently running at its default
   reasoning budget for weeks, costing ~3.4s on every coach turn, and the only reason it
   was found was George raising a flag and someone sitting down with an API key. Nothing
   broke, so nothing said anything.

   Each entry is `{kind, detail, dev, n, first, last}`, one per kind per device, `n`
   counting occurrences. Kinds to expect:

   - `thinking-refused` — a model turned down the reasoning control the app asked for and
     fell back. **This is the one that cost weeks.** Treat any occurrence as a live bug,
     not a curiosity: it means Gemini's API has changed underneath the app again.
   - `model-downshift` — the answering model was not the one asked for first. A few is
     ordinary (503s, per-minute limits). Hundreds means the good model is effectively
     unavailable and the coach has quietly become a weaker one.
   - `pool-downgrade` — `aiModelsFor` dropped to the fast pool because the strong pool hit
     `AI_STRONG_RESERVE`. Working as designed; worth mentioning only if it is frequent,
     because it silently changes what the coach is.

   Report anything with a recent `last`, with its count, **before** the flags — a
   degradation he never noticed outranks a note he chose to write. Say plainly when the
   ledger is empty, too: "nothing has degraded since <first>" is a real result, and it is
   the one that says the last fix held.

7. Treat the result as a punch list, not just a status report: if he asked to "check flags"
   as a prelude to picking something up, offer to start on one rather than just printing
   the list and stopping.

## After addressing a flag

Once a fix for something a flag named has actually shipped and been verified — not before
— add an entry to the ledger:

```json
{
  "<flag id>": {
    "handledAt": "<ISO timestamp>",
    "note": "<one line: what shipped, and the commit if there is one>"
  }
}
```

Read the existing file first (it may already have entries), merge in the new one, and
write the whole object back — don't append raw text or you'll break the JSON. This is the
only way "tick them off so future pulls don't repull the same old flags" works from my
side, since I cannot write `resolved` into his repo.

Telling George which flags this covers is still worth doing even though the ledger is
mine — he may want to also tap "Mark addressed" himself so the app's own view of things
agrees with the repo, but that's his call, not something this skill does for him.

## If the token is broken

Update `hebrew-flags-feedback-channel.md` in memory once it starts working (remove the "not
yet working" note) — don't leave a stale warning sitting there once it's fixed.

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
   blob = json.loads(base64.b64decode(raw['content']).decode('utf-8'))
   flags = json.loads(blob['keys'].get('hvr_flags') or '[]')

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
6. Treat the result as a punch list, not just a status report: if he asked to "check flags"
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

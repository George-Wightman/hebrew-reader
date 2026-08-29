---
name: check-hebrew-flags
description: Use when George asks to check his flags, his notes, his feedback, or "things to change" from the Hebrew Reader app — fetches and shows the in-app flags he raised mid-session via the flag control next to the AI star.
---

# check-hebrew-flags

## What this is

The Hebrew Reader has an in-app flag control (left of the AI star) George taps mid-session
to record a thought — usually a change or a feature idea, not a bug — without leaving the
card he is on. Each flag carries his sentence plus the moment it arrived: the card on
screen, the node and chapter, the SRS state of the words on that card, and the last few AI
calls. See `docs/superpowers/specs/2026-08-28-flagging-things-to-change-design.md` for the
full design.

Flags live in the `hvr_flags` localStorage key, which rides the app's existing
cross-device sync into `progress.json` in a private GitHub repo. This skill is the read
side of that pipeline: fetch the file, pull out the flags, show them.

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
2. Fetch the file:

   ```bash
   TOKEN=$(cat "/c/Users/gwigh/.claude/projects/C--Users-gwigh-My-Drive--georgewight03-gmail-com--Hebrew-Learning/secrets/hebrew-reader-sync-token.txt")
   curl -s -w "\ncode:%{http_code}\n" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/vnd.github+json" \
     "https://api.github.com/repos/George-Wightman/hebrew-reader-sync/contents/progress.json" \
     -o /tmp/hvr_progress_raw.json
   unset TOKEN
   ```

3. **Handle the status before parsing anything:**
   - **403** ("Resource not accessible by personal access token"): the token's Contents
     permission isn't actually granted. Tell George plainly and ask him to check/regenerate
     the token with Contents set to Read-only — do not report "no flags", since a broken
     token and an empty backlog look identical if you don't check this first.
   - **404**: no `progress.json` yet — either sync has never run, or a fresh repo. Also not
     "no flags" — say so.
   - **401**: the token itself is invalid or expired.
   - **200**: proceed.
4. Decode and parse. The file is `{app, schema, updated, device, keys: {...}}` where every
   value under `keys` is itself a JSON *string* (it's a raw localStorage dump) — so
   `hvr_flags` needs parsing twice:

   ```bash
   python3 - <<'PY'
   import json, base64, time
   raw = json.load(open("/tmp/hvr_progress_raw.json", encoding="utf-8"))
   blob = json.loads(base64.b64decode(raw["content"]).decode("utf-8"))
   flags = json.loads(blob["keys"].get("hvr_flags") or "[]")
   flags.sort(key=lambda f: f.get("ts", 0), reverse=True)   # newest first
   for f in flags:
       age_min = round((time.time()*1000 - f.get("ts", 0)) / 60000)
       when = f"{age_min}m ago" if age_min < 60 else f"{round(age_min/60)}h ago"
       ctx = f.get("ctx") or {}
       where = ctx.get("node") or ""
       card = ctx.get("card") or {}
       if card: where = (where + " · " if where else "") + f"{card.get('kind','')} {card.get('n','')}/{card.get('of','')} · {card.get('he','')}"
       print(f"[{when}] {f.get('text','')}")
       if where: print(f"    about: {where}")
   print(f"\n{len(flags)} flag(s) total, updated {blob.get('updated','?')}")
   PY
   ```

   (Use whichever of `python3` / `python` is on PATH — this project's other tooling uses
   plain `python`.)

5. Present the flags to George in the response — newest first, his own words verbatim, one
   line of context under each. If a flag's `ctx.ai` array is non-empty and the flag reads
   like it's about an AI call going wrong, pull that detail in too rather than making him
   ask for it — that's the entire reason the context is captured.
6. Treat the result as a punch list, not just a status report: if he asked to "check flags"
   as a prelude to picking something up, offer to start on one rather than just printing
   the list and stopping.

## If the token is broken

Update `hebrew-flags-feedback-channel.md` in memory once it starts working (remove the "not
yet working" note) — don't leave a stale warning sitting there once it's fixed.

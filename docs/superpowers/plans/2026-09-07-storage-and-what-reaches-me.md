# Storage, Session Capture, and What Reaches Claude — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sync payload survive George's vocabulary growing, then capture the coach conversation and the screens he passed through, so a flag arrives with the session behind it instead of a snapshot of one card.

**Architecture:** Three independent layers, deliberately ordered. First shrink the wire (drop dead keys, then gzip the blob behind a two-phase read-then-write migration). Only then add new synced stores, so they are designed against the post-compression budget rather than the pre-compression one. Finally widen what a flag carries and teach the reading skill to use it.

**Tech Stack:** Single-file vanilla JS (`hebrew-reader.html`, no build step), `CompressionStream`/`DecompressionStream` (native, Chrome 80+), GitHub Contents + Git Data APIs, the in-file `T(...)` self-test harness.

## Global Constraints

- **The file is LF throughout.** `.gitattributes` says `* -text`; git does no conversion. Never introduce CRLF.
- **Verify only after clearing the service worker.** `sw.js` is stale-while-revalidate. Before every verification reload run the unregister+`caches.delete` snippet from `CLAUDE.md`, then navigate with a query string not used before. This applies on localhost *and* on GitHub Pages.
- **After any structural edit** run `grep -oE "^(async )?function [A-Za-z0-9_]+" hebrew-reader.html | sort | uniq -d` — it must print nothing.
- **Self-tests have no localStorage isolation.** Any test touching a real store must restore what it found in a `finally` block. Same for reassigned globals.
- **Async self-tests run one at a time** (since 2026-08-30). Failures carrying another test's message mean a stale cached build — clear the service worker first.
- **Transliteration scheme:** `kh` not `ch`; article and single-letter prepositions join the word; apostrophe before a vowel (`ha'ir`); `ve-` for ו.
- **Never push mid-feature.** Commits accumulate locally; push once at the end of a phase, then poll GitHub Pages and confirm a new-build-only function is present.
- **Baseline before starting:** `progress.json` is 1,026,776 bytes (97.9% of the 1 MB Contents-API inline cutoff); `hebrew-reader.html` is 37,965 lines; self-tests are at 746/746.

---

## File Structure

Everything lands in `hebrew-reader.html` — the project is deliberately one file with no build step, and splitting it is out of scope. Changes cluster in four existing regions:

| Region | Anchor | Responsibility after this plan |
|---|---|---|
| Sync transport | `SYNC_LOCAL_SET` … `syncPush` (~8676–8960) | key selection, encode/decode envelope, compression |
| Flags | `FLAG_KEY` … `flagContext` (~13100) | what a flag captures |
| Health ledger | `HEALTH_KEY` … `healthRows` (~13000) | unchanged; the new stores follow its shape |
| Coach session | `composeEnds` / `composeAdvance` (~22382) | recording a finished conversation |

Two files outside the app:

- `.claude/skills/check-hebrew-flags/SKILL.md` — must decompress, and must read the new stores.
- `docs/superpowers/specs/2026-09-07-compression-and-session-capture-design.md` — written in Task 0.

---

## Task 0: The spec

**Files:**
- Create: `docs/superpowers/specs/2026-09-07-compression-and-session-capture-design.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the approved design every later task implements.

- [ ] **Step 1: Write the spec**

Open with George's own words, per the project's convention:

> "Okay so create a plan of attack for integrating the storage feature and hte converation/ recent pages save for flags and your knowledge for helping me."

and, on why compression comes first:

> "Is their any way we can increase storage I feel like htis has been an issue thats came up before"

It must contain the measurements that justify the ordering, all taken 2026-09-07:

- 753 bytes per word learned; 544 words today = 400 KB in `hvr_library` + `hvr_srs`.
- Projection: 1,000 words → 736 KB; 2,000 words → 1.47 MB in those two stores alone.
- `forms` (40.5%) + `formsMeta` (45.6%) = 86% of the library; `tr`/`en`/`cat` under 6%.
- gzip on the real blob: 1,018,405 → 125,171 bytes raw, **8.1×**.
- Three orphaned synced keys: `hvr_convo` (30.7 KB), `hvr_lastmsg`, `hvr_laneorder` — 31.6 KB with zero code references.

And a "Deferred, with reasons" section carrying forward the three still-open items from `2026-09-07-the-coach-was-thinking-design.md`: the 10-second tail, `best` generated and rendered nowhere on clean turns, and the transliteration scheme absent from `composePrompt`.

- [ ] **Step 2: Commit the spec alone, before any code**

```bash
git add docs/superpowers/specs/2026-09-07-compression-and-session-capture-design.md
git commit -m "Spec: the blob grows with his vocabulary, so compress before storing more"
```

---

## Task 1: Stop syncing three dead keys

**Files:**
- Modify: `hebrew-reader.html` — `SYNC_LOCAL_SET()` (~8690)

**Interfaces:**
- Consumes: `SYNC_LOCAL_SET()`, `syncKeys()`.
- Produces: nothing new. Pure payload reduction, no format change.

`hvr_convo` (30.7 KB), `hvr_lastmsg` and `hvr_laneorder` have **zero references** in `hebrew-reader.html`. They are residue from deleted features that `syncKeys`' prefix scan has been carrying on every sync since. This is free and independent of everything below, so it ships first.

- [ ] **Step 1: Write the failing test**

Add beside the existing `hvr_health` sync test:

```javascript
T("syncKeys: does not carry stores nothing in the app reads", () => {
  /* syncKeys is a PREFIX SCAN over hvr_, so a store outlives the feature that wrote it
     and keeps riding every sync — hvr_convo was 30.7KB of a 1,018KB payload on
     2026-09-07, from a feature that no longer exists. Named here rather than deleted
     from localStorage: his device may still hold them, and this only stops them
     travelling. */
  const dead = ["hvr_convo", "hvr_lastmsg", "hvr_laneorder"];
  dead.forEach(k => assertTrue(SYNC_LOCAL_SET().has(k),
    k + " has no reader in this file and must not be synced"));
});
```

- [ ] **Step 2: Run it and confirm it fails**

Clear the service worker, then open `hebrew-reader.html?selftest&run=t1a`.
Expected: `document.title` is `selftest 746/747`, and `window.__selftest.failures[0].name` is `syncKeys: does not carry stores nothing in the app reads`.

- [ ] **Step 3: Add the keys to the device-local set**

In `SYNC_LOCAL_SET()`, after the `VNOTES_KEY` entry:

```javascript
    /* NOTHING IN THIS FILE READS THESE. They are residue from features that were
       deleted while syncKeys' prefix scan kept carrying them: hvr_convo alone was
       30.7KB of a 1,018KB payload on 2026-09-07. Listed rather than removed from
       localStorage, because deleting a store this file no longer understands is not
       ours to do — this only stops them travelling. Confirm with:
         grep -c '"hvr_convo"' hebrew-reader.html      # must be 0 outside this list */
    "hvr_convo", "hvr_lastmsg", "hvr_laneorder",
```

- [ ] **Step 4: Run the tests**

Clear the service worker, open `hebrew-reader.html?selftest&run=t1b`.
Expected: `selftest 747/747`, `window.__selftest.failures` is `[]`.

- [ ] **Step 5: Commit**

```bash
git add hebrew-reader.html
git commit -m "Three stores outlived the features that wrote them"
```

---

## Task 2: Read both formats

**Files:**
- Modify: `hebrew-reader.html` — after `b64decodeUtf8` (~8777), and `syncPull` (~8878)

**Interfaces:**
- Consumes: `b64decodeUtf8(b64) -> string`, `syncBlobText(j) -> Promise<string>`.
- Produces:
  - `async function syncDecodeBlob(text) -> object` — parses either an uncompressed blob or a `{enc:"gzip"}` envelope, returns the blob object.
  - `SYNC_SCHEMA_GZIP = 2` (constant).

**This task ships alone and is left running until both of George's devices have opened the app.** Writing compressed before every reader understands it makes the file unreadable on the device that has not updated. He has two (a Pixel and a Windows laptop); the gate is human and that is fine.

- [ ] **Step 1: Write the failing test**

```javascript
T("syncDecodeBlob: reads the old format and the compressed one", async () => {
  /* THE MIGRATION, AND THE ONLY PART OF IT THAT CAN STRAND HIM. A device that cannot
     read the compressed envelope sees a corrupt file, and the failure looks like the
     token being wrong. Reading both is permanent — there is no later cleanup task that
     removes the plain branch, because a blob written by an old build can arrive at any
     time. */
  const plain = { app: "hebrew-reader", schema: 1, updated: "2026-09-07T00:00:00.000Z",
                  device: "aaa", keys: { hvr_stats: "{\"a\":1}" } };
  const got = await syncDecodeBlob(JSON.stringify(plain));
  assertEq(got.device, "aaa", "an uncompressed blob still reads");
  assertEq(got.keys.hvr_stats, "{\"a\":1}");

  const packed = await syncEncodeBlob(plain);
  assertTrue(packed.indexOf("\"enc\":\"gzip\"") !== -1, "the envelope names its encoding");
  assertTrue(packed.length < JSON.stringify(plain).length + 200, "and it is an envelope, not a copy");
  const back = await syncDecodeBlob(packed);
  assertEq(back.device, "aaa", "and it round-trips");
  assertEq(back.keys.hvr_stats, "{\"a\":1}");

  /* Hebrew is the whole reason b64encodeUtf8 exists; a compression path that mangles it
     would break every word in the library. */
  const heb = { app: "hebrew-reader", schema: 1, updated: "x", device: "d",
                keys: { hvr_library: "{\"שולחן\":{\"tr\":\"shulkhan\"}}" } };
  const heBack = await syncDecodeBlob(await syncEncodeBlob(heb));
  assertEq(heBack.keys.hvr_library, "{\"שולחן\":{\"tr\":\"shulkhan\"}}");
});
```

- [ ] **Step 2: Run it and confirm it fails**

Clear the service worker, open `hebrew-reader.html?selftest&run=t2a`.
Expected: one failure, message containing `syncDecodeBlob is not defined`.

- [ ] **Step 3: Add the encode/decode pair**

Insert immediately after `b64decodeUtf8`:

```javascript
/* =====================  THE PAYLOAD, COMPRESSED  =====================

   The blob grows at 753 bytes per WORD HE LEARNS — 544 words was 400KB of library and
   SRS on 2026-09-07, and 2,000 words (conversational Hebrew, which is the actual goal)
   projects to 1.47MB in those two stores alone. Success makes the file bigger, so no
   amount of pruning is a strategy: slimming resolved flags bought 68KB, about ninety
   words.

   Compression is, because of what the bytes ARE. `forms` and `formsMeta` are 86% of the
   library — grammar tables and provenance about them, with `formsMeta.lemma` repeating
   the key, `forms.sg.he` repeating the key again and `state` almost always
   "verified"/"verified". That is the most compressible data imaginable, and gzip
   measured 8.1x on the real blob: 1,018,405 bytes to 125,171.

   AN ENVELOPE RATHER THAN RAW GZIP BYTES. Raw would be smaller — one base64 instead of
   two — but the file would stop being JSON, and `blob.app !== "hebrew-reader"` in
   syncPull is the check that catches pointing the app at the wrong repo. Self-describing
   is worth the 25%: 167KB against 1,018KB is still six times the headroom.

   DEGRADES RATHER THAN FAILS. A browser without CompressionStream writes the old format,
   which every build can read. Nothing here is allowed to make a device unable to sync. */
const SYNC_SCHEMA_GZIP = 2;

function syncCanCompress() {
  return typeof CompressionStream === "function" && typeof DecompressionStream === "function";
}

async function syncEncodeBlob(blob) {
  const plain = JSON.stringify(blob);
  if (!syncCanCompress()) return plain;
  try {
    const cs = new CompressionStream("gzip");
    const w = cs.writable.getWriter();
    w.write(new TextEncoder().encode(plain)); w.close();
    const buf = new Uint8Array(await new Response(cs.readable).arrayBuffer());
    let bin = "";
    const CHUNK = 0x8000;                  // same argument-limit guard as b64encodeUtf8
    for (let i = 0; i < buf.length; i += CHUNK)
      bin += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
    return JSON.stringify({ app: "hebrew-reader", schema: SYNC_SCHEMA_GZIP,
                            enc: "gzip", updated: blob.updated, device: blob.device,
                            body: btoa(bin) });
  } catch (e) { return plain; }            // never let compression cost him a sync
}

async function syncDecodeBlob(text) {
  let outer;
  try { outer = JSON.parse(text); }
  catch (e) { throw new Error("the synced file couldn't be read"); }
  if (!outer || outer.enc !== "gzip") return outer;
  if (!syncCanCompress())
    throw new Error("this browser can't read the compressed sync file — update it, or sync from your other device");
  const bin = atob(String(outer.body || "").replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ds = new DecompressionStream("gzip");
  const w = ds.writable.getWriter();
  w.write(bytes); w.close();
  const plain = await new Response(ds.readable).text();
  try { return JSON.parse(plain); }
  catch (e) { throw new Error("the synced file couldn't be read"); }
}
```

- [ ] **Step 4: Route `syncPull` through the decoder**

In `syncPull`, replace:

```javascript
  const text = await syncBlobText(j);
  let blob = null;
  try { blob = JSON.parse(text); }
  catch (e) { throw new Error("the synced file couldn't be read"); }
```

with:

```javascript
  const text = await syncBlobText(j);
  /* syncDecodeBlob owns the parse now, because "is this compressed" has to be answered
     before "is this valid JSON" — and it throws the same message for a genuinely
     unreadable file, so nothing downstream changes. */
  const blob = await syncDecodeBlob(text);
```

- [ ] **Step 5: Run the tests**

Clear the service worker, open `hebrew-reader.html?selftest&run=t2b`.
Expected: `selftest 748/748`, no failures.

- [ ] **Step 6: Verify a real pull still works**

With sync configured, in the console: `await syncRun("manual", { force: true })`.
Expected: resolves `true`, and `syncMeta().lastSync` is within the last minute. The file is still uncompressed at this point — this proves the decoder passes the old format through untouched.

- [ ] **Step 7: Commit, push, and WAIT**

```bash
git add hebrew-reader.html
git commit -m "Teach both devices to read a compressed blob, before either writes one"
git push
```

Then poll Pages until `syncDecodeBlob` is present:

```bash
until curl -s "https://george-wightman.github.io/hebrew-reader/hebrew-reader.html?p=$(date +%s)" | grep -q "function syncDecodeBlob"; do sleep 15; done; echo LIVE
```

**Then stop.** Ask George to open the app on **both** his Pixel and his laptop, and confirm before Task 3. This is the gate; skipping it is how a device gets stranded.

---

## Task 3: Write compressed

**Files:**
- Modify: `hebrew-reader.html` — `syncPush` (~8897)

**Interfaces:**
- Consumes: `syncEncodeBlob(blob) -> Promise<string>`, `syncSnapshotForPush(blob) -> object`.
- Produces: nothing new; changes what lands in the repo.

**Do not start until George has confirmed both devices have loaded the Task 2 build.**

- [ ] **Step 1: Write the failing test**

```javascript
T("syncPush: sends the compressed envelope, slimmed first", async () => {
  /* ORDER MATTERS AND IS EASY TO GET BACKWARDS. syncSnapshotForPush drops resolved
     flags' ctx and stubs the bank; compressing before that would ship the bytes we
     just decided not to send. */
  const realFetch = fetchWithTimeout;
  try {
    let sent = null;
    fetchWithTimeout = (url, opts) => {
      sent = JSON.parse(opts.body);
      return Promise.resolve({ ok: true, status: 200,
        json: async () => ({ content: { sha: "newsha" } }) });
    };
    const blob = { app: "hebrew-reader", schema: 1, updated: "2026-09-07T00:00:00.000Z",
                   device: "aaa", keys: { hvr_flags: JSON.stringify(
                     [{ id: "1", text: "keep", ts: 1, resolved: true, ctx: { report: "x".repeat(4000) } }]) } };
    await syncPush(blob, "oldsha");
    const file = b64decodeUtf8(sent.content);
    assertTrue(file.indexOf("\"enc\":\"gzip\"") !== -1, "the file is the envelope");
    const back = await syncDecodeBlob(file);
    const flags = JSON.parse(back.keys.hvr_flags);
    assertEq(flags[0].text, "keep", "his words survive the round trip");
    assertTrue(!flags[0].ctx, "and the slimming happened BEFORE the compression");
  } finally { fetchWithTimeout = realFetch; }
});
```

- [ ] **Step 2: Run it and confirm it fails**

Clear the service worker, open `hebrew-reader.html?selftest&run=t3a`.
Expected: one failure — `the file is the envelope`.

- [ ] **Step 3: Compress at the wire**

In `syncPush`, replace:

```javascript
  const body = { message: "practice from " + blob.device + " · " + blob.updated.slice(0, 16).replace("T", " "),
                 content: b64encodeUtf8(JSON.stringify(syncSnapshotForPush(blob))) };
```

with:

```javascript
  /* SLIM, THEN COMPRESS, THEN ENCODE — in that order. syncSnapshotForPush decides what
     is worth sending; compressing first would faithfully ship the bytes it was about to
     drop. syncEncodeBlob falls back to plain JSON on a browser without CompressionStream,
     and every build since 2026-09-07 reads both, so a device that cannot compress still
     syncs. */
  const body = { message: "practice from " + blob.device + " · " + blob.updated.slice(0, 16).replace("T", " "),
                 content: b64encodeUtf8(await syncEncodeBlob(syncSnapshotForPush(blob))) };
```

- [ ] **Step 4: Run the tests**

Clear the service worker, open `hebrew-reader.html?selftest&run=t3b`.
Expected: `selftest 749/749`, no failures.

- [ ] **Step 5: Verify against the real repo, and measure**

In the console with sync configured: `await syncRun("manual", { force: true })`.
Then from the shell:

```bash
TOKEN=$(cat "/c/Users/gwigh/.claude/projects/C--Users-gwigh-My-Drive--georgewight03-gmail-com--Hebrew-Learning/secrets/hebrew-reader-sync-token.txt")
curl -s -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/George-Wightman/hebrew-reader-sync/contents/progress.json" \
  | python -c "import sys,json;d=json.load(sys.stdin);print('size', d['size'], '=', round(100*d['size']/1048576,1), '% of cutoff')"
unset TOKEN
```

Expected: roughly **170,000 bytes, ~16%** of the cutoff, down from 1,026,776 / 97.9%.
Then reload the app on the other device and confirm the library still shows 544 words — a round trip through the new format that keeps his data is the only proof that matters.

- [ ] **Step 6: Commit and push**

```bash
git add hebrew-reader.html
git commit -m "Write the blob compressed: 8x on data that grows with his vocabulary"
git push
```

---

## Task 4: Teach the flag reader to decompress

**Files:**
- Modify: `.claude/skills/check-hebrew-flags/SKILL.md` — the decode step

**Interfaces:**
- Consumes: the `{enc:"gzip", body}` envelope from Task 2.
- Produces: nothing the app reads.

Without this, every flag check after Task 3 fails to parse and reports **"no new flags"** — silence indistinguishable from good news, from the tool whose job is noticing problems. That exact failure mode was already fixed once in this skill (the 1 MB blob fallback); this is the same trap wearing a different hat.

- [ ] **Step 1: Update the decode snippet**

Replace the decode lines with:

```python
raw = json.load(open(r'C:\...\scratchpad\hvr_progress_raw.json', encoding='utf-8'))
assert raw.get('content'), 'empty content — over 1MB, refetch via git/blobs/' + raw.get('sha','')
text = base64.b64decode(''.join(raw['content'].split())).decode('utf-8')
outer = json.loads(text)
# Since 2026-09-07 the file is a gzip envelope. Both formats must be readable: an old
# build, or a browser without CompressionStream, still writes plain JSON.
if outer.get('enc') == 'gzip':
    import gzip
    blob = json.loads(gzip.decompress(base64.b64decode(''.join(outer['body'].split()))).decode('utf-8'))
else:
    blob = outer
flags  = json.loads(blob['keys'].get('hvr_flags')  or '[]')
health = json.loads(blob['keys'].get('hvr_health') or '[]')
```

- [ ] **Step 2: Run the skill end to end**

Invoke `check-hebrew-flags`. Expected: it prints the flag summary line and the health section without a traceback, and the counts match the previous run.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/check-hebrew-flags/SKILL.md
git commit -m "The flag reader learns the compressed envelope"
```

---

## Task 5: Record the coach conversation

**Files:**
- Modify: `hebrew-reader.html` — new store beside the health ledger (~13000), writer in `composeAdvance` (~22397)

**Interfaces:**
- Consumes: `composeEnds(c, out) -> boolean`, `healthKeyOf` pattern, `syncDeviceId()`.
- Produces:
  - `SESS_KEY = "hvr_sessions"`, `SESS_MAX = 8`, `SESS_TURN_MAX = 12`
  - `function sessAll() -> Array`
  - `function sessRecord(c, node) -> Array` — appends one finished conversation
  - `function mergeSessions(a, b, cap) -> Array`

The turns already exist on the card as `c.turns`; nothing new is captured mid-session, and the write happens once, when the conversation ends.

- [ ] **Step 1: Write the failing test**

```javascript
T("sessRecord: keeps the conversation, bounded, and never the whole prompt", () => {
  /* WHY THIS EXISTS. Chasing the latency flag meant reconstructing his session from
     hvr_coachlanded TIMESTAMPS and content/nodes.json, because nothing stored what was
     actually said. George: "storing the conversations would give you real material to
     work with in cases like this."

     Bounded on both axes on purpose. A conversation is worth keeping; the 6KB prompt
     that produced each turn is not, and it is regenerable from composePrompt. */
  const was = lsGet(SESS_KEY);
  try {
    lsSet(SESS_KEY, "[]");
    const c = { kind: "compose", objectives: ["שולחן"], turns: [
      { said: "כן השולחן יותר נוח מהמיטה",
        out: { ok: "clean", why: "", say: { he: "אז תישן טוב על השולחן!" } } }
    ] };
    sessRecord(c, "c2-0-1qt5");
    const all = sessAll();
    assertEq(all.length, 1);
    assertEq(all[0].node, "c2-0-1qt5");
    assertEq(all[0].turns[0].said, "כן השולחן יותר נוח מהמיטה", "what he said, verbatim");
    assertEq(all[0].turns[0].say, "אז תישן טוב על השולחן!", "and what the coach answered");
    assertEq(all[0].turns[0].ok, "clean");

    /* Longer than SESS_TURN_MAX keeps the END of the conversation: the turn he flagged
       is the one he had just finished, never the opening. */
    const long = { kind: "compose", objectives: [], turns: [] };
    for (let i = 0; i < SESS_TURN_MAX + 5; i++)
      long.turns.push({ said: "turn" + i, out: { ok: "clean", say: { he: "r" + i } } });
    sessRecord(long, "n");
    const kept = sessAll()[sessAll().length - 1].turns;
    assertEq(kept.length, SESS_TURN_MAX);
    assertEq(kept[kept.length - 1].said, "turn" + (SESS_TURN_MAX + 4), "the last turn survives");

    for (let i = 0; i < SESS_MAX + 4; i++) sessRecord({ turns: [] }, "n" + i);
    assertEq(sessAll().length, SESS_MAX, "and the ring is capped");
  } finally { lsSet(SESS_KEY, was || "[]"); }
});

T("hvr_sessions: syncs, and has a merge rule so it is not overwritten", () => {
  assertTrue(!SYNC_LOCAL_SET().has(SESS_KEY), "the point is that it reaches me");
  assertTrue(!!MERGE_RULES[SESS_KEY], "and it must not fall through to the array default");
  const a = [{ id: "aaa-1", node: "n", at: 1, turns: [] }];
  const b = [{ id: "bbb-1", node: "n", at: 2, turns: [] }];
  assertEq(mergeSessions(a, b, SESS_MAX).length, 2, "two devices' sessions are both kept");
  assertEq(mergeSessions(a, a.slice(), SESS_MAX).length, 1, "a re-push does not duplicate");
});
```

- [ ] **Step 2: Run it and confirm it fails**

Clear the service worker, open `hebrew-reader.html?selftest&run=t5a`.
Expected: two failures, the first containing `sessRecord is not defined`.

- [ ] **Step 3: Add the store**

Insert immediately after `healthLines`:

```javascript
/* =====================  THE CONVERSATIONS THEMSELVES  =====================

   Chasing the latency flag on 2026-09-07 meant rebuilding his session out of
   hvr_coachlanded TIMESTAMPS cross-referenced against content/nodes.json, because
   nothing had stored what was actually said. It worked, and it was detective work.
   George: "storing the conversations would give you real material to work with in cases
   like this."

   WRITTEN ONCE, WHEN THE CONVERSATION ENDS. `c.turns` already holds everything; there is
   no new capture and no per-turn cost. Bounded on both axes — SESS_MAX conversations,
   SESS_TURN_MAX turns each, keeping the END of a long one because the turn he flags is
   the one he just finished.

   THE PROMPT IS NOT KEPT. It is 6KB per turn and regenerable from composePrompt, so
   storing it would trade the thing this is for against the budget compression just
   bought. What is kept is what he said, what the coach answered, and how it was
   judged. */
const SESS_KEY = "hvr_sessions";
const SESS_MAX = 8, SESS_TURN_MAX = 12;

function sessAll() {
  try { const v = JSON.parse(lsGet(SESS_KEY)); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}

function sessRecord(c, node, now) {
  try {
    const at = now || Date.now();
    const turns = ((c && c.turns) || []).slice(-SESS_TURN_MAX).map(t => ({
      said: String((t && t.said) || ""),
      say: String((t && t.out && t.out.say && t.out.say.he) || ""),
      ok: String((t && t.out && t.out.ok) || ""),
      why: String((t && t.out && t.out.why) || "")
    }));
    const list = sessAll().concat([{
      id: syncDeviceId() + "-" + at, at: at, node: String(node || ""),
      lvl: learnerLevel(), objectives: ((c && c.objectives) || []).slice(0, 8),
      turns: turns
    }]).slice(-SESS_MAX);
    lsSet(SESS_KEY, JSON.stringify(list));
    return list;
  } catch (e) { return sessAll(); }
}

/* Keyed by id — device plus timestamp — so two devices' sessions both survive and a
   re-push of the same one does not duplicate. Same shape as mergeFlags, for the same
   reason: without a rule here the array default lets the newer blob win outright. */
function mergeSessions(a, b, cap) {
  const by = {};
  [].concat(Array.isArray(a) ? a : [], Array.isArray(b) ? b : []).forEach(s => {
    if (s && s.id) by[s.id] = s;
  });
  const out = Object.keys(by).map(k => by[k]).sort((x, y) => (x.at || 0) - (y.at || 0));
  return cap ? out.slice(-cap) : out;
}
```

- [ ] **Step 4: Register the merge rule**

In `MERGE_RULES`, after the `hvr_health` entry:

```javascript
  "hvr_sessions":   (a, b) => mergeSessions(a, b, SESS_MAX),
```

- [ ] **Step 5: Write it when the conversation ends**

In `composeAdvance` there is exactly one line that ends the session:

```javascript
  if (composeEnds(c, out)) { learnAdvance(clean); return; }
```

Replace it with:

```javascript
  if (composeEnds(c, out)) {
    /* The whole conversation, once, at the moment it is over — not per turn.
       THE NODE IS AT session.path.id, NOT session.node: campBegin builds
       `path: { id, lesson, camp: true }` and there is no `node` field. Reading
       learnSession.node would silently record every conversation against "". */
    try { sessRecord(c, (learnSession && learnSession.path && learnSession.path.id) || ""); }
    catch (e) {}
    learnAdvance(clean); return;
  }
```

- [ ] **Step 6: Run the tests**

Clear the service worker, open `hebrew-reader.html?selftest&run=t5b`.
Expected: `selftest 751/751`, no failures.

- [ ] **Step 7: Verify against a real conversation**

Run one coach lesson to completion. Then in the console:

```javascript
sessAll().slice(-1)[0].turns.map(t => t.said + "  ->  " + t.say)
```

Expected: the turns you just spoke, in order, with the coach's Hebrew replies.

- [ ] **Step 8: Commit**

```bash
git add hebrew-reader.html
git commit -m "Keep the conversation, not the prompt that produced it"
```

---

## Task 6: Record the screens he passed through

**Files:**
- Modify: `hebrew-reader.html` — beside `SESS_KEY` (~13000), writer in `uhHere`'s view-switch path

**Interfaces:**
- Consumes: `lsGet`/`lsSet`, `VIEW_KEY`, `learnScreenShowing()`.
- Produces:
  - `TRAIL_KEY = "hvr_trail"`, `TRAIL_MAX = 30`
  - `function trailAll() -> Array`
  - `function trailNote(view, screen) -> void`

Deliberately **device-local**, not synced: it is a fact about the device in his hand, and it reaches me through `flagContext` in Task 7 rather than as its own store. That follows the reasoning already recorded beside `AI_LOG_KEY`.

- [ ] **Step 1: Write the failing test**

```javascript
T("trailNote: the last few screens, deduped, never unbounded", () => {
  /* "Recent pages" from George's ask. A flag says where he IS; this says where he had
     just BEEN, which is most of what "you aren't left guessing" means for a flag raised
     two screens after the thing that annoyed him. */
  const was = lsGet(TRAIL_KEY);
  try {
    lsSet(TRAIL_KEY, "[]");
    trailNote("learn", "lCard", 1000);
    trailNote("learn", "lCard", 2000);
    assertEq(trailAll().length, 1, "sitting on one screen is one entry, not a heartbeat");
    assertEq(trailAll()[0].last, 2000, "but the time it was last seen moves");
    trailNote("map", "", 3000);
    trailNote("learn", "lCard", 4000);
    assertEq(trailAll().length, 3, "going back is a new visit, not the old one");
    for (let i = 0; i < TRAIL_MAX + 10; i++) trailNote("v" + i, "", 5000 + i);
    assertEq(trailAll().length, TRAIL_MAX);
  } finally { lsSet(TRAIL_KEY, was || "[]"); }
});
```

- [ ] **Step 2: Run it and confirm it fails**

Clear the service worker, open `hebrew-reader.html?selftest&run=t6a`.
Expected: one failure containing `trailNote is not defined`.

- [ ] **Step 3: Add the trail**

Insert after `mergeSessions`:

```javascript
/* WHERE HE HAD JUST BEEN. A flag records where he IS, and half his flags are raised a
   screen or two after the thing that prompted them — the latency flag was written on
   lEnd, about turns that happened on lCard. Device-local for the same reason the AI log
   is: it is a fact about the device in his hand, and it travels inside the flag rather
   than as a store of its own.

   Consecutive time on one screen is ONE entry with a moving `last`, not a heartbeat.
   Returning to a screen is a new visit, because "he went back" is the interesting part. */
const TRAIL_KEY = "hvr_trail";
const TRAIL_MAX = 30;

function trailAll() {
  try { const v = JSON.parse(lsGet(TRAIL_KEY)); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}

function trailNote(view, screen, now) {
  try {
    const ts = now || Date.now();
    const list = trailAll();
    const top = list[list.length - 1];
    if (top && top.view === view && top.screen === screen) { top.last = ts; }
    else list.push({ view: String(view || ""), screen: String(screen || ""),
                     at: ts, last: ts });
    lsSet(TRAIL_KEY, JSON.stringify(list.slice(-TRAIL_MAX)));
  } catch (e) {}
}
```

- [ ] **Step 4: Call it when the view changes**

`uhHere()` looks like the natural home and is not: it runs only when the inspector opens, so the trail would record the screens he *inspected from*, never the ones he moved through. Put it at the end of `learnRenderCard()`, immediately before that function's closing brace:

```javascript
  /* Every card render is a screen he is looking at. trailNote dedupes consecutive
     identical screens itself, so this is one localStorage write per actual move. */
  try { trailNote(lsGet(VIEW_KEY) || "", learnScreenShowing() || ""); } catch (e) {}
```

- [ ] **Step 5: Run the tests**

Clear the service worker, open `hebrew-reader.html?selftest&run=t6b`.
Expected: `selftest 752/752`, no failures.

- [ ] **Step 6: Verify by using the app**

Move through three or four cards, then open the map, then go back. In the console:

```javascript
trailAll().map(t => t.view + "/" + t.screen)
```

Expected: consecutive identical screens collapsed, the map visit present, the return recorded as a separate entry.

- [ ] **Step 7: Commit**

```bash
git add hebrew-reader.html
git commit -m "A flag says where he is; the trail says where he had just been"
```

---

## Task 7: Put it in the flag, and in the skill

**Files:**
- Modify: `hebrew-reader.html` — `flagContext` (~13099)
- Modify: `.claude/skills/check-hebrew-flags/SKILL.md` — presentation step

**Interfaces:**
- Consumes: `trailAll()`, `sessAll()`, `FLAG_AI_PREVIEW`.
- Produces: `ctx.trail` (array of `{view, screen, at, last}`), `ctx.sessionId` (string).

The session itself rides in `hvr_sessions` and is **referenced** by id rather than copied into the flag — copying would put the same conversation in the payload twice, once per flag raised during it.

- [ ] **Step 1: Write the failing test**

```javascript
T("flagContext: carries the trail, and points at the session rather than copying it", () => {
  const wasT = lsGet(TRAIL_KEY), wasS = lsGet(SESS_KEY);
  try {
    lsSet(TRAIL_KEY, "[]"); lsSet(SESS_KEY, "[]");
    trailNote("learn", "lCard", 1000);
    trailNote("learn", "lEnd", 2000);
    sessRecord({ turns: [{ said: "x", out: { ok: "clean", say: { he: "y" } } }] }, "c2-0-1qt5", 1500);
    const c = flagContext("");
    assertTrue(Array.isArray(c.trail), "the trail rides along");
    assertEq(c.trail[c.trail.length - 1].screen, "lEnd", "newest last");
    assertTrue(c.trail.length <= TRAIL_MAX);
    assertEq(c.sessionId, sessAll()[sessAll().length - 1].id,
             "and the conversation is REFERENCED, so two flags in one session do not store it twice");
    assertTrue(!c.session, "never the turns themselves");
  } finally { lsSet(TRAIL_KEY, wasT || "[]"); lsSet(SESS_KEY, wasS || "[]"); }
});
```

- [ ] **Step 2: Run it and confirm it fails**

Clear the service worker, open `hebrew-reader.html?selftest&run=t7a`.
Expected: one failure containing `the trail rides along`.

- [ ] **Step 3: Add both to `flagContext`**

After the existing `c.ai = ...` block:

```javascript
  /* WHERE HE HAD JUST BEEN, and WHICH CONVERSATION THIS WAS. The latency flag was
     raised on lEnd about turns that happened on lCard, and reconstructing those turns
     took cross-referencing timestamps against content/nodes.json. The trail is copied;
     the session is REFERENCED by id, because two flags raised in one sitting would
     otherwise carry the same conversation twice into a payload we just spent a
     migration shrinking. */
  try { c.trail = trailAll().slice(-TRAIL_MAX); } catch (e) {}
  try {
    const last = sessAll()[sessAll().length - 1];
    if (last) c.sessionId = last.id;
  } catch (e) {}
```

- [ ] **Step 4: Run the tests**

Clear the service worker, open `hebrew-reader.html?selftest&run=t7b`.
Expected: `selftest 753/753`, no failures.

- [ ] **Step 5: Teach the skill to use them**

In `SKILL.md`, extend the presentation step:

> When a flag carries `ctx.sessionId`, look it up in `blob['keys']['hvr_sessions']` and show the last three turns of that conversation under the flag — what he said, what the coach answered, how it was judged. That is the material that had to be reconstructed from timestamps before this existed.
>
> When it carries `ctx.trail`, read the last few entries as where he had just been. A flag raised on `lEnd` about something that happened on `lCard` is the normal case, not the exception.

- [ ] **Step 6: Verify end to end**

Run a coach lesson, raise a flag from the end screen, force a sync, then invoke `check-hebrew-flags`.
Expected: the new flag appears with the conversation's last turns printed beneath it and the trail showing the screens leading up to it.

- [ ] **Step 7: Commit and push**

```bash
git add hebrew-reader.html .claude/skills/check-hebrew-flags/SKILL.md
git commit -m "A flag arrives with the session behind it"
git push
```

Then poll Pages and confirm live:

```bash
until curl -s "https://george-wightman.github.io/hebrew-reader/hebrew-reader.html?p=$(date +%s)" | grep -q "function trailNote"; do sleep 15; done; echo LIVE
```

---

## Open question to settle during Task 3

`syncPush` uses the Contents API `PUT`, whose size limit is **unverified**. It has never mattered because the file has always been under 1 MB, and after Task 3 it will be ~170 KB — so compression removes the risk rather than answering the question.

Settle it cheaply while sync is already under test: `PUT` a ~2 MB dummy to `sizetest.json` in the sync repo (never `progress.json`), record whether it succeeds, then delete it. If it fails, note in the spec that `syncPush` would need the Git Data blob path too — as `syncBlobText` already has for reads — and that compression is what keeps that hypothetical.

## Verification checklist for every task

1. Clear the service worker before each reload (`CLAUDE.md` snippet), navigate with a fresh query string.
2. Read `document.title` and `window.__selftest.failures` programmatically — never trust the screenshot.
3. `grep -oE "^(async )?function [A-Za-z0-9_]+" hebrew-reader.html | sort | uniq -d` prints nothing.
4. `python -c "import io; d=io.open('hebrew-reader.html','rb').read(); print(d.count(b'\r\n'))"` prints `0`.
5. Push once per phase, then poll Pages and confirm a new-build-only function is present.

# Word Forms — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every library word a verified bank of inflected forms, generated in batches by the Gemini API and checked best-of-three, viewable in a per-word panel — with nothing else in the app changed.

**Architecture:** All new code lives in `hebrew-reader.html` (single-file app, no build, no dependencies — keep it that way). Logic is split into *pure functions* that take their data as arguments and *thin wrappers* that load/save `localStorage` around them. That split is what makes this testable at all: a new `?selftest=1` harness asserts against the pure functions without touching George's real store.

**Tech Stack:** Vanilla ES6 in one `<script>`, `localStorage` + IndexedDB, Gemini `generateContent` via the existing `geminiRequest()`. Verification: in-app self-test harness run headlessly through a local `python -m http.server`.

## Global Constraints

- **Single file.** No new files except the plan/spec docs and `.claude/launch.json`. No npm, no bundler, no dependencies.
- **No git.** This folder is not a repository. "Commit" steps mean **save a timestamped backup** using the existing convention: `hebrew-reader.BACKUP-before-<topic>-YYYYMMDD-HHMM.html`.
- **Declaration order is load-bearing.** Function declarations hoist; `const` does not. New top-level `const`s must not be read at load time by code placed earlier in the file. This codebase has been bitten by exactly this (see the `syncShelves` TDZ note, hebrew-reader.html:4198).
- **Enrichment is lite-only.** Every enrichment call passes `GEMINI_MODELS_FAST`. It must never consume the 20/day `flash-latest` quota that audio transcription depends on.
- **Enrichment uses full thinking**, not `GEMINI_THINKING` (`thinkingLevel: "minimal"`).
- **Never overwrite a `manual` form.** `formsMeta.src[tag] === "manual"` is permanent.
- **Only `verified` forms may be acted on.** `uncertain` forms display, marked, and are otherwise inert.
- **Nothing existing changes behaviour in Phase 1.** No lens, no row changes, no lemma re-basing. The only user-visible additions are the panel, the "fill in forms" button, and the clitic suggestion in Pending.
- Form tag strings, exact: `inf`, `pres.ms`, `pres.fs`, `pres.mp`, `pres.fp`, `past.1s`, `past.2ms`, `past.2fs`, `past.3ms`, `past.3fs`, `past.1p`, `past.3p`, `fut.1s`, `fut.2ms`, `fut.2fs`, `fut.3ms`, `fut.3fs`, `fut.1p`, `fut.3p`, `imp.ms`, `imp.fs`, `ms`, `fs`, `mp`, `fp`, `sg`, `pl`, `1s`, `2ms`, `2fs`, `3ms`, `3fs`, `1p`, `2p`, `3p`.
- `pos` values, exact: `verb`, `adj`, `noun`, `prep`, `pron`, `num`, `adv`, `phrase`.
- Form state values, exact: `verified`, `uncertain`. Provenance values, exact: `dict`, `ai`, `manual`.

## File Structure

| File | Responsibility |
|---|---|
| `hebrew-reader.html` | Everything. New code goes in two new clearly-delimited sections (below). |
| `.claude/launch.json` | Create. Serves the folder so the self-test harness can be run in a browser. |

**Two new sections in `hebrew-reader.html`:**

1. `/* ===================== WORD FORMS ===================== */` — inserted immediately **after** the `genderPairFor()` function (currently ends hebrew-reader.html:2343, before the `STOPLIST` const). Holds the tag vocabulary, bank accessors, reconciliation, clitic suggestion, re-key helper, queue store, and the enrichment runner. It is the conceptual successor to `GENDER_PAIRS` and sits where a reader will look for it.
2. `/* ===================== SELF TESTS ===================== */` — appended at the **very end** of the `<script>`, after the existing init block, so every `const` in the file is initialised before tests read it.

---

## Task 1: Self-test harness and a way to run it

Nothing else in this plan is verifiable until this exists. It must be inert on a normal page load.

**Files:**
- Create: `.claude/launch.json`
- Modify: `hebrew-reader.html` — append the SELF TESTS section at the end of the `<script>`

**Interfaces:**
- Produces: `T(name, fn)` registers a test; `assertEq(actual, expected, msg)`, `assertTrue(cond, msg)`, `assertNull(v, msg)` throw on failure; `runSelfTests()` executes all and populates `window.__selftest = { pass, fail, failures: [{name, error}] }`.

- [ ] **Step 1: Create the launch config**

Create `.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "hebrew-reader",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "http.server", "8777"],
      "port": 8777
    }
  ]
}
```

- [ ] **Step 2: Write the harness**

Append at the very end of the `<script>` block in `hebrew-reader.html`:

```js
/* =====================  SELF TESTS  =====================
   Inert unless the page is opened with ?selftest=1. Tests assert against the
   PURE functions only — nothing here may read or write real localStorage, or
   running the suite would eat George's library. Fake stores are passed in as
   plain objects instead. Results land on window.__selftest so a headless
   browser can read them without scraping the DOM. */
const SELFTESTS = [];
function T(name, fn) { SELFTESTS.push({ name: name, fn: fn }); }
function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error((msg || "") + "\n  expected: " + b + "\n  actual:   " + a);
}
function assertTrue(cond, msg) { if (!cond) throw new Error(msg || "expected true"); }
function assertNull(v, msg) { if (v !== null) throw new Error((msg || "expected null") + ", got " + JSON.stringify(v)); }

function runSelfTests() {
  const out = { pass: 0, fail: 0, failures: [] };
  SELFTESTS.forEach(t => {
    try { t.fn(); out.pass++; console.log("PASS " + t.name); }
    catch (e) { out.fail++; out.failures.push({ name: t.name, error: String(e.message || e) });
                console.error("FAIL " + t.name + " — " + (e.message || e)); }
  });
  window.__selftest = out;
  console.log("SELFTEST " + out.pass + " passed, " + out.fail + " failed");
  document.title = "selftest " + out.pass + "/" + (out.pass + out.fail);
  return out;
}

if (location.search.indexOf("selftest") !== -1) {
  /* after the init block has run, so every const is initialised */
  setTimeout(runSelfTests, 0);
}
```

- [ ] **Step 3: Add one failing test to prove the harness reports failure**

Add immediately above the `if (location.search...)` line:

```js
T("harness reports failures", () => { assertEq(1, 2, "deliberate"); });
```

- [ ] **Step 4: Run it and verify it reports the failure**

Start the server with `preview_start` (name `hebrew-reader`), open
`http://localhost:8777/hebrew-reader.html?selftest=1`, then read:

```js
window.__selftest
```

Expected: `{ pass: 0, fail: 1, failures: [{ name: "harness reports failures", ... }] }`

- [ ] **Step 5: Replace the deliberate failure with a real passing test**

Replace that `T(...)` line with:

```js
T("harness runs", () => { assertEq(2 + 2, 4); assertTrue(true); assertNull(null); });
```

Re-run. Expected: `{ pass: 1, fail: 0, failures: [] }`

- [ ] **Step 6: Verify a normal load is unaffected**

Open `http://localhost:8777/hebrew-reader.html` (no query string) and read:

```js
[typeof window.__selftest, document.title]
```

Expected: `["undefined", "Hebrew Voice Note Reader"]` — the title must be untouched.

- [ ] **Step 7: Back up**

```bash
cp hebrew-reader.html "hebrew-reader.BACKUP-before-word-forms-$(date +%Y%m%d-%H%M).html"
```

---

## Task 2: Tag vocabulary and bank accessors

**Files:**
- Modify: `hebrew-reader.html` — new WORD FORMS section, after `genderPairFor()` (hebrew-reader.html:2343)
- Test: SELF TESTS section

**Interfaces:**
- Produces: `FORM_TAGS` (object, `pos` → array of tag strings), `CITATION_TAG` (object, `pos` → tag string or `undefined`), `formTagsFor(pos)` → array, `formCitation(key, entry)` → `{he, tr}`, `formGet(entry, tag)` → `{he, tr}` or `null`, `formCount(entry)` → number.

- [ ] **Step 1: Write the failing tests**

Add to the SELF TESTS section:

```js
T("formTagsFor: verb has 21 tags in fixed order", () => {
  const t = formTagsFor("verb");
  assertEq(t.length, 21);
  assertEq(t[0], "inf");
  assertEq(t[1], "pres.ms");
  assertEq(t[20], "imp.fs");
});
T("formTagsFor: adjective has exactly the four agreement tags", () => {
  assertEq(formTagsFor("adj"), ["ms", "fs", "mp", "fp"]);
});
T("formTagsFor: noun has number only — gender is a label, not a form", () => {
  assertEq(formTagsFor("noun"), ["sg", "pl"]);
});
T("formTagsFor: preposition inflects for person", () => {
  assertEq(formTagsFor("prep"), ["1s","2ms","2fs","3ms","3fs","1p","2p","3p"]);
});
T("formTagsFor: adverbs and phrases have no bank", () => {
  assertEq(formTagsFor("adv"), []);
  assertEq(formTagsFor("phrase"), []);
});
T("formTagsFor: unknown pos is empty, not a crash", () => {
  assertEq(formTagsFor("wibble"), []);
  assertEq(formTagsFor(null), []);
});
T("formGet: returns null for a missing bank or tag", () => {
  assertNull(formGet(null, "ms"));
  assertNull(formGet({}, "ms"));
  assertNull(formGet({ forms: {} }, "ms"));
});
T("formGet: returns the form when present", () => {
  assertEq(formGet({ forms: { fs: { he: "גדולה", tr: "gedola" } } }, "fs"),
           { he: "גדולה", tr: "gedola" });
});
T("formCitation: verb cites to the infinitive", () => {
  const e = { pos: "verb", tr: "x", forms: { inf: { he: "לסיים", tr: "lesayem" },
                                             "pres.ms": { he: "מסיים", tr: "mesayem" } } };
  assertEq(formCitation("לסיים", e), { he: "לסיים", tr: "lesayem" });
});
T("formCitation: falls back to the row key when there is no bank", () => {
  assertEq(formCitation("שלום", { tr: "shalom" }), { he: "שלום", tr: "shalom" });
});
T("formCount: counts only real forms", () => {
  assertEq(formCount({ forms: { ms: { he: "א", tr: "a" }, fs: null } }), 1);
  assertEq(formCount({}), 0);
});
```

- [ ] **Step 2: Run and verify they fail**

Reload `?selftest=1`, read `window.__selftest`.
Expected: `fail` ≥ 11, every failure message containing `formTagsFor is not defined` or similar.

- [ ] **Step 3: Implement**

Insert as the start of the new WORD FORMS section:

```js
/* =====================  WORD FORMS  =====================
   Supersedes GENDER_PAIRS as the model of "a word and its forms". The whole
   point is ONE tag vocabulary for every part of speech: `pos` decides which
   tags get populated and nothing else in the file branches on part of speech.
   That is what lets tense arrive later without a schema change — and what
   stopped this being gender-with-extras bolted on, which is exactly what the
   previous pass built and why it couldn't grow.

   Tag grammar: [tense.]person+gender+number. An adjective is the same map with
   no tense segment. Order within each array is DISPLAY order — the panel's
   table reads it straight through, so it is not free to reshuffle. */
const FORM_TAGS = {
  verb: ["inf",
         "pres.ms", "pres.fs", "pres.mp", "pres.fp",
         "past.1s", "past.2ms", "past.2fs", "past.3ms", "past.3fs", "past.1p", "past.3p",
         "fut.1s",  "fut.2ms",  "fut.2fs",  "fut.3ms",  "fut.3fs",  "fut.1p",  "fut.3p",
         "imp.ms", "imp.fs"],
  adj:  ["ms", "fs", "mp", "fp"],
  pron: ["ms", "fs", "mp", "fp"],
  /* A noun does NOT inflect for gender — it HAS one, stored as entry.gender.
     That distinction is the whole reason `delet gedola` is right and
     `delet gadol` is wrong, and it is what the pad will check agreement
     against in Phase 3. Do not add ms/fs here. */
  noun: ["sg", "pl"],
  prep: ["1s", "2ms", "2fs", "3ms", "3fs", "1p", "2p", "3p"],
  num:  ["ms", "fs"],
  adv:  [],
  phrase: []
};

/* Which tag the row displays when no lens is set (Phase 2). A pos absent from
   this map cites to the row key itself — correct for prepositions, whose bare
   form (ל, ב, עם) is the entry and whose bank is all inflections of it. */
const CITATION_TAG = { verb: "inf", adj: "ms", pron: "ms", noun: "sg", num: "ms" };

function formTagsFor(pos) { return FORM_TAGS[pos] || []; }

function formGet(entry, tag) {
  if (!entry || !entry.forms) return null;
  const f = entry.forms[tag];
  return (f && f.he) ? f : null;
}

function formCitation(key, entry) {
  const tag = entry && CITATION_TAG[entry.pos];
  const f = tag ? formGet(entry, tag) : null;
  return f || { he: key, tr: (entry && entry.tr) || "" };
}

function formCount(entry) {
  if (!entry || !entry.forms) return 0;
  return Object.keys(entry.forms).filter(t => formGet(entry, t)).length;
}
```

- [ ] **Step 4: Run and verify they pass**

Reload `?selftest=1`. Expected: `fail: 0`.

- [ ] **Step 5: Back up**

```bash
cp hebrew-reader.html "hebrew-reader.BACKUP-forms-tags-$(date +%Y%m%d-%H%M).html"
```

---

## Task 3: The re-key helper

The riskiest code in the whole feature, built early and deliberately on the small clitic set so Phase 4 inherits it proven. Renaming a library key must carry **every** reference or it silently corrupts drills, pairs and cached audio.

**Files:**
- Modify: `hebrew-reader.html` — WORD FORMS section; add `audioDel()` beside `audioPut()` (hebrew-reader.html:6830)
- Test: SELF TESTS section

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `rekeyInStores(stores, from, to)` → `{ stores, merged: bool, changed: bool }` (pure); `audioDel(key)` → Promise<bool>; `rekeyWord(from, to)` → Promise<bool> (loads, calls `rekeyInStores`, saves, moves the audio blob).

`stores` is a plain object with these exact keys, each a plain object:
`{ lib, srs, focus, aliases, known, archive, struggle }`

**Corrected during execution:** `hvr_pathscores` was originally in this list and has been
removed. It is keyed by *section id*, not by word (`pathLessonRec`, hebrew-reader.html:8181),
so re-keying it with a Hebrew string is a silent no-op that implies a relationship which
does not exist. Phase 4 must not re-add it.

- [ ] **Step 1: Write the failing tests**

```js
function fakeStores() {
  return {
    lib: { "ההזדמנות": { tr: "ha-izdamnut", en: "the opportunity", cat: "Everyday things",
                          opp: "", seen: 3, added: "2026-08-01", shelf: "focus" } },
    srs:      { "ההזדמנות": { prod: { n: 2 }, recv: { n: 1 } } },
    focus:    { "ההזדמנות": 1 },
    aliases:  { "haizdamnut": "ההזדמנות" },
    known:    { "ההזדמנות": 1 },
    archive:  { "ההזדמנות": ["2026-08-02"] },
    struggle: { "ההזדמנות": 4 },
    pathScores: { "ההזדמנות": 7 }
  };
}

T("rekeyInStores: moves the library row and every reference", () => {
  const s = fakeStores();
  const r = rekeyInStores(s, "ההזדמנות", "הזדמנות");
  assertTrue(r.changed, "should report changed");
  assertTrue(!r.merged, "nothing to merge into");
  assertTrue(!s.lib["ההזדמנות"], "old library key must be gone");
  assertEq(s.lib["הזדמנות"].seen, 3);
  assertEq(s.srs["הזדמנות"].prod.n, 2);
  assertEq(s.focus["הזדמנות"], 1);
  assertEq(s.known["הזדמנות"], 1);
  assertEq(s.archive["הזדמנות"], ["2026-08-02"]);
  assertEq(s.struggle["הזדמנות"], 4);
  assertEq(s.pathScores["הזדמנות"], 7);
  assertTrue(!s.srs["ההזדמנות"] && !s.focus["ההזדמנות"], "old refs must be gone");
});
T("rekeyInStores: repoints aliases that pointed at the old key", () => {
  const s = fakeStores();
  rekeyInStores(s, "ההזדמנות", "הזדמנות");
  assertEq(s.aliases["haizdamnut"], "הזדמנות");
});
T("rekeyInStores: repoints an opposites partner", () => {
  const s = fakeStores();
  s.lib["קטן"] = { tr: "katan", opp: "ההזדמנות" };
  s.lib["ההזדמנות"].opp = "קטן";
  rekeyInStores(s, "ההזדמנות", "הזדמנות");
  assertEq(s.lib["קטן"].opp, "הזדמנות");
  assertEq(s.lib["הזדמנות"].opp, "קטן");
});
T("rekeyInStores: merges into an existing target instead of clobbering it", () => {
  const s = fakeStores();
  s.lib["הזדמנות"] = { tr: "izdamnut", en: "opportunity", cat: "Uncategorised",
                        opp: "", seen: 5, added: "2026-07-01", shelf: "focus" };
  const r = rekeyInStores(s, "ההזדמנות", "הזדמנות");
  assertTrue(r.merged, "should report a merge");
  assertEq(s.lib["הזדמנות"].seen, 8, "seen counts add up");
  assertEq(s.lib["הזדמנות"].added, "2026-07-01", "older added date wins");
  assertEq(s.lib["הזדמנות"].cat, "Everyday things", "a real category beats Uncategorised");
  assertEq(s.lib["הזדמנות"].tr, "izdamnut", "the surviving row keeps its own translit");
});
T("rekeyInStores: a no-op rename changes nothing", () => {
  const s = fakeStores();
  const r = rekeyInStores(s, "ההזדמנות", "ההזדמנות");
  assertTrue(!r.changed, "same key must be a no-op");
  assertEq(s.lib["ההזדמנות"].seen, 3);
});
T("rekeyInStores: a missing source is a safe no-op", () => {
  const s = fakeStores();
  const r = rekeyInStores(s, "אין־כזה", "משהו");
  assertTrue(!r.changed);
  assertTrue(!s.lib["משהו"]);
});
```

- [ ] **Step 2: Run and verify they fail**

Expected: 6 failures, `rekeyInStores is not defined`.

- [ ] **Step 3: Implement `rekeyInStores`**

Add to the WORD FORMS section:

```js
/* Renaming a library key means moving EVERY reference to it. Getting this wrong
   is not a cosmetic bug: a missed store leaves drill history pointing at a word
   that no longer exists, an opposites partner pointing into space, or an alias
   resolving to a dead key. deleteWord() (hebrew-reader.html:4290) learned this
   the hard way with three kinds of wreckage; this is the same lesson as a
   reusable function, because Phase 4 re-bases ~40 rows with it.

   Pure on purpose — `stores` is a plain object of plain objects, so the whole
   thing is testable without touching George's real library. rekeyWord() below
   is the thin load/save wrapper. Mutates `stores` in place and returns a report. */
const REKEY_FLAT_STORES = ["srs", "focus", "known", "archive", "struggle", "pathScores"];

function rekeyInStores(stores, from, to) {
  const res = { stores: stores, merged: false, changed: false };
  if (!from || !to || from === to) return res;
  const lib = stores.lib || {};
  const src = lib[from];
  if (!src) return res;

  const dst = lib[to];
  if (dst) {
    /* Merge, don't clobber — same contract syncGender established
       (hebrew-reader.html:6689). The SURVIVING row keeps its own tr/en, because
       it is the one George has been looking at; only genuinely missing fields
       are filled from the row being folded in. */
    res.merged = true;
    dst.seen = (dst.seen || 0) + (src.seen || 0);
    if (!dst.tr && src.tr) dst.tr = src.tr;
    if (!dst.en && src.en) dst.en = src.en;
    if ((!dst.cat || dst.cat === "Uncategorised") && src.cat && src.cat !== "Uncategorised") dst.cat = src.cat;
    if (!dst.opp && src.opp) dst.opp = src.opp;
    if (!dst.forms && src.forms) { dst.forms = src.forms; dst.formsMeta = src.formsMeta; }
    if (src.added && (!dst.added || src.added < dst.added)) dst.added = src.added;
    /* focus beats reserve: if either half was in play, the survivor is in play */
    if (src.shelf === "focus") dst.shelf = "focus";
  } else {
    lib[to] = src;
  }
  delete lib[from];

  /* An opposites partner stores the key as plain text, so it has to be rewritten
     on the OTHER row too, in both directions. */
  Object.keys(lib).forEach(k => { if (lib[k] && lib[k].opp === from) lib[k].opp = to; });

  REKEY_FLAT_STORES.forEach(name => {
    const st = stores[name];
    if (!st || st[from] === undefined) return;
    if (st[to] === undefined) st[to] = st[from];
    delete st[from];
  });

  /* Aliases map spelling -> key, so the VALUE is what moves, not the key. */
  const a = stores.aliases;
  if (a) Object.keys(a).forEach(sp => { if (a[sp] === from) a[sp] = to; });

  res.changed = true;
  return res;
}
```

- [ ] **Step 4: Run and verify they pass**

Expected: `fail: 0`.

- [ ] **Step 5: Add `audioDel` beside `audioPut`**

Insert immediately after `audioPut()` (hebrew-reader.html:6839):

```js
/* Needed by rekeyWord(): a cached recording is keyed by the Hebrew string, so
   renaming a word without moving its blob silently orphans every clip George
   has paid an API call for. */
function audioDel(key) {
  return audioDb().then(db => new Promise(resolve => {
    try {
      const tx = db.transaction(AUDIO_STORE, "readwrite");
      tx.objectStore(AUDIO_STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) { resolve(false); }
  })).catch(() => false);
}
```

- [ ] **Step 6: Implement the `rekeyWord` wrapper**

Add to the WORD FORMS section:

```js
/* Thin load/save wrapper around rekeyInStores, plus the one thing that cannot
   live in a pure function: moving the IndexedDB audio blob. */
async function rekeyWord(from, to) {
  const stores = {
    lib: libAll(), srs: srsAll(), focus: focusAll(), aliases: aliasAll(),
    known: knownAll(), archive: archiveAll(), struggle: struggleAll(),
    pathScores: pathScoresAll()
  };
  const res = rekeyInStores(stores, from, to);
  if (!res.changed) return false;

  libSave(stores.lib); srsSave(stores.srs); focusSave(stores.focus);
  aliasSave(stores.aliases); knownSave(stores.known); archiveSave(stores.archive);
  struggleSave(stores.struggle); pathScoresSave(stores.pathScores);

  const blob = await audioGet(from);
  if (blob) {
    const existing = await audioGet(to);
    if (!existing) await audioPut(to, blob);
    await audioDel(from);
  }
  rebuildTrIndex();
  return true;
}
```

- [ ] **Step 7: Verify every store accessor named above actually exists**

Run:

```bash
grep -n "function knownAll\|function knownSave\|function archiveAll\|function archiveSave\|function struggleAll\|function struggleSave\|function pathScoresAll\|function pathScoresSave\|function aliasAll\|function aliasSave\|function srsSave" hebrew-reader.html
```

Expected: one line per name. **If any is missing, write the two-line
`xAll()`/`xSave()` pair for it in the same style as `focusAll`/`focusSave`
(hebrew-reader.html:4134) before continuing** — `rekeyWord` referencing a
function that does not exist would throw at runtime and lose data mid-rename.

- [ ] **Step 8: Back up**

```bash
cp hebrew-reader.html "hebrew-reader.BACKUP-forms-rekey-$(date +%Y%m%d-%H%M).html"
```

---

## Task 4: Clitic suggestion (suggest only — never strip)

**Files:**
- Modify: `hebrew-reader.html` — WORD FORMS section
- Test: SELF TESTS section

**Interfaces:**
- Consumes: nothing.
- Produces: `cliticSuggestion(heb, tr, en)` → `{ clitic, letter, rest, restTr }` or `null`.

**Critical:** this function *suggests*. It never rewrites a store. `בהצלחה` ("good luck") and `לשלוח` ("to send") are shape-identical to `ההזדמנות` ("the opportunity") and must not be silently stripped — only the meaning separates them, which is why the decision goes to George (Pending) or the model (Task 8), never to a rule.

- [ ] **Step 1: Write the failing tests**

```js
T("cliticSuggestion: flags a definite article on an unknown noun", () => {
  const s = cliticSuggestion("ההזדמנות", "ha-izdamnut", "the opportunity");
  assertEq(s.letter, "ה");
  assertEq(s.rest, "הזדמנות");
  assertEq(s.restTr, "izdamnut");
});
T("cliticSuggestion: never fires on an infinitive", () => {
  assertNull(cliticSuggestion("לשלוח", "lishloakh", "to send"));
  assertNull(cliticSuggestion("להגיד", "lehagid", "to say"));
  assertNull(cliticSuggestion("לדבר", "ledaber", "to talk"));
});
T("cliticSuggestion: never fires on a multi-word phrase", () => {
  assertNull(cliticSuggestion("בזמן האחרון", "bazman ha'acharon", "recently"));
});
T("cliticSuggestion: does not fire when the Hebrew does not start with the letter", () => {
  assertNull(cliticSuggestion("מסתכל", "mistakel", "looking"));
  assertNull(cliticSuggestion("מחר", "machar", "tomorrow"));
});
T("cliticSuggestion: does not fire when stripping leaves a fragment", () => {
  assertNull(cliticSuggestion("הר", "har", "mountain"));
  assertNull(cliticSuggestion("בית", "ba-it", "house"));
});
T("cliticSuggestion: fires on ve- and be- with a real remainder", () => {
  assertEq(cliticSuggestion("והמילים", "ve-ha-milim", "and the words").letter, "ו");
  assertEq(cliticSuggestion("בהפכים", "be-hafachim", "in opposites").rest, "הפכים");
});
```

- [ ] **Step 2: Run and verify they fail**

Expected: 6 failures, `cliticSuggestion is not defined`.

- [ ] **Step 3: Implement**

```js
/* SUGGESTS a clitic split; never applies one. The three cases below are
   indistinguishable by shape — single word, starts with a clitic letter,
   translit carries the prefix — and only the MEANING separates them:

     ההזדמנות  ha-izdamnut   "the opportunity"  -> strip
     בהצלחה    be-hatslakha  "good luck"        -> DO NOT (הצלחה is "success")
     לשלוח     lishloakh     "to send"          -> DO NOT (that ל is the infinitive)

   So this returns a suggestion for a human (Pending) or a model (Task 8) to
   rule on. stripPrefixEntry() (hebrew-reader.html:6038) applies its split
   automatically, which is exactly why it must NOT be wired into cardEntry():
   it would turn בהצלחה into "success" to fix ההזדמנות.

   Infinitives are excluded structurally rather than by gloss text: a Hebrew
   infinitive's translit begins li-/le-/la- with NO hyphen after it, because
   the ל is part of the word. AI_PREFIXES requires the hyphen, so "lishloakh"
   never matches while "le-da'ati" does. */
const CLITIC_MIN_REST = 2;

function cliticSuggestion(heb, tr, en) {
  const h = String(heb || "").trim(), t = String(tr || "").trim().toLowerCase();
  if (!h || !t) return null;
  if (/\s/.test(h)) return null;              // multi-word: an idiom, not a prefixed noun
  for (const [p, letter] of AI_PREFIXES) {
    if (t.indexOf(p + "-") !== 0) continue;   // requires the hyphen — see comment above
    if (h.charAt(0) !== letter) continue;     // letter is part of the word, not a prefix
    const rest = h.slice(1);
    let restTr = t.slice(p.length + 1);
    if (restTr.charAt(0) === "'" || restTr.charAt(0) === "’") restTr = restTr.slice(1);
    if (rest.length < CLITIC_MIN_REST || restTr.length < CLITIC_MIN_REST) return null;
    return { clitic: p, letter: letter, rest: rest, restTr: restTr };
  }
  return null;
}
```

- [ ] **Step 4: Run and verify they pass**

Expected: `fail: 0`. If "does not fire when stripping leaves a fragment" fails on
`בית`/`ba-it`, confirm `restTr` is `"it"` (length 2) — adjust the test's example
rather than weakening `CLITIC_MIN_REST`, which protects real words.

- [ ] **Step 5: Back up**

```bash
cp hebrew-reader.html "hebrew-reader.BACKUP-forms-clitic-$(date +%Y%m%d-%H%M).html"
```

---

## Task 5: Best-of-three reconciliation

**Files:**
- Modify: `hebrew-reader.html` — WORD FORMS section
- Test: SELF TESTS section

**Interfaces:**
- Consumes: nothing.
- Produces: `reconcileForms(a, b, c)` → `{ forms: {tag: {he, tr}}, state: {tag: "verified"|"uncertain"} }`.
  Each of `a`, `b`, `c` is `{tag: {he, tr}}` or `null`/omitted. `c` is the tiebreak round.
- Produces: `disputedTags(a, b)` → array of tag strings where `a` and `b` disagree.
- Produces (test helper, used by Tasks 6, 10 and 12): `F(he, tr)` → `{he, tr}`, declared in
  the SELF TESTS section by Step 1 below.

- [ ] **Step 1: Write the failing tests**

```js
const F = (he, tr) => ({ he: he, tr: tr });

T("disputedTags: lists only genuine disagreements", () => {
  const a = { ms: F("גדול", "gadol"), fs: F("גדולה", "gedola") };
  const b = { ms: F("גדול", "gadol"), fs: F("גדולת", "gedolat") };
  assertEq(disputedTags(a, b), ["fs"]);
});
T("disputedTags: a tag missing from one side counts as disputed", () => {
  assertEq(disputedTags({ ms: F("גדול", "gadol") }, {}), ["ms"]);
});
T("disputedTags: compares Hebrew only — translit spelling is not a disagreement", () => {
  const a = { ms: F("גדול", "gadol") }, b = { ms: F("גדול", "gadhol") };
  assertEq(disputedTags(a, b), []);
});
T("reconcileForms: two passes agreeing is verified, no third call needed", () => {
  const a = { ms: F("גדול", "gadol") };
  const r = reconcileForms(a, { ms: F("גדול", "gadol") });
  assertEq(r.forms.ms, F("גדול", "gadol"));
  assertEq(r.state.ms, "verified");
});
T("reconcileForms: tiebreak agreeing with pass 1 makes pass 1 win", () => {
  const r = reconcileForms({ ms: F("א", "a") }, { ms: F("ב", "b") }, { ms: F("א", "a") });
  assertEq(r.forms.ms, F("א", "a"));
  assertEq(r.state.ms, "verified");
});
T("reconcileForms: tiebreak agreeing with pass 2 makes pass 2 win", () => {
  const r = reconcileForms({ ms: F("א", "a") }, { ms: F("ב", "b") }, { ms: F("ב", "b") });
  assertEq(r.forms.ms, F("ב", "b"));
  assertEq(r.state.ms, "verified");
});
T("reconcileForms: three different answers is uncertain, showing pass 1", () => {
  const r = reconcileForms({ ms: F("א", "a") }, { ms: F("ב", "b") }, { ms: F("ג", "g") });
  assertEq(r.forms.ms, F("א", "a"));
  assertEq(r.state.ms, "uncertain");
});
T("reconcileForms: a disagreement with no tiebreak run is uncertain", () => {
  const r = reconcileForms({ ms: F("א", "a") }, { ms: F("ב", "b") });
  assertEq(r.state.ms, "uncertain");
});
T("reconcileForms: pass 2 missing entirely leaves everything uncertain", () => {
  const r = reconcileForms({ ms: F("א", "a") }, null);
  assertEq(r.forms.ms, F("א", "a"));
  assertEq(r.state.ms, "uncertain");
});
```

- [ ] **Step 2: Run and verify they fail**

Expected: 9 failures.

- [ ] **Step 3: Implement**

```js
/* Best of three. NOT "the later pass wins" — pass 2 is not more authoritative
   than pass 1, it is merely later, so letting it win would be arbitrary. Two
  matching answers out of three is the only thing that earns "verified".

   Comparison is on the HEBREW only. Transliteration is not an orthography —
   "gadol"/"gadhol" is a spelling preference, not a morphological disagreement,
   and treating it as one would send half the bank to a pointless tiebreak. */
function sameForm(x, y) {
  return !!x && !!y && String(x.he || "").trim() === String(y.he || "").trim();
}

function disputedTags(a, b) {
  const out = [];
  const tags = {};
  Object.keys(a || {}).forEach(t => { tags[t] = 1; });
  Object.keys(b || {}).forEach(t => { tags[t] = 1; });
  Object.keys(tags).forEach(t => { if (!sameForm((a || {})[t], (b || {})[t])) out.push(t); });
  return out;
}

function reconcileForms(a, b, c) {
  a = a || {}; b = b || {}; c = c || null;
  const forms = {}, state = {};
  const tags = {};
  Object.keys(a).forEach(t => { tags[t] = 1; });
  Object.keys(b).forEach(t => { tags[t] = 1; });
  Object.keys(tags).forEach(tag => {
    const x = a[tag], y = b[tag], z = c ? c[tag] : null;
    if (sameForm(x, y)) { forms[tag] = x || y; state[tag] = "verified"; return; }
    if (z && sameForm(z, x)) { forms[tag] = x; state[tag] = "verified"; return; }
    if (z && sameForm(z, y)) { forms[tag] = y; state[tag] = "verified"; return; }
    /* three ways apart, or no tiebreak run: show pass 1 and refuse to act on it */
    forms[tag] = x || y || z;
    state[tag] = "uncertain";
  });
  return { forms: forms, state: state };
}
```

- [ ] **Step 4: Run and verify they pass**

Expected: `fail: 0`.

- [ ] **Step 5: Back up**

```bash
cp hebrew-reader.html "hebrew-reader.BACKUP-forms-reconcile-$(date +%Y%m%d-%H%M).html"
```

---

## Task 6: Free verification against DICT

**Files:**
- Modify: `hebrew-reader.html` — WORD FORMS section
- Test: SELF TESTS section

**Interfaces:**
- Consumes: `formTagsFor` (Task 2).
- Produces: `freeVerify(forms)` → array of tag strings verifiable without an API call.

- [ ] **Step 1: Write the failing tests**

```js
T("freeVerify: a form already in DICT needs no API check", () => {
  assertTrue(!!DICT["גדולה"], "test premise: גדולה is in DICT");
  const tags = freeVerify({ fs: F("גדולה", "gedola"), ms: F("גדול", "gadol") });
  assertTrue(tags.indexOf("fs") !== -1, "fs should verify from DICT");
  assertTrue(tags.indexOf("ms") !== -1, "ms should verify from DICT");
});
T("freeVerify: an invented form is not verified", () => {
  assertEq(freeVerify({ fs: F("גדולתתת", "gedolatatat") }), []);
});
T("freeVerify: empty and malformed input is safe", () => {
  assertEq(freeVerify(null), []);
  assertEq(freeVerify({}), []);
  assertEq(freeVerify({ ms: null }), []);
  assertEq(freeVerify({ ms: { tr: "x" } }), []);
});
```

- [ ] **Step 2: Run and verify they fail**

Expected: 3 failures. If the first test fails on its *premise* assertion, pick a
different adjective pair that is genuinely in `DICT` — check with
`grep -n '"גדולה"' hebrew-reader.html`.

- [ ] **Step 3: Implement**

```js
/* Free verification: the app already ships ~700 words in DICT and PHRASES, many
   of them inflected, so a good share of any generated bank can be confirmed
   against data already on disk before spending a single API call. Membership is
   the whole test — if DICT holds the spelling, the spelling is real. */
function freeVerify(forms) {
  if (!forms) return [];
  return Object.keys(forms).filter(tag => {
    const f = forms[tag];
    const he = f && String(f.he || "").trim();
    return !!he && (!!DICT[he] || !!PHRASES[he]);
  });
}
```

- [ ] **Step 4: Run and verify they pass**

Expected: `fail: 0`.

- [ ] **Step 5: Back up**

```bash
cp hebrew-reader.html "hebrew-reader.BACKUP-forms-freeverify-$(date +%Y%m%d-%H%M).html"
```

---

## Task 7: Rate-limit classification and the 429 fix

Today a 429 is read as "this model is spent", so a per-minute limit burns both keys and then reports *"daily free limit reached"* — a lie the enrichment queue would trigger constantly.

**Files:**
- Modify: `hebrew-reader.html` — WORD FORMS section (classifier); `geminiRequest` (hebrew-reader.html:5670–5715)
- Test: SELF TESTS section

**Interfaces:**
- Consumes: nothing.
- Produces: `rateLimitWaitMs(bodyText, waitsSoFar)` → milliseconds to wait, or `null` meaning "genuinely spent, move on".
- Modifies: `geminiRequest(parts, models, opts)` gains a third argument.

**Added during execution — `opts.waitOnRateLimit`, default off.** Testing the rewritten
loop showed a *persistent* per-minute 429 blocked for ~18s (3 waits × 2 configs × 2 models)
before failing, and reported the self-contradictory `"daily free limit reached — try again
in about 1s"`. Waiting is right for the background queue and wrong for anything George is
sitting in front of, so the waiting is now opt-in and only `formsAsk()` passes it. The error
message also now distinguishes a short-hint rate limit (*"too many requests just now"*) from
a genuine daily quota — that part applies to every caller.

- [ ] **Step 1: Write the failing tests**

```js
T("rateLimitWaitMs: a short retry hint is a per-minute limit — wait it out", () => {
  assertEq(rateLimitWaitMs("please retry in 12.5s", 0), 13500);
});
T("rateLimitWaitMs: no hint means genuinely spent", () => {
  assertNull(rateLimitWaitMs("RESOURCE_EXHAUSTED: quota exceeded", 0));
});
T("rateLimitWaitMs: an implausibly long hint means a daily quota, not a minute", () => {
  assertNull(rateLimitWaitMs("retry in 3600s", 0));
});
T("rateLimitWaitMs: stops waiting after the retry budget is used", () => {
  assertEq(rateLimitWaitMs("retry in 5s", 0), 6000);
  assertNull(rateLimitWaitMs("retry in 5s", GEMINI_RATE_WAIT_TRIES));
});
```

- [ ] **Step 2: Run and verify they fail**

Expected: 4 failures.

- [ ] **Step 3: Implement the classifier**

```js
/* A 429 means two completely different things and geminiRequest could not tell
   them apart: a PER-MINUTE rate limit (wait a few seconds, carry on) and a
   PER-DAY quota (this model is finished until tomorrow). It already parsed the
   "retry in Ns" hint but used it only to word the error message, so a burst of
   background calls would fall through every model, then both keys, and report
   "daily free limit reached" while the daily quota was almost untouched.

   Rule: a short hint is a minute-limit and is worth sleeping through. No hint,
   or an hour-long one, is a real quota — move on. */
const GEMINI_RATE_WAIT_MAX_S = 90;
const GEMINI_RATE_WAIT_TRIES = 3;

function rateLimitWaitMs(bodyText, waitsSoFar) {
  if ((waitsSoFar || 0) >= GEMINI_RATE_WAIT_TRIES) return null;
  const m = String(bodyText || "").match(/retry in ([\d.]+)s/i);
  if (!m) return null;
  const secs = Number(m[1]);
  if (!(secs > 0) || secs > GEMINI_RATE_WAIT_MAX_S) return null;
  return Math.ceil((secs + 1) * 1000);      // +1s of headroom
}
```

- [ ] **Step 4: Run and verify they pass**

Expected: `fail: 0`.

- [ ] **Step 5: Wire it into `geminiRequest`**

In `geminiRequest` (hebrew-reader.html:5670), replace the body of the
`for (const cfg of [GEMINI_THINKING, null])` loop with this. The change is that
one fetch becomes a small retry loop so a minute-limit retries the **same**
model rather than falling through to the next:

```js
      for (const cfg of [GEMINI_THINKING, null]) {
        const body = { contents: [{ parts: parts }] };
        if (cfg) body.generationConfig = cfg;
        let resp = null, text = "", waits = 0, spent = false;
        /* retry the SAME model while the 429 is a per-minute limit */
        for (;;) {
          resp = await geminiFetchWithRetry(geminiURLFor(model, key), body);
          if (resp.ok) break;
          text = await resp.text();
          if (resp.status !== 429) break;
          const wait = text.match(/retry in ([\d.]+)s/i);
          lastWaitHint = wait ? "in about " + Math.ceil(Number(wait[1])) + "s" : null;
          const ms = rateLimitWaitMs(text, waits);
          if (ms === null) { spent = true; break; }
          waits++;
          await new Promise(r => setTimeout(r, ms));
        }
        if (resp.ok) {
          const json = await resp.json();
          const out = ((((json.candidates || [])[0] || {}).content || {}).parts || [])
            .map(p => p.text || "").join("").trim();
          if (out) {
            lastGeminiTiming = { ms: Date.now() - started, model: model, thinking: !!cfg };
            return out;
          }
          throw new Error("empty reply");
        }
        if (spent) break;                            // this model is done — next model
        if (resp.status === 400 && cfg) continue;    // the config was the problem — retry plain
        throw new Error("HTTP " + resp.status);      // not a quota problem — don't blame the key
      }
```

- [ ] **Step 6: Verify the normal path still works**

Open the app normally (no `?selftest`), paste a short Hebrew line into the
Translator, and press the AI button.
Expected: a normal translation, unchanged from before. If there is no API key
configured, expect the existing *"No Gemini key set"* message instead — either
outcome proves the rewritten loop did not break the happy path.

- [ ] **Step 7: Back up**

```bash
cp hebrew-reader.html "hebrew-reader.BACKUP-forms-429-$(date +%Y%m%d-%H%M).html"
```

---

## Task 8: Prompt building and reply normalisation

**Files:**
- Modify: `hebrew-reader.html` — WORD FORMS section
- Test: SELF TESTS section

**Interfaces:**
- Consumes: `formTagsFor` (Task 2).
- Produces: `formsPrompt(items)` → string, where `items` is `[{he, tr, en}]`;
  `formsVerifyPrompt(items)` → string, where `items` is `[{he, lemma, root, pos, tags: [tag]}]`;
  `normaliseFormsReply(json, requested)` → `{he: {pos, lemma, clitic, root, binyan, gender, forms}}`;
  `normaliseVerifyReply(json, posByWord)` → `{he: {forms}}`.

**Added during execution — `normaliseVerifyReply`.** A stubbed end-to-end run of Task 10
showed every AI-sourced form stuck at `uncertain`. Cause: `normaliseFormsReply` requires a
`pos`, but the *verify* prompts only ask for `{hebrew, forms}` — the model is told the pos,
so it has no reason to repeat it. Every pass-2 and pass-3 reply was being discarded whole,
silently disabling verification **and** the tiebreak while appearing to work. Passes 2 and 3
now use `normaliseVerifyReply`, which takes the pos established by pass 1 and still validates
tags against it. Four regression tests cover it.

- [ ] **Step 1: Write the failing tests**

```js
T("formsPrompt: names every word and demands JSON", () => {
  const p = formsPrompt([{ he: "גדול", tr: "gadol", en: "big" },
                         { he: "לסיים", tr: "lesayem", en: "to finish" }]);
  assertTrue(p.indexOf("גדול") !== -1 && p.indexOf("לסיים") !== -1, "both words present");
  assertTrue(p.indexOf("big") !== -1, "the gloss is sent — it is what settles clitics");
  assertTrue(/JSON/i.test(p), "asks for JSON");
  assertTrue(p.indexOf("pres.ms") !== -1, "names the tag vocabulary");
});
T("normaliseFormsReply: keeps only tags valid for the returned pos", () => {
  const r = normaliseFormsReply(
    { words: [{ hebrew: "גדול", pos: "adj",
                forms: { ms: { he: "גדול", tr: "gadol" },
                         fs: { he: "גדולה", tr: "gedola" },
                         "past.1s": { he: "בגלל", tr: "biglal" } } }] },
    ["גדול"]);
  assertEq(Object.keys(r["גדול"].forms).sort(), ["fs", "ms"]);
});
T("normaliseFormsReply: drops words that were not asked for", () => {
  const r = normaliseFormsReply(
    { words: [{ hebrew: "אחר", pos: "adj", forms: { ms: { he: "אחר", tr: "acher" } } }] },
    ["גדול"]);
  assertEq(Object.keys(r), []);
});
T("normaliseFormsReply: normalises pos and drops an unknown one", () => {
  const r = normaliseFormsReply(
    { words: [{ hebrew: "גדול", pos: "ADJECTIVE", forms: { ms: { he: "גדול", tr: "gadol" } } }] },
    ["גדול"]);
  assertEq(r["גדול"].pos, "adj");
  const r2 = normaliseFormsReply(
    { words: [{ hebrew: "גדול", pos: "sparkle", forms: { ms: { he: "גדול", tr: "gadol" } } }] },
    ["גדול"]);
  assertEq(Object.keys(r2), []);
});
T("normaliseFormsReply: trims whitespace and drops empty Hebrew", () => {
  const r = normaliseFormsReply(
    { words: [{ hebrew: "גדול", pos: "adj",
                forms: { ms: { he: " גדול ", tr: " gadol " }, fs: { he: "", tr: "gedola" } } }] },
    ["גדול"]);
  assertEq(r["גדול"].forms.ms, { he: "גדול", tr: "gadol" });
  assertTrue(!r["גדול"].forms.fs, "empty Hebrew must be dropped");
});
T("normaliseFormsReply: carries lemma, clitic, root, binyan and noun gender", () => {
  const r = normaliseFormsReply(
    { words: [{ hebrew: "ההזדמנות", pos: "noun", lemma: "הזדמנות", clitic: "ha",
                gender: "f", forms: { sg: { he: "הזדמנות", tr: "izdamnut" } } }] },
    ["ההזדמנות"]);
  assertEq(r["ההזדמנות"].lemma, "הזדמנות");
  assertEq(r["ההזדמנות"].clitic, "ha");
  assertEq(r["ההזדמנות"].gender, "f");
});
T("normaliseFormsReply: survives junk without throwing", () => {
  assertEq(normaliseFormsReply(null, ["גדול"]), {});
  assertEq(normaliseFormsReply({}, ["גדול"]), {});
  assertEq(normaliseFormsReply({ words: "nope" }, ["גדול"]), {});
  assertEq(normaliseFormsReply({ words: [null, 3, {}] }, ["גדול"]), {});
});
```

- [ ] **Step 2: Run and verify they fail**

Expected: 7 failures.

- [ ] **Step 3: Implement**

```js
/* The gloss goes to the model along with the Hebrew, and that is deliberate:
   ההזדמנות "the opportunity", בהצלחה "good luck" and לשלוח "to send" are
   identical in shape and only the meaning says which carries a clitic. */
const FORMS_POS_ALIASES = {
  verb: "verb", v: "verb", adjective: "adj", adj: "adj", noun: "noun", n: "noun",
  preposition: "prep", prep: "prep", pronoun: "pron", pron: "pron",
  number: "num", numeral: "num", num: "num", adverb: "adv", adv: "adv",
  phrase: "phrase", idiom: "phrase", expression: "phrase"
};
function normalisePos(p) { return FORMS_POS_ALIASES[String(p || "").trim().toLowerCase()] || null; }

function formsPrompt(items) {
  const list = items.map(w => "- " + w.he + "  (" + (w.tr || "") + " — " + (w.en || "") + ")").join("\n");
  return "You are a Modern Hebrew morphology engine. For each word below return its " +
    "dictionary form and its inflected forms.\n\n" +
    "Return ONLY JSON: {\"words\":[{\"hebrew\":\"<exactly as given>\",\"pos\":\"verb|adj|noun|prep|pron|num|adv|phrase\"," +
    "\"lemma\":\"<naked dictionary form>\",\"clitic\":\"<ha|ve|be|le|mi|she|ke, or null>\"," +
    "\"root\":\"<verbs only, e.g. ס־י־מ>\",\"binyan\":\"<verbs only>\"," +
    "\"gender\":\"<nouns only: m or f>\",\"forms\":{\"<tag>\":{\"he\":\"\",\"tr\":\"\"}}}]}\n\n" +
    "Tags by pos — use these EXACT strings and no others:\n" +
    "  verb: inf, pres.ms, pres.fs, pres.mp, pres.fp, past.1s, past.2ms, past.2fs, " +
    "past.3ms, past.3fs, past.1p, past.3p, fut.1s, fut.2ms, fut.2fs, fut.3ms, fut.3fs, " +
    "fut.1p, fut.3p, imp.ms, imp.fs\n" +
    "  adj, pron: ms, fs, mp, fp\n" +
    "  noun: sg, pl   (a noun does NOT inflect for gender — report its inherent gender in \"gender\")\n" +
    "  prep: 1s, 2ms, 2fs, 3ms, 3fs, 1p, 2p, 3p\n" +
    "  num: ms, fs\n" +
    "  adv, phrase: return \"forms\":{}\n\n" +
    "\"clitic\": only when the word as given carries an attached prefix that is NOT part " +
    "of it. ההזדמנות \"the opportunity\" is ha + הזדמנות. But בהצלחה \"good luck\" is a " +
    "fixed expression (clitic null), and an infinitive like לשלוח \"to send\" keeps its ל " +
    "(clitic null). Judge by the meaning given, not the spelling.\n" +
    "\"tr\" is English-letter pronunciation, no Hebrew characters.\n\n" +
    "Words:\n" + list;
}

function formsVerifyPrompt(items) {
  const list = items.map(w =>
    "- " + (w.lemma || w.he) + " (" + (w.pos || "") + (w.root ? ", root " + w.root : "") +
    "): " + w.tags.join(", ")).join("\n");
  return "You are a Modern Hebrew morphology engine. For each word give ONLY the exact " +
    "inflected forms requested. Do not comment, do not correct the request.\n\n" +
    "Return ONLY JSON: {\"words\":[{\"hebrew\":\"<the word as given>\"," +
    "\"forms\":{\"<tag>\":{\"he\":\"\",\"tr\":\"\"}}}]}\n\n" +
    "Tag grammar: [tense.]person+gender+number. pres/past/fut/imp/inf; " +
    "1s 2ms 2fs 3ms 3fs 1p 2p 3p; ms fs mp fp; sg pl.\n\n" + list;
}

/* `requested` is the exact list of keys the batch asked about. Anything else the
   model volunteers is dropped: a reply that invents extra words would otherwise
   create library rows nobody asked for. */
function normaliseFormsReply(json, requested) {
  const want = {}; (requested || []).forEach(k => { want[k] = 1; });
  const out = {};
  const words = json && json.words;
  if (!Array.isArray(words)) return out;
  words.forEach(w => {
    if (!w || typeof w !== "object") return;
    const he = String(w.hebrew || "").trim();
    if (!he || !want[he]) return;
    const pos = normalisePos(w.pos);
    if (!pos) return;
    const valid = {}; formTagsFor(pos).forEach(t => { valid[t] = 1; });
    const forms = {};
    Object.keys(w.forms || {}).forEach(tag => {
      if (!valid[tag]) return;
      const f = w.forms[tag];
      if (!f || typeof f !== "object") return;
      const h = String(f.he || "").trim();
      if (!h) return;
      forms[tag] = { he: h, tr: String(f.tr || "").trim() };
    });
    out[he] = {
      pos: pos,
      lemma: String(w.lemma || "").trim() || he,
      clitic: w.clitic ? String(w.clitic).trim().toLowerCase() : null,
      root: String(w.root || "").trim() || null,
      binyan: String(w.binyan || "").trim() || null,
      gender: (pos === "noun" && /^[mf]$/i.test(String(w.gender || "").trim()))
                ? String(w.gender).trim().toLowerCase() : null,
      forms: forms
    };
  });
  return out;
}
```

- [ ] **Step 4: Run and verify they pass**

Expected: `fail: 0`.

- [ ] **Step 5: Back up**

```bash
cp hebrew-reader.html "hebrew-reader.BACKUP-forms-prompt-$(date +%Y%m%d-%H%M).html"
```

---

## Task 9: Queue store and budget ledger

**Files:**
- Modify: `hebrew-reader.html` — WORD FORMS section
- Test: SELF TESTS section

**Interfaces:**
- Consumes: nothing.
- Produces: `FORMS_Q_KEY`, `formsQAll()`, `formsQSave(q)`, `formsQRoll(q, today)` (pure) → q,
  `formsBudgetLeft(q, today)` (pure) → number, `formsBankless(lib, q, today)` (pure) → array of keys,
  `formsNextBatch(lib, q, today)` (pure) → array of keys (≤ `FORMS_BATCH`).

- [ ] **Step 1: Write the failing tests**

```js
T("formsQRoll: resets the call count on a new day", () => {
  const q = formsQRoll({ day: "2026-08-18", calls: 190, tries: { "א": 2 } }, "2026-08-19");
  assertEq(q.day, "2026-08-19");
  assertEq(q.calls, 0);
  assertEq(q.tries, { "א": 2 }, "attempt counts survive the day roll");
});
T("formsQRoll: leaves the same day alone", () => {
  const q = formsQRoll({ day: "2026-08-19", calls: 12, tries: {} }, "2026-08-19");
  assertEq(q.calls, 12);
});
T("formsBudgetLeft: counts down from the daily cap", () => {
  assertEq(formsBudgetLeft({ day: "2026-08-19", calls: 0, tries: {} }, "2026-08-19"), FORMS_DAILY_CAP);
  assertEq(formsBudgetLeft({ day: "2026-08-19", calls: FORMS_DAILY_CAP, tries: {} }, "2026-08-19"), 0);
});
T("formsBudgetLeft: never reports negative", () => {
  assertEq(formsBudgetLeft({ day: "2026-08-19", calls: FORMS_DAILY_CAP + 50, tries: {} }, "2026-08-19"), 0);
});
T("formsBankless: lists entries with no bank, skipping parked and pos-less-by-design", () => {
  const lib = { "א": { tr: "a" }, "ב": { tr: "b", forms: { ms: { he: "ב", tr: "b" } } },
                "ג": { tr: "g" }, "ד": { tr: "d", pos: "adv", forms: {} } };
  const q = { day: "2026-08-19", calls: 0, tries: { "ג": FORMS_MAX_TRIES } };
  const out = formsBankless(lib, q, "2026-08-19");
  assertEq(out, ["א"]);
});
T("formsNextBatch: caps at FORMS_BATCH", () => {
  const lib = {};
  for (let i = 0; i < 25; i++) lib["w" + i] = { tr: "w" + i };
  const b = formsNextBatch(lib, { day: "2026-08-19", calls: 0, tries: {} }, "2026-08-19");
  assertEq(b.length, FORMS_BATCH);
});
T("formsNextBatch: is empty when the daily budget is gone", () => {
  const lib = { "א": { tr: "a" } };
  const b = formsNextBatch(lib, { day: "2026-08-19", calls: FORMS_DAILY_CAP, tries: {} }, "2026-08-19");
  assertEq(b, []);
});
T("formsSizeGuard: quiet under the limit, warns over it", () => {
  assertEq(formsSizeGuard({ "א": { tr: "a" } }), null);
  const fat = {};
  for (let i = 0; i < 400; i++) {
    const forms = {};
    FORM_TAGS.verb.forEach(t => { forms[t] = { he: "אבגדהוזחט", tr: "abcdefghij" }; });
    fat["word" + i] = { tr: "x", en: "y", forms: forms };
  }
  assertTrue(formsSizeGuard(fat) > FORMS_SIZE_WARN_BYTES, "should report the oversize byte count");
});
```

- [ ] **Step 2: Run and verify they fail**

Expected: 7 failures.

- [ ] **Step 3: Implement**

```js
/* Budget. The lite pool is ~500/day and the pad and audio draw on it too, so
   enrichment takes a deliberate minority of it. A full 241-word backfill costs
   roughly 25 generate + 25 verify + 5 tiebreak = ~55 calls, so 200 is several
   backfills' worth of headroom without ever being the reason something else
   fails. */
const FORMS_DAILY_CAP = 200;
const FORMS_SESSION_CAP = 40;
const FORMS_BATCH = 10;
const FORMS_STAGGER_MS = 4000;
const FORMS_MAX_TRIES = 3;
const FORMS_AUTO_THRESHOLD = 10;

const FORMS_Q_KEY = "hvr_forms_q";
function formsQAll() {
  try { return JSON.parse(lsGet(FORMS_Q_KEY)) || { day: "", calls: 0, tries: {} }; }
  catch (e) { return { day: "", calls: 0, tries: {} }; }
}
function formsQSave(q) { lsSet(FORMS_Q_KEY, JSON.stringify(q)); }

/* Calls reset daily; attempt counts do NOT — a word that failed three times
   yesterday is still a bad word today, and retrying it every morning forever is
   how a background queue quietly burns a quota. */
function formsQRoll(q, today) {
  q = q || { day: "", calls: 0, tries: {} };
  if (q.day !== today) { q.day = today; q.calls = 0; }
  if (!q.tries) q.tries = {};
  return q;
}

function formsBudgetLeft(q, today) {
  q = formsQRoll(q, today);
  return Math.max(0, FORMS_DAILY_CAP - (q.calls || 0));
}

/* A word needs a bank if it has no `forms` at all. An entry whose pos genuinely
   has no forms (adv, phrase) gets `forms: {}` written to it by the runner, so it
   is not bankless and will not be asked about again. */
function formsBankless(lib, q, today) {
  q = formsQRoll(q, today);
  return Object.keys(lib || {}).filter(k => {
    const e = lib[k];
    if (!e || e.forms) return false;
    return (q.tries[k] || 0) < FORMS_MAX_TRIES;
  });
}

function formsNextBatch(lib, q, today) {
  if (formsBudgetLeft(q, today) < 2) return [];   // never start what cannot be verified
  return formsBankless(lib, q, today).slice(0, FORMS_BATCH);
}

/* Form banks are the first thing in this app that grows without bound — ~120KB
   at 241 words, but linear in library size, and localStorage throws rather than
   warning when it fills. Noticing at 1MB means the problem is a console line
   now instead of a silent failed save later. Returns the byte count when over
   the limit, null when fine. */
const FORMS_SIZE_WARN_BYTES = 1000000;
function formsSizeGuard(lib) {
  let bytes = 0;
  try { bytes = JSON.stringify(lib || {}).length; } catch (e) { return null; }
  if (bytes <= FORMS_SIZE_WARN_BYTES) return null;
  console.warn("hvr_library is " + Math.round(bytes / 1024) + "KB — approaching the " +
               "localStorage limit. Form banks may need moving to IndexedDB.");
  return bytes;
}
```

- [ ] **Step 4: Run and verify they pass**

Expected: `fail: 0`.

- [ ] **Step 5: Back up**

```bash
cp hebrew-reader.html "hebrew-reader.BACKUP-forms-queue-$(date +%Y%m%d-%H%M).html"
```

---

## Task 10: The enrichment runner

Wires Tasks 5–9 into the three-pass pipeline. This is the only task that talks to the network.

**Files:**
- Modify: `hebrew-reader.html` — WORD FORMS section
- Test: SELF TESTS section (for `applyFormsResult`, which is pure)

**Interfaces:**
- Consumes: `formsPrompt`, `formsVerifyPrompt`, `normaliseFormsReply` (T8); `reconcileForms`, `disputedTags` (T5); `freeVerify` (T6); queue helpers (T9); `geminiRequest`, `extractJSON`, `GEMINI_MODELS_FAST`.
- Produces: `applyFormsResult(entry, result, reconciled, freeTags)` → mutated entry (pure);
  `formsRunBatch()` → Promise<{done, failed}>; `formsRunQueue(opts)` → Promise<{words, calls}>.

- [ ] **Step 1: Write the failing tests**

```js
T("applyFormsResult: writes the bank, pos, root and states", () => {
  const e = { tr: "lesayem", en: "to finish" };
  applyFormsResult(e,
    { pos: "verb", lemma: "לסיים", clitic: null, root: "ס־י־מ", binyan: "pi'el", gender: null },
    { forms: { inf: F("לסיים", "lesayem"), "pres.ms": F("מסיים", "mesayem") },
      state: { inf: "verified", "pres.ms": "uncertain" } },
    ["inf"]);
  assertEq(e.pos, "verb");
  assertEq(e.root, "ס־י־מ");
  assertEq(e.binyan, "pi'el");
  assertEq(e.forms.inf, F("לסיים", "lesayem"));
  assertEq(e.formsMeta.state.inf, "verified");
  assertEq(e.formsMeta.state["pres.ms"], "uncertain");
  assertEq(e.formsMeta.src.inf, "dict", "free-verified forms are provenance dict");
  assertEq(e.formsMeta.src["pres.ms"], "ai");
});
T("applyFormsResult: a free-verified form is verified even if the passes disagreed", () => {
  const e = {};
  applyFormsResult(e, { pos: "adj" },
    { forms: { fs: F("גדולה", "gedola") }, state: { fs: "uncertain" } }, ["fs"]);
  assertEq(e.formsMeta.state.fs, "verified");
});
T("applyFormsResult: never overwrites a manual form", () => {
  const e = { forms: { fs: F("שלי", "sheli") },
              formsMeta: { src: { fs: "manual" }, state: { fs: "verified" } } };
  applyFormsResult(e, { pos: "adj" },
    { forms: { fs: F("אחרת", "acheret") }, state: { fs: "verified" } }, []);
  assertEq(e.forms.fs, F("שלי", "sheli"), "manual must survive");
  assertEq(e.formsMeta.src.fs, "manual");
});
T("applyFormsResult: an adverb gets an empty bank so it is never asked about again", () => {
  const e = {};
  applyFormsResult(e, { pos: "adv" }, { forms: {}, state: {} }, []);
  assertEq(e.pos, "adv");
  assertEq(e.forms, {});
  assertTrue(!!e.formsMeta.checked, "checked date is stamped");
});
T("applyFormsResult: records a clitic suggestion without acting on it", () => {
  const e = { tr: "ha-izdamnut" };
  applyFormsResult(e, { pos: "noun", lemma: "הזדמנות", clitic: "ha", gender: "f" },
                   { forms: {}, state: {} }, []);
  assertEq(e.formsMeta.lemma, "הזדמנות");
  assertEq(e.formsMeta.clitic, "ha");
  assertEq(e.gender, "f");
});
```

- [ ] **Step 2: Run and verify they fail**

Expected: 5 failures.

- [ ] **Step 3: Implement `applyFormsResult`**

```js
/* Pure: takes an entry and the reconciled result and writes the bank onto it.
   Kept separate from the network code so the merge rules — which are where the
   damage would be — are unit-testable.

   The clitic suggestion is RECORDED, never applied. Phase 1 only ever proposes;
   the re-key runs from a reviewed list (Task 11). */
function applyFormsResult(entry, result, reconciled, freeTags) {
  const free = {}; (freeTags || []).forEach(t => { free[t] = 1; });
  const meta = entry.formsMeta || { src: {}, state: {} };
  meta.src = meta.src || {}; meta.state = meta.state || {};
  const forms = entry.forms || {};

  Object.keys(reconciled.forms || {}).forEach(tag => {
    if (meta.src[tag] === "manual") return;              // George's word is final
    const f = reconciled.forms[tag];
    if (!f || !f.he) return;
    forms[tag] = f;
    meta.state[tag] = free[tag] ? "verified" : (reconciled.state[tag] || "uncertain");
    meta.src[tag] = free[tag] ? "dict" : "ai";
  });

  entry.forms = forms;
  if (result.pos) entry.pos = result.pos;
  if (result.root) entry.root = result.root;
  if (result.binyan) entry.binyan = result.binyan;
  if (result.gender) entry.gender = result.gender;
  meta.checked = todayISO();
  if (result.lemma) meta.lemma = result.lemma;
  if (result.clitic) meta.clitic = result.clitic;
  entry.formsMeta = meta;
  return entry;
}
```

- [ ] **Step 4: Run and verify they pass**

Expected: `fail: 0`.

- [ ] **Step 5: Implement the runner**

```js
/* One batch = up to 10 words = 2 calls normally, 3 when anything is disputed.
   Always GEMINI_MODELS_FAST: the lite pool is 500/day while flash-latest is 20,
   and audio transcription depends on that 20. Enrichment must never be the
   reason a voice note cannot be transcribed.

   `null` for the models argument would mean GEMINI_MODELS — do not pass it. */
async function formsAsk(prompt) {
  /* Full thinking on purpose: GEMINI_THINKING's "minimal" was measured for the
     pad's interactive latency (hebrew-reader.html:5626). A background queue has
     no latency budget to protect, and morphology is where reasoning pays.
     waitOnRateLimit likewise: this is the ONE caller that should sit out a
     per-minute 429 rather than fail fast. */
  return extractJSON(await geminiRequest([{ text: prompt }], GEMINI_MODELS_FAST,
                                         { waitOnRateLimit: true }));
}

async function formsRunBatch() {
  const today = todayISO();
  let q = formsQRoll(formsQAll(), today);
  const lib = libAll();
  const batch = formsNextBatch(lib, q, today);
  if (!batch.length) return { done: 0, failed: 0, calls: 0 };

  const items = batch.map(k => ({ he: k, tr: lib[k].tr, en: lib[k].en }));
  let calls = 0, pass1 = {}, pass2 = {}, pass3 = null;

  try {
    pass1 = normaliseFormsReply(await formsAsk(formsPrompt(items)), batch); calls++;
  } catch (e) {
    batch.forEach(k => { q.tries[k] = (q.tries[k] || 0) + 1; });
    q.calls += calls; formsQSave(q);
    return { done: 0, failed: batch.length, calls: calls, error: String(e.message || e) };
  }

  /* freeVerify once per word, not once per tag — it walks DICT each call. */
  const freeByWord = {};
  const verifyItems = [];
  Object.keys(pass1).forEach(he => {
    const r = pass1[he];
    freeByWord[he] = freeVerify(r.forms);
    const free = {}; freeByWord[he].forEach(t => { free[t] = 1; });
    const tags = Object.keys(r.forms).filter(t => !free[t]);
    if (tags.length) verifyItems.push({ he: he, lemma: r.lemma, root: r.root, pos: r.pos, tags: tags });
  });

  if (verifyItems.length) {
    await new Promise(r => setTimeout(r, FORMS_STAGGER_MS));
    try { pass2 = normaliseFormsReply(await formsAsk(formsVerifyPrompt(verifyItems)), batch); calls++; }
    catch (e) { pass2 = {}; }
  }

  /* Tiebreaks for the WHOLE batch in one call — per-form calls would make the
     cost of a bad batch unbounded. */
  const tieItems = [];
  Object.keys(pass1).forEach(he => {
    const d = disputedTags(pass1[he].forms, (pass2[he] || {}).forms);
    if (d.length) tieItems.push({ he: he, lemma: pass1[he].lemma, root: pass1[he].root,
                                  pos: pass1[he].pos, tags: d });
  });
  if (tieItems.length) {
    await new Promise(r => setTimeout(r, FORMS_STAGGER_MS));
    try { pass3 = normaliseFormsReply(await formsAsk(formsVerifyPrompt(tieItems)), batch); calls++; }
    catch (e) { pass3 = null; }
  }

  const lib2 = libAll();                 // re-read: the user may have edited during the awaits
  let done = 0, failed = 0;
  batch.forEach(he => {
    const r = pass1[he];
    if (!r || !lib2[he]) { q.tries[he] = (q.tries[he] || 0) + 1; failed++; return; }
    const rec = reconcileForms(r.forms, (pass2[he] || {}).forms, pass3 ? (pass3[he] || {}).forms : null);
    applyFormsResult(lib2[he], r, rec, freeByWord[he] || []);
    done++;
  });
  libSave(lib2);
  formsSizeGuard(lib2);
  q.calls += calls;
  formsQSave(q);
  rebuildTrIndex();
  return { done: done, failed: failed, calls: calls };
}

/* Drains the queue in batches, stopping on budget, on the session cap, or when
   nothing is left. onProgress(doneSoFar, remaining) is called after each batch. */
async function formsRunQueue(opts) {
  opts = opts || {};
  let words = 0, calls = 0;
  for (;;) {
    if (calls >= FORMS_SESSION_CAP) break;
    const res = await formsRunBatch();
    if (!res.calls) break;
    words += res.done; calls += res.calls;
    if (opts.onProgress) {
      const q = formsQRoll(formsQAll(), todayISO());
      opts.onProgress(words, formsBankless(libAll(), q, todayISO()).length);
    }
    if (res.error) break;
    await new Promise(r => setTimeout(r, FORMS_STAGGER_MS));
  }
  return { words: words, calls: calls };
}
```

- [ ] **Step 6: Verify against the live API with a single batch**

With a Gemini key configured, open the app normally and run in the console:

```js
await formsRunBatch()
```

Expected: `{done: N, failed: 0, calls: 2 or 3}` with N ≥ 1. Then inspect one result:

```js
(() => { const l = libAll(); const k = Object.keys(l).find(k => l[k].forms && Object.keys(l[k].forms).length); return { k, e: l[k] }; })()
```

Expected: an entry with `pos`, a populated `forms` map whose tags are all valid for that
`pos`, and a `formsMeta` with `state` and `src` for every form. Confirm the Hebrew forms
are plausible for the word before continuing — this is the one step no unit test can cover.

- [ ] **Step 7: Verify the quota isolation**

```js
lastGeminiTiming
```

Expected: `model` is `gemini-flash-lite-latest`. **If it says `gemini-flash-latest`, the
`GEMINI_MODELS_FAST` argument is not being passed** — fix before continuing, or enrichment
will eat the transcription quota.

- [ ] **Step 8: Back up**

```bash
cp hebrew-reader.html "hebrew-reader.BACKUP-forms-runner-$(date +%Y%m%d-%H%M).html"
```

---

## Task 11: Clitic review list and cleanup

**Files:**
- Modify: `hebrew-reader.html` — WORD FORMS section; Settings modal markup and handlers
- Test: SELF TESTS section

**Interfaces:**
- Consumes: `cliticSuggestion` (T4), `rekeyWord` (T3).
- Produces: `cliticCandidates(lib, opts)` → `[{key, rest, restTr, source}]` (pure); a
  **Review prefixed words** button in Settings.

`source` is `"model"` when `formsMeta.clitic` is set, `"guess"` when only
`cliticSuggestion` fired.

**Two corrections during execution.**

1. **`opts.trustedOnly`, used by the bulk action.** Testing showed `בהצלחה → הצלחה` listed as
   a guess. Since the flow is *one confirm for the whole list*, a careless yes would re-file
   "good luck" under a word meaning "success". The bulk action now acts only on `source:
   "model"` entries; if none exist it explains that forms must be generated first. Guesses
   stay at the per-word Pending gate, where ignoring a wrong one costs one click.
2. **The Pending suggestion must NOT be gated on `c.known === false`.** The prefixed entries
   that actually reach the library come from the AI path, where `known` is true and the model
   returns a hyphenated translit because `aiInstruction` asks it to keep prefixes visible
   (hebrew-reader.html:2707). Gating on unknown would skip the only case this exists for.
   `cliticSuggestion` runs unconditionally in `cardEntry` instead — safe, because a key whose
   prefix `lookupWord` already resolved no longer starts with the clitic letter.

- [ ] **Step 1: Write the failing tests**

```js
T("cliticCandidates: prefers the model's judgement", () => {
  const lib = { "ההזדמנות": { tr: "ha-izdamnut", en: "the opportunity",
                               formsMeta: { clitic: "ha", lemma: "הזדמנות" } } };
  assertEq(cliticCandidates(lib), [{ key: "ההזדמנות", rest: "הזדמנות",
                                     restTr: "izdamnut", source: "model" }]);
});
T("cliticCandidates: falls back to the local guess when there is no bank yet", () => {
  const lib = { "ההזדמנות": { tr: "ha-izdamnut", en: "the opportunity" } };
  const c = cliticCandidates(lib);
  assertEq(c.length, 1);
  assertEq(c[0].source, "guess");
});
T("cliticCandidates: the model saying null overrules the local guess", () => {
  const lib = { "בהצלחה": { tr: "be-hatslakha", en: "good luck",
                            formsMeta: { clitic: null, lemma: "בהצלחה" } } };
  assertEq(cliticCandidates(lib), []);
});
T("cliticCandidates: never proposes an infinitive", () => {
  const lib = { "לשלוח": { tr: "lishloakh", en: "to send" } };
  assertEq(cliticCandidates(lib), []);
});
```

- [ ] **Step 2: Run and verify they fail**

Expected: 4 failures.

- [ ] **Step 3: Implement**

```js
/* The model's ruling beats the local guess, and a model that explicitly said
   "no clitic" (formsMeta exists, .clitic is falsy) SILENCES the guess — that is
   the whole protection for בהצלחה, which cliticSuggestion() cannot tell from
   ההזדמנות on its own. */
function cliticCandidates(lib) {
  const out = [];
  Object.keys(lib || {}).forEach(k => {
    const e = lib[k];
    if (!e) return;
    const meta = e.formsMeta;
    if (meta && meta.checked) {
      if (!meta.clitic || !meta.lemma || meta.lemma === k) return;   // model says leave it
      const guess = cliticSuggestion(k, e.tr, e.en);
      out.push({ key: k, rest: meta.lemma,
                 restTr: (guess && guess.restTr) || e.tr || "", source: "model" });
      return;
    }
    const g = cliticSuggestion(k, e.tr, e.en);
    if (g) out.push({ key: k, rest: g.rest, restTr: g.restTr, source: "guess" });
  });
  return out;
}
```

- [ ] **Step 4: Run and verify they pass**

Expected: `fail: 0`.

- [ ] **Step 5: Add the Settings button**

Find the Settings modal's action buttons (near `clearFocusBtn`, hebrew-reader.html:3230)
and add alongside them:

```html
<button id="reviewPrefixBtn">Review prefixed words</button>
```

- [ ] **Step 6: Wire it up**

Add near the other `settingsAction` handlers:

```js
/* One confirm for the whole list, not per word — George chose "dictionary form,
   remembers how you met it", not "approve each one". The list is shown in full
   first so a wrong suggestion can be spotted before anything moves. */
document.getElementById("reviewPrefixBtn").onclick = settingsAction(async () => {
  const cands = cliticCandidates(libAll());
  if (!cands.length) { alert("No prefixed entries found — nothing to clean up."); return; }
  const lines = cands.map(c => "  " + c.key + "  →  " + c.rest +
                               (c.source === "guess" ? "   (guess)" : "")).join("\n");
  if (!confirm("Re-file " + cands.length + " prefixed entr" +
               (cands.length === 1 ? "y" : "ies") + " under the base word?\n\n" + lines +
               "\n\nDrill history, marks, pairs and cached audio move with them.")) return;
  let moved = 0;
  for (const c of cands) { if (await rekeyWord(c.key, c.rest)) moved++; }
  renderLibrary();
  if (typeof renderPad === "function") renderPad();
  settingsModal.style.display = "none";
  setLibStatus(moved + " prefixed entr" + (moved === 1 ? "y" : "ies") + " re-filed.");
});
```

- [ ] **Step 7: Flag the suggestion at Pending time, so it stops happening**

The button above cleans up what is already there. This stops new ones arriving.
In `cardEntry()` (hebrew-reader.html:3527), add to the returned object:

```js
  /* A SUGGESTION carried into Pending, never applied here — see
     cliticSuggestion(). cardEntry must not strip: it cannot tell ההזדמנות from
     בהצלחה, and only one of those should lose its first letter. */
  const cs = (c.known === false) ? cliticSuggestion(key, tr, en) : null;
```

and add `clitic: cs` to the `return { key: ..., genderPair: genderPair }` object.
Then in `libHarvest` where the pending row is built (hebrew-reader.html:3707), add
`clitic: e.clitic || null` to the object literal.

- [ ] **Step 8: Offer the split on the Pending row**

In `buildPendingRow` (hebrew-reader.html:4380), immediately before the `act` span is
appended, add:

```js
  /* One click to add the base word instead of the prefixed one. Not automatic:
     "be-hatslakha" would be destroyed by an automatic rule, so the choice is
     George's, made once, at the moment he is already reviewing the word. */
  if (p.clitic) {
    const fix = document.createElement("button");
    fix.className = "cliticfix";
    fix.textContent = "→ " + p.clitic.rest;
    fix.title = "Add “" + p.clitic.rest + "” instead — " + key + " looks like " +
                p.clitic.letter + " + " + p.clitic.rest;
    fix.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const pend = pendingAll();
      const row = pend[key];
      if (!row) return;
      delete pend[key];
      pend[p.clitic.rest] = { tr: p.clitic.restTr, en: row.en, cat: row.cat,
                              seen: row.seen || 1, clitic: null };
      pendingSave(pend);
      renderLibrary();
    });
    row.appendChild(fix);
  }
```

Add the CSS beside the other pending rules:

```css
  .grow-row.pending .cliticfix { border: 1px solid var(--accent); background: none;
    color: var(--accent); border-radius: 3px; font-size: calc(var(--gfont) - 2px);
    padding: 0 5px; margin-left: 6px; cursor: pointer; min-height: 20px; }
```

- [ ] **Step 9: Verify end to end**

Open the app normally. Settings → **Review prefixed words**.
Expected: a dialog listing `ההזדמנות → הזדמנות` and similar, and **not** listing
`בהצלחה`, `לשלוח`, `להגיד`, or `לדבר`. Confirm, then check in the console:

```js
(() => { const l = libAll(); return { gone: !l["ההזדמנות"], here: !!l["הזדמנות"], srs: !!srsAll()["הזדמנות"] }; })()
```

Expected: `{gone: true, here: true, srs: <true if it had drill history>}`.

Then paste a message containing a prefixed unknown word (e.g. `ההזדמנות טובה`) into the
Translator and press **Read it**. Expected: the Pending row for `ההזדמנות` carries a
`→ הזדמנות` button; clicking it replaces the pending row with the base word.

- [ ] **Step 10: Back up**

```bash
cp hebrew-reader.html "hebrew-reader.BACKUP-forms-clitic-review-$(date +%Y%m%d-%H%M).html"
```

---

## Task 12: The word panel

**Files:**
- Modify: `hebrew-reader.html` — CSS block, body markup, WORD FORMS section, `rowActions` (hebrew-reader.html:4263)
- Test: SELF TESTS section

**Interfaces:**
- Consumes: `formTagsFor`, `formGet` (T2).
- Produces: `formTableModel(entry)` → `{cols: [string], rows: [{label, cells: [{tag, he, tr, state} | null]}]}` (pure);
  `openWordPanel(key)`, `closeWordPanel()`.

- [ ] **Step 1: Write the failing tests**

```js
T("formTableModel: a verb lays out person down, tense across", () => {
  const m = formTableModel({ pos: "verb",
    forms: { "past.1s": F("סיימתי", "siyamti"), "pres.ms": F("מסיים", "mesayem") },
    formsMeta: { state: { "past.1s": "verified", "pres.ms": "uncertain" } } });
  assertEq(m.cols, ["past", "present", "future"]);
  const row1s = m.rows.find(r => r.label === "I");
  assertEq(row1s.cells[0].he, "סיימתי");
  assertEq(row1s.cells[0].state, "verified");
});
T("formTableModel: an adjective is a single row of four", () => {
  const m = formTableModel({ pos: "adj",
    forms: { ms: F("גדול", "gadol"), fs: F("גדולה", "gedola"),
             mp: F("גדולים", "gdolim"), fp: F("גדולות", "gdolot") } });
  assertEq(m.cols, ["masculine", "feminine"]);
  assertEq(m.rows.length, 2);
  assertEq(m.rows[0].cells[1].he, "גדולה");
});
T("formTableModel: a missing form is a null cell, not a crash", () => {
  const m = formTableModel({ pos: "adj", forms: { ms: F("גדול", "gadol") } });
  assertNull(m.rows[0].cells[1]);
});
T("formTableModel: an entry with no bank produces no rows", () => {
  assertEq(formTableModel({ pos: "adv", forms: {} }).rows, []);
  assertEq(formTableModel({}).rows, []);
});
T("formTableModel: state defaults to uncertain when unrecorded", () => {
  const m = formTableModel({ pos: "adj", forms: { ms: F("גדול", "gadol") } });
  assertEq(m.rows[0].cells[0].state, "uncertain");
});
```

- [ ] **Step 2: Run and verify they fail**

Expected: 5 failures.

- [ ] **Step 3: Implement the table model**

```js
/* The panel's table is a real <table> with real <th> headers, so a screen reader
   announces "past, second person feminine — siyamt" instead of reading a wall of
   divs. That means the LAYOUT has to be computed as rows and columns here rather
   than being implied by CSS. */
const FORM_ROW_LABELS = {
  "1s": "I", "2ms": "you (m)", "2fs": "you (f)", "3ms": "he", "3fs": "she",
  "1p": "we", "2p": "you (pl)", "3p": "they",
  ms: "masculine sing.", fs: "feminine sing.", mp: "masculine pl.", fp: "feminine pl.",
  sg: "singular", pl: "plural"
};
const VERB_TENSE_COLS = ["past", "present", "future"];
const VERB_PERSON_ROWS = ["1s", "2ms", "2fs", "3ms", "3fs", "1p", "3p"];

function formCell(entry, tag) {
  const f = formGet(entry, tag);
  if (!f) return null;
  const st = (entry.formsMeta && entry.formsMeta.state && entry.formsMeta.state[tag]) || "uncertain";
  return { tag: tag, he: f.he, tr: f.tr || "", state: st };
}

function formTableModel(entry) {
  const pos = entry && entry.pos;
  if (!pos || !formCount(entry)) return { cols: [], rows: [] };
  if (pos === "verb") {
    const rows = VERB_PERSON_ROWS.map(p => ({
      label: FORM_ROW_LABELS[p] || p,
      cells: [formCell(entry, "past." + p),
              formCell(entry, "pres." + verbPresentTagFor(p)),
              formCell(entry, "fut." + p)]
    })).filter(r => r.cells.some(c => c));
    return { cols: VERB_TENSE_COLS, rows: rows };
  }
  if (pos === "adj" || pos === "pron") {
    return { cols: ["masculine", "feminine"],
             rows: [{ label: "singular", cells: [formCell(entry, "ms"), formCell(entry, "fs")] },
                    { label: "plural",   cells: [formCell(entry, "mp"), formCell(entry, "fp")] }]
                    .filter(r => r.cells.some(c => c)) };
  }
  const tags = formTagsFor(pos);
  return { cols: ["form"],
           rows: tags.map(t => ({ label: FORM_ROW_LABELS[t] || t, cells: [formCell(entry, t)] }))
                     .filter(r => r.cells.some(c => c)) };
}

/* Hebrew present tense marks gender and number but NOT person — "I go", "you go"
   and "he goes" are all הולך. So a person row maps onto one of four participles. */
function verbPresentTagFor(person) {
  if (person === "1p" || person === "3p") return "mp";
  if (person === "2fs" || person === "3fs") return "fs";
  return "ms";
}
```

- [ ] **Step 4: Run and verify they pass**

Expected: `fail: 0`.

- [ ] **Step 5: Add the panel markup**

Add just before the closing `</body>`:

```html
<div id="wordPanel" class="wpanel" role="dialog" aria-modal="true"
     aria-labelledby="wpTitle" style="display:none">
  <div class="wpanel-box">
    <div class="wpanel-head">
      <h2 id="wpTitle"></h2>
      <button id="wpClose" aria-label="Close">✕</button>
    </div>
    <p id="wpMeta" class="wpanel-meta"></p>
    <div id="wpForms" class="wpanel-forms"></div>
    <p id="wpNote" class="wpanel-note"></p>
  </div>
</div>
```

- [ ] **Step 6: Add the CSS**

Add to the stylesheet, after the `.grow-row` rules (hebrew-reader.html:531):

```css
  .wpanel { position: fixed; inset: 0; background: rgba(0,0,0,.35);
            display: flex; align-items: center; justify-content: center; z-index: 60; }
  .wpanel-box { background: var(--paper); color: var(--ink); border-radius: 8px;
                padding: 18px 20px; max-width: 720px; max-height: 82vh; overflow: auto;
                box-shadow: 0 10px 40px rgba(0,0,0,.3); }
  .wpanel-head { display: flex; align-items: baseline; gap: 12px; }
  .wpanel-head h2 { font-family: "David", "Times New Roman", serif; direction: rtl;
                    font-size: 26px; margin: 0 auto 0 0; }
  .wpanel-head button { border: none; background: none; font-size: 18px; cursor: pointer;
                        color: var(--muted); min-width: 28px; min-height: 28px; }
  .wpanel-meta, .wpanel-note { color: var(--muted); font-size: 13px; margin: 6px 0 12px; }
  .wpanel-forms table { border-collapse: collapse; width: 100%; }
  .wpanel-forms th, .wpanel-forms td { text-align: left; padding: 5px 10px;
                                       border-bottom: 1px solid var(--rule); font-size: 14px; }
  .wpanel-forms th { color: var(--muted); font-weight: 600; }
  .wpanel-forms .fhe { font-family: "David", "Times New Roman", serif; direction: rtl;
                       margin-left: 8px; }
  /* never colour alone — the glyph carries the meaning for anyone who can't see it */
  .wpanel-forms .funsure { color: var(--muted); }
  .wpanel-forms .funsure::after { content: " ?"; font-weight: 700; }
```

- [ ] **Step 7: Implement open/close with the accessibility contract**

```js
/* A real modal: focus is trapped, Esc closes, and focus returns to the control
   that opened it. The Library is otherwise mouse-and-drag only, so this is also
   the first keyboard-reachable surface in it. */
let wpReturnFocus = null;

function openWordPanel(key) {
  const e = libAll()[key];
  if (!e) return;
  const panel = document.getElementById("wordPanel");
  wpReturnFocus = document.activeElement;
  document.getElementById("wpTitle").textContent = key;
  const bits = [e.tr || "", e.en || ""].filter(Boolean);
  if (e.pos) bits.push(e.pos);
  if (e.root) bits.push("root " + e.root + (e.binyan ? " · " + e.binyan : ""));
  if (e.gender) bits.push(e.gender === "f" ? "feminine noun" : "masculine noun");
  document.getElementById("wpMeta").textContent = bits.join(" · ");

  const host = document.getElementById("wpForms");
  host.innerHTML = "";
  const model = formTableModel(e);
  if (!model.rows.length) {
    const p = document.createElement("p");
    p.className = "wpanel-note";
    const parked = (formsQRoll(formsQAll(), todayISO()).tries[key] || 0) >= FORMS_MAX_TRIES;
    p.textContent = formCount(e) ? "No forms to lay out for this word."
      : parked ? "Form generation failed " + FORMS_MAX_TRIES + " times for this word, so it " +
                 "has been parked. Settings → Clear form queue to try again."
      : "No forms generated yet — use “fill in forms” in the Library header.";
    host.appendChild(p);
  } else {
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    hr.appendChild(document.createElement("th"));
    model.cols.forEach(c => { const th = document.createElement("th");
                              th.scope = "col"; th.textContent = c; hr.appendChild(th); });
    thead.appendChild(hr); table.appendChild(thead);
    const tb = document.createElement("tbody");
    model.rows.forEach(r => {
      const tr = document.createElement("tr");
      const th = document.createElement("th"); th.scope = "row"; th.textContent = r.label;
      tr.appendChild(th);
      r.cells.forEach(c => {
        const td = document.createElement("td");
        if (c) {
          const he = document.createElement("span"); he.className = "fhe"; he.textContent = c.he;
          const tr2 = document.createElement("span"); tr2.textContent = c.tr;
          td.appendChild(tr2); td.appendChild(he);
          if (c.state !== "verified") {
            td.classList.add("funsure");
            td.title = "Unverified — the app could not settle this form, so it won't act on it";
          }
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb); host.appendChild(table);
  }

  const meta = e.formsMeta || {};
  document.getElementById("wpNote").textContent =
    meta.clitic ? "Looks like " + meta.clitic + "- attached to " + (meta.lemma || "") +
                  " — Settings → Review prefixed words." : "";

  panel.style.display = "flex";
  document.getElementById("wpClose").focus();
}

function closeWordPanel() {
  document.getElementById("wordPanel").style.display = "none";
  if (wpReturnFocus && wpReturnFocus.focus) wpReturnFocus.focus();
  wpReturnFocus = null;
}

document.getElementById("wpClose").onclick = closeWordPanel;
document.getElementById("wordPanel").addEventListener("click", (ev) => {
  if (ev.target.id === "wordPanel") closeWordPanel();
});
document.addEventListener("keydown", (ev) => {
  const panel = document.getElementById("wordPanel");
  if (!panel || panel.style.display === "none") return;
  if (ev.key === "Escape") { ev.preventDefault(); closeWordPanel(); return; }
  if (ev.key !== "Tab") return;
  const f = panel.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
});
```

**Corrected during execution — the ⊞ must be built by a shared `formsBtn(key, extraCls)`
and added in BOTH row builders.** The step below adds it only to `rowActions`, which on an
opposites row is called `keyA`-only with `{noStar, noAudio, noShelf}` (hebrew-reader.html:5450).
A row-level ⊞ there opens the *left* word's forms while appearing to belong to a row holding
two words, and `keyB` gets no way in at all — the identical failure the file's own comments
record for the star, the audio button and the Hebrew column. `rowActions` now takes
`opts.noForms`, the opposites row passes it, and `buildOppSideEl` adds a per-side
`formsBtn(key, "sideforms")` with the same hover-reveal CSS as `.sidestar`.

- [ ] **Step 8: Add the row button**

In `rowActions` (hebrew-reader.html:4263), immediately **before** the `ed` (✎) button:

```js
  /* Forms panel. Phase 1 adds it alongside the existing buttons; Phase 2 folds
     ✎, the star and delete into the panel and drops the row to three controls. */
  const fm = document.createElement("button");
  fm.textContent = "⊞";
  fm.title = "Forms of “" + key + "”";
  fm.setAttribute("aria-label", "Forms of " + key);
  fm.addEventListener("click", (ev) => { ev.stopPropagation(); openWordPanel(key); });
  act.appendChild(fm);
```

- [ ] **Step 9: Verify end to end**

Open the app normally, go to the Library, hover a word that has a bank (one enriched
in Task 10) and click **⊞**.

Expected: the panel opens showing the form table; Tab cycles inside it and does not
escape; Esc closes it and focus returns to the ⊞ that opened it; unverified cells show
the `?` glyph and not only a colour.

Then check a word with no bank — expected: the *"No forms generated yet"* note, not an
empty table or a crash.

- [ ] **Step 10: Back up**

```bash
cp hebrew-reader.html "hebrew-reader.BACKUP-forms-panel-$(date +%Y%m%d-%H%M).html"
```

---

## Task 13: The "fill in forms" button and the automatic trigger

**Files:**
- Modify: `hebrew-reader.html` — Library header markup, WORD FORMS section, `renderLibrary`
- Test: manual

**Interfaces:**
- Consumes: `formsRunQueue`, `formsBankless`, `formsQAll`, `formsQRoll` (T9, T10).
- Produces: `updateFormsButton()`; a `#fillFormsBtn` in the Library header.

- [ ] **Step 1: Add the markup**

In the Library header, beside the zoom and Hebrew-size controls, add:

```html
<button id="fillFormsBtn" class="fillforms" style="display:none"></button>
```

- [ ] **Step 2: Add the CSS**

```css
  .fillforms { border: 1px solid var(--accent); background: none; color: var(--accent);
               border-radius: 5px; padding: 3px 10px; font-size: 12px; cursor: pointer;
               min-height: 24px; }
  .fillforms[disabled] { opacity: .5; cursor: default; }
```

- [ ] **Step 3: Wire it up**

```js
/* A background process that cannot be seen or started is a background process
   that will not be trusted — so the queue always has a visible count and a
   manual trigger, even though it also runs on its own. */
function updateFormsButton() {
  const btn = document.getElementById("fillFormsBtn");
  if (!btn) return;
  const q = formsQRoll(formsQAll(), todayISO());
  const n = formsBankless(libAll(), q, todayISO()).length;
  if (!n) { btn.style.display = "none"; return; }
  btn.style.display = "";
  btn.textContent = "fill in forms — " + n + " waiting";
  btn.disabled = !geminiKeys().length || formsBudgetLeft(q, todayISO()) < 2;
  btn.title = !geminiKeys().length
    ? "Needs a Gemini key — add one in Settings"
    : (formsBudgetLeft(q, todayISO()) < 2
        ? "Today's form-generation budget is used up — it resets tomorrow"
        : "Generate and verify forms for " + n + " word" + (n === 1 ? "" : "s"));
}

document.getElementById("fillFormsBtn").onclick = async () => {
  const btn = document.getElementById("fillFormsBtn");
  if (btn.disabled) return;
  btn.disabled = true;
  setLibStatus("Generating forms…");
  try {
    const res = await formsRunQueue({
      onProgress: (done, left) => setLibStatus("Forms: " + done + " done, " + left + " to go…")
    });
    setLibStatus("Forms filled in for " + res.words + " word" + (res.words === 1 ? "" : "s") +
                 " (" + res.calls + " API call" + (res.calls === 1 ? "" : "s") + ").");
  } catch (e) {
    setLibStatus("Form generation failed: " + (e.message || e));
  }
  renderLibrary();
  updateFormsButton();
};
```

- [ ] **Step 4: Call it from `renderLibrary`**

At the end of `renderLibrary()`, add:

```js
  updateFormsButton();
```

**Corrected during execution — the automatic trigger is OFF by default**, gated on
`hvr_forms_auto` and toggled from a Settings row (`formsAutoBtn`). The queue spends real
quota unattended, so the first run on a library that has never had forms generated should be
one the user starts and watches; the toggle makes it automatic once they trust the output.
The toggle handler deliberately does **not** use `settingsAction()`, which closes the modal —
a toggle whose new state you cannot see is a toggle you press twice.

- [ ] **Step 5: Add the automatic trigger**

At the end of the init block at the foot of the file:

```js
/* Automatic top-up: only once enough words have piled up to be worth a call, and
   only on idle so it never competes with the first render. Never on a fresh
   install with no key — that would just log failures. */
(function formsAutoStart() {
  if (!geminiKeys().length) return;
  const q = formsQRoll(formsQAll(), todayISO());
  if (formsBankless(libAll(), q, todayISO()).length < FORMS_AUTO_THRESHOLD) return;
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 3000));
  idle(() => { formsRunQueue({ onProgress: () => {} }).then(() => {
    renderLibrary(); updateFormsButton();
  }).catch(() => {}); });
})();
```

- [ ] **Step 6: Add "Clear form queue" to Settings**

A word parked after 3 failures never retries on its own — that is deliberate, but it needs
a way back, and the panel's message (Task 12) points here. Add beside the other Settings
actions:

```html
<button id="clearFormQBtn">Clear form queue</button>
```

```js
/* Unparks every word that hit FORMS_MAX_TRIES, and resets today's call count.
   Deliberately does NOT delete any generated forms — this is a retry switch,
   not a wipe. */
document.getElementById("clearFormQBtn").onclick = settingsAction(() => {
  const q = formsQAll();
  const parked = Object.keys(q.tries || {}).length;
  if (!parked && !(q.calls > 0)) { alert("The form queue is already clear."); return; }
  formsQSave({ day: todayISO(), calls: 0, tries: {} });
  settingsModal.style.display = "none";
  updateFormsButton();
  setLibStatus("Form queue cleared — " + parked + " parked word" +
               (parked === 1 ? "" : "s") + " will be retried.");
});
```

- [ ] **Step 7: Verify**

Open the app normally on the Library page.
Expected: the button reads `fill in forms — N waiting` with N matching the number of
words without banks. Click it; expected: the status line counts down and the button's
number falls. With no key configured, expected: the button is disabled and its tooltip
says a key is needed.

- [ ] **Step 8: Run the full self-test suite one final time**

Open `?selftest=1`. Expected: `fail: 0`, and `pass` equal to the total number of `T(...)`
registrations in the file (`grep -c "^T(" hebrew-reader.html`).

- [ ] **Step 9: Back up**

```bash
cp hebrew-reader.html "hebrew-reader.BACKUP-after-word-forms-phase1-$(date +%Y%m%d-%H%M).html"
```

---

## Findings from the live API runs

Four live batches of the same deliberately adversarial 10 words (irregular verbs `ללכת`
`להיות` `לתת`, the clitic traps `בהצלחה` `ההזדמנות` `לשלוח`, feminine noun `דלת`, irregular
plural `יום`, adverb `מהר`). Each produced a fix:

1. **The verify prompt identified each line by the lemma, not the library key.** The model
   answered about `הלך` while the row is keyed `ללכת`, so every reply was discarded and both
   verification and the tiebreak were silently off — every AI form read `uncertain` by
   default rather than by judgement. Fixed by sending the key and demanding a verbatim echo;
   `formsVerifyIndex()` additionally accepts the lemma, so a disobedient reply degrades
   instead of disabling verification.
2. **The `catch` blocks around passes 2 and 3 swallowed their errors.** That is *how* the
   above went unnoticed. They now record into `passErrors` on the batch result.
3. **A generated form contained Arabic letters.** `תהי` + U+064A ARABIC LETTER YEH ×2 for
   "you (f) will be". Best-of-three did catch it, but `isHebrewForm()` now rejects the whole
   class deterministically, before storage, for free.
4. **A long generation returned malformed JSON**, failing all 10 words at once. Generation
   now retries once, and `tries` is not incremented on the first failure — a broken reply is
   a property of that generation, not of the words in it.

Also added: `normaliseRoot()` (replies mixed the Hebrew maqaf `ה־ל־ך` with ASCII hyphens
`ש-ל-ח`), and `formsMeta.expected`, because a long generation truncated `לשלוח` to 15 of 21
forms and `formsBankless()` — which only asks whether `forms` exists — would have left that
partial bank looking finished forever.

**Final live result:** 88 forms across 10 words, 87 verified, 0 containing non-Hebrew
characters, every clitic ruling correct (`ההזדמנות` flagged, `בהצלחה` and `לשלוח` left alone),
both noun genders correct.

**Known limitations, for Phase 2:**

- **Partial banks are not topped up.** `formsMeta.expected` records the shortfall and the
  panel reports it, but nothing re-requests the missing forms.
- **Transliterations are occasionally garbled** even when the Hebrew is right (`past.1s` of
  `ללכת` came back as "hachati" for הלכתי). The Hebrew is what the app acts on, so this is
  cosmetic — but it is visible in the panel and in the pad's reverse index.

## Phase 1 done — what exists now

Every library word can carry a verified bank of inflected forms, generated in
batches of 10 and settled best-of-three, viewable in an accessible per-word panel.
The re-key helper is built and proven on the clitic set. Nothing that existed
before behaves differently.

**Phases 2–4 get their own plans**, each written once its predecessor lands:

- **Phase 2** — the header lens, the row cleanup (pill removed, star and delete folded into the panel, three buttons), the accessibility pass on the grid.
- **Phase 3** — pad integration: every form in the reverse index, agreement flagging against the lens.
- **Phase 4** — lemma re-basing of the ~40 inflected rows, reusing `rekeyWord` unchanged.

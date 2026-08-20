# Word Forms — Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-file the rows that are stored as inflections (`ko'evet`, `amarta`, `siyamti`) under their dictionary forms, carrying every reference with them — and make the one destructive operation in the app undoable.

**Architecture:** Reuses `rekeyWord()` unchanged, proven on the clitic set in Phase 1. The clitic flow and the inflection flow are the *same operation* for different reasons, so they merge into one review list rather than two near-identical Settings buttons.

**Tech Stack:** Vanilla ES6, `localStorage`, the `?selftest=1` harness.

## Global Constraints

- **Single file**, no dependencies. "Commit" means a timestamped backup.
- **Only re-base what the model ruled on.** A candidate requires `formsMeta.checked` and a
  `lemma` that differs from the key. No heuristics — the same rule that protects `בהצלחה`.
- **One confirm for the whole list, shown in full first.** George chose "dictionary form,
  remembers how you met it", not per-word approval.
- **`rekeyWord()` is not to be modified.** It carries `hvr_srs`, `hvr_focus`, `.opp`,
  `hvr_aliases`, `hvr_known`, `hvr_archive`, `hvr_struggle` and the IndexedDB audio blob.
  Not `hvr_pathscores` — section-keyed, established in Phase 1.
- Storage key, exact: `hvr_prerebase`.

## Two things the spec did not cover

1. **The row's `tr` and `en` describe the OLD form.** Re-key `siyamti` → `לסיים` and the row
   still reads *"siyamti · I finished"* under a key meaning "to finish". The key would be
   right and everything on screen wrong. `tr` is fixable for free from the bank's citation
   form; `en` is not — "I finished" → "to finish" is a translation, not a transformation —
   so it takes one batched API call, and the re-basing proceeds without it if that fails.
2. **This is the only irreversible action in the app.** It rewrites eight stores at once. A
   snapshot of the library taken immediately before, plus an *Undo re-filing* action, costs
   a few lines and is the difference between a mistake being survivable or not.

---

## Task 1: Finding the candidates

**Files:** `hebrew-reader.html` — WORD FORMS section; SELF TESTS.

**Interfaces:**
- Produces: `rebaseCandidates(lib)` → `[{key, to, reason, detail, tr, en}]`, covering both
  clitic-prefixed and inflected rows, sorted by `key`.
  `reason` is `"prefix"` or `"inflection"`.

- [ ] **Step 1: Write the failing tests**

```js
/* ---- Phase 4 Task 1: what needs re-filing ---- */
const P4_LIB = {
  /* stored as a 1st-person past — the classic case */
  "סיימתי": { tr:"siyamti", en:"I finished", pos:"verb",
    forms:{ inf:F("לסיים","lesayem"), "past.1s":F("סיימתי","siyamti") },
    formsMeta:{ checked:"2026-08-20", lemma:"לסיים",
                state:{ inf:"verified", "past.1s":"verified" } } },
  /* clitic-prefixed */
  "ההזדמנות": { tr:"ha-izdamnut", en:"the opportunity", pos:"noun",
    forms:{ sg:F("הזדמנות","izdamnut") },
    formsMeta:{ checked:"2026-08-20", lemma:"הזדמנות", clitic:"ha", state:{ sg:"verified" } } },
  /* already canonical — must be left alone */
  "גדול": { tr:"gadol", en:"big", pos:"adj", forms:{ ms:F("גדול","gadol") },
    formsMeta:{ checked:"2026-08-20", lemma:"גדול", state:{ ms:"verified" } } },
  /* no bank yet — no ruling, so no claim */
  "כואבת": { tr:"ko'evet", en:"hurts (f)" }
};
T("rebaseCandidates: finds an inflected row and its dictionary form", () => {
  const c = rebaseCandidates(P4_LIB).find(x => x.key === "סיימתי");
  assertEq(c.to, "לסיים");
  assertEq(c.reason, "inflection");
});
T("rebaseCandidates: finds a prefixed row too, and says which it is", () => {
  const c = rebaseCandidates(P4_LIB).find(x => x.key === "ההזדמנות");
  assertEq(c.to, "הזדמנות");
  assertEq(c.reason, "prefix");
});
T("rebaseCandidates: leaves a row that is already its dictionary form", () => {
  assertTrue(!rebaseCandidates(P4_LIB).find(x => x.key === "גדול"));
});
T("rebaseCandidates: makes no claim about a word with no bank", () => {
  assertTrue(!rebaseCandidates(P4_LIB).find(x => x.key === "כואבת"),
             "no formsMeta.checked means the model never ruled");
});
T("rebaseCandidates: carries the citation spelling so tr can be corrected", () => {
  assertEq(rebaseCandidates(P4_LIB).find(x => x.key === "סיימתי").tr, "lesayem");
});
T("rebaseCandidates: safe on junk", () => {
  assertEq(rebaseCandidates(null), []);
  assertEq(rebaseCandidates({ "א": null }), []);
});
```

- [ ] **Step 2: Run and verify they fail.**

- [ ] **Step 3: Implement**

```js
/* Rows whose KEY is not the dictionary form. Two reasons, one operation:
     prefix     — ההזדמנות is ה + הזדמנות
     inflection — סיימתי is the 1st-person past of לסיים
   Both are "this row is filed under the wrong string", both are fixed by
   rekeyWord(), so they share one review list rather than two Settings buttons
   that do the same thing.

   Requires formsMeta.checked: without a ruling from the model there is no
   evidence, and guessing is what would destroy בהצלחה. */
function rebaseCandidates(lib) {
  const out = [];
  Object.keys(lib || {}).forEach(key => {
    const e = lib[key];
    if (!e) return;
    const meta = e.formsMeta;
    if (!meta || !meta.checked) return;
    const to = meta.lemma;
    if (!to || to === key) return;
    /* The citation spelling, so the re-filed row can stop calling itself
       "siyamti" while sitting under a key that means "to finish". */
    const cite = formCitation(to, e);
    out.push({ key: key, to: to, reason: meta.clitic ? "prefix" : "inflection",
               detail: meta.clitic ? meta.clitic + "-" : (formHuman(inflectedTagOf(e, key)) || ""),
               tr: (cite && cite.tr) || "", en: e.en || "" });
  });
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/* Which form the row's own key actually is — so the review list can say
   "sיimti is the I-past of לסיים" rather than just moving it silently. */
function inflectedTagOf(entry, key) {
  if (!entry || !entry.forms) return null;
  return Object.keys(entry.forms).find(t => entry.forms[t] && entry.forms[t].he === key) || null;
}
```

- [ ] **Step 4: Run tests. Back up.**

---

## Task 2: The snapshot and undo

**Files:** `hebrew-reader.html` — WORD FORMS section; Settings.

**Interfaces:**
- Produces: `PREREBASE_KEY`, `snapshotBeforeRebase()`, `hasRebaseSnapshot()`,
  `undoRebase()` → count restored.

- [ ] **Step 1: Write the failing tests**

```js
/* ---- Phase 4 Task 2: the safety net ---- */
T("rebase snapshot: round-trips the library through storage", () => {
  const before = lsGet(PREREBASE_KEY);
  try {
    lsSet(PREREBASE_KEY, JSON.stringify({ lib: { "א": { tr: "a" } }, at: "2026-08-20" }));
    assertTrue(hasRebaseSnapshot(), "a written snapshot must be detected");
    lsSet(PREREBASE_KEY, "");
    assertTrue(!hasRebaseSnapshot(), "an empty one must not");
    lsSet(PREREBASE_KEY, "{{{not json");
    assertTrue(!hasRebaseSnapshot(), "corrupt storage must read as absent, not throw");
  } finally { if (before === null) localStorage.removeItem(PREREBASE_KEY);
             else lsSet(PREREBASE_KEY, before); }
});
```

- [ ] **Step 2: Implement**

```js
/* Re-filing rewrites eight stores at once and is the only irreversible thing in
   the app. One snapshot of the library, taken immediately before, turns a
   mis-click from a catastrophe into a nuisance.

   The library ONLY — srs/focus/aliases are all repointed, not destroyed, and
   restoring the library alone puts the keys back that they point at. */
const PREREBASE_KEY = "hvr_prerebase";
function snapshotBeforeRebase() {
  try { lsSet(PREREBASE_KEY, JSON.stringify({ at: todayISO(), lib: libAll() })); return true; }
  catch (e) { return false; }
}
function hasRebaseSnapshot() {
  try { const s = JSON.parse(lsGet(PREREBASE_KEY)); return !!(s && s.lib); }
  catch (e) { return false; }
}
function undoRebase() {
  let snap = null;
  try { snap = JSON.parse(lsGet(PREREBASE_KEY)); } catch (e) { return 0; }
  if (!snap || !snap.lib) return 0;
  libSave(snap.lib);
  localStorage.removeItem(PREREBASE_KEY);
  rebuildTrIndex();
  renderLibrary();
  return Object.keys(snap.lib).length;
}
```

- [ ] **Step 3: Add the Settings row** (hidden unless a snapshot exists):

```html
<div class="setrow" id="undoRebaseRow" style="display:none">
  <div class="setrow-text"><b>Undo re-filing</b>
    <p>Puts the library back exactly as it was before the last "Re-file under dictionary forms". Drill history, marks and pairs were only repointed, never deleted, so this restores them too. Available until you re-file again.</p></div>
  <button class="btn secondary" id="undoRebaseBtn">Run</button>
</div>
```

- [ ] **Step 4: Wire it, and show the row only when there is something to undo.**

- [ ] **Step 5: Run tests. Back up.**

---

## Task 3: Re-basing, with `tr` corrected

**Files:** `hebrew-reader.html` — WORD FORMS section.

**Interfaces:**
- Consumes: `rebaseCandidates` (T1), `snapshotBeforeRebase` (T2), `rekeyWord` (Phase 1).
- Produces: `applyRebase(cands)` → Promise<`{moved, merged, failed}`>.

- [ ] **Step 1: Implement**

```js
/* One await per word — rekeyWord touches IndexedDB. Sequential on purpose: two
   concurrent renames that merge into the same target would race on the same
   library object. */
async function applyRebase(cands) {
  const res = { moved: 0, merged: 0, failed: 0 };
  for (const c of cands) {
    const before = libAll();
    const willMerge = !!before[c.to];
    const ok = await rekeyWord(c.key, c.to);
    if (!ok) { res.failed++; continue; }
    res.moved++;
    if (willMerge) res.merged++;
    /* The row was calling itself by the inflected spelling. The key is now the
       dictionary form, so the pronunciation must follow it — otherwise the grid
       reads "siyamti" under a word meaning "to finish". `en` cannot be fixed
       this way and is handled separately. */
    if (c.tr) {
      const lib = libAll();
      if (lib[c.to]) { lib[c.to].tr = c.tr; libSave(lib); }
    }
  }
  rebuildTrIndex();
  return res;
}
```

- [ ] **Step 2: Verify with a fabricated library in the test instance** — seed a row keyed by
  an inflection with drill history, a focus mark and an opposites partner; re-base it; assert
  the key moved, `tr` became the citation spelling, and every reference followed.

- [ ] **Step 3: Back up.**

---

## Task 4: Re-glossing the English

**Files:** `hebrew-reader.html` — WORD FORMS section.

**Interfaces:**
- Produces: `reglossPrompt(words)`, `applyReglossReply(json, keys)` → `{he: en}`,
  `reglossLemmas(keys)` → Promise<count>.

- [ ] **Step 1: Write the failing tests**

```js
/* ---- Phase 4 Task 4: fixing the English after a re-base ---- */
T("reglossPrompt: asks about each word and demands JSON", () => {
  const p = reglossPrompt([{ he: "לסיים", tr: "lesayem", was: "I finished" }]);
  assertTrue(p.indexOf("לסיים") !== -1);
  assertTrue(p.indexOf("I finished") !== -1, "the old gloss is context for what changed");
  assertTrue(/JSON/i.test(p));
});
T("applyReglossReply: keeps only words that were asked about", () => {
  assertEq(applyReglossReply({ words: [ { hebrew:"לסיים", english:"to finish" },
                                        { hebrew:"אחר", english:"other" } ] }, ["לסיים"]),
           { "לסיים": "to finish" });
});
T("applyReglossReply: trims, and drops empties and junk", () => {
  assertEq(applyReglossReply({ words: [ { hebrew:"לסיים", english:"  to finish  " },
                                        { hebrew:"לסיים2", english:"" }, null, 7 ] },
                             ["לסיים","לסיים2"]), { "לסיים": "to finish" });
  assertEq(applyReglossReply(null, ["לסיים"]), {});
});
```

- [ ] **Step 2: Implement**

```js
/* "I finished" -> "to finish" is a translation, not a transformation, so it needs
   the model. One batched call for the whole re-filing. Entirely optional: if it
   fails, the words are still correctly re-filed and only their English is stale,
   which is visible and editable in the panel. */
function reglossPrompt(words) {
  const list = words.map(w => "- " + w.he + " (" + (w.tr || "") +
    (w.was ? "; previously glossed “" + w.was + "”" : "") + ")").join("\n");
  return "These Hebrew words have just been re-filed under their dictionary forms, so their " +
    "old English glosses describe the inflected form they used to be stored as. Give the " +
    "English for the DICTIONARY form of each.\n\n" +
    "Return ONLY JSON: {\"words\":[{\"hebrew\":\"<exactly as given>\",\"english\":\"<1-3 words>\"}]}\n" +
    "For a verb use the infinitive (\"to finish\"), not a conjugated gloss (\"I finished\").\n\n" +
    list;
}

function applyReglossReply(json, keys) {
  const want = {}; (keys || []).forEach(k => { want[k] = 1; });
  const out = {};
  const words = json && json.words;
  if (!Array.isArray(words)) return out;
  words.forEach(w => {
    if (!w || typeof w !== "object") return;
    const he = String(w.hebrew || "").trim();
    const en = String(w.english || "").trim();
    if (!he || !en || !want[he]) return;
    out[he] = en;
  });
  return out;
}

async function reglossLemmas(items) {
  if (!items.length || !geminiKeys().length) return 0;
  const keys = items.map(i => i.he);
  let map = {};
  try { map = applyReglossReply(await formsAsk(reglossPrompt(items)), keys); }
  catch (e) { return 0; }
  const lib = libAll();
  let n = 0;
  Object.keys(map).forEach(he => { if (lib[he]) { lib[he].en = map[he]; n++; } });
  if (n) { libSave(lib); rebuildTrIndex(); }
  return n;
}
```

- [ ] **Step 3: Run tests. Back up.**

---

## Task 5: The unified Settings action

**Files:** `hebrew-reader.html` — Settings markup and handlers.

Replaces the Phase-1 **Review prefixed words** button, which handled half of this.

- [ ] **Step 1: Replace the Settings row**

```html
<div class="setrow">
  <div class="setrow-text"><b>Re-file under dictionary forms</b>
    <p>Some words are filed under a form rather than the word: "siyamti" instead of "lesayem", or "ha-izdamnut" with the ה still attached. This lists them and moves each to its dictionary form, carrying drill history, marks, pairs and cached audio across. Only words whose forms have been generated are offered — the model is what tells an attached ה from a word that starts with one.</p></div>
  <button class="btn secondary" id="rebaseBtn">Run</button>
</div>
```

- [ ] **Step 2: Wire it**

```js
document.getElementById("rebaseBtn").onclick = settingsAction(async () => {
  const cands = rebaseCandidates(libAll());
  if (!cands.length) {
    const pending = cliticCandidates(libAll()).length;
    alert(pending
      ? pending + " word" + (pending === 1 ? "" : "s") + " look prefixed, but none have had " +
        "their forms generated yet.\n\nRun “fill in forms” in the Library header first — the " +
        "model is what tells ha-izdamnut (really the-opportunity) from be-hatslakha (good " +
        "luck, which keeps its ב)."
      : "Nothing to re-file — every word is already under its dictionary form.");
    return;
  }
  const lines = cands.map(c => "  " + c.key + " → " + c.to +
    (c.detail ? "   (" + c.detail + ")" : "")).join("\n");
  if (!confirm("Re-file " + cands.length + " word" + (cands.length === 1 ? "" : "s") +
               " under the dictionary form?\n\n" + lines +
               "\n\nDrill history, marks, pairs and cached audio move with them. " +
               "Settings → Undo re-filing puts it all back.")) return;

  snapshotBeforeRebase();
  const res = await applyRebase(cands);
  const n = await reglossLemmas(cands.filter(c => c.reason === "inflection")
                                     .map(c => ({ he: c.to, tr: c.tr, was: c.en })));
  renderLibrary();
  if (typeof renderPad === "function") renderPad();
  paintUndoRebaseRow();
  settingsModal.style.display = "none";
  setLibStatus(res.moved + " word" + (res.moved === 1 ? "" : "s") + " re-filed" +
    (res.merged ? ", " + res.merged + " merged into an existing row" : "") +
    (n ? ", " + n + " re-glossed" : "") +
    (res.failed ? ", " + res.failed + " failed" : "") + ".");
});
```

- [ ] **Step 3: Remove the old `reviewPrefixBtn` row and handler.** `cliticCandidates` stays —
  it still powers the "nothing generated yet" message and the Pending suggestion.

- [ ] **Step 4: Verify end to end in the test instance**, including the undo.

- [ ] **Step 5: Run the full suite. Back up.**

---

## Corrections made during execution

1. **The snapshot must cover every store, not just the library.** The plan asserted that
   restoring `hvr_library` alone was enough because the other stores are "repointed, not
   destroyed". That is exactly backwards: put the library back and the repointed keys now
   name rows that no longer exist. Verified by undoing a re-base and finding `hvr_srs` still
   filed under `לסיים` while the library had reverted to `סיימתי` — the drill history
   orphaned under a key with no word attached. The snapshot now covers `hvr_library`,
   `hvr_srs`, `hvr_focus`, `hvr_aliases`, `hvr_known`, `hvr_archive`, `hvr_struggle`.
   The IndexedDB audio blob is deliberately excluded: regenerable TTS, and an orphaned clip
   costs a re-fetch.
2. **`REBASE_SNAPSHOT_STORES` had to become a function.** As a top-level `const` in the WORD
   FORMS section it evaluated `LIB_KEY` and friends, all declared ~700 lines later, throwing
   *"Cannot access 'LIB_KEY' before initialization"* on load — the temporal-dead-zone trap
   this file's `syncShelves` comment already records, and which this plan's own Global
   Constraints named.

## Verified behaviour

A row keyed `סיימתי` with drill history (n=5, due 2026-09-01), a focus mark, an alias, an
archive entry, an opposites partner and a cached audio blob re-based to `לסיים`: every
reference followed, the audio blob moved and the old one was deleted, and `tr` became
`lesayem`. Undo restored all seven stores consistently, drill history and due date intact.
Re-gloss turned *"I finished"* into *"to finish"*, and is a silent no-op with no API key.

## Out of scope

- Topping up partial banks.
- Re-basing a word whose forms have never been generated. By design: no ruling, no move.

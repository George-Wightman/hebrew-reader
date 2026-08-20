# Gender-Pair Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop masculine/feminine forms of the same Hebrew word from occupying two rows in the Library — merge them into one row with a small toggle to view either form, following the exact precedent already set for plurals (`singularOf()`/`PLURAL_TO_SINGULAR`).

**Architecture:** A hand-curated `GENDER_PAIRS` map (feminine Hebrew → masculine Hebrew) drives a `genderBaseOf()` redirect inside `cardEntry()`, exactly parallel to `singularOf()`. Library entries gain an optional `.genderPair: {he, tr}` field carrying the feminine form. A one-time migration (`syncGender()`, same family as `syncCategories`/`syncOpposites`/`syncPunctuation`) merges George's existing duplicate rows. Both library-row renderers (`buildWordRow`, `buildOppSideEl`) get a small "M/F" toggle button that swaps the displayed text in place — no new persisted store, resets to masculine on reload.

**Tech Stack:** Single-file vanilla HTML/JS (`hebrew-reader.html`), no build step, no test framework. Verification in this plan uses the Browser pane's `javascript_tool` to exercise functions directly and to drive the real UI — the same method this codebase's own history (see the design doc) has always used, since there is no CLI test runner for a `file://` single-page app.

**Design doc:** `docs/superpowers/specs/2026-08-16-gender-pair-consolidation-design.md` — read it for the full rationale behind every exclusion below; this plan does not repeat the "why", only the "what".

## Global Constraints

- Single file: `hebrew-reader.html`. Every task edits this one file.
- `DICT` keeps both Hebrew spellings for every pair — never delete a masculine or feminine key from `DICT`, or the offline reader stops recognising that spelling in a real message.
- Every one-time migration is gated on its own `localStorage` flag (`hvr_genderfix_v1`) and must run **after** `libSeedIfNeeded()` in the boot sequence (an unconditional `libSave()` before seeding has bricked a fresh install before — see the comment already in the file above `libSeedIfNeeded();` at line 5587).
- Any change that touches which words exist, or how they're spelled, must call `rebuildTrIndex()` if it runs interactively (migrations at boot don't need to — `rebuildTrIndex()` is already called after the boot migrations run, before first render).
- No new persisted `localStorage` key for toggle state — masculine-by-default, in-memory only, per the approved design.
- Excluded from `GENDER_PAIRS` (must not appear as a key or value pairing each other): את, אוכל/אוכלת, מספר/מספרת, זה/זאת/זו, ישן/ישנה, זכר/נקבה, and the future-tense forms תהיה, תרצה/תרצי, תוכל/תוכלי, אראה/תראה/תראי.

---

## Task 1: `GENDER_PAIRS` map and lookup helpers

**Files:**
- Modify: `hebrew-reader.html` — insert after `singularOf()` (ends at line 2145) and before the `STOPLIST` comment (line 2147).

**Interfaces:**
- Produces: `GENDER_PAIRS` (object, `{femHebrew: mascHebrew}`), `genderBaseOf(word)` → masculine Hebrew string or `null`, `MASC_TO_FEM` (object, reverse of `GENDER_PAIRS`), `genderPairFor(heb)` → `{he, tr}` or `null`. All four are used by Tasks 3–6.

- [ ] **Step 1: Insert the map and helpers**

Insert this block immediately after the closing `}` of `singularOf()` (hebrew-reader.html:2145) and before the `/* Words skipped by automatic harvesting...` comment (line 2147):

```js
/* Hebrew adjectives, verbs, pronouns and numbers mark grammatical gender, and a
   feminine sighting doesn't deserve its own library row any more than a plural
   does — see singularOf() just above. Unlike plurals, gender is NOT a safely
   automatable suffix rule (adjectives usually add ה, most verb participles add
   ת, some add ה, numbers 3-5 reverse which side gets the ה) — so this is a
   fully explicit table, not a heuristic with overrides.

   Deliberately excludes a few pairs where merging would trade a display
   duplicate for real ambiguity:
   - את — also the object-marker particle, not just "you (f)".
   - אוכל/אוכלת, מספר/מספרת — the masculine side is already a noun/verb
     homograph ("food/eat(s)", "number/tell(s)"); attaching the feminine verb
     form would imply the noun sense has a feminine form too.
   - זה/זאת/זו — three-way, and זה is also used as gender-neutral "it".
   - ישן/ישנה — ישן is itself a homograph ("sleep(s) / old (thing)"), same
     reasoning as אוכל/מספר.
   - זכר/נקבה — these name two different people/animals ("a male"/"a female"),
     not two forms of one word, same as not merging "boy" and "girl".
   - Ambiguous future-tense forms (תהיה, תרצה/תרצי, תוכל/תוכלי, אראה/תראה/תראי) —
     these encode grammatical PERSON (you vs. she) as well as gender, so
     pairing by gloss text alone would conflate two different people. */
const GENDER_PAIRS = {
  // adjectives & general
  "שמחה":"שמח", "איזו":"איזה", "מישהי":"מישהו", "טובה":"טוב", "רעה":"רע",
  "גדולה":"גדול", "קטנה":"קטן", "חדשה":"חדש", "קלה":"קל", "חשובה":"חשוב",
  "נחמדה":"נחמד", "מדהימה":"מדהים", "נהדרת":"נהדר", "עייפה":"עייף", "עצובה":"עצוב",
  "הבאה":"הבא", "אחרת":"אחר", "חמודה":"חמוד", "גבוהה":"גבוה", "נמוכה":"נמוך",
  "צמאה":"צמא", "רעבה":"רעב", "חברה":"חבר",
  // present-tense verbs
  "אוהבת":"אוהב", "יודעת":"יודע", "חושבת":"חושב", "מדברת":"מדבר", "אומרת":"אומר",
  "הולכת":"הולך", "באה":"בא", "שומעת":"שומע", "מבינה":"מבין", "יכולה":"יכול",
  "צריכה":"צריך", "גרה":"גר", "עובדת":"עובד", "לומדת":"לומד", "נוסעת":"נוסע",
  "טסה":"טס", "מרגישה":"מרגיש", "זוכרת":"זוכר", "מתגעגעת":"מתגעגע", "נהנית":"נהנה",
  "עוזרת":"עוזר", "שולחת":"שולח", "כותבת":"כותב", "קוראת":"קורא", "שואלת":"שואל",
  "חוזרת":"חוזר", "מתקשרת":"מתקשר", "מגיעה":"מגיע", "לוקחת":"לוקח", "נותנת":"נותן",
  "מקבלת":"מקבל", "מבשלת":"מבשל", "קמה":"קם", "יושבת":"יושב", "נשארת":"נשאר",
  "מתרגשת":"מתרגש", "דואגת":"דואג",
  // past tense
  "עברה":"עבר", "הייתה":"היה",
  // other
  "אמורה":"אמור", "לא יודעת":"לא יודע",
  // numbers (3-5 reverse the usual pattern — the bare form is feminine, the
  // ה-suffixed form is masculine)
  "אחת":"אחד", "שתיים":"שניים", "שלוש":"שלושה", "ארבע":"ארבעה", "חמש":"חמישה",
  "ראשונה":"ראשון", "אחרונה":"אחרון",
  // teens
  "אחת עשרה":"אחד עשר", "שתים עשרה":"שנים עשר", "שלוש עשרה":"שלושה עשר",
  "ארבע עשרה":"ארבעה עשר", "חמש עשרה":"חמישה עשר", "שש עשרה":"שישה עשר",
  "שבע עשרה":"שבעה עשר", "שמונה עשרה":"שמונה עשר", "תשע עשרה":"תשעה עשר",
  // pronouns
  "אתן":"אתם", "הן":"הם"
};
function genderBaseOf(word) { return GENDER_PAIRS[word] || null; }

/* Reverse of GENDER_PAIRS, built once — used to backfill .genderPair onto a
   library entry that only ever arrived via its masculine form (seeded from
   SEED/CORE_WORDS, or approved before this feature existed), so the toggle
   appears even without ever having witnessed the feminine sighting directly. */
const MASC_TO_FEM = {};
Object.keys(GENDER_PAIRS).forEach(fem => { MASC_TO_FEM[GENDER_PAIRS[fem]] = fem; });
function genderPairFor(heb) {
  const fem = MASC_TO_FEM[heb];
  if (!fem || !DICT[fem]) return null;
  return { he: fem, tr: String(DICT[fem][0]).split("/")[0] };
}
```

- [ ] **Step 2: Verify in the Browser pane**

Open `hebrew-reader.html` in the Browser pane (`mcp__Claude_Browser__preview_start` with the file's path, or `navigate` to the `file://` URL), then run via `javascript_tool`:

```js
JSON.stringify({
  gadol: genderBaseOf("גדולה"),
  notPaired: genderBaseOf("אוכלת"),
  reverseLookup: genderPairFor("גדול"),
  reverseMissing: genderPairFor("אוכל"),
  count: Object.keys(GENDER_PAIRS).length
})
```

Expected: `gadol` is `"גדול"`, `notPaired` is `null` (אוכלת/אוכל is on the exclusion list, never entered into `GENDER_PAIRS`), `reverseLookup` is `{"he":"גדולה","tr":"gdola"}`, `reverseMissing` is `null` (אוכל has no DICT entry ending in a paired feminine, since it was never added), `count` is `77`.

- [ ] **Step 3: Save**

No git repo in this project — saving the file via the editor is the checkpoint. Confirm the file still parses by checking the Browser pane console shows no syntax errors on load (`mcp__Claude_Browser__read_console_messages` with `onlyErrors: true` → expect empty).

---

## Task 2: Fill the DICT gaps the current Pending queue exposes

Four words visible in George's real Pending queue right now (`gvoha`/`nemukha`/`tsame`/`tsme'a`, plus the masculine `namuch`/`gavoha` they'd otherwise never merge with) don't exist in `DICT` at all yet — `re'eva`/`ra'ev` (hungry) is already a library word but also missing from `DICT`. Without these, `genderBaseOf()`/`genderPairFor()` have nothing to redirect to or backfill from for these four pairs specifically (the redirect via `GENDER_PAIRS` still works even without a DICT entry — see Task 3 — but adding them also lets the offline reader recognise these spellings in a real message, the same reason plurals keep both DICT forms).

**Files:**
- Modify: `hebrew-reader.html:1721` (inside the `"@10|Describing words"` block) and `hebrew-reader.html:1896` (inside the `"@19|Feelings & health"` block).

**Interfaces:**
- Consumes: nothing new.
- Produces: `DICT["גבוה"]`, `DICT["גבוהה"]`, `DICT["נמוך"]`, `DICT["נמוכה"]`, `DICT["צמא"]`, `DICT["צמאה"]`, `DICT["רעב"]`, `DICT["רעבה"]` — all four pairs already appear as keys in `GENDER_PAIRS` from Task 1, so no further wiring is needed once these exist.

- [ ] **Step 1: Add tall/short to the Describing words block**

In `hebrew-reader.html`, find this exact line (1721):

```js
  "גדול":["gadol","big"], "גדולה":["gdola","big (f)"], "קטן":["katan","small"], "קטנה":["ktana","small (f)"],
```

Replace it with:

```js
  "גדול":["gadol","big"], "גדולה":["gdola","big (f)"], "קטן":["katan","small"], "קטנה":["ktana","small (f)"],
  "גבוה":["gavoha","tall"], "גבוהה":["gvoha","tall (f)"], "נמוך":["namuch","short"], "נמוכה":["nemukha","short (f)"],
```

(Transliterations `gvoha`/`nemukha` are copied verbatim from George's own Pending queue, so the redirect lands on the exact spelling he already has pending — no separate mismatched duplicate gets created.)

- [ ] **Step 2: Add thirsty/hungry to the Feelings & health block**

Find this exact line (1896):

```js
  "חזק":["chazak","strong"], "חלש":["chalash","weak"], "סבלנות":["savlanut","patience"],
```

Replace it with:

```js
  "חזק":["chazak","strong"], "חלש":["chalash","weak"], "סבלנות":["savlanut","patience"],
  "צמא":["tsame","thirsty"], "צמאה":["tsme'a","thirsty (f)"], "רעב":["ra'ev","hungry"], "רעבה":["re'eva","hungry (f)"],
```

- [ ] **Step 3: Verify categories and pairing**

In the Browser pane, run:

```js
JSON.stringify({
  cat: [CAT["גבוה"], CAT["גבוהה"], CAT["נמוך"], CAT["נמוכה"], CAT["צמא"], CAT["צמאה"], CAT["רעב"], CAT["רעבה"]],
  pair: [genderBaseOf("גבוהה"), genderBaseOf("נמוכה"), genderBaseOf("צמאה"), genderBaseOf("רעבה")]
})
```

Expected: `cat` is `["Describing words","Describing words","Describing words","Describing words","Feelings & health","Feelings & health","Feelings & health","Feelings & health"]`; `pair` is `["גבוה","נמוך","צמא","רעב"]`.

---

## Task 3: Redirect `cardEntry()` through `genderBaseOf()`

**Files:**
- Modify: `hebrew-reader.html:3293-3302` (`cardEntry()`).

**Interfaces:**
- Consumes: `genderBaseOf(word)` from Task 1.
- Produces: `cardEntry(c)` now returns `{key, tr, en, cat, genderPair}` — the new `genderPair` field is `{he, tr}` (the actual feminine spelling/pronunciation as sighted, or `null`). Task 4 consumes `genderPair`.

- [ ] **Step 1: Replace `cardEntry()`**

Find (hebrew-reader.html:3293):

```js
function cardEntry(c) {
  const rawKey = (c.base || c.hebrew || "").replace(WORD_PUNCT, "");
  const singular = singularOf(rawKey);
  const key = singular || rawKey;
  let tr = (c.translit || "").replace(WORD_PUNCT, ""), en = c.english || "", cat = c.cat || CAT[key] || "Uncategorised";
  if (singular && DICT[singular]) { tr = DICT[singular][0]; en = DICT[singular][1]; }
  else if (c.base && DICT[c.base]) { tr = DICT[c.base][0]; en = DICT[c.base][1]; }
  if (c.known === false) { tr = tr.replace(/ \?$/, ""); en = ""; cat = "Uncategorised"; }
  return { key: key, tr: tr, en: en, cat: cat };
}
```

Replace with:

```js
function cardEntry(c) {
  const rawKey = (c.base || c.hebrew || "").replace(WORD_PUNCT, "");
  const singular = singularOf(rawKey);
  const genderBase = !singular ? genderBaseOf(rawKey) : null;
  const key = singular || genderBase || rawKey;
  let tr = (c.translit || "").replace(WORD_PUNCT, ""), en = c.english || "", cat = c.cat || CAT[key] || "Uncategorised";
  /* Captured BEFORE tr gets overwritten below by the masculine's own DICT
     data — this is the actual feminine spelling/pronunciation as sighted,
     which is better than a DICT lookup alone: it's correct even for a word
     like רעב/רעבה that's a real library entry but was never added to DICT. */
  const genderPair = genderBase ? { he: rawKey, tr: tr } : null;
  if (singular && DICT[singular]) { tr = DICT[singular][0]; en = DICT[singular][1]; }
  else if (genderBase && DICT[genderBase]) { tr = DICT[genderBase][0]; en = DICT[genderBase][1]; }
  else if (c.base && DICT[c.base]) { tr = DICT[c.base][0]; en = DICT[c.base][1]; }
  if (c.known === false) { tr = tr.replace(/ \?$/, ""); en = ""; cat = "Uncategorised"; }
  return { key: key, tr: tr, en: en, cat: cat, genderPair: genderPair };
}
```

- [ ] **Step 2: Verify redirect and capture**

In the Browser pane:

```js
JSON.stringify([
  cardEntry({ hebrew: "עייפה", translit: "ayefa", english: "tired (f)" }),
  cardEntry({ hebrew: "עייף", translit: "ayef", english: "tired" }),
  cardEntry({ hebrew: "רעבה", translit: "re'eva", english: "hungry (f)" }),
  cardEntry({ hebrew: "אוכלת", translit: "ochelet", english: "eat(s) (f)" })
])
```

Expected:
- Entry 1 (עייפה): `key: "עייף"`, `tr: "ayef"`, `en: "tired"`, `genderPair: {he:"עייפה", tr:"ayefa"}` — redirected and DICT-backed.
- Entry 2 (עייף): `key: "עייף"`, `genderPair: null` — the masculine form itself carries no `genderPair` from `cardEntry()` (that's what Task 4's `genderPairFor()` backfill is for, at write time).
- Entry 3 (רעבה): `key: "רעב"`, `tr: "ra'ev"`, `en: "hungry"`, `genderPair: {he:"רעבה", tr:"re'eva"}` — redirected using the Task 2 DICT entries.
- Entry 4 (אוכלת): `key: "אוכלת"` (unchanged — excluded pair, no redirect), `genderPair: null`.

---

## Task 4: Thread `genderPair` through every library-write path

**Files:**
- Modify: `hebrew-reader.html:3213-3225` (`libUpsert`), `hebrew-reader.html:3350-3363` (`approvePending`), `hebrew-reader.html:3412-3425` (`approveAllPending`), `hebrew-reader.html:3431-3465` (`libHarvest`), `hebrew-reader.html:3470-3486` (`libAddManual`).

**Interfaces:**
- Consumes: `cardEntry(c).genderPair`, `genderPairFor(heb)` from Task 1/3.
- Produces: library and pending entries now carry `.genderPair` (or `undefined`/`null`). Task 5 (migration) and Task 6 (UI) both read `.genderPair` off library entries.

- [ ] **Step 1: `libUpsert` — accept and backfill `genderPair`**

Find (hebrew-reader.html:3213):

```js
function libUpsert(lib, heb, tr, en, cat, src) {
  const e = lib[heb];
  if (e) {
    e.seen = (e.seen || 0) + 1;
    if (!e.tr && tr) e.tr = tr;
    if (!e.en && en) e.en = en;
    if ((!e.cat || e.cat === "Uncategorised") && cat && cat !== "Uncategorised") e.cat = cat;
    return false;
  }
  lib[heb] = { tr: tr || "", en: en || "", cat: cat || "Uncategorised", opp: "",
               seen: 1, added: todayISO(), src: src || "auto" };
  return true;
}
```

Replace with:

```js
function libUpsert(lib, heb, tr, en, cat, src, genderPair) {
  const e = lib[heb];
  if (e) {
    e.seen = (e.seen || 0) + 1;
    if (!e.tr && tr) e.tr = tr;
    if (!e.en && en) e.en = en;
    if ((!e.cat || e.cat === "Uncategorised") && cat && cat !== "Uncategorised") e.cat = cat;
    if (!e.genderPair) e.genderPair = genderPair || genderPairFor(heb) || null;
    return false;
  }
  lib[heb] = { tr: tr || "", en: en || "", cat: cat || "Uncategorised", opp: "",
               seen: 1, added: todayISO(), src: src || "auto",
               genderPair: genderPair || genderPairFor(heb) || null };
  return true;
}
```

- [ ] **Step 2: `approvePending` and `approveAllPending` — pass `p.genderPair` through**

Find (hebrew-reader.html:3355):

```js
  libUpsert(lib, key, p.tr, p.en, p.cat, "auto");
```

Replace with (this exact line appears twice — inside `approvePending` at 3355 and inside `approveAllPending` at 3417 — change both occurrences):

```js
  libUpsert(lib, key, p.tr, p.en, p.cat, "auto", p.genderPair);
```

- [ ] **Step 3: `libAddManual` — pass `e.genderPair` through**

Find (hebrew-reader.html:3474):

```js
  libUpsert(lib, e.key, e.tr, e.en, e.cat, "manual");
```

Replace with:

```js
  libUpsert(lib, e.key, e.tr, e.en, e.cat, "manual", e.genderPair);
```

- [ ] **Step 4: `libHarvest` — the two branches that bypass `libUpsert`**

Find (hebrew-reader.html:3448):

```js
    if (lib[e.key]) {
      lib[e.key].seen = (lib[e.key].seen || 0) + 1;
      if (!lib[e.key].tr && e.tr) lib[e.key].tr = e.tr;
      if (!lib[e.key].en && e.en) lib[e.key].en = e.en;
      bumped++;
    } else if (pending[e.key]) {
      pending[e.key].seen = (pending[e.key].seen || 0) + 1;
    } else {
      pending[e.key] = { tr: e.tr || "", en: e.en || "", cat: e.cat || "Uncategorised", seen: 1, added: todayISO() };
      flagged++;
    }
```

Replace with:

```js
    if (lib[e.key]) {
      lib[e.key].seen = (lib[e.key].seen || 0) + 1;
      if (!lib[e.key].tr && e.tr) lib[e.key].tr = e.tr;
      if (!lib[e.key].en && e.en) lib[e.key].en = e.en;
      if (!lib[e.key].genderPair) lib[e.key].genderPair = e.genderPair || genderPairFor(e.key) || null;
      bumped++;
    } else if (pending[e.key]) {
      pending[e.key].seen = (pending[e.key].seen || 0) + 1;
      if (!pending[e.key].genderPair) pending[e.key].genderPair = e.genderPair || null;
    } else {
      pending[e.key] = { tr: e.tr || "", en: e.en || "", cat: e.cat || "Uncategorised", seen: 1, added: todayISO(),
                          genderPair: e.genderPair || null };
      flagged++;
    }
```

- [ ] **Step 5: Verify the full write path**

In the Browser pane, stage a clean scenario and drive it through `libHarvest` exactly like a real message would:

```js
const lib = libAll();
delete lib["עייף"]; delete lib["עייפה"];
libSave(lib);
const pending = pendingAll();
delete pending["עייף"]; delete pending["עייפה"];
pendingSave(pending);

// first sighting: masculine, from a message
libHarvest([[{ hebrew: "עייף", translit: "ayef", english: "tired" }]]);
const afterMasc = libAll()["עייף"];

// second sighting: feminine, from a later message
libHarvest([[{ hebrew: "עייפה", translit: "ayefa", english: "tired (f)" }]]);
const afterFem = libAll();

JSON.stringify({
  afterMasc: { seen: afterMasc.seen, genderPair: afterMasc.genderPair },
  femCreatedNoRow: !afterFem["עייפה"],
  mascBumped: afterFem["עייף"].seen,
  genderPair: afterFem["עייף"].genderPair
})
```

Expected: `afterMasc.genderPair` is `{he:"עייפה", tr:"ayefa"}` (backfilled from DICT by `libUpsert`'s create branch via `genderPairFor`, even before the feminine form was ever actually harvested). `femCreatedNoRow` is `true` — no separate `"עייפה"` key exists anywhere in the library. `mascBumped` is `2` (both sightings landed on the same row). `genderPair` is still `{he:"עייפה", tr:"ayefa"}`.

---

## Task 5: `syncGender()` one-time migration

**Files:**
- Modify: `hebrew-reader.html` — insert immediately after the `syncOpposites()` IIFE closes (after line 5761), before the `/* =====================  LEARN PAGE  =====================` comment (line 5763).

**Interfaces:**
- Consumes: `GENDER_PAIRS`, `genderPairFor()` (Task 1), `libAll`/`libSave`/`pendingAll`/`pendingSave`/`focusAll`/`focusSave`/`aliasAll`/`aliasSave` (all pre-existing).
- Produces: nothing new consumed by later tasks — this is a terminal boot-time side effect, gated on `hvr_genderfix_v1`.

- [ ] **Step 1: Insert the migration**

```js
/* One-time migration: George's library already has real duplicate rows for
   masculine/feminine pairs approved separately before this feature existed
   (e.g. separate גדול and גדולה rows) — same family as syncCategories/
   syncOpposites/syncPunctuation above. Also folds matching Pending items
   together (mirrors syncPunctuation's Pending-side handling: a feminine
   sighting whose masculine base is already a real library word gets folded
   in rather than asked about separately), and backfills .genderPair from
   DICT for masculine entries that were always filed correctly but never
   recorded their feminine partner (SEED/CORE_WORDS-sourced words, mostly). */
(function syncGender() {
  try {
    if (localStorage.getItem("hvr_genderfix_v1")) return;
    const lib = libAll(), pending = pendingAll(), focus = focusAll(), aliases = aliasAll();
    let libChanged = false, pendingChanged = false, focusChanged = false, aliasChanged = false;

    function repoint(oldKey, newKey) {
      Object.keys(lib).forEach(k => { if (lib[k].opp === oldKey) { lib[k].opp = newKey; libChanged = true; } });
      if (focus[oldKey]) { delete focus[oldKey]; focus[newKey] = 1; focusChanged = true; }
      Object.keys(aliases).forEach(s => { if (aliases[s] === oldKey) { aliases[s] = newKey; aliasChanged = true; } });
    }

    Object.keys(GENDER_PAIRS).forEach(femKey => {
      const mascKey = GENDER_PAIRS[femKey];

      // both sides already separate library rows: merge into the masculine one
      if (lib[femKey]) {
        const fem = lib[femKey];
        if (lib[mascKey]) {
          lib[mascKey].seen = (lib[mascKey].seen || 0) + (fem.seen || 0);
          if (!lib[mascKey].tr && fem.tr) lib[mascKey].tr = fem.tr;
          if (!lib[mascKey].en && fem.en) lib[mascKey].en = fem.en;
        } else {
          lib[mascKey] = fem;   // masculine never separately approved — promote the row under its key
        }
        if (!lib[mascKey].genderPair) lib[mascKey].genderPair = { he: femKey, tr: fem.tr || "" };
        repoint(femKey, mascKey);
        delete lib[femKey];
        libChanged = true;
      }

      // a feminine Pending item whose masculine base is already a real library
      // word: fold it into the library row instead of asking about it separately
      if (pending[femKey] && lib[mascKey]) {
        lib[mascKey].seen = (lib[mascKey].seen || 0) + (pending[femKey].seen || 0);
        if (!lib[mascKey].genderPair) lib[mascKey].genderPair = { he: femKey, tr: pending[femKey].tr || "" };
        delete pending[femKey];
        libChanged = true; pendingChanged = true;
      // both sides still pending: merge into the masculine pending item
      } else if (pending[femKey] && pending[mascKey]) {
        pending[mascKey].seen = (pending[mascKey].seen || 0) + (pending[femKey].seen || 0);
        pending[mascKey].genderPair = { he: femKey, tr: pending[femKey].tr || "" };
        delete pending[femKey];
        pendingChanged = true;
      }
    });

    // backfill .genderPair for masculine entries that never recorded a
    // feminine sighting directly
    Object.keys(lib).forEach(k => {
      if (!lib[k].genderPair) {
        const gp = genderPairFor(k);
        if (gp) { lib[k].genderPair = gp; libChanged = true; }
      }
    });

    if (libChanged) libSave(lib);
    if (pendingChanged) pendingSave(pending);
    if (focusChanged) focusSave(focus);
    if (aliasChanged) aliasSave(aliases);
    localStorage.setItem("hvr_genderfix_v1", "1");
  } catch (e) {}
})();
```

- [ ] **Step 2: Verify against a fixture matching George's real screenshot**

This tool's Browser pane does not perform a genuine page reload (a known limitation of this environment — see the design doc's history), so `hvr_genderfix_v1`-gated code cannot be verified by "reload and check". Instead, copy the migration's logic into a fixture run directly, matching how earlier one-time migrations in this file were verified:

```js
// stage a realistic dirty state, matching George's actual screenshot
localStorage.removeItem("hvr_genderfix_v1");
const lib = libAll();
lib["גדול"] = { tr: "gadol", en: "big", cat: "Describing words", opp: "קטן", seen: 5, added: "2026-07-22", src: "seed" };
lib["גדולה"] = { tr: "gdola", en: "big (f)", cat: "Describing words", opp: "", seen: 2, added: "2026-08-16", src: "auto" };
lib["עייף"] = { tr: "ayef", en: "tired", cat: "Feelings & health", opp: "", seen: 3, added: "2026-07-22", src: "seed" };
libSave(lib);
const pending = pendingAll();
pending["רעבה"] = { tr: "re'eva", en: "hungry (f)", cat: "Feelings & health", seen: 1, added: "2026-08-16" };
pending["רעב"] = { tr: "ra'ev", en: "hungry", cat: "Feelings & health", seen: 1, added: "2026-08-16" };
pendingSave(pending);

// run the migration's own IIFE body directly (re-declaring it inline, not
// calling syncGender() again — it's already run once at load and is gated)
(function testSyncGender() {
  const lib = libAll(), pending = pendingAll(), focus = focusAll(), aliases = aliasAll();
  function repoint(oldKey, newKey) {
    Object.keys(lib).forEach(k => { if (lib[k].opp === oldKey) lib[k].opp = newKey; });
    if (focus[oldKey]) { delete focus[oldKey]; focus[newKey] = 1; }
    Object.keys(aliases).forEach(s => { if (aliases[s] === oldKey) aliases[s] = newKey; });
  }
  Object.keys(GENDER_PAIRS).forEach(femKey => {
    const mascKey = GENDER_PAIRS[femKey];
    if (lib[femKey]) {
      const fem = lib[femKey];
      if (lib[mascKey]) {
        lib[mascKey].seen = (lib[mascKey].seen || 0) + (fem.seen || 0);
        if (!lib[mascKey].tr && fem.tr) lib[mascKey].tr = fem.tr;
        if (!lib[mascKey].en && fem.en) lib[mascKey].en = fem.en;
      } else { lib[mascKey] = fem; }
      if (!lib[mascKey].genderPair) lib[mascKey].genderPair = { he: femKey, tr: fem.tr || "" };
      repoint(femKey, mascKey);
      delete lib[femKey];
    }
    if (pending[femKey] && lib[mascKey]) {
      lib[mascKey].seen = (lib[mascKey].seen || 0) + (pending[femKey].seen || 0);
      if (!lib[mascKey].genderPair) lib[mascKey].genderPair = { he: femKey, tr: pending[femKey].tr || "" };
      delete pending[femKey];
    } else if (pending[femKey] && pending[mascKey]) {
      pending[mascKey].seen = (pending[mascKey].seen || 0) + (pending[femKey].seen || 0);
      pending[mascKey].genderPair = { he: femKey, tr: pending[femKey].tr || "" };
      delete pending[femKey];
    }
  });
  Object.keys(lib).forEach(k => {
    if (!lib[k].genderPair) {
      const gp = genderPairFor(k);
      if (gp) lib[k].genderPair = gp;
    }
  });
  libSave(lib); pendingSave(pending); focusSave(focus); aliasSave(aliases);
})();

const result = libAll();
const resultPending = pendingAll();
JSON.stringify({
  gadolMerged: { seen: result["גדול"].seen, genderPair: result["גדול"].genderPair, femRowGone: !result["גדולה"] },
  ayefBackfilled: result["עייף"].genderPair,
  pendingFolded: { ra'evSeen: resultPending["רעב"] ? resultPending["רעב"].seen : "MISSING", femPendingGone: !resultPending["רעבה"] }
})
```

Expected: `gadolMerged` — `seen: 7` (5+2), `genderPair: {he:"גדולה", tr:"gdola"}`, `femRowGone: true`. `ayefBackfilled` — `{he:"עייפה", tr:"ayefa"}` (backfilled purely from DICT/Task 2, even though no `"עייפה"` row or pending item existed in this fixture at all). `pendingFolded` — `ra'evSeen: 2` (1+1, merged), `femPendingGone: true`.

- [ ] **Step 3: Verify idempotency**

Run the exact same `testSyncGender` IIFE from Step 2 a second time against the now-clean state, then check nothing changes:

```js
const before = JSON.stringify(libAll());
/* ... re-run the same testSyncGender() IIFE body from Step 2 ... */
const after = JSON.stringify(libAll());
before === after
```

Expected: `true` — running the merge logic again against already-clean data is a no-op (every `lib[femKey]` check is `undefined` since the feminine rows are already gone).

---

## Task 6: Library UI — the M/F toggle

**Files:**
- Modify: `hebrew-reader.html:3889-3902` (`buildWordRow`), `hebrew-reader.html:3939-3950` (`buildOppSideEl`), and the CSS block containing `.grow-row .rowact` (around line 483).

**Interfaces:**
- Consumes: `e.genderPair` (Task 4/5's output on library entries).
- Produces: `genderToggleBtn(container, key, e, trEl, heEl)` — a new shared helper, called from both row builders (the design doc calls out that both builders must carry any per-word feature, or it silently goes missing from the opposites lane — three earlier bugs in this file happened exactly that way).

- [ ] **Step 1: Add the shared toggle helper**

Insert immediately before `function buildWordRow(key, e, focus, srs) {` (hebrew-reader.html:3889):

```js
/* Shown only when the entry has a recorded feminine partner (see
   GENDER_PAIRS / genderPairFor in Task 1). Clicking swaps the row's
   displayed pronunciation and Hebrew in place — masculine first, in memory
   only, resetting to masculine on the next render/reload (the approved
   default). Both row builders below must call this, same as strengthDot()
   and the star: an opposites-lane word must not lose a feature the normal
   grid rows get, which is exactly how the Hebrew column, the focus star,
   and per-word audio each went missing from half the library at some point
   in this file's history. */
function genderToggleBtn(container, key, e, trEl, heEl) {
  if (!e.genderPair) return null;
  const btn = document.createElement("button");
  btn.className = "gtoggle";
  function setState(showFem) {
    if (showFem) {
      trEl.textContent = e.genderPair.tr || ""; heEl.textContent = e.genderPair.he || "";
      btn.textContent = "M";
      btn.title = "Show masculine form (" + (e.tr || "") + " " + key + ")";
      btn.dataset.showing = "f";
    } else {
      trEl.textContent = e.tr || ""; heEl.textContent = key;
      btn.textContent = "F";
      btn.title = "Show feminine form (" + (e.genderPair.tr || "") + " " + (e.genderPair.he || "") + ")";
      btn.dataset.showing = "m";
    }
    if (container) container.title = (trEl.textContent || "") + " — " + (e.en || "") + "  " + heEl.textContent;
  }
  setState(false);
  btn.addEventListener("click", (ev) => { ev.stopPropagation(); setState(btn.dataset.showing !== "f"); });
  return btn;
}

```

- [ ] **Step 2: Wire into `buildWordRow`**

Find (hebrew-reader.html:3889):

```js
function buildWordRow(key, e, focus, srs) {
  const row = document.createElement("div");
  row.className = "grow-row" + (focus[key] ? " gfocus" : "");
  row.title = (e.tr || "") + " — " + (e.en || "") + "  " + key;

  const tr = document.createElement("span"); tr.className = "gtr"; tr.textContent = e.tr || "";
  const en = document.createElement("span"); en.className = "gen"; en.textContent = e.en || "";
  const he = document.createElement("span"); he.className = "ghe"; he.textContent = key;
  row.appendChild(strengthDot(key, srs));
  row.appendChild(tr); row.appendChild(en); row.appendChild(he);
  row.appendChild(rowActions(key, focus));
  wordDragHandlers(row, key);
  return row;
}
```

Replace with:

```js
function buildWordRow(key, e, focus, srs) {
  const row = document.createElement("div");
  row.className = "grow-row" + (focus[key] ? " gfocus" : "");
  row.title = (e.tr || "") + " — " + (e.en || "") + "  " + key;

  const tr = document.createElement("span"); tr.className = "gtr"; tr.textContent = e.tr || "";
  const en = document.createElement("span"); en.className = "gen"; en.textContent = e.en || "";
  const he = document.createElement("span"); he.className = "ghe"; he.textContent = key;
  row.appendChild(strengthDot(key, srs));
  row.appendChild(tr); row.appendChild(en); row.appendChild(he);
  const gtoggle = genderToggleBtn(row, key, e, tr, he);
  if (gtoggle) row.appendChild(gtoggle);
  row.appendChild(rowActions(key, focus));
  wordDragHandlers(row, key);
  return row;
}
```

- [ ] **Step 3: Wire into `buildOppSideEl`**

Find (hebrew-reader.html:3939):

```js
function buildOppSideEl(key, e, focus, srs) {
  const side = document.createElement("span");
  side.className = "gside" + (focus[key] ? " gfocus" : "");
  const tr = document.createElement("span"); tr.className = "gtr"; tr.textContent = e.tr || "";
  const en = document.createElement("span"); en.className = "gen"; en.textContent = e.en || "";
  const he = document.createElement("span"); he.className = "ghe"; he.textContent = key;
  side.appendChild(strengthDot(key, srs));
  side.appendChild(tr); side.appendChild(en); side.appendChild(he);
  side.appendChild(libAudioButton(key, "sideaudio"));
  side.appendChild(focusStar(key, focus, "sidestar"));
  return side;
}
```

Replace with:

```js
function buildOppSideEl(key, e, focus, srs) {
  const side = document.createElement("span");
  side.className = "gside" + (focus[key] ? " gfocus" : "");
  const tr = document.createElement("span"); tr.className = "gtr"; tr.textContent = e.tr || "";
  const en = document.createElement("span"); en.className = "gen"; en.textContent = e.en || "";
  const he = document.createElement("span"); he.className = "ghe"; he.textContent = key;
  side.appendChild(strengthDot(key, srs));
  side.appendChild(tr); side.appendChild(en); side.appendChild(he);
  const gtoggle = genderToggleBtn(null, key, e, tr, he);
  if (gtoggle) side.appendChild(gtoggle);
  side.appendChild(libAudioButton(key, "sideaudio"));
  side.appendChild(focusStar(key, focus, "sidestar"));
  return side;
}
```

- [ ] **Step 4: Add CSS for `.gtoggle`**

Find (around line 483):

```css
  .grow-row .rowact { flex: 0 0 auto; margin-left: auto; display: none; gap: 2px; }
```

Insert immediately before it:

```css
  .grow-row .gtoggle, .gside .gtoggle {
    flex: 0 0 auto; border: 1px solid var(--muted); background: none; border-radius: 3px;
    font-size: 9px; line-height: 1; padding: 1px 3px; margin: 0 2px; cursor: pointer;
    color: var(--muted);
  }
  .grow-row .gtoggle:hover, .gside .gtoggle:hover { color: var(--accent); border-color: var(--accent); }
```

- [ ] **Step 5: Verify rendering and click behaviour in the Browser pane**

Stage a fixture entry and render it directly (bypassing the need for a real message/harvest):

```js
const lib = libAll();
lib["גדול"] = { tr: "gadol", en: "big", cat: "Describing words", opp: "", seen: 1, added: "2026-08-16",
                genderPair: { he: "גדולה", tr: "gdola" } };
lib["קטן"] = { tr: "katan", en: "small", cat: "Describing words", opp: "", seen: 1, added: "2026-08-16" };
libSave(lib);
setView("library");
renderLibrary();
"rendered"
```

Then take a screenshot (`mcp__Claude_Browser__computer` with `action: "screenshot"`) of the Describing words lane and confirm: the גדול row shows a small "F" pill and the קטן row shows none (it has no `genderPair`).

Click the "F" pill (`mcp__Claude_Browser__computer` with `action: "left_click"` at its coordinates), then read the row's text via `mcp__Claude_Browser__get_page_text` or:

```js
JSON.stringify({
  tr: document.querySelector('.grow-row .gtr').textContent,
  he: document.querySelector('.grow-row .ghe').textContent
})
```

Expected before click: `tr: "gadol"`, `he: "גדול"`. Expected after click: `tr: "gdola"`, `he: "גדולה"`. Click again and confirm it reverts to `"gadol"`/`"גדול"`.

---

## Task 7: End-to-end walkthrough against George's real screenshot scenario

**Files:** none (verification only).

**Interfaces:** none — this task exercises everything from Tasks 1–6 together.

- [ ] **Step 1: Reproduce the reported bug, pre-fix, then confirm it's gone**

In the Browser pane, with the fixed file loaded, stage the exact Pending state visible in George's screenshot (masculine already in the library, feminine sitting in Pending) and drive one more harvest of the feminine form through the real path, exactly as a second voice note would:

```js
const lib = libAll();
lib["נחמד"] = { tr: "nechmad", en: "nice", cat: "Describing words", opp: "", seen: 4, added: "2026-07-22", src: "seed" };
lib["טוב"] = { tr: "tov", en: "good", cat: "Describing words", opp: "", seen: 6, added: "2026-07-22", src: "seed" };
libSave(lib);
const pending = pendingAll();
delete pending["נחמדה"]; delete pending["טובה"];
pendingSave(pending);

// simulate what libHarvest() sees for a message containing "נחמדה" and "טובה"
const res = libHarvest([[
  { hebrew: "נחמדה", translit: "nechmada", english: "nice (f)" },
  { hebrew: "טובה", translit: "tova", english: "good (f)" }
]]);

JSON.stringify({
  harvestResult: res,                 // expect bumped: 2, flagged: 0
  noNewPendingItems: !pendingAll()["נחמדה"] && !pendingAll()["טובה"],
  nechmadGenderPair: libAll()["נחמד"].genderPair,
  tovGenderPair: libAll()["טוב"].genderPair
})
```

Expected: `harvestResult` is `{flagged: 0, bumped: 2}` — neither word created a new Pending item, both silently bumped their existing masculine row. `noNewPendingItems` is `true`. `nechmadGenderPair` is `{he:"נחמדה", tr:"nechmada"}`. `tovGenderPair` is `{he:"טובה", tr:"tova"}`.

- [ ] **Step 2: Confirm the excluded pairs still behave as two ordinary rows**

```js
const lib = libAll();
delete lib["ישן"]; delete lib["ישנה"]; delete lib["אוכל"]; delete lib["אוכלת"];
libSave(lib);
const pending = pendingAll();
delete pending["ישנה"]; delete pending["אוכלת"];
pendingSave(pending);

libHarvest([[{ hebrew: "ישן", translit: "yashen", english: "sleep(s) / old (thing)" }]]);
libHarvest([[{ hebrew: "ישנה", translit: "yeshana", english: "old (f)" }]]);

JSON.stringify({
  bothRowsExist: !!libAll()["ישן"] || !!pendingAll()["ישן"],
  femStillSeparate: !!pendingAll()["ישנה"]
})
```

Expected: `femStillSeparate` is `true` — ישנה is still its own Pending item, exactly as before this change, because ישן/ישנה is on the exclusion list (homograph risk). This confirms the exclusion list from the Global Constraints actually holds at runtime, not just in the data.

- [ ] **Step 3: Full visual pass**

Take a screenshot of the whole Library page (`mcp__Claude_Browser__computer`, `action: "screenshot"`) with a realistic mixed fixture (several `.genderPair` rows, several without, one opposites pair where one side has a `.genderPair`), confirm:
- No row shows two entries for what should be one word.
- The "F"/"M" pill appears only on rows with a recorded partner.
- An opposites-pair row (`buildOppSideEl`) with a `.genderPair` on one side shows the pill correctly positioned next to that side only, not the other.
- Toggling one row's pill doesn't affect any other row.

Report any visual issue found before considering this task complete.

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1), DICT gaps for real pending words (Task 2), harvest/⊕/pad-approval redirect (Tasks 3–4), migration for existing duplicates including Pending-side folding (Task 5), UI toggle on both row builders (Task 6), and a full reproduction of the reported bug plus the exclusion list (Task 7) — all design doc sections are covered. `padIngest()` is deliberately left untouched, matching the design's precedent that it never called `singularOf()` either (see Global Constraints — not a new gap, parity with existing plural behaviour).
- **Placeholder scan:** no TBD/TODO; every step has complete code or a fully specified verification snippet with exact expected output.
- **Type consistency:** `genderPair` is `{he, tr}` everywhere it appears (Tasks 1, 3, 4, 5, 6) — checked for drift across all five tasks. `genderToggleBtn(container, key, e, trEl, heEl)` signature matches both call sites in Task 6 exactly (`buildOppSideEl` passes `null` for `container`, which the function's own `if (container)` guard already handles).

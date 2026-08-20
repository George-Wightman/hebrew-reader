# Word Forms — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sentence pad understand inflected Hebrew — resolve any generated form you type, say what form it is, and flag agreement slips against both your sentence's own pronouns and the lens.

**Architecture:** One new index (`FORM_INDEX`: Hebrew form → `{lemma, tag, pos}`) built beside `TR_INDEX` from the same library banks. Agreement checking is a pure function over the pad's existing token array plus the two settings; the pad renders its output. No new store.

**Tech Stack:** Vanilla ES6, the `?selftest=1` harness.

## Global Constraints

- **Single file**, no dependencies. "Commit" means a timestamped backup.
- **Verified forms only** enter the index. An `uncertain` form could be a wrong spelling, and
  resolving what George types onto a wrong Hebrew word is worse than not resolving it —
  the same contract the lens follows.
- **Never rewrite what he typed.** Flags are advisory: a mark, a tooltip, and an explicit
  click to apply. Both rules below can misfire, so nothing is automatic.
- **`את` is not always "you (f)"** — it is also the object marker, which is exactly why the
  Phase-1 spec excluded it from `GENDER_PAIRS`. Treat it as a pronoun only when the next
  content word is something that agrees.
- **The index rebuild is already wired.** `rebuildTrIndex()` is called after every library
  change; adding `FORM_INDEX` to it means no new invalidation paths.
- Feature values, exact: `person` `"1"|"2"|"3"|null`, `gender` `"m"|"f"|null`,
  `number` `"s"|"p"|null`, `tense` `"pres"|"past"|"fut"|"imp"|"inf"|null`.

---

## Task 1: The form index

**Files:** `hebrew-reader.html` — WORD FORMS section, `buildTrIndex`, `rebuildTrIndex`.

**Interfaces:**
- Produces: `FORM_INDEX` (object), `buildFormIndex(lib)` → `{he: {lemma, tag, pos}}`,
  `formInfo(he)` → that record or `null`.
- Modifies: `buildTrIndex()` also indexes verified form spellings; `rebuildTrIndex()` also
  rebuilds `FORM_INDEX`.

- [ ] **Step 1: Write the failing tests**

```js
/* ---- Phase 3 Task 1: the form index ---- */
const P3_LIB = {
  "ללכת": { tr: "lalechet", en: "to go", pos: "verb",
    forms: { inf: F("ללכת","lalechet"), "pres.ms": F("הולך","holech"),
             "pres.fs": F("הולכת","holechet"), "past.2fs": F("הלכת","halacht"),
             "fut.2ms": F("תלך","telech") },
    formsMeta: { state: { inf:"verified", "pres.ms":"verified", "pres.fs":"verified",
                          "past.2fs":"verified", "fut.2ms":"uncertain" } } },
  "גדול": { tr: "gadol", en: "big", pos: "adj",
    forms: { ms: F("גדול","gadol"), fs: F("גדולה","gedola") },
    formsMeta: { state: { ms:"verified", fs:"verified" } } }
};
T("buildFormIndex: maps each verified form back to its lemma and tag", () => {
  const idx = buildFormIndex(P3_LIB);
  assertEq(idx["הולכת"], { lemma: "ללכת", tag: "pres.fs", pos: "verb" });
  assertEq(idx["גדולה"], { lemma: "גדול", tag: "fs", pos: "adj" });
});
T("buildFormIndex: excludes unverified forms — a wrong spelling must not resolve", () => {
  const idx = buildFormIndex(P3_LIB);
  assertTrue(!idx["תלך"], "fut.2ms is uncertain and must be absent");
});
T("buildFormIndex: a form identical to its lemma still maps", () => {
  assertEq(buildFormIndex(P3_LIB)["ללכת"].tag, "inf");
});
T("buildFormIndex: survives entries with no bank", () => {
  assertEq(buildFormIndex({ "שלום": { tr: "shalom" } }), {});
  assertEq(buildFormIndex(null), {});
});
```

- [ ] **Step 2: Run and verify they fail.**

- [ ] **Step 3: Implement**

```js
/* Hebrew form -> which word it belongs to and which form it is. This is what
   lets the pad say "that's the feminine singular present of ללכת" instead of
   just drawing a word, and it is the whole basis of agreement checking.

   VERIFIED only, same contract as the lens: an unsettled form may simply be a
   wrong spelling, and resolving what George types onto a wrong Hebrew word is
   worse than leaving it unresolved. */
let FORM_INDEX = {};
function buildFormIndex(lib) {
  const idx = {};
  Object.keys(lib || {}).forEach(lemma => {
    const e = lib[lemma];
    if (!e || !e.forms) return;
    const st = (e.formsMeta && e.formsMeta.state) || {};
    Object.keys(e.forms).forEach(tag => {
      const f = e.forms[tag];
      if (!f || !f.he || st[tag] !== "verified") return;
      /* First writer wins: if two words share a spelling, the earlier entry keeps
         it rather than being silently replaced. Genuine homographs are a real
         thing in Hebrew and neither answer is better, so stability beats
         whichever happened to be iterated last. */
      if (!idx[f.he]) idx[f.he] = { lemma: lemma, tag: tag, pos: e.pos || null };
    });
  });
  return idx;
}
function formInfo(he) { return FORM_INDEX[he] || null; }
```

- [ ] **Step 4: Index form spellings in `buildTrIndex`**

Inside `buildTrIndex`, after the existing library loop:

```js
  /* Every verified form's pronunciation resolves too, so typing "holechet" finds
     הולכת instead of failing. This is the single biggest thing the banks buy the
     pad, and it costs nothing beyond a bigger index. */
  Object.keys(lib).forEach(lemma => {
    const e = lib[lemma];
    if (!e || !e.forms) return;
    const st = (e.formsMeta && e.formsMeta.state) || {};
    Object.keys(e.forms).forEach(tag => {
      const f = e.forms[tag];
      if (!f || !f.he || !f.tr || st[tag] !== "verified") return;
      add(f.tr, f.he);
    });
  });
```

- [ ] **Step 5: Rebuild it alongside the others**

```js
function rebuildTrIndex() {
  TR_INDEX = buildTrIndex();
  SKEL_INDEX = buildSkelIndex();
  FORM_INDEX = buildFormIndex(libAll());
}
```

- [ ] **Step 6: Run tests, then verify live** — with a real generated verb in the library,
  type its feminine present into the pad and confirm the Hebrew line resolves it.

- [ ] **Step 7: Back up.**

---

## Task 2: Feature parsing and the pronoun table

**Files:** `hebrew-reader.html` — WORD FORMS section; SELF TESTS.

**Interfaces:**
- Produces: `tagFeatures(tag)` → `{tense, person, gender, number}`;
  `PRONOUN_FEATURES` (object, Hebrew → features); `pronounFeatures(he)`.

- [ ] **Step 1: Write the failing tests**

```js
/* ---- Phase 3 Task 2: features ---- */
T("tagFeatures: a tensed personal form", () => {
  assertEq(tagFeatures("past.2fs"), { tense:"past", person:"2", gender:"f", number:"s" });
  assertEq(tagFeatures("fut.1p"),   { tense:"fut",  person:"1", gender:null, number:"p" });
});
T("tagFeatures: a participle marks gender and number but not person", () => {
  assertEq(tagFeatures("pres.ms"), { tense:"pres", person:null, gender:"m", number:"s" });
  assertEq(tagFeatures("pres.fp"), { tense:"pres", person:null, gender:"f", number:"p" });
});
T("tagFeatures: a bare agreement tag has no tense", () => {
  assertEq(tagFeatures("fs"), { tense:null, person:null, gender:"f", number:"s" });
  assertEq(tagFeatures("mp"), { tense:null, person:null, gender:"m", number:"p" });
});
T("tagFeatures: a bare person tag is a preposition's", () => {
  assertEq(tagFeatures("2fs"), { tense:null, person:"2", gender:"f", number:"s" });
});
T("tagFeatures: infinitive and number tags carry nothing to agree with", () => {
  assertEq(tagFeatures("inf"), { tense:"inf", person:null, gender:null, number:null });
  assertEq(tagFeatures("sg"),  { tense:null, person:null, gender:null, number:"s" });
  assertEq(tagFeatures("pl"),  { tense:null, person:null, gender:null, number:"p" });
});
T("tagFeatures: junk is safe", () => {
  assertEq(tagFeatures(""),    { tense:null, person:null, gender:null, number:null });
  assertEq(tagFeatures(null),  { tense:null, person:null, gender:null, number:null });
});
T("pronounFeatures: knows the personal pronouns", () => {
  assertEq(pronounFeatures("אני"),   { person:"1", gender:null, number:"s" });
  assertEq(pronounFeatures("אתה"),   { person:"2", gender:"m",  number:"s" });
  assertEq(pronounFeatures("את"),    { person:"2", gender:"f",  number:"s" });
  assertEq(pronounFeatures("היא"),   { person:"3", gender:"f",  number:"s" });
  assertEq(pronounFeatures("אנחנו"), { person:"1", gender:null, number:"p" });
  assertEq(pronounFeatures("הן"),    { person:"3", gender:"f",  number:"p" });
});
T("pronounFeatures: anything else is not a pronoun", () => {
  assertNull(pronounFeatures("ספר"));
  assertNull(pronounFeatures(""));
});
```

- [ ] **Step 2: Run and verify they fail.**

- [ ] **Step 3: Implement**

```js
/* Split a form tag into the features that have to agree. The tag grammar is
   [tense.]person+gender+number, so this is deliberately mechanical — the tags
   are generated from FORM_TAGS and nothing else should be inventing them. */
function tagFeatures(tag) {
  const out = { tense: null, person: null, gender: null, number: null };
  const s = String(tag || "");
  if (!s) return out;
  const dot = s.indexOf(".");
  let rest = s;
  if (dot > -1) { out.tense = s.slice(0, dot); rest = s.slice(dot + 1); }
  else if (s === "inf") { out.tense = "inf"; return out; }
  if (rest === "sg") { out.number = "s"; return out; }
  if (rest === "pl") { out.number = "p"; return out; }
  const m = rest.match(/^([123])?([mf])?([sp])$/);
  if (!m) return out;
  out.person = m[1] || null;
  out.gender = m[2] || null;
  out.number = m[3];
  return out;
}

/* The personal pronouns, which is how a sentence states its own subject. Note
   what is NOT here: אתם/אתן are, but the object marker sense of את is handled at
   the call site — see padAgreementIssues. */
const PRONOUN_FEATURES = {
  "אני":   { person: "1", gender: null, number: "s" },
  "אתה":   { person: "2", gender: "m",  number: "s" },
  "את":    { person: "2", gender: "f",  number: "s" },
  "הוא":   { person: "3", gender: "m",  number: "s" },
  "היא":   { person: "3", gender: "f",  number: "s" },
  "אנחנו": { person: "1", gender: null, number: "p" },
  "אתם":   { person: "2", gender: "m",  number: "p" },
  "אתן":   { person: "2", gender: "f",  number: "p" },
  "הם":    { person: "3", gender: "m",  number: "p" },
  "הן":    { person: "3", gender: "f",  number: "p" }
};
function pronounFeatures(he) { return PRONOUN_FEATURES[String(he || "")] || null; }
```

- [ ] **Step 4: Run tests. Back up.**

---

## Task 3: Agreement checking

**Files:** `hebrew-reader.html` — WORD FORMS section; SELF TESTS.

**Interfaces:**
- Consumes: `formInfo` (T1), `tagFeatures`/`pronounFeatures` (T2), `lensGet`/`speakerGet`.
- Produces: `padAgreementIssues(words, opts)` → `[{i, he, want, got, suggest, why}]`.
  `words` is an array of `{i, he}` — the resolved Hebrew per token, in order, whitespace
  already removed. `opts` is `{lens, speaker, lib}`.

Two rules, both advisory:

- **Subject agreement.** A word that agrees (participle or adjective) must match the nearest
  preceding pronoun, within 3 content words. `אני` additionally takes its gender from the
  speaker setting, since "I" does not state one.
- **Lens agreement.** With a lens set, any 2nd-person form — pronoun or verb — should match
  the addressee.

- [ ] **Step 1: Write the failing tests**

```js
/* ---- Phase 3 Task 3: agreement ---- */
const P3_OPTS = { lens: "", speaker: "m", lib: P3_LIB };
const W = (...hs) => hs.map((he, i) => ({ i: i, he: he }));

T("agreement: a pronoun and a matching participle is silent", () => {
  assertEq(padAgreementIssues(W("היא","הולכת"), P3_OPTS), []);
});
T("agreement: at + masculine participle is flagged, with the fix", () => {
  const r = padAgreementIssues(W("את","הולך"), P3_OPTS);
  assertEq(r.length, 1);
  assertEq(r[0].i, 1);
  assertEq(r[0].suggest, "הולכת");
  assertTrue(/את/.test(r[0].why), "the reason names the pronoun it disagreed with");
});
T("agreement: ani takes its gender from the speaker setting", () => {
  assertEq(padAgreementIssues(W("אני","הולך"), { lens:"", speaker:"m", lib:P3_LIB }), []);
  const r = padAgreementIssues(W("אני","הולך"), { lens:"", speaker:"f", lib:P3_LIB });
  assertEq(r.length, 1);
  assertEq(r[0].suggest, "הולכת");
});
T("agreement: את before a noun is the object marker, not a pronoun", () => {
  /* the classic trap — "I read THE BOOK", not "you-f ... " */
  assertEq(padAgreementIssues(W("את","גדול"), { lens:"", speaker:"m",
    lib: { "גדול": P3_LIB["גדול"] } }).length, 1, "adjective still agrees");
  assertEq(padAgreementIssues(W("את","ספר"), P3_OPTS), [],
    "an unrecognised next word means no claim is made");
});
T("agreement: the lens flags a 2nd-person form aimed at the wrong person", () => {
  const r = padAgreementIssues(W("אתה"), { lens:"f", speaker:"m", lib:P3_LIB });
  assertEq(r.length, 1);
  assertEq(r[0].suggest, "את");
});
T("agreement: no lens means no lens-based complaint", () => {
  assertEq(padAgreementIssues(W("אתה"), { lens:"", speaker:"m", lib:P3_LIB }), []);
});
T("agreement: a 3rd-person subject is never judged against the lens", () => {
  assertEq(padAgreementIssues(W("היא","הולכת"), { lens:"m", speaker:"m", lib:P3_LIB }), []);
});
T("agreement: a distant pronoun is not treated as the subject", () => {
  assertEq(padAgreementIssues(W("היא","ספר","ספר","ספר","הולך"), P3_OPTS), [],
    "four words later is a different clause as far as this can tell");
});
T("agreement: no suggestion is offered when the bank lacks the right form", () => {
  const lib = { "גדול": { pos:"adj", tr:"gadol",
    forms: { ms: F("גדול","gadol") }, formsMeta: { state: { ms:"verified" } } } };
  const r = padAgreementIssues(W("היא","גדול"), { lens:"", speaker:"m", lib: lib });
  assertEq(r.length, 1);
  assertNull(r[0].suggest);
});
T("agreement: unknown words are simply skipped", () => {
  assertEq(padAgreementIssues(W("בלה","בלה"), P3_OPTS), []);
  assertEq(padAgreementIssues([], P3_OPTS), []);
});
```

- [ ] **Step 2: Run and verify they fail.**

- [ ] **Step 3: Implement**

```js
/* How far back a subject pronoun can be and still plausibly govern the word.
   Hebrew clauses are short; beyond this it is more likely a new clause, and a
   confident wrong flag is worse than a missed one. */
const AGREE_LOOKBACK = 3;

/* Find the form of `lemma` matching the wanted features, to offer as a fix. */
function suggestForm(lib, lemma, tag, want) {
  const e = lib && lib[lemma];
  if (!e || !e.forms) return null;
  const base = tagFeatures(tag);
  const st = (e.formsMeta && e.formsMeta.state) || {};
  const hit = Object.keys(e.forms).find(t => {
    if (st[t] !== "verified") return null;
    const f = tagFeatures(t);
    return f.tense === base.tense &&
           (want.person === undefined || f.person === want.person) &&
           f.gender === want.gender && f.number === want.number;
  });
  return hit ? e.forms[hit].he : null;
}

/* Advisory only — see the module note. Returns one issue per disagreeing word. */
function padAgreementIssues(words, opts) {
  opts = opts || {};
  const lens = opts.lens || "";
  const speaker = opts.speaker === "f" ? "f" : "m";
  const lib = opts.lib || {};
  const out = [];
  const info = words.map(w => formInfo(w.he));

  words.forEach((w, n) => {
    const pf = pronounFeatures(w.he);

    /* Rule B — the lens. Only 2nd person: a 3rd-person subject is somebody being
       talked ABOUT, and who you're writing to says nothing about them. */
    if (lens) {
      const feats = pf || (info[n] ? tagFeatures(info[n].tag) : null);
      const wantG = lens === "p" ? null : lens;
      if (feats && feats.person === "2" && wantG && feats.gender && feats.gender !== wantG) {
        const want = { person: "2", gender: wantG, number: feats.number };
        out.push({ i: w.i, he: w.he, want: want, got: feats,
          suggest: pf ? pronounFor(want) : suggestForm(lib, info[n].lemma, info[n].tag, want),
          why: "you're writing to " + (lens === "f" ? "a woman" : "a man") +
               ", so this should be the " + (wantG === "f" ? "feminine" : "masculine") + " form" });
        return;
      }
    }

    /* Rule A — the sentence's own subject. Skip pronouns themselves; skip words
       with no gender to agree (infinitives, nouns, adverbs). */
    if (pf || !info[n]) return;
    const feats = tagFeatures(info[n].tag);
    if (!feats.gender || feats.person) return;   // participles/adjectives only
    let subj = null;
    for (let k = n - 1; k >= 0 && n - k <= AGREE_LOOKBACK; k--) {
      const p = pronounFeatures(words[k].he);
      if (!p) continue;
      /* את is also the object marker. Only read it as "you (f)" when the word it
         governs actually agrees — which, at this point in the loop, it does. */
      subj = { p: p, he: words[k].he };
      break;
    }
    if (!subj) return;
    /* "I" states no gender; the speaker setting supplies it. */
    const wantG = subj.p.gender || (subj.p.person === "1" ? speaker : null);
    if (!wantG || wantG === feats.gender) {
      if (!subj.p.number || subj.p.number === feats.number) return;
    }
    const want = { person: null, gender: wantG || feats.gender, number: subj.p.number || feats.number };
    if (want.gender === feats.gender && want.number === feats.number) return;
    out.push({ i: w.i, he: w.he, want: want, got: feats,
      suggest: suggestForm(lib, info[n].lemma, info[n].tag, want),
      why: "“" + subj.he + "” is " +
           (want.gender === "f" ? "feminine" : "masculine") +
           (want.number === "p" ? " plural" : "") + ", so this should agree" });
  });
  return out;
}

/* Reverse of PRONOUN_FEATURES, for suggesting the right pronoun. */
function pronounFor(want) {
  return Object.keys(PRONOUN_FEATURES).find(he => {
    const f = PRONOUN_FEATURES[he];
    return f.person === want.person && f.gender === want.gender && f.number === want.number;
  }) || null;
}
```

- [ ] **Step 4: Run tests until green.** Expect to iterate — this is the one piece with real
  logic in it, and the tests encode the intended behaviour precisely.

- [ ] **Step 5: Back up.**

---

## Task 4: Show it in the pad

**Files:** `hebrew-reader.html` — `renderPad`, pad CSS, pad click handler.

- [ ] **Step 1: CSS**

```css
  /* Advisory, not an error: a dotted underline in the warn colour, never a red
     block. He may well have meant it. */
  .padword.padwarn { text-decoration: underline dotted var(--warn); text-underline-offset: 3px;
                     cursor: pointer; }
  .padword.padwarn::after { content: "△"; font-size: 9px; color: var(--warn);
                            vertical-align: super; margin-right: 1px; }
  .padagree { color: var(--warn); font-size: 12px; margin-left: 8px; }
```

- [ ] **Step 2: Compute and apply in `renderPad`**

After the token loop builds its elements, before the count is written:

```js
  /* Agreement is checked on what the pad RESOLVED, not on what was typed — the
     Hebrew is where the grammar lives. Uses the same picked candidate the line
     is showing, so the advice always matches what he can see. */
  const resolved = [];
  tokens.forEach((t, i) => {
    if (t.ws || !t.cands.length) return;
    const pick = Math.min(padChoice[i] || 0, t.cands.length - 1);
    resolved.push({ i: i, he: t.cands[pick] });
  });
  const issues = padAgreementIssues(resolved, { lens: lensGet(), speaker: speakerGet(),
                                                lib: libAll() });
  issues.forEach(iss => {
    const el = he.children[iss.i];
    if (!el || !el.classList.contains("padword")) return;
    el.classList.add("padwarn");
    el.title = iss.why + (iss.suggest ? " — try " + iss.suggest : "");
    if (iss.suggest) el.dataset.fix = iss.suggest;
  });
```

and append a count beside `padCount`:

```js
  const agree = document.getElementById("padAgree");
  if (agree) {
    agree.textContent = issues.length
      ? issues.length + (issues.length === 1 ? " word doesn't agree" : " words don't agree")
      : "";
  }
```

with `<span id="padAgree" class="padagree"></span>` added after `#padCount` in the markup.

- [ ] **Step 3: Click to apply the fix**

In the existing `#padHe` click handler, **before** the candidate-cycling branch:

```js
  /* Applying a fix rewrites the TYPED text, not the Hebrew line — the line is
     derived, so changing it alone would be undone on the next keystroke. */
  const warnEl = e.target.closest(".padword.padwarn[data-fix]");
  if (warnEl) {
    const idx = [...he.children].indexOf(warnEl);
    const fix = warnEl.dataset.fix;
    const info = formInfo(fix);
    const tr = info && libAll()[info.lemma] && libAll()[info.lemma].forms[info.tag];
    const replacement = (tr && tr.tr) || (PRONOUN_TR[fix] || "");
    if (!replacement) { padStatus("No spelling recorded for " + fix + " yet."); return; }
    const input = document.getElementById("padInput");
    const parts = String(input.value).split(/(\s+)/).filter(p => p !== "");
    if (parts[idx] !== undefined) {
      parts[idx] = parts[idx].replace(/[A-Za-z0-9']+/, replacement);
      input.value = parts.join("");
      padSave();
      renderPad();
      padStatus("Changed to “" + replacement + "”.");
    }
    return;
  }
```

with a small `PRONOUN_TR` map (`{"את":"at","אתה":"ata","אתם":"atem","אתן":"aten"}`) beside
`PRONOUN_FEATURES`, since pronouns have no bank to read a spelling from.

- [ ] **Step 4: Hover says what a form is**

In the token loop, where `el.title` is set for a resolved word, add:

```js
      /* What form did I actually write? Free from FORM_INDEX, and the thing that
         makes the pad teach rather than just translate. */
      const fi = formInfo(t.cands[pick]);
      if (fi && fi.tag) {
        const label = FORM_HUMAN[fi.tag] || fi.tag;
        el.title = (el.title ? el.title + " · " : "") + label + " of " + fi.lemma;
      }
```

with `FORM_HUMAN` mapping each tag to plain words, e.g.
`{"pres.fs": "feminine singular, present", "past.1s": "I, past", …}` — built once from
`FORM_TAGS` plus `FORM_ROW_LABELS` rather than typed out twice.

- [ ] **Step 5: Verify live** — type `at holech`, expect the second word underlined with a
  suggestion of `הולכת`; click it and confirm the typed text becomes `holechet`. Type
  `hi holechet` and expect silence.

- [ ] **Step 6: Run the full suite. Back up.**

---

## Corrections made during execution

1. **Token indices do not line up with `padHe.children`.** Whitespace is appended as a *text*
   node, so `he.children` (elements only) drifts from the token array the moment a space
   precedes a word. `he.children[iss.i]` therefore marked nothing whenever the flagged word
   was not first — the count said "1 word doesn't agree" while no word was underlined. Both
   the flag application and the click-to-fix now carry the token index on the element
   (`data-tok`), the pattern the existing cycle handler already used. The typed-parts array
   splits on the same regex, so the token index is also the correct index into it.
2. **The lens rule returns early, so flags cascade rather than appearing at once.** With the
   lens on ♀, `ata holech` flags only the pronoun; fixing it to `at` then flags `holech`.
   Two clicks, each with a visible reason — which reads better than being handed two
   simultaneous complaints about one mistake.

## Observed behaviour

`holechet` now resolves to הולכת where before it failed entirely; hovering says *"feminine
singular, present of ללכת"*. `hi holechet` and `ani holech` (with the speaker set to male)
stay silent. `at holech` flags the verb; `ani rotze she at holech` flags it mid-sentence.
Click-to-fix rewrote `at holech` into `at holechet` and cleared the flag.

## Out of scope

- Topping up partial banks (still Phase 2's leftover).
- Number agreement beyond singular/plural pronouns.
- Anything about tense correctness — only agreement is checked.
- Lemma re-basing — Phase 4.

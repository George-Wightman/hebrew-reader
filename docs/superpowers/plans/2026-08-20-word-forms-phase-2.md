# Word Forms — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the form banks usable — one lens in the Library header re-renders the whole grid in a chosen voice, the per-word panel becomes the single place a word is opened, and the row sheds its chrome down to three properly-sized controls.

**Architecture:** Same single file, same split: pure resolution functions (`lensTagFor`, `lensFormFor`) with thin rendering around them. The lens is a persisted preference read at render time; no row keeps per-row toggle state, which is what made the old `.gtoggle` pill both useless and unscalable.

**Tech Stack:** Vanilla ES6, `localStorage`, the `?selftest=1` harness built in Phase 1.

## Global Constraints

- **Single file**, no dependencies, no build. "Commit" means a timestamped backup:
  `hebrew-reader.BACKUP-<topic>-YYYYMMDD-HHMM.html`.
- **Declaration order is load-bearing.** Function declarations hoist; `const` does not.
- **Only `verified` forms may drive the lens.** An `uncertain` form must never silently
  replace what the row displays — it shows in the panel, marked, and nowhere else.
- **`genderPair` remains a fallback.** ~70 words carry a hand-written feminine partner and no
  generated bank. Removing the F pill without honouring `genderPair` in the lens would be a
  visible regression for exactly the words the old feature did cover.
- **Both row builders.** Any per-word feature must exist in `buildWordRow` *and*
  `buildOppSideEl`; the shared `rowActions` call is `keyA`-only on an opposites row.
- **Accessibility is a requirement, not a polish pass.** Targets ≥24px (WCAG 2.5.8), state
  never carried by colour alone, the lens a labelled `radiogroup`, grid rows keyboard
  reachable, lens changes announced via `aria-live`, motion respecting
  `prefers-reduced-motion`.
- Lens values, exact: `""` (dictionary), `"f"`, `"m"`, `"p"`. Speaker values: `"m"`, `"f"`.
- Storage keys, exact: `hvr_lens`, `hvr_speaker`.

## File Structure

All changes in `hebrew-reader.html`, in the existing `WORD FORMS` section plus the Library
header markup, the row builders, and the panel.

---

## Task 1: Lens resolution

**Files:** `hebrew-reader.html` — WORD FORMS section; SELF TESTS section.

**Interfaces:**
- Produces: `LENS_KEY`, `SPEAKER_KEY`, `lensGet()`, `lensSet(v)`, `speakerGet()`,
  `lensTagFor(pos, lens)` → tag string or `null`, `lensFormFor(key, entry, lens)` →
  `{he, tr, tag, from}` where `from` is `"bank"` | `"genderPair"` | `"citation"`.

- [ ] **Step 1: Write the failing tests**

```js
/* ---- Phase 2 Task 1: lens resolution ---- */
T("lensTagFor: no lens means the citation form", () => {
  assertNull(lensTagFor("verb", ""));
  assertNull(lensTagFor("adj", ""));
});
T("lensTagFor: an adjective agrees with who you're talking to", () => {
  assertEq(lensTagFor("adj", "f"), "fs");
  assertEq(lensTagFor("adj", "m"), "ms");
  assertEq(lensTagFor("adj", "p"), "mp");
});
T("lensTagFor: a verb shows the present participle, not the infinitive", () => {
  assertEq(lensTagFor("verb", "f"), "pres.fs");
  assertEq(lensTagFor("verb", "m"), "pres.ms");
  assertEq(lensTagFor("verb", "p"), "pres.mp");
});
T("lensTagFor: a preposition inflects for the ADDRESSEE", () => {
  assertEq(lensTagFor("prep", "f"), "2fs");
  assertEq(lensTagFor("prep", "m"), "2ms");
  assertEq(lensTagFor("prep", "p"), "2p");
});
T("lensTagFor: a noun never moves — its gender is inherent, not agreement", () => {
  assertNull(lensTagFor("noun", "f"));
  assertNull(lensTagFor("noun", "m"));
});
T("lensTagFor: an adverb or phrase never moves", () => {
  assertNull(lensTagFor("adv", "f"));
  assertNull(lensTagFor("phrase", "f"));
});
T("lensFormFor: with no lens, the citation form and the row key", () => {
  const e = { pos: "adj", tr: "gadol", forms: { ms: F("גדול","gadol"), fs: F("גדולה","gedola") },
              formsMeta: { state: { ms: "verified", fs: "verified" } } };
  const r = lensFormFor("גדול", e, "");
  assertEq(r.he, "גדול"); assertEq(r.from, "citation");
});
T("lensFormFor: the feminine lens swaps in the verified feminine form", () => {
  const e = { pos: "adj", tr: "gadol", forms: { ms: F("גדול","gadol"), fs: F("גדולה","gedola") },
              formsMeta: { state: { ms: "verified", fs: "verified" } } };
  const r = lensFormFor("גדול", e, "f");
  assertEq(r, { he: "גדולה", tr: "gedola", tag: "fs", from: "bank" });
});
T("lensFormFor: an UNVERIFIED form is never shown by the lens", () => {
  const e = { pos: "adj", tr: "gadol", forms: { fs: F("גדולה","gedola") },
              formsMeta: { state: { fs: "uncertain" } } };
  assertEq(lensFormFor("גדול", e, "f").from, "citation");
});
T("lensFormFor: falls back to genderPair when there is no bank", () => {
  const e = { tr: "gadol", genderPair: { he: "גדולה", tr: "gedola" } };
  assertEq(lensFormFor("גדול", e, "f"), { he: "גדולה", tr: "gedola", tag: null, from: "genderPair" });
});
T("lensFormFor: genderPair is feminine only — the masculine lens ignores it", () => {
  const e = { tr: "gadol", genderPair: { he: "גדולה", tr: "gedola" } };
  assertEq(lensFormFor("גדול", e, "m").from, "citation");
});
T("lensFormFor: a noun under any lens stays put", () => {
  const e = { pos: "noun", tr: "delet", gender: "f", forms: { sg: F("דלת","delet") },
              formsMeta: { state: { sg: "verified" } } };
  assertEq(lensFormFor("דלת", e, "f").he, "דלת");
});
T("lensFormFor: survives a missing entry", () => {
  assertEq(lensFormFor("שלום", null, "f"), { he: "שלום", tr: "", tag: null, from: "citation" });
});
```

- [ ] **Step 2: Run and verify they fail** — reload `?selftest=1`, expect 13 new failures.

- [ ] **Step 3: Implement**

```js
/* THE LENS. One control, in the Library header, that re-renders every agreeing
   word in the grid in the voice you're writing in. This replaces the per-row
   "F" pill, which could not scale: at universal coverage it would have been 241
   permanently-visible 9px controls, and it could never express tense.

   The lens is about the ADDRESSEE — who you are speaking to. The speaker (George,
   male) is a separate fixed setting, because it never changes mid-session and so
   has no business being a toggle. */
const LENS_KEY = "hvr_lens";
const SPEAKER_KEY = "hvr_speaker";
const LENS_VALUES = ["", "f", "m", "p"];
function lensGet() {
  const v = lsGet(LENS_KEY) || "";
  return LENS_VALUES.indexOf(v) === -1 ? "" : v;
}
function lensSet(v) { lsSet(LENS_KEY, LENS_VALUES.indexOf(v) === -1 ? "" : v); }
function speakerGet() { return lsGet(SPEAKER_KEY) === "f" ? "f" : "m"; }

/* Which slot of the bank a lens selects, per part of speech.
   - adj/pron agree with the addressee.
   - verb shows the PRESENT PARTICIPLE, not the infinitive: "at holechet" is what
     you'd actually say to her, and the participle is the form that agrees.
   - prep inflects for person, and the useful person is the one you're addressing
     (lach / lecha / lachem), not a third party.
   - noun returns null. A noun HAS a gender, it does not agree — this is the
     single most-misunderstood point in the whole feature and the reason
     FORM_TAGS.noun holds no ms/fs. */
const LENS_TAGS = {
  adj:  { f: "fs", m: "ms", p: "mp" },
  pron: { f: "fs", m: "ms", p: "mp" },
  num:  { f: "fs", m: "ms" },
  verb: { f: "pres.fs", m: "pres.ms", p: "pres.mp" },
  prep: { f: "2fs", m: "2ms", p: "2p" }
};
function lensTagFor(pos, lens) {
  if (!lens) return null;
  const map = LENS_TAGS[pos];
  return (map && map[lens]) || null;
}

/* What a row should display. Order: a VERIFIED bank form for the lens tag, then
   the hand-written genderPair (feminine only — it predates the banks and is all
   ~70 of those words have), then the citation form.

   Unverified forms are deliberately unreachable here. The whole contract is that
   the app only ACTS on what it has settled; showing a coin-flip form as though it
   were the word would teach it. */
function lensFormFor(key, entry, lens) {
  const cite = { he: key, tr: (entry && entry.tr) || "", tag: null, from: "citation" };
  if (!entry || !lens) return cite;
  const tag = lensTagFor(entry.pos, lens);
  if (tag) {
    const f = formGet(entry, tag);
    const st = entry.formsMeta && entry.formsMeta.state && entry.formsMeta.state[tag];
    if (f && st === "verified") return { he: f.he, tr: f.tr || "", tag: tag, from: "bank" };
  }
  if (lens === "f" && entry.genderPair && entry.genderPair.he) {
    return { he: entry.genderPair.he, tr: entry.genderPair.tr || "", tag: null,
             from: "genderPair" };
  }
  return cite;
}
```

- [ ] **Step 4: Run and verify they pass.**
- [ ] **Step 5: Back up** — `cp hebrew-reader.html "hebrew-reader.BACKUP-lens-resolve-$(date +%Y%m%d-%H%M).html"`

---

## Task 2: The lens control in the Library header

**Files:** `hebrew-reader.html` — header markup, CSS, WORD FORMS section.

**Interfaces:**
- Consumes: `lensGet`, `lensSet` (T1).
- Produces: `renderLensControl()`, `LENS_LABELS`.

- [ ] **Step 1: Add the markup**

In the Library header `.libbar`, immediately before `#fillFormsBtn`:

```html
<span class="lensrow" id="lensRow" role="radiogroup" aria-label="Show words as you'd say them to">
  <span class="lenslbl" aria-hidden="true">saying it to</span>
</span>
<span id="lensLive" class="visually-hidden" aria-live="polite"></span>
```

- [ ] **Step 2: Add the CSS**

```css
  .lensrow { display: inline-flex; align-items: center; gap: 2px; }
  .lenslbl { color: var(--muted); font-size: 11px; text-transform: uppercase;
             letter-spacing: .04em; margin-right: 4px; }
  .lensbtn { border: 1px solid var(--border); background: none; color: var(--muted);
             border-radius: 5px; padding: 3px 9px; font-size: 12px; cursor: pointer;
             min-height: 26px; }
  .lensbtn:hover { border-color: var(--accent); color: var(--accent); }
  .lensbtn[aria-checked="true"] { background: var(--accent); border-color: var(--accent);
                                  color: #fff; }
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden;
                     clip: rect(0 0 0 0); white-space: nowrap; }
  /* A lens changes what every row SAYS. Tinting the container is the signal —
     one mark for the whole surface rather than 241 per-row badges, and it stops
     a feminine form being memorised as the dictionary form. */
  #grid.lensed { background: var(--gold-soft); border-radius: 8px;
                 box-shadow: inset 0 0 0 1px var(--gold); }
  .lenschip { background: var(--gold-soft); border: 1px solid var(--gold); color: var(--gold);
              border-radius: 999px; padding: 1px 9px; font-size: 11px; margin-left: 8px; }
  @media (prefers-reduced-motion: no-preference) {
    #grid { transition: background .15s ease; }
  }
```

- [ ] **Step 3: Implement the control**

```js
/* Icons AND text, never icon-only: "♀" alone is a symbol whose meaning here
   ("the person you are writing to is female") is not self-evident, and a
   screen reader would announce it as "female sign". */
const LENS_LABELS = [
  { v: "",  label: "—",    full: "the dictionary form" },
  { v: "f", label: "♀ her", full: "a woman" },
  { v: "m", label: "♂ him", full: "a man" },
  { v: "p", label: "⚥ them", full: "more than one person" }
];

function renderLensControl() {
  const row = document.getElementById("lensRow");
  if (!row) return;
  const cur = lensGet();
  [...row.querySelectorAll(".lensbtn")].forEach(b => b.remove());
  LENS_LABELS.forEach(o => {
    const b = document.createElement("button");
    b.className = "lensbtn";
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", cur === o.v ? "true" : "false");
    b.textContent = o.label;
    b.title = "Show each word as you'd say it to " + o.full;
    b.setAttribute("aria-label", "Saying it to " + o.full);
    b.tabIndex = (cur === o.v) ? 0 : -1;      // roving tabindex, standard for a radiogroup
    b.addEventListener("click", () => setLens(o.v));
    b.addEventListener("keydown", (ev) => {
      const i = LENS_LABELS.findIndex(x => x.v === lensGet());
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") {
        ev.preventDefault(); setLens(LENS_LABELS[(i + 1) % LENS_LABELS.length].v);
        document.querySelector('.lensbtn[aria-checked="true"]').focus();
      } else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
        ev.preventDefault();
        setLens(LENS_LABELS[(i - 1 + LENS_LABELS.length) % LENS_LABELS.length].v);
        document.querySelector('.lensbtn[aria-checked="true"]').focus();
      }
    });
    row.appendChild(b);
  });
}

function setLens(v) {
  lensSet(v);
  renderLensControl();
  renderLibrary();
  const o = LENS_LABELS.find(x => x.v === lensGet());
  const live = document.getElementById("lensLive");
  if (live) live.textContent = v ? "Showing every word as you'd say it to " + o.full
                                 : "Showing dictionary forms";
}
```

- [ ] **Step 4: Paint the grid state**

Inside `renderLibrary()`, immediately after `updateFormsButton();`:

```js
  /* One mark on the container, not 241 on the rows. */
  const lens = lensGet();
  const gridEl = document.getElementById("grid");
  if (gridEl) gridEl.classList.toggle("lensed", !!lens);
  const lensChip = document.getElementById("lensChip");
  if (lensChip) {
    lensChip.style.display = lens ? "" : "none";
    const o = LENS_LABELS.find(x => x.v === lens);
    lensChip.textContent = lens ? "reading as you'd say it to " + o.full : "";
  }
```

And add the chip to the Library heading, after `#shelfChip`:

```html
<span id="lensChip" class="lenschip" style="display:none"></span>
```

- [ ] **Step 5: Call `renderLensControl()` from the init block**, next to
  `document.getElementById("heMode").value = ...`.

- [ ] **Step 6: Verify** — reload, click each lens button; expect `aria-checked` to move,
  the grid to gain the tint, the chip to appear, and arrow keys to move the selection.

- [ ] **Step 7: Back up.**

---

## Task 3: Rows render through the lens

**Files:** `hebrew-reader.html` — `buildWordRow`, `buildOppSideEl`.

**Interfaces:** Consumes `lensFormFor` (T1), `lensGet` (T1).

- [ ] **Step 1: Change `buildWordRow`**

Replace the three display lines:

```js
  const view = lensFormFor(key, e, lens);
  const tr = document.createElement("span"); tr.className = "gtr"; tr.textContent = view.tr;
  const en = document.createElement("span"); en.className = "gen"; en.textContent = e.en || "";
  const he = document.createElement("span"); he.className = "ghe"; he.textContent = view.he;
  if (view.from !== "citation") {
    /* The row title is the only per-row place the substitution is stated. The
       container tint says A lens is on; this says WHICH word moved and from what. */
    row.title = view.tr + " — " + (e.en || "") + "  " + view.he +
                "   (" + (e.tr || "") + " " + key + " in the dictionary)";
  }
```

with `lens` threaded in as a parameter — see Step 3.

- [ ] **Step 2: Change `buildOppSideEl` identically**, since an opposites word must not lose
  a feature the grid rows get.

- [ ] **Step 3: Thread `lens` from `renderLibrary`**

`renderLibrary` already reads `focus` and `srs` once and threads them per row for
performance (hebrew-reader.html:4584). Read `lensGet()` once the same way and pass it to
`buildWordRow(key, e, focus, srs, lens)` and `buildOppSideEl(key, e, focus, srs, lens)`,
updating every call site. Reading `lensGet()` per row would be an extra `localStorage`
read per row — the exact cost that comment exists to prevent.

- [ ] **Step 4: Verify** — with a word that has a verified `fs` form, set the lens to ♀ and
  confirm the row shows the feminine spelling and pronunciation; hover shows the dictionary
  form in the tooltip. Set the lens back to — and confirm it reverts.

- [ ] **Step 5: Back up.**

---

## Task 4: Retire the F pill

**Files:** `hebrew-reader.html` — `genderToggleBtn` and its two call sites, `.gtoggle` CSS.

- [ ] **Step 1: Delete `genderToggleBtn`** (hebrew-reader.html:5365) and both call sites in
  `buildWordRow` and `buildOppSideEl`.

- [ ] **Step 2: Delete the `.gtoggle` CSS rules** (hebrew-reader.html:522-527).

- [ ] **Step 3: Do NOT delete `genderPair` data or `GENDER_PAIRS`.** The lens falls back to
  `genderPair` (Task 1), `cardEntry`/`libUpsert` still populate it, and `singularOf`/
  `genderBaseOf` remain the offline harvest path for words with no bank. Removing the pill
  removes the *control*, not the data.

- [ ] **Step 4: Verify** — search the file for `gtoggle`; expect zero matches. Reload and
  confirm no row shows an F pill and nothing throws.

- [ ] **Step 5: Back up.**

---

## Task 5: The panel becomes the one place a word opens

**Deviation from the spec, stated openly.** The spec says the panel "opens from ✎, which
stops being 'edit' and becomes 'open this word'." This plan keeps **⊞** as the opener and
removes ✎ instead. Same three-button outcome, same panel — but a pencil promises editing,
and the panel is mostly a conjugation table with editing at the bottom, so ✎ would
mis-describe it. ⊞ already exists from Phase 1 and reads as "expand". If you would rather
have the pencil, it is a one-line change.

There are four call sites to update for the `lens` parameter (hebrew-reader.html:4962, 5566,
5567, 6120) — miss one and half the library silently ignores the lens, which is the same
family of bug as the opposites-row omissions this file keeps re-learning.

**Files:** `hebrew-reader.html` — panel markup, `openWordPanel`, `rowActions`,
`buildOppSideEl`, `edSave` handler.

**Interfaces:**
- Produces: `libraryEditSave(key, tr, en, cat)` — the shared save path.

- [ ] **Step 1: Extract the shared save**

The library half of the `#edSave` handler (hebrew-reader.html:2633) becomes:

```js
/* One save path for a library row, shared by the old popover and the panel. The
   popover still serves TRANSLATOR cards, which are a different thing (they edit
   store.userDict for a word that may not be in the library at all) — so the two
   stay separate functions rather than one with a mode flag. */
function libraryEditSave(key, tr, en, cat) {
  const l = libAll();
  if (!l[key]) return false;
  l[key].tr = tr;
  l[key].en = en;
  if (cat) l[key].cat = cat;
  libSave(l);
  const ud = store.userDict;              // teach the reader as well
  ud[key] = [tr, en];
  store.userDict = ud;
  /* Changing a pronunciation changes how the pad finds the word, so the reverse
     index has to be rebuilt or the new spelling is unfindable until a reload. */
  rebuildTrIndex();
  renderLibrary();
  if (typeof renderPad === "function") renderPad();
  return true;
}
```

Rewrite the `if (editingLibKey)` branch of `edSave` to call it.

- [ ] **Step 2: Add the panel's controls markup**, after `#wpForms`:

```html
<div class="wpanel-edit">
  <label for="wpTr">Pronunciation</label>
  <input type="text" id="wpTr">
  <label for="wpEn">English</label>
  <input type="text" id="wpEn">
  <label for="wpCat">Category</label>
  <select id="wpCat"></select>
</div>
<div class="wpanel-actions">
  <button class="btn" id="wpSave">Save</button>
  <button class="btn secondary" id="wpStar"></button>
  <button class="btn secondary" id="wpShelf"></button>
  <button class="btn secondary wpdel" id="wpDelete">Delete word</button>
</div>
```

- [ ] **Step 3: CSS**

```css
  .wpanel-edit { display: grid; grid-template-columns: auto 1fr; gap: 8px 12px;
                 align-items: center; margin-top: 16px; }
  .wpanel-edit label { color: var(--muted); font-size: 12px; }
  .wpanel-edit input, .wpanel-edit select { width: 100%; padding: 5px 7px; font: inherit;
    border: 1px solid var(--border); border-radius: 5px; background: var(--bg); color: var(--ink); }
  .wpanel-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
  .wpanel-actions .btn { min-height: 30px; }
  .wpanel-actions .wpdel { margin-left: auto; color: var(--bad); border-color: var(--bad); }
```

- [ ] **Step 4: Populate and wire them in `openWordPanel`**

```js
  /* The panel is now the whole word: forms, the fields that used to be in the
     popover, the star, retire, and delete. That is what buys the row its three
     buttons and their 24px targets. */
  document.getElementById("wpTr").value = e.tr || "";
  document.getElementById("wpEn").value = e.en || "";
  const catSel = document.getElementById("wpCat");
  catSel.innerHTML = "";
  CATS.forEach(c => { const o = document.createElement("option");
                      o.value = c; o.textContent = c; catSel.appendChild(o); });
  catSel.value = CATS.indexOf(e.cat) !== -1 ? e.cat : "Uncategorised";
  wpKey = key;

  const starred = !!focusAll()[key];
  const starBtn = document.getElementById("wpStar");
  starBtn.textContent = starred ? "★ Working on it" : "☆ Mark as working on";
  starBtn.setAttribute("aria-pressed", starred ? "true" : "false");

  const reserve = shelfOf(e) === "reserve";
  document.getElementById("wpShelf").textContent = reserve ? "↑ Back into focus" : "↓ Retire";
```

with `let wpKey = null;` declared beside `wpReturnFocus`, and these handlers added once:

```js
document.getElementById("wpSave").onclick = () => {
  if (!wpKey) return;
  const ok = libraryEditSave(wpKey, document.getElementById("wpTr").value.trim(),
                             document.getElementById("wpEn").value.trim(),
                             document.getElementById("wpCat").value);
  if (ok) setLibStatus("Updated “" + wpKey + "”.");
  closeWordPanel();
};
document.getElementById("wpStar").onclick = () => {
  if (!wpKey) return;
  focusToggle(wpKey);
  const starred = !!focusAll()[wpKey];
  const b = document.getElementById("wpStar");
  b.textContent = starred ? "★ Working on it" : "☆ Mark as working on";
  b.setAttribute("aria-pressed", starred ? "true" : "false");
};
document.getElementById("wpShelf").onclick = () => {
  if (!wpKey) return;
  const reserve = shelfOf(libAll()[wpKey]) === "reserve";
  setShelf(wpKey, reserve ? "focus" : "reserve");
  closeWordPanel();
};
document.getElementById("wpDelete").onclick = () => {
  if (!wpKey) return;
  if (!confirm("Remove “" + wpKey + "” from the library?\n\nThis deletes its drill history " +
               "too. To just take it off the grid, use Retire instead.")) return;
  const k = wpKey;
  closeWordPanel();
  deleteWord(k);
  setLibStatus("Deleted “" + k + "”.");
};
```

- [ ] **Step 5: Reduce the row to three buttons**

In `rowActions`, delete the `ed` (✎) and `del` (✕) buttons and the `focusStar` call, leaving
shelf, audio, and the forms button. Rename the forms button's title to "Open" since it is
now the way into everything:

```js
function rowActions(key, focus, opts, entry) {
  const act = document.createElement("span");
  act.className = "rowact";
  /* Three controls, not six. The star, edit and delete all moved into the panel
     — which is what lets these clear the 24px WCAG 2.5.8 minimum in a 19px row
     instead of being ~11px targets fighting each other. */
  if (!(opts && opts.noShelf) && entry) act.appendChild(shelfBtn(key, entry));
  if (!(opts && opts.noAudio)) act.appendChild(libAudioButton(key));
  if (!(opts && opts.noForms)) act.appendChild(formsBtn(key));
  return act;
}
```

and in `buildOppSideEl` drop the `focusStar` call (the star now lives in each side's panel),
keeping `formsBtn(key, "sideforms")`, audio and shelf.

- [ ] **Step 6: Give the buttons real target sizes**

```css
  .grow-row .rowact { flex: 0 0 auto; margin-left: auto; display: none; gap: 4px; }
  .grow-row .rowact button {
    border: none; background: none; cursor: pointer; padding: 0 6px;
    font-size: calc(var(--gfont) - 1px); color: var(--accent); line-height: 1;
    min-width: 24px; min-height: 24px; border-radius: 4px;
  }
  .grow-row .rowact button:hover { background: var(--accent-soft); }
  .grow-row .rowact button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
```

Delete the now-unused `.grow-row .rowact button.del` and `button.star` rules, and the
`.grow-row.gfocus .rowact` / `.gfocus .rowact button.star` rules (the star is no longer
in the row, but `.gfocus` itself — the bold + accent edge — stays).

- [ ] **Step 7: Verify** — hover a row: exactly `↓ 🔊 ⊞`. Open the panel: fields populated,
  star reflects state, retire and delete present. Save changes the row. Delete asks first and
  says what it takes with it. On an opposites row, each side still has its own ⊞.

- [ ] **Step 8: Back up.**

---

## Task 6: Keyboard access to the grid

**Files:** `hebrew-reader.html` — `buildWordRow`, `buildOppSideEl`, CSS.

The Library is mouse-and-drag only today: every row action hides behind `:hover`, so none of
it exists for a keyboard.

- [ ] **Step 1: Make rows focusable and actionable**

In `buildWordRow`, after `row.className = ...`:

```js
  /* The grid was mouse-only: .rowact is display:none until :hover, so every
     per-word action was unreachable from a keyboard. A row is now a button in
     all but name — Tab to it, Enter or Space opens its panel. */
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.setAttribute("aria-label", (e.tr || key) + " — " + (e.en || "") + ". Open word.");
  row.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault();
    openWordPanel(key);
  });
```

Do the same in `buildOppSideEl`, on the side element, so each half is separately reachable.

- [ ] **Step 2: Reveal the actions on focus, not only hover**

```css
  .grow-row:hover .rowact, .grow-row:focus-within .rowact { display: flex; }
  .grow-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px;
                            background: var(--accent-soft); }
  .grow-row.opp:hover .sideforms, .gside:focus-within .sideforms { display: inline; }
  .gside:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
```

Replace the existing `.grow-row:hover .rowact { display: flex; }` rule rather than adding a
second one.

- [ ] **Step 3: Verify** — Tab into the grid: each row takes focus with a visible ring, its
  buttons appear, Enter opens the panel, Esc returns focus to the row.

- [ ] **Step 4: Back up.**

---

## Task 7: The speaker setting

**Files:** `hebrew-reader.html` — Settings markup and handler.

`speakerGet()` exists from Task 1 and is read by nothing yet — Phase 3's pad agreement
checking is its first consumer. It is set here so the preference exists before the feature
that needs it, and so the lens's meaning ("who you're talking TO") is explicit by contrast.

- [ ] **Step 1: Add the Settings row**, next to the forms controls:

```html
<div class="setrow">
  <div class="setrow-text"><b>I am</b>
    <p>Hebrew verbs and adjectives agree with whoever is speaking, so the app needs to know which forms are yours — "ani rotze" or "ani rotza". This is you; the lens above the Library is who you're talking to.</p></div>
  <button class="btn secondary" id="speakerBtn"></button>
</div>
```

- [ ] **Step 2: Wire it**

```js
/* Not settingsAction(): same reasoning as the forms-auto toggle — closing the
   modal on a toggle hides the state you just set. */
function paintSpeakerBtn() {
  const b = document.getElementById("speakerBtn");
  if (!b) return;
  b.textContent = speakerGet() === "f" ? "Female" : "Male";
  b.title = "Click to switch";
}
document.getElementById("speakerBtn").onclick = () => {
  lsSet(SPEAKER_KEY, speakerGet() === "f" ? "m" : "f");
  paintSpeakerBtn();
};
paintSpeakerBtn();
```

- [ ] **Step 3: Verify** — the button reads "Male" by default and toggles.
- [ ] **Step 4: Run the full self-test suite** — expect `fail: 0`.
- [ ] **Step 5: Back up.**

---

## Corrections made during execution

1. **Task 4 must happen with Task 3, not after it.** The F pill's `setState(false)` runs on
   creation and rewrites the row's `.gtr`/`.ghe` back to the citation form — so with the pill
   still present, the lens worked for words with a *bank* and was silently undone for every
   word with a `genderPair`, which is exactly the set the pill existed for. Symptom: `גדול`
   moved under ♀, `עייף` did not, and the resolver returned the right answer when called
   directly. Ordering the removal after the threading created that window.
2. **The lens has to be threaded through five functions, not two.** `buildBlock`,
   `buildOppRow` and `renderMapPlane` all sit between `renderLibrary` and the row builders;
   the plan named only `buildWordRow` and `buildOppSideEl`. Missing `renderMapPlane` would
   have left the Map view rendering dictionary forms while the grid showed the lens.
3. **Rows now carry `data-key`.** Under a lens the displayed Hebrew is not the row's key, so
   nothing in the DOM identified which *word* a row was — which also made the grid impossible
   to assert against, and produced a false negative during Task 3 (`עייף` matched by
   substring against a `עייפה` row).
4. **The lens copy is per-option.** "as you'd say it to ___" cannot complete for the neutral
   option — it announced as *"Saying it to the dictionary form"*. Each option now carries its
   own `say` and `chip` strings.
5. **Keyboard access is row-level, not button-level.** Three tab stops on each of 140 rows
   would be worse than useless. The row is the target (`tabindex`, `role="button"`, Enter or
   Space), and the panel holds every action with a real label. The hidden `.rowact` buttons
   are absent from the accessibility tree while `display:none`, so this does not nest
   interactive controls.

## Out of scope for Phase 2

- Topping up partial banks (`formsMeta.expected` records the shortfall; nothing acts on it).
- Anything in the pad — that is Phase 3.
- Lemma re-basing — Phase 4.

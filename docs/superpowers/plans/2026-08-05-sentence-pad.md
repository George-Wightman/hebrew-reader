# Sentence Pad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bottom-strip sentence pad to the Library page where George types transliteration, watches the Hebrew assemble itself from his library, and sends the gaps off to be looked up.

**Architecture:** A reverse index (transliteration → Hebrew) is built once at load from `DICT` + the live library. The pad is one textarea whose text is tokenised on every input; each token is looked up in the index to render a parallel RTL Hebrew line. Tokens with no match render as amber gaps and become the payload for a lookup round trip that deposits answers in the existing Pending queue.

**Tech Stack:** Vanilla HTML/CSS/JS in a single self-contained file. No build step, no dependencies, no framework. `localStorage` for all persistence.

## Global Constraints

- **Single file.** Every change lands in `hebrew-reader.html`. No new files, no imports, no CDN references — the app must keep working offline from a double-click.
- **Not a git repo.** There are no commits. Each task ends with a browser verification step instead.
- **No test framework.** Tests are assertion snippets run against the preview browser with `mcp__Claude_Browser__javascript_tool` (`javascript_exec`). A test "fails" when the snippet throws or returns a mismatch.
- **Storage keys are namespaced `hvr_`.** New keys: `hvr_pad`, `hvr_padopen`, `hvr_paddrafts`, `hvr_geminikey`.
- **Amber means "unknown".** Reuse `var(--unknown-bg)` / `var(--unknown-border)`; do not introduce a new colour for gaps.
- **Hebrew is secondary.** Transliteration leads at full size; Hebrew renders smaller. Same call the Library grid already makes.
- **The pad must never block on network.** Every online path falls back to the copy-prompt path.

---

## File structure

One file, so this is a section map rather than a file list. Insertion points are given as anchors, since line numbers shift as tasks land.

| Region | Anchor | What goes there |
|---|---|---|
| CSS | after `.gblock.pending-block` rules (~line 166) | `.padstrip`, `.padline`, `.padgap`, `.readaloud` |
| HTML | inside `#viewLibrary`, after `.libnote` (~line 290) | pad strip markup |
| HTML | end of body, beside `#editor` | read-aloud overlay |
| JS — index | after `libUpsert()` (~line 1506) | `trNorm`, `buildTrIndex`, `TR_INDEX` |
| JS — pad | after `updateLibraryNavBadge()` (~line 2086) | tokenising, rendering, persistence, ask, drafts |

---

### Task 1: Transliteration normaliser and reverse index

**Files:**
- Modify: `hebrew-reader.html` — insert after `libUpsert()`

**Interfaces:**
- Consumes: `DICT`, `libAll()` (both already exist)
- Produces: `trNorm(s) -> string`, `buildTrIndex() -> {normalisedTr: [hebrew, ...]}`, module-level `TR_INDEX`

- [ ] **Step 1: Write the failing test**

Run this in the preview browser. It must fail now because nothing is defined.

```js
(function () {
  const out = [];
  const eq = (label, got, want) => out.push((got === want ? "PASS " : "FAIL ") + label + " got=" + got + " want=" + want);
  eq("fold kh", trNorm("lekhem"), "lechem");
  eq("strip apostrophe", trNorm("ro'tze"), "roze");
  eq("lowercase", trNorm("ROTZE"), "roze");
  eq("collapse doubles", trNorm("rotzze"), "roze");
  eq("tz to z", trNorm("rotze"), "roze");
  const idx = buildTrIndex();
  eq("rotze resolves", (idx[trNorm("rotze")] || [])[0], "\u05e8\u05d5\u05e6\u05d4");
  eq("rotza splits from slash pair", (idx[trNorm("rotza")] || [])[0], "\u05e8\u05d5\u05e6\u05d4");
  eq("kore is ambiguous", (idx[trNorm("kore")] || []).length >= 2, true);
  eq("no sentinel keys", Object.keys(idx).some(k => k.indexOf("@") === 0), false);
  return out.join("\n");
})();
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: a `ReferenceError: trNorm is not defined`.

- [ ] **Step 3: Implement**

Insert after `libUpsert()`:

```js
/* =====================  TRANSLITERATION REVERSE INDEX  =====================
   The app has always run Hebrew -> English. The pad runs the other way: George
   types pronunciation and we find the Hebrew. Transliteration is not a fixed
   orthography, so both the index keys and the typed input pass through the same
   normaliser — that's what stops the two drifting apart. */
function trNorm(s) {
  return String(s).toLowerCase()
    .replace(/['\u2019`\-]/g, "")
    .replace(/kh/g, "ch")
    .replace(/q/g, "k")
    .replace(/tz/g, "z")
    .replace(/(.)\1+/g, "$1");
}

/* One normalised spelling can legitimately mean several words (kore = reads /
   happens), so values are lists and the pad lets you cycle them. */
function buildTrIndex() {
  const idx = {};
  function add(tr, heb) {
    const k = trNorm(String(tr).trim());
    if (!k || !heb) return;
    if (!idx[k]) idx[k] = [];
    if (idx[k].indexOf(heb) === -1) idx[k].push(heb);
  }
  Object.keys(DICT).forEach(heb => {
    if (heb.charAt(0) === "@") return;
    const v = DICT[heb];
    if (!Array.isArray(v)) return;
    String(v[0]).split("/").forEach(part => add(part, heb));
  });
  const lib = libAll();
  Object.keys(lib).forEach(heb => {
    String(lib[heb].tr || "").split("/").forEach(part => add(part, heb));
  });
  return idx;
}

let TR_INDEX = buildTrIndex();
function rebuildTrIndex() { TR_INDEX = buildTrIndex(); }
```

- [ ] **Step 4: Run the test again**

Expected: all nine lines start `PASS`.

- [ ] **Step 5: Verify no regression**

```js
(function () {
  document.getElementById("input").value = "\u05d0\u05e0\u05d9 \u05e8\u05d5\u05e6\u05d4 \u05dc\u05dc\u05db\u05ea";
  document.getElementById("readBtn").click();
  return document.querySelectorAll("#out .card").length + " cards, index " + Object.keys(TR_INDEX).length + " keys";
})();
```

Expected: 3 cards, and an index of roughly 900–1,200 keys.

---

### Task 2: Pad strip — markup, styling, collapse, autosave

**Files:**
- Modify: `hebrew-reader.html` — CSS after `.gblock.pending-block`; HTML after `.libnote`; JS after `updateLibraryNavBadge()`

**Interfaces:**
- Consumes: nothing from Task 1 yet
- Produces: `#padStrip`, `#padInput`, `#padHe`, `#padToggle`, `#padCount` in the DOM; `padSave()`, `padLoad()`; keys `hvr_pad`, `hvr_padopen`

- [ ] **Step 1: Write the failing test**

```js
(function () {
  const out = [];
  const eq = (l, g, w) => out.push((g === w ? "PASS " : "FAIL ") + l + " got=" + g);
  eq("strip exists", !!document.getElementById("padStrip"), true);
  eq("input exists", !!document.getElementById("padInput"), true);
  eq("hebrew line exists", !!document.getElementById("padHe"), true);
  const i = document.getElementById("padInput");
  i.value = "ani rotze";
  i.dispatchEvent(new Event("input"));
  eq("autosaved", localStorage.getItem("hvr_pad"), "ani rotze");
  document.getElementById("padToggle").click();
  eq("collapse persists", localStorage.getItem("hvr_padopen"), "0");
  document.getElementById("padToggle").click();
  eq("expand persists", localStorage.getItem("hvr_padopen"), "1");
  return out.join("\n");
})();
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `FAIL strip exists got=false` on the first line.

- [ ] **Step 3: Add the CSS**

Insert after the `.gblock.pending-block` rules:

```css
  .padstrip { margin-top: 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--panel); }
  .padstrip-head { display: flex; align-items: center; gap: 10px; padding: 8px 12px; cursor: pointer; user-select: none; }
  .padstrip-head h4 { margin: 0; font-size: 14px; font-weight: 600; }
  .padstrip-head .padmeta { margin-left: auto; font-size: 12px; color: var(--muted); }
  .padstrip-body { padding: 0 12px 12px; }
  .padstrip.collapsed .padstrip-body { display: none; }
  .padlabel { font-size: 11px; color: var(--muted); margin: 6px 0 4px; }
  #padInput { width: 100%; min-height: 58px; resize: vertical; font-size: 16px; line-height: 1.8;
    padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; font-family: inherit; }
  .padline { min-height: 34px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px;
    background: var(--bg); font-size: 18px; line-height: 1.8; direction: rtl; text-align: right; }
  .padgap { display: inline-block; min-width: 46px; border-bottom: 2px dotted var(--unknown-border); }
  .padrow { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
```

- [ ] **Step 4: Add the markup**

Insert directly after the `.libnote` div, still inside `#viewLibrary`:

```html
  <div class="padstrip" id="padStrip">
    <div class="padstrip-head" id="padToggle">
      <h4>Sentence pad</h4>
      <span class="padmeta" id="padCount"></span>
    </div>
    <div class="padstrip-body">
      <div class="padlabel">Type the pronunciation — the Hebrew builds itself</div>
      <textarea id="padInput" placeholder="ani rotze lalechet la'avoda machar"></textarea>
      <div class="padlabel">Hebrew</div>
      <div class="padline" id="padHe" dir="rtl"></div>
      <div class="padrow" id="padActions"></div>
    </div>
  </div>
```

- [ ] **Step 5: Add the JS**

Insert after `updateLibraryNavBadge()`:

```js
/* =====================  SENTENCE PAD  =====================
   Lives under the Library grid rather than as a third view, because the whole
   point is composing while looking at your words. */
const PAD_KEY = "hvr_pad", PAD_OPEN_KEY = "hvr_padopen";

function padSave() { localStorage.setItem(PAD_KEY, document.getElementById("padInput").value); }
function padLoad() { document.getElementById("padInput").value = localStorage.getItem(PAD_KEY) || ""; }

function padSetOpen(open) {
  document.getElementById("padStrip").classList.toggle("collapsed", !open);
  localStorage.setItem(PAD_OPEN_KEY, open ? "1" : "0");
}

document.getElementById("padToggle").onclick = () => {
  padSetOpen(document.getElementById("padStrip").classList.contains("collapsed"));
};

let padTimer = null;
document.getElementById("padInput").addEventListener("input", () => {
  padSave();
  clearTimeout(padTimer);
  padTimer = setTimeout(renderPad, 120);
});

function renderPad() { /* replaced in Task 3 */ }

padLoad();
padSetOpen(localStorage.getItem(PAD_OPEN_KEY) !== "0");
```

- [ ] **Step 6: Run the test again**

Expected: all six lines `PASS`.

- [ ] **Step 7: Verify the grid still lays out**

```js
(function () {
  setView("library");
  const r = [...document.querySelectorAll(".gblock")].map(b => b.getBoundingClientRect());
  let o = 0;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++)
    if (r[i].left < r[j].right - 1 && r[j].left < r[i].right - 1 && r[i].top < r[j].bottom - 1 && r[j].top < r[i].bottom - 1) o++;
  return "overlaps=" + o + " padVisible=" + (document.getElementById("padStrip").offsetHeight > 0);
})();
```

Expected: `overlaps=0 padVisible=true`.

---

### Task 3: Tokenise input and render the Hebrew line with gaps

**Files:**
- Modify: `hebrew-reader.html` — replace the `renderPad()` stub from Task 2

**Interfaces:**
- Consumes: `trNorm`, `TR_INDEX` (Task 1); `#padInput`, `#padHe`, `#padCount` (Task 2)
- Produces: `padTokens(text) -> [{ws, raw, core, key, cands}]`, working `renderPad()`, `padGaps() -> [string]`

- [ ] **Step 1: Write the failing test**

```js
(function () {
  const out = [];
  const eq = (l, g, w) => out.push((g === w ? "PASS " : "FAIL ") + l + " got=" + JSON.stringify(g));
  const t = padTokens("ani rotze zzzznotaword");
  eq("token count ignoring spaces", t.filter(x => !x.ws).length, 3);
  eq("known word resolves", t.filter(x => !x.ws)[1].cands[0], "\u05e8\u05d5\u05e6\u05d4");
  eq("unknown word empty", t.filter(x => !x.ws)[2].cands.length, 0);
  const i = document.getElementById("padInput");
  i.value = "ani rotze zzzznotaword";
  i.dispatchEvent(new Event("input"));
  renderPad();
  eq("gap rendered", document.querySelectorAll("#padHe .padgap").length, 1);
  eq("hebrew rendered", document.querySelectorAll("#padHe .padword").length, 2);
  eq("gaps listed", padGaps().length, 1);
  eq("count shown", /3 words/.test(document.getElementById("padCount").textContent), true);
  return out.join("\n");
})();
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `ReferenceError: padTokens is not defined`.

- [ ] **Step 3: Implement**

Replace the `renderPad()` stub with:

```js
/* Split on whitespace but keep the separators, so the Hebrew line has one slot
   per typed word and stays positionally aligned with what you typed. */
function padTokens(text) {
  return String(text).split(/(\s+)/).filter(p => p !== "").map(part => {
    if (/^\s+$/.test(part)) return { ws: true, raw: part };
    const core = part.replace(/^[^A-Za-z0-9']+/, "").replace(/[^A-Za-z0-9']+$/, "");
    const key = trNorm(core);
    return { ws: false, raw: part, core: core, key: key, cands: (key && TR_INDEX[key]) || [] };
  });
}

let padChoice = {};

function renderPad() {
  const tokens = padTokens(document.getElementById("padInput").value);
  const he = document.getElementById("padHe");
  he.innerHTML = "";
  let words = 0, known = 0;
  tokens.forEach((t, i) => {
    if (t.ws) { he.appendChild(document.createTextNode(" ")); return; }
    words++;
    const el = document.createElement("span");
    if (t.cands.length) {
      known++;
      const pick = Math.min(padChoice[i] || 0, t.cands.length - 1);
      el.className = "padword";
      el.textContent = t.cands[pick];
      if (t.cands.length > 1) {
        el.style.cursor = "pointer";
        el.title = t.cands.length + " possible words — click to cycle";
        el.dataset.idx = String(i);
      }
    } else {
      el.className = "padgap";
      el.innerHTML = "&nbsp;";
      el.title = t.core ? "not in your library: " + t.core : "";
    }
    he.appendChild(el);
  });
  document.getElementById("padCount").textContent =
    words ? words + " words \u00b7 " + known + " known" : "";
  padRenderActions(words - known);
}

function padGaps() {
  const seen = {};
  return padTokens(document.getElementById("padInput").value)
    .filter(t => !t.ws && t.core && !t.cands.length)
    .map(t => t.core)
    .filter(w => { const k = w.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; });
}

function padRenderActions(gapCount) { /* replaced in Task 5 */ }
```

- [ ] **Step 4: Run the test again**

Expected: all seven lines `PASS`.

---

### Task 4: Cycle ambiguous words

**Files:**
- Modify: `hebrew-reader.html` — add a click handler beside `renderPad()`

**Interfaces:**
- Consumes: `padChoice`, `renderPad`, `padTokens` (Task 3)
- Produces: click-to-cycle on `.padword` elements carrying `data-idx`

- [ ] **Step 1: Write the failing test**

```js
(function () {
  const out = [];
  const eq = (l, g, w) => out.push((g === w ? "PASS " : "FAIL ") + l + " got=" + g);
  const i = document.getElementById("padInput");
  i.value = "kore";
  i.dispatchEvent(new Event("input"));
  renderPad();
  const el = document.querySelector("#padHe .padword[data-idx]");
  eq("ambiguous word is clickable", !!el, true);
  const before = el.textContent;
  el.click();
  const after = document.querySelector("#padHe .padword[data-idx]").textContent;
  eq("cycles to a different word", before !== after, true);
  return out.join("\n");
})();
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `FAIL cycles to a different word got=false` — the element renders but clicking does nothing.

- [ ] **Step 3: Implement**

Insert immediately after `renderPad()`:

```js
/* Choices are held in memory only. Persisting them would mean keying a choice to
   a word position, and positions shift the moment you edit earlier in the line. */
document.getElementById("padHe").addEventListener("click", e => {
  const el = e.target.closest(".padword[data-idx]");
  if (!el) return;
  const i = Number(el.dataset.idx);
  const tokens = padTokens(document.getElementById("padInput").value);
  const n = (tokens[i] && tokens[i].cands.length) || 0;
  if (n < 2) return;
  padChoice[i] = ((padChoice[i] || 0) + 1) % n;
  renderPad();
});
```

- [ ] **Step 4: Run the test again**

Expected: both lines `PASS`.

---

### Task 5: Ask about the gaps — prompt, paste path, Pending

**Files:**
- Modify: `hebrew-reader.html` — replace the `padRenderActions()` stub; add a pad-specific paste handler

**Interfaces:**
- Consumes: `padGaps` (Task 3), `pendingAll`/`pendingSave`/`renderLibrary`/`todayISO`/`CATS`/`extractJSON` (all existing)
- Produces: `padAskPrompt() -> string`, `padIngest(data) -> number`, `#padAsk` button

**Why this does not reuse `renderAIWords()`:** that function calls `render()` and repaints the Translator page from its `words` array. Routing a two-word lookup through it would wipe the message currently on screen. The pad needs its own ingest that only touches Pending.

- [ ] **Step 1: Write the failing test**

```js
(function () {
  const out = [];
  const eq = (l, g, w) => out.push((g === w ? "PASS " : "FAIL ") + l + " got=" + JSON.stringify(g));
  const i = document.getElementById("padInput");
  i.value = "ani zzzalpha zzzbeta";
  i.dispatchEvent(new Event("input"));
  renderPad();
  eq("button appears", !!document.getElementById("padAsk"), true);
  eq("button names the count", /2 word/.test(document.getElementById("padAsk").textContent), true);
  const p = padAskPrompt();
  eq("prompt carries both gaps", p.indexOf("zzzalpha") > -1 && p.indexOf("zzzbeta") > -1, true);
  eq("prompt carries the sentence", p.indexOf("ani zzzalpha zzzbeta") > -1, true);
  const before = Object.keys(pendingAll()).length;
  const n = padIngest({ words: [{ hebrew: "\u05d1\u05d3\u05d9\u05e7\u05d4", translit: "bdika", english: "test", category: "Everyday things" }] });
  eq("ingest reports one", n, 1);
  eq("landed in pending", Object.keys(pendingAll()).length, before + 1);
  eq("did not touch library", !!libAll()["\u05d1\u05d3\u05d9\u05e7\u05d4"], false);
  return out.join("\n");
})();
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `FAIL button appears got=false`.

- [ ] **Step 3: Implement**

Replace the `padRenderActions()` stub with:

```js
function padRenderActions(gapCount) {
  const row = document.getElementById("padActions");
  row.innerHTML = "";
  if (gapCount > 0) {
    const ask = document.createElement("button");
    ask.className = "btn secondary";
    ask.id = "padAsk";
    ask.textContent = "Ask about " + gapCount + " word" + (gapCount === 1 ? "" : "s");
    ask.onclick = padAsk;
    row.appendChild(ask);
  }
  const aloud = document.createElement("button");
  aloud.className = "btn secondary";
  aloud.id = "padAloud";
  aloud.textContent = "Read aloud";
  aloud.onclick = padOpenAloud;
  row.appendChild(aloud);

  const keep = document.createElement("button");
  keep.className = "btn secondary";
  keep.id = "padKeep";
  keep.textContent = "Keep";
  keep.onclick = padKeep;
  row.appendChild(keep);
}

/* The whole sentence goes in as context so the answer comes back in the register
   George actually needs, not as a dictionary citation. */
function padAskPrompt() {
  const gaps = padGaps();
  const sentence = document.getElementById("padInput").value.trim();
  return "You are helping an English speaker learn to SPEAK Hebrew. He is composing a spoken " +
    "reply to an older relative (warm, casual, family register) and writes Hebrew in English letters.\n\n" +
    "His sentence so far:\n" + sentence + "\n\n" +
    "He does not know these words: " + gaps.join(", ") + "\n\n" +
    "Return ONLY valid JSON (no markdown fences, no commentary):\n" +
    '{"words": [{"hebrew": "...", "translit": "...", "english": "...", "category": "..."}]}\n' +
    "One entry per unknown word, in the order listed. translit = simple English-letters " +
    "pronunciation he can read aloud (e.g. \"shalom\", \"ma nishma\"). If the word changes by " +
    "speaker gender, give the masculine form (he is male). " +
    "category = exactly one of: " + CATS.join(", ") + ".";
}

async function padAsk() {
  const prompt = padAskPrompt();
  if (localStorage.getItem("hvr_geminikey")) { padAskGemini(prompt); return; }
  try {
    await navigator.clipboard.writeText(prompt);
    padStatus("Copied \u2014 paste into any AI chat, then click \u201cPaste answer\u201d.");
  } catch (e) {
    window.prompt("Copy this:", prompt);
  }
  padShowPasteBox();
}

/* Deliberately NOT renderAIWords(): that repaints the Translator page. */
function padIngest(data) {
  if (!data || !Array.isArray(data.words)) throw new Error("JSON is missing a \"words\" array.");
  const pending = pendingAll();
  const lib = libAll();
  let n = 0;
  data.words.forEach(w => {
    if (!w || !w.hebrew) return;
    const heb = String(w.hebrew).trim();
    if (!heb || !HEB.test(heb) || lib[heb]) return;
    if (pending[heb]) { pending[heb].seen = (pending[heb].seen || 0) + 1; return; }
    pending[heb] = {
      tr: String(w.translit || ""), en: String(w.english || ""),
      cat: CATS.indexOf(w.category) !== -1 ? w.category : "Uncategorised",
      seen: 1, added: todayISO()
    };
    n++;
  });
  pendingSave(pending);
  renderLibrary();
  return n;
}

function padStatus(msg) { document.getElementById("libStatus").textContent = msg || ""; }
function padShowPasteBox() { /* replaced in Step 5 */ }
function padOpenAloud() { /* replaced in Task 7 */ }
function padKeep() { /* replaced in Task 8 */ }
function padAskGemini() { /* replaced in Task 6 */ }
```

- [ ] **Step 4: Run the test again**

Expected: all seven lines `PASS`.

- [ ] **Step 5: Add the paste box**

Replace the `padShowPasteBox()` stub:

```js
function padShowPasteBox() {
  const row = document.getElementById("padActions");
  if (document.getElementById("padPaste")) return;
  const btn = document.createElement("button");
  btn.className = "btn secondary";
  btn.id = "padPaste";
  btn.textContent = "Paste answer";
  btn.onclick = () => {
    const raw = window.prompt("Paste the AI's reply here:");
    if (!raw) return;
    try {
      const n = padIngest(extractJSON(raw));
      rebuildTrIndex();
      renderPad();
      padStatus(n ? n + " word" + (n === 1 ? "" : "s") + " flagged in Pending \u2014 tick \u2713 to add." : "Nothing new to add.");
    } catch (e) {
      padStatus("Couldn't read that as JSON \u2014 paste the AI's full reply.");
    }
  };
  row.appendChild(btn);
}
```

- [ ] **Step 6: Verify the full round trip**

```js
(function () {
  const i = document.getElementById("padInput");
  i.value = "ani zzzgamma";
  i.dispatchEvent(new Event("input"));
  renderPad();
  const n = padIngest({ words: [{ hebrew: "\u05de\u05e0\u05d5\u05d7\u05d4", translit: "menucha", english: "rest", category: "Everyday things" }] });
  approvePending("\u05de\u05e0\u05d5\u05d7\u05d4");
  rebuildTrIndex();
  i.value = "ani menucha";
  i.dispatchEvent(new Event("input"));
  renderPad();
  return "ingested=" + n + " inLibrary=" + !!libAll()["\u05de\u05e0\u05d5\u05d7\u05d4"] +
    " gapsNow=" + document.querySelectorAll("#padHe .padgap").length;
})();
```

Expected: `ingested=1 inLibrary=true gapsNow=0` — the word round-tripped and the Hebrew line filled in.

---

### Task 6: Optional Gemini one-click

**Files:**
- Modify: `hebrew-reader.html` — replace the `padAskGemini()` stub; add a key field to Settings

**Interfaces:**
- Consumes: `padIngest`, `padStatus`, `padShowPasteBox` (Task 5), `extractJSON` (existing)
- Produces: working `padAskGemini(prompt)`, `#geminiKey` settings input, key `hvr_geminikey`

- [ ] **Step 1: Write the failing test**

```js
(function () {
  const out = [];
  const eq = (l, g, w) => out.push((g === w ? "PASS " : "FAIL ") + l + " got=" + g);
  eq("settings field exists", !!document.getElementById("geminiKey"), true);
  const realFetch = window.fetch;
  window.fetch = () => Promise.reject(new Error("offline"));
  localStorage.setItem("hvr_geminikey", "fake");
  const i = document.getElementById("padInput");
  i.value = "ani zzzdelta";
  i.dispatchEvent(new Event("input"));
  renderPad();
  return padAsk().then(() => {
    window.fetch = realFetch;
    localStorage.removeItem("hvr_geminikey");
    eq("falls back to paste box on failure", !!document.getElementById("padPaste"), true);
    return out.join("\n");
  });
})();
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `FAIL settings field exists got=false`.

- [ ] **Step 3: Add the settings field**

Inside the settings dialog, after the existing API key input:

```html
  <label>Gemini API key (optional, free — makes word lookup one-click)</label>
  <input type="password" id="geminiKey" placeholder="paste a free key from aistudio.google.com">
```

Wire it where the other settings inputs are loaded and saved:

```js
document.getElementById("geminiKey").value = localStorage.getItem("hvr_geminikey") || "";
```

and in the settings save handler:

```js
const gk = document.getElementById("geminiKey").value.trim();
if (gk) localStorage.setItem("hvr_geminikey", gk); else localStorage.removeItem("hvr_geminikey");
```

- [ ] **Step 4: Implement the call**

Replace the `padAskGemini()` stub:

```js
/* Free tier, no card. Any failure falls straight back to the copy-paste path —
   the pad must never be dead because a network call was. */
async function padAskGemini(prompt) {
  const key = localStorage.getItem("hvr_geminikey");
  padStatus("Asking Gemini\u2026");
  try {
    const resp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(key),
      { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const json = await resp.json();
    const text = json.candidates[0].content.parts[0].text;
    const n = padIngest(extractJSON(text));
    rebuildTrIndex();
    renderPad();
    padStatus(n ? n + " word" + (n === 1 ? "" : "s") + " flagged in Pending \u2014 tick \u2713 to add." : "Nothing new to add.");
  } catch (e) {
    padStatus("Gemini didn't answer (" + e.message + ") \u2014 use copy/paste instead.");
    try { await navigator.clipboard.writeText(prompt); } catch (e2) {}
    padShowPasteBox();
  }
}
```

- [ ] **Step 5: Run the test again**

Expected: both lines `PASS`.

---

### Task 7: Read-aloud overlay

**Files:**
- Modify: `hebrew-reader.html` — CSS after `.padrow`; markup beside `#editor`; replace `padOpenAloud()` stub

**Interfaces:**
- Consumes: `#padInput` (Task 2)
- Produces: `#readAloud` overlay, working `padOpenAloud()`, `padCloseAloud()`

- [ ] **Step 1: Write the failing test**

```js
(function () {
  const out = [];
  const eq = (l, g, w) => out.push((g === w ? "PASS " : "FAIL ") + l + " got=" + g);
  const i = document.getElementById("padInput");
  i.value = "ani rotze lalechet";
  i.dispatchEvent(new Event("input"));
  renderPad();
  padOpenAloud();
  eq("overlay visible", document.getElementById("readAloud").style.display, "flex");
  eq("shows the sentence", document.getElementById("readAloudText").textContent, "ani rotze lalechet");
  eq("no hebrew in overlay", /[\u0590-\u05FF]/.test(document.getElementById("readAloud").textContent), false);
  padCloseAloud();
  eq("closes", document.getElementById("readAloud").style.display, "none");
  eq("draft survives", document.getElementById("padInput").value, "ani rotze lalechet");
  return out.join("\n");
})();
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `TypeError` — `padOpenAloud` is still a stub and `#readAloud` does not exist.

- [ ] **Step 3: Add the CSS**

```css
  #readAloud { position: fixed; inset: 0; background: var(--bg); z-index: 60;
    display: none; align-items: center; justify-content: center; padding: 6vh 6vw; }
  #readAloudText { font-size: clamp(28px, 5.5vw, 60px); line-height: 1.55; text-align: center;
    max-width: 20ch; color: var(--fg); }
  #readAloudClose { position: absolute; top: 18px; right: 22px; }
```

- [ ] **Step 4: Add the markup**

Beside the `#editor` popup:

```html
<div id="readAloud">
  <button class="btn secondary" id="readAloudClose">Close</button>
  <div id="readAloudText"></div>
</div>
```

- [ ] **Step 5: Implement**

Replace the `padOpenAloud()` stub:

```js
/* An overlay, not a mode swap — the draft underneath is untouched, so closing
   returns you exactly where you were. */
function padOpenAloud() {
  document.getElementById("readAloudText").textContent = document.getElementById("padInput").value.trim();
  document.getElementById("readAloud").style.display = "flex";
}
function padCloseAloud() { document.getElementById("readAloud").style.display = "none"; }
document.getElementById("readAloudClose").onclick = padCloseAloud;
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && document.getElementById("readAloud").style.display === "flex") padCloseAloud();
});
```

- [ ] **Step 6: Run the test again**

Expected: all five lines `PASS`.

---

### Task 8: Keep drafts

**Files:**
- Modify: `hebrew-reader.html` — replace the `padKeep()` stub; add a drafts list under the pad body

**Interfaces:**
- Consumes: `#padInput`, `#padHe` (Tasks 2–3)
- Produces: `padKeep()`, `padDrafts()`, `padRenderDrafts()`, key `hvr_paddrafts`

- [ ] **Step 1: Write the failing test**

```js
(function () {
  const out = [];
  const eq = (l, g, w) => out.push((g === w ? "PASS " : "FAIL ") + l + " got=" + JSON.stringify(g));
  localStorage.removeItem("hvr_paddrafts");
  const i = document.getElementById("padInput");
  i.value = "ani rotze lalechet";
  i.dispatchEvent(new Event("input"));
  renderPad();
  padKeep();
  eq("saved one", padDrafts().length, 1);
  eq("saved the text", padDrafts()[0].text, "ani rotze lalechet");
  eq("saved the hebrew", /[\u0590-\u05FF]/.test(padDrafts()[0].hebrew), true);
  eq("listed in DOM", document.querySelectorAll("#padDrafts .paddraft").length, 1);
  i.value = "";
  i.dispatchEvent(new Event("input"));
  document.querySelector("#padDrafts .paddraft .restore").click();
  eq("restores into pad", document.getElementById("padInput").value, "ani rotze lalechet");
  document.querySelector("#padDrafts .paddraft .del").click();
  eq("deletes", padDrafts().length, 0);
  return out.join("\n");
})();
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `ReferenceError: padDrafts is not defined`.

- [ ] **Step 3: Add the CSS and markup**

CSS after `.padrow`:

```css
  .paddraft { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13px; border-top: 1px solid var(--border); }
  .paddraft .dtext { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .paddraft .dhe { color: var(--muted); font-size: 12px; direction: rtl; }
  .paddraft button { font-size: 11px; padding: 2px 6px; }
```

Markup — add inside `.padstrip-body`, after `#padActions`:

```html
      <div id="padDrafts"></div>
```

- [ ] **Step 4: Implement**

Replace the `padKeep()` stub:

```js
/* Separate from hvr_history on purpose: that holds messages received, this holds
   sentences produced. Merging comprehension and production would muddle both. */
const PAD_DRAFTS_KEY = "hvr_paddrafts";
function padDrafts() { try { return JSON.parse(localStorage.getItem(PAD_DRAFTS_KEY)) || []; } catch (e) { return []; } }
function padDraftsSave(v) { localStorage.setItem(PAD_DRAFTS_KEY, JSON.stringify(v)); }

function padKeep() {
  const text = document.getElementById("padInput").value.trim();
  if (!text) { padStatus("Nothing to keep yet."); return; }
  const drafts = padDrafts();
  drafts.unshift({ text: text, hebrew: document.getElementById("padHe").textContent.trim(), saved: todayISO() });
  padDraftsSave(drafts.slice(0, 50));
  padRenderDrafts();
  padStatus("Kept.");
}

function padRenderDrafts() {
  const box = document.getElementById("padDrafts");
  box.innerHTML = "";
  padDrafts().forEach((d, i) => {
    const row = document.createElement("div");
    row.className = "paddraft";
    const t = document.createElement("span");
    t.className = "dtext"; t.textContent = d.text; t.title = d.text;
    const h = document.createElement("span");
    h.className = "dhe"; h.textContent = d.hebrew || "";
    const r = document.createElement("button");
    r.className = "btn secondary restore"; r.textContent = "Use";
    r.onclick = () => {
      const inp = document.getElementById("padInput");
      inp.value = d.text; padSave(); renderPad();
    };
    const x = document.createElement("button");
    x.className = "btn secondary del"; x.textContent = "\u2715";
    x.onclick = () => { const all = padDrafts(); all.splice(i, 1); padDraftsSave(all); padRenderDrafts(); };
    row.append(t, h, r, x);
    box.appendChild(row);
  });
}

padRenderDrafts();
renderPad();
```

- [ ] **Step 5: Run the test again**

Expected: all six lines `PASS`.

---

### Task 9: Full regression and documentation

**Files:**
- Modify: `hebrew-reader.html` — update `.libnote`
- Modify: `README.md`
- Modify: `C:\Users\gwigh\.claude\projects\C--Users-gwigh-My-Drive--georgewight03-gmail-com--Hebrew-Learning\memory\hebrew-reader-app.md`

- [ ] **Step 1: Run the regression suite**

```js
(function () {
  localStorage.clear(); location.reload(); return "reloaded";
})();
```

Then, after reload:

```js
(function () {
  const out = [];
  const eq = (l, g, w) => out.push((g === w ? "PASS " : "FAIL ") + l + " got=" + JSON.stringify(g));
  document.getElementById("input").value = "\u05d0\u05e0\u05d9 \u05e8\u05d5\u05d0\u05d4 \u05d0\u05ea \u05d4\u05db\u05d3\u05d5\u05e8\u05d2\u05dc \u05d1\u05d8\u05dc\u05d5\u05d5\u05d9\u05d6\u05d9\u05d4";
  document.getElementById("readBtn").click();
  eq("translator still reads", document.querySelectorAll("#out .card").length > 0, true);
  setView("library");
  eq("pending block present", !!document.querySelector(".gblock.pending-block"), true);
  const r = [...document.querySelectorAll(".gblock")].map(b => b.getBoundingClientRect());
  let o = 0;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++)
    if (r[i].left < r[j].right - 1 && r[j].left < r[i].right - 1 && r[i].top < r[j].bottom - 1 && r[j].top < r[i].bottom - 1) o++;
  eq("no overlaps", o, 0);
  eq("export builds", (function () { try { buildXLSX(); return true; } catch (e) { return String(e); } })(), true);
  const i2 = document.getElementById("padInput");
  i2.value = "ani rotze lalechet";
  i2.dispatchEvent(new Event("input"));
  renderPad();
  eq("pad resolves after clear", document.querySelectorAll("#padHe .padword").length, 3);
  return out.join("\n");
})();
```

Expected: all five `PASS`.

- [ ] **Step 2: Update `.libnote`**

Append to the existing note text:

```
Use the <strong>Sentence pad</strong> below to build a reply — type the pronunciation and the
Hebrew fills itself in from your library. Words it doesn't know show as gaps you can ask about.
```

- [ ] **Step 3: Update `README.md`**

Add a section after "The Library — an Excel-style grid":

```markdown
## The Sentence pad

Under the Library grid is a pad for building the sentences you'll say back.

- **Type the pronunciation**, in normal English letters — `ani rotze lalechet`. No Hebrew
  keyboard needed.
- **The Hebrew builds itself** underneath, word by word, from your library.
- **Words it doesn't know show as gaps.** Click **Ask about N words** to copy a ready-made
  question, paste it into any free AI chat, and paste the reply back — the new words land in
  **Pending** for you to approve, and the gaps fill in. Add a free Gemini key in Settings
  (no card needed, from aistudio.google.com) and that becomes one click instead.
- **Read aloud** blows the sentence up full-screen with no clutter, for recording your voice note.
- **Keep** saves a finished sentence so you can reuse it later.

Some pronunciations mean more than one word (`kore` is both קורא *reads* and קורה *happens*) —
click the Hebrew word to cycle through the options.
```

- [ ] **Step 4: Update the memory file**

Append a "Seventh pass" section covering: the speaking-first reframe and why it inverted the app's direction; the reverse index and why normalisation must be shared between index and lookup; why `padIngest` exists rather than reusing `renderAIWords` (it calls `render()` and would repaint the Translator); ambiguity choices being deliberately in-memory; and the deferred tense-table findings pointing at the spec.

- [ ] **Step 5: Reset the sandbox**

```js
localStorage.clear(); location.reload();
```

---

## Self-review

**Spec coverage:** reverse index → Task 1. Pad location, markup, autosave, collapse → Task 2. Typed transliteration, auto-assembling Hebrew, amber gaps → Task 3. Ambiguity cycling → Task 4. Ask-about-gaps, prompt with sentence context, Pending deposit → Task 5. Optional Gemini upgrade with fallback → Task 6. Read-aloud overlay → Task 7. `hvr_pad` / `hvr_padopen` / `hvr_paddrafts` persistence and Keep → Tasks 2 and 8. `hvr_geminikey` → Task 6. Error handling — malformed JSON (Task 5 Step 5), failed network call (Task 6), all-unknown input (Task 3 renders empty, no error path needed). Regression and docs → Task 9. No spec section is unimplemented.

**Placeholder scan:** the four stubs (`padShowPasteBox`, `padOpenAloud`, `padKeep`, `padAskGemini`) are deliberate forward declarations, each replaced with complete code in a named later task, and each named here so a reader out of order can find its implementation. `renderPad` and `padRenderActions` are likewise stubbed in one task and fully written in the next. No step says "add error handling" or "write tests for the above" without the code.

**Type consistency:** `padTokens` returns `{ws, raw, core, key, cands}` in Task 3 and is destructured with those exact names in Tasks 4 and 5. `padIngest(data)` takes the same `{words:[{hebrew, translit, english, category}]}` shape the existing `renderAIWords` accepts, so a reply generated for either path parses in both. `padDrafts()` entries are `{text, hebrew, saved}` in Task 8's implementation and its test. `padStatus` writes to `#libStatus`, which already exists at hebrew-reader.html:283. `rebuildTrIndex()` is defined in Task 1 and called in Tasks 5 and 6 after Pending changes.

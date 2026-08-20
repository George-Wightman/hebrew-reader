# Word forms — a universal inflection model

**Date:** 2026-08-19
**Supersedes:** `2026-08-16-gender-pair-consolidation-design.md` (the `GENDER_PAIRS` approach)

## Problem

The Library's gender feature is a hand-written table of ~70 feminine→masculine pairs
(`GENDER_PAIRS`, hebrew-reader.html:2300) surfaced as a 9px "F" pill on the row. Against a
241-word library it is thin, arbitrary-looking, and structurally incapable of growing:

1. **Coverage is manual.** Only listed pairs can show the pill, and `genderPairFor()` drops
   even those when the feminine spelling isn't also in `DICT`. Hence the scattered badges.
2. **The data model holds exactly one extra form.** `.genderPair = {he, tr}` — a single
   untagged field. There is nowhere to put plural, tense, or person.
3. **There is no lemma concept.** Row keys are whatever surface form was sighted first:
   `ko'evet` (feminine present), `amarta` (2ms past), `siyamti` (1s past), `haya`/`yihiye`.
   For those rows "show the feminine" is not wrong, it is undefined.
4. **Four different relationships are flattened into one pill.** Adjective agreement
   (`gadol`/`gedola`), verb conjugation (`ohev`/`ohevet`), pronoun pairs (`hem`/`hen`),
   numerals that invert the rule (`shlosha`/`shalosh`), and lexical pairs
   (`chaver` friend → `chavera` *girlfriend*). The prior design coped by *excluding* the
   hard cases, which is why coverage is thin by construction.
5. **The toggle is inert.** In-memory, resets on the next render, per-row, unlabelled, no
   keyboard or screen-reader handling (hebrew-reader.html:4335).
6. **Clitic-prefixed entries leak in.** `lookupWord` only strips a prefix when the remainder
   is already in `DICT` (hebrew-reader.html:2462), so genuinely new words keep their ה/ב/ל.
   `stripPrefixEntry` exists (hebrew-reader.html:6038) but is called only from `padIngest`,
   never from the main harvest path. Result: `ha-izdamnut`, `ha-tochniyot`, `ha-milim`,
   `be-hafachim` are all sitting in the library as if they were words.

## Decisions taken

| Question | Decision |
|---|---|
| Primary job | **Production** — replying to voice notes and building sentences. Secondary: learning the pattern itself. |
| Paradigm depth | The forms you'd actually say: ~21 per verb, 4 per adjective. Not the complete paradigm. |
| Row identity | Re-base to the **dictionary form**, keeping a record of the form it was met in. |
| Layout | **No form controls on the row.** A lens in the Library header for breadth; a per-word panel for depth. |
| Lens reach | **Library grid + sentence pad.** Reading cards and drills untouched. |
| Trust | Show everything; anything not auto-verifiable goes through a further API pass. |
| Verification | **Best of three** — not "pass 2 wins". |
| Clitics | Never strip by rule. Ask the model, or ask George via Pending. |

## Data model

A library entry gains five fields; everything existing is unchanged.

```js
{ tr, en, cat, opp, seen, added, src, shelf,       // unchanged
  pos:    "verb",                                   // decides which axes are live
  root:   "ס־י־מ", binyan: "pi'el",                 // verbs only — this IS the pattern
  gender: null,                                     // nouns only: inherent, not a toggle
  forms:  { "inf":     {he:"לסיים",  tr:"lesayem"},
            "pres.ms": {he:"מסיים",  tr:"mesayem"},
            "pres.fs": {he:"מסיימת", tr:"mesayemet"},
            "past.1s": {he:"סיימתי", tr:"siyamti"} },
  formsMeta: { checked: "2026-08-19",
               src:   { "past.2fs": "manual" },     // manual entries are never overwritten
               state: { "past.2fs": "uncertain" } } }
```

### One tag vocabulary for everything

Form keys are flat strings: `tense.person+gender+number`. An adjective is the same map with
no tense segment (`ms`/`fs`/`mp`/`fp`). **`pos` decides which tags are populated; nothing
else in the code branches on part of speech.** That is what makes this universal rather than
gender-with-extras bolted on, and it is what lets tense arrive later without a schema change.

| pos | bank contents | count |
|---|---|---|
| `adj` | `ms fs mp fp` | 4 |
| `verb` | `inf`, `pres.{ms,fs,mp,fp}`, `past.{1s,2ms,2fs,3ms,3fs,1p,3p}`, `fut.{…same 7}`, `imp.{ms,fs}` | ~21 |
| `noun` | `sg`, `pl` + inherent `gender` field | 2 + 1 |
| `prep` | `1s 2ms 2fs 3ms 3fs 1p 2p 3p` (li / lecha / lach / lo / la / lanu / lachem / lahem) | ~8 |
| `pron`, `num` | gender × number | 2–4 |
| `adv`, `phrase` | none — carries `pos`, skipped by enrichment | 0 |

**Nouns do not inflect for gender, they have one.** `delet` is feminine, permanently; that
fact is what makes `delet gedola` right and `delet gadol` wrong. For a noun the lens changes
nothing — the gender is a label the *pad* uses to check agreement of neighbouring adjectives.

**Prepositions** are the sleeper win: `li`/`lecha`/`lach` is constant sentence glue and the
app has no model of it at all today.

### Storage

~120KB at 241 words (mean ~12 forms × ~40 bytes). No concern for `localStorage`. A size
guard logs a warning past ~1MB so growth to 1000+ words is noticed rather than discovered
as a quota exception.

### Reverse index

Every form's `he` and `tr` is indexed back to its lemma **with its tag**. This single index
replaces `GENDER_PAIRS` and `singularOf()` as the primary path for harvesting *and* powers
the pad, instead of three mechanisms that can drift apart. `GENDER_PAIRS`, `PLURAL_TO_SINGULAR`
and `singularOf()` remain as the offline fallback for words whose bank has not been generated
yet, and for a no-key install.

## Enrichment pipeline

### What is queued

Any library entry without a `forms` map — derived, not a stored list, so it self-heals. A
small `hvr_forms_q` store holds only what cannot be derived: calls spent today, and per-word
attempt counts. A word failing 3 times is parked, not retried forever, and says so in its panel.

### Triggers

- **Automatic** when 10+ bankless words accumulate, fired on idle after a render so it never
  blocks the UI.
- **Background backfill** of the existing 241, capped per session so it cannot dominate.
- **Manual** — a `fill in forms — 25 waiting` button in the Library header. A background
  process that cannot be seen or started is a background process that will not be trusted.

### Pass 1 — generate

10 words per call. Returns per word: `pos`, `root` + `binyan` (verbs), inherent `gender`
(nouns), the naked `lemma` with any attached `clitic` (see below), and the tagged form map
with transliterations. Structured JSON via the existing `extractJSON`.

### Free check — no API

Every returned form is tested against `DICT`/`PHRASES` (~700 words, many already inflected)
and against patterns the app can derive itself (adjective ה-suffix, ים/ות plurals). Matches
are marked `verified` at zero cost.

### Pass 2 — verify, by independent regeneration

Only still-unchecked forms. **Not** phrased as "is this correct?" — asking a model to check
its own output invites agreement. Pass 2 regenerates those forms cold, given only the lemma,
root and tag, and the app compares.

### Pass 3 — tiebreak, best of three

- Passes 1 and 2 agree → `verified`.
- They disagree → a third cold call; **the form appearing twice wins** → `verified`.
- All three differ → `uncertain`. Pass 1's answer is displayed; the app will not act on it.

**Tiebreaks are batched across the whole batch of 10 words** — every disputed form in one
call. Per-form calls would make cost unbounded.

**Temperature is left unset.** The app sets no `temperature`, so Gemini's default (~1.0)
applies and the three samples genuinely vary. Pinning it to 0 would return three identical
answers and a verification step that verifies nothing.

**Escalation:** a word where *several* forms split three ways almost always means pass 1 got
`pos` or `root` wrong. That flags the **word** for re-derivation rather than marking a dozen
forms uncertain individually.

Only `verified` forms feed the lens and the pad's agreement checking. `uncertain` forms are
displayed in the panel, visibly marked, but never acted on.

### Budget and rate limiting

Full 241-word backfill: ~25 generate + ~25 verify + ~5 tiebreak ≈ **55 calls of 500**.
Steady state: 10 new words ≈ 2 calls.

- **4s stagger between calls.**
- **The 429 handler must distinguish per-minute from per-day.** Today `geminiRequest`
  (hebrew-reader.html:5710) treats any 429 as "this model is spent", falls through every
  model and both keys, then reports *"daily free limit reached"*. It already parses the
  `retry in Ns` hint and uses it only to word the error. Fix: a short hint → wait and retry
  the same model; no hint or a long one → genuinely spent, move on. Without this a background
  queue burns both keys and lies about why.
- **Enrichment runs lite-only** (`GEMINI_MODELS_FAST`, the 500/day pool). It must never touch
  the 20/day `flash-latest` quota that audio transcription depends on.
- **Full thinking, not `minimal`.** That setting was measured for the pad's interactive
  latency (hebrew-reader.html:5626); a background queue has no latency budget to protect and
  morphology is where reasoning earns its keep.
- Per-session call cap and a daily ledger, so the pad and audio always have budget left.

### Degradation

No key, or quota dry: nothing breaks. Rows render exactly as today, the lens control is
**disabled with a visible reason** rather than silently absent, and the `GENDER_PAIRS`
fallback still covers its ~70 pairs.

### Provenance

`formsMeta.src` per form: `dict` | `ai` | `manual`. Anything George edits in the panel is
`manual` and no later pass overwrites it — the same contract `hvr_userdict` already gives his
translation corrections.

## Clitic prefixes

Entries like `ha-izdamnut` (ההזדמנות) are mis-harvested and should not be in the library.
But **no code rule can decide this**, because these are indistinguishable by shape:

| entry | strip? | why |
|---|---|---|
| `ha-izdamnut` ההזדמנות | **yes** | ה + הזדמנות |
| `be-hatslakha` בהצלחה | **no** | Stripping gives הצלחה, "success" — not "good luck". Fixed expression. |
| `lehagid`, `lishloakh`, `lirot` | **no** | That ל is part of the infinitive, not a clitic. |

All three are single words starting with a clitic letter whose transliteration carries the
prefix — `stripPrefixEntry` would strip all three. Only the *meaning* separates them, which
the model sees and a regex does not.

**Therefore:**

1. **Pass 1 returns the naked `lemma` and the attached `clitic`**, judged from the Hebrew
   *and* the gloss. Same best-of-three verification as any other claim: a disagreement leaves
   the word alone rather than silently re-keying it.
2. **Prevention without a guessing rule.** When `lookupWord` fails on a word beginning with a
   clitic letter, it goes to Pending *with a suggestion* — "looks like ה + הזדמנות — add as
   הזדמנות?" — accept or keep whole, one click. Pending is already the review queue.
   `stripPrefixEntry` is **not** wired into `cardEntry`; it would introduce a new class of
   error (בהצלחה → "success") in exchange for fixing an old one.
3. **Re-basing reuses the re-key helper** below, including the merge case: `ha-milim` →
   `milim` → `mila`, where `mila` may already exist, so it merges rather than renames — the
   pattern `syncGender` established (hebrew-reader.html:6689).

## Interface

### The lens

George's own gender is a **setting**, not a toggle — set once in Settings, drives every
1st-person form. The lens is the other half, sitting with zoom and Hebrew-size in the Library
header:

`— (dictionary) · ♀ to her · ♂ to him · ⚥ to them`

It selects which slot of each bank the grid displays, with a per-`pos` fallback chain so a
word with no such slot (a noun) simply does not move. Default `—` renders the citation form,
so nothing changes until it is opted into.

While a lens is active the **grid is tinted and the header carries a `reading in ♀` chip** —
a signal on the container, not on 241 rows. This is not only tidiness: without it, `gedola`
would be memorised as the dictionary form.

Persisted, like `hvr_gridzoom` and `hvr_hemode` — it is a working preference, not a view state.

### The panel

Opens from ✎, which stops being "edit" and becomes "open this word".

- Lemma large in RTL, transliteration, English, `pos`.
- Root and binyan shown **as the pattern** (ס־י־מ in pi'el) — the thing to be learned.
- The form grid: **person down, tense across.** Each cell shows Hebrew, transliteration, its
  verification state, and plays audio on click via the existing `playHe`.
- The edit fields, the star, retire, and delete all move here.
- The note: *"you met this as siyamti."*

### The row

```
NOW      ● gadol  big  גדול  [F]                    ☆ ↓ 🔊 ✎ ✕
PROPOSED ● gadol  big  גדול                              ↓ 🔊 ✎
```

The `.gtoggle` pill is removed entirely and nothing replaces it — at universal coverage it
would be 241 permanently-visible 9px controls. The star and delete move into the panel; the
star's *visual* marking on the row (bold + accent edge, hebrew-reader.html:507) is unchanged,
as are its Learn-queue priority (hebrew-reader.html:8524) and bulk-retire protection
(hebrew-reader.html:3207). Dropping from five buttons to three is what buys the target size.

### Accessibility

Held as a requirement, not a polish pass:

- Panel is a real `role="dialog"` `aria-modal` with a focus trap, Esc to close, and focus
  returned to the ✎ that opened it.
- The form grid is a real `<table>` with `<th>` row and column headers, so a screen reader
  announces *"past, second person feminine — siyamt"* rather than a wall of divs.
- The lens is a labelled `radiogroup` — icons **plus** text, never icon-only.
- Verification state never rides on colour alone: glyph or text plus `title`.
- Row buttons clear the 24px WCAG 2.5.8 minimum (three buttons, not five).
- Grid rows become focusable, Enter opens the panel — closing an existing gap, since the
  Library is mouse-and-drag only today.
- A lens change announces via `aria-live="polite"` and respects `prefers-reduced-motion`.

## The re-key helper

One function, used by both the clitic cleanup and the lemma re-basing. Renaming a library key
must carry **every** reference to it:

`hvr_library` · `hvr_srs` · `hvr_focus` · `.opp` partners · `hvr_aliases` · `hvr_known` ·
`hvr_archive` · `hvr_struggle` · `hvr_path*` · **and the IndexedDB audio blob**, keyed by the
Hebrew string (hebrew-reader.html:6994).

That last one is the easy one to miss: re-key without it and every cached recording is
silently orphaned.

Merge-into-existing is a first-class case, not an error: sum `seen`, keep the richer gloss,
prefer the older `added`.

## Migration

Verbs cite to the **infinitive** — which most verb rows already use (`lishloakh`, `lehagid`,
`ledaber`, `lihyot`), so fewer rows move than the row count suggests.

Both migrations **dry-run first** and present the full list of re-basings for a single
confirm. Gated on a version key like every other migration in the file, and only writing when
something actually changed.

## Phases

Ordered so the destructive work runs last, on data that has been in use for weeks.

| | Contents | Risk |
|---|---|---|
| **1** | Data model · enrichment pipeline · best-of-three verification · read-only panel · 429 fix · **re-key helper, proven on the ~10 clitic rows** | Additive; existing behaviour untouched |
| **2** | Lens · row cleanup (pill removed, 3 buttons) · accessibility pass | Visual, reversible |
| **3** | Pad integration — full-form reverse index, agreement flagging against the lens | New behaviour on a proven index |
| **4** | Lemma re-basing (~40 rows), reusing the phase-1 helper unchanged | Destructive |

Phase 1 is useful standing alone: verified form banks that can be opened and read, with
nothing else in the app changed. Building the re-key helper in phase 1 and proving it on ten
rows already known to be wrong, before pointing it at forty that matter, is the reason for
that ordering.

## Out of scope

- **A conjugation drill type.** Testing forms directly in Learn is a natural follow-on but
  needs its own SRS scheduling and deserves its own pass.
- **Annotating reading cards** with form information. The translator is the calmest page in
  the app; it stays that way.
- **The complete paradigm** — rare persons (אתן/הן in every tense), construct forms,
  possessive suffixes. The tag vocabulary can hold them; nothing generates them.
- **Replacing `DICT`.** It keeps both spellings of everything, unchanged — the offline reader
  depends on it and on a no-key install it is all there is.

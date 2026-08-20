# Sentence Pad — Design

**Date:** 2026-08-05
**Status:** Approved, building
**Adds to:** `2026-08-03-excel-grid-design.md` (Library UI, unchanged by this)

## Why

The app's stated purpose has been sharpened: it exists to help George learn to **speak**
Hebrew. The real workflow is a loop — his partner's grandad sends voice notes, George
transcribes them, reads them here, composes a reply, and **records that reply as a voice
note back**. Reading Hebrew script matters, but later and less.

Everything built so far runs one direction: **Hebrew → English**. Comprehension. The
composing half of his actual loop — **English → Hebrew, with a pronunciation he can perform
out loud** — has no support in the app at all. That is the gap this closes.

The pad is therefore not a notes box. It is a **pronunciation script**: its output is a
line of text George reads aloud into a recording.

## Decisions

| Question | Decision |
|---|---|
| Where it lives | Collapsible strip along the bottom of the Library page — not a third view |
| What you type | Transliteration, Latin characters, LTR — no Hebrew keyboard needed |
| Hebrew line | Assembled automatically by reverse-lookup; never typed by hand |
| Unknown words | Highlighted amber, and they *are* the lookup batch |
| Word lookup | Copy-prompt / paste-result round trip; free Gemini key is an optional upgrade |
| Paid API | Ruled out — no per-call charges |
| Tense table | Deferred, not cancelled (see Deferred work) |
| Grammar checking | Out of scope — unreliable, and a wrong correction is worse than none |

## Architecture

### Reverse index

Built once at page load from `DICT` plus the live library: `transliteration → [hebrew, ...]`.
About 1,000 entries; construction is milliseconds and nothing is persisted.

Two complications the builder must handle:

- **Slash pairs.** The dictionary stores paired gender forms in one entry
  (`"רוצה":["rotze/rotza", ...]`). Split on `/` and index each side separately.
- **Normalisation.** Transliteration is not a fixed orthography, so matching is normalised
  rather than exact: lowercase, strip apostrophes and hyphens, fold `kh`→`ch`, `q`→`k`,
  `tz`→`z`, and collapse doubled letters. Both index keys and typed input pass through the
  same normaliser, so the index cannot drift from the lookup.

**Clitic prefixes (added during implementation).** The first real test sentence exposed a gap
the design missed: `la'avoda` failed to resolve even though `avoda` was in the library, so
every prefixed word became a **false gap** and would have burned lookups on words already
owned. The reading direction has always stripped ו/ה/ב/ל/מ/ש/כ; the writing direction needs the
mirror image. `padLookup()` tries the whole word first, then strips a typed prefix
(`she/ha/la/le/li/ba/be/bi/ka/ke/ma/me/mi/ve/u`, longest first) and re-looks-up the remainder,
prepending the Hebrew letter to the result. Stripping happens on the **raw** text before
`trNorm`, because normalising first collapses `la'avoda` → `lavoda` and destroys the prefix
boundary. Whole-word-first ordering is what stops `lechem` being mis-split into ל+חם.

**Ambiguity is expected, not an error.** One normalised transliteration can map to several
Hebrew words (`kore` → קורא *reads* / קורה *happens*). The index stores a list; the pad
renders the first candidate and makes the slot clickable to cycle through the rest. The
chosen index per position is held **in memory only** and resets to the first candidate on
reload — deliberately, since persisting it would mean keying choices to word positions that
shift as the draft is edited, which breaks more often than it helps.

### The pad

A single `<textarea>` for transliteration. Below it, a live-rendered RTL Hebrew line, one
slot per typed word:

- **Known word** → its Hebrew, in the same type size the Library grid uses.
- **Unknown word** → an empty slot with a dotted amber underline, and the source word
  highlighted amber in the transliteration line above.

Amber is deliberate reuse: unrecognised words on the Translator page and the Pending block
already use `--unknown-bg` / `--unknown-border`. "The app doesn't know this" must look
identical everywhere in the app.

Re-render is debounced on input. The Hebrew line is display-only — never editable directly,
which is what keeps the two lines incapable of desynchronising.

### Asking about gaps

The **Ask about N words** button is enabled whenever the draft contains unknown words. It
builds a prompt containing only those words, plus the full draft sentence as context so the
answer comes back in the right register rather than as a dictionary citation.

Two paths, same button:

1. **Round trip (default, zero setup).** Copies the prompt. George pastes it into whatever
   free AI chat he has open, pastes the reply back into the existing paste-result box. This
   reuses the app's existing copy-prompt/paste-result machinery rather than adding a second
   mechanism.
2. **One click (optional).** If a Gemini API key is present in Settings, the same button
   calls the API directly and skips the tab dance. Google AI Studio's free tier requires no
   credit card (1,500 requests/day, Gemini 2.5 Flash) and George's usage would be a handful
   of lookups per session. Absence of a key is the normal case, not an error state.

Either way the returned words land in **Pending**, not straight into the library — the
approval workflow built on 2026-08-05 already governs every other way words arrive, and
lookups are no exception. Ticking ✓ adds the word, and the pad's Hebrew line fills in that
slot on the next render.

This is the loop that justifies the feature existing in the app at all rather than George
simply asking Gemini in a browser tab: **the answer is captured**. Over months the offline
dictionary grows from sentences he actually tried to say.

### Read-aloud view

A full-screen overlay (not an inline mode swap, so the pad's state is untouched underneath)
showing large transliteration on a clean background — no Hebrew, no chrome, no controls —
for the moment of recording. Escape or a close button dismisses it. Nearly free to build
once the pad exists, and it is the single feature that most directly serves speaking.

### Persistence

| Key | Holds |
|---|---|
| `hvr_pad` | Current draft text, autosaved on input (debounced) |
| `hvr_padopen` | Whether the bottom strip is expanded |
| `hvr_paddrafts` | Kept sentences: `[{text, hebrew, saved}]` |
| `hvr_geminikey` | Optional Gemini API key. Absent by default; absence is the normal case |

**Keep** saves the finished sentence to `hvr_paddrafts` so sentences already sent to grandad
can be reread and reused. Kept drafts list under the pad, newest first, each restorable into
the pad or deletable. This is separate from `hvr_history`, which holds *received* messages —
the two must not be merged, as one is comprehension and one is production.

## Error handling

- **No known words at all** (e.g. typing English) — Hebrew line renders all-empty. This is
  correct behaviour, not an error; the gap count communicates it.
- **Paste-result JSON malformed** — reuse the existing paste handler's error path, which
  already reports parse failures without discarding the draft.
- **Gemini call fails** (bad key, offline, rate limit) — fall back to the copy-prompt path
  with a status message. The pad must never become unusable because a network call failed.
- **Draft lost** — autosave is debounced, so a crash can lose at most the last keystrokes.
  Acceptable; a synchronous write per keystroke is not.

## Testing

Exercised in the sandboxed preview browser, as with prior rounds:

1. Reverse index built across the full dictionary — spot-check known slash-pairs split
   correctly, and that entry count is plausible against `DICT` size.
2. Normaliser against deliberately sloppy input (`rotzeh`, `ro'tze`, `ROTZE`, `rotzze`)
   — all must resolve to רוצה.
3. Ambiguity cycling — `kore` offers both קורא and קורה, and the choice sticks per position.
4. Gap detection — counts match the highlighted words exactly.
5. Autosave survives reload; `Keep` round-trips a draft through `hvr_paddrafts`.
6. Full loop: type a sentence with unknown words → ask → paste result → Pending → approve →
   the Hebrew slot fills.
7. Regression: Library grid, drag-to-recategorise, drag-to-pair, XLSX export, and block
   geometry all unaffected by the strip being present or expanded.

## Out of scope

- **Grammar or word-order checking.** Cannot be done reliably offline, and an incorrect
  correction actively teaches the wrong thing.
- **Paid API integration.** Ruled out by cost.
- **Editing the Hebrew line directly.** It is derived state; making it editable reintroduces
  the desync problem the design exists to avoid.
- **A third top-level view.** The pad belongs beside the library, not instead of it.

## Deferred work — the tense table

Researched and deliberately shelved, recorded here so the findings are not lost.

**It is feasible, and cheaper than it looks.** `DICT` already holds ~427 verb-form entries
which are forms of only ~50 distinct verbs — `הלך / הלכתי / ילך / ללכת / הולך / הולכת` sit
there as unrelated flat entries. Grouping them by lemma is a *linking* job with
hand-verified transliterations already written, not a generation job.

**What is not feasible is generating new forms by rule.** In unvocalised Hebrew the
consonants barely change (ילד→ילדים, ספר→ספרים), so a rule-based generator would produce
correct-looking script. But the irregularity lives in the **vowels, which are not written** —
and George works in transliteration, where *yeled→yeladim*, *sefer→sfarim*,
*melech→melachim* diverge sharply. A generator would be right in the half that matters least
and wrong in the half that matters most.

**Nothing off-the-shelf fills the gap.** Pealim, Cooljugator and Reverso are proprietary
with no open data. The serious open modern-Hebrew tooling (DictaBERT, AlephBERT, Hspell) are
**analysers, not generators** — they identify a form rather than produce a paradigm — and are
multi-hundred-megabyte models requiring Python. `morphhb` on npm is *biblical* Hebrew.
Nothing is embeddable in a single self-contained HTML file.

**Conclusion:** if built, it should present *the forms already in the dictionary*, grouped by
verb — accurate, bounded, and honest about its edges — rather than attempting to conjugate.
It is a studying tool, and studying is second to speaking, so it waits.

Note also that the sentence pad absorbs much of its practical value: "how do I say *we
went*" is a tense question, and the lookup answers it on demand.

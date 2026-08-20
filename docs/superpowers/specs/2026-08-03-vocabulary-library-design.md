# Vocabulary Library — Design

**Date:** 2026-08-03
**Status:** Approved, building
**Extends:** `2026-07-22-hebrew-reader-design.md`

## Purpose

George keeps a hand-built vocabulary spreadsheet (`Other/Hebrew Table.xlsx`) that he uses
to compose Hebrew replies. It is transliteration-only, organised as themed blocks laid out
side-by-side. He wants the reader app to grow that resource automatically from the messages
it processes, instead of him maintaining it by hand.

## Source analysis — `Hebrew Table.xlsx`

Sheet `Word Pairs` (sheet `Weather` exists but is empty). Themed blocks separated by blank
spacer columns:

| Block | Cols | Notes |
|---|---|---|
| Opposites | A–D | 4-wide: `term|meaning|opposite|meaning` |
| Weather (*Mezeg Avir*) | F–G | sun, wind, rain, snow, cloud, seasons, sky, sweat |
| Time | I–J | units + full question phrases; several Hebrew cells left blank |
| Flavours (*Taham*) | L–M | sweet, sour, salty, bitter |
| Loose ends | O–P | *naim*, *ceemat*, *meyod*, *avoda*, *mischak* |

~90 entries. **No Hebrew script anywhere** — the table only works for composing, not reading.
Transliteration uses George's own phonetic scheme (`Rooach`, `Caitz`, `Shamym`, `Melechutz`),
which differs from the app's.

## Decisions

| Question | Decision |
|---|---|
| Relationship to existing file | Seed from it once, then grow; export a combined file |
| What gets added | Content words automatically (stoplist skips ~40 grammar words) + manual ⊕ |
| Seeded spellings | Normalised to the app's scheme; Hebrew script reconstructed and added |
| Export layout | One `.xlsx`, two sheets: *Browse* (themed blocks) + *All Words* (sortable rows) |
| In-app UI | Full searchable panel with edit/delete |

## Architecture

### Store

`localStorage` key `hvr_library`, keyed by **Hebrew** word (so seeded and newly-read entries
merge into the same slot):

```js
"רוח": { tr:"ru'ach", en:"wind", cat:"Weather", seen:3,
         added:"2026-08-03", src:"seed"|"auto"|"manual", opp:"" }
```

Keying on Hebrew rather than transliteration is what makes the merge work.

### Categories

`DICT` is refactored from one flat object into named per-category consts, merged at startup
into `DICT` plus a parallel `CAT` lookup. Entries themselves are untouched by the refactor.

Fourteen categories: Greetings · Question words · Verbs · People & family · Everyday things ·
Food & drink · Weather · Time & dates · Places & travel · Work & study · Sport & media ·
Feelings & health · Describing words · Slang & phrases. Plus **Uncategorised**.

- Known words carry their category for free.
- AI modes get `category` added to the JSON schema, so AI-glossed words arrive categorised.
- Offline-unknown words land in Uncategorised and are fixed in the panel.

### Harvest

Hook `render()`. For each content card: skip if in `STOPLIST`; otherwise upsert into the
library and increment `seen`. Every card also gets a ⊕ control to force-add.

### Seed

George's ~90 entries are reconstructed (Hebrew + normalised transliteration + category +
opposite-pairing) and baked into the app as a `SEED` constant, loaded on first run. Blank
Hebrew cells in his Time block (minute/hour/day/week/month) are filled in.

### Panel

Collapsible section below "Saved messages": search box, category filter, sortable list,
per-row ✎ edit / ✕ delete, Export button. Edits write through to the same personal-dictionary
mechanism used by click-to-fix.

### Export

Minimal XLSX writer in vanilla JS — store-only ZIP + CRC32 + OOXML with inline strings
(~150 lines, no dependencies, app stays single-file). Output `Hebrew Vocabulary.xlsx`:

- **Sheet 1 `Browse`** — themed blocks side by side, spacer columns between, in George's style.
- **Sheet 2 `All Words`** — `Hebrew | Pronunciation | English | Category | Seen | Added`.

## Known limits (stated, not worked around)

- **No auto-sync to Drive.** A local HTML page cannot silently write a file; export is a
  one-click download.
- **Opposites do not auto-pair.** The pairing in George's table encodes a relationship, not a
  category. Seeded pairs are preserved and common pairs are hand-curated into the dictionary;
  a new adjective arriving from a message will not find its opposite automatically.

## Non-goals

Flashcards / spaced repetition; English→Hebrew composition assistance; Drive sync.

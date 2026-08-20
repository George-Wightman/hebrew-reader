# Gender-pair consolidation — design

**Date:** 2026-08-16
**Problem:** the Library shows masculine and feminine forms of the same word as two
separate rows (e.g. `גדול`/`גדולה` "big"/"big (f)", `עייף`/`עייפה` "tired (m)"/"tired (f)").
George wants one entry per word, with an interface to view both gendered forms — not
duplicate listings. This is the same shape of problem the sixth pass solved for plurals
(`singularOf()` / `PLURAL_TO_SINGULAR`), extended to gender, and covering adjectives,
verbs, pronouns, and numbers (per explicit confirmation — broader than adjectives alone).

## Data model

**`GENDER_PAIRS`** — an explicit `{ feminineHebrew: masculineHebrew }` map, hand-built
from the pairs already tagged `(m)`/`(f)` in `DICT`'s English glosses. Explicit, not
suffix-derived: Hebrew feminine markers vary by pattern (adjectives usually add ה, most
verb participles add ת, some add ה), so a generic heuristic risks a wrong silent merge.
This mirrors `PLURAL_TO_SINGULAR`'s own reasoning, just with no reliable general case to
fall back to — `GENDER_PAIRS` is the whole rule, not an override list for exceptions.

`DICT` keeps **both** Hebrew spellings as separate keys, unchanged — the offline reader
must still recognise either form appearing in a real message, exactly as plurals already
work (`DICT` keeps both forms for translation; only the *library row* consolidates).

**`genderBaseOf(word)`** looks `word` up in `GENDER_PAIRS` and returns the masculine key,
or `null`. Used in `cardEntry()` alongside `singularOf()` — try `singularOf()` first, then
`genderBaseOf()` — so a feminine sighting (harvest, ⊕ button, pad ingest) files under the
existing masculine library row instead of creating a new one.

Library entries gain one new field: **`.genderPair: {he, tr}`**, holding the feminine
spelling and pronunciation, set when a feminine sighting first files under the masculine
row (or by the migration below for words already known). Entries with no known feminine
form simply don't have this field.

## Excluded from auto-merging

Left as separate, untouched entries — merging these would trade a display duplicate for
real ambiguity, which is worse:

- **את** — also the object-marker particle, not just "you (f)". Merging would blur two
  unrelated grammatical roles into one toggle.
- **אוכל / אוכלת, מספר / מספרת** — the masculine side is already a noun/verb homograph
  ("food/eat(s)", "number/tell(s)"); attaching the feminine verb form would make the
  combined row imply the noun sense has a feminine form too.
- **זה / זאת / זו** — three-way, and זה is also used as gender-neutral "it".
- **Ambiguous future-tense conjugations** (תהיה, תרצה, תוכל, אראה, תראה, ארצה, תרצי, and
  siblings) — these encode grammatical *person* (you vs. she) as well as gender, so
  pairing by gloss text alone would conflate two different people, not two forms of one.

Everything else — adjectives, regular present/past-tense verbs, אתם/אתן, הם/הן, numbers
including the teens, מישהו/מישהי, אמור/אמורה, etc. — merges. Roughly 70 pairs.

## UI

Both `buildWordRow` **and** `buildOppSideEl` get a small "M/F" pill, shown only when
`.genderPair` is present on the entry. (Both builders, deliberately — this exact spot
is where three earlier per-word features quietly went missing from the opposites-lane
half, per prior passes on this file. A gendered word that happens to be in an opposites
pair must not lose its toggle.)

Clicking the pill swaps that row's displayed `.gtr`/`.ghe` text between the masculine
(default) and feminine form, in place — no re-render, no new persisted store. State is
in-memory only and resets to masculine on the next render or reload, matching the chosen
default.

## Migration

**`syncGender()`** — one-time, gated on `hvr_genderfix_v1`, run after `libSeedIfNeeded()`
(and after any other key-touching migration already in the boot sequence, to avoid
ordering conflicts with a still-in-flight rename). For every pair in `GENDER_PAIRS`:

- If both the masculine and feminine keys currently exist as separate library rows,
  merge into the masculine row: sum `seen`, prefer whichever side has non-blank `tr`/`en`
  if one is missing, set `.genderPair` from the feminine side, repoint any `.opp` /
  `hvr_focus` mark / `hvr_aliases` entry that pointed at the feminine key onto the
  masculine key (same repointing pattern `syncPunctuation` already established for
  renames), then delete the feminine row.
- If only the feminine key exists as a library row (masculine never harvested), migrate
  it: rename the row's key to the masculine spelling, keep its data, and set
  `.genderPair` to the feminine `{he, tr}` pulled from `DICT`.
- If only the masculine key exists, nothing to merge — just backfill `.genderPair` from
  `DICT` if the feminine form exists there.

Only writes if something actually changed (no unconditional save over an unmigrated
store — the same rule learned from the seventh-pass seeding-order bug).

## Out of scope

No manual "pair these two words" UI is being built for the excluded list — those stay as
two ordinary rows, same as today. If George wants any of them merged by hand later, that
would need its own small feature (there's no rename-a-key path in the editor currently).

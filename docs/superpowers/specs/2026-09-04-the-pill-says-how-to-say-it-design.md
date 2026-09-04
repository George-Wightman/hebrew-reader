# The pill already said what it means; now it says how to say it

## Where this came from

George, in chat, looking at a screenshot of the "What you bought" node sheet — circling
the word pills and the "TO MAKE THIS ONE GOLD" box:

> In hte nodes and coach boxes can you add the anglecised hebrew please. I like thati ts
> the hebrew itself but hte anglecised would be useful, Even if small, dont want to
> overload the UI.

## What already exists

Every word already carries a `.tr` field — the transliteration, built to the fixed scheme
in `CLAUDE.md` (`kh` for ח/כ, joined prepositions, apostrophe-before-vowel, `ve-` not
`u-`/`va-`). The reading cards elsewhere in the app (`.card`) already show it: small,
italic, accent-teal, directly under the Hebrew. This is a display change in two more
places, not a new transliteration source or a new scheme.

## The design

Two places, both on the node sheet (`campOpenNode`, `hebrew-reader.html`), both additions
to markup already being built there — nothing new is fetched or computed beyond a lookup.

**Word pills** (`campWordRow`, the `.cw` spans). Insert the transliteration inline,
between the Hebrew (`<b dir="rtl">`) and the English gloss (`<u>`), styled exactly like
`.card .tr` — small, italic, accent-teal — so it reads as the same convention already
established elsewhere in the app rather than a new one.

**The gold box** (`.pp-goldsay`'s "Still to say" line, and the `.pp-goldlist` band rows).
Each bare Hebrew word gets its transliteration appended in small, muted parentheses,
*inside* the same `<b dir="rtl">` wrapper so the existing bidi-isolation fix for a Hebrew
word inside an English sentence (see the comment at the top of the node-sheet CSS) is not
disturbed.

**Lookup.** One small helper, `campTrFor(k, lib)`: `lib[k].tr` first, falling back to
`DICT[k][0]` — the exact fallback pattern already used one line away for the English gloss
(`e.en || (DICT[k] ? DICT[k][1] : "")`). If neither has it, nothing is shown: no empty
parens, no placeholder text.

**Left alone: `.pp-carry`** ("Also uses X, Y from earlier"), same node sheet, same
bare-Hebrew-word pattern. Not named in the request and not circled in the screenshot —
deliberately out of scope for this round.

## Testing

- `campTrFor` returns the library's `.tr` when the word is in it.
- Falls back to `DICT[k][0]` when the word isn't in the library but is in the dictionary.
- Returns `""` when neither has it, and the caller omits the markup rather than printing
  empty parens or italics.

## Deferred, with reasons

**`.pp-carry`.** Confirmed out of scope for this round in the design conversation —
revisit if it starts to read as an inconsistency once this ships.

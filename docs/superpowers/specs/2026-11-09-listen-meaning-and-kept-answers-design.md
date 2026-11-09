# Listen cards get marked on meaning, and every card keeps what he said

## Where this came from

His flag on 8 November, on the listen card יום אחד אני רוצה לנסוע לעיר:

> "I think how these are marked needs a bit of redoing like I didn't get this. Perfect. I got it close now so I don't really know how to change the mark on it"

And in chat on 9 November:

> "My problem was that I got most of the words right, but I got a bit of the meaning wrong … there didn't seem to be a way to really review it. In the moment, it doesn't seem like a big deal, but for my progress over the long term, I think it'd be important to make sure that it's accurate."

> "keep what I said. Is that how we do it for all the other ones as well? … so that later down the line you can come in, when we do those longer term reviews, see where I'm making those constant errors."

## What the code does today (checked)

- **A listen card is never marked on what he said.** `matchMeaning` suggests "Got it" only when his English matches the model answer exactly. Otherwise it suggests nothing, and every chip starts at "got it" (`learnMarks = learnCardTokens.map(() => 0)`). The flagged card banked יום, רוצה and נוסע at grade 2, with no `sg` field: nothing had judged it.
- **His answer is mostly thrown away.**
  - On listen cards it is kept nowhere: `learnNote` is "never persisted".
  - Word and chunk cards keep 40 characters of the transcript (`sd`).
  - Sentence cards keep only what landed in a missed word's slot (`hd`).
  - So "where does he keep going wrong" can only be answered for single words.

## Phase 1 — the meaning check

When a listen card is revealed and his English is not an exact match, one Gemini call (`GEMINI_MODELS_FAST`, Flash-Lite first, 500 a day) gets four things: the Hebrew, its transliteration, the model English and his answer. It returns:

- a mark for each Hebrew word: `got`, `nearly` (he had the word but not quite the sense) or `missed`;
- one short `note`, only when his meaning differs, saying where it differs ("you said *today*; it's *one day*");
- an overall `grade` for cards without chips.

The rules for applying it:

- **It suggests; it doesn't decide.** The marks fill the chips the way the mic's alignment does on sentence cards. They are recorded as `learnMarksAuto`, so the existing `sg`/`ov` fields record whether he changed them. A chip he has already tapped is never overwritten.
- **A paraphrase with the same meaning counts as "got it".** The prompt says so explicitly, because word overlap was rejected earlier for exactly this reason.
- **While it waits,** the line under his frozen answer reads "Checking your meaning…". It then shows the note, or "Same meaning."
- **If it fails, is offline, or arrives after he has moved on,** nothing changes and the card behaves exactly as it does today. The staleness guard is the card index plus the item id.

Only `listen` gets the check. `note` (voice notes) is dormant.

## Phase 2 — every card keeps what he said

Each journal card row gains an eighth element, `{a, m}`, or `0` when there is nothing to keep:

- `a` is his answer: the spoken transcript when he spoke, otherwise what he typed in the box. Capped at 100 characters.
- `m` is the meaning check's note, when there was one. A card carrying an `m` is the "star" he suggested: a marked slip found without him pressing anything.

Why the journal and not the review log:

- The journal row is one per card. The review log repeats every word of a card, so an answer stored there would be stored five times.
- The journal keeps 400 sessions, which is more than a year. The review log keeps about five weeks.

Size: around 15 answers a session at 100 characters at most, gzipped in the sync. That is tens of kilobytes over the year, well within budget.

Readers:

- `tools/journal_report.py` and `tools/content/report.js` list the week's meaning slips: Hebrew, his answer and the note.

## Deferred, with reasons

- **Making the chips look tappable.** He knows they can be tapped. The problem was that a per-word tap didn't fit a meaning error. Phase 1 addresses that instead.
- **A star or "review later" button.** He raised it and then leaned towards simple. The stored `m` gives the same marker with nothing to press.
- **An end-of-session regrade list.** It would help, but with Phase 1 marking listen cards honestly it's no longer the main gap. Revisit if wrong marks still slip through.
- **AI meaning checks on production cards.** Those are marked by the mic's alignment against the Hebrew, which is the right measure for saying something.

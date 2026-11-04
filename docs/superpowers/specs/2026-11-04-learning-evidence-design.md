# Learning evidence: what he said, how he used the app, and a weekly report

## Where this came from

4 Nov 2026, after a review of the two weeks since he came back turned up a real pattern
(past-tense stem errors: הילכתי, עובדתי) and two blind spots (mic or him? which
sentence?):

> "those logging changes that you suggested are exactly the kind of ideas that I was
> talking about. And your points here on those patterns, that is the kind of like
> intelligent, detailed coaching that I want you to be able to get from my learning ...
> imagine we've been consistent for 2 weeks straight. Looking back, what information
> might have been useful for you to track my change over time?"

and, on the brainstorm:

> "This is all my data, you know, it's all between me and you ... everything you've put
> down here, I think, is golden. I think you should put that into the app."

Already shipped the same evening (the `learnWordSuggested` commit): each log entry
carries `id` (sentence), `sg` (the app's suggested grade) and `h` (hint rungs).

## What already exists, and is reused rather than rebuilt

- `hvr_journal` (2026-10-22): one row per session, written after every card, with `fin`,
  `feel`, `away`, and per card `[kind, clean, sec, hinted, unready]`. It already answers
  "where did he stop": `fin:false` plus `cards.length` against `of`. Phase 3 extends its
  card tuple rather than adding a second session store.
- `hvr_sessions`: the last 8 coach conversations, with `said` and the coach's `why`.
  Phase 4 adds a compact summary that outlives the 8.
- `hvr_srslog`: per answer, capped at 2000 (about five weeks). It **does not log a word's
  first-ever answer** (`srsLogEntry` returns null when `before.n` is 0, since
  retrievability means nothing before a first meeting). Phase 2 fixes the long-term view
  without touching that.

Time on a card (`ms`, `sec`) stays recorded but is not read as difficulty. He leaves cards
open to ask Google Assistant things.

## Phase 1: what he actually said

`alignSpoken` already pairs each expected word with the word he said in that position. It
just discards the pairing. It now returns `heard[i]` (the said word aligned to slot `i`,
`""` for a deletion). `learnSpoken` keeps it.

On a per-word commit, every word whose final grade is not "got it", or whose grade differs
from `sg`, logs:

- `hd`: what he said in that slot (≤ 24 chars).
- `et`: a first-pass error type, decided with the app's own resolvers:
  - `none`: nothing aligned there; he left it out.
  - `form`: `libKeyFor(hd)` is the target. Right word, wrong form (gender, tense, person).
  - `swap`: `hd` is a different library word (יפה said for נעים). `hd` names it.
  - `sound`: `heSoundAlike`. Either a mishearing or a near-miss in pronunciation or stem
    (הילכתי for הלכתי lands here). The override flag tells the two apart: overridden
    means the mic, accepted means him.
  - `other`.

Whole-card answers (word cards, chunks) log `sd`, the transcript (≤ 40 chars), whenever he
spoke.

## Phase 2: a weekly summary per word that outlives the log

`hvr_wordweek`: `{ "<Monday ISO>": { "<key>[|r]": [n, miss, nearly, hinted, overridden, first] } }`,
bumped in `srsAnswer` for every answer, including first meetings, excluding coach
(`compose`) answers, which move no schedule. `|r` marks the listening side. 52 weeks
kept. Sync rule `mergeWordWeek`: per cell, element-wise max. Practice is on one device
at a time, so max is the honest merge and never double-counts a re-pushed blob.

## Phase 3: how he uses each card

Per card, counted in a small `learnActs` object reset on render and written as the
journal tuple's 6th element (zeros omitted), with the item id as the 7th:

- `cb` / `ca`: coach opened before / after the answer was revealed.
- `w`: word panels opened (chip taps; repaints don't count).
- `y`: "Why is it this word?" asked.
- `r`: replays ("Hear it", "Slowly", the R key).
- `o`: grades he changed from the app's suggestion.

Before-reveal help means he didn't know it. After-reveal help means checking or curiosity.
Time of day comes from the journal's `at`.

## Phase 4: the coach, as evidence of real use

On `sessRecord`, a summary goes to `hvr_coachlog` (300 kept, merged by id): turn count,
Hebrew vs English word counts in what he said (the mic transcribes mixed speech), the
library words he produced unprompted, the counts of `clean`/`minor`/other verdicts, and
each correction's `why` (≤ 120 chars) for the report to classify.

## Phase 5: the weekly report

`tools/content/report.js`, run over his decoded state like the other content tools.
Per week: sessions finished vs left (and on what card), how he said it felt, accuracy by
card kind, mic suggestions overridden (and in which direction, by word), hint
dependence, error types and the top mix-up pairs with what he said, the most-missed words,
coach Hebrew share and unprompted words, accuracy by time of day, and refresher words
recovering or not. It is read by Claude when he asks "how am I doing", not shown in the
app.

## Deferred, with reasons

- **An in-app progress screen built from this.** The report is for coaching
  conversations first. What deserves a screen should be decided after reading a few
  real reports, not before.
- **AI classification of error types in the app.** The rule-based `et` plus the stored
  `hd`/`why` lets the report (or Claude reading it) classify more finely, with no calls
  spent and nothing to go stale.
- **Logging first meetings in `hvr_srslog`.** Its `r` would be meaningless and would
  skew `srsCalibration`. The weekly summary counts them instead.

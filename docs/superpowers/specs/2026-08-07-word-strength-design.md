# Per-Word Grading and the Word-Strength System

**Date:** 2026-08-07
**Status:** Approved, building
**Supersedes:** the scheduling section of `2026-08-07-learn-page-design.md`

## Why

Two problems with the Learn page as shipped, one reported and one found by research.

**Reported:** a sentence card carries one grade for the whole sentence, and `learnGrade()`
applies it to every word in `uses`. Get four words right and fumble the fifth, and all five are
recorded as Missed. George put it plainly: *"Some words I know and it's fine, so being able to say
I didn't get this one or two in particular would be helpful."* The data the scheduler runs on is
wrong at the point of collection, which no amount of clever scheduling downstream can fix.

**Found:** the scheduler I shipped is a simplified SM-2, and it reproduces SM-2's best-known
failure. `streak = 0` on a miss means one bad day destroys five weeks of progress. Modern practice
(FSRS, now Anki's default, benchmarked over 500M reviews) separates **Difficulty** from
**Stability** and applies **mean reversion** to difficulty, so a word recovers as you get it right
instead of staying punished. It needs 20–30% fewer reviews for the same retention.

**Also found, and it justifies the whole feature:** productive vocabulary (saying it) and receptive
vocabulary (understanding it) are different, and productive skill **does not arise automatically
from comprehension** — it requires *noticing* the specific gap and *focused output*. Tapping the
one word you fumbled is precisely a noticing act. Grading the sentence as a block destroys the
signal the research says matters most.

## Decisions

| Question | Decision |
|---|---|
| Marking words | Tap to cycle: correct → **missed** (1 tap) → **nearly** (2 taps) → correct |
| Default state | Correct. A clean sentence needs zero taps. |
| Which line is tappable | The **transliteration** — it's the line George reads |
| Count mismatch | Tapping disabled, card falls back to the 1/2/3 grade |
| Strength model | `stab` + `diff` per word, FSRS-shaped, mean-reverting difficulty |
| Directions | **Two records per word**: `prod` and `recv`, separately scheduled |
| Struggled non-library words | Into Pending at 2 misses, with a visible reason |
| Hebrew root families | Out of scope this round |

## 1. Tapping

After reveal on a **sentence**, **listen** or **reply** card, the transliteration renders as one
chip per whitespace-separated word. Tapping cycles `ok → missed → nearly → ok`. The order is
deliberate: blanking entirely is the common case, so it costs one tap.

Untapped words count as **Got it**. A perfect sentence is Space, Space, Space.

**Word cards keep the three grade buttons** — there is nothing to tap on a single word, and
"Nearly" (got the meaning, fumbled the pronunciation) is still a real distinction there.

**Mapping chips to library words.** Chip *i* maps to Hebrew token *i*, then to a library key by
exact match, then by stripping one clitic prefix letter — the same two-tier logic `bankUses()`
already uses. **If the transliteration and Hebrew have different word counts, tapping is disabled
for that card entirely** and the 1/2/3 buttons appear instead. Mapping taps to the wrong words
would silently poison the scheduler, which is worse than losing the granularity on one card.

## 2. The strength model

Each direction record holds:

```
{ due, last, stab, diff, n, miss, lapses }
```

- **`stab`** — stability in days. Drives the next due date.
- **`diff`** — difficulty, 1–10, starting at 5. Drives the strength badge.

**On answer, grade `g` ∈ {0 missed, 1 nearly, 2 got}:**

```
delta = { missed: +1.1, nearly: +0.1, got: -0.6 }[g]
diff  = clamp(diff + delta + (5 - diff) * 0.05, 1, 10)
```

The deltas are **asymmetric, and that was measured rather than assumed.** A symmetric ±1.1 let
difficulty fall so fast that five clean answers compounded to an **86-day** interval — failure has
to move the needle harder than success does.

The `(5 - diff) * 0.05` term is the mean reversion: it pulls a punished word back toward baseline
so repeated success recovers it, and stops a word being permanently damaged by one bad session.

`miss` accumulates **+1 on missed, +0.5 on nearly**, so a word he is perpetually "nearly" on still
registers as struggle instead of looking healthy.

```
missed  → stab = max(1, stab * 0.3);  due = today
nearly  → stab = max(1, stab * 0.9);  due = today + round(stab)
got it  → stab = (stab || 1) * (2.6 - (diff - 1) * 0.12), capped at 365
          due  = today + round(stab)
```

A first "Got it" gives `stab = 1` → due tomorrow. At baseline difficulty the sequence measures
**1 → 2 → 5 → 12 → 28** days, close to the old fixed 1/3/7/16/35 but now difficulty-sensitive:
easy words stretch out faster, hard ones stay close.

**The lapse rule is the ease-hell fix.** A word with `stab = 35` that gets missed drops to
`stab = 10.5`, not to zero, so re-learning it is quick rather than starting over.

**Bands:**

| Band | Rule |
|---|---|
| **New** | `n === 0` — never drilled |
| **Weak** | `diff >= 6.5` or (`n >= 2` and `miss / n >= 0.4`) |
| **Strong** | `stab >= 21` and `diff <= 5` |
| **Progressing** | anything else |

Weak is defined by *evidence of struggle*, not by a short interval — a brand-new word is New, not
Weak.

## 3. Two directions

`hvr_srs[key] = { prod: {...}, recv: {...} }`. Sides are created lazily.

- **`prod`** — Say the word, Build the sentence, Reply to grandad
- **`recv`** — Hear and answer

They schedule independently, so drilling a word receptively cannot push out its productive due
date and make it look finished when George still can't say it. **The session queue and the nav
badge use `prod`** — production is what the app exists for. `recv` is recorded, displayed, and used
to choose which listen items are worth showing.

## 4. Struggled words → Pending

New store `hvr_struggle`: `{ token: { miss, last } }`, for tapped words that map to **no library
entry**.

- missed adds 1.0, nearly adds 0.5
- at **≥ 2**, the word moves into `hvr_pending` with `why: "Missed twice while practising"` and is
  cleared from the struggle tally
- gloss comes from `DICT` where known, otherwise the entry is added with a blank gloss rather than
  being dropped
- **`STOPLIST` words are never pushed** — reusing the harvest's existing grammar skip-list, or the
  queue fills with את, של and אני
- words already in `hvr_dismissed` are still pushed, because repeated struggle is new evidence that
  overrides an earlier "I know this one"

`buildPendingRow()` shows `why` when present, so a row that appeared by this route explains itself
rather than looking like it came from a message.

## 5. Display

- **Library rows**: a small strength dot. Added to **both** `buildWordRow` and `buildOppSideEl` —
  the rule that the star and the Hebrew column were each broken by ignoring once.
- **`srs` is threaded** from `renderLibrary` → `buildBlock` → row builders, exactly as `focus` is.
  Reading the store per row is an O(n) `JSON.parse` and was already the cause of a 71ms render.
- **Learn start screen**: `"12 strong · 30 progressing · 8 weak"`.
- **Queue**: weak words sort ahead of other overdue words.

## 6. Migration

One-time, `hvr_srsv2_v1`. Old records are `{due, streak, lapses, last}`:

```
prod.stab   = SRS_STEPS[min(streak - 1, 4)]  (streak 0 → 0)
prod.diff   = clamp(5 + lapses * 0.5, 1, 10)
prod.n      = max(streak, 1);  prod.miss = lapses
prod.due    = old due;  prod.last = old last
```

All past drilling is treated as productive, which is true — `recv` grading did not exist before
this round. A record already in the new shape is left alone, so the migration is idempotent.

## 7. Failure modes

| Condition | Behaviour |
|---|---|
| Translit/Hebrew word counts differ | Tapping disabled, 1/2/3 buttons shown |
| Chip maps to no library word | Feeds the struggle tally instead of the scheduler |
| A tapped word is in STOPLIST | Ignored entirely — not scheduled, not tallied |
| Old-format `hvr_srs` | Migrated once on load |
| `hvr_srs` cleared in Settings | Both directions and the struggle tally reset together |

## 8. Testing

1. Difficulty rises on miss, falls on success, and **mean-reverts** — a word driven to `diff 9`
   returns below 7 within three successes.
2. A 35-day word missed once lands at `stab ≈ 10.5` and `due = today`, **not** `stab 0`.
3. Interval sequence at baseline difficulty is approximately 1, 2, 5, 12, 29.
4. Bands classify correctly at each boundary, and a never-drilled word is New, not Weak.
5. Tapping cycles ok → missed → nearly → ok, and untapped words record Got it.
6. A sentence with one tapped word records exactly one Missed and the rest Got it — the reported
   bug, asserted directly.
7. Count mismatch disables tapping and shows the grade buttons.
8. Listen cards write to `recv` only; sentence/word/reply write to `prod` only.
9. A non-library word tapped missed twice appears in Pending with its reason; a STOPLIST word
   never does; one miss alone does not.
10. Migration converts an old record once and is idempotent.
11. Regression: full session end-to-end, translator, pad, grid, archive, export, pad-hidden-on-Learn.

## Out of scope

- Hebrew root (shoresh) families — deferred by decision, not by oversight
- Per-word audio replay of a single chip
- Any change to how bank items are generated

# Coming back — batch A

## Where this came from

George, 2026-10-22, after nineteen days away:

> "I've been pretty heavily slacking on the Hebrew learning app. I really want to get back
> into it… Because I've been away from it for a while, the nodes are a little bit
> intimidating. So I'm like, okay, let's do 15 cards, get that refresh. And I like that
> because it gives me things I'm comfortable with… It scaffolds me well."

> "The point about, we need to make sure that I'm coming back to it is a very important.
> The main point I'm trying to raise."

And his flags from 2026-10-03, the last session before the gap, never read until tonight:

> "I've never seen any of these words before… when it gets hard like this I'm just like oh
> you know what I'm actually fucking done. I can't be bothered anymore which I think is
> part of the reason why I'm not picking this up as much because it's gone a lot harder."

> "This one literally is the word that I've not even is in the library anymore… how am I
> even supposed to get it like you're trying to make me practise the word minutes? I'm
> getting in a sentence I have no idea about."

> "I can see that time is the word I need to learn but how am I supposed to even pull that
> learn that in this sentence because I don't know the rest of the words. So like my only
> option is to either get to get it wrong or just to skip all the way through."

## What the data says

From `hvr_stats` (clean = right first time, no hints):

| period | days practised | clean / cards |
|---|---|---|
| Aug 21 – Sep 3 | 13 of 14 | 70% |
| Sep 5 – Sep 22 | 13 of 18 | 53% |
| Sep 23 – Oct 22 | 7 of 30 | 28% |

The fall lines up with the week of 9/23 (one list), 9/28 (frequency ranking, soft launch)
and 9/29 (234 Duolingo words reset to new). On his return 182 of 257 drilled words were
due. On 10-03 he had 0 right by card 4.

Checked against the code, three causes:

1. **The gate cannot see grammar words he does not know.** `bankContentWords` is
   `uses ∩ lib ∖ STOPLIST`, and STOPLIST holds רק, עוד, כבר, זאת, כי, אז, עד, או, כל, על,
   כאן, אלה, אם — words with real meaning that an English speaker cannot guess, none
   drilled, none in his library. בעוד דקה אני בא and זאת רק ההתחלה passed as "within
   reach" for exactly this reason.
2. **Card order is a shuffle.** Nothing puts an easy card first or last.
3. **A return after a break is the hardest session there is.** Overdue words lead, new
   words are launched on top, and the soft launch carries them into sentences.

There is also no record of a SESSION — which button, how long, finished or abandoned, how
it felt — so none of this could be seen until he described it.

And one bug found on the way: `mergeStats` takes `maxNum` of every field of a day, and
`bands` is an object, so every sync writes `bands: 0`. The dashboard's "strong words"
milestones read that snapshot and have said 0 since 21 September; the app's own
fourteen-day comparison (`d.bands` in the stats room) has been silently empty too.

## Phase 0 — the strength snapshot survives a sync

`mergeStats` keeps an object field as an object: if only one side has one, that side's;
if both, the one with more strong words (then more progressing). Days already zeroed stay
zero — there is nothing to rebuild them from — and the next finished session writes today.

## Phase 1 — every word in a sentence counts

`LITTLE_WORDS` (the thirteen above) leave STOPLIST. Once, behind `hvr_little_v1`, each is
added to the library from DICT (category Grammar, src "little", shelf reserve) if absent.
From then on the ordinary machinery handles them: `bankUsesRefresh` (every read) credits
them in sentences, `bankServable` counts them, `srsGradable` lets them be graded, and the
soft launch introduces them as word cards. `wordFreqBonus` gives them the top-rank bonus,
because they are among the commonest words in Hebrew and ought to come first.

Measured on his real state with the v9 content: servable sentences go from 338 to 306 —
the 32 that carry a little word wait until it has been met, and a sentence carrying the
one being launched today is still servable under the existing carry rule.

Kept on STOPLIST, deliberately: pronouns and their object/possessive forms, של, את, לא,
כן, זה, יש, אין, מה, מי, עם, גם, אבל, מאוד, הרבה, פה, שם. Either he has them (his own
spreadsheet held הרבה, פה, יש, אין) or they are grammar a sentence cannot avoid.

## Phase 2 — open on wins, close on one

After the build, `sessionEaseOrder` moves up to three of the session's easiest cards to
the front and one more to the end. Ease is the lowest retrievability (`srsR`) of the card's
gradable words on the side it grades; a card with a never-drilled word has ease 0. Only
cards with ease ≥ 0.8 qualify, so on a thin day there may be fewer than four.

Never moved: shadow cards, carried cards, word cards for words launched today, and any
card containing a launched word — `introOrder` keeps meeting-before-using intact. Daily
practice only (`learnBuild`); node sessions are deferred below.

## Phase 3 — welcome back

When a daily session is built and his last practice day (a `hvr_stats` day with cards) is
at least `COMEBACK_DAYS` (4) before today, `hvr_comeback` is set to
`{ from, away, left: COMEBACK_SESSIONS }` (2). While `left > 0`, daily sessions are
gentle:

- no new words: nothing launched, and never-drilled words are dropped from the targets;
- no carried words: the gate is strict — every word ready;
- overdue words most-stable first (the ones most likely still there), not by need.

`left` counts down when a gentle session is finished, not started, so a session he walks
out of does not use one up. The action card says so in one line in the world's voice:
"Welcome back — 19 days away. The next two sessions are gentle: only words you've had
before."

## Phase 4 — the session journal

`hvr_journal`, synced, one entry per session, opened on the first card render so every
start path (daily, node, check, review drill, coach) is covered by one hook:

```
{ id, dev, at, end, mode, of, away, gentle, fin, feel,
  cards: [[kind, clean 0/1, sec, hinted 0/1, unready]] }
```

- `mode`: `5` / `15` (shape), `node:<name>:<lesson>`, `coach`, `check`, `review`.
- `unready`: how many of the card's words were not ready when the session opened — the
  card's difficulty as he met it.
- Written after every card, so an abandoned session is on record with how far it got.
- `fin` and `end` on `learnFinish`. `feel` from three buttons on the end screen — Too easy,
  About right, Too hard — one tap, no follow-up.
- Merge rule `mergeJournal`: by id; the copy with more cards wins, `fin` and `feel` from
  either; sorted by `at`, capped at 400.

`tools/journal_report.py <state_keys.json>` prints the picture: practice calendar,
sessions by mode, clean rate by card kind, time per card, where sessions were abandoned,
and the feel taps. The check-hebrew-flags skill reads it too.

## Deferred, with reasons

- **Node sessions (`campBuild`) get no wins-first order.** They have their own meet/use
  ordering, and he chose the daily 15 on return precisely because nodes felt big. Once the
  journal shows how nodes are going, decide there.
- **A difficulty thermostat** (batch B): needs the journal's `feel` and per-card data to
  tune against. Building it before the data exists is guessing again.
- **Teach before testing** (batch B).
- **Softening speech-recognition misses** (batch C): היי/ביי with four lapses each and
  תודה with nine look like false misses, but the journal should confirm before the
  grader changes.
- **The dashboard's 60-minute daily habit**: his call, in the dashboard, not this app.
- **Rebuilding zeroed `bands` days**: no source to rebuild them from.

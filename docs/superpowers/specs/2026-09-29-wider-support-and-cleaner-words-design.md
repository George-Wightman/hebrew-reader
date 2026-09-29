# Wider support, cleaner words, and scenes written ahead

**Date:** 2026-09-29
**Scope:** `libKeyFor` and `STOPLIST`; `bankServable`'s carry rule and the introduce
commission's scaffold; a quick check for the Duolingo words the app has only assumed;
library transliteration and gloss repair; pre-written node scenes in `content/nodes.json`;
the content tooling moved into `tools/content`.

## Where this came from

The end-of-session review after writing content v6 named six changes. George, on each:

> Number one, I agree. It doesn't have to be perfect. Make that change. … if a word is
> reasonably okay, then it should be used … because that is limiting what's possible.
> On two. Yeah, do those checks. Yeah, fix those bugs. … cleaning up transliteration.
> Yeah, but definitely that should be done. … number five, that sounds like a reasonable
> addition. … let's put a pin in six.

And on the scenes, which the previous spec left to the phone's AI:

> Why haven't you done the scenes? … you can see my data, you can see the nodes? Why not
> build the scenes for them? Why put that onto the API?

He is right: every node that exists is visible in his synced state, and a scene written
here passes the same gate and a native-quality reread. The phone's writer stays as the
fallback for nodes planned after this.

## 1. Word matching (done first — everything else is measured through it)

Measured on his library, four misroutes in `libKeyFor`, each fixed:

- **Grammar words resolved as content words.** לך/שלך → הולך, אותו/אותה/אותם → אותן,
  שם → לשים, אתן → נותן. A `STOPLIST` token now stands for itself only.
- **A guessed prefix beat a verified form.** לבנה → בנה ("build"). Whole-token forms
  and `GENDER_PAIRS` are now asked before a prefix is peeled.
- **A feminine adjective went to a verb.** שמחה → אשמח. `GENDER_PAIRS` first.
- **"I was" filed as its own word** (הייתי, הלכתי, אמרתי…) — a redirect to the verb was
  built and **taken back**: the live "Your day — past" place teaches exactly those forms
  and finds its sentences by them, and the redirect took it from 30 servable sentences to
  0. Caught by the scene gate ("none of the place's own words") before it shipped. A form
  he is being taught as a word is credited as that word.

`STOPLIST` gains the pronoun-preposition set (איתי…איתם, אותן, להן, שלהן) and the
article/ש forms of זה (הזה, הזאת, הזו, האלה, שזה), which sat in his queue as
never-drilled cards. Across his bank, 97 of 1,267 sentences change what they credit;
every change was read and is a correction. (Measured before the fourth fix was withdrawn; without it the changes are the grammar-word and form-order ones.)

## 2. New words may sit among words he knows reasonably well

`bankServable`'s carry rule demanded every other word be `strong` — about 47 of his words.
For a **never-met** carried word the support is now `ready` (progressing or strong), the
research's "about 95% known" rather than "100% mastered". A **weak** word being rescued
keeps strong support: that word has already failed, and the rule exists for it. The
unproven cap (one assumed Duolingo word per sentence) is unchanged. The introduce
commission is written against the same wider scaffold, as its own commission when rescue
is also due, so the writer and the gate agree.

## 3. A quick check of the words the app has only assumed

269 of his 397 usable words are Duolingo imports never tested here, and a sentence may
carry only one. A **Check** session: fifteen word cards of unproven words, commonest
first, reusing the ordinary word card and grader, so an answer either way writes real
evidence and the word stops being "assumed". Offered from the practice card only while
any remain.

## 4. Transliteration and glosses

`DUO_DICT`'s 1,665 imports carry Duolingo's own marks — `lig'dol`, `mish'pakhah`,
`le-hagid` — which are not the house scheme (CLAUDE.md). Fixed at the source with the
house rules (no apostrophe before a consonant, no hyphen, no final `h` after a vowel
where the Hebrew ends in ה), and carried into his library once, only onto entries still
holding the imported spelling, so anything he corrected by hand is left alone. A short
list of glosses that are simply wrong (מוזר "muzaz", שמן "fat", לראות "watch",
לקחת "you took / to take", להרכיב "to wear") is corrected the same way.

## 5. Scenes written ahead

`content/nodes.json` gains `scenes`, keyed by node name. `contentIngest` sets `node.scene`
on any node that matches and has none. Each scene is checked with `sceneAcceptable`
against his real state before shipping. The phone's writer is unchanged and covers nodes
that did not exist when the file was written.

## 6. Tooling

The Node probe, the gate and the coverage report used for v6 move to `tools/content`,
reading his decoded state from a path given at run time (never the repo). The content
skill points at them.

## Deferred

- **Three new words per full session.** George: "put a pin in six". Revisit once the
  wider support and the checked Duolingo words have been live for a few days.

## 7. The Duolingo assumption, withdrawn (added after the first check)

His first 15-word check, the same morning:

> turns out I didn't know any of them … a lot of those Hebrew words I've never seen
> before. If they're from Duolingo, then … with the data import … I've not seen a lot of
> them.

The synced data agreed, and showed a second fault: thirteen of fifteen answers were misses
or half-right, yet twelve words stayed "progressing" — his one real answer had been
averaged into two to four answers the importer invented, and דרך went to strong for 62 days
on a single right answer. Asked how the remaining 266 should come in, he chose **treat
them all as new**.

- `srsApply`: a first real answer to a seeded record starts from blank (a first meeting)
  instead of being averaged into it.
- `duoAssumedReset`: every seeded side on a Duolingo-sourced word (`src` duo, and the
  guessed-topics `batch` list — 248 words) becomes a blank record stamped with today as
  `last`, which wins every merge against the seeded copy dated 2026-09-02. The morning's
  thirteen checked words are re-scored as the first meetings they were. Runs at load and
  over every merged sync blob. His own spreadsheet and approved words (18 with the same
  record shape) are left alone: he chose for Duolingo's.
- `libAddDuoUnits` no longer seeds anything: a word from a new Duolingo unit arrives new.
- `FAM_DUO_MAX` 150 → 30 and `FAM_BATCH_BONUS` 150 → 30: both assumed "met in Duolingo =
  held", which the check refuted. Frequency now leads the new-word queue (להיות, לראות,
  פעם, זמן, משהו…), with the unit as a tie-break.

Measured on his state: usable words 390 → 145, servable sentences 620 → 297, "of the
1,000 most common" 206 → 102. Honest, and every place in the live chapter keeps 17–25
servable sentences.

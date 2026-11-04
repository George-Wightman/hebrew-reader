# Forgotten words get a bare card before the sentence

## Where this came from

4 Nov 2026, mid-session, on `הילד הופך את הכוס.`:

> "it's a very hard sentence ... I can't even see what the words mean"

and afterwards:

> "Introducing something in a sentence is too much. Yeah, I like that if it predicts I
> probably have forgotten a word, you know, it comes up just to refresh it. Although I
> kind of worry that we may just be overloaded with loads of words I might know. Maybe
> that's fine, right? Like, let's get that low-hanging fruit ... I'm coming back to it. So
> maybe we do need to get that new baseline in place."

## What the code was doing

`להפוך` was last answered on 2026-09-29 (stab 2.4, one lapse). Thirty-six days later its
predicted recall `srsR` was about 0.01, but nothing in the session builder asks for it.
The servable gate (`wordReady`) reads the strength **band**, and `srsStrength` is
computed from stab, difficulty and miss rate, with no time term. A word stays
`progressing` or `weak` however long ago he last said it. Weak words also ride into
sentences through `carry` (`rescueWords`). So a word the scheduler itself predicts he has
lost can be served in a full sentence, often in an inflected form, with no word card.

The new-word path already does what he is asking for: `introWords` launches a never-met
word as a bare word card, and `introOrder` puts that card ahead of any sentence using
it. Forgotten words had no equivalent.

## The change

After the session's cards are chosen and before the trim:

1. For each sentence-like card (`sentence`, `listen`, `shadow`, anything carrying an
   item except voice notes), find its words whose production-side `srsR` is below
   `REFRESH_R = 0.5`. "Probably forgotten" means exactly that: more likely gone than not.
   This counts only words he has met (`n > 0`); never-met words already have the
   launch path.
2. Skip any word that already has a word card in the session.
3. Take the lowest-R words first, up to `REFRESH_CARDS` (3 on a full session, 1 on
   Quick). The cap is the answer to "overloaded with loads of words I might know": the
   rest wait for the next session, and the one after, which is the gradual
   re-baseline he accepted.
4. Each picked word becomes a word card. `introOrder` moves it ahead of the first
   sentence using it, the same meet-then-use rule as a launch. `learnTrim` keeps both
   the card and the sentence that triggered it, so the trim cannot strand either.

Unproven (Duolingo-assumed) words qualify like any other. A word card is the gentle
test he chose for them, and their R is usually low because the seed date is old.

## Deferred, with reasons

- **Gating sentences on R.** Refusing every sentence with a faded word would empty the
  bank after any break. The 2026-10-22 comeback found almost every card faded below
  `EASE_MIN`. The cap plus the word card is the softer version.
- **Folding time into `srsStrength`.** Bands drive the library display, rescue lists,
  writer scaffolds and the content tools. Changing their meaning is a much larger
  change than this problem needs.
- **Per-sentence nuance notes.** Discussed the same evening and dropped: they would go
  stale, and a note nobody reads is just effort. On-demand "Why is it this word?" covers
  it.

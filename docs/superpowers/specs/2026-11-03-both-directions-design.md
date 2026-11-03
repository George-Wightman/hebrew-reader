# Both directions: understanding gets a schedule of its own

## Where this came from

George, flagging from the end screen on 2 Nov:

> I've also realised that I can do it where I see English and then I translate, but maybe
> I struggle a bit more seeing Hebrew and translating to English. Perhaps maybe we should
> discuss this and look at the balance of the different exercises and which tests which
> way and which is actually more useful for learning to speak

And on reading the review, 3 Nov:

> I know what I want to say in English. Me being able to translate that then into Hebrew
> is useful. But if I'm actually having a conversation with someone, I need to be able to
> decode or understand and interpret what it is they're saying, right?

On the same day he said אביב was "definitely not something that I would say I'm strong
at", although the app called it strong.

## What the evidence said

From his synced state on 2026-11-03, with content v11 applied:

- **Understanding stopped being practised in October.** Hebrew→English (`recv`) reviews
  in `hvr_srslog`: 40 in August, 51 in September, **0 in October and November**. All 123
  cards in the last three weeks of the journal asked him to produce Hebrew.
- **It is structural, not a setting.** `practiceNeeds` scores only `srs[k].prod`, and
  `learnPickBank` fills the session by what a sentence covers in that list. Nothing asks
  for an understanding review at all. *Likely mechanism, to confirm first in Phase 1:* a
  `listen` item can only win a slot by happening to cover words due to be said, and it
  then loses ties to sentences covering the same words. `wantListen` is true (he has a
  voice), so the cards are not being withheld.
- **What it left behind.** Of the 60 words read as strong for production, 22 are strong
  for understanding, 7 progressing, 1 weak, and **30 have never been tested that way**.
  Sixty understanding reviews are overdue; 147 production ones are.
- **The material exists.** 89 `listen` items in the bank, 54 servable today.
- **"Strong" rests on sentences.** 47 of the 60 strong words have never been answered on a
  bare word card. Right answers by card kind across the whole log: sentence 501, compose
  119, conversation 53, word 39. A sentence card hands him every other word as context,
  and compose credit was given in under two seconds (see
  [[hebrew-difficulty-collapse]] in memory). אביב had eleven answers, all inside
  sentences or compose, and missed its first bare card on 3 Nov.
- **The listen card is already honest.** "Listen, then write what you think it means —
  I'll check it" (`LEARN_KINDS.listen`). The checking path must be confirmed in Phase 1
  rather than assumed, since this is the card that will carry the strand.

## What the research said

- One direction is not simply better. Productive (L1→L2) learning gives larger gains on
  most measures (Webb), and is forgotten less over a week (Schneider, Healy & Bourne,
  2002). But **lower-proficiency learners gained more from L2→L1** (Terai, Yamashita &
  Pasich, 2021, SSLA 43). He is at level 1 of 5.
- Listening is its own skill. Comfortable listening needs about 95% of the words known
  (van Zeeland & Schmitt), and the usual breakdown is decoding words out of the speech
  stream, not grammar.
- Nation's four strands (meaning-focused input, meaning-focused output, language-focused
  learning, fluency) recommend roughly equal time each. His sessions are almost entirely
  the second and third.

## The goal, in his terms

He is learning to *speak*, so English→Hebrew stays the backbone. Speaking to someone
means hearing them first, so a word is not his until he can catch it as well as say it.
Success rate is the number to protect (target ~80%; it has been 46% for three weeks), and
nothing here may make a session feel harder to come back to.

## Phase 1: the understanding side is scheduled

1. **A second needs list.** `practiceNeeds` returns `recvNeed` / `recvDue` alongside the
   production ones, using the same weights: due, then lately-seen discounts. Words strong
   for production with no `recv` record count as **unheard** and are scored as due. That is
   the 30 words above, and they should be quick wins, because he can already say them.
2. **A reserved share.** Every session reserves listening slots from `recvNeed`, picked by
   coverage the way `learnPickBank` picks sentences: **about one card in four** (*my
   recommendation*; Nation's input strand at a quarter, Terai's result at his level).
   That is 3–4 in a Quick 15 and 5 in a sit-down's practice block, never fewer than 2 when
   the voice is available. The rest of the session keeps today's rules.
3. **Easy before hard.** Unheard words (strong for production) are heard first, so the
   strand opens with wins. A word weak on both sides is not served as a listen card until
   it is at least progressing for production; hearing it does not rescue it.
4. **The card checks what he understood.** Confirm the listen card's check works offline
   and on the phone, that a miss grades `recv` as a miss, and that hints and replays are
   charged the way `learnCapGrade` charges them. Builder's call: whether he may also
   *say* the meaning in English rather than type it. The dock already transcribes mixed
   Hebrew and English.
5. **Content.** Claude writes listen items for every `recvDue` and unheard word that
   lacks a servable one (content v12), through the same gates. Things people would say
   *to* him, not lines he would say: questions, offers, news. With the phone's writer off
   ([[hebrew-claude-writes-the-bank]] in memory), `hvr_wants` gains `why: "hear"` so
   shortfalls are reported the same way.

## Phase 2: "strong" gets checked on its own

1. **Spot checks, not a redefinition.** Each session spends one or two word-card slots on
   a word read as strong whose production evidence has never included an unhinted bare
   word card (`srslog` `kd === "word"`). Right confirms it. Wrong demotes it through the
   ordinary scheduler, which is exactly what happened to אביב. Rationale: redefining
   "strong" outright would drop the strong list from 60 to about 13 overnight. Rescue
   sentences are built on strong words, so most of the bank would become unservable at
   once and the success rate would collapse. Spot checks correct the same error at the
   rate he practises.
2. **Compose stops crediting.** The compose card (no target, sub-two-second credit) no
   longer counts toward `prod` strength. It is rare now (2 cards in 3 weeks), so the
   change costs nothing he would notice.

## Phase 3: what "both sides" means for progress

The N-of-1,000 tile and node gold count a word once it is strong for production. Once
Phase 1 has run for a fortnight, decide whether they should need both sides. This is
deliberately not decided now: it changes the numbers he sees, and should follow evidence
of how fast the understanding side catches up.

## Deferred, with reasons

- **A better voice.** Running as its own task ("Find a more realistic Hebrew voice for
  listening"). Phase 1 works with the device voice and gets better if that lands.
- **Longer listening** (scenes, talks played as listening practice). Worth doing once
  single-line listening is back in the routine. Scenes already exist per node.
- **Redefining strength, or re-weighting sentence credit per word.** Phase 2's spot checks
  are the reversible version. Revisit if they demote far more than expected.
- **A dial in Settings for the share.** One learner, one sensible default. Add it only if
  the quarter feels wrong in use.

## How we will know

Watch `tools/journal_report.py` for two weeks after Phase 1 ships. Listen cards should be
about a quarter of cards, the overall clean rate should not fall (it should rise, because
unheard-but-sayable words are easy), and sessions should not be abandoned more often. For
Phase 2, the share of spot checks that demote a word is the measure of how inflated
"strong" really was.

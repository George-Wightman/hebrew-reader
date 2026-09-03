# Grace in the grading

## Where this came from

Four flags from the session of 3 September, and George's steer on what to do about them.

On being marked down for saying `נעים` where the card wanted `יפה`:

> "For instances like this, I feel like saying naim is also correct, like yefe is pretty
> in my mind, not nice. This links to what I was saying before about words not matching
> up/ having slightly different definitions"

On `נוסעים`, after his girlfriend looked at it:

> "My girlfriend just told me nos'im a tally mean drive, or more closely translates to
> drive/ travel by transport, so it's not a perfect translation. I think we could review
> the words and make sure the neuance is captured in the sentences."

The first instinct was to make the English precise — rewrite the glosses so each Hebrew
word has an English word of its own. George rejected that, and the rejection is the
design:

> "Yeah the english isnt accurate, but htere isnt a 100% translation, its fluid, so their
> needs to be some grace in that, weather thats in how the sentence is shown to me, or
> what it might accept as the output, there needs to be some leinience in cases where the
> words still make rough sense (which takes some degree of contextual understanding
> really."

On being marked wrong for `אטי`, for the second time:

> "This lesson made the same mistake as before where it got iti wrong because of the
> pronunciation"
>
> "there needs to be some way for hte app to know what sounds similar, how that is/ what
> that looks like im not sure, but yeah its needed as its a very annoying and frankly
> unavoidable problem."

And on session length:

> "Im pretty sure a day or two ago we extended the session lenght in the nodes. They are
> reallylong and I did notice the complete lack of single owrds which for a node makes
> sense once Ive seen the words thats fine. Could do with being about 30% shorted tho."

## What the evidence showed

**A sentence card prompts in English only.** `learnRenderCard` renders `c.item.en` and
nothing else for `kind === "sentence"` (`hebrew-reader.html:24537`). So he is producing
Hebrew from an English gloss, and "there isn't a 100% translation" is a structural fact
about the card, not a complaint about a particular one.

**The cost is real and it is landing on the SRS.** On card 1/14 of the flagged session
the English read *"We travel to the city in the morning"*; he said `אנחנו הולכים`. Graded
**0**. `נוסע` took two zeroes on 3 September and its difficulty climbed 5.5 → 7.1.

**`אטי` and `איתי` are homophones inside his own library**, both transliterated `iti`:
`אטי` "slow" (focus), `איטי` "slow" (reserve — a second spelling of the same word), `איתי`
"with me" (reserve). `alignSpoken` compares letters: edit distance is 2, `nearEnough`
allows 1 at that length, so the word is marked missed. The adjudicator is then asked
about it and correctly declines, because its prompt ends:

> "If the transcript shows something genuinely different at that point, or shows nothing
> at all, leave the index out."

A homophone *is* something genuinely different. The judge obeyed its instructions. This is
why it is "the same mistake as before".

**A phonetic key was prototyped against the real 536-word library before being chosen.**
Three merge sets were measured for how many word pairs they newly admit beyond what
`nearEnough` already allows:

| merge set | new pairs admitted | catches `אטי`~`איתי` |
|---|---|---|
| `ט`=`ת` | **12** | yes |
| `ט`=`ת`, `כ`=`ח` | 50 | yes |
| `ט`=`ת`, `כ`=`ח`, `א`=`ע` | 91 | yes |

The looser sets merge things that are not homophones at all — `חם` (hot) with `כן` (yes),
`לא` (no) with `רע` (bad), `ערב` (evening) with `רעב` (hungry). An earlier attempt that
dropped the vowel letters entirely produced 162 bad pairs and is recorded below as
rejected. **`ט`=`ת` alone is the whole of the win**: as an exact key it produces exactly
one collision in 536 words, and that collision is `איטי`/`איתי` — the true homophone we
want grace on.

**The node session is 14 cards and the arithmetic is exact**: `CAMP_SOLO_CARDS` 2 +
`CAMP_CARRY_CARDS` 5 + `CAMP_OWN_CARDS` 4 + `CAMP_WIDER_CARDS` 3. It was 10 before
`9c62cac`. His memory of extending it "a day or two ago" is correct.

**Wall time, from his own SRS log, grouped into sittings:**

| session | wall | cards | median s/card |
|---|---|---|---|
| 08-30 | 2.7m | 14 | 10.9s |
| 08-31 | 3.9m | 16 | 10.2s |
| 09-01 | 16.4m | 15 | 16.3s |
| 09-03 (flagged) | 9.4m | 17 | 13.3s |

The 17 is a 14-card node session plus a separate coach lesson in the same sitting;
`campBegin([composeCard(...)], id, CAMP_COACH_LESSON)` is its own session. Only the node
session is in scope here, which is what he flagged.

**The adjudicator's measured value, which flag 5 asked for:** 21 calls over three days, 27
words asked about, 6 softened (22%), zero errors, zero arriving too late — and **0 of 10 on
3 September**, the day of the `אטי` miss. It does not review every clip: it fires only on
words the local alignment already marked missed. Cheap, and currently underperforming for
exactly the reason Phase 1 fixes.

---

## Phase 1 — The judge can hear a homophone

A fourth layer in the "recogniser is not the judge" stack, sitting between the runners-up
and the model, and bound by the same asymmetry as every other layer: **it can only ever
soften a `missed` to `near`. Nothing here can mark a word wrong.**

`heSoundKey(w)` returns `normHe(w)` with `ט` mapped to `ת`. Two words are `soundNear` when
their keys are equal, or when `nearEnough` holds between the keys. Words shorter than two
letters are excluded — at one letter the key is the word.

In `learnScoreSpoken`, after the runners-up layer and before the reveal: for each expected
word still marked `missed`, if any word the recogniser produced that did not itself match
an expected word is `soundNear` to it, the status becomes `near`.

This is local, instant and free. It corrects the card before he ever sees the wrong mark,
where the model layer can only catch up with it afterwards.

**`אטי` and `איטי` are left alone.** They are two library entries for one word, but
`nearEnough` already treats them as equivalent (edit distance 1 at length 4), so nothing
in the drill is broken by the duplication. His library is his data and this spec does not
rewrite it.

## Phase 2 — Grace on meaning

The adjudicator currently asks one question: *did he say this word?* It gains a second:
*is what he said instead a defensible way of saying this English?*

Same call, same trigger, same budget — the extra question rides on a request that was
already being made only for words already marked missed.

**The prompt gains the English he was answering.** It does not have it today, which is why
it cannot possibly judge a rendering. `c.item.en` is passed in.

**The reply becomes** `{"said":[…], "meant":[…], "note":"…"}`:

- `said` — indexes he probably did say. Softened to `near`, exactly as today.
- `meant` — indexes where he produced a different word that is a reasonable rendering of
  the same English. Also softened to `near`, **never to `matched`**. He did not practise
  the word the card was drilling, and a card that hands out full credit for a synonym
  stops teaching the distinction his girlfriend pointed at.
- `note` — one short sentence naming the distinction, shown on the card.

The note is the part that answers the nuance half of the flag. Instead of rewriting 42
colliding glosses, the app says the thing at the moment of confusion: *you said `נעים`,
which is 'nice' as in pleasant — this one wants `יפה`, nice to look at.* That is the
lesson, delivered where it lands.

**Guards, so grace does not become a blanket pass:**

- `meant` is ignored unless the transcript actually contained an unmatched word at that
  point. If he said nothing, there is nothing to be generous about.
- `meant` is ignored for any index also in `said` — that word needs no note.
- The existing staleness check applies unchanged: if he has moved on, the answer is
  dropped.

**Presentation.** The note reuses the `.lmicsoft` slot — the transient card-level
advisory the mic-unsure line already uses. Per the style guide's "one signal, not four
weak ones", at most one such line shows at a time, and per "standing instructions become
wallpaper" it is per-card and transient, never a permanent rubric. No emoji: the drill
card is world layer.

**Measurement.** A new `adjMeant` stat counts words softened on meaning, kept separate
from `adjWon` so the 22% baseline stays comparable and the two kinds of rescue can be told
apart.

## Phase 3 — The node session comes down by about 30%

`CAMP_SESSION_CARDS` 14 → **10**, and the quotas re-sliced to sum to exactly 10 while
holding the share the previous spec fought for:

| slice | was | now |
|---|---|---|
| `CAMP_SOLO_CARDS` | 2 | 2 |
| `CAMP_CARRY_CARDS` | 5 | 4 |
| `CAMP_OWN_CARDS` | 4 | 2 |
| `CAMP_WIDER_CARDS` | 3 | 2 |
| **total** | **14** | **10** |

Eleven of fourteen used to stay the node's own; eight of ten do now — 79% to 80%.

Consolidation (`CAMP_OWN_CARDS`) absorbs the deepest cut on purpose. Slice 3c already
backfills leftover room from `holding` *first*, so a smaller own-quota does not starve own
material; it only stops own material crowding out the wider slice when every slice is
full. Carry stays the largest slice because it is still the point of the session.

The card mix is deliberately untouched. George looked at the absence of single-word cards
and blessed it — *"which for a node makes sense once Ive seen the words thats fine"*.

`T("campBuild quotas: eleven of fourteen cards stay the node's own")` asserts the old
numbers and must be updated with the constants, not after them.

---

## Deferred, with reasons

**Rewriting the colliding glosses.** 42 English glosses in the library are shared by two
or more Hebrew words; three words are glossed "nice", six "to wear". This was the original
proposal and George rejected it: translation is fluid and the fix belongs in the grading,
not in a pass over the content. Phase 2 teaches the distinction at the point of
confusion instead. Not "not yet" — decided against.

**Merging `כ`/`ח` or `א`/`ע` into the sound key.** Measured, not guessed: 50 and 91 newly
admitted pairs respectively, against 12 for `ט`/`ת`. The pairs they add are not homophones.

**Dropping vowel letters to build a consonantal key.** Prototyped, 162 bad pairs, merges
`חם` with `כמה` and `ערב` with `רעב`. The vowel letters are the vowels; a Semitic root key
is the wrong tool for judging speech.

**De-duplicating `אטי`/`איטי` in his library.** Two entries for one word, but harmless —
`nearEnough` already equates them — and his library is synced user data, not repo content.

**Changing how the sentence card is shown.** George offered it as an alternative ("whether
thats in how the sentence is shown to me, or what it might accept as the output"). Grading
was chosen because it is where the damage lands: the difficulty climb on `נוסע` happened
in the scheduler, and a better prompt would not have undone it.

**Preloading and unused images** (flag of 29 August). The prebaked-content work shipped on
31 August and his nodes now carry 27–84 servable items each, which is already several
sessions deep. No unused image assets exist in the repo. Needs a question to George rather
than a design.

## How this is verified

Self-tests, against pure functions with plain objects, per the suite's rule:

- `heSoundKey` maps `ט`→`ת` and leaves vowel letters intact.
- `soundNear("אטי","איתי")` is true; `soundNear("חם","כן")` is false.
- A `missed` word that is `soundNear` to an unmatched heard word becomes `near`, and one
  that is not stays `missed`.
- The sound layer never produces `matched`, and never turns a `matched` into anything else.
- The adjudicator reply normaliser: `meant` softens to `near`; an index in both `said` and
  `meant` produces no note; `meant` with no unmatched transcript word is ignored; junk in
  the reply does not throw.
- `campBuild` returns 10 cards and 8 of them are the node's own.

Then in the browser, per `CLAUDE.md`: unregister the service worker and clear caches
before reloading, confirm `document.title` reads `selftest <pass>/<pass>`, and read
`window.__selftest.failures` rather than trusting a screenshot.

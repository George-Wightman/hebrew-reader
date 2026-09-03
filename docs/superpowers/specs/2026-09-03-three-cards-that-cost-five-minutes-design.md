# Three cards that cost five minutes

## Where this came from

Three flags from the session of 2026-09-03, in George's words.

On `אני חושב שהדירה יפה`, glossed *"I think the apartment is nice"*, having said **na'im**:

> "For instances like this, I feel like saying naim is also correct, like yefe is pretty
> in my mind, not nice. This links to what I was saying before about words not matching
> up/ having slightly different definitions"

On `האוטובוס אטי היום`, where the recogniser produced איתי:

> "This lesson made the same mistake as before where it got iti wrong because of the
> pronunciation"

And on the length of the whole thing:

> "Just did a practice and it was too long. Realise now we made it too much longer in our
> previous change"

Asked whether the fix for the first was to correct the English glosses, he rejected that
framing outright, and the rejection is the design:

> "Yeah the english isnt accurate, but htere isnt a 100% translation, its fluid, so their
> needs to be some grace in that, weather thats in how the sentence is shown to me, or what
> it might accept as the output, there needs to be some leinience in cases where the words
> still make rough sense (which takes some degree of contextual understanding really."

On the second:

> "there needs to be some way for the app to know what sounds similar, how that is/ what
> that looks like im not sure, but yeah its needed as its a very annoying and frankly
> unavoidable problem."

On the third:

> "They are reallylong and I did notice the complete lack of single owrds which for a node
> makes sense once Ive seen the words thats fine. Could do with being about 30% shorted
> tho."

And on how to build it: *"Dont do ths as seperate builds do it as one."*

## What the evidence says

The three flags look like three problems. The SRS log says they are mostly one.

Reconstructing the evening of 09-03 from `hvr_srslog`, card by card, the 9.4 minutes he
called too long was actually three runs back to back — a node session, a walk-home
conversation, and a daily session:

| time | kind | seconds | words |
|---|---|---|---|
| 19:00:02 | listen | **180.0** | למה אוטובוס **אטי** היום |
| 19:00:35 | sentence | 32.5 | נוסע=0 עיר=2 שבוע=0 |
| 19:00:44 | sentence | 9.0 | נוסע עיר |
| 19:01:35 | sentence | **50.7** | אוטובוס **אטי** היום |
| 19:01:54 | listen | 19.1 | איפה אוטובוס עיר |
| 19:02:14 | sentence | 19.7 | נוסע אוטובוס עבודה |
| 19:02:24 | sentence | 10.2 | אוטובוס חדש |
| 19:02:37 | sentence | 13.3 | רחוב |
| 19:02:49 | listen | 12.3 | נוסע עיר |
| … | compose ×4 | | the walk home |
| 19:07:00 | sentence | 18.7 | אמא אישה=0 |
| 19:07:05 | chunk | 5.2 | לילה טוב |
| 19:07:31 | sentence | 26.0 | סבא אוהב ספר |
| 19:09:25 | sentence | **89.5** | חושב **יפה**=1 |

The median card is 13.3 seconds. **The three longest cards of the evening — 180s, 89.5s
and 50.7s, 5.3 minutes of the 9.4 — are exactly the three cards he flagged.** Two of them
are the same אטי card served twice; the third is the יפה card.

So the session is not long because it holds too many cards. It is long because a handful of
cards where the app wrongly disputes him each burn a minute or more, and he sits there
arguing with it. Phases 1 and 2 below are session-length work as much as Phase 3 is.

Two further facts from his synced state:

**The homophone is already in the data.** Three library entries, three identical
transliterations:

| word | tr | English | shelf |
|---|---|---|---|
| אטי | `iti` | slow | focus |
| איטי | `iti` | slow | reserve |
| איתי | `iti` | with me | reserve |

The recogniser heard איתי — a real word he is learning, that sounds the same as the one he
was asked for. He said it correctly. `nearEnough` compares letters and fails. And
`learnAdjudicatePrompt` then instructed the model to decline exactly this case: *"If the
transcript shows something genuinely different at that point … leave the index out."* A
homophone **is** something genuinely different. The judge obeyed and marked him down. That
is why it is "the same mistake as before".

**The second opinion is barely earning its keep.** From `hvr_stats`:

| day | calls | words asked | rescued |
|---|---|---|---|
| 09-01 | 2 | 3 | 3 |
| 09-02 | 12 | 14 | 3 |
| 09-03 | 7 | 10 | **0** |
| total | 21 | 27 | 6 (22%) |

Zero errors, zero arrived-too-late. It is cheap and it is not the problem — but it rescued
nothing at all today, including the אטי card it exists for. These numbers are the baseline
Phase 1 has to beat.

**And the English really is ambiguous, systemically.** An audit of all 536 library entries
found 42 English glosses shared by two or more Hebrew words. Three words carry "nice"
(יפה, נעים, נחמד); six carry "to wear". On `נוסעים לעיר בבוקר` — *"We travel to the city in
the morning"* — he said **anachnu holchim**, a defensible rendering, and was graded 0.
נוסע took two zeroes today and its difficulty climbed 5.5 → 7.1.

Fixing 42 glosses is the approach he rejected, and he is right to: it makes the English
*more precise*, which is the opposite of *fluid*. The gloss is not going to become a
one-to-one map of the Hebrew, because there isn't one. The app has to be able to accept an
answer that is fair without the English having predicted it.

## The shape of the whole thing

Three phases, one spec, one push. They share a principle already written into this file
and load-bearing at [hebrew-reader.html:25300](../../../hebrew-reader.html):

> Note the asymmetry, which is deliberate and load-bearing: NOTHING here can mark a word
> wrong. Every layer can only ever soften a miss. A false "you got it" costs one review; a
> false "you got it wrong" costs the word's difficulty, its interval, and his trust in the
> grading.

Everything below softens. Nothing below can mark a word wrong, and nothing below can raise
a mark to "got it" — `nearly` is the ceiling, because "this counted, but not cleanly" is
the honest verdict for both a mishearing and a fair-but-different answer.

---

## Phase 1 — the app learns what sounds alike

**The mechanism is the transliteration, and it is already there.** אטי, איטי and איתי all
carry `tr: "iti"`. Two words that sound the same already collide on a field the app
maintains for every word, under a scheme `CLAUDE.md` describes as non-negotiable. Nothing
needs to be authored.

A new local layer, `heSoundAlike`, runs inside `learnScoreSpoken` immediately after the
existing runners-up layer — before anything reads `status`, so the wrong mark never reaches
the screen at all. For each expected word still `missed`, if any word in the transcript or
its alternatives sounds the same, the mark softens to `near`.

Two tiers, deliberately unequal in confidence:

- **Tier 1, transliteration.** Both words known to the library or the built-in dictionary,
  and their normalised transliterations match → homophone. Normalisation lowercases,
  strips `'`, `-` and spaces, folds `ch` → `kh` per the house scheme, and splits on `/` so
  a stored pair like `yafe/yafa` compares either form. This is exact and catches the
  אטי/איתי case today with no false positives available to it.
- **Tier 2, consonant skeleton.** Only reached when the heard word has no known
  transliteration — a word outside his library, which Tier 1 cannot speak about at all.
  Final forms fold to their base, genuinely identical modern Israeli sounds fold together
  (ט≡ת, כ≡ח, א≡ע, ב≡ו), and the ambiguous vowel letters א ה ו י are dropped. This
  over-collides — בית and בת both reduce to `bt` — and that is accepted, because the cost
  of a false collision here is exactly one `nearly` on a word he was asked for and did not
  cleanly produce, against the cost the asymmetry above exists to prevent.

The AI second opinion keeps its place as the backstop for what sound alone cannot explain —
a swallowed prefix, a wrong declension — but its prompt is corrected on the point that made
it decline today. It is told that a different word which *sounds the same* is strong
evidence he said it, because recognisers substitute the commoner spelling, and it is given
the expected word's transliteration so it can compare sounds rather than letters. It keeps
"be conservative" for text that genuinely sounds different.

A new stat, `homoWon`, counts words rescued locally by sound, so Phase 1's effect is
measurable against the 22% baseline rather than asserted.

## Phase 2 — grace on a fair answer

Sound cannot help with **anachnu holchim**. He did not mishear or mispronounce anything; he
produced a different, defensible Hebrew sentence for the English he was shown. Only
something that understands meaning can say so.

After the word-level adjudicator has resolved and if misses remain, one further fast call
asks a different question: *is what he said a reasonable Hebrew rendering of this English?*
It fires only on `sentence`, `word` and `chunk` cards (a `listen` card tests comprehension
and `compose` has its own coach), only when he actually produced something — two Hebrew
words for a sentence, one for a word card — and never when nothing is still marked missed.

On a fair answer it does two things:

- **Softens the remaining missed marks to `nearly`**, through the same path the adjudicator
  already uses: `learnMarks` on a card with chips, `learnSuggested` on a card graded whole.
  Never to "got it". He did not say נוסע, and the record should not claim he did — but
  neither should it charge him the full price of a word the English admitted he could skip.
- **Says what the distinction was**, in one line on the card: *"What you said works — but
  this one wants נוסע: travelling by vehicle."* This is the other half of what he asked for
  — "whether that's in how the sentence is shown to me" — delivered at the moment it
  matters, to the one word it matters for, instead of rewriting 42 glosses against a
  precision the language does not have.

Stats `graceCalls` and `graceWon`, for the same reason Phase 1 has one.

## Phase 3 — a node session is ten cards

`CAMP_SESSION_CARDS` 14 → 10, which is his 30% exactly. Single-word cards stay as they are:
they only appear when a node has genuinely weak words, and he has said their absence is
correct once he has seen the words.

The three slices shrink with it, and the ratio they encode is preserved rather than
recomputed, because the ratio is the design — the comment above `CAMP_SESSION_CARDS`
records that widening and lengthening together once handed half a node session to words the
node was not about:

| | now (14) | after (10) |
|---|---|---|
| `CAMP_SOLO_CARDS` — one clean look at each stuck word | 2 | 2 |
| `CAMP_CARRY_CARDS` — sentences carrying a stuck word | 5 | 3 |
| `CAMP_OWN_CARDS` — consolidation on the node's own words | 4 | 3 |
| `CAMP_WIDER_CARDS` — debt and stretch | 3 | 2 |
| the node's own share | 11 of 14 (79%) | 8 of 10 (80%) |
| stuck-word cards | 7 of 14 (50%) | 5 of 10 (50%) |

Slice 3c already refills any shortfall, so a thin bank behaves as it does today.

## Testing

Phase 1's two tiers are pure functions over plain inputs and get direct tests: אטי/איתי
must collide on Tier 1, אטי/איטי likewise, and a genuinely different pair — נוסע against
הולך — must not, on either tier. A test drives `learnScoreSpoken` with a synthetic
transcript and asserts the mark softened without the AI being reachable.

Phase 2's trigger conditions are testable without a network: the gate that decides whether
to ask at all is a pure predicate over card kind, transcript and remaining misses, and is
tested for each of the cases it must refuse — the empty transcript, the listen card, the
card with nothing missed.

Phase 3 is arithmetic: `campBuild` against a stocked bank must return ten cards, and the
slice counts must match the table above.

Per `CLAUDE.md`: any test that stubs a global or writes to a real store restores it in a
`finally`, and async tests run one at a time.

## Deferred, with reasons

- **Rewriting the 42 colliding glosses.** Considered and rejected by George: the English is
  fluid and making it more precise is the wrong direction. Phase 2 is the alternative.
- **Merging אטי and איטי into one library entry.** They are two spellings of one word and
  both hold SRS state. Phase 1 makes them harmless to each other, which is most of the
  value; merging risks the schedule for a tidiness gain. Left alone deliberately.
- **Showing the disambiguating gloss on the card up front.** Would need the gloss work
  above to exist first. Phase 2's note delivers the same information at the moment it is
  needed, and only when it is needed.
- **Shortening the daily session.** `SESSION_CARDS` is 15 and untouched: he asked about
  nodes specifically, and the evidence points at card cost rather than card count anyway.
- **The 5-day-old flag's "load of images that's not being employed".** No image assets
  exist in the repository beyond `icons/`, so this cannot be acted on without knowing what
  it refers to. Open question, not deferred work.
- **Its "preload 2-3 lessons in advance" half.** Overtaken by the prebaked node content
  shipped 08-31; nodes now carry 27–84 servable items each, which already is several
  sessions deep.

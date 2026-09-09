# The recogniser repeating itself

## Where this came from

Two flags, three minutes apart, mid-session on 2026-09-09.

> "Some serious glitch occuring with the detection here"

> "Yeah there's some big going on. I've tested with using the microphone on my
> keyboard to speak English and it's working hence this text right now.
> ואני לומד עברית I also just changed my keyboard language to Hebrew and tested
> the microphone on that and as you can see it worked normally so it's in the app"

He had already done the bisection himself: the device's own dictation hears
Hebrew fine, so the fault is this app's use of the Web Speech API.

Both flags carry `ctx.ai`, and the adjudication prompt in it is the whole bug in
one line. Asked to say `סבתא שלי שותה תה בבוקר`, the recogniser was recorded as
having heard:

```
סבתאסבתא שליסבתא שליסבתא שליסבתא שליסבתא שליסבתא שלי שותהסבתא שלי שותהסבתא שלי שותה תהסבתא שלי שותה תה בבוקרסבתא שלי שותה תה בבוקר
```

That decomposes exactly — reconstruction is byte-for-byte — into eleven
snapshots of the same phrase, each one the previous one grown:

```
סבתא · סבתא שלי ×5 · סבתא שלי שותה ×2 · סבתא שלי שותה תה · סבתא שלי שותה תה בבוקר ×2
```

The second flag's card is the same shape (`זה · זה היה ×2 · זה היה ממש ×2 · זה היה ממש כיף ×2`).

The cost is not cosmetic. That first card graded `{"said":[0]}` — one of four
words credited, on a sentence he said correctly and completely. Every production
card he has spoken since yesterday afternoon has been marked against a transcript
like this.

## Root cause

`micRecGet`'s `onresult` rebuilds the utterance by concatenating **every** entry
in `e.results`:

```js
for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
```

`isFinal` appears nowhere in the file. That idiom is only correct on an engine
that *replaces* an interim result in place as it firms up. Chrome on Android
instead appends each interim as a **new** result entry carrying the whole phrase
from the start, so the loop concatenates eleven overlapping copies of one
sentence.

It only started biting yesterday. `8b0a28e` (2026-09-08) gave the drill card
`continuous = true` so the mic would wait for him instead of letting Chrome's
endpointer cut him off — which is the right change, and it is what first put this
code in front of Android's continuous-mode behaviour. The coach dock, still
`continuous = false`, was never affected; nor was the keyboard, which is a
different code path entirely.

The same blind concatenation runs at two more seams, and both must be fixed or
the bug simply moves: the restart boundary in `onend`
(`b.carry = carry + " " + best`) and `gather()`'s final join of carry and best.
A restart mid-sentence re-emits from the start too, so carry and best overlap by
construction.

## The fix

One pure function, `micGrowJoin(a, b)`, taking and returning `{ text, segs }`,
applied at all three seams:

- `b` empty → `a`; `a` empty → `b`.
- `b` is `a` grown (word-boundary prefix, whitespace-flattened) → **`b` replaces
  `a` outright**, segments included. `b`'s own result carries alternatives for
  the whole phrase, so `a`'s are subsumed, not lost.
- `a` is `b` grown → keep `a`; a shorter snapshot arriving late is stale.
- Identical → keep `a`.
- Otherwise → genuinely different segments, so join with a space and concatenate
  the segment lists, which is what desktop Chrome produces and what the current
  code already does correctly.

The word-boundary guard matters: without it `תה` is a prefix of `תהילה` and a
real second word would be swallowed as a snapshot.

Folding `e.results` through this function leaves spec-compliant engines exactly
where they are — successive finals are not prefixes of each other, so every
comparison falls through to the join — while collapsing Android's snapshot
storm to the one sentence he said.

Joining with a space rather than `+=` also fixes the missing separator visible
in the transcript above (`סבתאסבתא`); the flatten collapses the double space an
engine that already supplies a leading space would produce.

## Tests

Driven by the real data, not by what I believe the API does: the eleven-snapshot
sequence from the first flag and the seven-snapshot one from the second, each fed
through the fold, each asserted to come back as the single clean sentence — plus
a desktop-shaped sequence of distinct finals asserted to still join in order, and
`תה` / `תהילה` asserted not to collapse.

## Deferred, with reasons

- **Filtering on `isFinal`.** The obvious textbook fix, and it is not enough on
  its own: the evidence shows snapshots repeating *identically* (`סבתא שלי` five
  times), which an interim/final split does not explain and would not collapse.
  Prefix-collapse subsumes it and needs no faith in what the engine labels.
- **Dropping the recogniser reuse / rebuilding per card.** Reuse exists to stop
  the `file://` mic prompt reappearing every card. Nothing in this evidence
  points at it, and changing it would re-open a problem that is currently solved.
- **A genuinely repeated final word** (`תה תה`) still collapses to one. Real, and
  worth far less than the bug it buys out; a drill sentence that repeats a word
  immediately is rare, and the alternative is what he saw today.

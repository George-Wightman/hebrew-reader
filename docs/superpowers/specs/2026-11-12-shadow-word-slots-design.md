# Shadow cards show their words as slots

## Where this came from

A flag on 2026-11-12, on a "Say it back, exactly" card for החבר שלך גבוה!: *"I'm not sure
why it marked me wrong here."* The mic had written down **"you friend is tall"**. He had
given the meaning, which is what the card before it (a "Hear and answer" card) had asked
for.

Asked about it, George said:

> "When it's, okay, I'm showed an audio clip and it's either, what does this mean? Or …
> just repeat it back. Like there's no visual difference there … I look straight at okay,
> there's an audio clip, there's a text box. That's all I see … I just respond to what it
> looks like."

And when offered word slots: *"I think the word boxes is the best idea."*

## What is wrong now

Both kinds open the same way: a speaker and "slowly" in the middle of the card. The only
difference is further down. A listen card has an English text box and "Check it", and a
shadow card has only "Say it". The Atlas redesign counted on that difference to tell the
two apart (see the comment above `meta.ask` in `learnRenderCard`). For him it doesn't
work: the audio row is what he sees, and he answers from that before he gets to the rest.

## The change

**The shadow card shows one blank slot per Hebrew word, under the audio row, right to
left.** החבר שלך גבוה! is three slots. A long word gets a long slot and a short word a
short one, so the shape of the sentence shows without its letters.

- **It fills as he speaks.** The recogniser's words go into the slots in order, starting
  from the right. This replaces the separate "Listening" transcript box on this card,
  though the little Listening / Paused label stays. Words beyond the last slot are added
  as extra slots marked as extras.
- **English shows up as wrong.** If a word comes back in Latin letters, its slot is
  marked with `--bad`, so "you friend is tall" looks wrong on screen as he says it.
- **The slots go when the answer is shown.** From then on, the revealed Hebrew and
  "What it heard you say" are the record. Showing the slots as well would be two signals
  for one thing (style guide §4).
- **Nothing else changes:** grading, the mic flow (Pause, Submit, Keep going), the hint
  ladder, and the listen card.
- **No Hebrew voice:** the card already prints the transliteration, so the slots are
  left out.

This follows style guide §4, "the arrangement carries the meaning". The card's layout
says "fill these Hebrew words" without a new label or badge.

## Deferred, with reasons

- **Colouring cards by the language you answer in.** It would work for every card kind,
  but it needs a colour he has to learn, and colours already have fixed jobs here (§3).
- **Starting the mic automatically on shadow cards.** This would make the card act
  differently, which is a stronger signal. But on the Pixel the mic and other audio don't
  run well together (`micNeedsStreamHold`), so it is riskier. Worth revisiting if slots
  aren't enough.
- **Filling slots by alignment rather than order.** `learnScoreSpoken` aligns the words
  only after Submit. While he is still speaking, filling in order is what he can follow.

## Also shipped the same day (already committed)

- `21c8f37`: the coach gives Flash 10 seconds with minimal thinking, then asks Lite.
- `443ebb6`: only Claude's sentences are served (`BANK_CLAUDE_ONLY`), and the phone no
  longer writes scenes.

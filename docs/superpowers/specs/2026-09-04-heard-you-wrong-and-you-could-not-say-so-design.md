# It heard you wrong, and you could not say so

## Where this came from

George, picking four items off a QoL list:

> Dont care for dark mode. But the other points I absolutely want to incorporate, I thought
> I had already done this, maybe it was talked about but got side lined. Specifically
> Homophone disambiguation instead of a wrong mark, That's not what I meant" as one tap on
> any card., Nuance at the moment of confusion.,

And on the fourth, with a condition and a requirement attached:

> Alternating the two API keys. is something that makes sense to me, like we dont need to
> jsut hammer 1 key, but if it introduces innefficiency in hte calling hten its not needed,
> but if its somehting that you think would help at all then absolutely add it, both keys
> areto be used or sure. Just make sure its recorded what key is used when and for what so
> the usage is stored per key not global

The instinct behind all four is one he has been circling for a fortnight, across five
separate flags: **the app decides something about what he said, and he has no way to
answer back.** Twice about `iti`/`ati`, twice about a gloss not carrying the nuance
(`nos'im`, `naim`/`yefe`), once about the coach speaking gibberish.

## What the code actually said

**"I thought I had already done this" is very nearly right, and the exception matters.**

Two of the four shipped on 2026-09-03 and **have never once run**:

- `heSoundAlike` softens a `missed` mark to `near` locally, in front of the screen, when
  the recogniser's output is a sound-alike of the target. No network, arrives with the card.
- `learnGrace` asks whether what he said was a fair alternative, softens the mark, and
  writes one line on the card naming what the wanted word meant that his did not. That IS
  "nuance at the moment of confusion", built and shipped.

His own stats say neither has fired. Across every recorded day: `adjCalls` 21 and `adjWon`
6 for the older adjudicator, and **`graceCalls`, `graceWon` and `soundWon` absent
entirely** — the counters have never been incremented. The reason is mundane rather than
alarming: those commits landed at **21:02 and 21:08 on 2026-09-03**, and there is no
practice row for 2026-09-04 at all. He opened the app this morning (sync stamped 08:12),
raised a flag, and stayed on the front door.

So this spec does **not** rebuild them. It is written on the assumption they work, and the
first real session is what tests that.

**What is genuinely missing is the answering back.**

- **The rescue only ever reaches `near`.** Both `heSoundAlike` and `learnGrace` write
  `"near"`, and grace's grade nudge is `learnMarks[i] = 2` — Nearly. So when the recogniser
  mishears him and the app catches it, he is still docked for a word he said correctly.
  There is no path to "I said the target."
- **There is no card-level flag.** `flagModalOpen(true, …)` is called from exactly two
  places: the nav button and Under-the-hood's *Flag this*. Mid-card, the only way to record
  a thought is to leave the card, open a modal and type.
- **Grace is silent when it declines.** `if (!out || out.fair !== true) return;` — a `note`
  is only ever shown on the `fair: true` path. When the app decides his answer was NOT a
  fair alternative, he gets no reason at all, and that is the more common case and the one
  where "why is my word wrong?" actually lives.

**And the second key is a fallback, not a peer.** `geminiSend` loops model-outer,
key-inner:

```js
for (const model of (models || GEMINI_MODELS)) {
  for (let ki = 0; ki < keys.length; ki++) {
```

so key 1 takes every request until it fails. Worse, `aiQRecord` counts per **pool**, not
per key:

```js
const pool = aiPoolFor(model);
q[pool] = (q[pool] || 0) + 1;
```

Two consequences, and the second is the one that costs him something today:

1. The per-minute limit — the one `CLAUDE.md` says actually bites — is **per key**. Starting
   from alternating keys roughly doubles the burst headroom for free.
2. The daily caps are per key too. `AI_POOL_CAPS` is `{ strong: 20, fast: 500 }` **per key**,
   so with two keys the real budget is 40 and 1000 — but `aiStrongLeft()` subtracts a single
   global counter, so `aiModelsFor` degrades everything to Lite at 20. **The app is
   currently throwing away half its strong budget because it cannot tell the keys apart.**

His condition — *"if it introduces innefficiency in hte calling hten its not needed"* — is
met: choosing which key to start from costs nothing. No extra request, no extra round trip,
no added latency. The fallback chain is unchanged; only its starting point moves.

## The design

### One control on the card, and what it is depends on what happened

Chosen deliberately over two controls. Style guide §4 records that this card lost a glyph,
a label and a direction pill to *one signal, not four weak ones*, and two new controls would
put back most of what that argument removed. One control, whose job is always the same thing
in his terms — **"the app got that wrong, let me say so"** — and whose behaviour follows the
card.

**When a sound-alike rescue fired**, it is a choice, because the app already knows exactly
what the ambiguity was:

> Did you say **ati** (slow) or **iti** (with me)?

Two taps' worth of options, transliteration first with the English in brackets — the form he
reads, and it keeps a mixed-script run out of a line where there is no element to isolate it
(the reversal bug measured on the node sheet this week is the standing reason).

Tapping the target sets that word's status to correct and lifts the suggested grade. Tapping
the other leaves the mark alone: he did say the other word, and the app was right.

**Otherwise** it reads *That's not what I meant*, and one tap does two things at once:

- **Asks the coach why**, on the fast pool, with the card's own state — the target, what the
  recogniser heard, the English he was shown, and the marks. This is the on-demand half of
  "nuance at the moment of confusion", and it fills the gap grace leaves when it declines:
  the explanation is available for a wrong answer, not only a rescued one.
- **Files a flag**, with the full card context, no typing. His own ask was *one tap*, and
  the reason he asked is that a thought arriving mid-card currently costs a modal and a
  keyboard.

The coach's answer is appended to the flag once it arrives, exactly as `uhAnswerText`
already rides the flag from Under-the-hood — so when it reaches me I can see what he was
told, and correct the app rather than arguing with a prior I cannot see.

### The upgrade is not new authority

Worth stating plainly, because "he can mark himself correct" reads like a hole in the
scheduler.

He already grades himself on every card: Missed / Nearly / Got it are his, and always have
been. This control gives him **less** latitude than those buttons, not more — it offers two
specific words the app itself proposed as the ambiguity, and the only thing he can assert is
which of them came out of his mouth. `srsAnswer` is written from the resulting grade exactly
as it is today, through the same path, with no new grade value and no bypass.

What it changes is the *evidence*: a word rescued to "Nearly" says "something went wrong and
we are not sure whose fault it was", where a resolved pair says "the recogniser was wrong and
he was right" — which is a truer thing to feed a scheduler that is trying to measure him.

### What the card records

The pairs have to be captured where the rescue happens, because that is the only place both
sides are known:

```js
learnSpoken.soundPairs = [ { i, expected, heard } ]   // one per rescued index
```

`i` is the index into `expected`, so the upgrade knows which mark to lift. `soundWon` stays
as it is — it is the measurement that tells us whether Phase 1 of the 09-03 work is doing
anything, and this spec deliberately does not disturb it.

### Per-key accounting, and why it is also a budget fix

The ledger gains a per-key breakdown alongside the totals it already keeps:

```js
{ day, strong, fast, spent: {},
  keys: { "<id>": { strong, fast, spent: {}, last: { at, label, model } } } }
```

**The id is never the key.** It is the slot (`k1`/`k2`) plus a short non-reversible hash, so
that replacing a key resets its own counter instead of inheriting the old one's, and nothing
resembling a secret is written to a store that syncs. `SYNC_NEVER_SET` already keeps the keys
themselves off the wire; this must not undo that.

`last` is the *"what for"* he asked for: the label the call was made under (`"The coach — a
question"`, `"Writing you practice for…"`) and when. One entry per key per pool rather than a
history — the AI log already keeps twenty full entries, and a second history would be two
places to look.

**Which key starts** is chosen by headroom: the key with the most left in the pool this call
will use, ties broken by rotation so two identical-headroom keys alternate rather than
sticking. The existing fallback chain is untouched — on failure it still walks every key and
then every model — it simply no longer always begins at key 1:

```js
for (let n = 0; n < keys.length; n++) {
  const ki = (start + n) % keys.length;
```

**And `aiStrongLeft()` becomes the maximum across keys rather than a global subtraction.**
That is the budget fix: `aiModelsFor` currently sends everything to Lite once twenty strong
requests have gone out in total, when in fact a second key may not have been touched.

## Phases

Each stands alone and can be reverted alone.

**Phase 1 — the disambiguation.** Capture `soundPairs` where `heSoundAlike` rescues, add the
contextual control, and make picking the target lift the mark and the suggested grade.

**Phase 2 — *That's not what I meant*.** The other face of the same control: the flag with
full card context and no typing, and the coach's answer on the fast pool, appended to the
flag when it lands.

**Phase 3 — per-key accounting and key choice.** The ledger shape, the id, the headroom
pick, `aiStrongLeft` across keys, and the AI panel reporting per key. Independent of the
other two and could ship first; ordered last only because the card is what he is waiting on.

## Testing

Pure functions driven with plain objects, per the suite's standing rule on store isolation.

1. **A resolved pair upgrades exactly one mark** — picking the target sets that index to
   correct and leaves every other index alone, including a second word that grace had
   separately softened.
2. **Picking the other word changes nothing** — the mark stays where the rescue left it, and
   no grade is suggested.
3. **`soundPairs` carries both sides and the index** — a rescue records the expected word and
   the heard word, and a card with no rescue records an empty list rather than undefined.
4. **The control's face follows the card** — a spoken state with pairs yields the choice, one
   without yields the report, and a card with no mic at all yields neither.
5. **The flag carries the card without typing** — the filed context includes the target, the
   transcript and the marks, and survives a card whose item is missing fields.
6. **`aiKeyId` is stable, slot-aware, and reveals nothing** — the same key yields the same id
   twice, two keys yield different ids, a replaced key in the same slot yields a new id, and
   no substring of the key appears in it.
7. **`aiQRecord` counts per key and in the totals** — one call against `k2` raises `k2`'s
   pool count and the global one, and leaves `k1` at zero.
8. **The headroom pick prefers the emptier key and alternates on a tie** — and a key Google
   has refused (`spent`) is never chosen while another has room.
9. **`aiStrongLeft` is the best key, not the sum** — twenty on `k1` and zero on `k2` still
   reports strong headroom, which is the bug that was silently halving his budget.
10. **An old ledger with no `keys` field is survivable** — `aiQTidy` fills it rather than
    throwing, and the day's rollover clears it.

## Deferred, with reasons

**Rebuilding `learnGrace` or `heSoundAlike`.** Both exist, both shipped 2026-09-03, and
neither has run once. Rewriting a feature that has never been given a session would be
guessing at what is wrong with it. The first real practice after this ships is the test; if
`soundWon` and `graceCalls` are still zero a day later, THAT is the bug to chase, and the
counters were built to answer exactly this question.

**Making the coach's explanation automatic on every wrong answer.** It would be one lite call
per miss, on a card he may simply want to move past, and grace already fires unprompted on
the fair-alternative case. On demand is the version that costs nothing when he does not care.

**A free-text note on the card control.** The whole point of the ask was *one tap* and no
keyboard mid-card. The nav flag still exists for a thought that needs sentences.

**Parallelising calls across the two keys.** Deferred three times before and still deferred:
this spec makes the keys peers for *starting* a request, which is the free half. Genuinely
firing two requests at once is a different change with its own failure modes, and nothing has
yet measured a burst that needs it.

**Letting him correct the transcript by typing it.** Considered — the pad already has a
translit-to-Hebrew path — and rejected for the same reason as the free-text note: this
control exists because typing mid-card is the thing he was avoiding.

**A per-key history rather than one `last` entry.** The AI log already keeps twenty full
entries with model, timing and outcome. A second history would be a second place to look and
a second thing to keep in step.

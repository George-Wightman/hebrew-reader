# Say it your way: prompt cards, and talks written in advance

## Where this came from

George, after the first real sit-down:

> I like the format, I like the longer, I like the structure of it, but throughout the
> conversations are kind of shit... it failed earlier on when I was doing the sit-down
> session... I find them just quite janky, and I mean, it's not like having a
> conversation with a person, right?

And on what should replace them:

> I like the idea of it being a prompt. It doesn't tell me what to say, it tells me what
> to talk about... My only worry is that if I give a response that's not exact or like
> close enough... it's impossible to progress unless I say the exact same thing... So it
> needs to be flexible enough not to break at me saying something slightly incorrect or
> just off, or like near enough.

> Tell somebody how you're feeling today... scenario questions that I need to give a
> response to. The only thing is then, how do we get the answers and how do we make it
> robust enough that it doesn't rely on an API call every single time.

## What the evidence said

- **The live coach failed today for a plain reason.** `hvr_health`: 44
  `model-downshift` flash → flash-lite on 2026-10-26 and a `pool-downgrade`. "Reading
  your sentence" took 31s.
- **When it worked, it didn't listen.** Friday's saved talk: he said `avadti im khavera
  sheli` and the coach answered `amarti mashehu matzkhik?` ("did I say something
  funny?"). It also asked `im mi avadti sham?`, getting the person wrong. The coach is
  told to work in the node's words, so it steers by its word list rather than by what
  he said.
- **The rigidity he remembers is real, and it's on record.**
  `2026-08-27-live-conversation-design.md`: scripted turns with 2–3 `alts`, marked by
  word overlap, scored a better answer the same as a wrong one. This design must not
  rebuild that.
- **Self-marking already has a home.** The `reply` card ("Answer them") has no single
  right answer, so `learnMicGrades` leaves it out and he marks it himself.
- **It is too hard right now.** 7/31 clean today and 39% over five days. Prompts must
  stay inside words he already has.

## The rule: three questions, none of them "was it right?"

Every prompt card asks only these, and none of them needs the network:

1. **Did he speak Hebrew?** Any transcript of two or more Hebrew words. That is the rep,
   and the card always moves on after it.
2. **Did the target words come out?** Each target word is looked for *anywhere* in the
   transcript, with `nearEnough` / `heSoundAlike`, the way sentence cards already
   tolerate the mic. Order and the other words don't matter.
3. **Did it mean the thing?** He decides. After he speaks, his transcript sits beside
   2–3 example answers and he taps **Got it / Close / Not really**. The tap is
   preselected from question 2: every target heard → Got it; some → Close; none →
   Not really. Mostly it is one confirming tap.

**What feeds the memory schedule:** only the target words, from question 2. A target the
mic heard is clean. A target the mic missed, when he tapped Got it, counts as `nearly`.
That's the existing asymmetry: a wrongly forgiven word costs one `nearly`, while a wrong
miss costs his trust. Any other target he missed counts as missed. Words outside the
targets are never touched, so saying more never costs anything.

**Never stuck.** One attempt, then the examples show, then he taps and moves on.
"Try again" is offered but never required.

## Phase 1 — the prompt card

A new card kind `prompt` (`LEARN_KINDS`: 🗣 "Say it your way", EN → עב, flow out). The
content is a new item type in `content/nodes.json`:

```js
{ type: "prompt", mode: "say" | "ask" | "react" | "open", for: "<node>", lvl,
  en:      "Tell her you went into town yesterday",      // the situation, not a sentence
  hear:    { he, tr, en },                               // react only: the line he answers
  target:  ["הלכתי"],                                    // 1–2 library words; [] for open
  examples:[{ he, tr, en }, ...] }                        // 2–3, shown after he speaks
```

The modes:

- **say**: a situation in English, answered his own way. The main one.
- **ask**: "Ask her where she was." Fills the gap that he only ever answers.
- **react**: a Hebrew line plays and he responds ("say something nice about it").
- **open**: "Tell someone how your day was." No targets and no memory-schedule effect;
  marked by his tap only.

**Where it appears:** the daily build swaps up to 3 sentence cards for prompt cards, only
when every target word is already ready (`wordReady`). Sessions stay the same length.
`open` appears only inside talks.

**Marking UI:** the same mic as the sentence card. Afterwards come his transcript with
any target heard shown in bold, then the examples (tap to hear them), then the three
taps.

## Phase 2 — talks written in advance

A new `talks` list in `content/nodes.json`, one or more per node, written by me during
content top-ups and checked by the same within-reach rule as scenes (`sceneAcceptable`).

```js
{ node, title, speaker: { name, he },
  turns: [ { they: { he, tr, en } },
           { you:  { mode, en, target, examples },          // a prompt card's fields
             then: { yes: {he,tr,en}, no: {he,tr,en}, any: {he,tr,en} } }, ... ] }
```

- **Their lines** play in the phone's voice, in bubbles on one side. The side is fixed
  by speaker, which also fixes his flag about messages switching sides.
- **His turns** are prompt cards inline: the same three questions, marked the same way.
- **Feeling of being listened to, without the API.** If the transcript contains `ken`,
  the `yes` line follows; if it contains `lo`, the `no` line; otherwise the `any` line.
  `any` lines are mostly short reactions (`yofi`, `be'emet?`, `a, nekhmad`) that fit any
  answer.
- **In the sit-down,** the "Talk it through" part plays the current node's talk. If the
  node has none, the part becomes 3 prompt cards instead. The sit-down no longer calls
  the live coach at all. The live coach stays where it is on the map, as an optional
  extra.

## Phase 3 — what he said, kept and reviewed

- **`hvr_said`**: every prompt transcript `{at, id, said, tap, hit}`, capped at the last
  150 entries and synced. This lets me harvest good answers into `examples` at the next
  top-up, so the answers grow from his own speech.
- **After-session review, optional.** On the end screen, when there is a key and a
  connection, one call reviews the session's prompt transcripts and lists "a more
  natural way to say it" for any that need it. If the call fails, nothing is shown and
  it is retried at the next end screen. Nothing in the session waits on it.

## Phase 0 — the three open flags, alongside

- Talk bubbles switching sides: fixed by Phase 2's fixed sides. It also gets a direct
  fix in the current coach view, since that stays on the map.
- A coach card showed Hebrew with no transliteration: fixed in the coach view.
- "Yesterday I worked only one day" is nonsense: retired from the bank.

## Tests

- Marking is pure (`promptMark(item, transcript, lib)` → `{hit, suggest}`). It's tested
  on paraphrases that must pass, a target heard as a sound-alike, a target missing, and
  extra words costing nothing.
- The memory-schedule effect touches only target words. A missed target plus Got it
  gives `nearly`.
- Branch choice: `ken` gives yes, `lo` gives no, and anything else gives any.
- The sit-down builds with no key, offline, without the compose card.
- Content gate: a talk with an out-of-reach word is refused.

## Deferred, with reasons

- **"About you" prompts** (questions about his real life, with his true answers as
  examples). These are the best fit for meeting her family, but they need a one-off
  "about me" list from him first. Next, once Phase 1 is in.
- **On-phone AI that judges meaning** (an embedding model inside the app): 100MB+ to
  download, and so forgiving it wouldn't notice mistakes.
- **Gemini Nano on the Pixel:** not reliably available to web pages.
- **Live AI only when the offline check is unsure:** it brings back the dependency,
  and the after-session review gets most of the value.

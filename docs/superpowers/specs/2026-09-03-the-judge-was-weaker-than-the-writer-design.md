# The judge was weaker than the writer

## Where this came from

George, 2026-09-03:

> I was sat with my girlfriend who is a native hebrew speeker and she heard some of hte
> sentences that were being used/ produced and she sid htey were wrong/ not what a person
> would actually say. Can you review this accross the base, explain hwy that might be and
> highlight ways to fix it, I think it as in coach mode so using the API. but review the
> bakes content aswell. I get that at my level its hard to make it fit, but I dont want to
> be learning wrong

And, on the audit that came back:

> Im all over making that reviewer universal and stronger, I wnat to learn real things.

> Take off the constraints I would rather have sentences that make sense but contain some
> words Im not as familiar with(as long as Im scaffholded inthe process) that are reviewed
> and make real sense than the alternative.

> I think we go with the recomended strong coach, but I think we drop the process of using
> hte sentences that it makes, they arent good and dont compare to the ones you make. So
> lets drop that pipeline.

> I also think it owuld be feasable to use those 20 strong Api calls a day, build to use it
> but also build the infastructure to fll back on to the weaker mdoel and hte
> considerations that come with that (maybe 2 prompts one build one review, maybe it
> survives with the one prompt as with the stronger model We might need to do a ttest,
> perhaps programme a session like ive done before give it to me as a test and ill run it
> htrouh the api to give you some real data, jsut an idea)

## What the audit found, so it isn't re-derived

Read the code rather than assumed. The findings that shape this spec:

- **Every gate in the app is a vocabulary gate.** `commissionAcceptable`, `bankUnknowns`,
  `bankNearDuplicate`, `bankFrameFull` and `bankServable` all ask whether he knows the
  words and whether the shape has been seen before. None asks whether a person would say
  it. A sentence can pass all five and still be Hebrew nobody utters.
- **The one naturalness check is wired to three places and misses the two that matter.**
  `learnReviewItems` is called from `sentenceCommission`, `learnDraft` and
  `reviewExistingBank`. Not from `composeBank` (the coach's banked sentence) and not from
  `contentIngest` (all 330 pre-baked items).
- **The judge is weaker than the writer.** `learnReviewItems` runs `GEMINI_MODELS_FAST`
  (Flash Lite first); `sentenceWriteOne` runs `GEMINI_MODELS` (Flash first). A weaker
  model is asked to catch a stronger one's naturalness errors.
- **Coach mode runs Flash Lite** and banks unreviewed. `composeTurn` passes
  `GEMINI_MODELS_FAST`; `composeBank` hands `best.he` straight to `learnIngest`.
- **The `generate-node-content` skill documents the hole and shrugs at it:**
  `learnReviewItems` "is not available from a fixture browser" because the keys never
  sync, offering "either skip it, or ask George to run the batch past it on his own
  device." It was skipped, three times, for 330 sentences.

Concrete damage in `content/nodes.json` v3, all verified against the file:

| Cluster | Count | Fault |
|---|---|---|
| `לבית` for "home" | 8 | Needs `הביתה`. `לבית` means "to the house (of)" and wants a possessor. |
| `הראש שלי כואב` | 9 of 12 | English word order. Hebrew is dative: `כואב לי הראש`. #190/#191 get it right — the bank contradicts itself. |
| `אני מרגיש חם` (#203) | 1 | Says "I feel hot to the touch". Wants `חם לי`. |
| Grammatical one-offs | 4 | `בעוד דקות` (#159, needs a quantity); `יש גשם` (#176, rain *falls*); `טסתי שבוע` (#294/#305, needs `לשבוע`); `אוהב לספר` (#117, missing object). |
| Hebrew ≠ English | 1 | #218 `הייתי שמח לראות אותך` banked as "I was happy to see you". It means "I *would be* glad to". |
| Mislabelled `listen` | 3 | #62/#63/#76 are questions in English with no `?` in Hebrew. #62 is also a byte-identical duplicate of #55 with a different meaning. |
| Grammatical, not said | ~12 | `הראש שלי מלא היום`, `היום אני מרגיש חדש`, `אני מרגיש נעים`, and others. |
| Two transliteration schemes | 330 | Split cleanly at index 77: `ha-cheder`/`achshav`/`ch` vs `hakheder`/`akhshav`/`kh`. |

## The architectural claim this spec rests on

**A cheap writer with a strong judge beats a strong writer with no judge.**

The judge sees the finished sentence and can simply say no. It runs once per batch of
~12 items, where the writer runs once per batch of 8 — so a strong judge is *cheaper per
item defended* than a strong writer, and it defends material that is then drilled for
months. `AI_POOL_CAPS.strong` is 20/day and `COMPOSE_TURN_CAP` is 8, so one coach
session on Flash is 8 of 20. That arithmetic only closes if the writer stops being the
expensive one.

---

## Phase 1 — The judge gets strong, and universal

### The problem

`learnReviewItems` is the only thing in the app that asks "would a person say this", and
it is both the weakest model in the pipeline and absent from the two paths that wrote
most of what his girlfriend heard.

### The change

- `learnReviewItems` takes `GEMINI_MODELS` (Flash first) instead of `GEMINI_MODELS_FAST`.
  It keeps `waitOnRateLimit: true` — it is background work behind a fire-and-forget
  caller, so waiting out a per-minute 429 beats being demoted by it.
- `contentIngest` routes its fetched batch through `learnReviewItems` before
  `learnIngest`. This runs on his device, where the key exists — which is precisely the
  gap the `generate-node-content` skill named and could not close from a fixture browser.
- The reviewer's reject list gains the concrete failures found above. Named examples are
  the highest-leverage lines in these prompts — "there is a big wind" is already doing
  more work than any abstract instruction near it — and every current example was
  invented rather than caught by a speaker. The new ones were.

The reviewer keeps its existing "a reviewer that rejects everything is more likely a
malformed reply than twelve broken items" fallback. That guard matters more now that it
gates content arriving from the network: a bad review response must degrade to *ingest
unreviewed*, never to *lose the batch*.

### Deliberately not changed

`reviewExistingBank` keeps working exactly as it does. It now inherits a stronger judge
for free, which is the cheapest possible improvement to the existing bank.

---

## Phase 2 — The coach gets strong, and stops writing permanent material

### The problem

Two faults in one path. The coach runs Flash Lite while issuing corrections and
modelling Hebrew he will imitate; and `composeBank` promotes its `best.he` into the
permanent bank with no review of any kind.

George's own read on the second: *"they arent good and dont compare to the ones you make.
So lets drop that pipeline."*

### The change

- `composeTurn` takes `GEMINI_MODELS`. **Still one call per turn** — this is the whole
  answer to the latency concern. Nothing is added to the round trip; the existing call
  gets a better model.
- `composeBank` is deleted, along with its call site. The coach teaches in the moment and
  no longer writes anything that outlives the session.

Deleting rather than reviewing is the right call and is worth recording. Reviewing
`best.he` would mean either a second round-trip inside the turn (the latency he objected
to) or an async call whose only product is a sentence he has already judged not worth
having. The pre-baked path writes better material for the same slot at no per-turn cost.

### The budget consequence

An 8-turn coach session is 8 of 20 strong calls. Handled in Phase 4, not here.

---

## Phase 3 — The vocabulary gate comes off ingest, and only ingest

### The problem

The writer is told: use only these words, one new one at most, hit this level, and an
empty batch is a failure. When the natural sentence needs a word he lacks, every exit is
closed and it writes the sentence it *can* write. That is how `הראש שלי מלא היום` is
produced, and the gate then passes it because every word in it is known.

George: *"maybe overloading hte writing is making it harder for it to do a good job … I
would rather have sentences that make sense but contain some words Im not as familiar
with (as long as Im scaffholded inthe process)."*

### The distinction that makes this safe

Two gates do different jobs and only one should move:

- **Ingest** — `commissionAcceptable`, `bankUnknowns`. Can a sentence enter the bank at
  all. Today: every word must already be in the library. **This is what strangles the
  writer, and this is what comes off.**
- **Serving** — `bankServable`. Can a banked sentence be shown *today*, given his SRS
  state. Already dynamic: a sentence too hard now becomes available later as its words
  strengthen. **This is the scaffolding, and it is untouched.**

A sentence carrying a new word is therefore not lost and not dangerous. It waits in the
bank until the word has been met through the existing soft-launch card, then becomes
servable on its own.

### The change

- `commissionAcceptable` permits up to `COMMISSION_NEW_MAX` (2) content words outside the
  scaffold and rescue lists, where today it permits zero. Every such word must carry a
  gloss entry — an unglossed unknown is still a reject, because a word he cannot look up
  is not scaffolded by anything.
- `bankUnknowns` stops being a reject in `learnIngest` for words the item declares. A
  declared new word routes through the existing `newWords` → `padIngest` path into the
  library and SRS, so it earns a word card like every other new word. An *undeclared*
  unknown — a word in `he` that appears in no gloss entry — is still rejected: that is
  the invented-Hebrew hole the current gate closes and it stays closed.
- `bankServable` unchanged. `bankItemSide`, `bankCarried`, `bankDifficulty` unchanged.
- The writer prompt is reframed. "EVERY OTHER WORD MUST COME FROM THIS LIST" becomes
  "write natural Hebrew first; prefer these words; any word outside them must be glossed
  and there may be at most two." The hard-gate paragraph stays — it is still a hard gate,
  the threshold has just moved off zero.

### The measurement that has to keep working

`genStat` counts Token Miss Rate — how often the writer used a word outside the list — as
the only local check that the prompt is still obeyed. Its meaning changes here: a
declared, glossed new word is now compliance, not a miss. `genStat` must count only
*undeclared* unknowns or it will read as a permanent regression the moment this ships.

---

## Phase 4 — The fallback shape, and the test that settles it

### The problem

Phases 1 and 2 both draw on a 20/day pool. One coach session is 8. A content commission
is a plan, a write and a review. They cannot all have Flash.

### The change

- `AI_STRONG_RESERVE` (6) — a floor on the strong pool that only `learnReviewItems` may
  draw below. The judge is the last thing to degrade, because it is the only thing
  defending permanent material.
- The coach spends strong above the reserve and falls back to Lite below it. A session
  begun with headroom finishes on the model it started on where possible; degradation
  mid-session is acceptable and silent.
- `sentenceWriteOne` becomes Lite-by-default. This is the inversion, and it is the change
  that makes the arithmetic close.
- **When the writer runs on Lite, the review pass becomes mandatory rather than
  best-effort.** Today `learnReviewItems` returns `data` unchanged on any failure. On the
  Lite path that fallback is wrong: an unreviewed Lite batch is exactly the material this
  spec exists to stop. It must retry once, then bank nothing. Two Lite calls against
  500/day cost nothing; that is the "consideration that comes with" the fallback George
  asked to have built.

### The test

Built as a standalone file, not shipped inside `hebrew-reader.html`. It runs the same
briefs three ways — Flash one-pass, Lite one-pass, Lite write-then-review — and prints
the results **shuffled and unlabelled**, so a grader cannot mark by expectation. George
runs it against his own key and returns the marks.

Its output sets one constant: whether the Lite path needs the second call, or whether one
pass survives. Shipping a guess here and calling it a design would be the same mistake as
shipping unreviewed sentences.

Until the data arrives, the mandatory-review-on-Lite behaviour above is the conservative
default.

---

## Phase 5 — Repairing what is already banked

### The problem

The corrections in the audit table are in `content/nodes.json`, but they are also already
in his on-device bank. `contentIngest` only ever *adds* — a corrected file leaves the
wrong sentence sitting in localStorage forever.

### The change

- **A `retired` array in `content/nodes.json`**, matched on exact `he`. `contentIngest`
  removes any bank item whose `he` matches, before ingesting the new batch. Matched on
  `he` rather than `id` because the ids were generated per-device at ingest time and are
  not stable across his phone and laptop.
- The 8 `לבית` items corrected to `הביתה`; the 10 dative items rewritten to `כואב לי` /
  `חם לי`; the 4 grammatical one-offs fixed; #218 corrected to `שמחתי לראות אותך`; #62
  removed as a duplicate and #63/#76 given their question marks or retired.
- The ~12 "grammatical but nobody says it" items retired outright. Deletion is free here;
  a false deletion costs one sentence.
- All 330 items normalised to the `kh` / joined-article scheme — 253 already use it, and
  it is closer to how Israelis write Hebrew in Latin letters. The six formal-register
  conjunctions (`va-ani`, `usmekha`, `ugvina`, `uva'erev`) become `ve-`.
- `version` bumped. The transliteration convention recorded in `CLAUDE.md` so the next
  batch does not start a third one.

### Why not regenerate

The clusters have mechanical corrections and the sentences are otherwise fine. Regenerating
would spend the pool to re-derive material that already exists and would lose the level
grades and `for` attributions attached to each item.

---

## Deferred, with reasons

- **A native-speaker review surface.** Proposed in the audit and cut by George: *"Shes not
  going to be sitting and reviewing htem drop number 3."* It remains the single
  highest-value change available if that ever changes — every gate in this spec is still a
  model checking a model.
- **Asking what grandad actually sounds like.** The whole bank is pitched at one person's
  voice notes and nobody has sampled his vocabulary. Out of scope here; worth its own
  spec.
- **Elo or IRT levelling.** Already deferred by the 2026-08-26 spec; nothing here changes
  that reasoning.
- **Retiring items by `id`.** Considered and rejected in Phase 5 — ids are per-device.
- **Reviewing the coach's live reply inline.** Rejected explicitly on latency; see
  Phase 2.

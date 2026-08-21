# Four fixes from a morning's real use — design

2026-08-21. George used the app on the Pixel and reported four things. Three of them turned
out to be outright bugs with identifiable causes, not tuning preferences; the fourth is a
grading rule that punishes harder than intended. None of them are in
`docs/audit-2026-08-20.md` — they are the kind of thing only daily use surfaces.

A fifth area he raised — conversation mode feeling **too rigid**, and whether tapping a
previous chat line should reveal its English — is deliberately **not** in this spec. It is a
design question he is still weighing rather than a defect, and it gets its own pass once
these land. See *Deliberately out of scope* at the bottom.

## The problem, four times

### 1. Path lessons make you wait for content that could have been ready

`pathGenerateContent()` caches permanently, but nothing ever calls it except
`pathStartLesson()`. Every first visit to a section pays the full generation latency at the
moment you press **Start lesson**, having already committed to practising.

George: *"when I unlock a level it should generate the content, not wait untill I click start
lesson."*

### 2. Conversation speaks your own answer back, then cuts itself off

Measured in the code, not guessed:

- On reveal, `playHe(answerKey, he)` speaks the **matched candidate** — the scripted version
  of the line you just said.
- **1100ms** later `learnAutoAdvanceTimer` fires `learnGrade()`, which advances to the next
  card, whose `playHe` calls `speechSynthesis.cancel()`.

So the app reads your own line back at you and is then interrupted mid-word by the reply.

George: *"for a second it starts saying my answer back to me, then it cuts and says its real
responce."*

### 3. The chat transcript shows the script, not you

`c._matched` is *the candidate the attempt was graded against*, and `convoThread` renders it
as your bubble. Your actual words exist — `learnSpoken.text` — and are used for grading, then
discarded for display.

The bubble therefore shows a plausible sentence you did not say. George: *"it says what the
conversation is modelled to expect, which is often not at all what I said."*

### 4. The same sentences come back forever

The bank sort:

```js
.sort((a, b) => (a.diff - b.diff) || (b.hits - a.hits) || ((a.it.seen || 0) - (b.it.seen || 0)));
```

`bankDifficulty` is `worst * 10 + words` — fine-grained enough that exact ties on *both*
`diff` and `hits` are rare. `seen` is therefore **incremented every session and effectively
never read**. The easiest servable sentences win permanently.

The precedent is already in the file. Voice notes hit this and were fixed, with the comment:
*"Notes rotate on their own counter — they aren't bank items and share none of the bank's
ranking. Without this the same note leads every session."* Bank sentences never got the
equivalent.

Compounding it: a missed word is scheduled `due = today + min(7, lapses - 1)`, so a first
lapse returns **today** and leads the next session's overdue block.

### 5. One bad answer punishes a good record

`srsApply` on grade 0 always does `stab *= 0.3`, `lapses++`, `diff += 1.1`, regardless of
history. Right, right, right, wrong loses 70% of a hard-won interval.

George: *"a more forgivving error, so getting something (right, right, right, wrong, right)
doesnt punish and treats the wrong as a one off."*

## Constraints

- **Quota is the binding constraint.** `pathGenerateContent` spends the 20/day strong pool
  plus a fast-pool review pass. Pre-warming must never quietly eat the transcription budget.
  The `hvr_ai_q` ledger added earlier today makes that spend visible and checkable.
- **Nothing may block or break the view.** Background work that throws must be invisible.
- **The pure functions get tests first.** The audit's F12 lesson — this app's worst bugs live
  in untested pure functions — applies to every rule below.
- **Sync properties hold.** Any new SRS field rides inside the existing per-side object and
  must not disturb `mergeSrs`'s commutativity.

## 1. Path pre-warming

On entering the Path view, warm **one** thing in the background. "Nearest" means **first in
path blueprint order** among sections that are unlocked and not complete — the same order the
map already renders, so the warmed section is the one visibly next rather than an arbitrary
pick:

1. The first unlocked, incomplete section with no cached content → `pathGenerateContent`.
2. If that section's content is already cached but its lesson-7 conversation is not →
   `pathConversation`.
3. Otherwise do nothing.

At most one request per path visit, advancing naturally as sections complete.

**Guards**, all three required:

| Guard | Why |
|---|---|
| Skip if `hvr_ai_q` says the strong pool is spent | An attempt that will 429 is pure waste, and the ledger already knows |
| One warm in flight at a time | Re-entering the view mid-generation must not double-spend |
| On failure, stop warming for the rest of the session | Otherwise a dead quota means an attempt on every single path open |

Silent throughout: never writes `pathStatus`, never surfaces an error, never throws into the
view. Success is invisible except that **Start lesson** no longer shows "Getting ready…".

The selection rule (`pathWarmTarget`) is a **pure function** of the path blueprint, the
content store and the progress state, so the "which section is next" decision is testable
without a network. It answers *which* section only — the quota and in-flight guards live in
the caller, so the pure function never reads storage or the ledger.

## 2. Suppress the conversation echo

On conversation cards only, do not auto-play the matched candidate on reveal.

Chosen over the alternative of delaying the auto-advance until playback finishes, because a
real exchange does not read your own line back to you at all — waiting would make the
unwanted playback *longer*, not better. Removing it also eliminates the cut-off outright
rather than hiding it.

Retained: the manual replay buttons on the reveal panel, and `convoShowRepair`'s playback
when the other speaker re-explains. Non-conversation cards are untouched.

## 3. Show the actual transcript

`learnScoreSpoken` already receives the raw text. Store it on the card as `c._said` beside
the existing `c._matched`, and have `convoThread` prefer it for the "you" bubble.

Fallback chain: `_said` → `_matched` → the scripted turn. Hand-graded turns, which never went
through the mic, render exactly as they do today.

The bubble renders the transcript with **no transliteration**, because none exists for
speech the recogniser returned — showing the scripted `tr` next to different Hebrew would
reintroduce the very mismatch this fixes.

**Accepted consequence:** a mishearing is displayed as a mishearing. That is the truth about
what the app heard and is the point of the change, but it does mean a poor-audio session
leaves a messy thread.

## 4. Sentence rotation

Split servable bank items into two pools before the existing sort, and leave that sort
untouched inside each:

- **Fresh** — never served (no recency entry), or `currentSeq - lastSeq >= BANK_COOLDOWN_SESSIONS`.
- **Recent** — everything else.

Fill from Fresh first, using today's exact ordering (`diff`, then `hits`, then `seen`). Fall
back to Recent only when Fresh cannot fill the slots, so a small bank keeps working and
"reach beats relevance" survives within each pool.

Reuses the existing `SESSION_SEQ_KEY` / `recencyAll()` counter that already rotates words,
extended to cover bank ids. `BANK_COOLDOWN_SESSIONS = 3`.

The split (`bankCooldownSplit`) is a **pure function** of items, the recency map and the
current sequence number.

## 5. Forgiving an isolated miss

Add `streak` to each SRS side — consecutive answers that were not a miss.

| Event | Effect |
|---|---|
| Grade 2 (Got it) | `streak++` |
| Grade 1 (Nearly) | `streak` unchanged |
| Grade 0 with `streak >= FORGIVE_STREAK` | **Stumble**: `stab *= 0.6`, `miss += 1`, no `lapses++`, `diff += 0.5`, `streak = 0` |
| Grade 0 with `streak < FORGIVE_STREAK` | Today's full lapse treatment, unchanged, `streak = 0` |

`FORGIVE_STREAK = 3`.

A second consecutive miss therefore always gets the full treatment — the streak was reset by
the first — which is correct: at that point the word genuinely is slipping.

`miss` still rises on a stumble, so `srsStrength` continues to see the evidence. Only the
schedule is forgiving, not the record.

The stumble path deliberately does **not** touch `r.due` beyond what the softened `stab`
implies, so a forgiven word rejoins the rotation on its own merit rather than jumping the
overdue queue — which is the other half of fix 4.

## Testing

Every rule above is a pure function and gets tests written before the implementation:

- `pathWarmTarget` — picks the nearest unlocked incomplete section; prefers content over
  conversation; returns nothing when everything is warm, when nothing is unlocked, or when
  the strong pool is spent.
- `bankCooldownSplit` — recently served items land in Recent; unseen items land in Fresh;
  the boundary at exactly `BANK_COOLDOWN_SESSIONS` is asserted explicitly; a bank smaller
  than the session still fills.
- `srsApply` streak behaviour — a clean run builds streak; an isolated miss after three
  clean answers is a stumble; a second consecutive miss is a full lapse; a miss on a young
  word is unchanged from today; `streak` survives a merge.
- Existing `mergeSrs` commutativity and idempotency tests must still pass with the new field.

Conversation display and path warming are UI/network paths and are verified in the browser
the way `ttsCheckBtn` and `micTestBtn` are — not unit tested, consistent with the file's
existing practice.

## Deliberately out of scope

- **Conversation rigidity.** George: *"it feels a touch too rigid, and a more dynamic
  approach may need a look at."* A real design question about how conversations are
  generated and matched, not a defect. Its own pass.
- **Tap a chat line to reveal its English.** He raised it and then argued against it himself
  — *"maybe this isnt best as this way I am forced to work out what hte conversation is
  saying"* — so it is an open question, not a requirement. Decide it with the rigidity work,
  since both are about how much scaffolding the conversation should give.
- **`geminiTTS` systemInstruction rejection** (F9). Diagnosed earlier today and shelved at
  George's request.

# The coach becomes the gate

## Where this came from

The coach shipped this morning (`7ad6b26`..`7401c90`) and George used it against the
conversation it was always going to be compared to.

On which one survives:

> The current ocnversation mode is janky nad not fun to use wheres the coach is fun,
> responsive and engaging so I want that as the new gate for gold.

> In the version I see I want only one thing to come out, no longer a conversation mode
> and a coach mode, jsut one which is the gate per node.

On the offline fallback, which the previous review had treated as one of the
conversation's four real advantages:

> While having the offline backup is cool, im honestly not sure its important Im only
> using hte app online and in hte context where the API is down or not working Ill jsut
> have to do practice instead and wait on the coach.

And then the reframe that this spec is actually built on — asked what should earn gold,
he separated two things the app had fused:

> So I think Gold should mean that every word has bee correctly used in a sentence. But
> the Gate should be that I am atleast "progressing"/ not weak on al the words. So I can
> move up a chapter without the gld status, but hte gold status is like a perfecting that
> module. I also think hteir should e some bonus "leveling up" of each word for doing it
> in the coach mode since its definetly harder that just a lesson for instance. I realised
> thats a different change but I think it fits the app better, especially since older
> words can be pulled forward later or strengthening.

Which then answered the fairness question on its own terms:

> Like hte last answer I think htis changes things. I think we can be stricter with this
> grading as its just for the gold, so it should mean ,mastery. While I cna still progress
> to later chapters without it being gold

And on scope:

> For now keep it node only as it is. I have a bigger plan to revamp the daily learning
> down the line giving those sessions a more wider coach approach. But for now coach is
> node only.

## What the code actually said

**His instinct is not a preference — the conversation is currently holding Chapter 3
shut.** `campNodeWalked` requires `campConvoPassed`, and walked nodes are what
`campChapterComplete` counts. Measured against his synced state:

```
CH1 Getting by           4 nodes, threshold 3
   How you are        6/6 words   convo passed
   Who people are     5/6 words   convo passed
   Your day           6/6 words   convo passed
   Asking for things  6/6 words   convo passed
CH2 More of your life    4 nodes, threshold 3
   Family & home      5/5 words   NO convo
   Going places       4/4 words   NO convo
   Liking & wanting   3/3 words   NO convo
   How you feel       0/6 words   NO convo
```

Three of Chapter 2's four nodes are at **full** word readiness and none of them counts as
walked, because he stopped using the conversation — which is exactly the mode he has just
called janky. So Chapter 2 reads as incomplete, `campLiveChapter` keeps returning it, and
Chapter 3 is unreachable. Removing the requirement opens it immediately.

**Raising the progression bar costs him nothing.** `campNodeWalked` currently passes at
`CAMP_WALKED_SHARE` (70%) of words ready. At 100% — the bar he actually described — both
chapters still clear their threshold (CH1 3 of 4, CH2 3 of 4). The stricter bar is safe to
adopt against his real data rather than in principle.

**Phase 1 of this morning's work broke compose's own `pct`.** `learnFinish` computes
`100 * s.got / s.cards.length`, which was written when a session was many cards. Compose is
now one card and `s.got` counts turns, so a three-turn session writes `pct: 400` into lesson
3. Nothing reads lesson 3 for gold so it has cost nothing, but it is nonsense in a synced
store and it is exactly the number this spec has to replace.

**The audit trail the bonus needs already exists.** `srsLogEntry` copies every key of
`extra` onto the log entry, and `learnLogExtra` already sets `kd: <card kind>`. So every
compose answer in `hvr_srslog` is already tagged `kd: "compose"`, the log holds 2000
entries, and `srsCalibration(log)` already takes a log argument rather than reading the
store. Splitting calibration by cue type is `srsCalibration(srsLogAll().filter(e => e.kd
=== "compose"))` and needs no new plumbing.

**Lesson 99 can stay the gate slot.** `CAMP_CONVO_LESSON = 99` holds the `auto` and `gold`
flags that `campAutoPass` and `campNodeEverGold` read. Keeping the slot and changing only
what writes it means every node currently gold stays gold and nothing needs migrating —
the same trick the retrievability work used.

**`mergePathScores` would have eaten the ledger.** It picks whichever lesson record has the
higher `pct` *wholesale*, so a landed-words map stored inside the lesson-99 record would
lose one device's landings on every two-device merge. This is why the ledger is its own
store.

**`content/nodes.json` holds only sentences and listens** — 66 and 11 of them, no
conversations. Conversations live in `hvr_convo` and `hvr_pathcontent` and are written
in-app. So deleting the mode does not touch the node-content pipeline or the
`generate-node-content` skill.

## The design

### Progression and gold come apart

This is the whole spec in one move. They are currently fused through `campConvoPassed`.

**Progression** is the SRS and nothing else:

```js
function campNodeWalked(id, c, srs) {
  const n = campNode(id, c);
  if (!n) return false;
  if (campNodeEverGold(id)) return false;      // slipping from gold is decay, not progress
  return campNodeWordsReady(n, srs || srsAll());
}
```

No lesson record, no AI, no network. `CAMP_WALKED_SHARE` becomes unused and goes.

**Gold** is the SRS *plus* evidence he can produce every word live:

```js
function campNodeDone(id, c, srs) {
  const n = campNode(id, c);
  return !!n && campNodeWordsReady(n, srs) && campCoachMastered(n);
}
```

Gold stays a **live computation**, not a stamp. A word decaying drops the node out of gold,
and `campNodeEverGold` still distinguishes "was gold, needs repair" from "never finished" —
that machinery is deliberately untouched.

### The ledger is about words, not nodes

A new store, `hvr_coachlanded`: `{ word: lastLandedTimestamp }`. Flat and global.

Global rather than per-node for two reasons. "I have said this word, unprompted, correctly,
in a live conversation" is a fact about the **word** — the node it happened under is
incidental. And a node's pool includes its three carry words, so landing one of those
credits the node that actually owns it instead of being thrown away.

It syncs on `mergeMaxNums`, the rule `hvr_struggle` and `hvr_recency` already use: union of
keys, higher timestamp wins. No new merge function, and commutative for free.

```js
function campCoachMastered(node, landed) {
  if (!node) return false;
  /* An auto-passed node was granted its graduation because every word was already
     strong — campAutoPass's whole argument. Requiring him to then say them to a coach
     would take back something the app has already given him. */
  if (campNodeAuto(node.id)) return true;
  const ws = (node.words || []).filter(k => !STOPLIST.has(k));
  if (!ws.length) return false;
  const L = landed || coachLandedAll();
  return ws.every(k => !!L[k]);
}
```

**Every credited word is recorded, not just the four objectives.** `composeCredit` already
returns exactly the words he used correctly — objectives or volunteered — and a word he
produced unprompted is the same quality of evidence whichever list it was on. Recording all
of them is both more truthful and the thing that offsets the strictness below. The on-card
checklist still ticks objectives only: that is the session's goal, which is a different
question from what the session proved.

### Strict, because it only costs gold

No manual override and no fuzzy matching. A word lands when `bankUses` resolves it in his
transcript and the coach did not flag it in `bad`.

This is only defensible because of the split above. When the conversation gated
progression, a mishearing could shut a chapter — under this design the worst a bad mic run
can do is cost one session's landings, and he asked for exactly that trade: *"we can be
stricter with this grading as its just for the gold, so it should mean mastery."*

The detection asymmetry named in the previous review — compose matching exactly where
`convoContentCoverage` forgave an edit-distance-1 slip — resolves itself, because
`convoContentCoverage` is deleted with the conversation. There is no second standard left
to be inconsistent with.

### The coach writes lesson 99, and `pct` starts meaning something

`CAMP_COMPOSE_LESSON` (3) is retired and the coach writes lesson **99** — the slot the
conversation used. Existing gold survives untouched, `campAutoPass` keeps working, and
`campNodeState` keeps returning "current" for a node with any lesson record.

To be unambiguous about what survives Phase 3: **`CAMP_CONVO_LESSON` is renamed to
`CAMP_COACH_LESSON`, not deleted** — it is the gate slot, and `campAutoPass`,
`campNodeAuto` and `campNodeEverGold` all read it. What does go is `campConvoPassed`
itself, which becomes unreferenced the moment `campNodeWalked` and `campNodeDone` stop
calling it: gold is decided by the ledger now, not by a percentage.

`pct` no longer gates anything, so it is free to be honest: **objectives landed over
objectives given, this session.** That replaces the `100 * got / cards.length` computation
that has been producing 400 since this morning.

### The bonus, and why it goes where it goes

The 2026-08-30 spec rejected an exercise-type multiplier, and the rejection was right about
its own target: a bonus asserted on top of a correct model inflates stability without
evidence and leaves `srsCalibration` checking predictions against outcomes it inflated
itself.

What that argument did not consider is that the model has a **blind spot** here.

```js
srsGain(R, diff) = 1 + SRS_GAIN * (1 - R) * byDiff
```

`(1 - R)` is the retrieval-difficulty term, and `R` is predicted from **elapsed time
alone**. The scheduler has no representation of cue strength at all — so it cannot see that
producing a word with no prompt is a harder retrieval than producing it from an English
sentence, and it is not "correctly treating them the same". It is blind to the difference.

So the multiplier goes on the `(1 - R)` term specifically, because that term is the claim
being made:

```js
const SRS_CUE_UNPROMPTED = 1.3;
srsGain(R, diff, cue) = 1 + SRS_GAIN * (1 - R) * byDiff * (cue || 1)
```

Still clamped by `SRS_GAIN_MAX`, so it cannot run away. Modest — 1.3, not 2 — because the
honest position is that we believe this and have not yet measured it.

**The cue is derived from the log tag, not passed alongside it.** `srsAnswer` reads
`extra.kd === "compose"` and threads the multiplier into `srsApply`. The bonus and its
audit trail therefore read the same field and can never disagree — the calibration split
is measuring the exact population the bonus was applied to.

The Settings "under the hood" calibration read gains a second row: the same Brier score and
band table computed over `kd === "compose"` entries only. That is what turns 1.3 from an
argument into a number we can revise. Nothing automatic acts on it; it is there to be read.

### What gets deleted

The conversation, entirely: `convoLiveTurn`, `convoLivePrompt`, `convoLiveNormalise`,
`convoLiveHistory`, `convoShouldContinue`, `convoNextStep`, `convoAdvance`, `convoLiveCard`,
`convoScriptedCard`, `convoScriptNext`, `convoBeat`, `convoBeatCount`, `convoServable`,
`convoPick`, `convoNextScene`, `convoThread`, `convoCandidates`, `convoContentCoverage`,
`convoBestMatch`, the writer queue (`convoTopUp`, `convoQWork`, `convoQNext`, `convoQSpend`,
`convoQSpentToday`, `convoQFailed`), the `conversation` entry in `LEARN_KINDS` and
`KIND_SIDE`, the node-sheet button, the daily session's conversation pick, `hvr_convo`,
`hvr_convoscenes` and their merge rules, and the `CONVO_*` constants.

`convoBubble` and `convoWordLine` **stay** — compose uses both. They keep their names;
renaming them across a 1MB file to match a deleted sibling is churn with a splice risk
attached (§7).

## Phases

Each stands alone and can be reverted alone.

**Phase 1 — progression stops waiting on the conversation.** `campNodeWalked` loses
`campConvoPassed` and takes the all-words bar. This is the smallest change here and the one
with an immediate visible payoff: Chapter 3 opens. Shipping it first also means every later
phase is working against a campaign that is no longer wrongly stuck.

**Phase 2 — the ledger and the gate.** `hvr_coachlanded` with its merge rule,
`campCoachMastered`, `campNodeDone` rewritten, the coach writing lesson 99, and the `pct`
fix. After this the coach is what earns gold.

**Phase 3 — delete the conversation.** Last, deliberately: by this point nothing reads it,
so the deletion is a deletion rather than a migration. §7's duplicate-function check after
a structural edit of this size is not optional.

**Phase 4 — the bonus and its receipt.** `SRS_CUE_UNPROMPTED` threaded through
`srsAnswer` → `srsApply` → `srsGain`, plus the compose-only calibration row in Settings.
Separate and last because it is the one change whose mistakes are slow and invisible, and
the only one that touches the scheduler.

## Testing

1. **Progression no longer needs the coach** — a node with every word ready and no lesson
   record at all is walked. The direct regression test for the Chapter 3 case above.
2. **A chapter opens on words alone** — the measured CH2 shape (three nodes fully ready, no
   lesson records) makes `campChapterComplete` true.
3. **Decay is still not progress** — a node with `everGold` set is not walked even at full
   word readiness, so a decayed node reads as repair rather than sliding back to walked.
4. **Gold needs every word** — five of six landed is not gold; the sixth makes it gold.
5. **Auto-pass still grants gold** — a node marked `auto` is mastered with an empty ledger,
   preserving `campAutoPass`'s bargain.
6. **The ledger records collateral, not just objectives** — a session crediting a word that
   was never on the table records it.
7. **The ledger merges across devices** — two ledgers with different words union rather
   than one replacing the other. The bug `mergePathScores` would have caused.
8. **`pct` is objectives landed over objectives given** — three of four landed writes 75,
   not 300.
9. **The cue multiplier applies to compose and nothing else** — `srsGain` with the cue
   exceeds the same call without it, an ordinary card is unchanged, and both stay under
   `SRS_GAIN_MAX`.
10. **Calibration can be split by tag** — `srsCalibration` over a log filtered to
    `kd === "compose"` returns only those rows.

Tests naming the conversation go with it in Phase 3. `composeCredit`, `composeBank`,
`composeEnds`, `composeObjectives` and the checklist tests are untouched and must still
pass.

## Deferred, with reasons

**The coach in the daily session.** The conversation's removal leaves a gap there, and the
obvious move is to fill it — but the coach draws its objectives from a node's word pool and
the daily session has no node, so it needs the out-of-node word-picking design that was
deferred once already. George also has a larger plan for that surface: *"I have a bigger
plan to revamp the daily learning down the line giving those sessions a more wider coach
approach. But for now coach is node only."* Filling the gap now would prejudge it.

**Fuzzy matching and a manual override on landings.** Argued above: strictness is only
affordable because progression no longer depends on it, and adding forgiveness now would
weaken the one thing gold is supposed to mean. Worth revisiting if a real session shows the
recogniser blocking a word he can plainly say.

**Acting automatically on the calibration split.** The compose-only Brier score is there to
be read, not to feed back into `SRS_CUE_UNPROMPTED`. A scheduler that tunes its own bonus
from its own inflated outcomes is the failure the 2026-08-30 spec was warning about; a
human reading a number and changing a constant is not.

**Grammar and tense objectives on the checklist.** Still held from the 2026-09-02 checklist
spec, on the same reason: a word objective is verified from his transcript and cannot lie
to him, a grammar one could only ever be the coach's opinion.

**Retiring `campNodeProgress`.** It stops deciding anything once `campNodeWalked` uses
`campNodeWordsReady`, but the end screen still reports "4 of 6 words" from it, which is
worth keeping. Left in place rather than folded in.

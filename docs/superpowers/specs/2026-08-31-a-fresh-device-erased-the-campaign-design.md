# A fresh device erased eight nodes of campaign

## Where this came from

George, asking a coverage question about the content batch:

> Hvae you buily content only for hte first 3 nodes on the default or for hte additional
> open I unlocked in the next chapter?

Answering it meant re-reading his synced campaign, which no longer matched what the app had
shown twenty-four hours earlier. It had shrunk.

## The evidence

Two consecutive commits of `progress.json` in the sync repo:

```
6500a0c8  2026-08-30T19:10Z  device aejta9
   chapters=4  nodes=12
   How you are, Who people are, Your day, Asking for things,
   Family & home, Going places, Liking & wanting, How you feel,
   Your day — past, What you bought, Where you went, How it was
   lib=270 srs=217 bank=111

4300594b  2026-08-31T08:19Z  device 6ed3u0        <- a device that had never synced before
   chapters=2  nodes=4
   How you are, Who people are, Your day, Asking for things
   lib=270 srs=217 bank=111
```

**Library, SRS and bank are identical across the two.** They have `MERGE_RULES` entries and
merged correctly. Only `hvr_campaign` regressed, and it regressed to exactly
`campSeedChapter()` — the hardcoded starter chapter plus its empty fog chapter.

So: a second device opened the app, `campEnsure()` saw an empty campaign and seeded the
default, and the first sync from that device destroyed eight nodes of real progress.

## The root cause

`hvr_campaign` has **no entry in `MERGE_RULES`**. It is an object, so `mergeOneKey` falls
through to `mergeObjUnion`, and inside that the `chapters` **array** is resolved by the
generic rule:

```js
if (Array.isArray(mine) || Array.isArray(theirs)) return mineIsNewer ? mine : theirs;
```

The fresh device's blob was newer, so its two-chapter seed replaced the four-chapter
campaign wholesale.

This is the same bug, in the same function, that the flags rule already exists to prevent.
Its comment says so outright:

> *Without a MERGE_RULES entry the generic array handling is `mineIsNewer ? mine : theirs`,
> so one device's flags simply destroy the other's. That is the entire reason this rule
> exists.*

Flags got a rule. The campaign never did.

## Why it has not been noticed before

It needs two devices, and until 2026-08-31 every sync in the repo's history came from
`aejta9`. A single device merges against its own last push and always wins, so the fault
was invisible until the moment a second device appeared with nothing in it.

It is also only half-visible now: whichever device syncs *last* wins, so the campaign
appears to flap rather than to break. His phone has not synced since 08:19, so its local
copy of the twelve nodes is almost certainly intact — the loss is recoverable by union,
but only until the phone pulls and applies the two-chapter version over itself.

## The fix

`mergeCampaign`, registered in `MERGE_RULES` for `hvr_campaign`.

**Chapters merge by `n`, never by "newer wins".** For each chapter number present on either
side:

- **nodes** — union by `id`, keeping every node either side has seen. A chapter cannot lose
  nodes through a merge, which is the whole failure.
- **state** — the more advanced of the two, ranked `fog < next < live < done`. A fresh
  device calling a chapter `fog` must not un-finish it.
- **sketch, theme, icon** — the side that actually has content wins over an empty one.

Scalar top-level fields keep the newer side's value, and `log` takes the longer array,
which is the honest answer for an append-only record when the two have diverged.

**"More nodes wins" is safe in this direction only because nodes are never removed.**
`campApplyPlan` appends chapters and `campSeedChapter` writes the first one; nothing prunes
a node. If node removal is ever added, this rule has to be revisited — noted here rather
than discovered later.

## Testing

The shapes that actually occurred, plus the ones that would hide a regression:

1. **A seed campaign merged against a populated one keeps all twelve nodes**, in both
   argument orders — the exact 2026-08-31 case.
2. **A chapter's state never goes backwards**: `fog` merged with `live` is `live`; `done`
   survives being merged with `next`.
3. **Nodes union rather than replace** when the two sides hold different nodes for the same
   chapter number.
4. **Order does not depend on which side is called `a`** — the same argument `mergeById`
   already carries: an output order that flips between devices rewrites the file on every
   sync forever.
5. `hvr_campaign` has a `MERGE_RULES` entry at all, so it can never silently fall back to
   the array default again.

## Deferred, with reasons

**Restoring the lost campaign from git history.** The sync token is read-only by design, so
this cannot be done from here — and it should not need to be. Once the rule ships, the next
sync from his phone unions its intact twelve nodes back into the file. If that fails, the
snapshot at `6500a0c8` is still in the repo's history and can be imported by hand.

**A general "never let an empty store overwrite a full one" guard.** Tempting after this,
and wrong as a blanket rule: emptiness is a legitimate state for several stores, and a rule
that cannot tell "cleared" from "not yet loaded" would resurrect data he deleted on purpose.
Each store gets a merge that understands its own shape, which is what `MERGE_RULES` is.

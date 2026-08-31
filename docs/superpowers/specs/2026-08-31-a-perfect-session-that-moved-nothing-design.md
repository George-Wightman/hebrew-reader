# A perfect session that moved one word

## Where this came from

Three flags, raised across two sessions, which turned out to be two bugs and a label.

> Why when I got 5 out of 5 (even tho these sentences/ words were repeated) didn't I see
> any progress on them? I feel something is a bit broken behind the scenes

> It also seems that they kept failing the vobac gate, what does that mean and how can we
> improve for next time?

> This exact sentence keeps coming up, specifically this excersize where I have to say what
> I heard. "Where is your boyfriend" like every session I do in the exact same form where
> it says … **New in this one / חבר / friend – boyfriend** … When it's certainly not new.

And, on how to investigate them:

> You have access to my Synced data, you cant write it but can you not use that key to
> import hte data from the Git into the app so you can see exactly what it is that I see
> when using, this way you can retry my actions and get hte same bugs?

That is what was done, and it is the reason this spec has numbers in it rather than
theories. `progress.json` was pulled, the 53 localStorage keys were written into a browser
running the app **served from the scratchpad** — never the repo, so his library and SRS
could not be committed by accident — and the failing sessions were rebuilt from his real
state. The sync blob carries no credentials (`SYNC_NEVER_SET` keeps the keys and the token
out of it), so nothing sensitive travelled.

## What reproducing it showed

His Family & home node, rebuilt from his data, produced this session — and the first card
is the one he flagged:

```
listen  [recv]  איפה החבר שלך?     carry: חבר
sentence[prod]  המיטה אדומה         carry: מיטה
word    [prod]  מיטה
listen  [recv]  המיטה גדולה?        carry: מיטה
...  10 cards, 6 prod / 4 recv
```

Answering **all ten perfectly** moved exactly one word out of six:

```
מיטה   prod weak -> progressing
חדר    prod SAME (weak)
חבר    prod SAME (weak)   — still in debt, so the same card comes back tomorrow
דלת, שולחן, דירה           unchanged
node still not ready
```

### Fault one: a rescue that could not possibly rescue

`חבר` was selected as this node's *debt* because its **production** is weak — `streak: 0`,
`miss: 2`, `diff: 5.85`. The item chosen to rescue it was `איפה החבר שלך?`, whose type is
`listen`, and `KIND_SIDE.listen === "recv"`.

His `recv` on `חבר` is `n: 10, streak: 9, miss: 0`. He has never once got it wrong
receptively.

So the card credits the side he has already mastered, leaves the side that selected it
untouched, and `חבר` is still weak next session — which selects the identical card again.
A closed loop, and exactly what he described: *"like every session I do in the exact same
form."*

The rule being broken is simple and was never written down: **every caller of
`bankCarried` passes a `carry` set built from production weakness** — `campWeakWords`,
`campDebtWords` and `rescueWords` all rank on `srsStrengthOf(..., "prod")` via `wordReady`
— **but nothing checked that the item offered as the rescue grades production.**

A controlled A/B on identical data, with the fix disabled and enabled in the same page
load:

| | `חבר` receives | `חדר` receives | words cleared |
|---|---|---|---|
| before | 1 × recv | 1 × prod | `מיטה` |
| after | — | 2 × prod | `חדר` **and** `מיטה` |

The slot the useless card was occupying becomes production work, which is the only kind
the node gate measures.

### Fault two: the planner never knew his vocabulary

Two commissions in a row banked nothing:

```
banked nothing — every item failed the vocabulary gate
  10 written, 10 rejected: איך הבוקר שלך, סבא? שתית קפה? / היום ממש קר בחוץ / באמת? איזה בלאגן
  12 written, 12 rejected: אני רוצה ללכת למיטה היום / קניתי טלוויזיה חדשה לסלון
```

The gate was right — those need `שתית`, `בחוץ`, `בלאגן`, `טלוויזיה`, `סלון`, none of which
he has. The fault is one stage earlier. `sentenceCommission` puts `spec.scaffold` on the
spec, `sentenceWrite`'s prompt uses it, and **`sentencePlan`'s prompt does not mention it
at all.** Grep for `spec.scaffold`: it appears in the writer and never in the planner.

So the planner sets jobs like *"Explain you cannot drive right now because the city roads
are completely blocked"*, and the writer is handed something that **cannot be written**
inside the vocabulary rule. It can obey the brief or obey the gate, not both. Every item
obeyed the brief and every item died — a 100% rejection rate is what an impossible
instruction looks like from the far end.

### Fault three: "new" was the wrong word

`bankCarried` returns any content word failing `wordReady`, and the card renders that as
`New in this one`. Two different situations wear one name: a word he has genuinely never
met, and one he has met many times and keeps losing. `חבר` is the second. He was right,
and the label was hiding the more useful thing — *this is one you keep losing, so here it
is inside a sentence where the context can carry it*, which is the whole reason the rescue
machinery exists.

## What is NOT being changed

**The scheduler is correct and stays untouched.** `חדר` sits at `diff: 7.71` with a 51%
miss rate; `srsStrength` calls anything at `diff >= 6.5` or a ≥40% miss rate weak, and it
takes two clean production answers to clear both. `campWeakWords`'s own comment already
says so: *"a weak word needs about three clean answers"*. That is the spacing model
working, not a bug.

Related and also not a bug: he practised `חדר` on 2026-08-30 when it was due 2026-09-01.
`srsGain` scales with `(1 - R)`, so answering a word before it is due grows stability by
almost nothing. Two node sessions on consecutive days will always feel flat for that
reason. Worth him knowing; not worth changing, because changing it is exactly the
cramming-inflation the model exists to refuse.

## The fix

**1. A rescue must be answerable on the side that is failing.** `bankItemSide(it)` reports
what `KIND_SIDE` says about the item's type; `bankCarried` returns `null` for anything that
is not `prod`, and `campBuild`'s separate `debt` flag takes the same test. All four
`bankCarried` callers mean "rescue" and all four pass a production-weak set, so this belongs
in the shared function rather than at each site. Listening material is unaffected —
`campBuild` still keeps any item that hits a node word; what an item can no longer do is
*claim to be rescuing* one.

**2. The planner is told what he can say.** `sentencePlanPrompt` is split out of
`sentencePlan` so the claim is testable without spending a call, and gains a section naming
the scaffold vocabulary as a constraint on what to ask for. `spec.scaffold` is already on
the spec by then, so there is no plumbing — only a prompt that stops setting impossible
jobs.

**3. `learnCarryLabel`.** "New in this one" only when the word's production is genuinely
`new`; otherwise "The one you keep losing".

## Testing

- `bankCarried` refuses a `listen` item and accepts `sentence` and `reply`, driven with
  `חבר`'s real two-sided record — the exact shape that produced the loop.
- `bankItemSide` maps the three bank types, and an item with no type reads as a sentence.
- `learnCarryLabel` separates a word with a production record from one with none.
- `sentencePlanPrompt` contains the scaffold words and their transliterations, names them
  as a constraint, and omits the section entirely when there is no scaffold rather than
  telling the planner his vocabulary is nothing.

## Deferred, with reasons

**Commissioning production material for debt words.** `campHasRescue` only inspects the
node's own weak words, so `חבר` — debt inherited from another node — is outside it, and
after this fix it simply will not appear in the session rather than appearing uselessly.
`campWarm` already offers debt to the writer (*"Debt is offered, never demanded"*), so
material should arrive on its own. Watch whether it does before adding a mechanism.

**Telling him a word gained nothing because it was answered early.** The honest
explanation for half of "5 out of 5 and no movement", and a real candidate for the end
screen. Left out because it is a reporting feature rather than a fix, and it should be
designed against what the bars already show rather than bolted beside them.

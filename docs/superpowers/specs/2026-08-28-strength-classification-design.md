# A word can be wrong nearly half the time and still read as strong

## Where this came from

George: "Do an evaluation of the algorithm currently." Not a bug report — a request to
look at `srsApply`/`srsStrength` and say what's actually true of them, the way the 20 Aug
retrievability work looked at the old fixed-ladder scheduler.

## What the simulation actually said

`srsStrength` classifies "strong" as `stab >= 21 && diff <= 5`, and "weak" as
`diff >= 6.5 || miss/n >= 0.4`. Both halves were tested against a simulated learner with a
known true accuracy, driven through the real `srsApply` — not read from the code and
reasoned about, run.

**`miss/n` cannot detect a struggling word given enough total reviews, for any word.**
`miss` is a bounded quantity — it decays ×0.9 on every clean answer, so its steady-state
value under ANY fixed accuracy is capped around ten times a single miss's weight. `n` is
unbounded — it only ever increments. So `miss/n → 0` as reviews accumulate, regardless of
the true rate. Measured on a word with a genuine 45.6% failure rate sustained over 8
simulated years: `miss/n` read **0.052** — nowhere near the 0.4 "weak" line.

**But that turned out not to be the main event.** Re-running the same adversarial scenario
across a spread of true accuracies and checking what `srsStrength` actually returned:

| true accuracy | settled `diff` (avg of 15 runs) |
|---|---|
| 50% | 4.97 |
| 60% | 3.73 |
| 70% | 2.37 |
| 80% | 1.41 |
| 95% | 1.05 |

**`diff` alone satisfies "strong"'s `diff <= 5` at 50% true accuracy — a coin flip.** The
asymmetric update (`-0.6` on a clean answer, `+1.1` on a miss, both applied every single
answer regardless of how many came before) has a breakeven around where success outweighs
failure by roughly 0.6:1.1 — call it ~65% correct — well below the ~90% retention the
scheduler's own retrievability model (`R(stab) = 0.9`, from the 26 Aug work) is built
around. Above that breakeven, `diff` drives toward its floor of 1 regardless of how far
above 65% the true rate actually is. So `stab >= 21 && diff <= 5` — the WHOLE strong
test — can be satisfied by a word answered correctly on the order of 65-80% of the time,
without the miss ratio ever being consulted, because `srsStrength` returns as soon as
either half of the OR-then-AND chain resolves.

**Consequence, not just a label.** `srsStrength(...) === "strong"` is read by:
- `scaffoldWords` — the vocabulary sentence generation is allowed to build FROM
- `wordReady` (via the `progressing`/`strong` check) — what may appear inside a sentence
- `retireStrongBtn` / `syncShelves` — words pulled off the focus grid
- `campNodeWordsReady` — what counts as "learned" for a node's gold

A word he's actually getting wrong close to half the time can end up scaffolding the
sentences he's asked to read, retired off the grid where he'd notice it, and counted as
mastered for a chapter's gold. This is the exact "impossible card" failure the whole
servable-gate system exists to prevent — arriving through the one door that system
doesn't check.

**Timeliness.** The app is about a month old (first commit 22 Jul). The 8-year adversarial
case that exposes `miss/n`'s dilution hasn't had time to manifest in real data yet. The
`diff` breakeven has — it needs only a handful of reviews of a genuinely middling word,
which is squarely what a month of real, ordinary practice looks like.

## What this spec does NOT touch, and why

Rebalancing `diff`'s own asymmetric constants (`-0.6` / `+1.1`) to move its breakeven
toward ~90% would be the structurally direct fix. It is deliberately not this spec: those
constants are the calibration `srsGain`'s own comment cites exact numbers against
("2.6 at difficulty 1, 2.12 at 5, 1.52 at 10"), so changing them ripples into how fast
`stab` grows and changes what every already-stored `diff` value on real data means,
without a clear migration story. That is a separate, larger piece of work with its own
evaluation, not a rider on this one.

## The fix

A single new signal — a properly decaying recent-accuracy ratio — replaces `miss/n` in
the weak test AND becomes a second, independent requirement for strong, alongside
`diff`/`stab`. `diff` and `stab` themselves, and everything that reads them for
SCHEDULING (`srsGain`, `srsR`, due dates), are untouched. This only changes
classification.

**`rn` / `rmiss`** — an exponential moving average pair, updated on every real answer in
`srsApply`, right beside where `n` already increments:

```
rn    = rn * 0.85 + 1
rmiss = rmiss * 0.85 + weight      // weight: 1 miss, 0.5 nearly, 0 clean
```

`0.85` gives `rn` a ceiling around 6.67 — roughly the last half-dozen answers, chosen by
simulating the actual separation it produces (below). The miss weight mirrors `miss`'s
own weighting exactly — full weight whether or not the miss was forgiven, because in this
codebase forgiveness already softens the schedule, never the evidence; see F4's own
comment on `miss`.

**Simulated separation**, median ratio at 1500 simulated days per true accuracy, 25 seeds:

| true accuracy | median ratio |
|---|---|
| 50% | 0.266 |
| 65% | 0.241 |
| 75% | 0.174 |
| 80% | 0.116 |
| 85% | 0.079 |
| 90% | 0.034 |
| 95% | 0.000 |

`RECENT_STRONG_MAX = 0.15` sits in the gap between 80% (median 0.116, comfortably under)
and 65-75% (medians 0.19-0.24, comfortably over) — so "strong" now needs genuinely
dependable recent recall, not merely a `diff` that has drifted low.

**`srsStrength` becomes:**
```
weak:   diff >= 6.5 || ratio >= 0.4        (0.4 unchanged — only what feeds it changes)
strong: stab >= 21 && diff <= 5 && ratio <= 0.15
```

**No migration.** Existing records have no `rn`/`rmiss`. Rather than a one-time rewrite
of every stored word — the kind of pass this file's own history shows going wrong when
it's guessed at rather than measured — the ratio function falls back to the OLD `miss/n`
when `rn` is absent or zero. That is: exactly today's number, until the word is next
answered for real, at which point `srsApply` starts writing `rn`/`rmiss` and the honest
figure takes over. A word already sitting on a badly diluted `miss/n` stays exactly as
mis-classified as it is today until its next review — no worse, and self-correcting on
contact. `Settings → Reset drill schedule` already exists for anyone who wants every word
re-evaluated immediately rather than waiting for it to come up naturally.

## Retracted from yesterday's evaluation

Yesterday's write-up also flagged the 365-day stability cap as a word getting "frozen" —
reviewed so rarely the algorithm stops gathering evidence about it. Simulated properly:
a word that reaches `stab = 365` under the CORRECTED strong test is one that is both
genuinely easy (`diff <= 5`) and genuinely reliable (`ratio <= 0.15`) — annual review for
such a word is the scheduler working as intended, not a bug. The concern was downstream
of the same root cause this spec fixes; it does not need its own change.

## Deferred, with reasons

**Rebalancing `diff`'s breakeven directly.** Structurally the "real" fix; deliberately
separate — see above. Worth a dedicated evaluation of its own once this lands and there
is a few more weeks of real data to check it against.

**A forced migration/reset of `hvr_srs` on deploy.** Considered and rejected: the
fallback-to-old-ratio behavior already means nothing gets WORSE, correction is automatic
and immediate on next contact, and `Reset drill schedule` already exists as the
opt-in tool for anyone who wants it sooner. Inventing a second reset mechanism for one
narrow case is exactly the kind of thing this file's history shows accreting into clutter.

# A badge that says something happened

## Where this came from

> I feel I need something that pulls me into the app more, push notifications maybe or
> just something that mkaes me hooked to click.

## What this deliberately is not

Every obvious answer here is one this project has already refused, twice, and on its own
initiative.

George binned XP himself: *"doesnt add anything new and jsut diluets the pool"*. The style
guide's rule is **report movement, not currency**, and reserves gold for *"you did this"*
and nothing else. And the project's own statement of purpose is that the measure of
success *"isn't a streak or a score; it's whether George can hear a voice note from his
grandad and say something back."*

So: no streak flame, no points, no daily-goal ring.

## The thing that would actually have pulled him in already happened

On 2026-08-31 he finished the vocabulary for Family & home. That flipped
`campNodeWordsReady` to true and opened the node's graduation conversation — which was
already written and sitting in `hvr_pathcontent`. The app said nothing, and he asked why
his session had achieved nothing. See
`2026-08-31-a-session-that-says-what-it-did-design.md`.

He would have come back for that. The hook is not a new mechanic; it is putting an
already-earned reward somewhere he can see it **without opening the app**.

## What is actually reachable

Real Web Push needs a push service subscription and a server to send from. The app is
static on GitHub Pages, and adding a backend for a single-user app is a dependency and a
running cost for something the app can nearly do on its own.

`navigator.setAppBadge()` needs no server, no permission prompt, and works on an installed
PWA in Chrome on Android, which is exactly what he runs. Its one honest limit: the page can
only set the badge while it is running, so what he sees on his home screen is the state as
of his last visit. That is still the state that matters — a conversation that opened
yesterday is still open today — but it means the badge reports rather than alerts.

## The design

**Two states, two forms, never confusable.** George asked for "both, rewards first", and a
badge that is only ever a number cannot carry both: `3` would mean three rewards on Monday
and three due words on Tuesday.

- **Something earned and unclaimed → `setAppBadge()` with no argument.** A dot. It says
  *something happened*, and a reward is announced rather than counted — which is the same
  reason gold is not a quantity anywhere else in this app.
- **Otherwise → `setAppBadge(n)`.** A number, and the same number the nav badge already
  shows, so the two agree.

**What counts as earned and unclaimed** is deliberately one thing: a node whose words are
all his where the conversation has not been passed. It is earned, it is his, it is sitting
there, and it is precisely what was invisible yesterday.

`badgeState(camp, srs)` returns `{ kind, n }` and is pure, so what the badge claims can be
tested without a store, a clock or a browser that supports badging. `learnBadge` reads the
same function, so the nav and the home screen can never disagree.

**Refresh** rides `learnBadge`'s nine existing call sites — session end, sync pull, content
ingest, boot, view change. No new triggers, no new lifecycle.

**Feature detection, silently.** Where `setAppBadge` is missing the in-app badge behaves
exactly as it does now. A browser without badging must not produce an error he has to read.

## Testing

- `badgeState` prefers an unclaimed conversation over a due count, and reports `due` when
  there is none.
- A node ready and already graduated is not a reward — being finished is not news.
- A node still short of a word is not a reward either, so the dot cannot mean "nearly".
- Two open conversations still produce one dot, not two, because a dot is not a tally.
- With no library and nothing due, the badge clears rather than showing zero.

## Deferred, with reasons

**`periodicSync` to refresh the badge while the app is closed.** It is the natural partner
and would turn a report into something closer to a nudge. Chrome gates it on install plus
engagement heuristics, so it fires "most days" rather than reliably, and building the
first version to depend on it would make a flaky signal load-bearing. Worth adding once the
badge itself has proved it changes anything.

**A notification, of any kind.** Same reasoning, plus it needs a permission prompt, which
is a cost to spend only on something already known to work.

**"One word from gold" as a reward.** Genuinely motivating and honest, but it is not
earned, and the whole point of the dot is that it means *you did this*. Diluting it with
invitations is how the gold rule got written in the first place. It belongs in the app,
next to the node.

**A badge for new pre-baked content.** Transient, and the app already announces it when
opened. A dot that clears itself the moment he looks is a notification, not a state.

**Dark mode**, raised alongside this and declined outright — see F18 in
`docs/audit-2026-08-20.md`, now marked as decided rather than pending.

# Clearing a flag so it stays cleared, and a ledger so I stop re-reading it

## Where this came from

George, after `check-hebrew-flags` re-surfaced three flags he'd already watched me fix
earlier in the same conversation:

> I need a way to also clear the flags, so that after you push a fix they are addressed.
> If htere is a way for you to tick them off once you have addressed them so that future
> pulls dont repull the same old flags. Current there are 2 new ones that I want ot
> address and I have realised it pulled all of hte old ones that oyu adrdressed in htis
> chat.

Two asks, and they need two different mechanisms because they sit on opposite sides of a
permission boundary he was asked about directly and chose deliberately:

> "Keep it read-only" — no token change. I track what I've handled in a local file only I
> read. You clear things yourself in-app with "Mark addressed."

## What the code actually said

**"Delete" already exists and does not reliably delete.** `flagDrop(id)` removes a flag
from the local array. But `mergeFlags` is a plain union by id — on the next sync, "my copy
doesn't have it" and "GitHub's copy still does" is indistinguishable from "this flag never
existed on my side yet", so the union puts it straight back. A flag deleted today can
reappear tomorrow. This is the literal bug behind "I need a way to ALSO clear the flags" —
the way that already existed doesn't hold.

**This app has already solved this exact shape of problem, elsewhere.** The reply-card
removal spec (2026-08-26) chose inert-over-deleted for precisely this reason: *"Existing
reply items in the bank become fully inert and are not pruned... nothing irreversible
happens to written material."* A flag should follow the same rule. Resolved, not deleted.

**My own access is read-only, by his own choice today**, so I cannot write a shared
`resolved` field into his repo. Whatever tells `check-hebrew-flags` not to re-show a flag
I've handled has to live somewhere I can write and he never has to touch: a local ledger,
same neighbourhood as the token file, outside the repo and outside memory.

---

## Phase 1 — Resolved, not deleted

A flag gains `resolved` (bool) and `resolvedTs` (number), both absent until resolved.
`flagResolve(id)` sets them; the flag stays in the array, `flagAdd`'s only consumer of
`FLAG_MAX` unaffected.

`mergeFlags` changes for the one case it got wrong: two copies of the *same* id arriving
from both sides. Previously first-seen-wins, which is an arbitrary pick when one side has
resolved it and the other hasn't. Now: **resolved anywhere wins.** A flag cannot un-resolve
by arriving from the side that has not caught up yet — the same direction `syncRun`
already trusts elsewhere (a merge that could go backwards on a field nobody edited twice is
the trap `mergeById`'s own comment warns about for bank items).

`flagsWaiting` — the thing the panel's "not synced yet" line reads — has to consider
`resolvedTs` as well as `ts`. Resolving a flag is a real mutation that needs to reach
GitHub, or "addressed here" never reaches me.

**The Delete button is removed, not kept alongside Resolve.** Two ways to clear a flag,
one of which quietly loses data on a sync, is worse than one way that never does. `FLAG_MAX`
already bounds the array, so an old resolved flag ages out the same way an old bank
sentence does.

**Test:** `mergeFlags` gets a case for two copies of one id disagreeing on `resolved`, in
both argument orders — the order-independence the existing tests already established for
ordinary flags has to hold here too.

## Phase 2 — The panel only shows what's open

`flagRender` filters to `!f.resolved` for the main list. Resolved flags stay in storage —
inspectable if the array is ever dumped or read directly — but are not rendered; a
one-line count ("N addressed") replaces them rather than a hidden section, per the style
guide's *"look for meaning you can express through position ... before reaching for a label
or a badge"* — a count is enough, a collapsible archive is not load-bearing here.

`flagPending`'s "About:" line and the rest of the write flow are unchanged; resolving is
the only new behaviour.

## Phase 3 — My side: a ledger only I read

`C:\Users\gwigh\.claude\projects\...\state\handled-flags.json` (sibling to `secrets/`, not
inside it — this is bookkeeping, not a credential). `{ "<flag id>": { "handledAt": ISO,
"note": "one line on what shipped" } }`.

`check-hebrew-flags` filters the fetched list against **both** `resolved` (his side, if
he's tapped it) and this ledger (mine, whether or not he has). After I ship and verify a
fix for something a flag named, I add an entry here — that is the "tick them off" he asked
whether I could do, done the only way read-only access allows.

The two mechanisms stay independent by design: his tap writes to the shared blob and the
app itself stops showing it to him; my ledger writes to nothing he can see and only
changes what *I* re-read next time. Neither is a substitute for the other, which is why
both exist rather than picking one.

---

## Deferred, with reasons

**Write access, so the two mechanisms become one.** Offered directly and declined in
favour of read-only. Revisit if the double bookkeeping (his tap, my ledger) turns out to
drift or duplicate effort in practice.

**A way to un-resolve a flag.** Not asked for, and "resolved anywhere wins" in the merge
would fight it anyway — reopening would need a real design (a new `ts` that beats the old
`resolvedTs`, not just clearing the bool), not worth building speculatively.

**Showing resolved flags in the panel behind a toggle.** A count is the whole signal
needed today; build the toggle if the count itself turns out to be insufficient.

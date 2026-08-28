# Flagging a thing to change, and letting the sync carry it to me

## Where this came from

George, deferring the idea one message and then sharpening it the next:

> I find myself mid session beign like "this thing could use fixing/ changing" if htere
> was a way in app to like save a SS with a comment that was stored that you could see
> later that would be a game changer.

> sthat sounds like a good idea, i need a way to highlight what i want to change its not
> alwawys a bug its more id new features to change, so when i come to chat youll know
> thevnd what im talking about

The second message is the one that decides the design. This is not a bug reporter. It is
a way to pin a thought to the exact moment it occurred, so that a sentence typed on a
phone on a Tuesday still means something in a chat on a Thursday. "You'll know what I'm
talking about" is the requirement; everything below serves it.

## What the code actually said

The first draft of this feature assumed George would have to carry his notes to me
himself — a Copy-all button, a paste into chat. **He does not.** Three things already in
the file make that unnecessary, and none of them were built for this.

**Sync carries any store, without being told about it.** `syncKeys()` is
`exportKeys()` — a live scan of every `hvr_`-prefixed localStorage key — minus
`SYNC_NEVER_SET()` (secrets) and `SYNC_LOCAL_SET()` (genuinely per-device). A new store
is included automatically and, as the export comment puts it, *"can never be forgotten
here"*. So a flags store syncs to George's GitHub repo with no plumbing at all, and I read
`progress.json` from there.

**Union-by-id merging already exists.** `MERGE_RULES` gives `hvr_bank` and `hvr_convo`
a `mergeById`. Without a rule, `mergeOneKey` falls through to
`mineIsNewer ? mine : theirs` for arrays — so a flag written on the phone would be
silently destroyed by a laptop sync. One line in `MERGE_RULES` is the difference.

**The AI log is already synced, and should not be.** `hvr_ailog` is `hvr_`-prefixed and
in neither exclusion set, so it syncs today under the default array rule — last writer
wins. The laptop's twenty calls overwrite the phone's twenty. That is wrong for a live
per-device diagnostic and is fixed here rather than left as a trap for the first time two
devices are used in one day.

---

## Phase 1 — The flag

A small pennant sits immediately left of the AI star, same size and treatment. George
chose its own glyph over a long-press on the star, and the cost is named: a third control
in the nav. It is worth it because the whole feature is about catching a thought that
arrives mid-card, and a control you have to remember exists is one that never gets used.

**Two states, and the second one is honest rather than decorative.**

- **Grey** (`var(--muted)`, the gear's colour): everything written is where I can see it.
- **Teal** (`var(--accent)`, steady): a flag is written but has not reached GitHub yet.

Teal means *you can act on this*, which is exactly right — the action is finishing the
session or hitting sync. It is shown **only when `syncConfigured()`**: with no sync set up
every flag is permanently unsent, and a permanently-lit indicator is the "standing
instructions become wallpaper" mistake.

Steady, never pulsing. The pulse is the star's and means *a call is happening now*.

## Phase 2 — What a flag holds

His sentence, and what the app knew at that instant. The second half is the requirement;
a sentence alone is a note he could have put in his phone's own notes app.

`flagContext()` captures, all defensively and never throwing:

- The view, and which Learn screen if that is the view
- The card on screen: kind, Hebrew, transliteration, English, and position in the session
- The node and chapter, from `learnSession.path` or the open node sheet
- What the scheduler thinks of the words on that card
- The last three AI calls, snapshotted into the flag

That last one is why this is the same shape as the AI star and not a separate idea. He
taps the flag *because something felt wrong*, and the flag carries the calls that produced
it. "This conversation felt too easy" arrives with the conversation, the node, the beats
covered, and the prompt that wrote it.

**Previews are trimmed harder than the log's.** `FLAG_AI_PREVIEW = 400` against the log's
1200, and three calls rather than twenty. A flag is a permanent record that rides every
sync; the log is a transient local one. `FLAG_MAX = 40`.

## Phase 3 — Getting to me

`MERGE_RULES["hvr_flags"]`, and a rule of its own rather than `mergeById`.

`mergeById` carries the bank's `seen` and `lvl` semantics, which mean nothing for a flag,
and it keeps the last `cap` entries by id order. `mergeFlags` is a plain union — **a flag
is written once and never edited, so there is no field-level conflict to resolve**, only
the question of whether both devices' flags survive. They must.

Ids are `Date.now()` plus a random suffix, so id order *is* chronological and the cap
keeps the newest. This also satisfies `mergeById`'s standing warning: the output order
must not depend on which side was called `a`, or every sync writes a different file and
commits forever.

`AI_LOG_KEY` joins `SYNC_LOCAL_SET()`, so each device keeps its own live log and the two
never fight over one ring buffer. Nothing is lost by this: what I need from the log is
already snapshotted into whichever flag was raised about it.

## Phase 4 — The panel

Tapping the flag opens a `.modal-backdrop` / `.modal`, the same idiom as Settings, Word
strength and AI activity.

At the top, a text box, focused, with the context it is about to capture shown above it in
one line — so he can see *before* typing that the flag knows it is on the drill card for
"אני רוצה ללכת הביתה" in How you are, and does not have to describe it. Save writes the
flag and clears the box.

Below, the flags already written, newest first: his sentence, when, and the captured
context behind a **More details** toggle — the same disclosure the AI log uses, because it
is the same problem. Each has a delete.

At the bottom, one line saying whether they have reached GitHub, and the manual sync
control if they have not. That line is the whole promise of the feature, so it is stated
rather than implied.

**A flag never touches the session.** It is an overlay; the card underneath is untouched,
no grade is written, the mic is not stopped. Opening it mid-card must cost nothing but the
seconds spent typing.

---

## Deferred, with reasons

**A screenshot.** The original idea was "save a SS with a comment". Not built, and this is
the substantive design decision in the spec. `html2canvas` in a file with no build step is
a real dependency for a picture that shows less than the state does — an image cannot tell
me the card's SRS record, the beats covered, or the prompt that wrote the sentence.
George already photographs the app and sends me the picture when a picture is the point,
which the style guide records as how this project's best feedback arrives; the flag
captures what a photograph *cannot*. If the two ever need to arrive together, he sends the
screenshot as he does now and the flag it pairs with is already in the repo.

**Categories (bug / change / idea).** He said explicitly it is "not alwawys a bug", which
argues for a tag. Left out: when I read these I read his sentence, not a label, and the
style guide's "one signal, not four weak ones" applies to a taxonomy nobody is going to
maintain. Revisit if the list gets long enough to need scanning.

**Editing a flag.** Written once, deleted or kept. That is what makes `mergeFlags` a plain
union with no conflict resolution, and the simplicity is worth more than the edit.

**A count badge on the glyph.** `.navbadge` exists and would fit. Not used: the teal state
already says the thing worth saying ("something is waiting"), and a number nagging him
about a backlog of his own thoughts is the wrong pressure.

**Reading the flags back into the app from my side.** I can read them; I cannot answer them
in the app. A reply channel is a different feature and would want the sync to be
bidirectional in a way it currently is not.

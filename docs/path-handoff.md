# The Path — handoff

Status as of 2026-08-15. This covers one feature only: the branching quest map (`Path` tab in
`hebrew-reader.html`). For everything else about the app, see the main `README.md`.

## What it is, in one paragraph

A structured curriculum sitting alongside the existing free-form sessions (Balanced, Weak spots,
Speaking, Quick, Conversation). Where those pull from whatever the spaced-repetition scheduler
decides is due, the Path is a fixed, hand-authored sequence of situations — "How you are",
"Asking for things", "Your day — past" — arranged as a branching map you walk through in order,
each section teaching a handful of words through seven lessons and closing on a conversation.

It exists because the free-form sessions had no mechanism to ever introduce new grammar: the
sentence-generation prompt hard-codes "present tense only" with nothing that could decide you're
ready for more. The Path is what lifts that ceiling — grammar is a property of how deep into the
map you are, supplied to the same generator as a variable.

## Current state: built and verified, not yet used

Everything described below exists in the file, has been tested programmatically (DOM assertions
in a scripted browser, not just eyeballed), and has had zero regressions found against the rest
of the app. **It has not yet been walked start-to-finish by George in his real browser.** That's
the actual next milestone, not any of the code below.

## The structure, exactly as it stands today

- **32 sections**, 171 words, 7 chunks/phrases, 37 edges, 1 root (`hello`), 1 true leaf
  (`properly` — everything else feeds something).
- **6 merge points** — sections requiring two parents, e.g. `plans` needs both `food` and
  `hobbies`, `story` needs both `went` and `happened`.
- **3 revisit sections** (marked with a ★ on the map) — the same situation met earlier, replayed
  in a harder tense. `daypast` revisits `day` in the past; `meeting` revisits arranging things in
  the future; `familynews` revisits telling people things.
- **Grammar distribution**: 19 sections present tense, 7 past, 3 future, 3 joining-clauses.
- **5 phase bands** (labels on the map, not gates): *Present · getting by* → *Present · more of
  your life* → *Past* → *Future* → *Joining*.
- **No unlock gate exists anywhere.** A section opens purely when every section it `requires` is
  finished. There was a tier-count gate in an earlier version ("finish 6 of 10 sections to open
  tier 2") — George rejected that model explicitly and it was removed entirely, code and all.

## The six rules the blueprint is written to obey

These live as a comment block directly above `PATH_SECTIONS` in the file. Read them before
touching the data — they're not a style preference, they're what keeps a branching map legible
instead of degenerating back into the tangle of crossing lines the first version produced.

1. **The map deepens, it never gates.** No "finish N to continue" anywhere.
2. **Grammar advances with depth**, roughly every three rows: present → past → future → joining.
3. **A ★ revisit is the same situation at the current depth's grammar** — same verbs, new forms,
   not new material.
4. **Every edge means "you need those words for this."** If the words can't be named, the edge
   doesn't exist.
5. **Edges join adjacent rows and neighbouring columns only.** No line may skip a row or jump far
   sideways. This is mechanically checked (see Verification below) — it isn't just convention.
6. **New sections are only ever appended at the bottom.** Nothing above a new row may change, so
   growing the map can never invalidate progress already made. This is what makes it safe to keep
   extending indefinitely.

## How a section actually runs

Seven lessons, fixed order, each mapping onto card kinds the rest of the app already has:

| # | Lesson | Cards | Network? |
|---|---|---|---|
| 1 | Meet the words | word | none — dictionary only |
| 2 | Meet the rest | word, chunk | none — dictionary only |
| 3 | Say it | sentence | needs generated content |
| 4 | Hear it | listen, shadow | needs generated content |
| 5 | Weave | sentence + scheduler picks | needs generated content |
| 6 | Answer back | reply | needs generated content |
| 7 | The conversation | conversation | needs generated content |

Lessons 1–2 run with zero network calls, deliberately — a section that can't even start because
the AI is unreachable would be a dead node blocking everything behind it. Lessons 3–7 draw on one
cached generation call per section (`pathGenerateContent`), scoped to that section's own backbone
words plus whatever the learner already knows; the closing conversation is a second, separate
call (`pathConversation`) that reuses `learnMakeConversation` with the section supplied as the
scene rather than the general rotation.

Content is generated once, on first arrival at a section, and cached permanently in
`hvr_pathcontent`. A section's material does not change on repeat visits — regenerating it isn't
currently exposed anywhere, unlike the "clear practice sentences" reset that exists for the
free-form bank.

## Integration with the rest of the app — the one rule that matters most

**The Path writes to spaced repetition. It never reads from it to decide what to show.**

Every word a Path lesson teaches gets added to the library (`src: "path"`, distinguishable from a
real message or a batch import) and every grade goes through the normal `srsApply` call, so
Path-taught words immediately start appearing in Balanced/Weak/Quick sessions exactly like any
other word. But session composition for the Path itself never consults the SRS due-queue — it's
driven purely by the blueprint and by `pathProgress`. Two schedulers reading each other's state
would be the thing most likely to go quietly wrong here; keeping the read direction one-way is
what prevents that.

Storage keys in use: `hvr_path` (per-section lesson-count progress), `hvr_pathcontent` (cached
generated material, keyed by section id).

## UI as it stands

Own nav tab, own view (`#viewPath`), a scrollable SVG map (currently 1220×2130 in its own
coordinate space) with phase-band captions. Tapping a section raises a bottom sheet
(`#pathSheet`) — same mechanic as the sentence pad, chosen so the map stays visible behind it
rather than navigating away. The sheet shows the section's words, its seven lessons with
completion state, and a start button; it closes on its own close button or automatically when you
navigate to a different tab (it's fixed to the viewport, so it would otherwise hang over whatever
page you moved to).

Section-name labels on the map sit inside a measured box (added most recently) — sized to the
actual rendered text via `getBBox()`, not a fixed guess, and tinted by state (gold finished, teal
current, plain paper otherwise).

## Known limitations — real, and deliberately not fixed yet

**Phone layout is the honest weak point.** The map scrolls sideways at a fixed legible width
(900px) rather than reflowing. A branching structure this tall genuinely can't compress into
360px without becoming illegible; fixing this properly likely means either a simplified
phone-specific view or pan/zoom, both of which are real work, not a CSS tweak.

**No regeneration control.** If a section's generated content turns out weak, there's currently
no button to throw it away and re-roll — you'd have to clear `hvr_pathcontent` by hand. The
free-form bank has exactly this control ("Throw away all stored practice sentences" in Settings);
the Path doesn't yet.

**No visibility into path-sourced words from Settings/the strength screen.** The word-strength
fine-tuning screen (built a few passes before this one) shows every library word regardless of
source, so path-taught words *are* visible there — but nothing currently filters to "words that
came from the Path specifically" if that's ever wanted.

**Rows 14 (`properly`, y=2030) is the current bottom of the map.** Extending past it is exactly
what rule 6 exists for, but it hasn't been exercised yet — the first real extension will be the
proof that the append-only contract actually holds in practice, not just in theory.

## To do, roughly in the order I'd tackle it

1. **George walks tier-1 for real**, in his actual browser, on real AI calls. Everything below is
   secondary until this happens — every test so far has been scripted DOM assertions in a
   controlled environment, not a real generation call with real latency and real model output
   quality.
2. **Watch section-content quality specifically.** The generation prompt reuses the same
   "real person would say this" bar as the free-form generator, but it's constraining the model to
   a much narrower word list per call (one section's backbone) — worth confirming that constraint
   doesn't push quality down the way an earlier, too-strict version of the free-form prompt did.
3. **A regenerate-this-section control**, once real use shows whether it's actually needed.
4. **Phone view**, properly — deferred by explicit agreement ("we can polish after"), but it's the
   thing standing between this feature and being usable away from a laptop.
5. **Extend past row 14** — future/joining phases are thin (3 sections each) compared to the two
   present-tense phases (19 combined). Whether that's correct or needs building out further is a
   question for once tier 1–3 have actually been walked.

## Where to look in the code

Everything lives in `hebrew-reader.html`. Search for `PATH_` for the ten or so constants, and
`function path` for the ~15 functions — they're all together, starting at the blueprint
(`PATH_SECTIONS`) and ending at `pathConversation`. No other file is involved.

## Verification already done

Not claims — these were run as scripted assertions against the live DOM, not visual review:

- Every word across all 32 sections resolves in `DICT`; every chunk resolves in `PHRASES`.
- Every `requires` reference names a real section id; no duplicate ids.
- Zero edges skip a row; zero edges travel further than one column sideways (rule 5, checked
  mechanically against the actual `x`/`y` values, not eyeballed).
- All 32 sections are reachable from the single root by graph traversal.
- A full lesson (build → cards → grade → progress write → end-screen report) runs start to finish
  for an offline (network-free) lesson.
- Unlock propagation is correct: a section's children open only once it's genuinely done; walking
  out of a lesson early does not advance progress; locked nodes ignore clicks.
- The bottom sheet opens, closes on its own button, and closes automatically on navigating away.
- All four free-form session shapes (`balanced`/`weak`/`speaking`/`quick`) still build correctly
  and the Learn/Words views still render — i.e. nothing about adding the Path touched anything
  outside it.

# Atlas: the whole app in the map's clothes

**Date:** 2026-09-23
**Branch:** `redesign-atlas` (not pushed; George reviews before it goes live)
**Mockups:** the "Hebrew Reader redesign" design canvas, page *Round 2 · Atlas, refined*.

## Where this came from

George, opening it:

> I want you to use all of the graphical and design expertise to evaluate and brainstorm
> improvements to the current app's design … the core features of the app should remain
> but the UI and design should be completely reworked and drastically improved

Three directions were mocked up (Atlas, Thread, Instrument). He chose Atlas, with two
corrections that shape everything below:

> I want the map itself, the layout, the nodes the content to stay the same, I like how
> the map works moving down with the fog etc.

> The purpose of this app has slightly migrated, its no longer primarily/ at all about
> replying to voice notes, this is my primary learning app now … a redesign must
> preserve all features of the app, all learning cards, all QOL features

On round two:

> WOW, honestly Im very impressed I love this design and think this is the direction we
> should take it.

On night mode:

> lets just go with 7pm thats like an "evening has started" sort of time, and 7am as the
> switch as well. just simpler as my device is always dark mode

On the bottom bar and the coach:

> On the 3 buttons on the bottom panel I agree this is the right call … while on the home
> screen we can put the coach behind the profile icon, when in lessons/ any other page,
> the coach and flags should be at the top (as in the designs) but on the home screen im
> not using coach very much.

Answered before starting: work on a branch and do not push; the kh branch is merged
first; three typefaces are downloaded into `assets/fonts/`; the phase order below.

## What this is, and what it is not

A **reskin and a re-arrangement of chrome**. Every screen is restyled and the controls
that sit around the content move, but no learning behaviour changes: the scheduler, the
session builders, the card kinds and their grading, the coach's prompts, sync, and the map's
layout and generation are all untouched. Where a DOM id or a function is load-bearing
(tests, `learnRenderAct`, `setView`), it keeps its name — restyled, relocated if it must be,
never renamed.

## The design system

**Type.** Three faces, served from `assets/fonts/` as woff2 and added to `sw.js`'s shell:

- **Frank Ruhl Libre** (400/500/700, Hebrew + Latin) — every word of Hebrew, and the
  world's display voice (card prompts, place names, headings). Replaces `"David"` and
  the Georgia/Hoefler `--map-display` stack.
- **Cormorant Garamond** italic (500/600) — the world's asides: `why` lines, chapter
  names, "Stuck? One step at a time".
- **Instrument Sans** (400/500/600) — the interface: buttons, labels, lists.

Style guide §1 still holds: the world speaks in serif, the app in sans.

**Colour** keeps its jobs (style guide §3): gold is "you did this", teal is "you can act
on this", the four band colours are fixed. What changes is that every colour in the
stylesheet goes through a token, so a second palette can exist.

**Night.** The same world, lamp-lit: dark paper, pale ink, a warm glow around where you
are. Gold and teal are lifted just enough to hold contrast; the band colours are lifted
the same way and keep their order and hue.

- **When:** a three-way setting, **Auto · Day · Night**, in the profile menu. Auto is
  night from **19:00 to 07:00 local time** — George's device is permanently in dark
  mode, so `prefers-color-scheme` would say "night" at noon and cannot be the signal.
- **How:** `html[data-theme="night"]` swaps the tokens. The map's SVG presentation
  colours are overridden from CSS; the road's ink (mixed in JS from two constants) takes
  a night pair, and the map re-renders when the theme flips.
- The check runs on load, on `visibilitychange`, and once a minute, so a phone left open
  across 19:00 turns over without a reload. The card in progress is never interrupted:
  the swap is a class change.

## Phase 1 — tokens, type and night

- All hard-coded colours in the stylesheet become tokens (panel, paper, ink, lines,
  hazes, tints, the tier washes). `#fff` text on teal stays light by design and becomes
  `--on-accent`.
- `@font-face` for the three families; `--display`, `--map-display`, `--he` and `--ui`
  point at them, with the old stacks kept as fallbacks.
- `themeFor(date, mode)` is a pure function (tested at 18:59, 19:00, 06:59, 07:00 and for
  each mode). `themeApply()` sets the attribute and `<meta name="theme-color">`.

## Phase 2 — home

- **The top bar goes on the home screen.** The map is full-bleed.
- **Profile button** (top right, over the map) opens a bottom sheet: sync state and
  Sync now; the night setting; **The coach**; **Things to change** (flags, badge = open
  count); **Places that need sentences** (what `lContentThin` says today); AI activity;
  Under the hood; Settings.
- **Bottom bar, three tabs:** **Walk · Words · Progress**. Progress is the stats room
  that `lMapBar` opens today, given a tab of its own. `lMapBar` stays (tests and the
  stats open path use it) but is no longer the only way in.
- **Daily practice** becomes the paper slip from the mockup: title, "What's coming",
  the 5/15 buttons. Built by the same `learnRenderAct`.
- **"Running short"** leaves the top of the screen: a small pen mark sits on each node
  that needs sentences, and the full sentence moves into the profile sheet.

## Phase 3 — the practice cards

- **Lesson header** on every non-home page: close, the road, **coach**, **flag**. The
  coach and flag are the same controls as today's `uhBtn`/`flagBtn`, moved rather than
  duplicated, so their handlers and tests are untouched.
- **All eight kinds** — word, sentence, chunk, listen, reply, shadow, note, compose — are
  restyled on the paper card. The one-line `ask` per kind stays (it is the "one signal").
- **Emoji go** from the world layer (style guide §2): 🔊 🐢 🎤 become drawn icons.
- The mic becomes the large round control; the hint ladder becomes the three-step row;
  the grade buttons become three stamps with the suggested one marked.
- Everything on the card today stays on it: carry word with its transliteration,
  per-word marking, "That's not what I meant", "Why this word?", notes box and English
  mic on listen/reply, "Did you say…".

## Phase 4 — coach, place sheet, end of a walk

- **Coach table (compose):** the word table as tiles that turn gold as they land; the
  thread's coach lines carry Hebrew, transliteration and English together in one bubble
  (answers the 22 Sep flag about the floating English line).
- **Coach dock:** restyled to the mockup — same element, same mic-first behaviour.
- **Place sheet:** word tiles, the three ways in, the gold-gate box.
- **What moved / the walk home:** the end screen and speed round in the world's type.

## Phase 5 — Words

Learning first: search, strength ribbon, review queue, the grid. Voice notes (the
inbox) move behind a "…" control; the sentence pad keeps its dock and behaviour, restyled
as a bar that expands.

## Phase 6 — the rooms behind the menu

Progress (stats), Settings, flags, AI activity, Under the hood, word panel, strength
modal: tokens, type, and on a phone a bottom sheet rather than a centred box.

## Testing

- The full `?selftest` suite passes after every phase (baseline **817/817** on the
  branch before any change).
- New tests: `themeFor` boundaries; the theme setting persists; the home screen hides the
  top bar and the lesson header shows coach and flag; the profile sheet contains every
  control that left the top bar (no control is lost in the move); no emoji remain in the
  drill card's rendered output.
- Visual checks at 375px, day and night, via the Browser pane with the service worker
  cleared before every navigate (CLAUDE.md).
- **Not testable here:** the microphone is blocked in the Browser pane. Every mic
  control is checked for presence and wiring, not for listening.

## Deferred, with reasons

- **Syllable-level "what it heard" and your-voice-vs-reference playback** (round one,
  C3). Needs the app to keep a recording of every answer; that is a feature, not a
  reskin.
- **A licensed Hebrew display face.** Frank Ruhl Libre is free and good; a paid face is
  George's call, not a default.
- **Following `prefers-color-scheme`.** Rejected: his phone is always dark, so it would
  mean permanent night.
- **Voice notes as a first-class tab.** Rejected by George — the app is a learning app
  now; the feature stays, one tap further in.

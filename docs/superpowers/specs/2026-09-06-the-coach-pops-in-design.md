# The coach pops in

Follows `2026-09-06-the-coach-that-would-not-answer-design.md`, which fixed what the coach
*says*. This is about what it *is* on screen. Phase 1 of that spec stands unchanged; this
replaces its Phase 2.

## Where this came from

George, on the sheet that shipped an hour earlier:

> This is good, although it doesnt fully match the style of hte sentence pad, that being a
> floating bubble whenre I can type, I dont want it to feel like its a whole screen poping
> up, more like the coach is popping in. I also would like the default to be mic on. So I
> press the button at the top, a small text box comes up from the bottom with the mic
> instantly enabled that I can dash a quick question to coach about with my voice, if I
> need to type I can press the box, there should be a symbol to show hes listening like a
> pulsing circle in the bottom right next to the box I can press when Im done talking to
> sent to coach. I also dont need to see all the older messages in gray, maybe a little
> toggle same as the "under the hood" part currecntly (will be to be redesigned for hte
> floating sentence pad asthetic but can be minimised/ moved).

## What was wrong with the sheet

It took the pattern from `.pathsheet` — 78vh, an opaque panel, a dimming backdrop, a grip.
That is the right pattern for a node's facts, which you open, read and dismiss. It is the
wrong one for a coach you interrupt with a question, because it stops the app: the drill
card he is asking *about* is behind a scrim, and he has to close the coach to see it again.

The sentence pad is the pattern he actually named, and it is a different thing. `.padstrip`
is `pointer-events: none` except for its own content column, so the app underneath stays
live and clickable; `.padhaze` fades the page out behind it rather than dimming it; the
inputs are translucent white with a blur and a soft shadow. Nothing about it is a screen.
That is "the coach popping in".

## Phase 1 — a dock, not a sheet

`.coachsheet` is replaced by `.coachdock`. What changes:

- **No backdrop and no scrim.** The dock is `pointer-events: none`; only its own column
  takes taps, exactly as `.padstrip` does. The card behind stays visible and usable.
- **No fixed height.** It is bottom-anchored and as tall as its contents, with the
  transcript capped at `44vh` and scrolling inside itself. An empty coach is one input row
  and a mic — about 70px, not 633.
- **The pad's materials.** `rgba(255,255,255,.93)`, `backdrop-filter: blur(6px)`,
  `box-shadow: 0 2px 14px rgba(34,48,60,.10)`, the same rounded corners. `.padhaze`'s
  gradient is reused so content scrolling under it fades rather than collides.
- **The nav bubble toggles it.** No backdrop means no tap-outside-to-close, which is
  correct — the pad does not close when you touch the page either. Pressing the bubble
  again closes it, and there is a ✕ on the row.

The answers stay in the coach's serif (`.uh-ansa`, `var(--display)`) — that is his mark
across the whole app and the one thing that should not change with the furniture.

## Phase 2 — the mic is already on

He presses the bubble and starts talking. That is the whole interaction.

- **Opening starts the listen.** `micListen({ lang: "en-GB" })` — the same call
  `learnHearSpeakAttempt` makes for the "what did it mean" box, since the question is in
  English even when the answer is Hebrew.
- **Interim results fill the box live**, as they do in the hear-box. The comment there is
  the reason: a recogniser hearing nothing and one hearing everything look identical from
  outside, and the live text is what tells them apart.
- **The circle is the control, and it has three states.** Bottom right, next to the box:
  - *listening* — red, pulsing on `lmicpulse`, the same animation the drill's mic and the
    speed control already share. Press it when you have finished talking: it stops the
    recogniser and sends what it heard.
  - *idle, box empty* — a teal mic outline. Press to start listening again.
  - *idle, box has text* — a teal send arrow. Press to send what is typed.

  One control, always "the thing you press when you're done", which is how he described it.
- **Tapping the box stops the mic without sending.** He said "if I need to type I can press
  the box", so pressing it must not throw away what was already heard: the transcript so
  far stays in the box as editable text and the circle drops to its idle state.
- **A listen that ends by itself with text sends it.** That is the endpointer deciding he
  stopped talking, and "dash a quick question" means not needing a second tap to confirm.
  A listen that ends with nothing does not send: it goes quiet and leaves the box focused,
  with the app's existing `learnMicErrorText` wording.
- **The mic never fights the drill for the device.** If `micRecBusy` is set — a production
  card is listening — the dock opens in its idle state instead of failing. One recogniser,
  and the card that is being graded has the stronger claim.

## Phase 3 — earlier sittings behind a toggle

`uhThreadBlock` draws past sittings inline and faded. He does not want them there.

They stay kept, for the reason they were kept in the first place — reading one and lifting
something out of it — but behind **"Earlier ▾"**, closed by default, in both surfaces
rather than only the dock. One behaviour is easier to reason about than two, and the panel
is demoted anyway.

`coachPastOpen` is module state, reset to closed each time the dock opens: a sitting he
expanded yesterday should not be the first thing he sees today.

## Deferred, with reasons

- **Redesigning the inspector itself for this aesthetic.** He named it and then said it
  can wait — "will be to be redesigned ... but can be minimised/ moved". It keeps its quiet
  link on the dock and its existing panel. Doing it now would double the size of a change
  he wants in front of him today.
- **Making mic-on-open a setting.** He asked for it as the default, not as a choice. A
  toggle for it is a second thing to get wrong until there is evidence he wants the other
  behaviour.
- **A draggable dock.** "can be minimised/ moved" reads as being about the inspector, and
  the pad — the thing being matched — is docked rather than draggable. Revisit if it gets
  in the way of the drill card.
- **Hebrew dictation into the coach.** The box listens in English because the questions
  are English. Asking it to judge his Hebrew pronunciation is what the drill card is for.

# Style guide

What the map-and-drill redesign of August 2026 settled, written down so the next
redesign starts from it instead of rediscovering it. Read this before changing anything
visual.

Two specs sit underneath this and hold the reasoning in full:
`superpowers/specs/2026-08-24-map-trail-and-flair-design.md` (the map) and
`superpowers/specs/2026-08-25-drill-cards-on-the-road-design.md` (the drill).

---

## 1. The world and the interface are different layers

The app has two visual registers and they must not blend.

**The world** — the map, the road, the towns, the country, the drill card. Paper, ink,
an old-style serif, hand-drawn irregularity. Nothing here is a control panel.

**The interface** — the nav, the settings modal, the library grid, the sentence pad.
Sans-serif, flat panels, teal. This is fine and does not want converting.

The test for which register something belongs to: *is this the app talking, or the
world?* A chapter's name is the world. A "Save" button is the app.

---

## 2. Materials

**Paper.** A gradient that is not the same colour in opposite corners
(`#f8f3e9 → #f2ece0 48% → #eae1d0`, drawn on a diagonal), a few hundred static flecks,
and a radial vignette. Flecks are individual circles, never an `feTurbulence` filter — a
filter over a full board re-rasterises on every pinch on a phone, which is the one thing
the map must never do.

**Paper must outlast the pan room.** `.lmapview` has `padding: 45vh 40vw` so a drag never
runs out of road; anything dressing the board has to extend past that or a seam appears
when you pan into it. This was found the hard way twice — first at the content edge, then
again at the top when the sea stopped 400 units above the shore.

**Ink.** Every line on the map is drawn as a run of *overlapping segments*, not a stroke:
each takes its own width from a seeded jitter and its own colour from how far along it
sits. That is what gives a line the loading and lightening of a pen, and what lets the
road be worn behind you and pale ahead with no gradient and no visible boundary. Segments
overlap by ~1.6 units and cap round, so it reads as one line.

Ends are nudged perpendicular off the true curve, and the nudge changes only every few
segments. Jittering every one reads as dither, not as a wavering hand.

**One pen for everything.** `campInkMarks` draws the road, the side tracks and anything
else linear. A second line drawn a different way reads as a different drawing laid over
the same paper.

**Type.** `--map-display` — Hoefler Text, Baskerville, Palatino Linotype, Book Antiqua,
Palatino, Georgia. Real old-style faces that ship on the platforms this runs on; Georgia
is a screen face pretending. Used for anything the *world* says: region names, place
names, the `why` lines, the drill's prompt. There is no font file and no web font — a
licensed woff2 in `assets/` would beat this stack and would need adding to the service
worker's shell list.

**No emoji in the world layer.** 🎙 👂 💬 in a hand-drawn paper world read as stickers.
They were removed from the drill cards for exactly this reason.

---

## 3. Colour has jobs, not moods

- **Gold `--gold` means "you did this."** Streaks, finished towns, mastered words, the
  "Got it" button. Never decoration. This rule predates the redesign and holds.
- **Teal `--accent` means "you can act on this."** Buttons, the current node, the ring on
  the road where you are.
- **Warm greys** are ground: terrain, unwalked road, the scatter of unlearned words.
- **The four SRS bands have fixed colours** already used by the reading cards —
  `tier-new` `#dcd6ca`, `tier-weak` red, `tier-progressing` amber, `tier-strong` green.
  Reuse them for anything that shows word strength. Do not invent a second language for
  the same four states.

---

## 4. Rules that kept being right

These came out of specific arguments and each one has a scar behind it.

**Terrain, not instruction.** George: *"I dont want it to be 'you have to follow this
path' ... more a syslistic note."* The road is a fact about the world, not a queue. Wear
behind you is a property a road has; a "you are here" marker is the app telling you what
to do. Prefer the former every time.

**One signal, not four weak ones.** The drill card carried a glyph, a label, a direction
pill *and* an instruction line, all describing the same task, plus a fifth line repeating
half of it. The pill had been added because the labels didn't distinguish two card kinds
— the fix was one clear thing, not a fourth layer. When you find yourself adding a
clarifier, check whether the thing it is clarifying should be replaced.

**The arrangement carries the meaning.** A word scattered around a node and the same word
ordered on a ring are the same word; the difference between them *is* the message. Look
for meaning you can express through position, order or wear before reaching for a label
or a badge.

**A metric must never contradict its own caption.** "Strong" needs stability ≥ 21 *and*
difficulty ≤ 5, so a progress bar filled from stability alone sits full while its label
still says "progressing". Bars are drawn from whichever dimension is furthest behind, so
a full bar always means what it says.

**Report movement, not currency.** XP was proposed and binned. The app already has a
level that *measures* capability from clean-rate evidence; XP pays for volume, which is
what the SRS spends real effort refusing to reward. The end screen shows what the
scheduler actually did instead.

**Charge a cost where it was incurred.** A hint taken for one hard word used to downgrade
every other word in the sentence. Any "this cost you something" mechanic must be scoped to
what it actually touched, or it silently damages things it never helped.

**Standing instructions become wallpaper.** "Tap any word to see what it means" rendered
on every multi-word card forever. If a line will be read three hundred times, it should
be discoverable (a `title`, a first-run hint) rather than permanent.

**Ornament must be earned.** A compass rose lasted one commit. George: *"the compas is a
bit takky."* A symmetrical vector star is the least hand-drawn thing that can sit on this
paper, and it claimed a cartographic register the map hadn't yet earned. The empty space
wanted terrain, not furniture.

**Connect things unless there's a reason not to.** Side tracks were capped by distance;
George's rule was better — *"Aslong as hte path doesnt go through another node it can
connect."* Constrain on the real obstacle, not on a proxy for it.

---

## 5. Generated, but constrained

Everything laid out on the map is generated from a seed, and none of it is free.

**Seeded, never random.** `campJitter(i, salt)` is a fixed hash. A line that reshuffles
its own texture on every render is worse than a perfectly uniform one, because the eye
catches it moving. Anything that redraws must land in the same place.

**Vary only what cannot break the rules.** The constellation generator varies which of
three silhouettes a chapter takes, how far each row slides, and where a node sits inside
its slot. Columns stay 400 apart so the worst case after jitter still clears the 340
minimum separation. A genuinely random scatter clusters and collides.

**Generate, then verify, then re-roll.** The road router produces a candidate, checks it
against the same geometry the tests use, and tries again — up to 44 times — before
falling back to a known-good hand-authored route. *A map that occasionally repeats itself
is much better than one that occasionally draws a road through a town.*

**The tests are the generator's contract.** Clearance rules live in tests that run over
every chapter size and many chapter seeds. When the generator changed, those tests caught
a road bowing into a name box, a five-node route grazing a ring, and a halo that couldn't
thread a road crossing it. Write the constraint as a test first; it becomes the
acceptance criterion for anything generated later.

**Two figures describing the same clearance must be one constant.** The router certified
routes the checker then rejected, because they disagreed about how wide a label is.
`CAMP_LABEL_HALF` exists to stop that recurring.

---

## 6. Layout facts worth not re-deriving

- Node ring radius **44**; label box and `why` line extend to roughly **y + 100** and are
  **~95 either side** regardless of how short the name is — the `why` line is the wide
  part.
- Two nodes need **340 apart horizontally or 200 vertically** or they overlap on screen.
- A chapter band is **470** tall, the board **1220** wide, node offsets **−40 to 340**.
- The halo is an **ellipse flattened to 0.72** — a round one at that radius reaches into
  the label of whatever is 200 units above.
- Side tracks are drawn between **92 and 560** units; nearer than that the node is
  already on the road, and the far limit is a sanity bound, not the real rule (see §4).
- The drill's road **windows past 12 cards**. Thirty waymarks across a phone are dots too
  small to count.

---

## 7. Working on this codebase

**It is one 1MB HTML file and that is deliberate.** Logic stays in it. An `assets/`
folder for fonts or textures is acceptable and would need adding to `sw.js`'s shell list.

**Tests:** open `hebrew-reader.html?selftest`. `document.title` becomes
`selftest <pass>/<total>`; failures land on `window.__selftest.failures`. There were 386
at the end of this work.

**The service worker is stale-while-revalidate, so the first reload after an edit serves
the previous version.** Always reload twice before believing what you see. This will
waste an hour if you don't know it.

**Line endings are CRLF and `.gitattributes` says `* -text`.** `sed -i` strips them and
turns a three-line change into a 20,000-line diff. Edit with Python opened
`newline=""`, or with the editing tools.

**Splicing between two markers is dangerous.** `s[:start] + new + s[end:]` with the end
marker *before* the start marker silently duplicates thousands of lines — including whole
function definitions, where the later one wins and the tests still pass. Always
`assert end > start`, and after any structural edit check that function definitions still
appear exactly once.

**Screenshots lag roughly one interaction behind the live DOM**, and the Browser pane
sometimes stops compositing — `preview_stop` then `preview_start` brings it back. Verify
state by querying the DOM, and use screenshots to judge appearance, not correctness.

---

## 8. How this work goes best

George reads the running app on his phone, screenshots it, and circles things. That
feedback is worth more than any amount of reasoning in advance, so: **ship something
lookable-at early, then iterate against what he photographs.**

He mixes genuine bug reports into design conversations — *"not necessarily a style point
but wanted to make it here anyway"* — and those have twice turned out to be the most
valuable thing in the message. Chase them.

When he sets a constraint on a change (*"so long as it doesnt reduce the strength of
those words to"*), check whether the current code already violates it. Both times, it
did.

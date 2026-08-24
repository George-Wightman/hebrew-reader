# The map as country: a trail, settling words, and drawn paper

Design agreed 2026-08-24. Replaces the dependency-edge rendering on the campaign map
with a single wandering trail, adds a faint word treatment around nodes that changes
state when a node is finished, and gives the empty paper some cartographic character.

## Why

The map currently draws golden bezier edges between nodes, derived from which earlier
node introduced each carried word. Those edges say "you needed that for this" — they
are a dependency graph, and a graph on the page reads as instructions.

George's framing, verbatim: *"I dont want it to be 'you have to follow this path' I
want it to be more like an adventure. Imagine a game like Skyrim, You are exploring,
there are things you pass along the way, you find Whiterun naturally, you follow the
path, you can choose to see it and move on, or you go into the node ... the path
shouldnt be super improtant in terms of informing you what to do, more a syslistic
note."*

So the trail is terrain, not a queue. It goes somewhere; the nodes are places it
happens to pass. It never tells you what to do next — the nodes already do that.

## What goes away

`campComputeNeeds`, `pathEdgePath`, the `needs` field on nodes, the `edges` array in
`campLayout`, the `.pedge` CSS, and the two `campComputeNeeds` tests. `needs` is
consumed by nothing else. This is a genuine deletion, not a deprecation.

`campPickCarry` and the `carry` field stay — carry words make a node's sentences
possible and have nothing to do with drawing.

## The trail

### Geometry

A new pure function derives the trail from the layout the same way `campLayout` derives
everything else: no DOM, no storage, unit-testable on its own.

The trail descends the full map height. Within each chapter band it runs past that
chapter's constellation without passing under a node. Node positions are not touched;
`CAMP_SHAPES` is unchanged. The map still reads as areas you explore, because it still
is.

**Routing through the widest gap is wrong, and building it proved it.** The
constellations are spread across 1220 units, so the widest gap is enormous: every node
came out 120–290 from the trail, every one cleared the spur threshold, and what was on
screen was the dependency graph again with a trunk down the middle. Each shape must
therefore deliberately **graze** one node — passing close enough that it needs no spur —
and leave the rest set back. One node the road runs right past, several off in the
country, is the thing being described.

Two collision traps, both now pinned by tests. A node is its ring **plus** its name box
**plus** the `why` line, so a gap that looks generous on the coordinates can be no gap
at all. And a Catmull-Rom curve bows between its waypoints, so waypoints that each clear
every node individually can still sag into one.

Because a chapter's node count determines its constellation, and the constellations are
hand-authored, the trail's route through each is hand-authored too — one waypoint set
per node count, matching `CAMP_SHAPES`. A computed route (nearest-neighbour, force
relaxation) would be almost-right and occasionally ugly in ways that cannot be
corrected; six small arrays can simply be made good.

### Rendering

The trail is **not** a dashed stroke. The curve is sampled into points with a running
length in pure JS, and each dash is emitted as its own mark along it.

Sampling rather than measuring the inserted path with `getPointAtLength` — which is what
this design originally called for — keeps the whole trail pure: where a mark goes, how
close a node is, where a spur leaves are all questions about position along the curve,
and answering them without the DOM makes every one of them unit-testable, exactly like
the rest of the layout.

Walking the curve rather than stroking it buys three things at once:

- **Nib pressure.** Each mark takes its width and length from a seeded jitter, so the
  line has the loading and lightening of a pen rather than the uniformity of a plot.
  The seed is fixed, so the trail is identical across renders — a line that reshuffles
  itself on every state change would be worse than a plain stroke.
- **Wear.** Each mark takes its colour from its distance along the path relative to the
  furthest point reached. Behind you the marks are warm and solid; ahead they pale.
  There is no boundary, because there is no gradient stop — each mark is simply
  slightly paler than the one before. A worn track is a physical fact about a road, not
  a progress bar, which is what keeps it on the right side of "does not instruct".
- **Taper.** Marks thin over the last stretch, so the trail runs out into unexplored
  ground rather than stopping dead at the bottom of the board. The fog sheet, which is
  drawn over everything, takes care of the rest.

Wear means **touched**, not available. Counting `open` nodes — startable, never started
— wore the trail to the bottom of chapter one on a map nobody had opened, so the whole
first chapter read as already walked on day one. Only `done`, `stale` and `current`
move the wear front, and an untouched map is pale end to end.

Cost is roughly 200 elements per render. `campRender` runs on state change, not on pan
or zoom — zoom resizes the board and the SVG scales with its viewBox — so this is not
on a hot path.

### Spurs

A node further than a threshold from the trail gets a spur: a short, slightly curved,
dashed track from the trail to the edge of its ring. Nodes already near the trail get
nothing, because they do not need one.

The spur is what makes distance intentional. On mostly-empty paper a node sitting alone
a long way from the trail with nothing between them reads as unfinished layout; with a
spur it reads as somewhere off the main road. The spur to a finished node is worn and
warm; the spur to an unfinished one is pale.

### Waymarks

Where the trail crosses a chapter boundary, a small cartographic waymark sits at the
intersection, placed by `getPointAtLength`. Crossing into new country should be an
event; at present the trail passes through the band line as if nothing happened.

## The words

Three words per node — enough to read as texture, few enough that a chapter of finished
nodes is not a wall of Hebrew. Chosen by a seeded shuffle of the node's `words` minus
`STOPLIST`, so the choice is stable per node but is not always the first three.

### Drift, then halo

An unfinished node's words **drift**: scattered in the paper around it at mixed sizes
and slight rotations, positions derived from the node's seed. Very faint. No two nodes
look alike, so several on screen read as landscape rather than as a repeated widget.

A finished node's words **settle** into a **halo**: the same three words on a ring
around the node, evenly spaced, a little bolder and clearer — still faint, never
obvious. The change of arrangement is the record of having finished.

The halo occupies the **upper arc and sides only, never below the node**. A node that
changed size on completion would shove its name box down and make the whole
constellation jump.

The drift-to-halo change is a transition, not a snap. If you are looking at the map when
a node completes, you see the words gather.

### Decay unravels it

A stale node — one whose gold has slipped — has its halo come loose and drift part-way
back out toward scattered. This replaces the `↻` glyph. Repairing the node pulls the
ring back into order.

This is the reason the word system earns its place: it means something in both
directions. The map reports decay; the quick sessions repair it.

### Where they appear

Drift appears **only in the live chapter**, the same rule the `why` line already
follows.

Halos persist on **every finished node in every chapter, permanently**. George: *"in a
few weeks when im a good amount of chapters down, I could scroll up and see the ordered
words and golden rings, to see how far I have progressed."* The trail behind you gets
richer as you scroll back down it, which is a real reward for looking back.

Fogged silhouettes have no words at all — they have no vocabulary yet.

## The paper

**Region names.** The band label is currently small gold uppercase pinned at x=60 — it
looks like a UI section header because it is one. It becomes a place name: display
serif, widely letterspaced, sitting out in the open paper near the trail.

**A drawn fog edge.** The fog is a clean linear gradient, which reads as a CSS effect.
Its top edge becomes a soft irregular line — the boundary of surveyed ground — so the
unexplored part stops being dimmed UI and becomes the edge of the map.

**A compass rose.** The map can already pan into empty space, and that space is blank.
One faint rose in the empty paper, rewarding a pan off the trail.

**The reveal.** When `campPlan` commits a new chapter, the map notices it has not drawn
that far before and animates once, about a second: the trail extends into the new
ground, the region name and fog edge arriving with it. The map extending itself is the
most "the world got bigger" moment available, and it happens at exactly the right time.
The marker for how far has been drawn is stored, so the animation fires once per
chapter and never on a reload.

## Staging

Each stage leaves the map coherent and shippable on its own.

1. **The trail** — geometry, marks, wear, spurs, waymarks; delete the edge apparatus.
2. **The words** — drift, halo, the settle, the unravel.
3. **The paper** — region names, fog edge, compass rose, the reveal.
4. **Terrain** — faint contours, hatching, or small stylised hills and groves seeded per
   chapter, filling the gaps between constellations.

Stage 4 is deliberately last and deliberately separate. It is the biggest prize and the
biggest risk: done well it is transformative, done at eighty percent it looks like
smudges, and it is as much work as the other three together. It is designed only after
stages 1–3 are on screen and it is possible to see how much empty paper actually wants
filling.

## Decisions taken and rejected

- **Trail passes near nodes, not through them.** Rejected: a trail visiting every node
  in order, which is a queue with a curve on it.
- **Stitched dashes over a pale bed**, rather than a single ink stroke or a cased
  double line. The cased road smears at low zoom and competes with the nodes; the
  single stroke is quieter but the trail convention is what says footpath rather than
  infrastructure. The shimmer objection to dashes does not apply: zoom resizes the
  board and the SVG scales with its viewBox, so dashes scale with everything else.
- **Drift, not halo, for unfinished nodes.** An even ring on every node makes the words
  look like a UI element with a job, and pushes the name box out by ~40px.
- **Wear on the trail**, rather than a neutral trail or a "you are here" marker. A
  discrete marker is the instruction George explicitly did not want.
- **Halos persist forever**, rather than living only in the live chapter. Density is
  managed by three words per node, not by expiry.

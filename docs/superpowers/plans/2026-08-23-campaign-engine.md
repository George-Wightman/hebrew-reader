# Phase 2 — the generative campaign engine

Executes the design in `docs/superpowers/specs/2026-08-23-campaign-rework-design.md`.
Replaces the 32 hand-authored `PATH_SECTIONS` with chapters generated from evidence.

## Order of work

Deliberately: everything that can be built and tested with no network first, then
the pipeline on top. A campaign that cannot draw itself offline is one that cannot
be debugged.

### 1. The store and the model  *(no network)*

`hvr_campaign`:

```js
{ v: 1,
  chapters: [{
    n: 1,
    theme: "Getting by",
    state: "done" | "live" | "next" | "fog",
    nodes: [{
      id: "c1-hello",
      name: "How you are",
      icon: "שלום",            // one Hebrew word, drawn in the circle
      situation: "greeting someone and saying how you are",
      why: "where everything starts",   // shown under the node
      lvl: 1,
      words: ["שלום", "בסדר", …],       // ~70% new
      carry: ["אני", "טוב"],            // ~30% from nodes already passed
      needs: ["c1-x"]                   // COMPUTED from carry, not authored
    }],
    sketch: [{ name: "…" }]   // only on the fogged chapter
  }],
  log: [{ n: 1, theme: "…", taught: "…", note: "…" }]
}
```

Node progress reuses `hvr_pathscores` keyed by node id — the shape is already
`{id: {lesson: {pct, ts}}}` and nothing about it was section-specific.

Functions: `campAll/campSave`, `campChapter(n)`, `campNode(id)`, `campLiveChapter()`,
`campNodeState(id)`, `campChapterOpen(n)`.

### 2. Completion rules  *(no network)*

- `campNodeWordsReady(node)` — every word in `node.words` is `progressing` or better.
- `campNodeDone(id)` — words ready AND the closing conversation passed.
- `campChapterThreshold(n)` — `Math.max(3, Math.floor(n * 0.7))`.
- `campChapterOpen(n)` — the previous chapter has that many nodes done.
- `campNodeStale(id)` — was done, and a word has since fallen below `progressing`.
  Drives the reopen marker. Repair happens in ordinary quick sessions, never here.

### 3. Cold start and airbag  *(no network)*

`CAMP_SEED` — one authored chapter of four nodes (greetings, people, your day,
asking for things) with words straight from `DICT`. Written on first run. The
generator is earned, and day one has no evidence to plan from anyway.

`CAMP_FALLBACK` — two further authored chapters used only when generation fails or
quota is gone. Not a spine; an airbag.

### 4. Procedural layout  *(no network)*

Chapters are horizontal bands, 300 units apart. Columns fixed at
`170 / 390 / 610 / 830 / 1050`; a chapter of *n* nodes takes the middle *n*.
Edges are drawn from `needs`, which is computed by asking which earlier node
introduced each carried word. At most one merge per chapter.

`campLayout()` returns `{w, h, nodes:[{...node, x, y}], edges:[[a,b]]}` and is pure —
so it is unit-testable without a DOM.

### 5. Rendering  *(no network)*

Rewrite `pathRender` against the campaign store:

- done → gold; live chapter nodes → open/current as today; stale → teal with a marker
- `next` chapter → drawn, dimmed, not clickable
- `fog` chapter → silhouettes under a soft radial mask, sketch names only
- behind → chapters more than one back collapse to a ribbon row
- the node's `why` renders under its name in the live chapter only

### 6. Lessons  *(no network for lesson 1)*

The seven fixed lessons go. A node has:

- **Meet the words** — word cards from `node.words`. Offline, always available.
- **Practise** — `learnBuild` with `targets` restricted to `node.words + node.carry`.
  Repeatable. This is the "a campaign lesson is a Learn session" clause.
- **The conversation** — graduation. Unlocked when `campNodeWordsReady`.

`learnBuild` gains an optional `opts.only` word list; everything else unchanged.

### 7. The pipeline  *(network)*

`campPlanNext()` — fire-and-forget, triggered when the live chapter crosses its
threshold, same pattern as `convoTopUp`.

1. `campSurvey()` — Lite. Digest into a brief: level and direction, strong/decayed
   words, archive words not yet known, chapter log.
2. `campPlan(brief)` — Flash. 4–6 nodes with name, icon, situation, why, level,
   words; plus a sketch of the chapter after.
3. `campCritique(plan)` — Lite. Repetition against the log, difficulty, words that
   do not exist, progression. Returns edits. Empty response ⇒ keep the plan
   unedited, exactly as `learnReviewItems` does.
4. `campBuildNode(node)` — Lite, one per node. Sentences/listen/reply/gloss at the
   node's level, ingested into the shared bank via `learnIngest`.

Word assignment is done LOCALLY, not by the model: the plan proposes a theme, and
`campPickWords(node)` fills `words` (70%) and `carry` (30%) from archive → weak
library → DICT. A hallucinated word list would poison the scheduler silently.

### 8. Migration

Anyone with `hvr_pathscores` from the old 32 sections keeps their word strengths —
those live in `hvr_srs` and are untouched. The old section scores are dropped, and
the campaign starts at `CAMP_SEED` with any already-strong words auto-completing
their nodes on the first render.

## Verification at each step

`?selftest=1` after every step; `campLayout`, the completion rules and the
threshold get unit tests. Steps 1–6 must be fully working with no key configured
before step 7 is written.

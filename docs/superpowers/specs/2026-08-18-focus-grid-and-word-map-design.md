# Focus grid + Word map — design

**Date:** 2026-08-18
**Problem:** The Library serves two conflicting jobs: (1) George's focusing pad for
composing sentences — wants to be small and intentional; (2) the machine's word pool
gating everything on the Learn page (SRS, sentence bank, conversation, Path) — wants
to be big. Batch imports (SEED ~90, CORE_WORDS 36, DUO_WORDS 84) served job 2 and
drowned job 1: 237 visible words, roughly half never individually chosen (the
Duolingo numbers/animals/colours block among them). George's stated intent from the
Archive split still stands: "the library is for words I'm learning."

**Resolution:** split *visibility* from *membership*. `hvr_library` stays the machine
pool — nothing in Learn changes. What George sees becomes two views behind a toggle:

- **Focus grid** — the current Excel-style grid, showing only words "in play."
  The sentence-writing surface. Heavily curated.
- **Word map** — a pannable, zoomable constellation of *everything* (all library
  words + archive-only words), clusters = categories, dense list rows inside
  clusters. Eventually replaces the Archive drawer. If it works well it can become
  the default view.

Search is the spine of both: filter-and-highlight in place on the Focus grid;
fly-to-cluster and pulse-highlight the row on the map.

## Data model (Phase A)

- New per-entry field on `hvr_library` entries: `shelf: "focus" | "reserve"`.
  Absent field is treated as `"focus"` (safe default for any code path that
  creates entries without it).
- **Learn/SRS/export/harvest ignore `shelf` entirely.** Retiring a word can never
  break conversation mode or lose SRS history — that's the whole point.
- One-time migration `hvr_shelf_v1` sets the initial shelves:
  - starred in `hvr_focus` → `focus` (explicit "working on it" beats everything)
  - `src === "batch"` and `seen === 0` → `reserve` (imported, never met in a
    real message)
  - `srsStrength` strong on **both** sides (hear + say) → `reserve` (he knows it)
  - everything else → `focus`
  Migration follows the established rules: runs after `libSeedIfNeeded()`, never
  writes an empty library, idempotent.
- New words entering the library (approve from Pending, ⊕ manual add, promote
  from archive) default to `focus` — a word he just asked about is by definition
  in play.

## Focus grid (Phase A)

- `renderLibrary()` filters each block's words to `shelf === "focus"` when the
  view mode is Focus. Blocks with zero focus words don't render. Pending block
  unchanged.
- **Header count chip:** "N in focus · M in reserve". Clicking the reserve count
  toggles a temporary "show everything" mode (the pre-map stand-in so words never
  feel deleted; the Word map replaces this as the home of reserve words).
- **Retire / promote:** a per-row hover action (↓) sets `shelf = "reserve"`,
  with `setLibStatus` feedback + single-level undo. In show-everything mode
  reserve rows render dimmed with a ↑ promote action.
- **Bulk actions** (Settings → Housekeeping, confirm-guarded like every other
  bulk action there):
  - "Retire words I already know" — both-sides-strong → reserve.
  - "Retire untouched imports" — `src:"batch"`, `seen === 0`, unstarred → reserve.
- **Collapsible categories:** clicking a block's header collapses it to a
  one-line name + count bar; persisted in `hvr_collapsed` (a set of category
  names). Collapse state is shared by both grid modes.
- **Search upgrade:** the existing search box, same matching, but matching rows
  highlight and non-matching blocks dim rather than disappear (layout stability —
  blocks keep their positions), Enter jumps/scrolls to the next match. This is
  the same interaction contract the map will implement spatially.
- Per-word features must be added to `buildWordRow` AND `buildOppSideEl`
  (standing rule from the focus-marks bug) — retire/promote included.

## Word map (Phase B)

- **View toggle** in the Library header: Focus ⇄ Map. Persisted (`hvr_libview`).
- **Viewport:** one absolutely-positioned plane inside a clipping container.
  Pan = pointer drag on empty space; zoom = wheel (zoom-to-cursor) + the existing
  zoom slider; transform via CSS `translate(...) scale(...)`. Vanilla, no deps.
- **Clusters = categories.** Initial positions from a hand-authored adjacency
  layout (Food near Flavours near Everyday things; Verbs/Grammar central;
  Numbers/Colours peripheral) — ~25 categories doesn't need MDS or embeddings.
  Cluster drag repositions; persisted `hvr_mappos` (same idiom as
  `hvr_blocklayout`). A one-off cached AI pass to suggest adjacencies is a
  possible later nicety, not a dependency.
- **Semantic zoom, two levels:**
  - Far: a cluster renders as a bubble — name, word count, strength summary dots.
  - Near (past a zoom threshold): the cluster renders its dense word rows using
    the existing row builders. Density inside, geography outside.
- **Content tiers:** library-focus rows full strength; library-reserve rows
  dimmed; archive-only words faint ghost rows inside their category cluster
  (falling back to an "Everything else" cluster when the archive entry has no
  usable category), each with the existing ⊕ promote action. This is what lets
  the map replace the Archive drawer.
- **Search-to-fly:** typing shows match count + dims non-matches; Enter animates
  the viewport (pan + zoom) to the best match's cluster and pulse-highlights the
  row; repeated Enter cycles matches. Animation honours
  `prefers-reduced-motion`.
- **Row actions on the map** reuse the existing ones: ★, edit, retire/promote,
  ⊕ (archive rows). Drag-to-recategorise between clusters reuses
  `moveWordToCategory` (existing confirm-guard conventions apply).
- **Retirement of the Archive drawer** happens only after the map proves itself
  (George's call), not as part of the initial map build.

## What this deliberately does NOT do

- No deletion of batch words, no shrinking of the Learn pool, no SRS resets.
- No embeddings/MDS; no external libraries (single-file constraint holds).
- No phone-specific map layout in v1 (same honest horizontal-scroll stance as
  the Path).
- The map does not merge `hvr_library` and `hvr_archive` stores — it merges the
  *presentation* only.

## Phasing

- **A1:** `shelf` field + migration + Focus filter + retire/promote + header
  counts + show-everything fallback.
- **A2:** collapsible categories, bulk retire actions, search
  highlight-and-jump.
- **B1:** map view toggle, viewport pan/zoom, cluster layout, semantic zoom with
  library words.
- **B2:** archive ghost rows, search-to-fly, drag-recategorise on map; then
  (on approval) drop the Archive drawer.

## Testing notes

- Preview harness can't verify load-time migrations by reload (documented
  limitation) — replay `hvr_shelf_v1` logic directly in one `javascript_exec`
  against fixture data, run twice to prove idempotency.
- Dock overlap: any new fixed-height UI must respect `syncPadOffset()`.
- Verify Learn regression explicitly: a session built after retiring words must
  still draw on reserve words (conversation mode especially).
- Map perf target: smooth at 1,000 words (grid already verified fine at that
  scale; map adds only a transform).

# The drill joins the map: cards on the road

Design agreed 2026-08-25. Brings the exercise cards into the visual language the map
redesign arrived at, rebuilds the help path into a single ladder, fixes two live bugs in
how hints are targeted and paid for, and replaces the thin end screen with a per-word
record of what the session actually moved.

## Why

The map now means something — a road, wear behind you, walled towns, country between
them. The drill is a completely different app behind a button: white panels, teal
chrome, emoji glyphs, none of the paper or ink. George: *"we have finally mastered the
main pages sytle ... bringing it up to the new stylised vrsion would be a big
improvment."*

XP was considered and rejected. George: *"the idea of XP should be binned, it doesnt add
anything new and jsut diluets the pool really."* He is right twice over. The app already
has a level — `levelMeasure` derives a 1–5 band from clean-rate evidence, decays it, and
moves at most one band a session — and it is explicitly *"a measurement, deliberately not
a setting"*. XP is the opposite kind of number: it pays for volume, where the level
measures capability, and paying for volume is what the SRS spends real effort refusing to
do. What replaced it is better: show the movement the scheduler actually made.

## Two live bugs this fixes

Both were found by reading the hint path after George reported the symptom.

### Hints are aimed at words he already owns

`hintPrimeStep` collects every library word in the sentence as a hint target. It consults
neither strength nor `STOPLIST`. For "אין לי מחשב" the targets are אין, לי and מחשב —
and **אין and לי are both stoplisted**, meaning `srsGradable` refuses to schedule them at
all, so they carry no strength record and are function words he has had since day one.
The one word he needed is one chip in seven, indistinguishable from the noise.

George: *"The current hints will give words that I am already dtong with (like lo or ein)
and not the word that I actualyl dont know."*

The rung below it, "Each word starts with", has the same blindness: it gives the first
letter of every word including the ones he knows cold.

### A hint on one word degrades every other word in the sentence

`learnCapGrade` is per card, not per word. `learnCommit` runs every token's grade through
it, so one hint taken for מחשב downgrades every word in that sentence from "Got it" to
"Nearly" — and "Nearly" is not neutral in the scheduler: it multiplies stability by 0.9
and adds 0.5 to the miss ratio. **Asking for help on the one hard word actively shortens
the interval on every easy word standing next to it.**

George, setting the constraint that surfaced it: *"so long as it doesnt reduce the
strength of those words to."*

## The screen

The same sheet as the map — the warm gradient, the flecks, the vignette — but **no
terrain**. Terrain is the map's job; here it competes with the thing being read.

A **journey strip** across the top: a stretch of road in the map's own ink, worn and warm
behind, pale ahead, one waymark per card, a teal ring at the card you are on. Below it
the **page**: a raised leaf of lighter paper carrying the card.

The road is the world; the page is what you are doing at this stop. The strip stays put
while the leaf changes, so finishing a card turns the page and advances the waymark.

Past roughly twelve cards the strip **windows** — it shows the stretch around you rather
than compressing the whole session into dots too small to read.

The alternative considered was no panel at all, content directly on the paper. Rejected
on the busy cards: a listen card carries audio, a scratch box, a label and a button
before reveal, and afterwards can hold the question block, the Hebrew, the mic
transcript, a replay row, tappable chips, an inline word panel, the English, a fit-words
list, three grades and an explain link. With no panel none of that is organised.

## Before you answer

One line of instruction in small letterspaced ink, and the prompt in the map's old-style
face.

**Deleted:** the emoji glyph (🎙 👂 💬 🔁 📩 — stickers in a hand-drawn world), the
EN→עב direction pill, the `n / total` counter (the strip owns that now), and the
`#lRunHint` keyboard line, folded into the instruction.

The pill existed because the labels did not distinguish listen from shadow — both play
Hebrew at you. The distinction is carried instead by **the thing you answer with**:
listen hands you a text box, shadow hands you a mic. That is concrete and you touch it,
where a pill reading עב → עב is a label to decode.

**One primary button.** The mic on production cards; **"Check it"** on comprehension
cards, where pressing it is not giving up but submitting — `matchMeaning` runs against
the scratch box and grades it. Today it says "Show me" and carries the same weight as the
surrender it is on every other card.

Beneath it, one quiet link: **"Stuck?"**

## Stuck

Opens the existing rungs in order, cheapest first, with the full answer as the last one.
You cannot reach the answer without passing the cheaper help — which is what
`learnCapGrade` already believes and the current interface lets you bypass by pressing
the button sitting right beside it.

Three changes to what the rungs contain:

- **Prime chips draw only from words that are weak, progressing or new** on the side this
  card tests (`KIND_SIDE` already knows which), with stoplisted words excluded outright.
  If everything remaining is strong, the rung does not fire — there is nothing there he
  needs reminding of.
- **The letter rung becomes scaffolding.** Known words spelled out, the hard one blanked
  to its first letter: `אין לי מ___`. It hands over more of the answer than blanking
  everything, which is acceptable because the help is paid for and because producing the
  hard word *inside a sentence* is the thing being trained.
- **Hint cost becomes per word.** Each rung declares which keys it exposed. Only those
  are capped. Rungs that hand over the whole thing — the full pronunciation, "What to
  say" — expose everything and legitimately cap the card. `learnHints` stops being a
  counter and becomes a set of exposed keys.

That last change is what makes the scaffolding safe: showing him אין because he already
owns it costs אין nothing, because the hint never claimed to be teaching it.

## After you answer

Structurally unchanged — this half works. The Hebrew at size in the display face, the
pronunciation chips still tappable, the word panel still opening inline, the three grades
still explicit and still separate from the mic's suggestion. Restyled to paper and ink,
with **gold for "Got it"**, matching the map's rule that gold means *you did this*.

**Deleted:** `.ltaphint` (permanent instruction that becomes wallpaper), the `1/2/3` key
labels inside the grade buttons (meaningless on the phone, which is where this is used),
and the duplicate 🔊/🐢 pair — one audio control that persists across the reveal rather
than two at different sizes in two places. `.lfit` moves to the ladder, where the same
list already exists as a rung, rather than appearing again after the answer.

Conversation keeps its silent auto-advance and its repair turn untouched.

## The end screen

Today: `12 / 15`, one subtitle line, two buttons. Meanwhile the stats room already holds
minutes, cards, days, words-you-can-produce, library size and fourteen-day bars — so
"richer" has to mean *different from* the stats room, not a preview of it.

George's idea, and it is better than XP because it reports something true: *"each word
has an XP bar (2 for hte comprehension and production I suppose) and Theres like a green
or red +/- depending on performance."*

Per word, two bars — **say** (`prod`) and **understand** (`recv`) — filled by how close
that side is to *strong*, measured on **whichever of stability or difficulty is furthest
behind**. That construction matters: strong requires `stab >= 21` **and** `diff <= 5`, so
a bar filled from stability alone would sit full while the label still read
"progressing". Taking the minimum means a full bar always means strong and can never
contradict itself.

Each bar is coloured by its band, reusing the tier colours the reading cards already use
(`.tier-weak`, `.tier-progressing`, `.tier-strong`) rather than inventing a second colour
language. A green or red delta sits on the right.

**Something moves almost every session.** At baseline difficulty a clean answer runs the
interval 1 → 2 → 5 → 12 → 28 days. Band changes, by contrast, are rare — several clean
answers across several days. A screen that showed only rank changes would be empty most
sessions, which would be both deflating and false.

**Volume:** movers get rows. Anything that held steady — a same-day repeat, or a grade
that moved nothing — collapses to one quiet line of chips beneath. "Held steady" is real
information, not a gap in the report.

## Staging

1. **The hint ladder and its costing.** Behaviour, fully testable, no pixels.
2. **The screen and the card.** The visual work, on settled logic.
3. **The end screen.**

Stage 1 goes first despite being the least visible, because the per-word cap bug is
degrading the scheduler every time a hint is taken today.

## Decisions taken and rejected

- **XP: rejected outright.** It duplicates a level that already exists and pays for
  volume the SRS deliberately refuses to reward.
- **The card is a place on the road**, not a restyled panel — rejected keeping the
  current structure in map colours, which is what you would do if the map had not
  happened.
- **A page on the paper**, not content floating directly on it — rejected on the busy
  cards, which have nothing to organise them without a panel.
- **One instruction line and the answer affordance**, not a drawn glyph system —
  rejected five glyphs to learn with no room to be wrong about which card you are on.
- **Help is a ladder, not a second button.** Rejected re-weighting the existing three,
  which leaves the free bypass in place.
- **Bars measured on the binding constraint**, not on stability alone — a bar that can
  contradict its own label is worse than no bar.

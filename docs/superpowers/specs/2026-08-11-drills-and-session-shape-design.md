# Learn Page, Phase 4: Two New Drills, and Choosing the Session

**Date:** 2026-08-11
**Status:** Approved, building
**Part of:** the four-phase Learn overhaul (scaffolding → speaking → tracking → **exercises**)

## Why

The four existing drills all train the same motion: *retrieve a Hebrew word or sentence from an
English prompt.* Two things the research is clear about are missing entirely.

**Chunks.** Fluency research is consistent that multi-word formulaic sequences retrieved *whole* are
what shorten pauses and lengthen runs of speech, and that the same sequence retrieved word-by-word
loses the advantage. Everything the app drills is a single word or a sentence assembled from single
words. **`PHRASES` already holds ~60 conversational chunks** — *ma nishma*, *af pa'am*, *ma hamatzav*
— and they are used only for *reading* comprehension, never once drilled.

**Shadowing.** Hearing something and repeating it immediately, matching its rhythm, has strong
evidence behind it for fluency and prosody — and it's the one drill that trains sounding natural
rather than being correct. It was impossible before Phase 2, because nothing could tell whether he'd
repeated it right. Now it can.

Both are free: no API call, no new content to write.

## Decisions

| Question | Decision |
|---|---|
| Chunk material | The existing `PHRASES` table — already written, already conversational |
| Chunk grading | **Whole-phrase, never per word.** Grading a chunk word-by-word defeats the point |
| Shadow material | Bank items he has **already seen** — prosody practice on known content, not new material |
| Shadow without a Hebrew voice | Not offered at all — there'd be nothing to shadow |
| Session shape | Four presets on the start screen; the choice is remembered |
| Cut from this phase | Tap-to-construct, speed round — see Out of scope |

## 1. Chunk cards — "Say the phrase"

A new kind, `chunk`, prompting with the English and expecting the whole Hebrew phrase spoken as one
unit.

**Graded as a single unit, deliberately.** Every other multi-word card breaks into per-word chips,
and this one must not: the claim being trained is that *ma nishma* is one retrievable item, not two
words assembled under time pressure. Chips would train exactly the habit chunking is meant to
replace. `learnTokens` already returns `null` for a card with no bank `item`, so chunk cards fall
into the existing whole-card grading path for free.

**Scheduled like any other item**, with the phrase's Hebrew string as its SRS key. That key isn't in
the library, so the existing `if (!lib[k]) return` guard in both grading paths would silently drop
every chunk grade — the schedule would look like it was working while recording nothing. Grading
therefore takes an explicit "these keys are gradable even though they aren't library words" path
rather than relying on the library check.

**Which phrases:** ones whose words he already has lead, then the rest. All 60 are common spoken
Hebrew, so none are wasted — but a phrase built from words he knows is the one most likely to come
out of his mouth this week.

## 2. Shadow cards — "Say it back"

A new kind, `shadow`. Plays a Hebrew sentence, shows nothing, and asks him to say it straight back.

The difference from **Hear and answer** is the response: that drill asks what it *meant* (answered in
English, comprehension), this one asks him to *reproduce* it (answered in Hebrew, production). Same
audio, opposite skill — which is exactly why both are worth having.

- Drawn only from bank items with `seen > 0`. Shadowing unfamiliar material is a listening test with
  extra steps; the value is in the rhythm of something already understood.
- Requires a Hebrew voice. Without one there is no model to copy, so the drill isn't offered —
  the same rule `listen` already follows.
- Per-word chips on reveal, filled by the mic, as with any sentence card.
- Grades the **production** side, not the receptive one: he is producing Hebrew here.

## 3. Session shape

Four presets, chosen on the start screen and remembered:

| Shape | What it does |
|---|---|
| **Balanced** | All six drills, as today plus the two new ones. The default |
| **Weak first** | Only words with evidence of struggle, plus never-drilled ones |
| **Speaking** | Only drills answered out loud in Hebrew — drops Hear-and-answer |
| **Quick** | Five cards, otherwise balanced |

This is deliberately four presets rather than a settings panel. The failure mode of a configurable
drill app is spending the practice window configuring it.

## 4. Failure modes

| Condition | Behaviour |
|---|---|
| No Hebrew voice | No shadow cards, no listen cards; everything else unchanged |
| No mic / not Chrome | Both new drills still work, self-graded like everything else |
| Library too small for a shape | Falls back to filling from whatever is available rather than a short session |
| A shape yields nothing at all | Says so plainly and offers Balanced, rather than starting an empty session |
| Bank has no seen items | No shadow cards that session; no error |
| `PHRASES` phrase already in the library as a word | Still drilled as a chunk — it's a different retrieval, and its SRS key is the full phrase |

## 5. Testing

1. Chunk cards render with the English prompt, reveal the Hebrew and transliteration, and grade
   whole-card with no chips.
2. A chunk grade is actually written to the SRS under the phrase key — the case the library guard
   would otherwise swallow.
3. Shadow cards appear only when a Hebrew voice exists and only from seen bank items.
4. Shadow cards show no text before the reveal, and per-word chips after it.
5. The mic's suggested whole-card grade is right for a chunk: all words matched → Got it, partial →
   Nearly, none → Missed.
6. Each session shape produces the drills it claims and no others; Quick is 5 cards.
7. The chosen shape survives a reload.
8. A shape with no available material says so instead of starting empty.
9. Regression: all six kinds in one session, stats still accumulate, hint cap and mic still work.

## Out of scope

- **Tap-to-construct** (tap word tiles in order when stuck). Progressive hints already cover being
  stuck, and a recognition-based scaffold sits awkwardly beside a page whose whole premise is recall
- **Speed rounds.** Shadowing already trains automaticity, and against real audio rather than a clock
- Any new AI-generated content — both drills reuse material that already exists
- Editing `PHRASES` itself

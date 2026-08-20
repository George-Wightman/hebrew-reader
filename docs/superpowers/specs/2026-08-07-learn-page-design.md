# The Learn Page — Speaking-First Drilling

**Date:** 2026-08-07
**Status:** Approved, building

## Why

The app currently does two things: it reads grandad's messages *to* George, and it helps him
compose a reply. Both are reactive — they need an incoming message to exist. Neither builds the
thing George actually wants, which is the ability to *produce* Hebrew out loud without a keyboard
in front of him.

The library already knows which words are new, which are starred, and how often they've been seen.
That's most of a spaced-repetition system sitting unused. The Learn page spends it.

**Speaking is the point.** Every drill ends with George's mouth moving. There is no text input
anywhere on the page — not as an oversight, as a rule. The moment you can type an answer you stop
saying it.

## Constraints discovered before designing

Three findings from the machine and the environment shaped every decision below:

1. **No Hebrew voice is installed.** The registry holds only English voices (Hazel, Zira, George,
   Susan) and the default browser is Chrome, which bundles no Hebrew voice. Calling
   `speechSynthesis` today would read Hebrew characters in an English voice — worse than silence.
   Fixable free in Windows Settings, but it is a genuine external dependency and the page must work
   without it.
2. **The microphone is almost certainly unavailable.** The app runs from `file://`, and Chrome
   refuses mic access to `file://` origins. That rules out browser speech recognition *and* voice
   recording. Automatic scoring of what George says is therefore not on the table without giving up
   double-click-to-open, which is not worth it.
3. **AI cost is not the binding constraint.** A single call returns ~15 usable practice items. The
   binding constraint is only reached if content is generated per-card instead of per-batch.

Consequence: the loop is **prompt → speak aloud → reveal and hear → self-grade**. Self-grading is
not a compromise here; with no mic it is the only honest option, and it is how Pimsleur and
Glossika work.

## Decisions

| Question | Decision |
|---|---|
| Grading | George grades himself: Got it / Nearly / Missed |
| Hebrew audio | `speechSynthesis` with an installed `he-IL` voice; transliteration-only fallback |
| Session shape | Fixed set of **15 cards**, progress bar, end screen |
| Drill types | All four: Say the word, Build the sentence, Hear and answer, Reply drill |
| Reply drill | **The finale of every session**, not a random card |
| Content | Library-derived where possible; AI items batched into a reusable bank |
| Scheduling | Leitner-style spaced repetition, new store |
| Pad | **Hidden** on the Learn page |
| Gamification | None. No streaks, no XP, no badges. |

## 1. The card loop

Every card, whatever its type, has the same three beats:

1. **Prompt** — shown, spoken, or both
2. **Produce** — George says the answer out loud. A deliberate pause with nothing to interact with
   but a single "Show me" control
3. **Reveal** — the Hebrew appears *and is spoken automatically*, with transliteration and English
   beneath it, then three grade buttons

Keyboard drives it: **Space** reveals, **1 / 2 / 3** grades, **R** replays the audio. Eyes stay up,
mouth keeps moving, hands stay off the keyboard except for one key per beat.

There is no text input on this page.

## 2. The four drills

| Drill | Prompt | Produces | Reveal | Source |
|---|---|---|---|---|
| **Say the word** | English word | the Hebrew word | Hebrew + transliteration, spoken | Library. No AI |
| **Build the sentence** | English sentence | the full Hebrew sentence | Hebrew + transliteration, spoken | Bank |
| **Hear and answer** | Hebrew spoken, **no text shown** | what it meant, in English | Hebrew text + transliteration + English | Bank |
| **Reply drill** | A grandad-style question, spoken | a full spoken reply | A model reply, plus library words that fit | Bank |

**Hear and answer** deliberately withholds the Hebrew text. It trains listening, which is the half
George struggles with in the real WhatsApp moment — reading Hebrew is not the bottleneck, catching
it in real time is. If no Hebrew voice is available this drill is skipped entirely rather than
silently degraded into a reading exercise, because without audio it is a different drill.

**Reply drill** has no single correct answer, so its reveal is a *model* answer rather than a
correct one, plus a short list of words from George's own library that would fit the question. It
closes every session because it is the thing the whole app exists to make possible.

## 3. Content: the sentence bank

The architectural core. Generated items are stored in `hvr_bank` and **reused permanently**, which
decouples the number of AI calls from the length of a session.

- **Say the word** cards are generated mechanically from `hvr_library`. Free, instant, unlimited.
- **Sentence / listen / reply** cards are drawn from the bank.
- The bank is topped up only when it holds too few *unseen* items covering the session's target
  words. One top-up call requests ~15 items.

Expected cost: **~1 call to start a session, 0 for a repeat session**, with the bank compounding
over time. The remaining budget funds a per-card **"Why?"** button for moments George actually
wants an explanation — one call, on demand, never automatic.

**Items are constrained to words George already has.** The generation prompt passes his library and
instructs the model to build sentences from those words plus basic grammar. A practice sentence
full of unknown vocabulary teaches nothing about production — it becomes a reading comprehension
puzzle. Any genuinely new word the model does reach for is funnelled into **Pending** for approval,
exactly as every other part of the app does.

Bank items record `uses: [wordKeys]` so the scheduler can find items that exercise a given word,
and `seen` so unseen items are preferred.

## 4. Scheduling: what gets drilled

New store `hvr_srs`, one record per library word key:
`{ due: ISO, streak: n, lapses: n, last: ISO }`.

Grade → next interval:

| Grade | Effect |
|---|---|
| **Missed** | Due again today, streak reset, lapse recorded |
| **Nearly** | Due tomorrow, streak unchanged |
| **Got it** | Streak advances through 1, 3, 7, 16, 35 days |

Session queue is built in priority order:

1. Words **overdue** (`due <= today`)
2. Words **never drilled**, newest `added` date first — this is the "strengthen what we just added"
   requirement, and it falls out of the existing library data for free
3. **Starred** words (`hvr_focus`) boosted above plain review
4. Remainder filled with random review words

A word that appears in a sentence card counts as drilled for every word in that item's `uses`
list — sentence practice is worth more than isolated recall, and this stops the app re-drilling a
word in isolation an hour after George used it correctly in a sentence.

## 5. Voice

A thin wrapper over `speechSynthesis`:

- `heVoice()` picks the first voice whose `lang` starts with `he`, cached and refreshed on
  `voiceschanged`.
- `speakHe(text)` speaks through it. **If no Hebrew voice exists it does nothing** — it never falls
  back to an English voice mangling Hebrew characters.
- `hasHeVoice()` gates the audio-dependent parts of the UI.

On entering the Learn page with no Hebrew voice, a dismissible banner gives the exact steps
(Settings → Time & Language → Language & Region → Add a language → Hebrew → tick Speech). The page
remains fully usable on transliteration alone; only **Hear and answer** is withheld.

Voices load asynchronously in Chrome — `getVoices()` returns empty on first call — so detection
must listen for `voiceschanged` rather than reading once at startup.

## 6. Page structure

`VIEWS` gains a third entry, `learn`. The entry gains a `hidePad` flag; `setView` hides the docked
pad when the active view sets it. The pad exists to compose a reply to a real message; on the Learn
page it would steal vertical space from a screen that needs to be large and quiet.

Three states within the view:

- **Start** — what today's session holds ("15 cards · 6 overdue · 4 new"), a Start button, and the
  voice banner if relevant
- **Card** — one large centred card, thin progress bar beneath
- **End** — "14/15 · 5 words strengthened · 3 back tomorrow", with Again and Done

## 7. Failure modes

| Condition | Behaviour |
|---|---|
| No Hebrew voice | Banner with install steps; transliteration only; Hear-and-answer withheld |
| Library under 10 words | Start screen says to read a message first; no empty session |
| No Gemini key | Library-only session (Say the word), stated plainly. Never a hard block |
| Quota exhausted mid-session | Session continues on bank + library items; "Why?" reports the limit |
| Bank empty and offline | Library-only session |
| Bank item references a deleted word | Item is skipped and pruned on load |

## 8. Testing

The preview browser in this environment cannot genuinely reload this file, so init-time behaviour
is verified by invoking the logic directly against staged fixtures rather than reload-and-check.

1. SRS intervals: each grade produces the specified next-due date; Missed resets streak.
2. Queue priority: overdue before new, new ordered newest-first, starred boosted, no duplicates.
3. A sentence card credits every word in `uses`.
4. Bank top-up triggers only below the unseen threshold; items persist across sessions.
5. Generated items containing unknown words route those words to Pending.
6. Voice absent: `speakHe` is silent, banner shows, Hear-and-answer absent from the queue.
7. No key: session builds from library alone and says so.
8. Pad is hidden on Learn and returns intact on the other two tabs.
9. Keyboard: Space reveals, 1/2/3 grade, R replays, and none of it fires while another view is
   active.
10. Regression: translator read, pad resolution, grid geometry, focus marks, drag-recategorise,
    archive drawer, xlsx export.

## Out of scope

- Hands-free walking mode (speak prompt, pause, speak answer, auto-advance)
- Microphone scoring — revisit only if `file://` mic access turns out to be permitted
- Streaks, XP, badges, daily goals
- Conjugation drilling as a distinct type; verb forms arrive through sentences instead

# Learn Page, Phase 2: Speaking, Actually Graded

**Date:** 2026-08-11
**Status:** Approved, building
**Part of:** the four-phase Learn overhaul (scaffolding → **speaking** → tracking → exercises)

## Why

The app exists to make George *speak* Hebrew, and until now it has never once known whether he did.
Every card is self-graded, and the code says why:

> *"Chrome refuses microphone access to file:// origins, so there is no recording or recognition to
> be had without giving up double-click-to-open."*

**That was wrong.** Verified twice: in-page, `file:` is a secure context with `SpeechRecognition` and
`getUserMedia` both present, and a start attempt fails with `not-allowed` (a permission error —
it reached the gate) rather than any origin rejection. Then on George's own machine, real Hebrew
transcribed correctly at **0.914 confidence** with `lang = "he-IL"`.

Crucially this is **Chrome's Web Speech API, not the Gemini API** — no key, no quota, no cost. It
sidesteps the exact constraint that killed neural TTS.

## Decisions

| Question | Decision |
|---|---|
| Which cards get a mic | Production cards only — **word, sentence, reply**. Not listen: that answer is in English |
| What the mic does | **Pre-fills the per-word marks**, then reveals. Never the final word — every mark stays tappable |
| Permission prompts | One `getUserMedia` stream **held open for the whole session**, released at the end |
| Scoring | Sequence alignment on normalised Hebrew, per word: matched / near / missed |
| Said it in English | Detected and named specifically, graded as missed |
| No mic, offline, denied | Silently the app exactly as it is today — the button simply isn't there |

## 1. Permission: hold the stream, don't re-ask

Chrome will not persist a microphone grant for a `file://` origin, so every `recognition.start()`
re-prompts — George hit this immediately: *"every time I pressed the 'use mic' buttom if flagged
asking for permission even if I said use for this site."*

The fix is ours, not Chrome's. `micAcquire()` takes **one** `getUserMedia({audio:true})` stream and
**keeps it alive**; while a page holds a live audio track the permission is actively granted, so
subsequent recognition starts have nothing to ask about. `micRelease()` stops the tracks when the
session ends, so the recording indicator never outlives the practice.

**Correction, 2026-08-11 (real use):** the claim above is wrong. George confirmed on his own machine
that the prompt reappeared on every card even after choosing "Allow while visiting the site" —
holding a `getUserMedia` stream does not, in practice, keep `SpeechRecognition` from re-prompting.
The two APIs evidently don't share a permission grant. Fixed the one addressable cause (a fresh
`SpeechRecognition` object per card) by reusing a single instance for the session — see
`micRecGet()`/`micRecTeardown()` in the file and the "Thirty-eighth pass" entry in project memory.
**Unconfirmed** whether that resolves it; if not, the remaining cause is a `file://`-specific Chrome
policy with no JS-side fix, and the real remedy would be serving over `http://localhost` instead of
opening the file directly — a decision for George, not something to change unilaterally.

**Acquired on the first press, not at session start** (changed during implementation). Taking the
stream up front would prompt every session even when he never touches the mic — a session run
entirely by hand should never ask for a microphone. Lazy acquisition costs one prompt at the moment
he first chooses to speak, and none after it.

This needs George to confirm on his own machine — the sandbox blocks capture entirely, so the
prompt behaviour is the one thing here that can't be tested from this side. If Chrome still prompts,
everything still works; it's just noisier.

## 2. Normalising Hebrew before comparing

Comparing raw strings would fail constantly for reasons that have nothing to do with pronunciation.
`normHe()` strips, in order:

- **Nikud and cantillation** (`֑–ׇ`) — the recogniser returns none, the bank has none, but
  imported text can
- **Punctuation, maqaf and geresh** — `שלום!` and `שלום` are the same word said aloud
- **Final letter forms** — `ך ם ן ף ץ` → `כ מ נ פ צ`. A recogniser writing a word mid-phrase where
  the bank has it phrase-final is a spelling difference, not a speaking mistake

Everything else is left alone. Deliberately **not** stripping the `ובהלמשכ` prefixes: "I said the
word without its preposition" is a real error worth catching, and collapsing it would hide it.

## 3. Scoring: alignment, not set membership

Per-word status comes from a Levenshtein alignment of the **word sequence** he said against the word
sequence expected — not "does each expected word appear somewhere", which would score a sentence
said backwards as perfect. On "Build the sentence" word order is part of the answer.

Each expected word lands in one of:

| Status | Rule | Becomes |
|---|---|---|
| **matched** | normalised strings identical | Got it |
| **near** | edit distance ≤ 1 for short words, ≤ 20% of length for longer | Nearly |
| **missed** | no alignment partner, or beyond the near threshold | Missed |

Anything he said that has no expected partner is reported as an extra, not silently dropped — saying
three words that aren't in the sentence is information.

**Character-level distance is the right tool and word-level identity is not**, because the
recogniser's errors are overwhelmingly one letter off (a vowel it heard slightly differently),
which is exactly the case that should read as "nearly" rather than "wrong".

## 4. Saying it in English

The `he-IL` recogniser transcribes English perfectly well — the finding that made this worth
building. So when an expected word is missed, its English meaning is checked against the leftover
transcript, and if it's there the feedback is specific: *"you said 'film' — the Hebrew is סרט."*

Still graded **missed**, because it is: the point of the exercise is producing the Hebrew. But
"you reached for the English" and "you said nothing" are different failures and shouldn't look
identical.

## 5. The flow

A **🎤 Say it** button sits next to Show me on production cards. Pressing it:

1. Shows a listening state
2. Transcribes, then **reveals the card automatically** — the reveal is earned by speaking, which is
   the whole point
3. Fills `learnMarks` from the alignment, and shows what it heard above the chips
4. Leaves every mark tappable, so a recogniser mistake costs one tap to fix

**The mic never has the last word.** It's faster and more honest than self-grading, not infallible,
and the existing per-word panel is already the correction mechanism.

Marks set by the mic and marks set by hand are indistinguishable at commit time, so the SRS,
struggle tracking and hint cap all work unchanged. A hint still caps a spoken answer at "Nearly" —
help taken is help taken, however the answer was eventually produced.

## 6. Failure modes

| Condition | Behaviour |
|---|---|
| No `SpeechRecognition` (not Chrome) | No mic button; page identical to today |
| Permission denied | Button re-enables with "Microphone blocked — grading by hand"; card still works |
| Offline | Recognition errors `network`; same fallback, message names the connection |
| Heard nothing (`no-speech`) | Says so, does **not** reveal or grade — a silent card is not a wrong answer |
| Recogniser returns junk | It's still just marks he can tap to fix; nothing is committed until Continue |
| Card has no word chips (`learnTokens` null) | Mic still transcribes and reveals, but grading stays whole-card |
| Session abandoned mid-way | `micRelease()` on finish, on leaving the view, and on page hide |

## 7. Testing

1. `normHe` strips nikud, punctuation and final forms, and leaves prefixes alone.
2. Levenshtein and the word-sequence alignment return the right per-word statuses, including
   insertions, deletions, and a sentence said in the wrong order.
3. The near threshold catches one-letter errors on short and long words, and rejects genuine misses.
4. English detection fires only when the expected word was missed **and** its English is present.
5. A stubbed recognition result fills `learnMarks` correctly and reveals the card.
6. Marks set by the mic are overridable by tapping, and commit identically to hand-set marks.
7. The hint cap still applies to a spoken answer.
8. `no-speech` does not reveal or grade.
9. No `SpeechRecognition` present → no button, no errors anywhere.
10. `micRelease` is called on finish, on view change and on page hide.
11. Regression: a full session of all four kinds, translator, library, pad, archive.

## Out of scope

- Any judgement of *accent or prosody* — the recogniser reports words, not how they sounded, and
  pretending otherwise would be inventing feedback
- Recording and storing audio of George speaking
- Shadowing as its own drill — Phase 4, once the scoring here is proven
- Using the mic anywhere outside the Learn page

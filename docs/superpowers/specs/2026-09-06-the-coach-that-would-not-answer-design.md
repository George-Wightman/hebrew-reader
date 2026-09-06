# The coach that would not answer

## Where this came from

Flag `1788727927745-r7iw7`, raised mid-session on a compose card in *Your day · Getting by*,
2026-09-06:

> So I e just asked the coach a question and it basically told me to do one. Look
>
> card 1
> How do I say office
> What you are looking at right now does not have that word, and the code you shared does
> not contain it either. To answer how to say "office," I would need the vocabulary
> database or a dictionary file that is not in this fragment.
>
> card 1
> Iv been asked where I go to work, I want to know how to say the office
> What you are looking at right now does not have that word, and the code you shared does
> not contain it either. To answer how to say "the office," I would need the vocabulary
> database or a dictionary file that is not in this fragment.
>
> That's not a useful response, it should answer me like the coach not a robot looking for
> a file. I also don't need all the extra clutter for chatting with the coach, just. A
> clear chat box pop up from the bottom similar style to the sentence pad on the words
> section of the app. With mayen and additional toggle for the other info, but I found that
> original feature of seeing the pages code kinda useless and not useful for me the coach
> is more important and should be more useful/ interactive

And, asked to confirm the shape:

> These ideas are exactly what I am talking about, hte chat feature should be for a talk
> with a responsive coach not a diagnostic agent.

## What actually happened

Nothing failed. The flag's own `ctx.ai` records both calls as `ok: true`,
`gemini-flash-lite-latest`, 684ms and 900ms. The model did exactly what it was told.

`coachPrompt` is not a Hebrew coach prompt. It is a diagnostic-panel explainer, and every
line of it points the same way:

- "He is using an app you built with him and **is asking you about what it is doing**."
- "What follows is a **fragment** of a much larger single-file Hebrew learning app."
- "Answer from the panel and code below and **NOTHING else**. If what is shown cannot
  answer him, **say so plainly and say what you would need**."
- "**Do not suggest edits to the app.** Explain what it is doing and why."

"How do I say office" arrives at a prompt whose only sanctioned knowledge source is a
diagnostic report and a slice of source code. The refusal is the prompt's own instruction,
carried out faithfully. It even reached for the file it had been taught to want.

Two details from the capture that shape the fix:

- **The payload was nearly empty anyway.** He was on a `compose` card, so the report read
  `Hebrew: —`, `English: —`, `No gradable words on this card`. `uhRulesOn` found no `why`
  rows, so the attached source code was the empty string. The model had a blank panel *and*
  a rule saying answer only from the panel. So this is a prompt-framing bug end to end —
  there is no payload change that would have rescued it.
- **A test does pin the framing sentence, and it is right to.** `T("uhAskParts: sends the
  panel, the real code, and says it is a fragment")` asserts `/fragment of a much larger/`
  — it lives on `uhAskParts`, not `coachPrompt`, which is why a search of the coach tests
  misses it. It caught the first cut of this change, which deleted the sentence outright.

  It protects something real and separate from the bug: a model asked an app question
  without it describes the app it imagines rather than the one he is holding. So the
  sentence survives, **scoped to the app branch** instead of framing the whole prompt.
  That is the actual distinction this change turns on — "this slice of code is partial" is
  true and useful; "you know nothing but this slice" is what refused to say *office*.

## What is not wrong

The honesty guarantee underneath the framing is worth keeping, and it is a different thing
from the framing. The reason the original prompt was hard-scoped is that a model asked
about *his* numbers will invent a plausible stability or threshold, and he has no way to
tell. `coachUncited` exists for exactly that and works.

So the rule to keep is **"never invent a figure about his state."** The rule to delete is
**"you know nothing except this panel."** The current prompt conflates them, and that
conflation is the whole bug.

---

## Phase 1 — one coach, two kinds of question

`coachPrompt` is rewritten so the panel becomes *context about him*, not the sole source of
truth. One prompt, no routing call: a model asked a Hebrew question answers from Hebrew
knowledge, and a model asked an app question answers from the panel, provided both are
permitted. Splitting the honesty rule is what makes that safe:

- **Hebrew, grammar, how to say something, why a form is what it is** — answer fully from
  your own knowledge, like a coach. Never refuse for want of a file.
- **Anything about HIS state** — his numbers, his schedule, what the app decided and why —
  comes only from the material below, and if it is not there, say so.

Three things go in that the old prompt had no reason to carry, because it was never
expected to produce Hebrew:

- **The transliteration scheme, stated explicitly.** `CLAUDE.md` is unambiguous that the
  app has one scheme and that anything written for him follows it — `kh` never `ch`, the
  article and single-letter prepositions joined, an apostrophe before a vowel, `ve-` for ו.
  He reads the transliteration; it is the line he actually produces from. The existing
  writer prompt says only "plain English letters the way he would type them", which is how
  `nodes.json` ended up with two schemes split at a batch boundary. The coach hands him
  transliteration directly in chat, so it gets the scheme in full.
- **His speaker gender** (`speakerGet()`). "I want" is *ani rotze* from a man and *ani
  rotza* from a woman. A coach handing him a line to say that does not agree with him is
  wrong in a way he cannot see.
- **His level** (`levelAll().at`, with `LEVEL_RUBRIC`) — so the answer is pitched where his
  sentences are graded, and the same rubric the rest of the app runs on.

**Answer shape for "how do I say X":** the Hebrew, the transliteration, and what it
literally says — then stop. Two or three sentences; he is on a phone.

### `coachUncited` narrows to figures that look like metrics

The check currently flags any number in the answer that is not a substring of the payload.
That was right when every answer was about app state. It is wrong now: on a compose card
the payload is nearly empty, so an ordinary Hebrew answer mentioning "2 ways to say it"
would trigger a second API call and then a caveat telling him to check "2" against a report
that does not mention it.

Narrowed to **a decimal, or an integer of two or more digits** — the shape an invented app
metric actually takes (a stability of 8.3, a threshold of 21 days, a difficulty of 6.5).
Bare single digits pass.

**The trade, stated plainly:** an invented single-digit metric ("your stability is 4 days")
would now pass unflagged. That is a real if narrow loss. It buys the guard not firing on
ordinary prose, which is now most of what the coach says, and the existing test's
assertions — `8.3` caught, `9.9` caught, `6.5` and `2` and `6` clean — all still hold.

### The permanent caveat goes

`uhThreadBlock` appends, after every live turn: *"Answered from this panel and the rules
named on it — not the whole app. Check it against the numbers below."*

It is now false — the coach is answering from Hebrew knowledge — and it was already what
the style guide §4 calls wallpaper: a line rendered after every answer forever. The precise
signal replaces it: `coachUncited`'s caveat, which is rare and names the actual figure.

---

## Phase 2 — the coach comes out of the panel

Today the only way to reach the coach is to open the inspector and scroll: the nav
magnifier opens `uhModal`, and the ask box lives in its footer under a breadcrumb trail, a
report, a search box and collapsible sections. He asked for the opposite — the coach first,
the report behind a toggle.

**A bottom sheet, reusing the pattern the app already has.** `.pathsheet` +
`.sheetbackdrop` is the established "raised from the bottom exactly like the sentence pad"
treatment, tap-outside-to-close, with a grip. `.coachsheet` is styled on it rather than
being a third sheet invented from scratch.

- **The nav magnifier opens the coach sheet.** That is the inversion; it is one line.
- **The transcript is the content.** `uhThreadBlock` is reused as-is — same store, same
  sittings, same fading of earlier ones.
- **The input is docked at the bottom of the sheet**, where the sentence pad's is.
- **One toggle, at the top: "What the app is doing ›"**, which opens the full `uhModal`
  panel. That is the demotion he asked for.
- **The coach's voice keeps its serif.** `.uh-ansa` already uses `var(--display)` for the
  reason the style guide gives at `.lcoach` — this is a person talking, not the app
  reporting. The sheet inherits that; it is the one mark that says the coach is the same
  coach here as on the end screen.

Questions asked from the sheet carry the current subject's report, via
`uhReportFor(uhHere())` — the same call `flagContext` already makes. So the context does
not depend on the panel being open, and "why did I get that card" is still answerable from
the sheet.

### The panel keeps its ask box

Deleting it would mean that asking *about* the report requires leaving the report. The
evidence-on-the-same-screen argument that put the box there still holds for app questions;
what changed is that app questions are no longer the main event. Both boxes drive one
thread and one store, so there is no second conversation to keep in step.

---

## Deferred, with reasons

- **Deleting the under-the-hood panel.** He said the code view is "kinda useless" *to him*,
  which is a case for demoting it, not for removing it. It is also load-bearing elsewhere:
  every flag carries `ctx.report` from `uhReportFor`, and reading those reports is how a
  flag gets diagnosed at all — this one included. Demoted, kept.
- **Giving the coach his library.** It would let it say "you already have this word". His
  library is 300+ entries and would ride on every question, and it would not have helped
  here: *office* is not in it. Worth revisiting if he starts asking "do I know a word
  for X".
- **Routing the question through a classifier call.** One prompt that permits both kinds of
  answer costs nothing and has a soft failure mode. A router costs a call on the
  5-requests-per-minute limit `CLAUDE.md` warns is the one that actually bites, and fails
  hard when it misroutes.
- **Skipping the source fetch for Hebrew questions.** `uhSourceText` is cached per session
  and `force-cache`, and `uhRulesOn` already returns nothing on the cards he asks from, so
  there is no measurable cost to remove.
- **Voice input to the coach.** He said "more interactive"; that could mean speaking to it.
  It is a feature, not this fix, and he has not asked for it.

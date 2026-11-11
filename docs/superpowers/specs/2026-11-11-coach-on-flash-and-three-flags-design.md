# The coach goes back on Flash, and two smaller flags

## Where this came from

Three flags, 9–10 November 2026. The first, on *amarti lo she'ani ayef*:

> The coach is actually useless. … it's actually crap at the minute I'll be honest it's
> just actually unusable and useless. You didn't always be like this though

And in chat on 11 November:

> when I would speak to it and I would mix in the Hebrew, it just didn't pick up anything
> when I submitted the mic … So it just meant that it was like not getting my question.
> And then when I asked it and then in English afterwards, it like just translated it to
> something absolutely garbled and it had no interpretation.

> the continue is on the left, whereas usually the continue has always been on the right
> or like in the center. So it's like, oh, I almost by default go [Didn't catch it]

> I wouldn't really call [חדשה] fresh … Sunday a new start, yeah, not fresh start.

## What the evidence says

The flag's `ctx.ai` shows all three of the coach's calls on `gemini-flash-lite-latest`.
"Hearing you" returned `אמרתי הוא אני עייף`, which is almost the card's own sentence. The
hearing prompt hands the model the screen "only to help you spell", and Lite used it as
the answer. The coach then answered a question about הוא that he may not have asked, and
took 18.7s to do it. That day's quota was strong 0 of 20, fast 29 of 500, so the strong
model sat unused.

Both calls are pinned to `GEMINI_MODELS_FAST` in code (`coachHear`, `uhAsk`). The comment
in `uhAsk` records that this was a deliberate budget call. That reasoning assumed the coach
would be asked "all day". The weekly report shows about one coach question per week.

## Phase 1: the coach

- `coachHear` and `uhAsk` use `aiModelsFor("coach")`. That is Flash while the strong pool
  is above `AI_STRONG_RESERVE`, then Lite, with a `pool-downgrade` health note. The
  fallback already exists, so a heavy day degrades instead of failing.
- A spoken question costs two strong calls, so 14 usable calls cover seven spoken questions
  a day per key before Lite takes over. Against one question a week, that is not a
  constraint.
- `coachHearPrompt` says outright that English speech is written in English, never
  rendered in Hebrew script, and that the screen text is never a substitute for what he
  said.
- Flag context keeps the head **and the tail** of each AI request. The tail is where his
  question sits, and today's 400-character head cut it off, so this flag could not show
  what he asked.

## Phase 2: Continue on the right

On a hearing card, "Didn't catch it" comes first and "Continue" second, so Continue sits
where his thumb expects the forward action.

## Phase 3: content

`Sunday, a fresh start.` becomes `Sunday, a new start.` in `content/nodes.json`.
`contentRefresh` brings banked `src:"claude"` items into line on the next check, so no
version bump is needed.

## Deferred, with reasons

- **Moving every other Lite caller to Flash.** Grading and meaning checks run dozens of
  times a session, and 20 a day does not cover them. Only the coach was reported as
  useless, and only the coach is rare.
- **A wider sweep of translations that are "right but not literal".** That one flag is
  one sentence. A sweep belongs with a content pass, not here.

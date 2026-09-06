# The coach stops guessing

## Where this came from

Flag `1788733036988-099h2` carried two things. The long-press half is already fixed and
deleted (`0483c6c`). This is the other half, plus what came out of brainstorming it.

> Secondly the coach just bugged, it's not the end of the world but it read out like the
> full thing not like it usually does

And, on the conversation itself:

> I find in practice that its always just it going "amazing, ..." or "excelent,..." then
> asking a kind of strange follow up. I also noticed that it fills in wehn I make a mistake
> instead of the coach going, "did you mean to ask for..." like htis is a conversation with
> the coach, not a real person, the lesson learning and the scafholding are coming from hte
> same place, they shouldnt jsut assume (like in a recent example) that I was asking for a
> few cooking, when what I mean to be asking was for a few sugars, but I didnt know how to
> say that (I appreciate thats harder to detect but assuming isnt helpful and steers the
> conversation away from hte direction I was lerning).

And on latency:

> Im also noticing htat htere is a decent bit of latency with the coach, especially on the
> first messsage.

## What the flag's own capture shows

The read-out was not a TTS fault. `composePrompt` returned:

```json
"say": {
  "he": "מעולה! ואיפה אתה שותה קפה עכשיו? (meula! ve'eifo ata shote kafe achshav? - Excellent! And where are you drinking coffee now?)",
  "tr": "meula! ve'eifo ata shote kafe achshav?",
  "en": "Excellent! And where are you drinking coffee now?"
}
```

It filled `tr` and `en` correctly **and** duplicated both inside `he`. `speakHe` then reads
the lot. The cause is one ambiguous line, from `a1c5d81` on 2026-08-30:

> say — your reply, in Hebrew he can follow at his level, WITH translit and English.

Meant as "fill in the `tr` and `en` fields". Readable as "put them in the string".
`composeTidy` only trims the value, so nothing catches it on the way to `playHe` and
`convoBubble`.

---

## Phase 1 — `say.he` is Hebrew and nothing else

Two halves. A prompt alone will not hold on flash-lite, which is the same argument
`composeCredit` makes: the app derives, the model only points.

- **The prompt** states the split so it cannot be read the other way: `he` is Hebrew
  letters only, `tr` and `en` are separate fields, and they already render underneath.
- **A guard in `composeTidy`** cuts `he` at the first Latin letter and trims what is left.
  Applied to `say.he`, `best.he` and `newWords[].he` — identical exposure, and `best.he`
  is what gets banked for later practice, so a polluted one outlives the turn.

If a cut leaves nothing, the turn fails through the path that already exists:
`composeAdvance` sees no `say.he`, stages `failed`, and his transcript is still his to
send again. Nothing is credited twice.

## Phase 2 — the coach pauses instead of guessing

The prompt currently says:

> And if the transcript reads as nonsense, that is the recogniser — work out the sensible
> sentence he was most likely saying and answer THAT.

That was written for homophone mishearings (אטי / איתי) and for those it is right. It
collapses two situations that need opposite handling. The test that separates them, and it
is the same test the existing homophone rule already uses:

**Could a person who HEARD him say it have produced this transcript from the sentence you
are imagining?**

- **Yes** — the machine misheard. Work out the real sentence and answer it. Unchanged.
- **No** — the only way to make it make sense is to swap in a word that sounds nothing
  like what he said. He was reaching for something he does not have. **Do not substitute.
  Stop and say so.**

*bishul* and *sukar* sound nothing alike, so the sugars case lands on the second branch.
אטי and איתי land on the first.

**It only has to notice.** George: *"the coach in the conversation only has to pause and
flag the problem it doing have to help me all the way to figuring it out."* So the flag is
short and in Hebrew — `?סוכר`, or plainly that it did not follow — with transliteration and
English underneath as they already render.

One new field, `unsure`: a short line of English naming the doubt, empty when there is
none. It carries both the signal and the content, which is what the handoff needs.

## Phase 3 — the handoff

The reason the dock could not help here: on a compose card `UH.card` reports

```
Kind: compose — The coach
Hebrew: —
English: —
## Its words
## What answering it will do
No gradable words on this card.
```

The dock feeds that report to the coach as "what is on his screen", so mid-conversation it
can see that a conversation exists and nothing about it. "I was trying to say a few sugars"
is unanswerable from that.

`UH.card` gains a **conversation** section for compose cards, built from the card itself
(`turns`, `objectives`, `landed`, `item`, `unsure` — all already on it): the recent
exchanges, the words on the table, which have landed and which are outstanding, and the
flagged doubt if there is one. No new plumbing — `coachPrompt` already carries the report,
and the coach can already answer Hebrew freely since `477723c`.

That is the signpost. George: *"sort of like a 'start a side chat' feature ... I could be
ask a Q without it seriously impacting hte flow of hte conversation."*

Plus **"Ask the coach"** on the flagged line, opening the dock in one tap, so the side chat
starts where the doubt is rather than from the nav bar.

## Phase 4 — the turn picks its move

The `say` instruction ends with *"Ask him one thing about what he just said."* Every turn,
the same shape: react, then ask. A coach required to react before asking opens with praise
because praise is the cheapest reaction available, and that is the whole of "amazing, ...
then a strange follow up".

- **Empty praise is banned by name.** No reflex opener.
- **The move is its own choice**: answer what he said, add something of its own, react, or
  ask — whichever a person would do. Ask when it actually wants to know, or when `pointed`
  says make room for an outstanding word.

**The guard, which this needs or it reintroduces an old bug.** `composeEnds` returns true —
ending the conversation — when the coach did not ask and `composeOutstanding` is empty. A
coach freely choosing not to ask on the turn the list happens to complete would end the
session abruptly, which is exactly the *"conversation abruptly ended when I went to press
reply"* that the `ask` field was added to fix.

So the freedom is scoped to turns where work is still outstanding. When the list is done,
the prompt tells it to either ask or sign off, and `composeEnds` keeps its current
meaning. No change to that function.

## Phase 5 — latency, the certain part only

- **`<link rel="preconnect">` to `generativelanguage.googleapis.com`** in the head. There
  is none today, so the first Gemini call of a session pays DNS, TCP and TLS to a host the
  page has never touched — commonly 300–900ms on mobile, which is exactly "especially on
  the first message". A hint, not a resource, so `sw.js`'s shell list is untouched.
- **The waiting bubble animates.** It is a static `…` today, so a two-second wait reads as
  frozen rather than as thinking.

## Deferred, with reasons

- **Trimming the compose prompt.** Offered and pulled back deliberately. Phases 2 and 4
  rewrite that same prompt for behaviour; trimming it in the same pass would make a drop
  in reply quality impossible to attribute. Worth its own pass once the new coach has been
  heard.
- **Streaming the reply.** The biggest felt improvement — reading starts at ~0.5s instead
  of ~2s — but the reply is JSON that `extractJSON` parses strictly, and grading and word
  credit hang off that contract. Not worth risking for latency that preconnect already
  takes the worst of.
- **Splitting reply from grading into two calls.** Doubles requests against the
  5-per-minute limit `CLAUDE.md` names as the one that actually bites, and the reply would
  no longer know whether he had made a mistake.
- **An `unsure` turn not counting against `COMPOSE_TURN_CAP`.** Being confused arguably
  should not burn a turn, but exempting it invites a loop, and the cap is 8. Leave it until
  there is evidence it bites.
- **Withholding credit on an `unsure` turn.** He did produce the word the app detected, and
  `composeCredit` only ever credits words derived by `bankUses`. Docking him for being
  misunderstood would be a new unfairness to fix a hypothetical one.

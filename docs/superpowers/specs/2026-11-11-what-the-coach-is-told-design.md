# What the coach is told

## Where this came from

After the coach moved back to Flash (`2026-11-11-coach-on-flash-and-three-flags-design.md`),
George asked for a deeper look:

> Is there anything in how the coach is handled, the information it's given, what it
> understands, the algorithm that we kind of feed the information through before we then
> give it to the model that could be improved? … the information that we give is, first
> of all, concise, because these models get tripped up over different things pushing them
> in different directions, but also very informative … highlighting where I went wrong in
> the sentence is the primary thing, not just the whole sentence.

And on the review's proposals:

> I don't necessarily want to have like a million different ways that I can interact with
> the coach. … if I tap on a word, sometimes it says not in your library … we should ping
> a call to the weaker model just to be like, okay, here's the sentence. What does this
> word mean? It's usually when it's got a prefix or a suffix … if we could have that for
> like, every word … in the grand scheme of 500 calls a day, it's not the end of the world.

> I don't necessarily want to be writing something down and speaking to it. Currently,
> how it worked is I speak into it and it doesn't write it down instantly. We like ping the
> audio recording to one of the models, which then writes it down.

## What the review found

I rebuilt the exact prompt for his 10 Nov question (`amarti lo she'ani ayef`). It runs to
~4,070 characters and ~790 words.

1. **The hearing step copied its own context.** `coachHearContext` hands the transcriber
   the card plus `coachAttemptText`, which includes "The mic heard him say: אמרתי הוא אני
   עייף". The transcriber returned exactly that string as his question.
2. **The slip is flattened.** `alignSpoken` already records, per word, what he said in its
   place (`heard[i]`) and whether it was near or missed. The coach receives only "Marked as
   not said: לו שאני". It is never told that הוא sat where לו belonged, or that שאני was a
   near miss.
3. **No transliteration of the card.** The coach works it out for itself and can
   contradict the line he reads from.
4. **Inspector noise.** Position, Grades, From the bank, Level/difficulty and "Carrying …
   handed to you deliberately". The Hebrew sentence appears three times.
5. **Instructions that pull apart.** "Answer the likeliest reading" against "do not guess:
   ask". "The mic can mishear him too" invites the "the mic just misheard you" answer he got.
6. **A five-line rubric** to say "pitch at level 2".
7. **Listen cards send nothing about his answer.** His English answer (`learnNote`) and the
   meaning check's note (`learnMeaningNote`) never reach the coach.
8. **Earlier turns are labelled "card 24"**, which the model cannot use.

## Phase 1: what the coach is sent

- `coachScreenText` keeps only the card's kind, Hebrew, transliteration and English (plus
  a compose card's conversation). `UH.card` gains a Transliteration row, which the
  inspector benefits from too.
- `coachAttemptText` becomes word by word: each word of the card, with what the mic heard
  in its slot and whether that was said, nearly said, or not said. It also states the mic's
  confidence. On a hearing card it gives his English answer and the meaning check's note.
- The prompt keeps one level line, not the rubric. It has one rule for unclear questions:
  anchor on the tapped word or the marked slip, otherwise ask. It blames the mic only when
  the confidence says low.
- Earlier turns are labelled with the card's Hebrew, and a turn about a different card says
  so.

## Phase 2: words, and where the coach points

- **Every tapped word gets its meaning in this sentence.** When the panel has no in-sentence
  explanation saved for the word, it asks Flash-Lite straight away instead of offering a
  button: the word's meaning here, what a prefix or suffix adds, and its base form. The
  answer is saved on the item, as the old button's was, so it is asked once. This is a word
  feature, not a coach feature: no new way into the coach.
- **The coach knows the last word he tapped** on the card on screen, and what the panel
  told him. There is no chip and no UI; it is context.
- **The coach points at the word.** It answers as JSON `{answer, word}`. The app highlights
  that word in the answer, and on the card's chip when the chips are showing. If the JSON
  fails to parse, the raw text is the answer.

## Phase 3: voice goes straight to the coach

The recording goes to the coach in the same call that answers it. The prompt asks for
`{heard, answer, word}`: first what he said, in both languages and never copied from the
screen, then the answer. `heard` becomes the question in the thread. There is no
transcript-in-the-box step and no send press. Stopping the recording sends it. That is one
call instead of two, nothing lost between them, and the coach can now hear his
pronunciation. Typed questions are unchanged. The live-mic fallback (no `MediaRecorder`) is
unchanged.

This reverses the send stage from 2026-09-22 for voice. He asked for the reverse on
2026-11-11.

`coachHear` and `coachHearPrompt` go, since nothing calls them.

## Deferred, with reasons

- **A live test bench against Lite and Flash.** It needs a Gemini key, and this machine
  has none (`geminiKeys()` is empty, and keys are never synced). Fixture tests pin what the
  prompt contains instead. The bench is worth building the day a key is available here.
- **His known words in the prompt**, so examples are built from words he has. It is real
  value, but it is the biggest token cost on the list. Do it after Phase 1 shows how far
  "concise" got.
- **Structured answers beyond `word`** (verdict, correction, example fields). One field is
  enough to highlight. More structure is more to go wrong on the weak model.

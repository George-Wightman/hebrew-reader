# The coach hears both languages

## Where this came from

His flags of 27 Sep, on a word card for להיות where the mic had heard לשתות:

> The coach is being actively retarded like look at the thing that I was saying here. It's
> just been actually stupid that obviously that's not what I meant. It can't interpret any
> Nuance in what I'm saying into the voice chat so it's just being actually useless

And on 1 Oct, asked what he wanted:

> the switching between the Hebrew and the English is really not intuitive. And I asked the
> question and it just answered something completely different. Like, it's really not very
> good at when I say, oh, why is it using this word? And then I say the word in Hebrew, but
> it just doesn't [...] it either needs a way for it to pick up the transliteration I'm
> trying to speak Hebrew [...] or it needs some way of switching between both languages
> fluidly

> I'd rather be able to just speak in English and in Hebrew and actually pick it up.

The only answer from that exchange that survives (the question itself is past the 400
characters the AI log keeps) began: *"Ah, you mean the **B** in **lehiyot**?"*

## What is actually wrong — three failures, stacked

**1. It mishears him before the coach is involved.** The dock's mic is Web Speech, which
takes one language per session. Under en-GB a Hebrew word is printed as the nearest English
sounds — adom became "Adam", and on 27 Sep something became "the B". Under he-IL his English
falls apart (tried and reverted 2026-09-08). The en/he switch was the honest answer to that,
and it is the thing he calls unintuitive: it asks him to know, word by word, which recogniser
he is about to need.

**2. The coach guesses instead of checking.** `coachPrompt` already carries a paragraph for
an English-recogniser question ("say which Hebrew word you took it to be"). Flash-lite ignored
it and answered a question about a letter B with confidence.

**3. It cannot see what just happened.** The card report gives it the card's Hebrew and
English. It does not give it what he just said or what was marked missing — and "why is it
this word?" is nearly always about the attempt he has just made.

## What makes a real fix possible

The app already sends audio to Gemini: grandad's voice notes are transcribed that way
(verified on a real Ogg Opus note, 2026-08). A Gemini model listening to the recording is not
bound to one language, so English and Hebrew in one breath can come back as English words in
English and Hebrew words in Hebrew script.

**The constraint that shapes it:** on Android, Web Speech and a `getUserMedia` capture cannot
run together — with a capture open the recogniser is handed silence (see
`micNeedsStreamHold`). So it is a live transcript in one language *or* a recording Gemini
hears in both. He chose the recording: "I'd rather be able to just speak in English and in
Hebrew and actually pick it up."

**Not verified before building:** mixed English/Hebrew in a single clip. The key lives only on
his phone and deliberately never syncs, and a synthetic voice would be weak evidence. His own
voice is the first test; the live English mic stays as the fallback.

## Phase 1 — the coach knows what just happened, and says what it took

- `coachPrompt` takes the card's last attempt when the question is asked on a card that has
  one (`learnSpoken`): what the mic heard, and which of the expected words were not matched,
  with final letters restored (`heShownAll`). Labelled as his last try at this card, so a
  question with no Hebrew in it at all ("why was that wrong?") has something to be about.
- A new rule in the prompt, for every question rather than only dictated ones: when the
  question turns on a particular Hebrew word or phrase, open with one short line naming it
  in Hebrew and transliteration ("You're asking about להיות (lihyot) —"), then answer. When it
  cannot tell which word he means, it asks him — one short question — instead of guessing.

## Phase 2 — one mic, both languages

**Two steps, his choice.** Tap, speak in any mix, tap stop. A few seconds later the words land
in the box — English in English, Hebrew in Hebrew script — where he can read them, type into
them, or speak more onto the end, and the arrow sends. The send stage he asked for on
2026-09-22 stays.

- **Recording.** `getUserMedia` + `MediaRecorder` in whatever container the browser offers.
  Stopped by his tap, or at 60 seconds. The stream's tracks are stopped the moment recording
  ends, so nothing holds the microphone afterwards; and the drill keeps its stronger claim —
  the dock will not start recording while a card is listening (`micRecBusy`), and a card that
  starts listening stops a recording first.
- **Format.** The clip is decoded in the browser (`decodeAudioData`) and re-encoded as 16 kHz
  mono 16-bit WAV — a format on Gemini's documented list — rather than trusting that it
  accepts the phone's WebM. About 32 KB a second; a minute is under 2 MB, inside the inline
  limit. The encoder is a pure function and is tested.
- **Transcription.** One call on the fast pool, label "The coach — hearing you". The prompt:
  transcribe exactly what he said; he mixes English and Hebrew; English words in English,
  Hebrew words in Hebrew script without nikud; write the word he actually said, even if it is
  the wrong one — never the one he should have said; do not translate, do not answer. It is
  given the card's Hebrew and English and the last couple of coach turns *as spelling help
  only*, so להיות comes back spelled right, with an explicit warning not to put the card's word
  in his mouth. Returns `{"text": ""}`; empty means nothing intelligible.
- **The en/he switch goes**, with `coachLang*`, `COACH_LANG_KEY` and the relisten-on-switch
  machinery. The "say more" button records again and appends.
- **Consent, once.** This sends a recording of his voice to Gemini. Asked the first time, in
  its own words (it is his voice, not someone else's), remembered; declining falls back.
- **Fallback.** No key, no `MediaRecorder`, consent declined: the dock uses the live mic as
  before, fixed to English, and the prompt keeps its existing note about English-recogniser
  transcripts. A failed transcription says so in the dock ("Couldn't make that out — try
  again, or type it") rather than leaving an empty box.
- **What the button shows.** Idle: a mic. Recording: the stop square, pulsing, with the
  elapsed seconds in the box's placeholder. Transcribing: disabled, placeholder "Listening
  back…". Text in the box: the send arrow. The same one control throughout, as now.

## Model

Answers stay on the fast pool (`GEMINI_MODELS_FAST`, lite first), which is his 2026-09-22
call and stays in force. Most of what went wrong on 27 Sep was hearing, not reasoning. If
answers are still poor once it hears properly, moving the coach to Flash is a one-line change
paid from a pool of 20 a day — a decision to take with evidence, not now.

## Deferred, with reasons

- **"That's not what I meant" on a marked card** (`learnAmendPrompt`). It still assumes the
  transcript is what he said; on 27 Sep he may well have said להיות correctly and been heard
  as לשתות. It deserves its own pass, with its own evidence.
- **Live words while he speaks.** Not possible alongside a recording on the Pixel (above).
- **Storing the coach thread in the sync.** Today it is device-only, which is why the 27 Sep
  question could not be recovered. Worth doing, but it is plumbing, not this fix.

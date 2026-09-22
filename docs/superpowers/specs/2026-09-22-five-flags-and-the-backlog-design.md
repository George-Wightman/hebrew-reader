# Five flags, and the backlog they sit in

## Where this came from

The flag review on 2026-09-22 found five new flags. In George's words:

- 12 Sep, on אני לומד לעבוד בעבודה לא אטי: *"What does this sentence mean, like that is
  not something anyone would say"*
- 20 Sep, on אני רוצה קצת נחמד: *"This sentence doesn't make sense"*
- 18 Sep, on עכשיו הקפה קר, having said אתמול: *"it was going to give me 'nearly' when I
  said yesterday and it wanted now. That's is just not correct at all. Why is it this
  leanient, very notices this before too."*
- 20 Sep: the mic's start beep. He has since fixed it on the phone; out of scope.
- 22 Sep: *"The English response from the coach is like not in line with their message.
  It's just in the middle of the screen which is a bit confusing"*

And in the review conversation itself:

> the coach seems to be quite shit, I find it hard to actually ask it what I mean, the
> messages send instantly, theres no time for me to add or edit so can we have a send
> stage, I stop talking or go the read what I put/ add more in hebrew, and have to press
> a send/ enter arrow to send it to coach.

> although the coach was born out of the "under the hood" I have never used it for that
> and dont forsee me using it for that, it is primarily and at its core now a aid for me
> to learn words and phrasing, so cut the fluff and streamline it

> On the flags point, I feel like we can learn a little about how the dashboard has the
> flags, with categories I can put, I would also like you to be able to remove old ones/
> make addressed so there isnt a load in the backlog.

On categories: *"maybe 'change' and 'idea' are too similar, maybe just go with idea"*.
On the grading model: *"this is something that is done every exercise I will use up the
pot wayyy too fast"* — so the fix stays on flash-lite.

## What the evidence showed

- **The two bad sentences are legacy.** Both were written by Gemini on 1–2 Sep, before the
  stronger reviewer landed on 3 Sep, and never went back through it. Reading all 167
  non-Claude sentences in his bank: the batch from 7 Sep onward is clean, the earlier one
  has about a dozen that are wrong (קצת כלב, אני בא עבודה היום, היום היה עבודה with a
  feminine noun, fragments like הכלב הקטן באביב). A "never" phrase card is stored as
  אפ פעמ — no final letters.
- **The grace judge contradicted itself.** The adjudicator correctly said עכשיו was not
  said. Grace (`learnGrace`, flash-lite, minimal thinking) then returned `fair: true` with
  the note *"you used the word for yesterday instead of the word for now"*. The same
  flag's log holds a second case: אף אחד accepted for "never".
- **The coach's English** is appended as a loose `.lask` line after the whole thread.
- **The dock auto-sends** on `coachDockSendOnEnd`, a deliberate "dash a quick question"
  choice.
- **The coach prompt still carries the inspector**: an "ABOUT THE APP" section, the source
  of every rule on screen, the full under-the-hood report including SRS projections, and a
  figure-guard retry that can fire a second call. None of it serves a Hebrew question.
- **Flags are capped at 40 and he has exactly 40.** `flagAdd` and `mergeFlags` both keep
  the newest 40 by id, resolved or not — the next flag silently evicts the oldest, even if
  it is still open.

## Phase A — the coach waits, and its English sits under its line (shipped, 4b2b748)

English inside the bubble it translates; turns keep `qen` so history carries it too. An
end of speech only fills the box; the main circle becomes the send arrow and a smaller mic
beside it speaks more into what is there.

## Phase B — grace stops passing a changed meaning

1. **A rule before any call.** `graceMeaningClash(expected, spoken)`: closed classes of
   words that carry the meaning — time, negation, person, number, question word, and the
   negative quantifiers (אף פעם / אף אחד / שום דבר). If the expected sentence holds a
   member of a class and what he said holds a *different* member of the same class and not
   the expected one, grace is refused without asking. Dropping a negation entirely is
   refused too. Zero latency.
2. **The model says what changed before it rules.** The reply shape becomes
   `{"changes": "...", "fair": bool, "note": "..."}`, with `changes` first — what his
   version changes about the meaning, in under ten words, or empty. About fifteen output
   tokens, not a thinking pass. The code then refuses grace whenever `changes` is
   non-empty, whatever `fair` says — a model that names the difference has answered.

Deferred: two parallel lite calls that must agree. Hold unless leniency still gets through.

## Phase C — the deep clean

1. **A retired-sentence store**, `hvr_retired`: `{ he: { ts, why } }`, keyed by the
   Hebrew, because bank ids are per-device and a retirement has to reach both. It unions
   through the generic object merge. `bankPrune` drops anything in it — every read path
   goes through there — and `learnIngest` refuses to bank a retired sentence again, so a
   writer that produces the same bad line does not bring it back.
2. **A one-off migration**, `hvr_legacyclean_v1`: retires the sentences named in this spec
   outright, then sends every remaining non-Claude sentence from before 2026-09-07 through
   `learnReviewItems` once, in batches, and retires what it rejects. Bounded by the same
   batch budget contentIngest uses; a failed review retires nothing.
3. **Final letters.** `heFinalFormsBad(he)` — a non-final form (כ מ נ פ צ) at the end of a
   word. `learnIngest` and the chunk store refuse such items; the migration retires any
   already banked, and repairs a stored chunk's key if the fix is unambiguous.
4. **Transliteration shown in the house scheme.** `trHouse(tr)` at display time for
   model-written transliteration: `ch`→`kh`, the article and one-letter prepositions joined
   without a hyphen, an apostrophe where a join meets a vowel. Stored data is untouched.

## Phase D — the backlog stops eating itself, and I can clear it

1. **Eviction by status, not age.** Over the cap, resolved flags go first (oldest first);
   an open flag is only ever evicted when there are more than `FLAG_MAX` open ones.
   Resolved flags older than 21 days are dropped outright. The same rule runs in
   `flagAdd` and `mergeFlags`, so both devices arrive at the same list.
2. **`content/flag-status.json`**, in the public app repo, which I can already push to —
   no write token to his sync repo. `{ version, flags: { "<id>": { status, note, kind?,
   at } } }`, status one of `addressed`, `wontdo`, `question`. It holds ids and my one-line
   notes only, never his flag text. The app fetches it alongside `nodes.json` and applies
   it: `addressed`/`wontdo` resolve the flag (`resolvedBy: "claude"`, the note kept),
   `question` attaches a reply without resolving, `kind` files an old flag. Then the
   normal sync carries it to the repo, so the check-flags skill's in-app count agrees with
   its ledger.
3. **The panel shows it.** Recently addressed by Claude (7 days) listed with the note, so
   he can see what was done without reading a commit.

## Phase E — categories, and Wrong Hebrew retires on the spot

1. **Three kinds, chosen when writing:** Bug · Idea · Wrong Hebrew. Chips in the flag
   sheet; the panel groups open flags by kind, unfiled ones last.
2. **Wrong Hebrew acts.** Offered when the card on screen carries Hebrew. Saving with it
   retires that sentence (or phrase) through `hvr_retired` immediately and still records
   the flag, so I see what was wrong.
3. `mergeOneFlag` carries `kind`, `note`, `reply` and `resolvedBy` across devices.

## Phase F — the coach is a Hebrew coach

1. **One job in the prompt.** "ABOUT THE APP", the code block, the fragment sentence and
   the figure-guard retry go. What stays: who he is, his level, the transliteration scheme,
   brevity, the conversation so far, the ASR note, and a compact view of what is on screen
   — the card's Hebrew and English and the live conversation, not the SRS projections.
   Answer shapes for the four things he actually asks: how do I say, what does it mean,
   is this right, why.
2. **"Not right" on each answer** opens the flag sheet, prefilled and filed as Bug, with
   the question and answer in the context — the evidence for tuning the prompt further.
3. **Starters in the empty dock**: How do I say… · What does … mean · Is this right… ·
   Why is it…, each dropping its opening into the box and starting the mic.
4. The dock's "What the app is doing" button goes.

## Deferred, with reasons

- **Two-call grace consensus.** Held back by George pending how phase B does.
- **Flash for the coach.** The strong pool is 20 a day and already shared; the prompt is
  the cheaper lever and is being pulled first.
- **Per-call thinking level.** `thinkingChain` is per model; plumbing a per-call override
  is a change to every call site's contract. Not needed if the prompt fix is enough.
- **Changing a flag's kind from the panel.** Kind is chosen when writing, and I can file
  the old ones through flag-status.json. Add a control only if he misses it.
- **The mic beep.** Fixed on his phone.

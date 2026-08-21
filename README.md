# Hebrew Voice Note Reader

Open **`hebrew-reader.html`** in any browser (double-click it — no internet needed for the basics).

> **Working on the code?** Start with [`docs/handoff-2026-08-21.md`](docs/handoff-2026-08-21.md) —
> where the app stands, what the last cycle changed, and what to pick up next. Behind it sits
> [`docs/audit-2026-08-20.md`](docs/audit-2026-08-20.md), the full critical review with 20
> numbered findings that the work is measured against. For the quest map specifically, see
> [`docs/path-handoff.md`](docs/path-handoff.md).
>
> The app is live at **https://george-wightman.github.io/hebrew-reader/** and installs to a
> phone. Progress syncs between devices through a private GitHub repo.

## How to use it

1. **Got a voice note? Copy it in WhatsApp and press Ctrl+V on the page.** It transcribes the
   Hebrew, translates it, and breaks it down word by word in one go — no typing it out yourself.
   You can also drag an audio file onto the drop zone or click to choose one (.ogg, .mp3, .m4a,
   .wav and friends all work). Or skip this and paste a transcription you've typed yourself.

   Two things to know: the audio is **sent to Google** to be transcribed, and on the free tier
   Google may use it to improve their products — you'll be told this once, the first time, and
   asked to agree. And unlike everything else here, audio has **no copy-paste fallback**: it needs
   a Gemini key in Settings, and if you've used up the day's free requests you'll have to type
   that one out by hand.

   You can add a **second Gemini key from a different Google account** in Settings as backup — it
   only kicks in once the first key's daily limit is fully spent, so it isn't split between the
   two. While a file is being transcribed the drop zone itself shows a spinner, and is inert to
   further drops until it's done.

2. Or paste a Hebrew transcription into the box yourself, and pick one of three ways to read it:
   - **Read message (instant)** — works offline. Uses a built-in dictionary of ~700
     common conversational words/phrases and understands prefixes (ו, ה, ב, ל, מ, ש, כ).
     Words it doesn't know are shown in orange with an approximate pronunciation.
   - **Copy AI prompt → Paste AI result** — free, needs no key at all. Copies a ready-made
     prompt; paste it into any AI chat (Claude, ChatGPT…), then paste the JSON reply back
     via "Paste AI result". You get context-aware word meanings plus a full natural translation.
   - **Translate with AI** — one-click version of the above, using your Gemini key.
3. Each word appears as a card — Hebrew on top, pronunciation, then English — flowing
   right-to-left like the original message.

## The Learn page — drilling, out loud

The Translator and the Library are both **reactive**: they need a message from grandad before
they do anything. **Learn** is the other half — where you practise *producing* Hebrew on your own,
built entirely out of the words your library already has.

**The answer is never typed, deliberately.** The moment you can type an answer you stop saying it,
and saying it is the whole exercise. Every card is the same three beats:

1. **A prompt** — shown or spoken at you
2. **You say the answer out loud** — a real pause, nothing to interact with
3. **Reveal** — the Hebrew appears *and is spoken*, then you tap **Missed / Nearly / Got it**

**Space** reveals · **1 / 2 / 3** grades · **R** replays the audio. One key per beat, so your eyes
stay up and your hands stay off.

A session is **15 cards** and mixes six drills:

| Drill | You get | You say |
|---|---|---|
| **Say the word** | an English word | the Hebrew |
| **Say the phrase** | an English phrase | a whole Hebrew chunk, as one thing |
| **Build the sentence** | an English sentence | the whole Hebrew sentence |
| **Hear and answer** | Hebrew audio, *no text* | what it meant |
| **Say it back** | Hebrew audio, *no text* | the same thing, straight back |
| **Reply to grandad** | a spoken question | a full reply |

**Hear and answer** hides the Hebrew on purpose — reading it was never the hard part, catching it
in real time is. **Reply to grandad** always closes the session, because it's the thing the whole
app exists to make possible; its reveal shows a *model* answer plus the words from your own
library that would have fitted.

**Say the phrase** drills whole chunks — *ma nishma*, *af pa'am*, *ma hamatzav* — and marks them as
one unit, never word by word. That's the point: fluency research is consistent that phrases
retrieved *whole* are what shorten your pauses, and that the same phrase assembled word-by-word
loses the benefit. These come from the app's own phrase list, so they cost nothing.

**Say it back** is the same audio as Hear-and-answer asking the opposite question: not what it
meant, but can you reproduce it. It only uses sentences you've already met, because copying the
rhythm of something you understand is the exercise — copying something you don't is just a
listening test.

### Every card says what it wants

Each card opens with a strip carrying the same three things in the same three places: a
**glyph** for the kind of act it is, the **instruction** in the loudest type on the card, and a
**direction pill** — `EN → עב` or `עב → EN` or `עב → עב`. The strip is tinted teal when you're
producing Hebrew and slate when Hebrew is coming at you.

The direction pill is the part that was missing entirely. "Say what it meant", "Say it back,
exactly" and "Answer them" all open with the same 🔊 button, and nothing on screen used to tell
them apart until you read a grey line of small print. Now the pill does it at a glance.

### Stuck? The gentlest rung first

The hint ladder starts with **prime**: the words that are in the answer, shuffled in among words
that aren't, drawn from your own library. It turns recall into recognition — enough to unstick
you without handing anything over. Nothing there is clickable, because picking one would make it
multiple choice; you still have to say it yourself.

After that it's the old ladder — first letters, then how it sounds, then the answer. Every rung
still caps the card at "Nearly", and it still says so the moment you take one.

### Conversations, redesigned to feel organic

A conversation turn is no longer a translation drill wearing a chat bubble. Three changes, all
grounded in the same complaint: it read as a string of "answer this sentence" tasks, not a
back-and-forth.

**You have to actually reply, not translate.** The English target used to be shown unconditionally
the instant a turn appeared — the one place in the whole app that handed you the answer before
you'd tried anything. It's now behind Hint, the same ladder every other card already uses, as the
very last rung. You see and hear their message and have to come up with something yourself first.

**There's genuinely more than one right answer, and you can say more than the script.** Generation
writes 2-3 realistic alternatives alongside the main reply, and grading checks whether the real
content came through — not whether you reproduced one exact sentence. Add "and you?" or an extra
"ani," pad it out the way a real answer does, and it still counts, because the words that actually
matter are still there. Zero added wait: still one call, written up front, same as before.

**Grading happens quietly, and the conversation just continues.** Speaking is scored the moment
you finish — no reveal screen, no grade buttons to press. If it landed, the next line arrives a
beat later, the way a real exchange doesn't stop for a report card. If it didn't, the repair line
kicks in exactly as before — the only thing that ever interrupts, because that's a natural
correction, not a scoring screen. A summary at the end reports how the whole thing went and which
words are worth another look.

Also fixed: the message you're actually replying to now appears in the thread as it arrives,
instead of only ever existing as audio with nothing written down to reply to.

### Conversations

Pick **Conversation** as your session shape and you get one scripted exchange, start to finish,
with the thread building up on screen as you go. Something is said, you answer out loud, they
respond — six turns of it.

**There is no wait between turns.** The whole conversation is written in one call before you
start, so nothing is being fetched between their line and yours. What adapts isn't *what* you
said but *how well* you said it: get a turn wrong and they don't move on and they don't break
into a lesson — they say it again, more simply, feeding back the word you were missing. You get
one more go at the same idea. Miss twice and it moves on and banks the word, because a word you
don't know must never become a wall.

Conversations are set somewhere — catching up, needing something, meeting family, making a plan,
saying how you feel — and the setting is doing real work: it gives the generator a reason for one
word to follow another, which is most of the cure for sentences that were grammatical and
meaningless. New settings appear as your vocabulary grows, and once earned they **join the
rotation** rather than being one-offs. Meeting the same situation four times is what turns
translating into answering.

The whole thing is spoken. There's no notes box — the target is on screen in English, you say it
in Hebrew, and it's graded word by word against the model answer. Say half of it in English and
it'll tell you which slot you reached for and what belonged there.

### Fine-tuning word strength directly

Settings → **Fine-tune word strength** opens every word in your Library — including grammar
and filler words — with two rows each: **Hear** (understanding it) and **Say** (producing it),
scored separately because the app schedules them separately. Four dots per row, coloured the
same way strength shows everywhere else in the app (grey new, red weak, gold progressing, green
strong); the dot for where you actually are is drawn larger. Click any dot to set that skill to
that level directly — no cycling, no menu, one click either way.

This is genuinely categorical, not a hidden 0–100 score wearing a nicer face — the app only ever
reasons in these four bands, so a slider would imply precision that doesn't exist underneath.
Setting a dot writes real values landing in that band by the same thresholds the scheduler
itself uses, and it's exactly what the session builder and Conversation mode check before
they'll use a word — so this is a direct, honest way to tell the app what you actually know
without drilling it up from scratch.

### Marking words as already known

Settings → **Mark Duolingo batch as known** fast-forwards the spaced-repetition schedule for
the Duolingo words straight to "strong" — for the ones you can genuinely say on sight, so
sessions and Conversation mode treat them as trained instead of brand new. It never touches a
word that already has real practice history behind it; it only bumps ones that are still new.

### A Duolingo-sized top-up

On top of the original seed words, the library got a one-time top-up of vocabulary George
already knows solidly from Duolingo — greetings, describing people, adjectives, food, plus
numbers to 100 and grandparents, all confirmed against Duolingo's own unit index rather than
guessed. It also filled real gaps the dictionary had no words for at all: animals (there wasn't
a single one), colours, a few missing food basics (egg, apple, rice), and the teens (11–19,
which are two-word compounds in Hebrew and don't reuse the smaller number words). Runs once,
only ever adds, and never touches a word already in the library.

The category list grew alongside it — Animals & nature, Colours, Clothing, Household,
Transport, Body, Shopping & money — so new vocabulary has somewhere better to land than the
handful of oversized grab-bag categories. A category with nothing in it draws no block, so the
empty ones stay invisible until something actually arrives.

### The Path

A branching quest map on its own tab — 32 sections, five phases, scrolling a long way down.
Three routes run from a single start and you take whichever suits you. Each section teaches a
handful of words through seven lessons: meet the words, say them, hear them, weave them with
vocabulary you already have, answer back, and close on a conversation in that situation.

**There are no gates.** A section opens when you've finished the ones it genuinely builds on,
and nothing else. Routes split where a subject genuinely forks — *Liking & wanting* forks into
Food and Free time — and merge where a situation needs both halves: *Making plans* needs
something to do and something to eat; *Telling a story* needs both where you went and what
happened.

**The language gets harder as you go down, not behind a wall.** Present tense for the first two
phases, then past, then future, then joining clauses. A ★ marks a situation you've already met
coming back in a new tense — *Your day* returns as *Your day — past* once you're deep enough for
the verbs to be familiar rather than new.

**How it grows.** Six rules govern any addition: the map deepens rather than gating; grammar
advances with depth; a ★ revisit is the same situation in a new tense; every edge means "you need
those words for this"; edges join adjacent rows and neighbouring columns only; and new sections
are only ever appended at the bottom, so growing the map can never invalidate progress you've
already made.

Tapping a section raises a panel from the bottom of the window, like the sentence pad — the map
stays visible behind it so you keep your place.

### The Path — how it's built

A branching quest map on its own tab. Three routes — people, doing, wanting — run in parallel
from a shared start, and you push down whichever suits you. Each section teaches a handful of
words through seven lessons: meet the words, say them, hear them, weave them together with
vocabulary you already have, answer back, and close on a conversation in that situation.

**Tiers are what lift the grammar ceiling.** Ordinary sessions are permanently capped at present
tense — there was never any mechanism to decide you were ready for more. Finish six tier-1
sections anywhere on the map and tier 2 opens, replaying situations you can already handle in
the past tense. Prestige sections hang directly off the present-tense section they replay.

**How it's built:** the sections, their backbone words and the unlock rules are hand-authored and
live in the file. The sentences and conversations are written by the AI when you first reach a
section, then cached permanently — a path whose content rewrites itself between visits stops
being a path. Lessons 1 and 2 use only the dictionary, so a section always starts even with no
connection.

Path lessons write to spaced repetition normally, so everything the path teaches immediately
starts appearing in your Balanced sessions. The path introduces; spaced repetition retains.
Walking out of a lesson halfway leaves the section exactly where it was.

### Why the same words used to keep coming back

Two separate fixes to how a session picks its words:

**The Duolingo batch no longer outranks real vocabulary forever.** Untouched words used to get
a flat priority bonus if they came from a "seed" batch — originally a small hand-picked starter
list, but the Duolingo import (120+ words) quietly inherited the same treatment. At that
strength, a word from an actual voice note could never mathematically catch up, so the batch
permanently dominated which "new" words got offered. The original hand-picked list still gets
full priority; the larger batches get a smaller one that a real word can eventually outrank.

**Untouched words now rotate instead of freezing.** Nothing previously remembered which words
had actually been shown, so the ranking never changed between sessions — whatever won on day
one kept winning forever, and the rest of the library never got a turn. Now each session records
what it showed, and the untouched pool is ordered by longest-since-shown first, familiarity only
as a tie-break. A word that's never been shown at all still always goes first — this only kicks
in once the untouched pool has actually had a full round.

Deliberately left untouched: which overdue words come up for review. That's spaced repetition
doing its actual job, not the bug.

### Choosing what kind of session

Four shapes, on the start screen, remembered between sessions:

**Balanced** — a bit of everything · **Weak first** — only the words you keep missing ·
**Speaking** — only drills answered out loud in Hebrew · **Quick** — five cards.

Four presets rather than a settings panel, deliberately. The failure mode of a configurable drill
app is spending the practice window configuring it.

### Tap any word — what it means, and why it's that

On a sentence card the pronunciation is **tappable, one word at a time**. Tapping a word opens it:
the Hebrew, how it's said, what it means on its own, and — where there's genuinely something to
know — **why it takes that form** (the tense, the attached prefix, the agreement, the word order).
Not a translation dump: the rule, so it carries into your next sentence.

The same panel holds **Got it / Nearly / Missed** for that word, because the word you want explained
and the word you fumbled are usually the same word. Everything counts as correct by default, so a
sentence you nailed still needs no taps at all — just Space.

That matters more than it looks. Grading the whole sentence at once meant fumbling one word out of
five recorded the four you *knew* as failures too. Now only the word you actually missed takes the
hit. (If the Hebrew and the pronunciation don't line up word-for-word, tapping switches off and the
card falls back to Missed / Nearly / Got it — better to lose the detail than to pin your tap on the
wrong word.)

**This costs nothing.** The explanations are written in the same call that generates the practice
sentences, so they arrive already attached — instant, offline, and permanent. Only a sentence banked
before this existed has to ask, once, and it's kept forever after.

### Stuck? Take a hint — and it says what that costs

Every card has a **Hint** button, and what it gives depends on what's being asked: the first letter
of each Hebrew word when you're producing a sentence, a slower replay when you're listening, the
pronunciation when even that isn't landing. Always strictly less than the answer.

**Taking a hint caps that card at "Nearly."** A hinted answer isn't a recalled one, and letting it
bank as "Got it" would push that word's next review weeks out on evidence that doesn't exist. It
says so on screen the moment you take the hint — never quietly afterwards. Help is always there, and
always honest about what it cost.

### It can hear whether you actually said it

On any card that asks you to produce Hebrew there's a **🎤 Say it** button. Press it, say your
answer, and the card reveals itself with **every word already marked** from what you actually said —
right, nearly, or wrong.

This is Chrome's own speech recognition, not the AI: **no key, no quota, nothing to run out of.**
It does send audio to Google to be transcribed, so it needs a connection; offline, everything works
exactly as before and you mark it yourself.

Two things worth knowing:

- **The mic never has the last word.** It's faster and more honest than marking your own homework,
  not infallible. Every mark it sets is still one tap away from being corrected.
- **It notices when you reach for English.** The Hebrew recogniser transcribes English perfectly
  well, so if you said *"film"* instead of *seret* it says exactly that, rather than just marking
  you wrong. Saying the English word and saying nothing are different mistakes.

**Reply to grandad is transcribed but not marked** — there's no single right answer to a reply, so
it shows you what you said next to a model answer and lets you judge.

Chrome won't remember microphone permission for a page opened by double-click, so it asks the first
time you press the button. After that the app holds the microphone for the rest of the session, so
it only asks once.

### Somewhere to put it while you think

**Hear and answer** and **Reply to grandad** speak the prompt once and show you nothing. On a long
one that's a lot to hold in your head, so both have a **scratch box** — jot down what you think you
heard, in whatever form helps.

Nothing in it is marked, compared or saved. It stays on screen when you reveal, sitting right above
the real answer so the comparison is just look up, look down, and it's gone when you move on. The
other two drills don't have one: their prompt is on screen the whole time, so there's nothing to
forget.

### Strong, progressing, weak

Every word carries two separate numbers: how long it **sticks**, and how **hard** it is for you.
Keeping those apart is what stops one bad day wiping out five weeks of progress — miss a
35-day word and it comes back at around 10 days, not back to the start. Get it right repeatedly and
its difficulty **recovers**, rather than being punished forever.

That gives each word a standing you can see: a coloured dot on every Library row, and a running
count on the Learn page — *"12 strong · 30 progressing · 8 weak."* **Weak words go to the front of
the queue.**

**Hearing a word and saying it are scored separately.** Understanding Hebrew and producing it are
genuinely different skills, and the second doesn't follow automatically from the first — so
Hear-and-answer builds one score and everything else builds the other. A word can be strong in your
ear and weak in your mouth, and the app goes after the gap instead of hiding it.

Sessions pull overdue words first (weak ones leading), then the ones you've never drilled **in order
of how familiar they actually are**, with starred words above ordinary review. The number on the
**Learn** tab is how many words are waiting.

### Difficulty that can't run ahead of you

A word being in your library means **grandad said it**, not that you know it. The page used to
conflate those, and it made the sentences impossible — it drilled your *newest* words first, which
are by definition the ones that just arrived from a voice note, and then built practice sentences
out of those same words.

Now it works the other way round:

- **Familiar words lead.** The 77 words seeded from your own Hebrew Table come first, then words
  grandad has actually used many times over weeks, then long-held ones, and last night's arrivals
  come *last*. It uses the exposure counts the archive has been quietly recording all along — how
  many times each word has really appeared, and when it first did.
- **Sentences are earned.** A sentence can't appear until every real word in it is one you've
  already drilled and got right. Grammar and filler words (*ani, et, shel*) don't count against it,
  so sentences can still be built out of what you know plus the connective tissue.
- **The easiest one comes first.** Among the sentences you've unlocked, you always get the shortest
  one made of your strongest words.
- **New material is written from what you can say**, not from what arrived most recently — and the
  AI is now told plainly that you're a near-beginner: present tense, 3–6 words, one clause, no
  inflected prepositions, no stacked infinitives.

**Expect no sentences at all for the first few sessions.** That's the point — you're building the
foundation they get made out of. The start screen tells you how many words are ready and how many
you need, so you can see the gate moving rather than wondering where the sentences went.

### Your progress, over weeks

The Learn page **is** the progress page. Your streak sits above the title, the session you're about
to do sits in the middle, and everything you've already done sits underneath it — minutes this week,
minutes all time, cards, days practised, plus a fortnight of daily bars so you can see a habit
forming or not. It's the room you're standing in when you decide to practise, not a report you go
and look up.

The part that actually matters is **where your words stand today against where they stood a
fortnight ago**: a single snapshot can't tell you whether the weak pile is shrinking, and that's the
only question worth asking. If you've used the microphone there's a speaking section too — how many
cards you've answered out loud, and how many of those came out clean first time.

Time is counted **per card**, and a card left open for more than three minutes stops counting. Walk
away mid-session and it doesn't get logged as practice — the one number you'd most want to trust
shouldn't be the one quietly inflating itself.

### Words that trip you up get added for you

If you keep missing a word in practice that **isn't in your library yet**, it lands in **Pending**
after the second miss, marked ⚡ with the reason — *"Missed twice while practising"* — so you know
why it turned up. Grammar words you already know cold (את, של, אני) are never pushed.

### Why it barely costs anything

Practice sentences come from the AI in **batches of about a dozen and are kept forever**. A session
tops the bank up only when it's short of material you haven't seen, so starting one usually costs
**a single call — and a repeat session costs nothing**. Sentences are built strictly from words you
already have; anything new the AI reaches for lands in **Pending** for approval like everywhere
else. After the reveal there's a **"Why is it phrased like that?"** button for the moments you
actually want the rule — one call, only when you ask.

The per-word explanations ride along in that same batch **for free**. The free tier counts *requests
per day*, not how much is in them, so asking for the glosses in a call that was already happening
costs nothing at all — and buys instant, offline explanations for every one of those sentences,
permanently.

### Sentences that actually mean something

Early practice sentences came out as things like *"there is a big wind"* — grammatical, on-level, and
nothing a person would ever say. The cause wasn't the AI. Your library is built from an opposites
table plus whatever grandad happened to say, which left **34 adjectives against almost no everyday
verbs**: of 21 words filed under Verbs, five were past tense, three future, five infinitives and two
weren't verbs at all. Handed adjectives and weather nouns and told to write twelve sentences, there's
nothing else to produce.

Three things fix it:

- **A core vocabulary.** 38 foundation words — *want, go, have, see, know, eat, drink, say, need,
  understand*, plus everyday nouns and question words — added to your library from the app's own
  dictionary. They lead your drill queue, because they're what makes sentences possible at all. They
  still have to be genuinely drilled before they can appear in one.
- **Quality is allowed to cap quantity.** The generator used to be told "6 sentences, 4 listening,
  2 replies" — twelve, always. If the vocabulary only supported four good ones, the rest was padding
  by construction. It's now a maximum, with explicit permission to return fewer.
- **Two quality passes.** It critiques its own draft before answering (free — costs tokens, not
  requests), then a **separate call re-reads every item cold** and throws out anything a native
  speaker wouldn't say. That second opinion runs on the lightweight model, where you have 500
  requests a day and currently use one. A sentence is generated once and then drilled for months, so
  spending an extra request to make twelve permanent items good is the cheapest quality in the app.

If a review fails, errors, or returns nothing usable, the original batch is kept — the second opinion
is an improvement, never a dependency.

**To clean out sentences already banked before this existed**, Settings → *Clean up nonsense
sentences* runs the same reviewer retroactively over everything currently stored, in batches, and
removes only what fails the same bar — everything that passes keeps its history. Different from
*Bin the practice sentences* (which throws everything away unread): this one judges first.

## Settings, organised by subject

Settings is grouped by what each row is *about* — You, Your data, Sync, Your library, Words and
their forms, Practice and scheduling, Reading and the pad, Audio, AI requests — with a filter box
at the top, because two dozen rows is past the point where scanning beats typing. Risk is a
per-row badge rather than the organising principle: sorting by danger meant that finding the thing
you wanted required knowing how dangerous it was first.

Every action states its real effect before you press it, not just in the confirm dialog after —
*Fix opposites* tells you how many of your own pairings it would discard, *Pull back inflated
review dates* tells you how many dates it would move.

One promise holds across all of it: **nothing in Settings can delete a word from your library.**

Two rows just report, and are worth knowing about:

**Your data → How much room you're using.** A browser gives each site a fixed allowance, around
5MB, and when it fills the next save simply fails with no warning. This says where you are:
*"241 words, 197 with form banks. Everything saved in this browser comes to 482KB — 9% of what it
allows."* Form banks are the one thing that grows without limit as you add words, so they are
called out separately. It turns red if you ever reach the point where something needs doing.

**AI requests → Today's quota.** Google's free tier gives two models with separate daily
allowances — **Flash** at 20 requests a day and **Flash-Lite** at 500 — and until now nothing told
you which one a feature spent or how much was left, so "it stopped working" arrived mid-sentence.
This reads *"Flash: 4 of 20 used · Flash-Lite: 12 of 500 used"*. Transcribing a voice note,
building a conversation, generating a path section and topping up a session use Flash; explaining
a word, *why is it phrased like that?*, the Sentence pad and filling in verb forms use Flash-Lite.
When Flash runs out the app falls back to Flash-Lite on its own rather than failing.

It counts what *this* browser spent, and Google counts per key — so requests from your phone come
out of the same allowance and won't show here until the two have synced. It can therefore say you
have more left than you do, never less. The moment Google actually refuses, the row says *used up
for today*, because that answer comes from Google rather than from counting.

*"Build up audio library" was removed* — it called Google's real-voice TTS, which has been
confirmed broken since the neural-audio work earlier in this project. It was a live-looking button
wired to nothing. The underlying code is untouched and dormant, in case that ever changes.

No key, no quota left, or no internet? It runs on your library alone and says so. It never blocks.

### Real Hebrew voices, cached forever

As of 2026-08-07 this stopped working: Google's TTS model was returning persistent server errors
for this account, and the consumer Gemini chat app wasn't a working alternative either — it
returned a fake "success" (a generic chime dressed up as a WAV, not real Hebrew speech) rather than
an honest failure. That verdict blamed the account. It never separated "the account is blocked"
from "the one model name asked for stopped existing" — no other name had been tried.

**Settings → Audio → *Check which Hebrew voices work*** answers that half for free: it asks Google
which speech models your key can actually reach, spends one request and generates nothing.
Confirmed on this key, 2026-08-21: `gemini-3.1-flash-tts-preview`, `gemini-2.5-flash-preview-tts`
and `gemini-2.5-pro-preview-tts` are all reachable, and all three are exactly what the app asks
for. **The model-name theory is dead — if generation still fails, it's the account or the quota,
not a stale name.**

That left one question *Check* can't answer, because it deliberately spends no TTS quota: does a
real clip actually come back. **Settings → Audio → *Generate a test clip*** is that test, and it's
been pressed: it currently fails, with a real named reason rather than a generic timeout —

```
HTTP 400: "Developer instruction is not enabled for this model"
```

That's Google rejecting the `systemInstruction` field itself, on every model this app can reach —
not the model name (confirmed fine above), not the account, not the daily quota. **So this is now
a known, specific, currently-unfixed bug**, not an open question. Fixing it means moving the
read-verbatim instruction that field carries into the prompt text instead, which is untested and
risks reintroducing the exact "replied instead of vocalised" bug that instruction exists to
prevent — deliberately shelved rather than attempted live, since day-to-day use is moving to
phone, where this doesn't matter as much as getting it wrong would.

**For now: the Windows voice is the real experience, same as before.** Give it a Gemini key and
the Learn page still tries to upgrade to genuine neural Hebrew audio in the background and
**keeps it forever** once it can — the first time a word or sentence is ever played, the Windows
voice plays immediately as always while a real recording attempts to generate quietly behind it;
today that attempt fails silently and the Windows voice keeps being the one you hear. Nothing ever
waits, and nothing ever blocks on it.

**Settings → Build up audio library** front-loads this once it works — *(removed from Settings on
2026-08-13 while TTS was believed dead; the code is intact and dormant, and this describes what it
does if it is put back once the bug above is fixed)* — it walks every word in your library and
every sentence in your bank, skips anything already recorded, and generates the rest one at a
time. **The real limit, confirmed from Google: about 3 recordings a minute, 10 a day**, per
Google account — smaller than you'd expect, so a full run is deliberately paced to stay under
that and takes a few minutes rather than seconds. It stops cleanly once it genuinely runs out for
the day and tells you how many it made. Settings also shows a running count — *"41 of 92 words
and sentences have real audio."* If it stops early for some other reason, the status line says
so plainly along with Google's own message, with a **Copy error** button next to it — never a
guess, and never something you have to select by hand.

**Every word in the Library has a 🔊 next to it** (hover to reveal, same as the star and edit
buttons) — click it to hear that word right now. Its colour tells you what you'll get before you
click: solid means a real recording is cached, muted means it'll fall back to the Windows voice.

Slower on real audio reuses the one recording rather than generating a second copy — the same 🐢
button and `Shift+R` just play it back a little slower.

The one Hebrew voice Windows ships is flat and runs faster than is comfortable for practice, so
even the fallback plays a fair bit slower by default now. `R` replays at normal speed, `Shift+R`
replays slow — both work before and after you reveal the answer, on the fallback or the real
recording alike.

### You'll need a Hebrew voice

Windows doesn't ship one, and Chrome doesn't bundle one, so out of the box the page tells you it's
reading rather than speaking — everything still works, you just see the pronunciation instead of
hearing it. It **will not** read Hebrew through an English voice, because that teaches you a wrong
pronunciation, which is worse than silence.

To fix it once, free, and offline forever: **Settings → Time & Language → Language & Region → Add
a language → Hebrew**, tick **Speech / Text-to-speech**, install, restart Chrome. The banner on the
page has the same steps.

Settings → **Reset drill schedule** forgets every word's strength and next-due date without
touching your library, your marks, or your banked sentences.

## Two pages, and a pad on one of them

**Learn** is the home page — the app exists to get you speaking, so the front door is the practice,
not the reference material. **Words** is everything else, because the Translator and the Library
were never really two things: they're one pipeline. A voice note comes in at the top, its new words
land in **Pending** inside the grid, you accept them, and the pad at the bottom is where you write
back.

So the Translator isn't a destination any more, it's an action. At rest it's a single bar across
the top of Words reading **"Paste a voice note"**, and the Library owns the rest of the page.
Ctrl+V, drop a file on the bar, or click it, and the bar opens downward into everything the
Translator page used to be — drop zone, transcript box, all four buttons, the word cards, the full
translation. The grid stays put below it, so you watch a new word land in Pending as it happens
rather than finding it later on another tab.

Close it with **✕ close** and it collapses back to the bar. Your **saved messages** live in there
too, as chips rather than a list — click one to reopen it. The bar says how many are saved so they
never look deleted.

**Settings** moved into the top bar next to the sync indicator, so it's reachable from both pages
instead of only from the Translator.

The **Sentence pad** stays docked at the bottom of **Words**. It stands down entirely on **Learn**,
which needs the whole screen and no distractions.

Above the typing box it shows a one-line reminder of **what you're replying to** — click that to
expand the full translation and the original Hebrew.

The pad has no background of its own — the boxes float on a soft haze, and **the gaps between them
are click-through**, so your word grid stays visible *and* usable behind it rather than being
walled off. Collapse it to a single pill and it gives back nearly all the space.

**All words** is a drawer at the foot of the Library: the plain record of every word that's ever
come through the app, whether you're studying it or not.

When a new word appears it's flagged in **Pending**, the first block in the grid. **✓** adds it to your
Library to work on; **✕** means "I recognise this, I'm not targeting it" — it drops into All words
and **won't be suggested again**. Either way it's on record, so nothing is ever lost and you're
never asked about the same word twice.

Changed your mind? Any word in **All words** has a **⊕** to pull it into your Library. Settings →
**Un-dismiss words** brings back everything you've set aside.


A nav bar at the top switches between them instantly — no reload, still one file.

## Paper &amp; Ink, and it works on a phone

The look is warm paper and ink: a serif for headlines so the page has a voice, teal for anything you
can act on, and **gold reserved exclusively for achievement** — the streak card and nothing else.
Keeping gold to one job is what stops it becoming decoration.

The Learn home puts the streak in its own card beside the headline, with the session you're about to
do on the left and your progress below. On a narrow screen **the streak moves above the headline**:
on a phone, the thing that gets you to open the app should be the first thing you see.

Everything reflows down to phone width. The library's freely-placed blocks are the one real
casualty — dragging them around a lattice needs a mouse and room, so below 760px they stack
full-width in whatever order you saved on the laptop. You can still read, search, and accept pending
words; rearranging stays a laptop job. The zoom slider hides for the same reason. The pad becomes an
opaque sheet rather than the floating haze it is on a laptop, because at half a phone screen the
library showing through it just looks broken.

Nothing is removed at any width, and the page never scrolls sideways.

**Cross-device sync isn't built yet.** The indicator in the top bar says "on this device" because
that's the truth: everything lives in this browser's storage. That slot is where it'll report
properly once devices actually share a brain.

## The Library — an Excel-style grid

The Library is a grid of freely-placed blocks, laid out on first run to mirror your
`Hebrew Table.xlsx`: **Pending** (new words awaiting your review) pinned first, then
**Opposites** wide, then **Weather**, **Time** and **Flavours** left to right, exactly as
in your sheet. Each word is one ~19px line — pronunciation first, English beside it, Hebrew
small on the right — so the whole library fits on one screen instead of scrolling. A badge
on the **Library** nav button shows how many words are waiting in Pending; the block itself
only appears when there's something to review.

- **New words are flagged, not added.** Content words from every message you read show up
  in a **Pending** block (pinned first, amber) instead of going straight into the library.
  Review each one with **✓** to add it or **✕** to dismiss it, or use **Add all** in the
  block header. Grammar words (את, של, אני…) are skipped entirely. Hovering a word card on
  the Translator page and clicking **⊕** still adds it immediately, bypassing Pending — that's
  for a specific word you want right now.
- Words are filed under their **base form**: reading בערב files it as ערב.
- **Plurals don't get their own row.** A Hebrew plural is just -ים/-ות on the singular, so
  seeing ילדים files straight under ילד, its existing row — no duplicate, no need to add it
  separately.
- Re-seeing a word bumps its "seen" count rather than duplicating it.
- **Drag a block heading** to move that block anywhere on the grid — your layout is
  remembered. If a block grows and would cover the one below, the lower block slides down
  rather than hiding words.
- **Drag a word into another block** to recategorise it. **Drag a word onto another word** to
  pair them as opposites — they join the **Opposites** block, shown side by side like your
  original sheet (`gadol big ↔ katan small`). Click the ↔ to unpair.
  Every row keeps **✎**/**✕** on hover for editing or deleting without dragging.
- **Mark the words you're working on.** Hover any word and click the **☆** — it turns gold, the
  row goes bold with a coloured edge, and it stays marked between sessions. A **★ N marked** chip
  appears next to the Library heading; click it to show only those words, click again for all.
  Search works inside the filter, so "marked words containing X" is a thing you can ask for. Each
  half of an opposites pair marks separately. Settings → **Clear all marks** wipes them without
  touching the words themselves.
- The **?** next to the Library heading shows or hides the reminders about dragging and pairing.
  Hidden by default so the grid and the pad fit on one screen.
- **Zoom** scales the whole grid; **Hebrew** can be set to small, full, or hidden — so the
  script can grow back as it becomes useful to you.
- Search filters rows in place.
- **Export .xlsx** produces `Hebrew Vocabulary.xlsx` with two sheets: *Browse* (themed
  blocks side by side, like your original table, with opposites paired) and *All Words*
  (one row per entry — sortable and filterable).

Unknown words go to **Uncategorised**; the AI translate modes return a category automatically.

Because rows are dense, pairing a word now asks you to confirm before it commits — a
misdrop no longer silently corrupts the Opposites block. If it ever does end up wrong, open
**Settings → Fix opposites** to restore exactly the curated set with one click.

## The Sentence pad

Under the Library grid is a pad for building the sentences you'll say back. Everything else in
the app reads Hebrew *to* you; this is the half that helps you produce it.

- **Type the pronunciation**, in normal English letters — `ani rotze lalechet`. No Hebrew
  keyboard, no hunting for characters.
- **The Hebrew builds itself** underneath, word by word, out of your own library.
- **Words it doesn't know show as gaps.** Click **Ask about N words** and it copies a
  ready-made question — including your whole sentence, so the answer comes back in the right
  register rather than as a dictionary definition. Paste it into any free AI chat, paste the
  reply back, and the new words land in **Pending** for you to approve. Approve one and the
  gap fills itself in.
- **Read aloud** blows the sentence up full-screen, transliteration only, nothing else on the
  page — for the moment you actually hit record.
- **Keep** saves a finished sentence so you can reuse or reread it later.

Some pronunciations mean more than one word (`kore` is both קורא *reads* and קורה *happens*) —
click the Hebrew word to cycle through the options.

**It's forgiving about spelling.** Hebrew is written without vowels and you tend to type the
same way, so `shly` finds שלי, `mtok` finds מתוק, `bvakasha` finds בבקשה. A word matched by
sound rather than exact spelling gets a dashed underline — click it if it picked the wrong one.
Very short words are matched strictly, because `t` alone could mean any of eleven things.

**It learns how you write.** Ask about a word and whatever you typed is remembered as a name
for it. Type `playing` because you don't know the Hebrew yet, and once you've been told it's
משחק, typing `playing` finds it forever after.

### The corrected sentence, word by word

Explain now answers with **tiles** — the corrected sentence laid out right-to-left, one card per
word, each showing the Hebrew, how to say it, and what that word means. The colour tells you what
happened to it:

- **Green** — you got it right. Nothing to click; there's nothing to say.
- **Blue** — you wrote it in English, this is the Hebrew.
- **Red** — you used the wrong Hebrew word or the wrong form.
- **Amber** — Hebrew needs this word and you left it out.

Click any coloured tile and it tells you what you originally wrote (struck through) and why the
better version is better. Only one explanation is open at a time, so the pad never balloons.

The paragraph of notes is still there underneath, but it now only covers things a per-word view
can't express — word order, sounding too formal for family, a sentence that doesn't hang together.

**Your feedback no longer vanishes when you start typing.** It stays put, dims, and shows *"you've
edited since this — press Explain to refresh"*, so you can actually read it while fixing your
sentence instead of watching it disappear on the first keystroke.

**Explain this** does two jobs in one click: it resolves any words you don't have Hebrew for yet
*and* reads your sentence back to you — so you can type straight through a sentence with gaps in
it (`ani ohev limshok basketbol`) and get back one clean, readable line using the *real* Hebrew
pronunciation for every word (`ani ohev lesachek kadursal`), plus a couple of sentences on
anything that would sound odd to a native ear and why.

That readable line is **never written by the AI** — it's assembled by the app itself from words
it actually knows, in your own word order, so it can't quietly rewrite your sentence even by
accident. The AI's only job is identifying words you don't know yet (same as before — they still
land in **Pending** for your approval) and writing the short notes underneath. Those notes will
tell you *why* something's off — like למשוך meaning "to pull" rather than "to play" — but will
never hand you a fixed version to copy. You still have to notice and fix your own mistakes.

**Read Aloud now uses this same resolved line**, not your raw typing — so a word you looked up
mid-sentence reads back in Hebrew, not as the English placeholder you typed while waiting to
learn it. If anything's still unresolved, it says so before you read.

The note clears the moment you edit the sentence, so it can never describe something that's no
longer on screen. **Keep** saves it alongside the sentence.

**Words you already know don't have to join the library.** The library is for words you're
learning — so if something is flagged that you already know, click the gap and mark it known.
It stops being flagged, stops costing you a lookup, and never appears in your table.
Settings → **Reset "words I know"** undoes all of that without touching your library.

The notes are **critical and instructive**. They lead with what's wrong — never confirming what
you already got right — then give you the better option *and the rule behind it*, so it carries
into the next sentence: *"Hebrew past tense already includes 'was doing', so just use עמד (amad)"*.
What they won't do is write your sentence for you. Word-level guidance and the reasoning; you
decide what to take.

Words it finds are stored as **base words**, not whatever form you happened to use — say "in the
garden" and your library gets גינה (gina), not בגינה (ba-gina). You can still type `begarden` or
`hagever` and the pad puts the prefix back for you.

While it's working, the status shows in the pad itself and the window edge pulses gently.

Optional: paste a **Gemini API key** into Settings and the lookup becomes one click instead of
a copy-paste trip — no credit card needed. Be aware Google's free allowance is small (currently
about 20 requests a day on the main model); the app automatically falls back to a lighter model
with its own separate allowance, and if both run out it tells you plainly and copies the prompt
so you can paste it into any AI chat instead. Without a key everything still works — you just do
the paste yourself.

## Extras

- **Click any word** to correct its pronunciation/meaning. The app remembers your fix and
  uses it automatically in future messages (it learns with you).
- **Save to history** keeps messages for review; they're listed at the bottom.
- Untick **pronunciation** or **English** to quiz yourself.

Everything is stored locally in your browser (localStorage) — nothing is uploaded unless you use
one of the AI features, which talk only to Google's Gemini API with your own key.

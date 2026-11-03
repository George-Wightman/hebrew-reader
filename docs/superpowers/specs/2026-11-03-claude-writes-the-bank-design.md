# Claude writes the bank: the phone's sentence writer goes off

## Where this came from

Six flags between 29 Oct and 3 Nov. Three were the same complaint:

> It just got me do the same card twice in a row

> Okay, this is really weird because I've just had back-to-back the exact same sentence
> in both of the translations were different so there's a big problem here

> Why does this one keep coming up cuz it's obviously something I can say really easily

And one on the hint ladder:

> Why did this just give me the starting letter or not option of words?

Reading the review, George put the cause where the evidence also puts it:

> I feel like the API is just shit and doesn't have the intelligence for it. And I'd
> rather you have that intelligent and kind of methodical... fine-grained, really
> detailed look through the sentences to generate them, so there aren't any of these
> duplicates... I think the API doing it is what is kind of the problem here.

> switching the Gemini writer off is the right move... look at the patterns of when the
> Gemini API has had to be implemented, when it's triggered, okay, we're short, now it
> needs to work. And look forwards at... the words, the sentences... to how that pattern
> might reoccur, kind of predict it and write those new material accordingly... be big
> and long here... making a way for the app to realize, okay... I wanted to pull a
> sentence like this, I didn't have it, prompt me to then come back to you.

On sure wins:

> the sure wins is something that I want. Maybe we could do it so there's a bit more
> variation. So it's sentences that I've got right a few times, but there's a pool, so
> there's a bit of a noise about it.

On the prompt card (flag 2): "it's actually fine... Now I've gotten used to it." Not
changed.

## What the evidence said

Read from his synced state on 2026-11-03.

- **Every duplicate he hit was written by the phone.** All 20 sentences added on
  2026-11-03 came from Gemini (`src` empty), including a second `אני רוצה קפה` (the first
  is `אני רוצה קפה.`), a second `לא תודה, אני רוצה מים`, and `אפשר קפה, בבקשה?` beside
  `אפשר קפה בבקשה?`. Fourteen groups in all are the same words twice; the back-to-back
  pair was `אני מאוד עייף היום` / `אני עייף מאוד היום.`, "I am very tired today" / "I'm
  very tired today.". He said the second word order and the first card marked two words
  "near".
- **Why the guard missed them.** `learnIngest`'s exact check compares raw `he` strings
  per type, so a full stop makes a new sentence. `bankNearDuplicate` is Hamming-1 on raw
  tokens, so `קפה.` ≠ `קפה`, a swapped order is two differences, and it only reads the
  newest 80 items. Neither compares across `sentence` / `listen` / `reply`.
- **How much of the bank is Gemini's.** After ingesting `content/nodes.json` as the phone
  does: 1,257 items, 955 pre-written and 302 Gemini's. Of what is servable today, 180 of
  503 are Gemini's. Switching the writer off without replacing them would cost a third of
  his material.
- **What triggered the writer** (`learnTopUp`, `campWarm`), and so what has to be written
  ahead instead:
  - *rescue*: a `weak` word with fewer than `RESCUE_MIN_EACH` (2) **unseen** sentences
    that carry it on strong support;
  - *introduce*: each of the next `INTRO_AHEAD` (3) never-met words with fewer than
    `INTRO_MIN_EACH` (2) unseen sentences;
  - *breadth*: a due word with nothing servable written for it;
  - *node*: a map node below `CONTENT_AMPLE_ITEMS`.
  The first two count only **unseen** stock, so any finite stock runs out at the rate he
  practises. That is the pattern to write ahead of: every word needs several unseen
  sentences, not one, and the next intro words need theirs before they launch.
  `hvr_genstat` shows the writer produced ~947 items over its life and had ~358 refused
  for unknown words.
- **Sure wins always open on the same sentences.** `sessionWinPicks` sorts by `cardEase`
  descending and takes the top n, with "recent" only a tiebreak. `אני רוצה קפה`, all
  strong words, is near the top every time, and two copies double its odds.
- **אביב was "strong" without ever being asked alone.** Its record was built from compose
  cards (graded right in under 2s) and sentence cards, three of them inside a minute on
  one day. The first bare word card, on 3 Nov, was a miss. `hintPrimeStep` drops the word
  choices for any word read as strong, so he went straight to "Starts with א". The
  inflated "strong" is part of a wider question (46% clean over 21 days while the cards
  report strong words with 65 to 140-day intervals). That goes to the direction-balance
  work, not this spec.
- **Gemini also reviews pre-written content on the phone** (`contentIngest` and
  `contentReviewTick`, through `learnReviewItems`) and retires what it rejects: 32 items
  so far under "reviewer".

## Phase 1: the app stops writing, says what it is missing, and stops repeating

1. **The phone writes no bank sentences.** `learnTopUp`'s rescue, introduce and breadth
   passes and `campWarm`'s node commission no longer call `sentenceCommission`. Bank
   retirement (`bankRetire`) still runs. The Gemini review of pre-written content
   (`learnReviewItems` in `contentIngest` and `contentReviewTick`) is switched off too,
   so a weaker model no longer retires Claude-written, gate-checked Hebrew (*my call*:
   same reasoning as the writer; the native-speaker check stays the ground truth).
   Coach, scenes, talks, transcription and grading are untouched. They do not write the
   bank.
2. **What it wanted, it writes down.** Wherever a pass would have commissioned, it
   records the shortfall in a synced store `hvr_wants`:
   `{ [word]: { why: "rescue"|"intro"|"due"|"node", n, first, last, have } }`, plus node
   shortfalls keyed `node:<name>`. It merges across devices by word (max `n`, earliest
   `first`, latest `last`). An entry clears itself once the word's unseen stock is back
   above its floor. The session also records the moment that matters most: a card it
   **wanted and could not fill** (a due word that fell back to a bare word card because no
   servable sentence carried it).
3. **It tells him.** When `hvr_wants` holds live entries, the content status line and the
   flag panel say plainly that Claude has sentences to write, with the count. The
   `generate-node-content` skill reads `hvr_wants` first.
4. **One sentence, one copy, whatever the punctuation or order.** A new
   `bankSameWords(a, b)`: equal multisets of `normHe` tokens. `learnIngest` refuses an item
   that matches anything in the whole bank, any type. `bankNearDuplicate` compares
   `normHe` tokens rather than raw ones. At serve time, a session never holds two items
   that share their words, which protects him from copies already sitting on other
   devices.
5. **Sure wins from a shuffled pool.** Eligible as now (`cardEase ≥ EASE_MIN`, not carry,
   no launched word), plus seen before. Anything served in the last two sessions is left
   out unless the pool would otherwise be too small. A random draw, with no sort by ease.
   `rand` is injectable so tests are deterministic.
6. **Word cards always offer the word choices first.** For `kind === "word"` the targets
   handed to `hintPrimeStep` are `[c.key]`, whatever its strength. The reasoning: asking
   for a hint on a word is the evidence that it is not strong right now.

## Phase 2: the sift (Claude, by hand)

Every item in the phone-equivalent bank (`tools/content` probe, after ingest) is read for:

- the same words in another order, another type, or with different punctuation;
- near-copies: the same sentence plus a vocative (`סבא`, `אבא`), plus or minus one
  filler, or one swapped noun in a frame already well stocked;
- Hebrew that is wrong or unnatural, transliteration off scheme, or an English line that
  does not match.

Of each group, the best one is kept: the pre-written one when quality is equal, since
that is the one the gates have seen. The rest are retired through `content/nodes.json`'s
`retired` list. **This needs one change:** today the file's `retired` list only deletes
`src: "claude"` items. Phase 1 makes it also delete matching Gemini items and add them to
`hvr_retired`, so a sift reaches every device.

## Phase 3: writing ahead (Claude, big)

Write against the triggers above, projected forward rather than measured today:

- **Every gradable library word**: at least 4 servable sentences (frequency rank ≤ 300),
  2 (≤ 1000) or 1 otherwise, the `cov.js` targets. For **weak and progressing** words the
  floor is unseen stock of at least 3, so a rescue would never fire.
- **The next 30 intro words** in `learnTargets` order (not 3): 3 introducing sentences
  each, built on ready words, so a month of launches is covered.
- **Every live node** above `CONTENT_AMPLE_ITEMS`, checked before and after.
- **Replacing the Gemini share**: the 180 servable Gemini items that survive the sift stay.
  Whatever the sift retires is written back at the same words.
- Variety is the explicit goal: different frames, people, tenses and lengths per word,
  never a template with one slot swapped. No item may share its word multiset with another.

Every candidate goes through `gate.js` in ship order and `cov.js` before and after, as the
`generate-node-content` skill requires. Shipped as content v11.

## Deferred, with reasons

- **The prompt card's look.** He has got used to it and asked for nothing more.
- **"Strong" that isn't.** Compose credit, sentence credit, and same-minute repeats all
  raising stability is a scheduler question. It belongs with the direction-balance
  research (HE→EN vs EN→HE), which asks what each card actually proves. Changing it here
  would move every interval he has.
- **Deleting the writer's code.** It is switched off, not removed: the commission
  pipeline is also what `generate-node-content`'s gates reuse. Deletion can follow once
  a month without it has gone by.

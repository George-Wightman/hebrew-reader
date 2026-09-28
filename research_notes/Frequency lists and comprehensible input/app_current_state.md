# How the Hebrew Reader currently chooses words and sentences (code audit, 2026-09-28)

Scope: read-only audit of `hebrew-reader.html` (42,318 lines, HEAD `8c9acb4`), `content/nodes.json` (v5), `README.md`, `CLAUDE.md` and `docs/superpowers/specs|plans`. All sources below are local files; "L" = line number in `hebrew-reader.html`. Counts marked "measured" were computed by parsing the static tables in the file with Node for this note; counts marked "per spec" come from George's real synced state as measured in a design spec (his live `progress.json` was not decoded for this audit).

## Q1. Does the app already do anything frequency-based or comprehensible-input-like?

### Takeaway
There is **no general-language frequency ranking anywhere** in the app. It does, however, already run a strict comprehensible-input gate under other names: a sentence is served only if every content word is "ready" (i+0), with a controlled exception that lets **one** not-yet-known word ride along in daily practice (two inside a map node). New words are ordered by **Duolingo course unit** and by **personal exposure** (how often grandad has said it), not by corpus frequency.

### Cited Findings
- A grep of the html for `frequen|most common|commonest|corpus|zipf` finds only comments and a dictionary gloss ("often, frequently"); no rank table, no frequency field — [hebrew-reader.html grep](../../hebrew-reader.html)
- The only historical mention of frequency is the 2026-07-22 original design: the offline dictionary was "~400 high-frequency conversational words + multi-word phrases" — a description of how DICT was hand-assembled, not a ranking used by any algorithm — [2026-07-22-hebrew-reader-design.md:25](../../docs/superpowers/specs/2026-07-22-hebrew-reader-design.md)
- No spec, plan, README or CLAUDE.md mentions Krashen, comprehensible input, i+1, a frequency list or "core vocabulary" in the frequency sense (grep over `docs/`, `README.md`, `CLAUDE.md`) — [docs/ grep](../../docs/superpowers/specs/)
- **The i+0 gate ("readiness")**: `bankServable` (L20617) requires every content word (non-STOPLIST word that resolves to a library key) to pass `wordReady` (L20981), i.e. production strength `progressing` or `strong`. Grammar/filler words in `STOPLIST` (L8468, ~63 words: pronouns, של, את, לא, יש, מה...) are exempt — [hebrew-reader.html L20586-L20641](../../hebrew-reader.html)
- **The +1 exception ("carry")**: with a `carry` set, one not-ready word is allowed if every other content word is `strong` (daily); node sessions pass `CAMP_SERVE = {maxCarried: 2, support: "ready"}` (L25045) allowing two not-ready words with merely-ready support, but "never two never-met words in one sentence" — [hebrew-reader.html L20617-L20641](../../hebrew-reader.html)
- The readiness gate was designed on 2026-08-11 after George said sentences were "wayy too hard"; decision: "Gate: Every content word must be ready; grammar and filler words are exempt"; "Build from ready words, not target words"; "Generation is skipped below 8 ready words" (`READY_MIN_FOR_SENTENCES = 8`, L26087) — [2026-08-11-difficulty-and-readiness-design.md](../../docs/superpowers/specs/2026-08-11-difficulty-and-readiness-design.md)
- The "one new word" rule was introduced 2026-08-25 ("A bank item may carry one not-ready word when the session explicitly allows it, and only if every other content word is strong") and relaxed for nodes on 2026-08-26 (at most two not-ready, at least one `progressing`) — [2026-08-25-node-targeting-and-generation-design.md:44](../../docs/superpowers/specs/2026-08-25-node-targeting-and-generation-design.md); [2026-08-26-node-targeting-and-debt-design.md:130-150](../../docs/superpowers/specs/2026-08-26-node-targeting-and-debt-design.md)
- Loosening the gate to allow "sentences of mostly-unknown words" was explicitly asked for and **declined** (2026-09-02), and again kept unchanged on 2026-09-23 ("Variety comes from covering more words, not from admitting harder sentences") — [2026-09-02-the-writer-has-123-words-design.md:366](../../docs/superpowers/specs/2026-09-02-the-writer-has-123-words-design.md); [2026-09-23-one-list-and-a-bank-that-covers-it-design.md "Deferred"](../../docs/superpowers/specs/2026-09-23-one-list-and-a-bank-that-covers-it-design.md)
- Frequency-like signals that do exist: (1) `arch[k].seen` — count of times a word appeared in his real voice notes (`archiveRecord`, L11385), used in `wordFamiliarity` (capped at 20 × 8 points) and fed to the chapter planner as "WORDS HIS GRANDAD ACTUALLY USES THAT HE STILL CANNOT SAY", sorted by `seen` (`campEvidence`, L21005); (2) Duolingo unit order (`DUO_UNITS`, L5751); (3) the bank's own word-use counts (`breadthBrief` "overused", L26802), used to steer the writer *away* from over-used words — [hebrew-reader.html](../../hebrew-reader.html)
- README: "A core vocabulary. 38 foundation words — want, go, have, see, know, eat, drink, say, need, understand, plus everyday nouns and question words ... They lead your drill queue" (`CORE_WORDS`, L10882) — hand-picked for sentence-building utility, not from a frequency list — [README.md:477](../../README.md)

### Inferences
- In CI terms the app enforces something close to "98-100% known content words" per practice sentence (grammar words assumed known), and allows i+1 (occasionally i+2 inside nodes). What it lacks is a notion of *which* unknown words are worth introducing first in the language at large.
- The Duolingo unit order is a de-facto curriculum proxy for frequency (units 1-20 are everyday words), but beyond unit ~20 it follows topics (e.g. unit 50 "Languages" actually holds rescue/emergency words), so it diverges from frequency exactly where George is now.

### Gaps
- Whether the app's readiness threshold ("progressing") corresponds to genuine comprehension was not assessed; it is a production-side SRS band.

## Q2 (a). Where does vocabulary come from, and how do new words enter his study?

### Takeaway
Words reach the library (`hvr_library`, the set of study-eligible words) by six routes: his own spreadsheet seed, a hand-picked core list, a guessed Duolingo list, a staged import of Duolingo's own course word list by unit, approval of words harvested from voice-note transcripts, and node/stretch words added by the map. Entering the library is not the same as being studied: a word then enters practice through a "soft launch" word card (2 per Full session, 1 per Quick).

### Cited Findings
- **Seed**: 77 rows from his `Hebrew Table.xlsx` (`SEED`, L8495), imported once with `src:"seed"` (`libSeedIfNeeded`, L10851) — measured count 77 — [hebrew-reader.html L8495, L10851](../../hebrew-reader.html)
- **Core words**: 38 words (`CORE_WORDS`, L10882: present-tense masc. verbs רוצה, יודע, הולך..., nouns, time words, questions, courtesies), added with `src:"batch"` from DICT (`libAddCoreIfNeeded`, L10897) — [hebrew-reader.html L10882-L10925](../../hebrew-reader.html)
- **Early Duolingo list**: 84 words (`DUO_WORDS`, L10927) "from guessed unit topics", `src:"batch"` (`libAddDuoIfNeeded`, L10945) — [hebrew-reader.html L10927](../../hebrew-reader.html)
- **Duolingo course by unit**: imported 2026-09-02 from a 77-page vocab PDF, "3,545 rows across 84 units in Duolingo's own teaching order"; `DUO_UNITS` maps 2,144 headwords to a unit (measured; max unit 84; 373 headwords in units 1-20). `libAddDuoUnits(upTo)` (L11028) adds every word with unit ≤ his current unit (`duoWordsThrough`, L10995), `src:"duo"`, `duo:<unit>`, `shelf:"reserve"`, and **seeds SRS as if known**: units 1-10 prod `strong`, 11-20 prod `progressing`, recv `strong` for both — [hebrew-reader.html L5655-L5700, L10995-L11060](../../hebrew-reader.html); [2026-09-02-the-writer-has-123-words-design.md:203-231](../../docs/superpowers/specs/2026-09-02-the-writer-has-123-words-design.md)
- Those assumed records are later detected as "unproven" by fingerprint (`srsUnproven`, L19945; seeded (stab,diff) shapes (3,7), (8,4), (30,2) and no `lastAt`) and are "tested gently": at most one unproven word per sentence and 2 (Quick) / 5 (Full) per session (`UNPROVEN_PER_SESSION`) — [hebrew-reader.html L19945, L25742](../../hebrew-reader.html); [2026-09-23 spec, Phase 1-2](../../docs/superpowers/specs/2026-09-23-one-list-and-a-bank-that-covers-it-design.md)
- **Voice-note transcripts**: `libHarvest` (L11441) records every token in the archive (`hvr_archive`, "everything seen"), bumps `seen` on library words, and puts unknown words into a **Pending** queue (`PENDING_MAX = 200`) that he approves or dismisses; approval calls `libUpsert(..., "auto")` — [hebrew-reader.html L11378-L11500](../../hebrew-reader.html)
- **AI-declared words**: generated sentences may declare up to `COMMISSION_NEW_MAX = 2` glossed new words (L20353); such words go to Pending and the item is held (`it.pend`) until approved (`bankServable` first line) — [hebrew-reader.html L20353-L20372, L20617-L20630](../../hebrew-reader.html)
- **Map nodes**: node words chosen by the Gemini planner and validated by `campPickWords` (L21154, `CAMP_WORDS_PER_NODE = 6`, must exist in DICT or library and not already strong); `carry` (3 ready words, `campPickCarry` L21191) and **stretch** (2 words per node from Duolingo units > his current unit, in unit order within a 40-word window, `campStretchPool` L23879 / `campStretchFor`) — [hebrew-reader.html L21140-L21210, L23860-L23912](../../hebrew-reader.html)
- The whole Duolingo document was deliberately **not** imported into the library: "2,178 headwords against a 2-per-day introduction rate is three years of queue. The dictionary takes everything; the library takes what he has actually met." — [2026-09-02-the-writer-has-123-words-design.md:381-384](../../docs/superpowers/specs/2026-09-02-the-writer-has-123-words-design.md)
- **Soft launch into study**: `learnBuild` (L25794) reserves `NEW_WORD_CARDS = 2` (L20890; Quick = 1) word cards for targets whose prod strength is `new`. One correct meeting moves a word to `progressing`, which makes it `wordReady` and eligible for sentences the next session — [hebrew-reader.html L25900-L25925](../../hebrew-reader.html)

### Inferences
- The rate of genuinely new words entering practice is small and fixed (≈2 per Full session plus 2 stretch words per node), so *which* word is picked next matters a lot — exactly where a frequency rank would have leverage.

### Gaps
- The exact current library size by `src` was not measured from his live state in this audit (see Q5 for spec-reported figures).

## Q3 (b). How does it order/prioritise new words vs reviews?

### Takeaway
One function, `practiceNeeds`, gives every word a need score for today (due words positive, recently-practised negative); `learnTargets` orders the session's targets as overdue (capped at half the session) → never-drilled "fresh" words → starred → rest. Fresh words are ordered by "longest since shown", then **`wordFamiliarity`** — a hand-tuned score from seed status, Duolingo unit, grandad-exposure, age and drill history. No frequency term.

### Cited Findings
- `practiceNeeds(lib, srs, today, arch)` (L25685): due → `NEED_DUE` 10 + min(5, weeks overdue); not due but answered < 2 days ago → −4; < 7 days → −1; else 0. Due list sorted by `wordFamiliarity` descending, then older due date. Also returns the `unproven` set — [hebrew-reader.html L25665-L25725](../../hebrew-reader.html)
- `learnTargets(limit, only)` (L25398) buckets gradable words into overdue / fresh (`!r.n`) / starred / rest; overdue ordered by practiceNeeds' due order and capped at `floor(limit × OVERDUE_SHARE)` with `OVERDUE_SHARE = 0.5` (L20911) "Half the session is always kept for material he hasn't drilled yet"; fresh sorted by recency-of-showing then `wordFamiliarity` — [hebrew-reader.html L25398-L25460](../../hebrew-reader.html)
- `wordFamiliarity(k, lib, srs, arch)` (L20943): `src:"seed"` +1000; `src:"duo"` +max(0, 150 − (unit−1)×5) (decays to 0 by unit 31); `src:"batch"` +150; + min(20, arch.seen)×8 (grandad exposure); + min(60, days held); + n×6 − miss×10 — [hebrew-reader.html L20920-L20976](../../hebrew-reader.html)
- The 2026-08-11 spec reversed an earlier "newest first" order to "most familiar first", because newest words were the least familiar (just arrived from grandad's notes) — [2026-08-11-difficulty-and-readiness-design.md §1](../../docs/superpowers/specs/2026-08-11-difficulty-and-readiness-design.md)
- The 2026-09-02 spec, Phase 4: "new words arrive in Duolingo's order" via the unit term in `wordFamiliarity` — [2026-09-02-the-writer-has-123-words-design.md:244-250](../../docs/superpowers/specs/2026-09-02-the-writer-has-123-words-design.md)
- Scheduler strength bands: `srsStrength` (L19918): `new` if no answers; `weak` if diff ≥ 6.5 or miss rate ≥ 0.4; `strong` if stab ≥ 21, diff ≤ 5 and recent miss ratio ≤ 0.15; else `progressing` — [hebrew-reader.html L19918-L19927](../../hebrew-reader.html)
- Weak words are handled separately: `rescueWords` (L26202) = the 3 (`RESCUE_MAX`) weak words with the highest miss rate; they form the daily `carry` set and get AI-written rescue sentences — [hebrew-reader.html L26170-L26216](../../hebrew-reader.html)
- A due word with no servable sentence ("stuck") gets a word card via the "flexible slot" (Quick 1, Full up to `FLEX_DUE_CARDS = 2`) — [hebrew-reader.html L25926-L25945](../../hebrew-reader.html)

### Inferences
- A frequency rank would fit most naturally as an additional term in `wordFamiliarity` (the same way the Duolingo unit was folded in) or as a tie-breaker in the `fresh` sort of `learnTargets`. Because `wordFamiliarity` also orders the *due* list in `practiceNeeds`, adding it there would affect reviews too — a design choice to make explicitly.

### Gaps
- None material for this question.

## Q4 (c). How are sentences chosen or written, and what limits unknown words?

### Takeaway
Sentences come from a bank (`BANK_MAX = 1600`) filled by pre-baked content (`content/nodes.json`, written by Claude against his live state) and by Gemini writers (rescue + breadth). Every path is guarded by code gates: ingest allows ≤ 2 declared new words; serving requires all content words ready except one carried word (two in nodes). Daily selection is a greedy coverage maximiser over `practiceNeeds` scores within a level mix.

### Cited Findings
- **Bank & selection**: `learnBuild` filters the bank through `bankServable(it, lib, srs, carry)`, scores each by summed need of its content words, applies rotation (`BANK_COOLDOWN_SESSIONS`), then `learnPickBank(pool, room, level, needs, opts)` (L25744) fills a level quota (`levelQuota`, L20791) greedily: score = Σ need[w], a word already covered this session −2 (`PICK_COVERED`), recently served item −3 (`PICK_RECENT`); positive-score candidates first; candidates with > 1 unproven word ineligible — [hebrew-reader.html L25727-L25792, L25820-L25860](../../hebrew-reader.html)
- **Difficulty**: `bankDifficulty` (L20680) = worst word band ×10 + word count; grammatical level 1-5 from `LEVEL_RUBRIC` (L20705) assigned by an AI reviewer; learner level measured by `levelSettle`/`learnerLevel` (L20773-L20780) — [hebrew-reader.html L20676-L20730](../../hebrew-reader.html)
- **Word resolution** for all gates: `bankUses` (L20304) maps tokens to library keys via `libKeyFor` (L20289): exact key → strip one prefix from `BANK_PREFIXES = "ובהלמשכ"` → verified inflected form in `FORM_INDEX` → prefix-stripped form. Returns the lemma, so "a sentence using קטנה credits קטן" — [hebrew-reader.html L20270-L20310](../../hebrew-reader.html)
- **Unknown detection**: `bankUnknowns` (L20373) lists tokens that resolve to nothing (peeling up to 3 prefixes via `bankStripPrefixes`); used at ingest; a "token miss rate" (`genStat`) tracks how often the writer strays out of vocabulary — [hebrew-reader.html L20331-L20400](../../hebrew-reader.html)
- **Ingest/commission gate**: `commissionAcceptable` (L26544): every token must be STOPLIST, scaffold, rescue word, or a glossed/declared new word, with at most `COMMISSION_NEW_MAX = 2` "fresh" tokens and ≤ maxCarried rescue words — [hebrew-reader.html L26532-L26590](../../hebrew-reader.html)
- **Breadth writer**: `breadthBrief(lib, srs, bank, needs)` (L26802) returns `write` (≤ 8 due, ready, single-word entries with no servable sentence), `overused` (10 most-used bank words) and `support` (25 most stable ready, proven words). `learnTopUp` (L26848) builds the prompt: "WORDS HE CAN ALREADY SAY", "WRITE FOR THESE", "DO NOT LEAN ON THESE", "EVERY WORD HE IS READY FOR — use ONLY these, plus basic grammar words", with a level spread (half at his level, a third at +1, one or two at +2). Max 3 runs/day (`BREADTH_RUNS_PER_DAY`) — [hebrew-reader.html L26786-L27060](../../hebrew-reader.html)
- **Rescue writer**: `sentenceCommission` → `sentenceWrite`/`sentenceWriteOne` (L26373-L26385) writes per-brief items marked "MUST USE" for weak words, with strong-only scaffolding (`scaffoldWords`) or ready scaffolding in nodes (`campScaffold`) — [hebrew-reader.html L26217-L26240, L26367-L26420](../../hebrew-reader.html)
- **Pre-baked batch v5** (2026-09-23): "Every ready word at least once. Everyday words ... 4–6 times, each time with different partners; rare nouns ... 1–2 times"; "At most one unproven word per sentence"; acceptance "every ready word ≥ 1 servable sentence after ingest". Result: servable daily sentences reached "362 of 393 single-word ready entries (from 116)" — [2026-09-23 spec, Phase 4-5](../../docs/superpowers/specs/2026-09-23-one-list-and-a-bank-that-covers-it-design.md)
- **Node sessions**: `campBuild(node, size)` (L24862) builds 14 cards from the node's words, weak words, debt words (`campDebtWords`, 3 from earlier nodes) and stretch words, using the node relaxation of the gate — [hebrew-reader.html L24862-L24880](../../hebrew-reader.html); [2026-09-02 spec, Phase 7](../../docs/superpowers/specs/2026-09-02-the-writer-has-123-words-design.md)

### Inferences
- The "exactly one unknown word" rule already exists (`carry`) but it is used for *rescue of weak words* and *stretch/node words*, not as the main road for introducing new vocabulary; new words are introduced by isolated word cards first and only then used in sentences (i+0). An i+1-first introduction path would mean putting a `new` frequency-ranked word into the daily `carry` set — the gate supports it without change (one never-met word, all other content words strong).
- "Weighted by use" in the v5 batch was an author judgement ("everyday words"), not a measured frequency; a frequency list could make that weighting objective in future content batches.

### Gaps
- The exact list of cards per slot in `campBuild` beyond L24880 was not re-read line by line; the spec's 2+5+4+3 composition is cited instead.

## Q5 (d). How many words are in the library and nodes, and how are they organised?

### Takeaway
Static dictionaries: DICT 965 + DUO_DICT 1,665 → 2,630 unique glossable Hebrew keys; 77 phrases; Duolingo unit map of 2,144 headwords. His library (per the 2026-09-23 spec, measured on his live state) held about 537 gradable words (397 ready). Organisation is by category (`cat`), source (`src`), Duolingo unit, SRS band, grammatical level 1-5 for sentences, and map chapters → nodes.

### Cited Findings
- Measured: `DICT` 965 entries (after stripping `@` category markers; 18 multi-word), `DUO_DICT` 1,665, union 2,630; `PHRASES` 77 (all multi-word); `DUO_UNITS` 2,144 headwords, units 1-84; `SEED` 77; `CORE_WORDS` 38; `DUO_WORDS` 84; `STOPLIST` ~63 — [hebrew-reader.html L5070, L5495, L5751, L6365, L7078](../../hebrew-reader.html)
- Per spec (live state 2026-09-23): "library bands (prod): strong 155 · progressing 242 · new 96 · weak 44 (ready 397)"; "bank: 516 items; servable in daily practice today: 304"; "distinct words across servable sentences: 116" (before v5) — [2026-09-23 spec, "What the measurements said"](../../docs/superpowers/specs/2026-09-23-one-list-and-a-bank-that-covers-it-design.md)
- `content/nodes.json` v5 (generated 2026-09-23), measured: 770 items (722 `sentence`, 48 `listen`), 37 retired; levels 1:112, 2:258, 3:263, 4:118, 5:19; 321 distinct `for` target words; 674 distinct surface tokens. Item shape `{he, tr, en, type, lvl, for, gloss?}` — no node field — [content/nodes.json](../../content/nodes.json)
- Most frequent surface tokens in nodes.json (measured): אני 164, יש 70, את 59, שלי 52, אתה 52, לא 43, מאוד 38, סבא 36, לי 34, אמא 32 ... — [content/nodes.json](../../content/nodes.json)
- Library entry fields seen in code: `{tr, en, cat, opp, seen, added, src ("seed"|"batch"|"duo"|"auto"|"path"...), duo, shelf, genderPair, forms, formsMeta, pos}` — [hebrew-reader.html L10856, L11040-L11046, L7420-L7450](../../hebrew-reader.html)
- Map: chapters (theme) of `CAMP_MIN_NODES`–`CAMP_MAX_NODES` = 4-6 nodes (L21760); each node has `name`, `situation`, `lvl`, `words` (6; 8-10 for newly planned), `carry` (3), `stretch` (2). Example fallback chapter "More of your life": Family & home, Going places, Liking & wanting, How you feel (`CAMP_FALLBACK`, L22160) — [hebrew-reader.html L21153, L21760, L22160-L22180](../../hebrew-reader.html)
- Categories come from DICT's `@` section markers and per-unit defaults for Duolingo words (`CAT`, L5640; `DUO_UNIT_CAT`) — [hebrew-reader.html L5640-L5700](../../hebrew-reader.html)

### Inferences
- His vocabulary (~540 words) sits in the range where general-frequency coverage gains per new word are still large; a top-2,000/5,000 lemma list would mostly overlap DICT ∪ DUO_DICT (2,630 keys), so most frequency-ranked words would already have glosses available for a card.

### Gaps
- Current (2026-09-28) library size and band counts were not re-measured; the figures above are five days old and come from the spec.
- Number of chapters/nodes currently on his map is not stored in the repo (lives in `hvr_campaign` in his synced state).

## Q6 (e). Any existing notion of "known words %" for a text or the transcript reader?

### Takeaway
No aggregate "% known" exists anywhere. The transcript reader colours **each word card** by its receptive SRS tier (unseen / new / weak / progressing / strong), which is the raw material for a coverage score, but never sums it.

### Cited Findings
- `render(result)` (L8663) draws each transcript token as a card with class `tier-<band>` from `cardTier(c, lib, srs)` (L11322), which uses **recv** strength ("reading is receptive"), returns `"unseen"` for Hebrew not in the library, and `null` for STOPLIST/punctuation. `TIER_LABEL` gives the legend text — [hebrew-reader.html L8663-L8700, L11310-L11335](../../hebrew-reader.html)
- The sentence pad shows "N words · K known" (L13956), but "known" there means an English/transliterated word the pad could resolve to Hebrew, not learner knowledge — [hebrew-reader.html L13889, L13955-L13957](../../hebrew-reader.html)
- The Learn start screen shows only a count: "N words ready for sentences" (L28868-L28871) — [hebrew-reader.html L28868](../../hebrew-reader.html)
- The removed live-conversation grader had a lexical coverage measure (`convoContentCoverage`, `coverage >= 0.8 ? 2 : ...`), deleted on 2026-09-02 — it scored an answer against model answers, not text comprehensibility — [2026-08-27-live-conversation-design.md:49-55](../../docs/superpowers/specs/2026-08-27-live-conversation-design.md); [2026-09-02-the-coach-becomes-the-gate-design.md:179-180](../../docs/superpowers/specs/2026-09-02-the-coach-becomes-the-gate-design.md)

### Inferences
- A known-word-coverage score for a voice note could be computed inside `render()` from the tiers already computed per card (e.g. share of non-STOPLIST tokens with tier progressing/strong), with no new data.

### Gaps
- None.

## Q7 (f). Where could a frequency rank attach, and what are the natural plug-in points?

### Takeaway
The cleanest attachment is a static table keyed by **unpointed Hebrew headword in the same convention as DICT/library keys**, shaped like `DUO_UNITS` (`{ "בית": 12, ... }`), optionally copied onto library entries as a field (like `duo`). Three plug-in families: (1) ordering new words — `wordFamiliarity`, `learnTargets` fresh sort, `duoWordsThrough`/`campStretchPool`, `campEvidence`; (2) coverage scoring — `bankContentWords`+`wordReady`, `bankUnknowns`, `cardTier` in `render()`; (3) i+1 selection/writing — the `carry` argument to `bankServable`, `learnPickBank` score, `breadthBrief`/`learnTopUp` prompt, and `commissionAcceptable`.

### Cited Findings
- Precedent for a static rank table: `DUO_UNITS` (L5751) is exactly a `{hebrew: integer}` map used for ordering (`duoWordsThrough` sorts by unit; `campStretchPool` sorts by unit), stored compactly with per-unit defaults — [hebrew-reader.html L5751, L10995-L11002, L23879-L23885](../../hebrew-reader.html)
- Precedent for a per-entry rank field: `lib[k].duo` holds the unit "because it is evidence about the WORD ... wordFamiliarity reads it" — [hebrew-reader.html L10966-L10975, L11044](../../hebrew-reader.html)
- **New-word ordering hooks**: `wordFamiliarity` (L20943) — add a decaying frequency term exactly like `FAM_DUO_MAX/FAM_DUO_STEP`; `learnTargets` fresh sort (L25440) — frequency as tie-break after recency; `duoWordsThrough` (L10995) / `libAddDuoUnits` (L11028) — which Duolingo headwords enter the library; `campStretchPool` (L23879) — order units 21+ by frequency instead of unit; `campPickWords` (L21154) — validate/prefer high-frequency node words; `campEvidence` (L21005) — tell the planner which frequent words he lacks — [hebrew-reader.html](../../hebrew-reader.html)
- **Coverage hooks**: `bankContentWords` (L20586) + `wordReady` (L20981) give known/unknown per sentence; `bankUnknowns` (L20373) gives unresolved tokens; `cardTier` (L11322) per reader token — [hebrew-reader.html](../../hebrew-reader.html)
- **i+1 hooks**: `bankServable(it, lib, srs, carry, opts)` (L20617) already admits exactly one not-ready word from `carry`; daily `carry` is currently `new Set(rescueWords(...))` (L25830) — adding a high-frequency `new` word here would make daily i+1 sentences servable for it. `learnPickBank` (L25744) score could add a frequency bonus. `breadthBrief` (L26802) could add a "WRITE FOR THESE (new, high-frequency)" list; `commissionAcceptable` (L26544) and `COMMISSION_NEW_MAX` (L20353) already permit declared new words — [hebrew-reader.html](../../hebrew-reader.html)

### Inferences
- Because `bankServable` requires the carried word to be *in the library* (`bankContentWords` only counts library keys; `it.pend` blocks unapproved words), a frequency-driven new word must be added to the library (with no SRS record → `new`) before i+1 sentences for it can be served. `campEnsureWords` already does this for stretch words (L23951), so that is the model to copy.

### Gaps
- No existing test or spec explores frequency-based ordering, so how it should interact with the Duolingo-unit term and grandad-exposure term is undecided.

## Q8. What would a frequency list need to look like to plug in, and what are the obstacles?

### Takeaway
It should be a list of **unpointed Hebrew lemmas/headwords, clitic-free, with final letters as written**, mapped onto the app's existing keys (DICT ∪ DUO_DICT ∪ library). Raw corpus frequency lists (surface tokens) will need prefix-peeling, form-to-lemma folding and homograph handling; the app's key conventions are themselves inconsistent for verbs.

### Cited Findings
- **Keys are unpointed surface Hebrew.** FORM_INDEX notes that forms written with nikud were unreachable because "nothing else in the app" uses nikud; it strips nikud only, "deliberately not normHe: that also folds final letter forms" — [hebrew-reader.html L7440-L7450](../../hebrew-reader.html)
- **Prefix clitics** ו ב ה ל מ ש כ (and כש) attach to words. The reader strips up to 3 via `PREFIX1`/`PREFIX2` only when the remainder is in DICT (`lookupWord`, L8597); `libKeyFor` peels only one; `bankStripPrefixes` peels up to 3 but only if the result resolves, because "You cannot tell a prefix from a first letter without something underneath to confirm it: מכוער opens with מ" — [hebrew-reader.html L8556-L8625, L20289-L20340](../../hebrew-reader.html)
- **Verb forms / lemma convention is mixed.** The 2026-08-19 spec found "There is no lemma concept. Row keys are whatever surface form was sighted first" and set "Verbs cite to the infinitive"; but `CORE_WORDS` uses present masc. singular (רוצה, הולך, אוכל...) and `DUO_UNITS` holds both forms as separate headwords (measured: הולך unit 16, ללכת unit 2; אוכל unit 51, לאכול unit 2) — [2026-08-19-word-forms-design.md:16, 290](../../docs/superpowers/specs/2026-08-19-word-forms-design.md); [hebrew-reader.html L10882-L10895](../../hebrew-reader.html)
- **Inflected forms resolve only if verified.** `libKeyFor` maps a form to its lemma only through `FORM_INDEX`, which holds "VERIFIED only" forms from library entries' `forms` banks; before that it was "blind to Hebrew inflection" (674 forms in his library at the time) — [hebrew-reader.html L7412-L7452, L20270-L20303](../../hebrew-reader.html); [2026-08-26-inflection-blind-generation-design.md:60-80](../../docs/superpowers/specs/2026-08-26-inflection-blind-generation-design.md)
- **Homographs**: FORM_INDEX is "first writer wins" because "Genuine homographs are real in Hebrew"; DICT itself glosses אוכל as "eat(s) / food" — [hebrew-reader.html L7428-L7433](../../hebrew-reader.html); measured DICT entry
- **Multi-word entries can never be credited** in a sentence: "bankUses matches one token at a time, so 'בזמן האחרון' can never be credited to any sentence" (`breadthBrief` excludes them); PHRASES (77) and 18 multi-word DICT keys are affected — [hebrew-reader.html L26811-L26816](../../hebrew-reader.html)
- **Tokenizer edge cases**: 31 ready entries could not be covered, partly because "ג'ינס and ז'קט use an ASCII apostrophe, ברוזה is a misspelling, תות's plural is stored as תויות" — [2026-09-23 spec, Results](../../docs/superpowers/specs/2026-09-23-one-list-and-a-bank-that-covers-it-design.md)
- **STOPLIST**: the very top of any Hebrew frequency list (אני, את, של, לא, זה, יש, מה, גם...) is in `STOPLIST` (L8468), which is never graded (`srsGradable`, L8490) and is exempt from the gate — [hebrew-reader.html L8468-L8490](../../hebrew-reader.html)

### Inferences
- Practical shape: `const FREQ_RANK = { "<unpointed headword>": <rank>, ... }`, generated offline by lemmatising a corpus list, then reconciled against DICT ∪ DUO_DICT keys, with verbs entered under **both** the infinitive and the present m.sg. key where the app has both (or mapped via FORM_INDEX), STOPLIST words dropped, and multi-word phrases held separately.
- For coverage scoring of real transcripts, surface tokens should go through the same resolver the app already trusts (`libKeyFor` then `bankStripPrefixes`), not a separate one, so the score agrees with the serving gate.
- Rank beyond ~60 matters most, since the top ranks are grammar words the app already treats as known.

### Gaps
- Whether a suitable lemmatised Modern Hebrew frequency list exists and how well it aligns with DICT keys was out of scope (web research by other researchers).

# Handoff — Phase 4, 2026-08-21

Second entry for the day. `docs/handoff-2026-08-21.md` covers the first cycle and is still
the right place to start: how to run the app, the service-worker trap, the heredoc trap,
what only the Pixel can confirm. This one is short and only says what Phase 4 changed and
what the next person should know that isn't in the audit.

**Suite: 253 passing** (233 before). Everything below is verified in the browser, not
reasoned about.

---

## What Phase 4 turned out to be

The audit framed Phase 4 as two fixes. Measuring first changed both of them.

**F8 was three-quarters already done, and its real defect was invisibility.**
`learnExplainWord` had moved to the lite pool in the audio cycle — the previous handoff
listed it as open, which was wrong. Only `learnWhy` was left, and it moved. "Let generation
fall back after one attempt" was already `geminiRequest`'s behaviour.

So the routing was half an hour. What was actually missing is that **nothing in the app ever
said which pool a feature spent or how much was left** — the first signal was a feature
failing mid-sentence. `hvr_ai_q` now counts per pool per day and Settings reads *"Flash: 4
of 20 used · Flash-Lite: 12 of 500 used"*.

**F7's prescribed fix — move form banks to IndexedDB — is rejected, and the audit now says
why.** Sync was built after the audit was written and carries **localStorage keys only**
(`syncKeys()` is a prefix scan). Form banks travel between devices today purely because they
ride inside `hvr_library`, and `mergeLibrary` unions them on purpose with a test asserting
it. The move would have made form banks behave like voice notes — device-local, silently —
and nobody would have noticed for weeks.

Measured against George's own backup instead: **482KB of a ~5MB allowance, 9%.** Roughly
2,500 words of headroom. The premise is right (banks and their metadata are 79% of the
biggest key) and the urgency is not. So the fix became the honest one: put the number where
it can be read.

---

## Three things worth carrying forward

**`formsMeta` is bigger than the forms it describes** — 124KB against 100KB, because it
stores a `src` and a `state` string per tag and a verb has 21 tags. If `hvr_library` ever
does need shrinking, that is the first move, it is pure compression, and it costs no sync
properties. Reopen IndexedDB only after that, and reopen it as *"how do form banks sync out
of IndexedDB"* rather than as a straight move.

**A per-minute 429 and a spent day were indistinguishable in the code.** `geminiRequest`'s
`spent` flag is set for both, because an interactive caller passes no `waitOnRateLimit` and
so `rateLimitWaitMs` returns null either way. The error *messages* drew the distinction
(`sawRateHint`) but nothing else did. Writing the ledger forced it out: `dayGone` now carries
it. Anything else that wants to reason about quota should use `dayGone`, not `spent`.

**`hvr_ai_q` merges like `hvr_stats`, not like a setting.** Both devices spend one key's
quota, so `mergeAiQ` takes the higher count per pool and treats `spent` as sticky. It
undercounts a day used on both devices, in the same direction and for the same reason as the
stats merge: summing is right once and double-counts on every sync after. Erring low is the
honest direction for a warning.

---

## Corrections to the previous handoff

- **`learnExplainWord` was already on the fast pool.** The handoff's list of six strong-pool
  call sites was written from the audit rather than from the code.
- **`audioZoneBusy` is not a call site.** The strong-pool call at that point in the file is
  the toolbar's *Read it with AI* handler (`aiBtn`), which sits just after it.
- **"Settings → Audio → *Build up audio library*" does not exist** — it was removed on
  2026-08-13. The F9 test is **Settings → Audio → *Check which Hebrew voices work***
  (`ttsCheckBtn`), which does exist and does the right thing. The README said both, in two
  places; corrected.

---

## What is left

Unchanged from the previous handoff except that Phase 4 is done. In priority order:

- **F17 — no mistake review.** Still the highest-value cheap feature left.
- **F18 — no dark mode.** Still zero `prefers-color-scheme` rules.
- **F11 — four divergent prefix tables.**
- **F13 remainder — five dead functions**: `audioClearAll`, `convoAddScene`, `focusStar`,
  `openLibEditor`, `pendingCount`.
- **F9 — fully diagnosed same day, fix deliberately shelved.** George pressed *Check which Hebrew
  voices work* right after this was written: all three model names the app asks for are reachable
  on his key, so the model-name theory is dead. A second button, **Generate a test clip**, was
  added to answer the question `Check` can't (it spends no TTS quota, so it never sees a
  `generateContent` failure) — one real sentence through the real `geminiTTS()` path, played back.
  He pressed it. Result: `HTTP 400 "Developer instruction is not enabled for this model"` — Google
  rejecting the `systemInstruction` field itself, on every model this app can reach. Not the name,
  not the account, not the quota. The fix is moving the read-verbatim instruction into the prompt
  text instead of `systemInstruction`, which is untested and risks reintroducing the "replied
  instead of vocalised" bug that instruction exists to prevent (see the comment above `geminiTTS()`
  in the code). **Not attempted** — George is moving to phone-first use and asked to shelve this
  avenue. Start the next attempt from the exact error above, not from scratch.
- **F20 — three content systems**, deliberately deferred until the Path has been walked.
- **The mobile UI pass is still half done**, and still wants George's opinion rather than a
  guess at 375px.

Two things this cycle noticed but did not act on, both out of scope:

- The README's Settings section described "three tiers" long after the reorganisation to
  seven subject groups. Corrected here, but it suggests the README rewrite and the code
  drifted apart in more than one place.
- The quota ledger does not count `geminiTTS`, which has its own loop and its own pool. If
  neural audio comes back, that pool deserves its own line rather than being folded into
  these two.

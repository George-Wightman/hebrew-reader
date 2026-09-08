# September 8 reliability fixes

George authorized implementing and pushing the sync race, backup-key redaction and meaning-grading findings from the review. The scope is recorded in `superpowers/specs/2026-09-08-sync-redaction-and-meaning-design.md`.

## Behavior

- Sync compares the current syncable keys with its uploaded snapshot before applying incoming data. A local edit triggers a fresh pull/merge/push, with at most three attempts. Continuous changes leave local progress intact and show a pending-sync error.
- Manual sync respects active practice. A session that begins during an upload also prevents applying incoming data; session-end sync is not throttled by that deferred application. Push-only flag sync remains available during practice.
- Sync errors remain visible after cleanup. A failed incoming storage write does not stamp success. The success receipt uses the uploaded snapshot's timestamp.
- `CREDENTIAL_KEYS` is the shared registry for Gemini, backup Gemini and GitHub token storage names. Raw diagnostics and sync exclusions derive from it. The existing diagnostic test now independently lists all three storage keys, so another omission cannot make the test silently skip a credential. Backup export behavior is unchanged.
- Meaning feedback is deliberately conservative and offline. Matching normalized wording suggests Got it. Different wording says to compare the meaning and choose a grade, with no suggested grade. This avoids rewarding reversed meanings and avoids declaring valid paraphrases wrong. It is not an AI semantic grader. Word-level marking and the learner's final choice remain unchanged.

## Validation

The full suite runs on a disposable localhost origin, without API keys, user progress or a service worker. Its existing tests assume a nonempty sentence bank: the test server supplies eight deterministic entries from the seeded library immediately before `runSelfTests`, after startup migrations. Without that fixture, two existing tests fail on an empty bank; this is not a regression in the fixes.

All 771 release tests passed, with no uncaught page errors. The original implementation was also run with the 14 new regressions appended: all 757 original tests passed, and 13 new regressions failed as expected (including missing new helper functions). The passing new case covers the unchanged remote-conflict retry path. The credential omission was independently reproduced with a synthetic backup key before implementation; its expanded diagnostic test checks list, leaf and formatter paths in the fixed suite.

Static checks cover JavaScript parsing, duplicate named function declarations, LF line endings and `git diff --check`. Tests use stubbed transport; no private GitHub progress file is uploaded or altered for verification. Pixel microphone behavior is outside this change.

## Remaining review suggestions

Content-review policy, transliteration cleanup, learning-outcome validation, interface changes, complete recording backups, and service-worker lifecycle improvements remain separate work. No changes to those features are included here.

# Sync, credential redaction, and meaning feedback

## Where this came from

George: "Sync race, key redaction, meaning grading" are "all good calls and want them implemented and pushed."

The September 8 review reproduced three failures against the current code with synthetic data: a local write during sync is replaced by the uploaded snapshot; the backup Gemini key is not redacted in raw diagnostics; and substring-based comprehension grading accepts negated and role-reversed answers. The manual Sync button also bypasses the active-session guard.

## Approved scope

### Sync

- `force` bypasses the cooldown only. Ordinary/manual sync does not run during practice; flag pushes remain permitted without applying remote state.
- Compare current syncable keys with the local snapshot after each upload. If a key was added, changed, or removed, retry with a fresh snapshot, within the existing three-attempt bound.
- Never apply a snapshot after a session has begun during the network calls. Keep local progress intact and let the normal session-end sync reconcile it.
- Exhausted retries report pending changes, never success. Stamp the last successful snapshot time, not the upload completion time, so flags written after the snapshot are not reported as uploaded.
- A failed local write must not produce a successful sync receipt.

### Credentials

Define the three credential storage keys once and derive diagnostic redaction and sync exclusions from them. Retain the existing backup-export contract. Regression tests explicitly enumerate the primary Gemini key, backup key, and GitHub token independently of the implementation's list.

### Meaning feedback

Keep comprehension checking immediate and offline. Only matching wording (ignoring case, whitespace, typographic apostrophes and terminal sentence punctuation) suggests Got it. Different wording returns an uncertain result and invites self-assessment against the model answer; it must neither reward reversed meaning nor penalize a valid paraphrase. Preserve negation, pronouns, word order and numbers. Remove the substring/stopword heuristic and its claims of semantic correctness.

## Verification

Add regressions for edits during uploads, bounded retries, new sessions during sync, manual mid-session sync, push-only behavior, failed writes, all credential diagnostic routes, misleading word overlap, and uncertain feedback with no suggested grade. Run the full existing suite on a disposable local origin with no real credentials; check parsing, duplicate function declarations, and the final diff. Push once and verify the deployed bytes.

## Deferred, with reasons

No AI semantic grader: it introduces latency, availability and adjudication policy beyond these fixes. No scheduler redesign, backup-format change, content rewrite, service-worker redesign, or module extraction. These remain separate review suggestions.

# Cross-device sync — design

2026-08-20. Closes the remaining half of F15 in `docs/audit-2026-08-20.md`: the app is now
on the phone, but progress does not follow it.

## The problem

`localStorage` is per-origin *and* per-device. Phase 0's export/import moves a snapshot by
hand, which works but has no conflict detection — import a stale file over newer work and
the newer work is gone, silently. George: *"exporting and moving every time is too much."*

## Constraints

- **No new third party.** GitHub is already in use; nothing else gets added.
- **GitHub Pages cannot do this itself.** It is a static file server with no way to accept a
  write. The sync store has to be something else that GitHub already offers.
- **Secrets stay out of it.** API keys are already on both devices and must never travel.
- **It must never block the app.** No token, no network, no repo — the app works exactly as
  it does today, offline-first, and says so.

## Store

A **second, private repo** — `hebrew-reader-sync` — holding one file, `progress.json`. The
existing `hebrew-reader` repo stays public and code-only.

Written through the GitHub Contents API:

- `GET /repos/{owner}/{repo}/contents/progress.json` → base64 content + `sha`
- `PUT` same path with `{message, content, sha}` → a commit

The `sha` gives **optimistic concurrency for free**: if the file moved since the read, GitHub
returns 409 and we re-pull, re-merge and retry. That is the exact guarantee manual
export/import lacks. Every sync is also a commit, so the history is a free versioned backup.

Authentication is a fine-grained PAT scoped to that one repo, Contents read+write. Stored in
`localStorage` on each device. Blast radius if a device is lost: one private repo containing
a vocabulary list.

## What syncs

Keys are enumerated by `hvr_` prefix scan minus two exclusion sets, the same approach as the
Phase 0 export — so a feature added later is included automatically rather than being
forgotten.

**Never synced — secrets:** `hvr_geminikey`, `hvr_geminikey2`, `hvr_synctoken`, `hvr_syncrepo`.

**Never synced — genuinely device-local:** `hvr_session` (an in-flight session belongs to the
device running it), `hvr_blocklayout`, `hvr_gridzoom`, `hvr_hemode`, `hvr_libview`,
`hvr_mappos`, `hvr_mapview`, `hvr_collapsed`, `hvr_activeview`, `hvr_padopen`,
`hvr_notesopen`, `hvr_archopen`, `hvr_pad`, `hvr_migrated`, `hvr_voicebanner`,
`hvr_audioconsent`, `hvr_syncmeta`.

The phone and the laptop *should* have different layouts and zoom levels — the audit already
records that dragging blocks around a lattice is a laptop job.

**Not synced in v1 — voice notes.** `hvr_voicenotes` is an index into IndexedDB audio blobs
that are megabytes and device-local. Syncing the index alone would list notes the device
cannot play. Kept recordings therefore stay on whichever device received them. Known
limitation, stated in the UI.

**Everything else syncs**, including the one-time migration flags (`hvr_core_v1` and friends)
— those describe a transformation applied to the *data*, not to the device, and a device
missing one would re-run an import over data that has moved on.

## Merge

Field-aware, per store. The data is unusually well suited to this: stats are daily buckets
rather than an event log, SRS records carry a `last` date, and the library, bank and archive
are keyed collections.

| Store | Rule |
|---|---|
| `hvr_library` | Union by word. Both present → earliest `added`, highest `seen`, union of `forms`. |
| `hvr_srs` | Per word **and per side**, take the record with the later `last`; tie → higher `n`. |
| `hvr_stats` | Per day, per field, take the **higher** value. |
| `hvr_bank` | Union by `id`, higher `seen` wins, capped at `BANK_MAX`. |
| `hvr_archive` | Union: `seen` max, `first` earliest, `last` latest. |
| `hvr_convo` | Union by `id`, higher `seen`. |
| `hvr_pathscores` | Per section per lesson, higher `pct`. |
| `hvr_history` | Union by `ts`, newest first, capped at 100. |
| `hvr_struggle`, `hvr_recency` | Per key, higher number. |
| Other objects | Union; on conflict the blob with the later `updated` wins. |
| Scalars (`hvr_shape`, `hvr_lens`, `hvr_speaker`, flags) | Later `updated` wins. |

**Known imprecision, accepted deliberately.** Taking the higher value per stats field
undercounts a day practised on *both* devices — 10 cards on the phone and 5 on the laptop
reads as 10, not 15. Summing would be correct once and then double-count on every subsequent
merge, because the merged total is written back to both devices. Correcting it properly means
tracking stats per device and deriving the display total, which changes a store read by five
functions. Undercounting is the honest direction to err: the audit's own principle is that
the number you'd most want to trust should not be the one quietly inflating itself. The
streak is unaffected, since any practice that day still counts.

## Flow

1. `GET` remote → `{keys, sha, updated}`, or `null` if the file does not exist yet
2. Merge remote into a snapshot of local
3. Apply the merged result locally
4. `PUT` with the `sha`
5. On 409, go to 1 — up to 3 attempts, then give up quietly and try again at the next trigger

## Triggers

Automatic, at natural boundaries: on app open, on finishing a session, and on accepting
pending words. Debounced to at most once a minute, with a manual **Sync now** for the case of
picking up the phone straight after a laptop session. Roughly 2–4 calls a day against a
5,000/hour limit.

Never mid-session: a merge that rewrote `hvr_srs` under a running drill could change the card
on screen.

## Failure handling

Every failure degrades to "carry on working locally, say so quietly". No token → sync is off
and the app is exactly as it is today. No network → skipped, retried next time. API error →
reported in the status line, never a dialog, never blocking. A merge that throws → keep
local, push nothing, report it. `lsSet` already reports quota failure via the Phase 0 alarm.

## Reporting

The nav bar already carries an honest placeholder — *"on this device"* — which the audit
notes is the slot reserved for exactly this. It becomes the real status: last sync time, or
off, or failing.

## Testing

Every merge function is pure — two plain objects in, one out — and gets self-tests, including
the properties that matter most: **merge is commutative** (same result whichever device is
"local"), **idempotent** (merging twice changes nothing), and **never loses a word**. This is
the F12 lesson from the audit applied up front rather than after a bug.

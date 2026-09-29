# Content tools

Run the app's own code in Node against George's real synced state, to see what a content
batch will actually do before it ships. Built for content v6/v7 (2026-09-29); the
`generate-node-content` skill uses these.

**His data never goes in this repo** (it is public). Decode it into a scratch folder and
point `STATE` at it.

```bash
python tools/content/fetch_state.py <scratch>                # writes <scratch>/state_keys.json
export STATE=<scratch>/state_keys.json
```

Every script loads `hebrew-reader.html` (override with `HTML=`) into a `vm` over that
state, in memory only — nothing is written back, nothing syncs. Content comes from
`content/nodes.json` unless `CONTENT=` names another file (use the previous version as
the baseline when checking a new batch).

| script | what it answers |
|---|---|
| `cov.js [extra.json] [out.json]` | For every ranked word in his library: servable sentences vs the rank target (4 / 2 / 1), per-node stock, the thin list. Writes the short rows to `out.json`. |
| `gate.js a.json [b.json …]` | Runs candidates through `learnIngest` item by item in ship order (earlier files count as shipped), then checks each is servable for its `for` word. Prints only what failed and why. |
| `introcov.js [batch.json …]` | Unseen, servable intro sentences for the next words the session will launch. |
| `scenegate.js scenes.json` | `sceneAcceptable` for each pre-written scene against its node, with the words that were not within reach. |
| `vocab.js` | His strong and progressing words with verified forms and the `{UNPROVEN}` mark — what to write from. Writes `vocab.txt` in the working directory. |
| `suspects.js` | Library entries that misroute: prefix+grammar keys, keys that are forms of other keys, grammar words resolving elsewhere. |

Run them from the scratch folder, so candidate files and outputs land there too.

**Check per node, not only per item.** v7's scenes caught a word-matching change that
took the live "Your day — past" place from 30 servable sentences to 0 while every
per-item check passed. `cov.js`'s `nodes` list is the one to compare before and after.

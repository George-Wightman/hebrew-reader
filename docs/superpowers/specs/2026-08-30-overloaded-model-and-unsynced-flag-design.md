# One busy model took the whole commission down, and the flag about it sat on the phone

## Where this came from

George, flagging mid-session:

> Getting HTTP 503 errors when trying to write sentences, what does that mean and can we
> fix?

And then, four hours later, when the flag finally arrived:

> Sorry I realised I submitted a flag but it didnt sync, can we force a sync every time I
> submit a flag

Two bugs, raised together, and the second is why the first took four hours to reach me.
They share a theme: **a failure that should have been survivable took something down with
it.**

Context, from earlier in the same conversation, on why this is being fixed before the
feature it interrupted:

> The sentence idea is still improtant the API just needs fixing first I think

## What the flag actually carried

```
Writing practice sentences for your home, the rooms in it, who lives there
  ok: false    model: ""    ms: 84227    err: HTTP 503
```

Every field is load-bearing.

### `err: HTTP 503` — and where that string comes from

A 503 from Gemini is `"the model is overloaded, try again later"`. Server-side, transient,
and nothing to do with quota, rate limits, or a malformed request. On its own it is a
shrug.

But `"HTTP 503"` is the *exact* string produced by one line in `geminiSend`:

```js
if (resp.status === 400 && cfg) continue;   // the config was the problem — retry plain
throw new Error("HTTP " + resp.status);      // not a quota problem — don't blame the key
```

So a 503 **throws out of all three loops at once** — the config loop, the model loop, and
the key loop. `gemini-flash` being busy killed the entire commission without ever asking
`gemini-flash-lite`, and without ever touching the second key.

That is the same mistake, in the same function, that this file has already fixed once. The
comment sits fifteen lines above the throw:

> *A TIMEOUT IS THIS MODEL FAILING, NOT THE CALL FAILING. Every other failure in this loop
> falls through to the next model and then the next key — that fallback list is the entire
> reason one slow or throttled pool cannot take a feature down.*

A 503 is *more* model-specific than a timeout, not less. "This model is overloaded" is
precisely the case the fallback list exists for. The timeout got the treatment; the 5xx
never did.

### `ms: 84227` — where eighty-four seconds went

`GEN_TIMEOUT_MS` is 45s, so the wall time is not one request. `geminiFetchWithRetry`
retries any 5xx up to `GEMINI_MAX_ATTEMPTS` (3) times:

```js
if (resp.ok || resp.status < 500) return resp;
```

That retry was added deliberately — its comment records a previous live 503 — and the
reasoning is sound for a *blip*. It is wrong for an *overloaded* model, because the remedy
for "this model is busy" is a different model, not the same one 700ms later. Three
attempts against a 45s timeout is up to ~137s per model, and with the writer now split
into three chunks (`WRITE_CHUNK = 8`, shipped yesterday) one commission could spend seven
minutes failing.

Note the interaction: fixing the fall-through **without** touching the retry count would
make this worse, not better — 3 attempts on flash, then 3 on flash-lite, then both again
on key 2. Breadth has to come with a smaller depth.

### `model: ""` — the log cannot say what was tried

`aiLogNote` records `model: (lastGeminiTiming && lastGeminiTiming.model) || ""`, and
`lastGeminiTiming` is stamped **only on success**. So on the failure path the log records
nothing at all about what was attempted — which model, which key, how far down the list it
got.

This is the same class of blind spot as reporting a timeout as "daily free limit reached":
the diagnosis above is reasoned from the throw site, not read off the evidence, and it
should not have had to be.

## Why the flag itself did not sync

`syncRun` has four callers — setup, the manual button, session end, and app open — and
bails early:

```js
if (sessionBusy() && !opts.force) return false;
```

The guard is right, and its stated reason is right: *applying* a merged `hvr_srs` under a
running drill could change the card on screen and the grade about to be written to it.

The flag was stamped ~09:40. `progress.json` read `updated: 10:05` on the first pull and
`13:43` on the second. So it did not go up at session end either — he hit the 503, flagged
it, and closed the tab, so the session never *ended*. It reached GitHub when he next opened
the app, four hours later.

So `{ force: true }` is the wrong fix: it would reintroduce exactly the mid-drill data swap
the guard prevents.

The right one is already latent in the function. `syncRun` **pulls, merges, pushes, and
only then applies** — the apply block carries its own comment saying so ("Applied only
after a successful push"). A flag needs the push half and not the apply half. Those two
halves are already sequential and separable.

## The fix

### Phase 1 — a busy model is survivable

**1. 5xx falls through instead of throwing.** In `geminiSend`, a `>= 500` breaks to the
next model exactly as a timeout does, recording itself in a `lastHttpErr` the way a timeout
records `lastNetErr`. Only when every model on every key has faltered does it throw — and
then it says *"Gemini is overloaded just now"*, not `HTTP 503`, because the first is what
happened and the second is a status code.

**2. Depth drops so breadth can pay.** `GEMINI_MAX_ATTEMPTS` 3 → 2: retry an apparent blip
once, then move to a model that is not overloaded. The next model is a better remedy than a
third attempt at the same one, and this keeps the worst case bounded now that the list is
actually walked.

**3. The failure log says what it tried.** `geminiSend` accumulates the model/key
combinations it attempted; `geminiRequest`'s catch writes them into the log entry's
existing `model` field. `e.model` is read in exactly two places — `aiLogRender` for display
and `flagContext` for capture — both of which take it as an opaque string, so nothing
downstream needs to change.

### Phase 2 — a flag reaches GitHub when he taps it

`syncRun` takes `opts.pushOnly`: it skips the `sessionBusy` bail (safe, because it will not
apply) and skips the local apply block, stamping `sha`/`last` and repainting as usual. The
flag submit handler calls it.

`SYNC_MIN_GAP_MS` is also bypassed — a flag submit is a deliberate act, not the periodic
timer the gap exists to throttle.

## Testing

`geminiSend`'s loop is the part with the branching, and it is reachable with the existing
`withStubFetch` helper. Three cases, each of which fails on the *current* code:

1. **A 503 on the first model falls through to the second and succeeds** — today this
   throws `HTTP 503`.
2. **A 503 on every model and key throws the human message**, not `HTTP 503`, and reports
   after trying every combination rather than stopping at the first.
3. **A 400 still throws immediately** — the fall-through must not swallow a genuinely
   malformed request into a pointless walk of the whole model list.

For Phase 2, `syncRun` is not reachable without stubbing GitHub, and the change is a pair
of conditionals rather than arithmetic. Verified live instead: raise a flag mid-session,
confirm `progress.json` moves within seconds.

## Deferred, with reasons

**Parallelising calls across the two keys.** George suggested it. Real, but not here: the
calls in question are background writers behind `campWarm`, fire-and-forget with nobody
waiting, so parallelism buys latency that is never felt while making failure modes much
harder to reason about. Worth revisiting for the compose feature, where he *is* sitting
there.

**Trying the other key before sleeping on a per-minute 429.** A genuine inefficiency — the
key loop is outermost, so a throttled model sleeps on key 1 while key 2 sits idle. Out of
scope: this spec is about a failure that should have been survivable, and that is a
throughput improvement with no bug behind it. It should be its own change, with the compose
feature's burst profile to size it against.

**Fixed inter-call spacing.** George wondered whether 5/min is really "one every 15s". It
is a sliding window rather than a drip, and more to the point Google already returns
`retry in Ns`, which `rateLimitWaitMs` parses and honours. A fixed interval would slow
every call to solve a problem the server already describes precisely.

**Whether `learnAdjudicate` earns its calls.** Five adjudications across the two flags all
returned `{"said":[]}`. That is George's standing question from the 28h flag and deserves a
real count over the log rather than being folded into an unrelated fix.

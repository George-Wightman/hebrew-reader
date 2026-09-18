# The mic pauses when he does

## Where this came from

Two flags, after the 2026-09-09 duplication fix had shipped.

> **2026-09-17 08:47** — "It did the weird duplication thing again"

Asked for `המיטה בחדר הקטן`, the recogniser was recorded as `המיטה בדרת קטנה המיטה בדלת קטנה`.

> **2026-09-18 23:10** — "There is something seriously wrong and very annoyingly wrong
> with the microphone in the app. There is duplications and it keeps making the
> activation sound over and over if I pause for a second. Sometimes I start speaking
> then need to pause (maybe we add this option) when I stop the mic deactivated think
> I finished, then to app forces it back on again"

Asked for `הדלת של הדירה חדשה`, recorded as `הדאורה דיטו חדש הדירה דיטו חדש`.

## Root cause

Both came from one change: `8b0a28e` (2026-09-08) gave the drill card
`continuous = true` and a restart-on-end loop, so a thinking pause wouldn't end the
attempt.

1. **Duplication.** In continuous mode Chrome on Android appends a fresh snapshot of the
   whole phrase to `e.results` every time it revises its guess. The 2026-09-09 fix
   (`micGrowJoin`) collapsed only a snapshot that was a word-boundary *prefix* of the
   next one. These two were revisions (`בדרת` → `בדלת`, `הדאורה` → `הדירה`), so they
   failed the prefix test and were joined. You can't reliably tell "heard again,
   differently" apart from "said again" with string matching.
2. **The chimes.** Android's speech service still ends a session on silence even in
   continuous mode. Each end started a new session, and on a Pixel every start is a
   system chime. So a pause produced a run of chimes, and the mic switched itself back
   on after he had watched it switch off.

## The fix — his design

The recogniser is always single-shot (`continuous = false`), and a session's transcript is
its **last** result (`micLastResult`). That's the only entry on desktop and the most
recent snapshot on Android. It never restarts itself.

Holding through a pause moves up to the card, and he makes every decision:

- **Say it** starts listening. Words appear live.
- **Pause** (the same button, while listening) stops the session and keeps what it
  heard. If the endpointer hears him stop, the card lands in the same paused state.
- Paused, the card shows what he has said so far. Left to right: **Start over** (small,
  faint warm tint, hardest to reach), **Submit** (the loud one), **Keep going** (small,
  faint teal tint) —
  Keep going starts a new session whose words are added to the end.
  If nothing has been heard yet, it shows only **Try again**.
- Nothing is graded until Submit. Parts are joined with `micJoinParts`: text in order,
  runners-up assembled per part, and confidence taken from the least sure part.

`MIC_HOLD_MAX_MS`, `MIC_HOLD_MAX_RESTARTS`, `micHoldMayContinue` and `micGrowJoin` are
deleted. A paused card holds no microphone, so the backstops against a stuck mic have
nothing left to guard.

The coach dock and the English hear-box mic were already single-shot. Their only change
is that they now read the last result as well, which protects them from the same
snapshot-stacking.

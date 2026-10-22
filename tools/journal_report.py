"""How George has actually been practising, from the app's session journal.

    python tools/content/fetch_state.py <scratch>          # his synced state, OUTSIDE this repo
    python tools/journal_report.py <scratch>/state_keys.json [days]

Reads `hvr_journal` (one row per session since 2026-10-22: which button, how far he got,
each card's kind / clean / seconds / hinted / unready words, and the end-screen feel tap)
and `hvr_stats` (daily totals, older) and prints the picture: which days he practised,
sessions by kind, clean rate and time per card kind, where sessions were abandoned, and
how they felt. Prints nothing personal beyond counts; never writes anything.
"""
import json, sys, time, collections
from datetime import date, timedelta


def load(path):
    keys = json.load(open(path, encoding="utf-8"))
    def get(k, default):
        try:
            v = keys.get(k)
            return json.loads(v) if v else default
        except Exception:
            return default
    return get("hvr_journal", []), get("hvr_stats", {})


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    journal, stats = load(sys.argv[1])
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 28
    today = date.today()
    since = (today - timedelta(days=days - 1)).isoformat()

    print(f"== last {days} days (from {since}) ==")
    cal = []
    for i in range(days):
        d = (today - timedelta(days=days - 1 - i)).isoformat()
        r = stats.get(d) or {}
        cal.append("#" if (r.get("cards") or 0) > 0 else ".")
    print("practice  " + "".join(cal) + "   (# = practised)")
    tot = [stats[d] for d in stats if d >= since]
    cards = sum(r.get("cards", 0) for r in tot)
    clean = sum(r.get("clean", 0) for r in tot)
    sec = sum(r.get("sec", 0) for r in tot)
    on = sum(1 for r in tot if r.get("cards"))
    if cards:
        print(f"days {on}/{days} · cards {cards} · clean {clean / cards:.0%} · "
              f"{sec / 60:.0f} min total · {sec / 60 / max(on, 1):.1f} min per day practised")

    rows = [e for e in journal if e and time.strftime("%Y-%m-%d", time.localtime((e.get("at") or 0) / 1000)) >= since]
    print(f"\n== sessions in the journal: {len(rows)} ==")
    if not rows:
        print("(none yet — the journal started on 2026-10-22)")
        return
    for e in rows[-15:]:
        at = time.strftime("%a %d %b %H:%M", time.localtime(e["at"] / 1000))
        cs = e.get("cards") or []
        n_clean = sum(c[1] for c in cs)
        mins = sum(c[2] for c in cs) / 60
        state = "finished" if e.get("fin") else f"LEFT at {len(cs)}/{e.get('of')}"
        extra = []
        if e.get("gentle"): extra.append("gentle")
        if e.get("away"): extra.append(f"{e['away']}d away")
        if e.get("feel"): extra.append("felt " + e["feel"])
        print(f"  {at}  {e.get('mode') or '?':<22} {state:<16} {n_clean}/{len(cs)} clean · {mins:.1f} min  {' · '.join(extra)}")

    by_mode = collections.Counter(e.get("mode", "").split(":")[0] for e in rows)
    print("\nby kind of session: " + ", ".join(f"{k or '?'} {v}" for k, v in by_mode.most_common()))
    left = [e for e in rows if not e.get("fin")]
    if left:
        at = collections.Counter(len(e.get("cards") or []) for e in left)
        print(f"abandoned {len(left)} of {len(rows)}; after how many cards: " +
              ", ".join(f"{k}×{v}" for k, v in sorted(at.items())))
    feels = collections.Counter(e.get("feel") for e in rows if e.get("feel"))
    if feels:
        print("felt: " + ", ".join(f"{k} {v}" for k, v in feels.most_common()))

    print("\n== by card kind ==")
    agg = collections.defaultdict(lambda: [0, 0, 0, 0, 0])
    for e in rows:
        for c in e.get("cards") or []:
            a = agg[c[0]]
            a[0] += 1; a[1] += c[1]; a[2] += c[2]; a[3] += c[3]; a[4] += 1 if (len(c) > 4 and c[4]) else 0
    for k, a in sorted(agg.items(), key=lambda kv: -kv[1][0]):
        print(f"  {k:<10} {a[0]:>4} cards · clean {a[1] / a[0]:.0%} · {a[2] / a[0]:.0f}s each · "
              f"hinted {a[3] / a[0]:.0%} · held an unready word {a[4] / a[0]:.0%}")

    pos = collections.defaultdict(lambda: [0, 0])
    for e in rows:
        for i, c in enumerate(e.get("cards") or []):
            third = "first third" if i < 5 else "middle" if i < 10 else "last third"
            pos[third][0] += 1; pos[third][1] += c[1]
    print("\nclean by position: " + ", ".join(f"{k} {v[1] / v[0]:.0%}" for k, v in pos.items() if v[0]))


if __name__ == "__main__":
    main()

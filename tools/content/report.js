// The weekly coaching report: what his own data says about how the last few weeks went.
// Spec: docs/superpowers/specs/2026-11-04-learning-evidence-design.md, Phase 5.
//
//   STATE=<scratch>/state_keys.json node tools/content/report.js [weeks=4]
//
// Read by Claude when George asks "how am I doing" — the numbers are the evidence, the
// coaching is the reading of them. Fields added on 2026-11-04 (hd/et/sd/sg/ov/h/id in the
// log, the journal's acts, hvr_wordweek, hvr_coachlog) are simply absent before then, and
// every section says so rather than printing a misleading zero.
const { run } = require('./probe');
const WEEKS = parseInt(process.argv[2], 10) || 4;

const out = run(`(() => {
  const WEEKS = ${WEEKS};
  const L = [];
  const pct = (a, b) => b ? Math.round(100 * a / b) + "%" : "-";
  const day = t => new Date(t).toISOString().slice(0, 10);
  const lib = libAll(), srs = srsAll(), today = todayISO();
  const log = srsLogAll(), journal = journalAll(), stats = statsAll();
  const coach = (typeof coachLogAll === "function") ? coachLogAll() : [];
  const ww = (typeof wordWeekAll === "function") ? wordWeekAll() : {};
  const thisWeek = weekOf(today);
  const weeks = [];
  for (let i = WEEKS - 1; i >= 0; i--) weeks.push(new Date(Date.parse(thisWeek) - i * 7 * 86400000).toISOString().slice(0, 10));
  const inWeek = (t, w) => weekOf(day(t)) === w;
  const en = k => (lib[k] && lib[k].en ? String(lib[k].en).split(/[,;/]/)[0].trim() : "");
  const top = (obj, n) => Object.keys(obj).sort((a, b) => obj[b] - obj[a]).slice(0, n);

  weeks.forEach(w => {
    const W = log.filter(e => inWeek(e.t, w));
    const J = journal.filter(j => j && j.at && inWeek(j.at, w));
    const C = coach.filter(c => c && c.at && inWeek(c.at, w));
    const days = Object.keys(stats).filter(d => weekOf(d) === w && (stats[d].cards || 0) > 0);
    L.push("");
    L.push("=== week of " + w + (w === thisWeek ? " (this week, so far)" : ""));
    if (!W.length && !J.length && !C.length) { L.push("  no practice"); return; }

    /* 1. Practice and how it ended */
    const cards = days.reduce((s, d) => s + (stats[d].cards || 0), 0);
    const clean = days.reduce((s, d) => s + (stats[d].clean || 0), 0);
    L.push("  practice: " + days.length + " days, " + J.length + " sessions, " + cards + " cards, " + pct(clean, cards) + " fully right");
    const left = J.filter(j => !j.fin && (j.cards || []).length);
    if (J.length) L.push("  finished " + (J.length - left.length) + "/" + J.length +
      (left.length ? " — left: " + left.map(j => "card " + j.cards.length + "/" + j.of + " after a " + (j.cards[j.cards.length - 1] || [])[0]).join("; ") : ""));
    const feel = {}; J.forEach(j => { if (j.feel) feel[j.feel] = (feel[j.feel] || 0) + 1; });
    if (Object.keys(feel).length) L.push("  how it felt: " + Object.keys(feel).map(f => f + " " + feel[f]).join(", "));

    /* 2. Accuracy by card type, and by time of day */
    const byKd = {};
    W.forEach(e => { const k = e.kd || "?"; const b = byKd[k] || (byKd[k] = [0, 0]); b[0]++; if (e.g === 2) b[1]++; });
    L.push("  words right, by card: " + Object.keys(byKd).sort((a, b) => byKd[b][0] - byKd[a][0]).map(k => k + " " + pct(byKd[k][1], byKd[k][0]) + " of " + byKd[k][0]).join(" · "));
    const byHr = {};
    W.forEach(e => { const h = new Date(e.t).getHours(); const b = h < 12 ? "morning" : h < 18 ? "afternoon" : h < 21 ? "evening" : "late"; const x = byHr[b] || (byHr[b] = [0, 0]); x[0]++; if (e.g === 2) x[1]++; });
    L.push("  by time of day: " + Object.keys(byHr).map(b => b + " " + pct(byHr[b][1], byHr[b][0]) + " of " + byHr[b][0]).join(" · "));

    /* 3. The mic against him */
    const S = W.filter(e => e.sg === 0 || e.sg === 1 || e.sg === 2);
    if (S.length) {
      const up = S.filter(e => e.ov && e.g > e.sg), down = S.filter(e => e.ov && e.g < e.sg);
      const upW = {}; up.forEach(e => { upW[e.k] = (upW[e.k] || 0) + 1; });
      L.push("  mic suggestions: " + S.length + ", he kept " + pct(S.length - up.length - down.length, S.length) +
             " · raised " + up.length + " (mic too harsh) · lowered " + down.length + " (he was stricter)");
      if (up.length) L.push("    words he raised most: " + top(upW, 6).map(k => k + " ×" + upW[k]).join(", "));
    } else L.push("  mic suggestions: not recorded before 2026-11-04");

    /* 4. Hints */
    const H = W.filter(e => e.h > 0);
    const hW = {}; H.forEach(e => { hW[e.k] = (hW[e.k] || 0) + 1; });
    L.push("  hinted answers: " + pct(H.length, W.length) + (H.length ? " — most: " + top(hW, 6).map(k => k + " ×" + hW[k]).join(", ") : ""));

    /* 5. Kinds of slip, and what he said */
    const E = W.filter(e => e.et);
    if (E.length) {
      const et = {}; E.forEach(e => { et[e.et] = (et[e.et] || 0) + 1; });
      L.push("  slips by kind: " + top(et, 9).map(k => k + " " + et[k]).join(", "));
      const pairs = {};
      E.filter(e => e.hd && e.hd !== "-" && e.et !== "same").forEach(e => { const p = e.hd + " for " + e.k; pairs[p] = (pairs[p] || 0) + 1; });
      if (Object.keys(pairs).length) L.push("    said X for Y: " + top(pairs, 8).map(p => p + (pairs[p] > 1 ? " ×" + pairs[p] : "")).join(" · "));
    } else L.push("  slips by kind: not recorded before 2026-11-04");

    /* 6. Most-missed words */
    const miss = {}, tries = {};
    W.forEach(e => { tries[e.k] = (tries[e.k] || 0) + 1; if (e.g < 2) miss[e.k] = (miss[e.k] || 0) + 1; });
    const mm = top(miss, 8).filter(k => miss[k] >= 2);
    if (mm.length) L.push("  missed or nearly, 2+ times: " + mm.map(k => k + " (" + en(k) + ") " + miss[k] + "/" + tries[k]).join(" · "));

    /* 7. Help-seeking, from the journal's per-card acts */
    const acts = { cb: 0, ca: 0, w: 0, y: 0, r: 0, o: 0 }; let withActs = 0;
    J.forEach(j => (j.cards || []).forEach(c => { const a = c[5]; if (a && typeof a === "object") { withActs++; Object.keys(a).forEach(x => { acts[x] = (acts[x] || 0) + a[x]; }); } }));
    const nCards = J.reduce((s, j) => s + (j.cards || []).length, 0);
    if (J.some(j => (j.cards || []).some(c => c.length > 5)))
      L.push("  on " + nCards + " cards: coach before answering " + acts.cb + ", after " + acts.ca + " · word meanings " + acts.w + " · why " + acts.y + " · replays " + acts.r + " · grades moved " + acts.o);
    else L.push("  help-seeking: not recorded before 2026-11-04");

    /* 7b. Meaning slips: listen cards where the meaning check said his sense was off
       (the journal's 8th element, since 2026-11-09). His words, then the check's note. */
    const slips = [];
    J.forEach(j => (j.cards || []).forEach(c => { const x = c[7]; if (x && typeof x === "object" && x.m) slips.push(x); }));
    const kept = J.reduce((s, j) => s + (j.cards || []).filter(c => c[7] && typeof c[7] === "object").length, 0);
    if (slips.length) {
      L.push("  meaning slips: " + slips.length);
      slips.slice(0, 8).forEach(x => L.push('    "' + x.a + '" -> ' + x.m));
    } else if (kept) L.push("  meaning slips: none (" + kept + " answers kept)");

    /* 8. The coach */
    if (C.length) {
      const he = C.reduce((s, c) => s + c.he, 0), enw = C.reduce((s, c) => s + c.en, 0);
      const words = {}; C.forEach(c => (c.words || []).forEach(k => { words[k] = 1; }));
      const obj = C.reduce((s, c) => s + (c.obj || []).length, 0), hit = C.reduce((s, c) => s + (c.hit || []).length, 0);
      L.push("  coach: " + C.length + " conversations, " + C.reduce((s, c) => s + c.n, 0) + " turns · Hebrew " + pct(he, he + enw) +
             " of his words · " + Object.keys(words).length + " different words of his produced · objectives hit " + hit + "/" + obj);
      const whys = []; C.forEach(c => (c.why || []).forEach(x => whys.push(x)));
      if (whys.length) L.push("    corrections: " + whys.slice(0, 6).map(x => '"' + x + '"').join(" | "));
    } else L.push("  coach: " + (coach.length ? "none this week" : "not recorded before 2026-11-04"));
  });

  /* 9. Word trends across the weeks — the weekly summary where it exists, the log before */
  L.push("");
  L.push("=== word trends over " + WEEKS + " weeks (missed-or-nearly / answers, per week)");
  const grid = {};
  weeks.forEach(w => {
    const fromWW = ww[w];
    if (fromWW) Object.keys(fromWW).forEach(id => { if (id.indexOf("|r") === -1) { const v = fromWW[id]; (grid[id] || (grid[id] = {}))[w] = [v[1] + v[2], v[0]]; } });
    else log.filter(e => e.s === "prod" && inWeek(e.t, w)).forEach(e => {
      const g = grid[e.k] || (grid[e.k] = {}); const c = g[w] || (g[w] = [0, 0]); c[1]++; if (e.g < 2) c[0]++;
    });
  });
  /* Two weeks with answers and at least three answers in all: one answer a week is noise. */
  const answers = k => Object.keys(grid[k]).reduce((s, w) => s + grid[k][w][1], 0);
  const trend = Object.keys(grid).filter(k => Object.keys(grid[k]).length >= 2 && answers(k) >= 3)
    .map(k => { const ws = weeks.filter(w => grid[k][w]); const a = grid[k][ws[0]], b = grid[k][ws[ws.length - 1]];
                return { k: k, first: a[0] / a[1], last: b[0] / b[1], row: weeks.map(w => grid[k][w] ? grid[k][w][0] + "/" + grid[k][w][1] : " . ").join("  ") }; });
  const better = trend.filter(t => t.first - t.last >= 0.34).sort((a, b) => (b.first - b.last) - (a.first - a.last)).slice(0, 8);
  const worse = trend.filter(t => t.last - t.first >= 0.34).sort((a, b) => (b.last - b.first) - (a.last - a.first)).slice(0, 8);
  L.push("  improving: " + (better.length ? "" : "none clear yet"));
  better.forEach(t => L.push("    " + t.k + " (" + en(t.k) + ")  " + t.row));
  L.push("  slipping: " + (worse.length ? "" : "none clear yet"));
  worse.forEach(t => L.push("    " + t.k + " (" + en(t.k) + ")  " + t.row));

  /* 10. Where he stands now */
  const met = Object.keys(srs).filter(k => lib[k] && srs[k].prod && srs[k].prod.n);
  const faded = met.filter(k => srsR(srs[k].prod, today) < REFRESH_R);
  const bands = {}; met.forEach(k => { const b = srsStrengthOf(srs, k, "prod"); bands[b] = (bands[b] || 0) + 1; });
  L.push("");
  L.push("=== now: " + met.length + " words met · " + Object.keys(bands).map(b => b + " " + bands[b]).join(", ") +
         " · probably forgotten (recall < " + REFRESH_R + "): " + faded.length);
  return L.join("\\n");
})()`);
console.log(out);

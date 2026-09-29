// Coverage of ranked words against his real state, with content/nodes.json ingested as the phone would.
const fs = require('fs'), path = require('path');
const P = require('./probe.js');
const repo = path.join(__dirname, '..', '..') + path.sep;
const extra = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : null;
P.ctx.__content = JSON.parse(fs.readFileSync(process.env.CONTENT || (repo + 'content/nodes.json'), 'utf8'));
P.ctx.__extra = extra;
const out = P.run(`(function () {
  const data = __content;
  const kill = new Set((data.retired || []).map(x => String(x && x.he !== undefined ? x.he : x)));
  bankSave(bankAll().filter(b => !(b && b.src === "claude" && kill.has(b.he))));
  const n5 = learnIngest({ items: data.items.map(it => Object.assign({}, it, { src: "claude" })) });
  let nx = null;
  if (__extra) nx = learnIngest({ items: __extra.map(it => Object.assign({}, it, { src: "claude" })) });
  const lib = libAll(), srs = srsAll(), bank = bankPrune(bankAll(), lib);
  const needs = practiceNeeds(lib, srs, todayISO(), {});
  const unp = needs.unproven;
  const want = r => r <= 300 ? 4 : r <= 1000 ? 2 : 1;
  const rows = [];
  FREQ_LEMMAS.forEach((keys, i) => {
    const r = i + 1;
    const k = keys.filter(x => lib[x] && srsGradable(x, lib))[0];
    if (!k) return;
    const st = srsStrengthOf(srs, k, "prod");
    const ready = wordReady(k, srs);
    let have = 0;
    bank.forEach(it => {
      if (it.pend && it.pend.length) return;
      const ws = bankContentWords(it, lib);
      if (keys.every(x => ws.indexOf(x) === -1)) return;
      if (ws.filter(w => unp.has(w)).length > 1) return;
      const ok = ready ? bankServable(it, lib, srs) : bankServable(it, lib, srs, new Set([k]));
      if (ok) have++;
    });
    rows.push({ r: r, k: k, st: st, have: have, want: want(r), tr: lib[k].tr, en: lib[k].en });
  });
  const short = rows.filter(x => x.have < x.want);
  const strong = Object.keys(lib).filter(k => srsGradable(k, lib) && srsStrengthOf(srs, k, "prod") === "strong");
  const intro = introWords(learnTargets(15), srs, 6);
  return JSON.stringify({ ingested5: n5, ingestedExtra: nx, bank: bank.length, ranked: rows.length,
    short: short.length, byStatus: short.reduce((a, x) => (a[x.st] = (a[x.st] || 0) + 1, a), {}),
    missingSentences: short.reduce((a, x) => a + (x.want - x.have), 0),
    level: learnerLevel(), strongN: strong.length, intro: intro,
    nodes: campNodes(campAll()).filter(n => (n.words||[]).length).map(n => n.name + ": " + contentNodeStock(n, bank, lib, srs)),
    thin: contentThinNow(),
    rows: short });
})()`);
fs.writeFileSync(path.resolve(process.argv[3] || 'cov_out.json'), out);
const o = JSON.parse(out);
console.log('errors', P.errs);
console.log(JSON.stringify(Object.assign({}, o, { rows: undefined }), null, 1));

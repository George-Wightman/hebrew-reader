// Run candidate items through the app's own ingest + serving gates, in ship order, against his real state.
// usage: node gate.js cand1.json [cand2.json ...]   (earlier files are treated as already shipped)
const fs = require('fs'), path = require('path');
const P = require('./probe.js');
const repo = path.join(__dirname, '..', '..') + path.sep;
P.ctx.__content = JSON.parse(fs.readFileSync(process.env.CONTENT || (repo + 'content/nodes.json'), 'utf8'));
const files = process.argv.slice(2);
P.ctx.__batches = files.map(f => JSON.parse(fs.readFileSync(path.resolve(f), 'utf8')));
const out = P.run(`(function () {
  const data = __content;
  const kill = new Set((data.retired || []).map(x => String(x && x.he !== undefined ? x.he : x)));
  bankSave(bankAll().filter(b => !(b && b.src === "claude" && kill.has(b.he))));
  learnIngest({ items: data.items.map(it => Object.assign({}, it, { src: "claude" })) });
  const lib = libAll(), srs = srsAll();
  const unp = practiceNeeds(lib, srs, todayISO(), {}).unproven;
  const st = k => srsStrengthOf(srs, k, "prod");
  const lines = [];
  let okN = 0, badN = 0;
  __batches.forEach((batch, bi) => {
    const last = bi === __batches.length - 1;
    batch.forEach((c, i) => {
      const it = Object.assign({ type: "sentence" }, c, { src: "claude" });
      const bank = bankAll();
      const why = [];
      const uses = bankUses(it.he, lib);
      if (!uses.length) why.push("no-uses");
      const unk = bankUnknowns(it.he, lib);
      if (unk.length) why.push("unknown:" + unk.join(","));
      if (bank.some(b => b.he === it.he && (b.type || "sentence") === it.type)) why.push("exact-dup");
      if (bankNearDuplicate(it.he, it.type, bank)) {
        const a = heTokens(it.he);
        const hit = bank.slice(-80).filter(b => b && b.type === it.type && heTokens(b.he).length === a.length &&
          heTokens(b.he).filter((t, j) => t !== a[j]).length <= 1).map(b => b.he)[0];
        why.push("near-dup:" + hit);
      }
      if (bankFrameFull(it.he, bank)) why.push("frame:" + heTokens(it.he).slice(0, 2).join(" "));
      if (heFinalFormsBad(it.he)) why.push("final-forms");
      const before = bankAll().length;
      learnIngest({ items: [it] });
      const banked = bankAll().length > before;
      let serve = "";
      if (banked) {
        const b = bankAll()[bankAll().length - 1];
        const k = it.for;
        const cw = bankContentWords(b, lib);
        const nUnp = cw.filter(w => unp.has(w)).length;
        const ok = (k && !wordReady(k, srs)) ? bankServable(b, lib, srs, new Set([k])) : bankServable(b, lib, srs);
        if (k && cw.indexOf(k) === -1) serve += " NOT-CREDITED(" + k + ")";
        if (!ok) serve += " UNSERVABLE[" + cw.map(w => w + ":" + st(w) + (unp.has(w) ? "*" : "")).join(" ") + "]";
        if (nUnp > 1) serve += " UNPROVEN>1[" + cw.filter(w => unp.has(w)).join(" ") + "]";
      }
      const good = banked && !serve;
      if (last) {
        if (good) okN++; else badN++;
        lines.push((good ? "ok  " : "BAD ") + i + " " + it.he + (banked ? "" : " — REFUSED " + why.join(" ")) + serve);
      }
    });
  });
  lines.push("ok " + okN + " / bad " + badN);
  return lines.join(String.fromCharCode(10));
})()`);
console.log(P.errs.length ? P.errs : '');
console.log(out);

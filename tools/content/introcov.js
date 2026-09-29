// For the next never-drilled words the session will launch, how many unseen carry-servable sentences exist.
const fs = require('fs'), path = require('path');
const P = require('./probe.js');
const repo = path.join(__dirname, '..', '..') + path.sep;
P.ctx.__content = JSON.parse(fs.readFileSync(process.env.CONTENT || (repo + 'content/nodes.json'), 'utf8'));
P.ctx.__batches = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(path.resolve(f), 'utf8')));
console.log(P.run(`(function () {
  const data = __content;
  const kill = new Set((data.retired || []).map(x => String(x && x.he !== undefined ? x.he : x)));
  bankSave(bankAll().filter(b => !(b && b.src === "claude" && kill.has(b.he))));
  learnIngest({ items: data.items.map(it => Object.assign({}, it, { src: "claude" })) });
  __batches.forEach(b => learnIngest({ items: b.map(it => Object.assign({ type: "sentence" }, it, { src: "claude" })) }));
  const lib = libAll(), srs = srsAll(), bank = bankPrune(bankAll(), lib);
  const intro = introWords(learnTargets(15), srs, 20);
  return intro.map(k => {
    const n = bank.filter(it => !it.seen && bankCarried(it, lib, srs, new Set([k])) === k &&
                                bankServable(it, lib, srs, new Set([k]))).length;
    return k + "#" + (FREQ_RANK[k] || "-") + " (" + (lib[k].en || "") + "): " + n;
  }).join(String.fromCharCode(10));
})()`));

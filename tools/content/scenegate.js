// Check pre-written scenes against sceneAcceptable for the node they belong to, on his real state.
const fs = require('fs'), path = require('path');
const P = require('./probe.js');
P.ctx.__scenes = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || 'scenes.json'), 'utf8'));
console.log(P.run(`(function () {
  const c = campAll(), lib = libAll(), srs = srsAll(), NL = String.fromCharCode(10);
  const byName = {};
  campNodes(c).forEach(n => { byName[String(n.name || "").trim().toLowerCase()] = n; });
  return __scenes.map(s => {
    const n = byName[String(s.node).trim().toLowerCase()];
    if (!n) return "NO NODE " + s.node;
    const sc = sceneClean(s);
    const g = sceneAcceptable(sc, n, lib, srs);
    const toks = [];
    sc.lines.forEach(l => l.he.split(/[^֐-׿]+/).filter(Boolean).forEach(t => {
      if (STOPLIST.has(t)) return;
      const bare = bankStripPrefixes(t, lib);
      if (STOPLIST.has(bare)) return;
      const k = libKeyFor(t, lib) || (lib[bare] ? bare : null);
      if (!k) toks.push(t + "?");
      else if (!wordReady(k, srs) && sceneNodeWords(n).indexOf(k) === -1) toks.push(t + "~" + k);
    }));
    return (g.ok ? "ok  " : "BAD ") + s.node + " — " + (g.ok ? g.known + "/" + g.total + " fresh " + g.fresh : g.why) +
      (toks.length ? "   [" + toks.join(" ") + "]" : "");
  }).join(NL);
})()`));

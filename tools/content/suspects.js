const P = require('./probe.js');
console.log(P.run(`(function () {
  const lib = libAll(), srs = srsAll(), NL = String.fromCharCode(10);
  const st = k => srsStrengthOf(srs, k, "prod");
  const out = [];
  // (a) library keys that are a prefix + a grammar word
  out.push("PREFIX+STOPLIST keys:");
  Object.keys(lib).forEach(k => {
    if (STOPLIST.has(k)) return;
    for (let n = 1; n <= 2; n++) {
      const pre = k.slice(0, n), rest = k.slice(n);
      if (rest.length >= 2 && [...pre].every(c => BANK_PREFIXES.indexOf(c) !== -1) && STOPLIST.has(rest)) {
        out.push("  " + k + " (" + lib[k].en + ") " + st(k) + " src=" + lib[k].src); break;
      }
    }
  });
  // (b) library keys that FORM_INDEX says are a form of a different library lemma
  out.push("KEY IS A FORM OF ANOTHER LIB WORD:");
  Object.keys(lib).forEach(k => {
    const fi = formInfo(k);
    if (fi && fi.lemma && fi.lemma !== k && lib[fi.lemma])
      out.push("  " + k + " (" + lib[k].en + ") " + st(k) + " -> " + fi.lemma + " (" + lib[fi.lemma].en + ") " + st(fi.lemma));
  });
  // (c) STOPLIST tokens that resolve to some other library word
  out.push("STOPLIST tokens resolving elsewhere:");
  [...STOPLIST].forEach(t => { const k = libKeyFor(t, lib); if (k && k !== t) out.push("  " + t + " -> " + k); });
  // (d) library keys that are pronoun-prepositions not in STOPLIST
  return out.join(NL);
})()`));

const fs = require('fs'); const P = require('./probe.js');
const out = P.run(`(function () {
  const lib = libAll(), srs = srsAll();
  const needs = practiceNeeds(lib, srs, todayISO(), {});
  const forms = {};
  Object.keys(FORM_INDEX).forEach(f => { const l = FORM_INDEX[f].lemma; if (l && f !== l) (forms[l] = forms[l] || []).push(f); });
  const row = k => k + " (" + (lib[k].tr||"") + ") = " + (lib[k].en||"") + (forms[k] ? "  [forms: " + forms[k].join(" ") + "]" : "") + (needs.unproven.has(k) ? " {UNPROVEN}" : "");
  const st = k => srsStrengthOf(srs, k, "prod");
  const g = Object.keys(lib).filter(k => srsGradable(k, lib));
  const NL = String.fromCharCode(10);
  return "STRONG" + NL + g.filter(k => st(k) === "strong").map(row).join(NL) +
    NL + NL + "PROGRESSING" + NL + g.filter(k => st(k) === "progressing").map(row).join(NL) +
    NL + NL + "STOPLIST: " + [...STOPLIST].join(" ");
})()`);
fs.writeFileSync(require('path').resolve('vocab.txt'), out);
console.log(P.errs, out.length);

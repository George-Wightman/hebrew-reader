const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
function grab(name) {
  const i = src.indexOf('const ' + name + ' = ');
  let j = src.indexOf('{', i), d = 0, k = j;
  for (; k < src.length; k++) {
    const c = src[k];
    if (c === '"') { k++; while (src[k] !== '"') { if (src[k] === '\\') k++; k++; } continue; }
    if (c === '/' && src[k + 1] === '/') { while (src[k] !== '\n') k++; continue; }
    if (c === '/' && src[k + 1] === '*') { k = src.indexOf('*/', k) + 1; continue; }
    if (c === '{') d++;
    if (c === '}') { d--; if (!d) break; }
  }
  return eval('(' + src.slice(j, k + 1) + ')');
}
const DICT = grab('DICT'), DUO = grab('DUO_DICT'), UNITS = grab('DUO_UNITS');
const out = {};
for (const [k, v] of Object.entries(DICT)) { if (k[0] === '@' || !Array.isArray(v)) continue; out[k] = { tr: v[0], en: v[1], src: 'dict' }; }
for (const [k, v] of Object.entries(DUO)) { if (!Array.isArray(v)) continue; if (!out[k]) out[k] = { tr: v[0], en: v[1], src: 'duo' }; }
for (const k in out) { const u = UNITS[k]; if (typeof u === 'number') out[k].unit = u; }
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log(Object.keys(out).length);

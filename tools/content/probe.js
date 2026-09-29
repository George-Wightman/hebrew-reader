// Load hebrew-reader.html's scripts into a vm over George's decoded state. Nothing persists.
const fs = require('fs'), vm = require('vm'), path = require('path');
const HTML = process.env.HTML || path.join(__dirname, '..', '..', 'hebrew-reader.html');
/* His decoded synced state. A path OUTSIDE this repo (it is public) — see README.md. */
if (!process.env.STATE) throw new Error('set STATE to the decoded state_keys.json (outside the repo)');
const keys = JSON.parse(fs.readFileSync(process.env.STATE, 'utf8'));
const store = Object.assign({}, keys);
const html = fs.readFileSync(HTML, 'utf8');
const scripts = [];
html.replace(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g, (m, body) => { scripts.push(body); return m; });
const P = new Proxy(function () {}, {
  get: (t, k) => k === Symbol.toPrimitive ? () => '' : (k === 'length' ? 0 : P),
  apply: () => P, construct: () => P, set: () => true
});
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
  key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; }
};
const ctx = {
  console, localStorage, sessionStorage: localStorage, document: P, window: null,
  navigator: { serviceWorker: P, userAgent: 'node', onLine: false, clipboard: P, mediaDevices: P },
  speechSynthesis: P, SpeechSynthesisUtterance: function () {}, location: { search: '', href: '', hostname: 'localhost', protocol: 'http:' },
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: () => 0, fetch: () => new Promise(() => {}), indexedDB: undefined,
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  addEventListener() {}, removeEventListener() {}, getComputedStyle: () => P,
  Intl, Date, Math, JSON, Promise, Map, Set, URL, URLSearchParams, TextEncoder, TextDecoder,
  atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64'),
  CompressionStream: undefined, DecompressionStream: undefined, Blob: function () {}, FileReader: function () {},
  performance: { now: () => Date.now() }, crypto: require('crypto').webcrypto,
  MutationObserver: function () { return { observe() {}, disconnect() {} }; },
  ResizeObserver: function () { return { observe() {}, disconnect() {} }; },
  IntersectionObserver: function () { return { observe() {}, disconnect() {} }; },
  Audio: function () { return P; }, Image: function () { return P; }, alert() {}, confirm: () => false,
  HTMLElement: function () {}, Element: function () {}, Node: function () {}, Event: function () {},
  CustomEvent: function () {}, KeyboardEvent: function () {},
};
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
let errs = [];
scripts.forEach((s, i) => { try { vm.runInContext(s, ctx, { filename: 'inline' + i + '.js' }); } catch (e) { errs.push(i + ': ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); } });
module.exports = { ctx, store, errs, run: code => vm.runInContext(code, ctx) };
if (require.main === module) {
  console.log('script errors:', errs);
  const code = fs.readFileSync(process.argv[2], 'utf8');
  console.log(vm.runInContext(code, ctx));
}

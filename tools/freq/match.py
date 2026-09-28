"""Step 2: match each FDOSH lemma to the app's dictionary keys (writes auto.json).
Run extract.js first; build.py applies the hand review on top of this."""
import json, csv, sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
S = os.path.dirname(os.path.abspath(__file__))
app = json.load(open(os.path.join(S, "appkeys.json"), encoding='utf-8'))
rows = []
with open(os.path.join(S, "fdosh.tsv"), encoding='utf-8') as f:
    r = csv.reader(f, delimiter='\t')
    next(r)
    for lem, rank, disp, freq, rng in r:
        rows.append((lem, int(rank), float(disp.replace(',', ''))))

FINAL = {'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ'}
UNFINAL = {v: k for k, v in FINAL.items()}
def fin(w):
    if not w: return w
    w = ''.join(UNFINAL.get(c, c) for c in w[:-1]) + FINAL.get(w[-1], w[-1])
    return w
def unf(w):
    return ''.join(UNFINAL.get(c, c) for c in w)

def cands(lem):
    """Likely present / infinitive forms of a past-3ms verb lemma, most typical first."""
    L = unf(lem)
    out = []
    add = lambda w: out.append(fin(w))
    n = len(L)
    if n == 3:
        X, Y, Z = L
        if Z == 'ה':
            add(X + 'ו' + Y + 'ה'); add('ל' + X + Y + 'ות')
        else:
            add(X + 'ו' + Y + Z); add('ל' + X + Y + 'ו' + Z)
            if X in 'ינ' or L in ('הלכ', 'לקח'): add('ל' + Y + Z + 'ת')
    if n == 2:  # hollow: בא, קם, שם
        X, Z = L
        add(L); add('ל' + X + 'ו' + Z); add('ל' + X + 'י' + Z)
    if n == 4 and L[1] == 'י':  # pi'el written with yod: דיבר
        X, Y, Z = L[0], L[2], L[3]
        if Z == 'ה': add('מ' + X + Y + 'ה'); add('ל' + X + Y + 'ות')
        else: add('מ' + X + Y + Z); add('ל' + X + Y + Z)
    if n == 4 and L[0] == 'ה' and L[2] == 'י':  # hif'il: הספיק
        X, Y, Z = L[1], L[3], L[3]
        X, Y = L[1], L[3]
        add('מ' + L[1] + 'י' + L[3]); add('ל' + 'ה' + L[1] + 'י' + L[3])
    if n == 5 and L[0] == 'ה' and L[3] == 'י':  # הרגיש
        add('מ' + L[1:]); add('לה' + L[1:])
    if L.startswith('הת') and n >= 5:  # hitpa'el
        add('מ' + L[1:]); add('ל' + L)
    if L.startswith('נ') and n == 4:  # nif'al
        add(L); add('להי' + L[1:])
    return out

res = []
for lem, rank, disp in rows:
    hit = []
    if lem in app: hit.append(lem)
    for c in cands(lem):
        if c in app and c not in hit: hit.append(c)
    res.append((rank, lem, hit))
json.dump(res, open(os.path.join(S, "auto.json"), 'w', encoding='utf-8'), ensure_ascii=False)
for lim in (500, 1000, 1500, 2000, 3000, 5000):
    sub = [x for x in res if x[0] <= lim]
    print(lim, 'matched', sum(1 for x in sub if x[2]), 'of', len(sub))

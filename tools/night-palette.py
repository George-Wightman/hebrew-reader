"""Give every new stylesheet colour a token and a night value.

WHAT THIS IS FOR. Night mode (2026-09-23) works because every colour written into a CSS
rule in hebrew-reader.html goes through a --c-<day hex> token, defined once in the
"LITERAL PALETTE" :root block and again in the html[data-theme="night"] block below it.
The self-test "night: every stylesheet colour goes through a token" fails the moment a
rule carries a raw colour, because that rule would be the one thing still in day at
midnight.

So after adding a rule with a new colour, run:

    python tools/night-palette.py hebrew-reader.html

It rewrites raw colours in rule bodies to var(--c-...), adds any new token to the day
block, and adds a GENERATED night value for it to the night block. Existing night values
are never touched — several were hand-tuned (see the comment above the palette) and a
regeneration would undo that. Look at what it generated and tune by hand if it matters.

The mapping: paper, washes, borders and pale lines (lightness >= .6) go dark; ink goes
pale; a dark colour with real saturation (a band colour's deeper shade) lifts and keeps
its hue; mid accents lift a little. Shadows and scrims stay dark and get heavier.
Token blocks (:root, the night block) and @font-face are skipped.
"""
import re, sys, colorsys

COL = re.compile(r"#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|"
                 r"rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)")

def norm_hex(h):
    h = h[1:].lower()
    return "".join(c * 2 for c in h) if len(h) == 3 else h

def name_for(lit):
    if lit.startswith("#"):
        return "c-" + norm_hex(lit)
    nums = re.findall(r"[\d.]+", lit)
    al = (nums[3] if len(nums) > 3 else "1").lstrip("0").replace(".", "") or "0"
    return "c-%s-%s-%s-%s" % (nums[0], nums[1], nums[2], al)

def parse(lit):
    if lit.startswith("#"):
        h = norm_hex(lit)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)), 1.0
    n = [float(x) for x in re.findall(r"[\d.]+", lit)]
    return tuple(int(x) for x in n[:3]), (n[3] if len(n) > 3 else 1.0)

def lum(rgb):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(c) for c in rgb)
    return .2126 * r + .7152 * g + .0722 * b

def night(lit):
    rgb, al = parse(lit)
    if al < 1 and lum(rgb) < 0.12:
        return "rgba(0,0,0,%s)" % round(min(0.85, al * 2.2 + 0.05), 2)
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    if l >= 0.6:
        l2, s2 = 0.10 + (1 - l) * 0.6, s * 0.6
    elif l < 0.34 and s > 0.3:
        l2, s2 = min(0.70, l + 0.30), min(1, s * 0.95)
    elif l < 0.34:
        l2, s2 = 0.90 - l * 0.35, s * 0.7
    else:
        l2, s2 = min(0.80, l + 0.18), min(1, s * 1.05)
    r, g, b = (round(c * 255) for c in colorsys.hls_to_rgb(h, l2, s2))
    return ("rgba(%d,%d,%d,%g)" % (r, g, b, al)) if al < 1 else "#%02x%02x%02x" % (r, g, b)

def main(path):
    src = open(path, encoding="utf-8", newline="").read()
    a = src.index("<style>") + len("<style>")
    b = src.index("</style>")
    css = src[a:b]
    found = {}
    edits = []
    for m in re.finditer(r"\{([^{}]*)\}", css):
        head = css[css.rfind("}", 0, m.start()) + 1:m.start()].strip()
        if head.endswith(":root") or head.endswith('html[data-theme="night"]') or head.endswith("@font-face"):
            continue
        body = m.group(1)
        new = COL.sub(lambda mm: (found.setdefault(name_for(mm.group(0)), mm.group(0)),
                                  "var(--%s)" % name_for(mm.group(0)))[1], body)
        if new != body:
            edits.append((m.start(1), m.end(1), new))
    for s0, e0, new in reversed(edits):
        css = css[:s0] + new + css[e0:]
    i = css.index("/* ---- THE LITERAL PALETTE ----")
    d0 = css.index(":root {", i); d1 = css.index("\n  }", d0)
    n0 = css.index('html[data-theme="night"] {', d1); n1 = css.index("\n  }", n0)
    have = set(re.findall(r"--(c-[a-z0-9-]+):", css[d0:d1]))
    added = sorted(k for k in found if k not in have)
    if added:
        day_add = "".join("\n    --%s: %s;" % (k, found[k]) for k in added)
        night_add = "".join("\n    --%s: %s;" % (k, night(found[k])) for k in added)
        css = css[:n1] + night_add + css[n1:]
        css = css[:d1] + day_add + css[d1:]
    open(path, "w", encoding="utf-8", newline="").write(src[:a] + css + src[b:])
    print("%d rule edits, %d new tokens%s" % (len(edits), len(added),
          (": " + ", ".join("%s -> night %s" % (k, night(found[k])) for k in added)) if added else ""))

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "hebrew-reader.html")

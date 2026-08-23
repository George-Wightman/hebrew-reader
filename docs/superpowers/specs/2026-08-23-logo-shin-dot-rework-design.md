# Logo rework: shin-dot instead of underline

## Problem

The app icon ([icons/icon.svg](../../../icons/icon.svg), and its derived `icons/icon-192.png`) draws a faint horizontal line under the ש glyph:

```xml
<line x1="112" y1="410" x2="400" y2="410" stroke="#0d6e6e" stroke-opacity=".18" stroke-width="6" stroke-linecap="round"/>
```

On a phone home screen this reads as a stray or glitched line rather than a deliberate mark — it's the wrong metaphor (looks like underlined text, or a broken render) and it's faint enough to look accidental either way.

## Scope

- **In scope:** `icons/icon.svg` and `icons/icon-192.png` only.
- **Out of scope:** the in-app nav bar wordmark (`.navbrand` — the שלום text next to Learn/Path/Words in `hebrew-reader.html`). It stays exactly as-is: plain teal text, no dot. It already reads unambiguously as a word; the shin-dot only makes sense against the isolated letter.

## Design

Remove the `<line>` entirely. Add a small solid circle in the app's existing gold accent color (`--gold: #b3803a` in `hebrew-reader.html`), sitting **on the baseline, to the right of the ש** — reading as a full stop rather than a diacritic. In RTL, the position to the right of the word is the position *before* it, so the mark reads as ".shalom": one sentence ended, the next about to start.

Rationale:
- A full stop is a mark with an obvious job. The earlier line failed because it had no job the eye could name — it just looked broken.
- Gold is already reserved exclusively for achievement/progress elsewhere in the app (see the `:root` comment in `hebrew-reader.html`: "gold reserved exclusively for achievement... keeping gold for one job is what stops the page turning into decoration"). Reusing it on the icon keeps that rule intact rather than introducing a new color for a new purpose.
- It can't be confused with the nav's teal active-tab underline (`.navbtn.active { box-shadow: inset 0 -2px 0 var(--accent) }`), since it differs in color, shape, and location — that visual echo was part of why the old line read as unintentional.

Geometry, measured against the rendered glyph (David bold at `font-size: 236` in the 512 viewBox). The glyph baseline is y≈309, and the dot is `r="19"` at `cy="293"` so its base rests exactly on that baseline, with a ~16-unit gap after the glyph's right edge.

The pair is optically centred rather than the glyph alone: `<text>` sits at `x="234"` and the dot at `cx="334"`, shifting the whole group 22 units left of where a centred glyph would put it. That gives ink spanning x 163–349 — a group centre of exactly 256. Centring the ש alone would leave the pair leaning ~4% right, which is visible at home-screen size. Both extremes stay well inside the central 80% maskable safe zone (51–461).

## Constraints learned during implementation

Two things bit us and are worth recording:

1. **No `--` inside SVG comments.** A double-hyphen is illegal in XML comments, and Chrome refuses to render the *entire file* with a parse error — it does not degrade gracefully. Writing `--gold` in a comment to name the CSS variable broke the icon completely. Refer to it as "the gold accent" in prose instead. Validate with an XML parser after editing, not just by eye.

2. **Don't rasterize via the browser's canvas.** Exporting the SVG through `canvas.toDataURL()` in the in-app browser injected a 1px vertical artifact (a red-channel-only column) into the PNG. Generate `icon-192.png` with .NET GDI+ from PowerShell instead: render at 512 and downscale to 192 with `InterpolationMode.HighQualityBicubic` **plus `ImageAttributes.SetWrapMode(WrapMode.TileFlipXY)`** — without the wrap mode, bicubic sampling past the edge leaves a semi-transparent 2px border ring (alpha ~220–238).

## Testing

Visual only — no automated tests. Verification steps that actually catch the failures above:

- Parse `icon.svg` with a real XML parser (`[System.Xml.XmlDocument]::Load`), don't just look at it.
- Load `icon-192.png` via `System.Drawing.Bitmap` and assert: every pixel opaque (alpha 255), zero non-paper pixels in the empty region below the glyph, and the dot's lower bound equal to the glyph's lower bound.
- Eyeball the mark at ~40px and ~64px, not just full size — the original problem was only obvious at home-screen scale.

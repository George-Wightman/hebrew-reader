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

Remove the `<line>` entirely. Add a small solid circle in the app's existing gold accent color (`--gold: #b3803a` in `hebrew-reader.html`), positioned at the upper-right stroke of the ש — the position of the real Hebrew *shin-dot* diacritic (the mark that distinguishes ש "shin" from שׂ "sin" in pointed text).

Rationale:
- It's a real diacritic position, not an arbitrary decoration — it reads as authentic to anyone who's seen pointed Hebrew.
- Gold is already reserved exclusively for achievement/progress elsewhere in the app (see the `:root` comment in `hebrew-reader.html`: "gold reserved exclusively for achievement... keeping gold for one job is what stops the page turning into decoration"). Reusing it on the icon keeps that rule intact rather than introducing a new color for a new purpose.
- It can't be confused with the nav's teal active-tab underline (`.navbtn.active { box-shadow: inset 0 -2px 0 var(--accent) }`), since it differs in color, shape, and location — that visual echo was part of why the old line read as unintentional.

Exact dot size/position gets tuned visually against the rendered glyph (David/Times New Roman serif at the icon's font-size) rather than calculated up front — the implementation step should render the SVG and iterate until the dot sits convincingly on the stroke.

## Known follow-up work

`icons/icon-192.png` is a rasterized export of `icon.svg` and needs to be regenerated to match. No SVG→PNG CLI tool (ImageMagick, Inkscape, cairosvg) is available in this environment, so the export mechanism needs to be figured out during implementation — e.g. rendering the SVG in a browser and capturing it at 192×192, or another available path.

## Testing

Visual only — no automated tests. Verify by rendering `icon.svg` in a browser and checking the dot reads as intentional at both large size and shrunk to typical home-screen icon size (~60–80px), then confirm `icon-192.png` matches after regeneration.

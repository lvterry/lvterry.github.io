# Quotes page

Page path is `/quotes.html`. All content lives in `_data/quotes.yml`, newest
first — append a new quote to the top of that list and the page picks it up.

```yaml
- text: "The sentence, with typographic punctuation."
  source: "Author, Year"
```

Note color and tilt come from two `{% cycle %}` tags in `quotes.html`, so
neighbours never repeat; the lists are five long. Adding a sixth note color
means adding `--note-6` (light and dark) in `assets/css/styles.css`.

## Why this layout

Decided from a prototype with five directions (2026-11-25):

- **Pinboard** — pastel notes, taped, slightly rotated, 3-column masonry.
  Chosen: the page reads as a collection someone keeps, not a list someone
  maintains, and the color makes each sentence easy to find again.
- **Margins** — attribution in a left margin, oversized quotes, no surfaces.
  Rejected: beautiful at desktop width, but on a phone it collapses to plain
  stacked text with nothing to carry it.
- **Frames** — a contact sheet of numbered, mounted quotes in a 2-column grid.
  Rejected: an odd quote count always leaves a half-empty last row, and the
  mounts compete with short quotes instead of holding them.
- **Spread** — one display-size opener, the rest in two editorial columns.
  Rejected: it privileges whichever quote happens to be newest, and the
  columns collapse on mobile so the spread only exists on wide screens.
- **Ledger** — numbered ruled rows, author right-aligned, built for scanning.
  Rejected: reads like data. Good when the list is long, wrong for a page
  whose whole job is to be read slowly.

The wall runs wider than the 680px reading column (`main` widens to 1060px)
and there is no visible page banner: the notes are the page, so the wall
carries its own top spacing. The heading survives as a `<h1 class="visually-hidden">`
so the page still has a title for screen readers and search engines. Note ink
is dark on pastel in both themes, so the notes keep their own `--note-*`
values in dark mode instead of inheriting the page tokens.

## The tape strip

Each note's tape is a `::before` in **normal flow**, pulled above the card with
a negative top margin, not an absolutely positioned box. Do not "simplify" it
back to `position: absolute`: inside the masonry's `columns` container Chrome
mis-paints an abs-positioned child — a phantom copy is drawn at the bottom of
the column, clipped to a sliver, which reads as a stray cut-off strip.

Three related details that are load-bearing:

- `display: flow-root` on the card, so the tape's negative margin stays inside
  it instead of collapsing through and moving the whole card.
- The tape reads as matte dispenser-cut adhesive tape rather than a framed
  box: serrated left and right ends are clipped via `clip-path: polygon(...)`,
  while the straight top and bottom factory edges carry subtle `inset`
  hairlines. `--tape-fill` is a warm milky tint layered under faint horizontal
  grain and a gentle diagonal sheen, plus a light `backdrop-filter: blur(1.5px)`
  to soften the card's top edge behind the strip. Pure white does not work
  here: it vanishes over the paper and only shows over a note, which creates a
  cut-off illusion. `:nth-child(4n+...)` and `:nth-child(3n+...)` rules vary
  each strip's length, angle, horizontal shift, and serrated silhouette.
- `@supports not (backdrop-filter)` swaps in `--tape-solid`, a near-opaque
  colour that lands between "tape on paper" and "tape on a note" in both
  themes. It is a plain colour on purpose: browsers old enough to miss
  `backdrop-filter` also miss `color-mix()`, so don't compute it.


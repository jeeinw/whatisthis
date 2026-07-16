# Brand Guideline: McKinsey / Strategy-Consulting Exhibit Style

Derived from visual inspection of three reference slides: a "Supply Chain Strategy"
case-style slide and two McKinsey Global Institute (MGI) exhibits. Use this as one
design-source option for the `pptx` skill when the user asks for a "consulting",
"McKinsey", "MBB", or "executive/strategy deck" look — as an alternative to the
generic palettes listed in `../SKILL.md`.

Hex values below are close visual estimates, not sampled from an official style
guide. If the user has exact corporate hex codes, prefer those and keep this
file's structure/rules.

## When to reach for this style
- Strategy/consulting decks, board or executive presentations
- Slides whose main job is to prove one argument with data (not just inform)
- Any request mentioning "McKinsey style", "MBB style", "exhibit", or "case slide"

## Color Palette

| Role | Hex | Usage |
|------|-----|-------|
| Deep Navy (primary) | `0B1F3A` | Darkest category block, title-slide backgrounds, emphasis |
| Corporate Blue (anchor) | `1F4E96` | Section header bars, headline accents, current-step highlight |
| Mid Blue | `2E7BC2` | Secondary category block, chart series 2, links/keywords in body text |
| Pale Blue | `9DC3E6` | Lightest category block, subtle fills, low-emphasis chart series |
| Chart Gray Dark | `4A4F54` | Primary bar/column series ("low case", base value) |
| Chart Gray Light | `A6A9AC` | Secondary bar/column series ("high case", delta value) |
| Card Background | `F2F3F4` | Content card / box fills |
| Border / Rule | `D9D9D9` | Thin dividers, table borders |
| Body Text | `1A1A1A` | Default text |
| Caption / Footnote | `767676` | Footnotes, source lines, small captions |
| Background | `FFFFFF` | Slide background — always white, never dark, for content slides |

Dominance rule: white background + black body text carry the page; Corporate Blue
is the one accent used for headers, emphasis words, and highlights. Navy/Mid/Pale
blue are reserved for category color-coding (e.g. tagging rows or sections that
belong to the same group), not decoration.

## Typography

| Element | Font | Size | Weight/Color |
|---------|------|------|--------------|
| Exhibit label (e.g. "Exhibit 3") | Georgia or Cambria (serif) | 11-12pt | Regular, `767676` |
| Slide title / governing thought | Georgia (serif) or Arial Bold | 22-26pt | Bold, `1A1A1A` (or `1F4E96` for the topic word) |
| Section header bar text | Arial | 14-16pt | Bold, `FFFFFF` on `1F4E96` fill |
| Body / bullets | Arial or Calibri | 12-14pt | Regular, `1A1A1A` |
| Data labels on charts | Arial | 11-12pt | Bold, matches series color or `1A1A1A` |
| Caption / footnote / source | Arial | 8-9pt | Regular italic, `767676` |
| Logo / attribution wordmark | Georgia (serif) | 12-14pt | Bold, `1A1A1A` |

Font pairing: serif for the exhibit label + governing-thought title (gives the
"institutional report" feel), clean sans (Arial/Calibri) for everything else —
body, data, section bars.

## The Governing Thought (most important rule)

Every slide title is a **full-sentence claim**, not a topic label:

- ✅ "Seven value drivers could enable cloud to deliver more than $1 trillion in 2030 EBITDA value"
- ✅ "Basset should adopt sustainable sourcing and manufacturing practices to assist the growth of NPD"
- ❌ "Cloud Value Drivers"
- ❌ "Supply Chain Strategy Overview"

Put the topic label (small, gray, serif, e.g. "Exhibit 3" or a section name) above
the governing thought, and the governing thought itself in bold as the real title.

## Layout Patterns

1. **Header block**: topic label (optional) → bold governing-thought title (1-2 lines) →
   optional smaller regular-weight subtitle giving units/metric context (e.g.
   "Estimated 2030 EBITDA run-rate impact, $ billion").
2. **Category color-coding**: when content groups into categories, tag each group
   with a colored block/tab (Deep Navy → Mid Blue → Pale Blue, dark-to-light in
   order of the categories) placed to the left of the rows it covers, spanning
   their combined height. Pair with numbered circles for individual rows/steps.
3. **Header divider rule**: a thin (1-1.5pt) full-width Corporate Blue rule
   directly below the header block, separating title from body. This is a
   structural section boundary specific to this style — it overrides the
   generic "never use accent lines under titles" advice in `../SKILL.md`,
   which targets decorative lines with no structural purpose.
4. **Section header bars**: solid Corporate Blue rectangle, white bold text,
   left-aligned, full content-column width, one per major content section.
5. **Comparison rows**: instead of a plain data table, use a thin horizontal bar
   or dot-and-line indicator per row when comparing 2 options across criteria —
   reserve heavy grid tables for exact figures only.
6. **Charts**: horizontal or vertical bar, 2 series max in Chart Gray Dark /
   Chart Gray Light (or Navy/Blue when tied to category color-coding), data
   labels placed directly at the bar end — no legend needed for a single series,
   minimal or no gridlines, no chart border.
7. **Footer**: thin `D9D9D9` rule, then numbered footnotes and a "Source:" line
   in Caption gray, then attribution (logo wordmark or firm name) bottom-left.
   Optional: a full-width section breadcrumb bar (e.g. "Situational Analysis |
   Topline Strategy | Execution | Roadmap | Financial Allocation") with the
   current section highlighted in Corporate Blue — use for decks with a fixed
   multi-section structure.

## Explicitly avoid
- Gradients, drop shadows heavier than a subtle card lift, rounded "bubbly" shapes
- More than 2 data-series colors per chart
- Centered body text (only titles may center)
- Decorative accent lines under titles that don't correspond to structure
- Playful/rounded fonts — this style reads as precise and institutional

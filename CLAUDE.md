# whatisthis

Static font showcase page for 나눔스퀘어ac (NanumSquare_ac). `index.html` +
`nanumsquare_ac.css` + bundled font files (`.ttf`/`.eot`/`.woff`/`.woff2`).
No build step.

## Subagents

- `researcher` (`.claude/agents/researcher.md`) — read-only research subagent
  for codebase/git-history/web/MCP-resource investigation. Never modifies
  files. Multi-round search, primary sources, cross-verification (model: opus).
- `organizer` (`.claude/agents/organizer.md`) — turns research into a
  MECE/pyramid-principle outline. Structure only, no prose (model: sonnet).
- `writer` (`.claude/agents/writer.md`) — turns an outline into finished
  copy, checked against `references/anti-ai-tells.md`. No layout/design
  (model: opus).
- `designer` (`.claude/agents/designer.md`) — turns a draft into a styled
  HTML report (via the `frontend-design` skill) or slide deck (via the
  `pptx` skill), then visually QAs its own output (model: sonnet).

### Marketing content pipeline

These four subagents form a sequential content pipeline — each stage's
output is the next stage's input:

```
topic → [researcher] → research notes
      → [organizer]  → structured outline (MECE/pyramid)
      → [writer]     → finished draft
      → [designer]   → styled HTML or slide deck
      → [pdf skill]  → final PDF (main thread, not a subagent)
```

The last step (PDF conversion + quality check) is deliberately a **skill**
invoked directly by the main thread, not a subagent — packaging/conversion is
procedural knowledge, not a role that benefits from its own context.

## Skills

- `pptx` (`.claude/skills/pptx/`) — vendored from
  https://github.com/anthropics/skills (skills/pptx). Use for any task that
  creates, reads, or edits a `.pptx` file.
  - **Design sources**: besides the generic palettes in `SKILL.md`, this repo
    has `pptx/brand-guidelines/mckinsey-consulting.md` — a consulting/McKinsey-
    exhibit style (governing-thought titles, navy/blue category color-coding,
    minimal gray bar charts). Offer it as an option whenever the user asks for
    a "consulting", "McKinsey/MBB", "executive", or "case study" style deck.
- `frontend-design` (`.claude/skills/frontend-design/`) — vendored from
  https://github.com/anthropics/skills (skills/frontend-design). Aesthetic
  direction/typography/layout guidance for building a distinctive, non-
  templated UI or web page. Used by the `designer` subagent for HTML-report
  deliverables.
- `pdf` (`.claude/skills/pdf/`) — vendored from
  https://github.com/anthropics/skills (skills/pdf). Read/create/merge/split/
  watermark/OCR PDFs. Used as the final "Publisher" step of the marketing
  pipeline to produce and quality-check the delivered PDF (pair with
  `soffice`/Playwright for HTML-or-pptx-to-PDF rendering, since this skill's
  own libraries — pypdf/reportlab — don't render arbitrary HTML).

## References

- `.claude/references/anti-ai-tells.md` — how to prompt for output (prose,
  slides, code) that doesn't read as AI-generated: banned vocabulary/phrases,
  structural tells, and domain-specific rules. Consult before writing any
  substantial user-facing text or slide content, or when asked to make
  something sound "less AI" / more natural.

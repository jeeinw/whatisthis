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

These four subagents form a sequential content pipeline, orchestrated by the
main thread — no subagent calls another subagent directly, and each handoff
happens through a **fixed file in one working directory**, not through
copy-pasted text in a prompt:

```
working dir, e.g. content/<slug>/
  01-research.md   <- main thread writes this (see note below)
  02-outline.md    <- organizer writes this
  03-draft.md      <- writer writes this
  04-design.html   <- designer writes this (or 04-design.pptx)
  05-final.pdf     <- main thread produces this via the pdf skill
```

```
topic → [researcher] → text report (returned to caller, not a file)
      → main thread saves that report as 01-research.md
      → [organizer]  reads 01-research.md, writes 02-outline.md
      → [writer]     reads 02-outline.md,  writes 03-draft.md
      → [designer]   reads 03-draft.md,    writes 04-design.html/.pptx
      → main thread runs the pdf skill on 04-design.* -> 05-final.pdf
```

**Important asymmetry**: `researcher` has no `Write` tool by design (it's a
shared, read-only general-purpose agent, not pipeline-specific) — it only
returns its findings as text to whoever invoked it. The main thread is
responsible for persisting that text to `01-research.md` before invoking
`organizer`. `organizer`, `writer`, and `designer` do have `Write`/`Edit` and
write their own handoff file directly.

Each subagent's prompt must state the working directory explicitly (e.g.
"working dir: `content/nanumsquare-launch/`, read `02-outline.md`, write
`03-draft.md`") — the agents are told to ask rather than guess if it's
missing. The final PDF step is a **skill**, not a subagent: packaging/
conversion is procedural knowledge, not a role that benefits from its own
context.

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

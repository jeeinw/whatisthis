# whatisthis

Static font showcase page for 나눔스퀘어ac (NanumSquare_ac). `index.html` +
`nanumsquare_ac.css` + bundled font files (`.ttf`/`.eot`/`.woff`/`.woff2`).
No build step.

## Subagents

- `researcher` (`.claude/agents/researcher.md`) — read-only research subagent
  for codebase/git-history/web/MCP-resource investigation. Never modifies files.

## Skills

- `pptx` (`.claude/skills/pptx/`) — vendored from
  https://github.com/anthropics/skills (skills/pptx). Use for any task that
  creates, reads, or edits a `.pptx` file.
  - **Design sources**: besides the generic palettes in `SKILL.md`, this repo
    has `pptx/brand-guidelines/mckinsey-consulting.md` — a consulting/McKinsey-
    exhibit style (governing-thought titles, navy/blue category color-coding,
    minimal gray bar charts). Offer it as an option whenever the user asks for
    a "consulting", "McKinsey/MBB", "executive", or "case study" style deck.

## References

- `.claude/references/anti-ai-tells.md` — how to prompt for output (prose,
  slides, code) that doesn't read as AI-generated: banned vocabulary/phrases,
  structural tells, and domain-specific rules. Consult before writing any
  substantial user-facing text or slide content, or when asked to make
  something sound "less AI" / more natural.

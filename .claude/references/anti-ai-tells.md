# Avoiding "AI-Generated" Tells

A reference for prompting an AI (or self-checking your own output) so writing,
slides, or code don't read as obviously AI-generated. General principle first,
then domain-specific banned patterns — combining both works better than either
alone.

## General principle

Genericness, symmetry, and unearned decoration are the underlying tell across
every domain. If a sentence, slide, or line of code would fit unchanged into a
completely different document on a different topic, it's generic — rewrite it
with something specific to this content, or cut it.

## Prose

**Banned vocabulary** (state explicitly — a concrete list works better than
"sound human"): delve, tapestry, boundaries, leverage, harness, unlock,
paradigm, landscape, multifaceted, testament, pivotal, robust, seamless,
cutting-edge, game-changer, underscore(s), meticulous, realm.

**Banned stock phrases**: "in today's fast-paced/ever-evolving world", "it's
important to note", "in summary/conclusion" as a section opener, Moreover/
Furthermore used as connective filler rather than earned logic.

**Structural tells**:
- Restating the question before answering, or summarizing what was just said
- Forced enthusiasm / unearned praise ("Great question!")
- Rule-of-three lists and symmetrical paragraph rhythm (same sentence count
  per section) when the content isn't genuinely three-part
- Uniform sentence length throughout
- Heavy em dash / en dash use in prose
- Converting reasoning into bullet lists when prose would read better

**Prompt instructions that counter these**:
- "Never use: [banned word list]."
- "Don't restate the question. Don't summarize what you just said. Skip
  throat-clearing intros and wrap-up paragraphs."
- "Vary sentence length aggressively. Avoid symmetrical rule-of-three
  structures unless the content is genuinely three-part."
- "Let ideas connect without 'moreover/furthermore/it's worth noting.' If a
  transition isn't earned, delete it."
- "No em dashes or en dashes in prose."
- "Prefer concrete, specific details (numbers, named things, real examples)
  over generic abstractions."
- "No forced enthusiasm, no unearned praise, no hedge-everything qualifiers."
- Best results come from pairing bans with a **voice sample** — a short
  passage of the tone/style wanted — not just a list of prohibitions.

## Slides / decks

Already covered in `.claude/skills/pptx/SKILL.md` (see "Avoid" section) and
`.claude/skills/pptx/brand-guidelines/mckinsey-consulting.md`:
- Accent line under the title is a hallmark of AI-generated slides — use
  whitespace or background color instead, not a decorative rule (an
  exception is carved out in the McKinsey brand guideline for a *structural*
  full-width divider under the whole header block, which is different from a
  decorative line hugging the title text)
- Don't default to generic blue / give every color equal weight
- Don't repeat the same layout across slides
- Don't make text-only bullet slides
- Don't skimp on title/body size contrast
- Keep spacing consistent (pick 0.3" or 0.5" gaps, not mixed)

## Code

- Comments that state the obvious (`// increment counter`)
- Generic placeholder-style names (`dataArray`, `tempVar`, `handleClick2`)
- Unnaturally uniform formatting with no stylistic variation
- (See also this project's own CLAUDE.md guidance: prefer no comments unless
  they explain non-obvious WHY, not WHAT.)

## Sources

- https://medium.com/learning-data/words-and-phrases-that-make-it-obvious-you-used-chatgpt-2ba374033ac6
- https://aisdr.com/blog/words-to-avoid-so-you-dont-sound-like-ai/
- https://theconversation.com/chatgpt-is-changing-the-way-we-write-heres-how-and-why-its-a-problem-239601
- https://www.context-link.ai/blog/claude-em-dash-remover
- https://writerush.ai/how-to-prompt-ai-to-write-like-human/
- https://dev.to/unknown_destroyer_f353870/why-ai-generated-code-feels-weird-1bd2

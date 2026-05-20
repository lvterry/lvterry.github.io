# Robust Minimal Editorial Design System

This site is a quiet personal archive. The design should make writing easy to read, links easy to follow, and pages hard to break. Prefer restraint, consistency, and speed over decoration.

## Principles

- Keep the site text-first. Layout should support reading, not announce itself.
- Use system fonts only. Do not add hosted font dependencies.
- Keep one narrow reading column for writing pages. Use wider layouts only when the content needs a grid, such as music covers.
- Do not restore a persistent header navigation unless the information architecture changes. The header is a brand mark and note.
- Avoid heavy cards, gradients, shadows, and decorative motion. Use spacing, type, and 1px borders for hierarchy.
- Preserve GitHub Pages compatibility. No build pipeline beyond Bundler and Jekyll.

## Tokens

The global design system lives in `assets/css/styles.css`.

- Colors use semantic variables: background, text, weak text, links, borders, surfaces, code, focus, and modal colors.
- Typography uses the system sans stack and a monospace stack for dates, labels, code, and compact metadata.
- Spacing uses `--space-1` through `--space-7`; new rules should use these tokens unless a component has a specific fixed-format need.
- Radius tokens stay small: the site should feel editorial, not app-like.
- Dark mode must be defined by changing variables only where possible.

## Layout Patterns

- Use `.container` for normal pages and post content.
- Use `.page-shell` for static pages and `.article-shell` for posts.
- Use `.page-banner`, `.section-kicker`, `.page-title`, and `.page-lead` for static page intros.
- Use `.post-card` for homepage entries and `.post-panel` for post detail pages.
- Use `.post-panel--untitled` for snippet-style posts with `hide_title_in_list: true`.
- Keep `.music-page` and `.music-modal` styles scoped in `assets/css/music.css`, but rely on global tokens.

## Content Robustness

- Long English URLs and mixed Chinese/English text must wrap without horizontal scrolling.
- Images, iframes, code blocks, and embedded media must stay within the reading column.
- Blockquotes should use the shared left-border treatment across homepage snippets, posts, and quotes.
- Keyboard focus must be visible on links, buttons, inputs, and music controls.
- Respect reduced-motion preferences for transitions and animations.

## Verification

Before shipping design changes:

- Run `bundle exec jekyll build`.
- Check homepage, a normal post, a titleless snippet post, quotes, recommendations, AI usage, and music.
- Check narrow mobile, the 700px breakpoint, and desktop.
- Confirm dark mode readability, visible focus states, no horizontal scrolling, and no overflow from embeds or long links.


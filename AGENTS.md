# Agent Notes

Personal Jekyll site for Terry Wang, deployed via GitHub Pages to `www.wangyazhou.com`.

## Stack & Build

- **Jekyll** with `github-pages` gem (GitHub Pages native build — no custom CI).
- **Plugins:** `jekyll-feed`, `jekyll-paginate`.
- **Timezone:** `Asia/Shanghai`.
- **Pagination:** 20 posts per page.
- **Local dev:** `bundle exec jekyll serve` (use `bundle exec` — Jekyll version is managed by Bundler).
- **No tests, no linter, no typechecker.** Verify by building and visually checking `_site`.

## File Layout

| Directory | Purpose |
|-----------|---------|
| `_posts/` | Blog posts. Filename format: `YYYY-MM-DD-slug.md`. |
| `_layouts/` | `default.html` (shell), `post.html` (standard post), `no-title-post.html` (hides H1 title). |
| `_includes/` | `header.html`, `footer.html`, `open-embed.html`. |
| `_data/` | `music.yml` (track metadata), `companies.yml`, `nav.yml`. |
| `assets/` | `css/styles.css`, `css/music.css`, `js/music.js`, `imgs/`, `8bit.png`. |
| `v1/` | Old site version. Leave as-is unless explicitly asked. |

## Post Conventions

- Front matter keys agents should know:
  - `layout: post` (or `no-title-post` to suppress the article title).
  - `categories: essay` (or `story`, etc.).
  - `hide_title_in_list: true` — omit title on the homepage stream (rare).
  - `content_class: foo` — added to the post-content wrapper for custom CSS.
- **Auto-embed:** `open-embed.html` is included on every post page. Any bare paragraph containing only a YouTube/Vimeo URL or `.mp3` link is auto-converted to an iframe/audio player. If you want a raw URL, wrap it in something other than a bare `<p>`.

## Music Page (`music.html`)

- Data source: `_data/music.yml`.
- Cover images: square, min 600×600px, stored in `assets/imgs/music/`.
- Audio files: hosted on Cloudflare R2; keep URLs in `music.yml`.
- `music.html` injects `TRACKS` as JSON for `assets/js/music.js`.

## Static Pages

- `index.html` — homepage with `paginator.posts` loop.
- `ai.html`, `quotes.html`, `recommendations.html`, `music.html` — static Jekyll pages using `layout: default`.
- `time.html` — **standalone HTML file** (no Jekyll layout). Edit it directly; do not add front matter.
- `feed.xml` — custom RSS template (not the plugin-generated feed).

## Gotchas

- Do not commit `_site/`, `.sass-cache/`, `.jekyll-cache/`, `.jekyll-metadata`, `.bundle/` (all in `.gitignore`).
- Google Analytics tag `G-Y1WFFLTVGB` is hardcoded in `default.html`, `post.html`, and `no-title-post.html`. Update in all three if changing.
- `CNAME` contains `www.wangyazhou.com`. Keep it for GitHub Pages custom domain.
- Copyright year in layouts is hardcoded as `2012 – 2026`. Bump when needed.

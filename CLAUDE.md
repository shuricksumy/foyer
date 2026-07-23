# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

A static, no-build homelab start page — plain HTML/CSS/vanilla JS served directly by a web server
(e.g. reverse-proxied via Traefik/nginx). No package.json, build tool, linter, or test suite, and
nothing to install/compile — edit a file and reload the browser tab. Config parsing (`js-yaml`,
vendored in `js/vendor/`) is the only third-party dependency, and it runs in-browser.

All content — the list of self-hosted services, their icons, and how each one's URL is built — lives
in YAML config files, not in the HTML. This replaced an earlier pair of hand-edited static sites
(`web_admin/`, `web_home_assistant/`) that duplicated the same Bootstrap/jQuery sidebar template
across two folders and required editing raw HTML/inline-SVG to add or change a service; both are gone
now, fully superseded by this app.

## Architecture

HTML entry pages at the repo root share one engine (`js/app.js`, `css/style.css`, `icons/`), each
pointing at its own config file via `<body data-config="...">` (read in `app.js`'s `init()`, defaults
to `config.yaml` if the attribute is absent):

| Page | Config | Tracked in git? | Scope |
|---|---|---|---|
| `index.html` | `config.yaml` | **yes, public** | sanitized example — no real domains/services |
| `everything.html` | `config.everything.yaml` | no, `.gitignore`d | real setup, everything merged |
| `admin.html` | `config.admin.yaml` | no, `.gitignore`d | real setup, network/infra only |
| `home.html` | `config.home.yaml` | no, `.gitignore`d | real setup, media/home-automation/AI |

**This repo is public.** `index.html`/`config.yaml` is the only profile meant to be world-readable —
it must stay a generic example (placeholder `example.com`-style domains, no real hostnames/personal
name/service topology). `.gitignore` is a whitelist, not a blocklist: every `*.html`/`*.yaml`/`*.yml`
at the repo root is private by default, with `index.html`/`config.yaml`/`docker-compose.yml`
explicitly negated back in. Don't add real data to `config.yaml`, and don't remove or weaken those
`!`-negation lines. A new *private* profile needs zero `.gitignore` changes (already covered by the
blanket rule); a new *public* one needs an explicit `!/filename` line plus the same sanitization
discipline as `config.yaml`.

Each config is a flat schema: `groups:` → `items:`, plus a few top-level keys (`title`, `theme`,
`clock`). Every field is documented inline in `config.yaml`'s header comment — read that before
editing, it's the source of truth, not this file. Briefly:

- **URL building** (`link.type: domain | path | port` in `js/app.js`'s `buildUrl()`) resolves each
  service's URL relative to *this page's own* `window.location` at click time — `path` resolves
  against the current origin (for Traefik-proxied services), `port` swaps in a port on the current
  hostname (for LAN-only services), `domain` is used as-is. This means the same config works whether
  the page is loaded via a public domain or a bare LAN IP.
- **`embed: true`** loads the service into the in-page iframe pane (`selectItem()`); **`embed: false`**
  opens a new tab instead, for anything that sends `X-Frame-Options`/CSP headers blocking iframing
  (Home Assistant, Immich, Nextcloud, etc.) — there's no way to detect that from the browser, so it's
  always a manual per-service choice.
- **`dashboard: <number>`** puts an item on the home grid (`renderDashboardGrid()`) at that fixed
  sorted position — a position, not just on/off, so an item stays in the same grid cell regardless of
  config reordering elsewhere.
- **Icons** default to `icons/*.svg` (one file per icon in use, referenced via `icon: local:name`) —
  added specifically so a wrong/missing icon is "overwrite the file" instead of "hunt for the right
  slug on a remote icon set." `sh:`/`mdi:`/`si:` prefixes (resolved live against selfh.st/MDI/Simple
  Icons CDNs, see `resolveIcon()`) still work for anything not yet saved locally. Icons get an
  automatic contrast-backing chip (`checkIconContrast()`, canvas-sampled) when their color is too
  close to the current theme's background — don't hand-add backgrounds/borders to fix a specific
  icon, that logic already handles it per-theme.

Folded-sidebar group flyouts (`openFlyoutFor()`/`closeFlyout()`) reparent the actual `<ul
class="item-list">` DOM node to `<body>` with `position: fixed` while open, rather than positioning it
absolutely in place — overflow clipping from the sidebar's scroll container applies to descendants
regardless of position:absolute/fixed, so only actually leaving that DOM subtree escapes it. It's
moved back into its `.group` on close. Don't "simplify" this back to absolute positioning; it was
tried and clips invisibly.

The mobile sidebar (`≤720px`, see the `@media` block in `css/style.css`) is a full-width overlay
drawer, not a squeeze-the-content layout — it needs the backdrop (`#sidebarBackdrop`) and
auto-close-on-select (`closeMobileDrawer()`) it already has, or it silently traps clicks behind an
undismissable overlay (this happened once; keep both in place when touching sidebar-toggle code).

## Making changes

- Add/remove/reorder services: edit the relevant `config*.yaml` — no HTML/JS changes needed for
  ordinary content changes.
- Add a new icon: save an SVG as `icons/<name>.svg`, reference it as `icon: local:<name>`.
- Since there's no build/test tooling, verify UI changes by serving the folder (e.g.
  `python3 -m http.server 8091`) and checking in a real browser — `fetch()` of the YAML config can be
  blocked under `file://`, so don't rely on double-clicking the HTML file to test.

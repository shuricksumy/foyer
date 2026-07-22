# foyer

A config-driven homelab start page — the entryway to every self-hosted service you run.

**[Live demo](https://raw.githack.com/shuricksumy/foyer/main/index.html)** — runs `index.html`
straight from the repo's raw files via [githack](https://raw.githack.com/), no hosting/build step or
GitHub Pages setup required; it always reflects whatever's on `main`. Swap `raw.githack.com` for
`rawcdn.githack.com` (a jsdelivr-backed, cached version of the same thing) for a stable link to share
rather than a live-editing one. `config.yaml` is a sanitized example config — your real setup goes in
the gitignored private profiles (see **Profiles** below), which never get pushed.

Sidebar of self-hosted services, click one and it loads into a pane on the right without leaving
the page — no separate tab to lose track of. Content (services, icons, grouping, URL rules) lives
entirely in YAML config files, not HTML, so adding or changing a service is a config edit, not
markup surgery.

No build step. Static HTML/CSS/vanilla JS, `js-yaml` vendored locally (`js/vendor/`) for parsing the
config in the browser. Serve this folder however you'd serve any static site (Traefik/nginx, no
special config needed) — or for local testing:

```sh
python3 -m http.server 8091
# open http://localhost:8091
```

## Profiles

Entry pages share this same app/css/icons, each pointing at its own config file via
`<body data-config="...">`:

| Page | Config | Tracked in git? | Scope |
|---|---|---|---|
| `index.html` | `config.yaml` | yes — public | sanitized example, safe to share/demo |
| `everything.html` | `config.everything.yaml` | **no** — gitignored | your real setup, everything merged |
| `admin.html` | `config.admin.yaml` | **no** — gitignored | your real setup, network/infra only |
| `home.html` | `config.home.yaml` | **no** — gitignored | your real setup, media/home/AI |

Only `index.html`/`config.yaml` are meant to be public — everything else in `.gitignore` holds real
domains/ports/service names and stays local-only, never pushed. To add another private profile: copy
`index.html`, point its `data-config` at a new config filename, and add both filenames to
`.gitignore`. To add a *public* one instead, do the same but leave it out of `.gitignore` — just make
sure its config doesn't contain anything you don't want visible to anyone who can see the repo.

Sidebar-collapsed and theme preferences are shared across all profiles (same browser,
same localStorage) since that's a per-visitor UI preference, not part of any one profile.

## Changing content

Edit `config.yaml` (or any of the private profile configs) — comments in that file explain each
field. Refresh the browser tab, no restart needed. In short, each item needs:

- `link.type: domain | path | port` — how to build its URL relative to wherever this page
  itself is loaded from (mirrors the old `data-localip` trick, generalized: `path` resolves
  against this page's own origin for Traefik-proxied services, `port` swaps in the port on
  this page's own hostname for LAN-only services, `domain` is used as-is).
- `embed: true` — clicking loads the service into the right-hand pane, page stays open.
  `embed: false` — opens in a new tab instead (use for anything that blocks iframing,
  e.g. Home Assistant, Immich, Nextcloud — there's no reliable way to detect that
  automatically, it has to be set per service).
- `icon` — `local:name` (loads `icons/name.svg` from this project; every icon currently in
  use already has a file there — see `icons/`), `sh:name` (selfh.st), `mdi:name`, `si:name`,
  or a direct URL/local path.

## Icons

`icons/` holds one SVG per icon actually used, named to match — e.g. `icons/traefik.svg` is
`icon: local:traefik`. This is the fix for icons being a pain to source: instead of hunting
through selfh.st/MDI/Simple Icons for a match, save any SVG you want (from one of those sites,
a project's own repo, something you made) as `icons/<name>.svg` and point to it with
`local:<name>`. To fix one that looks wrong, just overwrite that file — the config reference
doesn't need to change. `sh:`/`mdi:`/`si:` (pulled live from their CDNs) still work for
anything you haven't bothered to save locally yet.

## Clock

The header clock is configured via an optional top-level `clock:` block in each config file —
`enabled`, `timezone` (`local` or an IANA zone), `hour12`, `seconds`, `weekday`, `date`. See the
comment above it in `config.yaml` for the full field list. An invalid `timezone` falls back to local
time with a console warning rather than breaking.

## Notes

- URL building reads the *browser's own* `window.location` at click time (see `link.type` in
  `config.yaml`'s header comment), so the same config works whether this page is loaded via a public
  domain or a bare LAN IP — no environment/build-time substitution needed.
- Sidebar-collapsed and theme preferences are shared across all profiles (same browser, same
  localStorage) since that's a per-visitor UI preference, not part of any one profile's content.

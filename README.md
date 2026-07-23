# foyer

A config-driven homelab start page — the entryway to every self-hosted service you run.

**[Live demo](https://shuricksumy.github.io/foyer/)** — served via GitHub Pages straight from `main`,
no build step of its own (Pages just serves the static files as-is). `config.yaml` is a sanitized
example config with real official-site links for the well-known services — your real setup goes in
the gitignored private profiles (see **Profiles** below), which never get pushed.

Sidebar of self-hosted services, click one and it loads into a pane on the right without leaving
the page — no separate tab to lose track of. Content (services, icons, grouping, URL rules) lives
entirely in YAML config files, not HTML, so adding or changing a service is a config edit, not
markup surgery.

No build step. Static HTML/CSS/vanilla JS, `js-yaml` vendored locally (`js/vendor/`) for parsing the
config in the browser. Serve this folder however you'd serve any static site — or for local testing:

```sh
python3 -m http.server 8091
# open http://localhost:8091
```

## Deploying

`docker-compose.yml` runs it behind nginx (`nginx:alpine`), mounting only the specific files a
profile needs rather than the whole repo root — so `.git`/`README.md`/`.gitignore` etc. never end up
served over HTTP even if they exist in your working copy. `docker compose up -d` and it's running on
`:8080`.

It includes Traefik labels for reverse-proxy routing — HTTPS on a dedicated subdomain by default,
with a plain-HTTP/`PathPrefix` alternative documented right next to it for serving `foyer` at the
root of an existing host instead. Drop the `labels:`/`networks:` blocks entirely if you're not using
Traefik; the published port alone is enough. Swap the volume list for a private profile's files
(e.g. `admin.html` + `config.admin.yaml`) to deploy that one instead of the public demo — that's the
only thing that changes per profile/host.

## Profiles

Entry pages share this same app/css/icons, each pointing at its own config file via
`<body data-config="...">`:

| Page | Config | Tracked in git? | Scope |
|---|---|---|---|
| `index.html` | `config.yaml` | yes — public | sanitized example, safe to share/demo |
| `everything.html` | `config.everything.yaml` | **no** — gitignored | your real setup, everything merged |
| `admin.html` | `config.admin.yaml` | **no** — gitignored | your real setup, network/infra only |
| `home.html` | `config.home.yaml` | **no** — gitignored | your real setup, media/home/AI |

Only `index.html`/`config.yaml` are meant to be public — `.gitignore` is a whitelist (every
`*.html`/`*.yaml`/`*.yml` at the repo root is private by default, with `index.html`/`config.yaml`/
`docker-compose.yml` explicitly allowed through). That means a new *private* profile needs no
`.gitignore` changes at all — copy `index.html`, point its `data-config` at a new config filename,
done, it's already hidden. A new *public* one needs an explicit `!/filename` line added to
`.gitignore` — a deliberate speed bump so publishing something real takes an intentional step, not
just a forgotten one.

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
- `dashboard: <number>` — puts the item on the home grid at that fixed sorted position (not
  just on/off — a position, so it stays in the same grid cell regardless of config reordering
  elsewhere). Leave it off to keep the item off the grid.
- `enabled: false` — on an item or a whole group, hides it everywhere (sidebar, flyout,
  dashboard grid) without deleting its config — for something temporarily down or being
  reinstalled. Defaults to enabled when left off; disabling a group hides all its items
  regardless of their own `enabled`. See `config.yaml`'s `Traccar`/`Mobile` entries for a
  working example of both.
- `show_as_group: false` on a group — "level 0": its items show up directly, no header, no
  folded-mode flyout to hide behind, always visible. A divider shows on whichever sides
  actually border another group (none, one, or both, depending on where you place it in the
  file) — not tied to config position, so it stays correct if you reorder groups around it.
  You can still set `name`/`icon` on it for your own reference; they just never render.
  Defaults to a normal group when left off. See `config.yaml`'s "Quick Access" group (holding
  `Status`) for a working example.

## Icons

`icons/` holds one SVG per icon actually used, named to match — e.g. `icons/traefik.svg` is
`icon: local:traefik`. This is the fix for icons being a pain to source: instead of hunting
through selfh.st/MDI/Simple Icons for a match, save any SVG you want (from one of those sites,
a project's own repo, something you made) as `icons/<name>.svg` and point to it with
`local:<name>`. To fix one that looks wrong, just overwrite that file — the config reference
doesn't need to change. `sh:`/`mdi:`/`si:` (pulled live from their CDNs) still work for
anything you haven't bothered to save locally yet.

Where to search for one: [selfh.st/icons](https://selfh.st/icons/) (`sh:name`, self-hosted-app
logos), [Material Design Icons](https://pictogrammers.com/library/mdi/) (`mdi:name`, general-purpose
glyphs — network, media, hardware, etc.), [Simple Icons](https://simpleicons.org/) (`si:name`, brand
logos). Find the slug on the site, try it live with the matching prefix, then save it locally once
you're happy with it.

Every icon also gets handled automatically at render time, no config needed: sized to visually
match regardless of how much padding its own artwork has baked in, and — if its color is too
close to the current theme's background — either inverted (for a flat black/white icon with no
brand color to protect) or given a small contrasting backing chip (for a genuinely multi-color
mark, so its real colors aren't corrupted by inverting it).

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

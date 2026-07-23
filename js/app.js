(function () {
  "use strict";

  const els = {
    brand: document.getElementById("brandTitle"),
    navGroups: document.getElementById("navGroups"),
    footer: document.getElementById("sidebarFooter"),
    sidebar: document.getElementById("sidebar"),
    sidebarToggle: document.getElementById("sidebarToggle"),
    search: document.getElementById("searchInput"),
    homeBtn: document.getElementById("homeBtn"),
    paneTitle: document.getElementById("paneTitle"),
    clock: document.getElementById("clock"),
    openExternal: document.getElementById("openExternal"),
    placeholder: document.getElementById("placeholder"),
    frame: document.getElementById("paneFrame"),
    dashboardGrid: document.getElementById("dashboardGrid"),
    sidebarBackdrop: document.getElementById("sidebarBackdrop"),
  };

  let homeTitle = "Home";

  const isMobileViewport = () => window.matchMedia("(max-width: 720px)").matches;

  // On mobile the sidebar is a full-width overlay drawer (see the
  // max-width:720px CSS), so "open" needs a scrim to tap-dismiss and
  // selecting something should close it automatically — otherwise the
  // drawer just sits on top of the content you meant to look at, with no
  // way back to it short of hunting down the hamburger again.
  function updateMobileBackdrop() {
    const open = isMobileViewport() && !els.sidebar.classList.contains("collapsed");
    els.sidebarBackdrop.classList.toggle("visible", open);
  }

  // Applies collapsed/expanded without writing to localStorage — used for
  // the initial state, where "collapsed on phones" is a guessed default,
  // not a choice, and shouldn't stick as one the first time someone opens
  // this on a phone and then later widens the same browser window.
  function applySidebarState(collapsed) {
    els.sidebar.classList.toggle("collapsed", collapsed);
    updateMobileBackdrop();
  }

  function setSidebarCollapsed(collapsed) {
    applySidebarState(collapsed);
    localStorage.setItem(STORAGE_KEYS.collapsed, collapsed ? "1" : "0");
  }

  function closeMobileDrawer() {
    if (isMobileViewport() && !els.sidebar.classList.contains("collapsed")) {
      setSidebarCollapsed(true);
    }
  }

  window.addEventListener("resize", updateMobileBackdrop);

  const STORAGE_KEYS = {
    collapsed: "start.sidebarCollapsed",
    groupState: "start.groupCollapsed",
    theme: "start.theme",
  };

  function buildUrl(link) {
    if (!link) return "#";
    switch (link.type) {
      case "domain":
        return link.value;
      case "path":
        return window.location.origin + link.value;
      case "port": {
        const proto = window.location.protocol;
        const host = window.location.hostname;
        const path = link.path || "";
        return `${proto}//${host}:${link.value}${path}`;
      }
      default:
        return "#";
    }
  }

  function resolveIcon(icon) {
    if (!icon) return null;
    if (/^(https?:)?\//.test(icon)) return icon;
    const sep = icon.indexOf(":");
    if (sep === -1) return icon;
    const prefix = icon.slice(0, sep);
    const name = icon.slice(sep + 1);
    switch (prefix) {
      case "local":
        return `icons/${name}.svg`;
      case "sh":
        return `https://cdn.jsdelivr.net/gh/selfhst/icons/svg/${name}.svg`;
      case "mdi":
        return `https://cdn.jsdelivr.net/npm/@mdi/svg@latest/svg/${name}.svg`;
      case "si":
        return `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${name}.svg`;
      default:
        return icon;
    }
  }

  // Icons come from third-party sets (mdi/sh/si) with whatever fill color
  // their author picked — some render as near-black glyphs that vanish on
  // a dark sidebar (or would vanish as near-white on a light one). Sample
  // each icon's actual pixel colors once it loads and give it a
  // contrasting backing chip only if it's too close to the current page
  // background; icons that already contrast fine stay chip-free.
  const iconWraps = [];

  function pageBgLuminance() {
    const rgb = getComputedStyle(document.body).backgroundColor;
    const m = rgb.match(/\d+/g).map(Number);
    return 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2];
  }

  // Icons come from many unrelated third-party sources (mostly brand
  // logos), each with its own amount of padding baked into its own SVG
  // viewBox — so even inside an identically-sized chip, some icons look
  // visually bigger/bolder than others purely because their artwork fills
  // more of their own canvas than someone else's does. Sample the actual
  // non-transparent pixel bounds and scale up to consistently fill the
  // chip (clamped, and clipped by the chip's own overflow:hidden) so icon
  // weight reads as consistent across completely unrelated icon sets.
  function normalizeIconScale(img, data, size) {
    let minX = size, minY = size, maxX = -1, maxY = -1;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data[(y * size + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return; // fully transparent, nothing to scale against

    const contentSize = Math.max(maxX - minX + 1, maxY - minY + 1);
    const scale = Math.min(size / contentSize, 1.6);
    img.style.transform = scale > 1.03 ? `scale(${scale.toFixed(3)})` : "";
  }

  function checkIconContrast(img, wrapEl) {
    try {
      const size = 32;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      let total = 0;
      let weight = 0;
      let colorfulWeight = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3] / 255;
        if (a < 0.15) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        total += (0.299 * r + 0.587 * g + 0.114 * b) * a;
        weight += a;
        if (Math.max(r, g, b) - Math.min(r, g, b) > 24) colorfulWeight += a;
      }

      normalizeIconScale(img, data, size);
      img.style.filter = "";
      wrapEl.classList.remove("icon-needs-backing", "icon-backing-light");

      if (weight < 1) return; // fully transparent icon, nothing to evaluate for contrast

      const iconLum = total / weight;
      const bgLum = pageBgLuminance();
      const contrast = Math.abs(iconLum - bgLum);

      if (contrast < 60) {
        // Almost no saturated pixels = a flat black/white icon with no
        // brand color to protect (e.g. a plain MDI line icon) — invert it
        // to sit directly on the current background instead of boxing it
        // in a chip, so it stays the same visual size/weight as every
        // icon that already had enough contrast on its own. A genuinely
        // multi-color mark (one with an intentionally dark badge as part
        // of its real logo, e.g. Plex/Radarr) can't be safely inverted
        // without corrupting its actual colors — that still gets a chip.
        const isMonochrome = colorfulWeight / weight < 0.08;
        if (isMonochrome) {
          img.style.filter = "invert(1)";
        } else {
          wrapEl.classList.add("icon-needs-backing");
          wrapEl.classList.toggle("icon-backing-light", bgLum < 128);
        }
      }
    } catch (e) {
      // Cross-origin canvas read blocked — leave the icon as-is.
    }
  }

  function refreshIconContrast() {
    iconWraps.forEach(({ img, wrap }) => {
      if (img.complete && img.naturalWidth > 0) checkIconContrast(img, wrap);
    });
  }

  // Folded-mode group flyouts: the item-list has to escape the sidebar's
  // and .nav-groups' overflow/scroll clipping to render as a floating
  // panel, and CSS overflow clipping applies to descendants regardless of
  // position:absolute/fixed — only actually moving the node out of that
  // DOM subtree escapes it. So on open we reparent the group's real
  // <ul class="item-list"> (same node, same listeners, no cloning) to
  // <body> with position:fixed, and reparent it back into its .group on
  // close. Only one flyout is ever open at a time.
  let openFlyout = null; // { groupEl, list }
  let closeTimer = null;

  function positionFlyout(list, anchorEl) {
    const r = anchorEl.getBoundingClientRect();
    list.style.left = `${r.right + 8}px`;
    const maxTop = window.innerHeight - list.offsetHeight - 12;
    list.style.top = `${Math.max(12, Math.min(r.top, maxTop))}px`;
  }

  function closeFlyout(immediate) {
    clearTimeout(closeTimer);
    if (!openFlyout) return;
    const run = () => {
      if (!openFlyout) return;
      const { groupEl, list } = openFlyout;
      list.classList.remove("flyout-active");
      list.style.position = "";
      list.style.top = "";
      list.style.left = "";
      groupEl.appendChild(list);
      openFlyout = null;
    };
    if (immediate) run();
    else closeTimer = setTimeout(run, 150);
  }

  function openFlyoutFor(groupEl, list, anchorEl) {
    if (!els.sidebar.classList.contains("collapsed")) return;
    clearTimeout(closeTimer);
    if (openFlyout && openFlyout.groupEl === groupEl) {
      positionFlyout(list, anchorEl);
      return;
    }
    closeFlyout(true);
    document.body.appendChild(list);
    list.classList.add("flyout-active");
    positionFlyout(list, anchorEl);
    openFlyout = { groupEl, list };
  }

  window.addEventListener("resize", () => {
    if (openFlyout) closeFlyout(true);
  });

  function loadGroupState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.groupState) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveGroupState(state) {
    localStorage.setItem(STORAGE_KEYS.groupState, JSON.stringify(state));
  }

  function selectItem(item, url, itemEl) {
    document.querySelectorAll(".item.active, .dashboard-card.active").forEach((el) => el.classList.remove("active"));

    if (item.embed) {
      if (itemEl) itemEl.classList.add("active");
      els.placeholder.classList.add("hidden");
      els.dashboardGrid.classList.add("hidden");
      els.frame.classList.remove("hidden");
      els.frame.src = url;
      els.paneTitle.textContent = item.name;
      els.openExternal.href = url;
      els.openExternal.classList.remove("hidden");
    } else {
      window.open(url, "_blank", "noreferrer");
    }
  }

  // The home grid: whatever items have a "dashboard: <number>" position in
  // config, collected while building the sidebar below. The number is a
  // fixed grid position (1, 2, 3, ...) rather than just "on/off", so a
  // service always lands in the same spot regardless of where it lives in
  // the sidebar or config file — the point being able to find it by muscle
  // memory. "dashboard: none" (or omitting the field) leaves it off.
  // Clicking a card reuses the exact same selectItem() path as the sidebar
  // link, and passes that link's own <a> element through so the sidebar
  // highlights in sync.
  const dashboardEntries = [];

  function dashboardOrder(item) {
    const v = item.dashboard;
    if (v === undefined || v === null || v === false || v === "none") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function renderDashboardGrid() {
    els.dashboardGrid.innerHTML = "";
    dashboardEntries.sort((a, b) => a.order - b.order);
    dashboardEntries.forEach(({ item, url, sidebarLink }) => {
      const card = document.createElement("button");
      card.className = "dashboard-card" + (item.embed === false ? " new-tab-hint" : "");
      card.title = item.name + (item.embed === false ? " (opens in new tab)" : "");

      const iconSrc = resolveIcon(item.icon);
      if (iconSrc) {
        const wrap = document.createElement("span");
        wrap.className = "item-icon-wrap";
        const img = document.createElement("img");
        img.className = "item-icon";
        img.src = iconSrc;
        img.alt = "";
        img.loading = "lazy";
        img.crossOrigin = "anonymous";
        img.addEventListener("load", () => checkIconContrast(img, wrap));
        wrap.appendChild(img);
        card.appendChild(wrap);
        iconWraps.push({ img, wrap });
      }

      const label = document.createElement("span");
      label.className = "dashboard-card-label";
      label.textContent = item.name || "";
      card.appendChild(label);

      card.addEventListener("click", () => {
        selectItem(item, url, sidebarLink);
        closeMobileDrawer();
      });

      els.dashboardGrid.appendChild(card);
    });
  }

  function showHome() {
    document.querySelectorAll(".item.active, .dashboard-card.active").forEach((el) => el.classList.remove("active"));
    els.frame.classList.add("hidden");
    els.frame.src = "about:blank";
    els.openExternal.classList.add("hidden");
    els.paneTitle.textContent = homeTitle;

    if (dashboardEntries.length) {
      els.placeholder.classList.add("hidden");
      els.dashboardGrid.classList.remove("hidden");
    } else {
      els.dashboardGrid.classList.add("hidden");
      els.placeholder.classList.remove("hidden");
    }
  }

  function renderGroups(groups) {
    const groupState = loadGroupState();
    els.navGroups.innerHTML = "";
    dashboardEntries.length = 0;

    groups.forEach((group, gi) => {
      if (group.enabled === false) return;

      const groupId = group.name || `group-${gi}`;
      const groupEl = document.createElement("div");
      groupEl.className = "group";
      if (groupState[groupId]) groupEl.classList.add("collapsed");

      const titleBtn = document.createElement("button");
      titleBtn.className = "group-title";
      titleBtn.title = group.name || "";
      titleBtn.innerHTML = `
        <svg class="chevron" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>${group.name || ""}</span>
      `;
      titleBtn.addEventListener("click", () => {
        // Only meaningful in expanded mode — folded mode shows/hides the
        // whole group via the flyout instead (see groupIconBtn below).
        if (els.sidebar.classList.contains("collapsed")) return;
        groupEl.classList.toggle("collapsed");
        groupState[groupId] = groupEl.classList.contains("collapsed");
        saveGroupState(groupState);
      });

      // Folded-mode-only: one representative icon per group. Hovering (or
      // tapping, for touch) it pops the group's full item list open as a
      // flyout, so folding the sidebar doesn't lose the ability to tell
      // groups apart or reach their items (see the earlier "no any
      // understanding what is here" feedback on the flat icon rail).
      const groupIconBtn = document.createElement("button");
      groupIconBtn.className = "group-icon-btn";
      groupIconBtn.title = group.name || "";
      const groupIconSrc = resolveIcon(group.icon);
      if (groupIconSrc) {
        const wrap = document.createElement("span");
        wrap.className = "item-icon-wrap";
        const img = document.createElement("img");
        img.className = "item-icon";
        img.src = groupIconSrc;
        img.alt = "";
        img.loading = "lazy";
        img.crossOrigin = "anonymous";
        img.addEventListener("load", () => checkIconContrast(img, wrap));
        wrap.appendChild(img);
        groupIconBtn.appendChild(wrap);
        iconWraps.push({ img, wrap });
      }
      const list = document.createElement("ul");
      list.className = "item-list";

      groupIconBtn.addEventListener("mouseenter", () => openFlyoutFor(groupEl, list, groupIconBtn));
      groupIconBtn.addEventListener("mouseleave", () => closeFlyout(false));
      groupIconBtn.addEventListener("focus", () => openFlyoutFor(groupEl, list, groupIconBtn));
      groupIconBtn.addEventListener("click", () => {
        // Just ensure it's open, don't toggle — a click is preceded by a
        // real "mouseenter" on non-touch devices (already opening it via
        // hover), so a toggle-close-if-open would immediately re-close
        // whatever hover just opened. Touch users close it by tapping
        // elsewhere (see the outside-click handler) or picking an item.
        openFlyoutFor(groupEl, list, groupIconBtn);
      });
      list.addEventListener("mouseenter", () => clearTimeout(closeTimer));
      list.addEventListener("mouseleave", () => closeFlyout(false));

      const flyoutHeader = document.createElement("li");
      flyoutHeader.className = "flyout-header";
      flyoutHeader.textContent = group.name || "";
      list.appendChild(flyoutHeader);

      (group.items || []).forEach((item) => {
        if (item.enabled === false) return;

        const url = buildUrl(item.link);
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = url;
        a.className = "item" + (item.embed === false ? " new-tab-hint" : "");
        a.dataset.name = (item.name || "").toLowerCase();
        a.title = (item.name || "") + (item.embed === false ? " (opens in new tab)" : "");

        const iconSrc = resolveIcon(item.icon);
        if (iconSrc) {
          const wrap = document.createElement("span");
          wrap.className = "item-icon-wrap";
          const img = document.createElement("img");
          img.className = "item-icon";
          img.src = iconSrc;
          img.alt = "";
          img.loading = "lazy";
          img.crossOrigin = "anonymous";
          img.addEventListener("load", () => checkIconContrast(img, wrap));
          wrap.appendChild(img);
          a.appendChild(wrap);
          iconWraps.push({ img, wrap });
        }

        const label = document.createElement("span");
        label.className = "item-label";
        label.textContent = item.name || "";
        a.appendChild(label);

        a.addEventListener("click", (e) => {
          e.preventDefault();
          selectItem(item, url, a);
          closeFlyout(true);
          closeMobileDrawer();
        });

        const order = dashboardOrder(item);
        if (order !== null) dashboardEntries.push({ item, url, sidebarLink: a, order });

        li.appendChild(a);
        list.appendChild(li);
      });

      groupEl.appendChild(titleBtn);
      groupEl.appendChild(groupIconBtn);
      groupEl.appendChild(list);
      els.navGroups.appendChild(groupEl);
    });
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest(".group") || e.target.closest(".item-list")) return;
    closeFlyout(true);
  });

  function setupSidebarToggle() {
    const stored = localStorage.getItem(STORAGE_KEYS.collapsed);
    // No stored preference yet: default to open (wide). The sidebar's
    // initial HTML has no "collapsed" class, so this is also the only
    // default that requires no class mutation once config finishes
    // loading — anything else (e.g. defaulting closed) means toggling
    // the class after the page has already painted open, which fires
    // the width transition as a visible wide-then-narrow flash on every
    // fresh load. Once a visitor toggles it, that choice sticks (see
    // setSidebarCollapsed) regardless of this default.
    const collapsed = stored === null ? false : stored === "1";
    applySidebarState(collapsed);

    els.sidebarToggle.addEventListener("click", () => {
      closeFlyout(true);
      setSidebarCollapsed(!els.sidebar.classList.contains("collapsed"));
    });

    els.sidebarBackdrop.addEventListener("click", closeMobileDrawer);
  }

  function setupSearch() {
    els.search.addEventListener("input", () => {
      const q = els.search.value.trim().toLowerCase();
      document.querySelectorAll(".group").forEach((groupEl) => {
        let anyVisible = false;
        groupEl.querySelectorAll(".item").forEach((itemEl) => {
          const match = !q || itemEl.dataset.name.includes(q);
          itemEl.classList.toggle("hidden-by-search", !match);
          if (match) anyVisible = true;
        });
        if (q) {
          groupEl.classList.toggle("collapsed", !anyVisible);
          groupEl.style.display = anyVisible ? "" : "none";
        } else {
          groupEl.style.display = "";
        }
      });
    });
  }

  const THEME_ICONS = {
    dark: '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
    refreshIconContrast();
  }

  function setupThemeToggle(initialTheme) {
    const btn = document.createElement("button");
    btn.className = "icon-btn theme-toggle";
    btn.title = "Toggle light / dark theme";
    btn.innerHTML = THEME_ICONS[initialTheme];
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEYS.theme, next);
      applyTheme(next);
      btn.innerHTML = THEME_ICONS[next];
    });

    const left = document.createElement("div");
    left.className = "footer-left";

    const link = document.createElement("a");
    link.className = "footer-link";
    link.href = "https://github.com/shuricksumy/foyer";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.title = "Foyer on GitHub";
    link.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.492.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.5 11.5 0 0 1 3-.405c1.02.005 2.047.138 3.006.405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.807 5.625-5.479 5.92.435.375.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
      <span>Foyer</span>
    `;

    left.appendChild(link);

    els.footer.innerHTML = "";
    els.footer.appendChild(left);
    els.footer.appendChild(btn);
  }

  function startClock(cfg) {
    const opts = cfg || {};
    if (opts.enabled === false) {
      els.clock.classList.add("hidden");
      return;
    }

    // "local" (or omitted) uses the browser's own timezone by simply not
    // passing timeZone to Intl at all, rather than trying to look up and
    // pass the browser's zone name explicitly.
    let timeZone = opts.timezone && opts.timezone !== "local" ? opts.timezone : undefined;

    const dateOpts = {};
    if (opts.weekday !== false) dateOpts.weekday = "short";
    if (opts.date !== false) {
      dateOpts.month = "short";
      dateOpts.day = "numeric";
    }
    const showDate = Object.keys(dateOpts).length > 0;

    const timeOpts = { hour: "2-digit", minute: "2-digit" };
    if (opts.seconds !== false) timeOpts.second = "2-digit";
    if (typeof opts.hour12 === "boolean") timeOpts.hour12 = opts.hour12;

    const withTz = (o) => (timeZone ? { ...o, timeZone } : o);

    const tick = () => {
      const now = new Date();
      try {
        const parts = [];
        if (showDate) parts.push(now.toLocaleDateString(undefined, withTz(dateOpts)));
        parts.push(now.toLocaleTimeString(undefined, withTz(timeOpts)));
        els.clock.textContent = parts.join(" · ");
      } catch (err) {
        // Bad IANA name in clock.timezone — fall back to local time instead
        // of leaving the clock frozen/blank on every tick from here on.
        console.warn(`Invalid clock.timezone "${timeZone}" in config — falling back to local time.`, err);
        timeZone = undefined;
        tick();
      }
    };
    tick();
    setInterval(tick, 1000);
  }

  async function init() {
    // Each entry page (index.html, admin.html, home.html, ...) can point at
    // its own config file via <body data-config="...">, so multiple
    // "profiles" can share this same app/css/icons instead of duplicating
    // them the way the old web_admin/web_home_assistant folders did.
    // Defaults to config.yaml when the attribute is absent.
    const configFile = document.body.dataset.config || "config.yaml";
    const res = await fetch(configFile, { cache: "no-store" });
    const text = await res.text();
    const config = jsyaml.load(text);

    document.title = config.title || "Homelab";
    els.brand.textContent = config.title || "Homelab";
    homeTitle = config.title || "Home";

    const storedTheme = localStorage.getItem(STORAGE_KEYS.theme);
    const initialTheme = storedTheme || (config.theme === "light" ? "light" : "dark");
    applyTheme(initialTheme);
    setupThemeToggle(initialTheme);
    startClock(config.clock);

    renderGroups(config.groups || []);
    renderDashboardGrid();
    showHome();
    els.homeBtn.addEventListener("click", showHome);

    setupSidebarToggle();
    setupSearch();
  }

  init().catch((err) => {
    const configFile = document.body.dataset.config || "config.yaml";
    console.error(`Failed to load ${configFile}:`, err);
    els.dashboardGrid.classList.add("hidden");
    els.placeholder.classList.remove("hidden");
    els.placeholder.innerHTML = `<p>Could not load <code>${configFile}</code>.<br>${err.message}</p>`;
  });
})();

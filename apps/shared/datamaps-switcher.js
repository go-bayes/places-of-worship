/* datamaps-switcher.js — one-tap country switcher for the map surfaces.
   wires the bottom-bar Data Maps split pill's search affordances: the
   caret zone always opens a searchable dropdown listing every country
   data map, and the main zone opens it too while resting (the offer
   engine in each surface's runtime claims the main zone's clicks when
   it is tracking a country; design record:
   docs/development/country-broadcast-review-2026-07.md). a generated
   catalogue supplies navigation and conservative prefetch estimates; the
   hub parser remains the fallback when that catalogue is absent or
   malformed. progressive enhancement: without javascript, or if both
   fetches fail, the main zone keeps navigating to the hub as before. */
(function () {
  "use strict";

  function init() {
    const shell = document.getElementById("datamaps-pill");
    const goTrigger = document.getElementById("datamaps-go");
    const caretTrigger = document.getElementById("datamaps-caret");
    const triggers = [goTrigger, caretTrigger].filter(Boolean);
    if (!shell || !triggers.length || !goTrigger) return;
    const hubUrl = new URL(goTrigger.getAttribute("href"), window.location.href);
    const catalogUrl = new URL("../shared/data/region-catalog.json", hubUrl);
    const tzIndexUrl = new URL("../shared/data/tz-index.json", hubUrl);

    // menu semantics live on the caret zone, the panel's dedicated
    // trigger; the go zone's role changes with the offer engine's state,
    // so it carries no popup claim
    let activeTrigger = triggers[0];
    if (caretTrigger) {
      caretTrigger.setAttribute("aria-haspopup", "dialog");
      caretTrigger.setAttribute("aria-expanded", "false");
    }

    // panel styles ride the module so no shared stylesheet needs a
    // cache bump; colours and radii follow the shell popup idiom
    const style = document.createElement("style");
    style.textContent = `
      #dm-panel {
        position: fixed;
        z-index: 40;
        width: min(340px, calc(100vw - 24px));
        display: flex;
        flex-direction: column;
        background: rgba(15, 23, 42, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        box-shadow: 0 18px 32px rgba(0, 0, 0, 0.32);
        color: #e2e8f0;
        overflow: hidden;
      }
      #dm-panel .dm-search-row { padding: 10px 10px 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
      #dm-filter {
        width: 100%;
        padding: 7px 10px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.06);
        color: #e2e8f0;
        font: inherit;
        font-size: 13px;
      }
      #dm-filter::placeholder { color: #94a3b8; }
      #dm-filter:focus { outline: none; border-color: rgba(148, 163, 184, 0.6); }
      /* ios auto-zooms the page when a focused input's type is under
         16px, throwing the panel off its top pin (jb 2026-07-17); full
         16px type on touch screens stops that zoom at the source */
      @media (pointer: coarse) {
        #dm-filter { font-size: 16px; }
      }
      #dm-list { overflow-y: auto; overscroll-behavior: contain; flex: 1 1 auto; padding: 6px; }
      #dm-list .dm-empty { padding: 12px; color: #94a3b8; font-size: 13px; }
      a.dm-item {
        display: block;
        padding: 8px 10px;
        border-radius: 10px;
        text-decoration: none;
        color: inherit;
      }
      a.dm-item:hover, a.dm-item.dm-active { background: rgba(255, 255, 255, 0.09); }
      a.dm-item .dm-name { font-size: 13.5px; font-weight: 600; }
      a.dm-item .dm-meta { font-size: 11.5px; color: #94a3b8; margin-top: 1px; }
      a.dm-item[aria-current="page"] { border: 1px solid rgba(148, 163, 184, 0.45); }
      a.dm-item.dm-previous { border-bottom: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px 10px 0 0; margin-bottom: 4px; }
      a.dm-item.dm-previous .dm-name { color: #6ee7b7; }
      a.dm-item .dm-here { color: #94a3b8; font-weight: 500; font-size: 11.5px; }
      #dm-foot { padding: 8px 12px; border-top: 1px solid rgba(255, 255, 255, 0.08); }
      #dm-foot a { color: #cbd5f5; font-size: 12.5px; text-decoration: none; }
      #dm-foot a:hover { color: #fff; text-decoration: underline; }
      @media (max-width: 640px) {
        a.dm-item { padding: 12px 10px; }
      }
      .dm-sr {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);

    // navigation and prefetch state persist for this page load only
    let countries = null;
    let catalogPromise = null;
    let panel = null;
    let listEl = null;
    let filterEl = null;
    let statusEl = null;
    let activeIndex = -1;
    let loading = false;
    let wasKeyboard = false;
    let neighboursWarmed = false;
    const prefetched = new Set();
    const prefetchQueue = [];
    const PREFETCH_LIMIT_BYTES = 1024 * 1024;
    let prefetchBytes = 0;

    // fold case and accents so "cote" finds Côte d'Ivoire
    const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    // rank a match so typed letters read as an alphabet jump: names that
    // start with the query lead, then names with a later word starting
    // with it ("zea" finds New Zealand), then mere substrings; -1 is no
    // match. ties fall back to the list's alphabetical order
    function matchRank(foldedName, q) {
      if (foldedName.startsWith(q)) return 0;
      if (!foldedName.includes(q)) return -1;
      return foldedName.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(q)) ? 1 : 2;
    }

    // a page path counts as "here" when it names the same directory
    const normDir = (path) => path.replace(/index\.html$/, "").replace(/\/+$/, "/");
    const herePath = normDir(window.location.pathname);
    const codeMatch = herePath.match(/\/apps\/regions\/([a-z]{2})\/$/);
    const currentCode = codeMatch ? codeMatch[1] : null;

    // the last country departed by a travel offer (recorded by the offer
    // engine at navigation); surfaced as a pinned return row so the pill
    // needs no sticky back state
    let previousRegion = null;
    try {
      const raw = window.sessionStorage.getItem("dm-previous");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && /^[a-z]{2}$/.test(parsed.code) &&
          typeof parsed.name === "string" && parsed.name &&
          parsed.code !== currentCode) {
        previousRegion = parsed;
      }
    } catch (err) {
      // private-mode storage failures cost only the return row
    }
    let prefetchReady = currentCode
      ? window.__DATAMAP_FIRST_IDLE__ === true
      : document.readyState === "complete";

    function connectionAllowsPrefetch() {
      // explicit data-saving and very slow connections disable all warming
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!connection) return true;
      return !connection.saveData && connection.effectiveType !== "2g" && connection.effectiveType !== "slow-2g";
    }

    function runWhenIdle(callback) {
      // data-map work wins every race; speculative requests start only later
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(callback, { timeout: 2000 });
      } else {
        window.setTimeout(callback, 0);
      }
    }

    function flushPrefetchQueue() {
      if (!prefetchReady) return;
      while (prefetchQueue.length) runWhenIdle(prefetchQueue.shift());
    }

    function queuePrefetch(url, estimatedBytes) {
      // the budget spends estimated transfer bytes: zlib-6 estimates for
      // the data payloads (the catalogue carries them), raw bytes for the
      // small page shells. budgeting on raw sizes barred 33 of 100
      // countries' pairs from warming that compressed comfortably fit
      if (!connectionAllowsPrefetch() || !Number.isFinite(estimatedBytes) || estimatedBytes <= 0) return;
      const href = url.href;
      if (prefetched.has(href) || prefetchBytes + estimatedBytes > PREFETCH_LIMIT_BYTES) return;
      prefetched.add(href);
      prefetchBytes += estimatedBytes;
      prefetchQueue.push(() => {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = href;
        document.head.appendChild(link);
      });
      flushPrefetchQueue();
    }

    function validPayload(payload) {
      return Array.isArray(payload) && payload.length === 4 &&
        typeof payload[0] === "string" && Number.isFinite(payload[1]) && payload[1] > 0 &&
        typeof payload[2] === "string" && /^[a-f0-9]{64}$/.test(payload[2]) &&
        Number.isFinite(payload[3]) && payload[3] > 0 && payload[3] <= payload[1];
    }

    async function loadCatalogue() {
      if (catalogPromise) return catalogPromise;
      catalogPromise = (async () => {
        const res = await fetch(catalogUrl.href, { credentials: "same-origin", cache: "no-cache" });
        if (!res.ok) throw new Error("catalogue fetch " + res.status);
        const doc = await res.json();
        if (!doc || JSON.stringify(doc.payload_fields) !== '["path","bytes","sha256","gzip_bytes"]' ||
            !Array.isArray(doc.regions) || !doc.regions.length) throw new Error("catalogue shape");
        const codes = new Set();
        for (const region of doc.regions) {
          if (!region || !/^[a-z]{2}$/.test(region.code) || codes.has(region.code) ||
              typeof region.name !== "string" || !region.name ||
              region.url !== `apps/regions/${region.code}/` ||
              !Number.isFinite(region.html_bytes) || region.html_bytes <= 0 ||
              !validPayload(region.boundary) || !validPayload(region.summary) ||
              !Array.isArray(region.waves) || !region.waves.length || !region.waves.every(Number.isInteger) ||
              !Array.isArray(region.neighbours) || !region.neighbours.every((code) => /^[a-z]{2}$/.test(code))) {
            throw new Error("catalogue region shape");
          }
          codes.add(region.code);
        }
        if (doc.regions.some((region) => region.neighbours.some((code) => !codes.has(code)))) {
          throw new Error("catalogue neighbour shape");
        }
        return doc.regions;
      })();
      return catalogPromise;
    }

    function catalogueCountries(regions) {
      return regions.map((region) => {
        const href = new URL(region.url.replace(/^apps\/regions\//, ""), hubUrl);
        return {
          code: region.code,
          name: region.name,
          meta: region.waves.join(" · "),
          href: href.href,
          dir: normDir(href.pathname),
          catalog: region
        };
      });
    }

    async function prefetchCountry(code, includeSummary, includeBoundary) {
      if (!connectionAllowsPrefetch() || code === currentCode) return;
      try {
        const regions = await loadCatalogue();
        const region = regions.find((item) => item.code === code);
        if (!region) return;
        const pageUrl = new URL(region.url.replace(/^apps\/regions\//, ""), hubUrl);
        queuePrefetch(pageUrl, region.html_bytes);
        if (includeSummary) queuePrefetch(new URL(region.summary[0], pageUrl), region.summary[3]);
        if (includeBoundary) queuePrefetch(new URL(region.boundary[0], pageUrl), region.boundary[3]);
      } catch (err) {
        // speculative failures never alter navigation
      }
    }

    // the global map warms one country data map — page, summary and
    // boundary — so the likeliest handoff opens from cache. the target
    // is the visitor's own country when a permissionless signal names
    // one with a data map: the device timezone first (it says where the
    // device is right now), then an explicit locale region subtag
    // (ranked second because browsers often report en-US regardless of
    // place). whatever the budget cannot seat is skipped by the
    // queuePrefetch gate, so the warm degrades to partial on the big
    // countries — a us visitor warms the us page shell, never its
    // 20 MB county summary. new zealand is the fallback and, when the
    // guess lands elsewhere, the top-up: the flagship census map stays
    // warm for every visitor with whatever budget the guess leaves.
    // country pages skip all of this; their neighbours matter more.
    const HOME_DEFAULT = "nz";
    let homeWarmed = false;

    async function guessHomeCode(regions) {
      const has = (code) => regions.some((region) => region.code === code);
      try {
        // qa override, the dm-previous storage idiom
        const forced = window.sessionStorage.getItem("dm-home");
        if (forced && has(forced)) return forced;
      } catch (err) {}
      try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (zone) {
          const res = await fetch(tzIndexUrl.href, { credentials: "same-origin" });
          if (res.ok) {
            const index = await res.json();
            const code = index && typeof index === "object" ? index[zone] : null;
            if (typeof code === "string" && has(code)) return code;
          }
        }
      } catch (err) {}
      for (const tag of navigator.languages || []) {
        try {
          // explicit region only — maximize() would invent en -> US
          const region = new Intl.Locale(tag).region;
          if (region && region.length === 2) {
            const iso = region.toLowerCase();
            const code = iso === "gb" ? "uk" : iso;
            if (has(code)) return code;
          }
        } catch (err) {}
      }
      return HOME_DEFAULT;
    }

    function warmHome() {
      if (currentCode || homeWarmed || !connectionAllowsPrefetch()) return;
      homeWarmed = true;
      void (async () => {
        try {
          const regions = await loadCatalogue();
          const code = await guessHomeCode(regions);
          await prefetchCountry(code, true, true);
          if (code !== HOME_DEFAULT) await prefetchCountry(HOME_DEFAULT, true, true);
        } catch (err) {
          // a failed guess or catalogue costs only the warm
        }
      })();
    }

    async function warmNeighbours() {
      if (!currentCode || neighboursWarmed || !connectionAllowsPrefetch()) return;
      neighboursWarmed = true;
      try {
        const regions = await loadCatalogue();
        const current = regions.find((region) => region.code === currentCode);
        if (!current) return;
        current.neighbours.forEach((code) => { void prefetchCountry(code, false); });
      } catch (err) {
        // no catalogue, no neighbour warming
      }
    }

    function markPrefetchReady() {
      prefetchReady = true;
      flushPrefetchQueue();
      warmHome();
      void warmNeighbours();
    }

    document.addEventListener("datamap:first-idle", markPrefetchReady, { once: true });
    if (!currentCode && !prefetchReady) window.addEventListener("load", markPrefetchReady, { once: true });
    if (prefetchReady) { warmHome(); void warmNeighbours(); }
    // border handoff uses the same network guard, idle gate, and page
    // budget; an offer on screen is strong intent, so the summary and
    // boundary warm alongside the page shell (budget-capped as ever)
    window.datamapsPrefetchCountry = (code) => { void prefetchCountry(code, true, true); };

    async function loadHubCountries() {
      const res = await fetch(hubUrl.href, { credentials: "same-origin" });
      if (!res.ok) throw new Error("hub fetch " + res.status);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const cards = doc.querySelectorAll("a.map-card");
      const out = [];
      cards.forEach((card) => {
        const titleEl = card.querySelector(".map-card-title");
        if (!titleEl) return;
        // the card title holds the country name as text nodes beside
        // the badge spans; the badges become the row's meta line
        const name = Array.from(titleEl.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent)
          .join("")
          .trim();
        if (!name) return;
        const meta = Array.from(card.querySelectorAll(".wave-badge"))
          .map((b) => b.textContent.trim())
          .join(" · ");
        const href = new URL(card.getAttribute("href"), hubUrl.href);
        const match = normDir(href.pathname).match(/\/([a-z]{2})\/$/);
        out.push({ code: match ? match[1] : null, name: name, meta: meta, href: href.href, dir: normDir(href.pathname) });
      });
      // a partial parse means the hub markup drifted; fall back to the hub
      // rather than silently dropping countries from every switcher
      if (!out.length || out.length !== cards.length) throw new Error("hub parse mismatch");
      return out;
    }

    async function loadCountries() {
      // catalogue-first navigation; the live hub parser is the compatibility path
      let list;
      try {
        list = catalogueCountries(await loadCatalogue());
      } catch (err) {
        list = await loadHubCountries();
      }
      // the catalogue arrives in code order (Austria before Australia);
      // the panel reads as an alphabet, so names sort by folded form once
      // here and the stable filter sort inherits the order within ranks
      return list.sort((a, b) => fold(a.name).localeCompare(fold(b.name)));
    }

    function buildPanel() {
      panel = document.createElement("div");
      panel.id = "dm-panel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Country data maps");
      panel.hidden = true;
      panel.innerHTML = `
        <div class="dm-search-row">
          <input id="dm-filter" type="search" placeholder="Filter countries…" aria-label="Filter countries" autocomplete="off"
            role="combobox" aria-expanded="true" aria-controls="dm-list" aria-autocomplete="list">
        </div>
        <div id="dm-list" role="listbox" aria-label="Country data maps"></div>
        <div id="dm-status" class="dm-sr" role="status"></div>
        <div id="dm-foot"><a href="${hubUrl.href}">All data maps — sources &amp; notes →</a></div>
      `;
      document.body.appendChild(panel);
      listEl = panel.querySelector("#dm-list");
      filterEl = panel.querySelector("#dm-filter");
      statusEl = panel.querySelector("#dm-status");
      filterEl.addEventListener("input", () => renderList(filterEl.value));
      filterEl.addEventListener("keydown", onFilterKeys);
    }

    function visibleItems() {
      return Array.from(listEl.querySelectorAll("a.dm-item"));
    }

    function setActive(index) {
      const items = visibleItems();
      items.forEach((el) => {
        el.classList.remove("dm-active");
        el.setAttribute("aria-selected", "false");
      });
      activeIndex = Math.max(-1, Math.min(index, items.length - 1));
      if (activeIndex >= 0) {
        const active = items[activeIndex];
        active.classList.add("dm-active");
        active.setAttribute("aria-selected", "true");
        active.scrollIntoView({ block: "nearest" });
        filterEl.setAttribute("aria-activedescendant", active.id);
      } else {
        filterEl.removeAttribute("aria-activedescendant");
      }
    }

    // arrows walk the filtered list, enter follows the active (or only)
    // row, escape hands focus back to the trigger
    function onFilterKeys(e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(activeIndex + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(activeIndex - 1); }
      else if (e.key === "Enter") {
        const items = visibleItems();
        const target = items[activeIndex >= 0 ? activeIndex : 0];
        if (!target) return;
        // cmd/ctrl+enter keeps its open-in-new-tab meaning
        if (e.metaKey || e.ctrlKey) window.open(target.href, "_blank", "noopener");
        else window.location.href = target.href;
      }
    }

    function renderList(query) {
      const q = fold(query || "").trim();
      const shown = q
        ? countries
            .map((c) => ({ c, rank: matchRank(fold(c.name), q) }))
            .filter((entry) => entry.rank >= 0)
            .sort((a, b) => a.rank - b.rank)
            .map((entry) => entry.c)
        : countries;
      listEl.innerHTML = "";
      if (!shown.length) {
        listEl.innerHTML = '<div class="dm-empty">No country matches.</div>';
      }
      // an unfiltered list leads with the way back to the country last
      // departed, one tap from anywhere; a proper option so the listbox
      // keyboard walk and announcements include it
      if (!q && previousRegion) {
        const back = document.createElement("a");
        back.className = "dm-item dm-previous";
        back.id = "dm-opt-prev";
        back.setAttribute("role", "option");
        back.setAttribute("aria-selected", "false");
        back.href = new URL(`${previousRegion.code}/`, hubUrl).href;
        const name = document.createElement("div");
        name.className = "dm-name";
        name.textContent = `← Back to ${previousRegion.name}`;
        back.appendChild(name);
        const warm = () => { void prefetchCountry(previousRegion.code, true, true); };
        back.addEventListener("pointerenter", warm, { once: true });
        back.addEventListener("focus", warm, { once: true });
        back.addEventListener("touchstart", warm, { once: true, passive: true });
        listEl.appendChild(back);
      }
      statusEl.textContent = shown.length
        ? shown.length + " of " + countries.length + " countries listed"
        : "No country matches";
      shown.forEach((c, i) => {
        const a = document.createElement("a");
        a.className = "dm-item";
        a.id = "dm-opt-" + i;
        a.setAttribute("role", "option");
        a.setAttribute("aria-selected", "false");
        a.href = c.href;
        const here = c.dir === herePath;
        if (here) a.setAttribute("aria-current", "page");
        const name = document.createElement("div");
        name.className = "dm-name";
        name.textContent = c.name;
        if (here) {
          const tag = document.createElement("span");
          tag.className = "dm-here";
          tag.textContent = " — you are here";
          name.appendChild(tag);
        }
        a.appendChild(name);
        if (c.meta) {
          const meta = document.createElement("div");
          meta.className = "dm-meta";
          meta.textContent = c.meta;
          a.appendChild(meta);
        }
        if (c.code) {
          // hover, focus or touch is strong intent: warm the whole pair
          // so the destination's census layer opens from cache too
          const warm = () => { void prefetchCountry(c.code, true, true); };
          a.addEventListener("pointerenter", warm, { once: true });
          a.addEventListener("focus", warm, { once: true });
          a.addEventListener("touchstart", warm, { once: true, passive: true });
        }
        listEl.appendChild(a);
      });
      setActive(-1);
    }

    // the whole split pill anchors the panel; the rect is measured at
    // each open rather than fixed at load
    function placePanel() {
      const rect = shell.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      // touch screens pin the panel to the top of the viewport: the soft
      // keyboard owns the bottom, and a pill-anchored panel shrinks down
      // into it as the filtered list gets shorter, hiding the search row
      // at exactly the moment the filter is doing its job. all coordinates
      // come from the visual viewport (jb 2026-07-17): fixed positioning
      // anchors to the layout viewport, so under page pinch-zoom a plain
      // top:12px can sit entirely outside the visible area — the offsets
      // translate the panel into whatever part of the page is on screen,
      // and the height bound keeps the list above the soft keyboard
      if (window.matchMedia("(pointer: coarse)").matches) {
        const vv = window.visualViewport;
        const vx = vv ? vv.offsetLeft : 0;
        const vy = vv ? vv.offsetTop : 0;
        const vw = vv ? vv.width : window.innerWidth;
        const vh = vv ? vv.height : window.innerHeight;
        const fit = Math.min(340, vw - 24);
        panel.style.width = fit + "px";
        panel.style.left = (vx + Math.max(12, (vw - fit) / 2)) + "px";
        panel.style.right = "auto";
        panel.style.top = (vy + 12) + "px";
        panel.style.bottom = "auto";
        panel.style.maxHeight = Math.max(160, Math.min(vh - 24, Math.round(vh * 0.72))) + "px";
        return;
      }
      // centre on the pill, clamped inside the viewport margins (width set
      // inline on both branches so a pointer-mode change never inherits a
      // stale coarse-branch width)
      panel.style.width = width + "px";
      let left = rect.left + rect.width / 2 - width / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
      panel.style.left = left + "px";
      panel.style.right = "auto";
      // open on whichever side has room, capped at 60vh so the list
      // reads as a menu, not a sheet, and stays clear of the top chrome
      const cap = Math.round(window.innerHeight * 0.6);
      const below = Math.min(window.innerHeight - rect.bottom - 24, cap);
      const above = Math.min(rect.top - 24, cap);
      if (below >= 220 || below >= above) {
        panel.style.top = rect.bottom + 8 + "px";
        panel.style.bottom = "auto";
        panel.style.maxHeight = Math.max(120, below) + "px";
      } else {
        panel.style.top = "auto";
        panel.style.bottom = window.innerHeight - rect.top + 8 + "px";
        panel.style.maxHeight = Math.max(120, above) + "px";
      }
    }

    function openPanel() {
      panel.hidden = false;
      if (caretTrigger) caretTrigger.setAttribute("aria-expanded", "true");
      placePanel();
      filterEl.value = "";
      renderList("");
      // focusing the filter on touch devices pops the keyboard over the
      // list, so autofocus needs a keyboard activation or a fine pointer
      if (wasKeyboard || window.matchMedia("(pointer: fine)").matches) filterEl.focus();
      document.addEventListener("pointerdown", onOutside, true);
      document.addEventListener("keydown", onEscape, true);
      window.addEventListener("resize", onResize);
      // ios keyboards resize only the visual viewport, never the window,
      // so the height cap re-measures on that channel too; pinch-zoom
      // panning moves the visual viewport without resizing it, which is
      // the scroll channel
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", onViewportResize);
        window.visualViewport.addEventListener("scroll", onViewportResize);
      }
    }

    function closePanel() {
      if (!panel || panel.hidden) return;
      panel.hidden = true;
      if (caretTrigger) caretTrigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("resize", onResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", onViewportResize);
        window.visualViewport.removeEventListener("scroll", onViewportResize);
      }
    }

    // a visual-viewport change never closes the panel; it only re-fits it
    function onViewportResize() {
      if (panel && !panel.hidden) placePanel();
    }

    // a soft keyboard opening under the filter fires a window resize;
    // closing then would destroy the panel as typing starts, so a
    // focused filter re-places the panel instead
    function onResize() {
      if (filterEl && document.activeElement === filterEl) {
        placePanel();
        return;
      }
      closePanel();
    }

    function onOutside(e) {
      if (panel.contains(e.target) || shell.contains(e.target)) return;
      closePanel();
    }

    function onEscape(e) {
      if (e.key !== "Escape") return;
      closePanel();
      activeTrigger.focus();
    }

    // the hub escape below opens only after a real wait, so an ordinary
    // double-click cannot yank the user away mid-fetch
    let loadingSince = 0;

    triggers.forEach((trigger) => trigger.addEventListener("click", async (e) => {
      // modified activations keep their native new-tab/window behaviour
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      // keyboard activations report detail 0; remembered for the autofocus
      wasKeyboard = e.detail === 0;
      activeTrigger = trigger;
      if (panel && !panel.hidden) { closePanel(); return; }
      if (!countries) {
        // a stalled fetch must not trap the user: a repeat activation
        // after a one-second wait takes the plain hub navigation instead
        if (loading) {
          if (Date.now() - loadingSince > 1000) window.location.href = hubUrl.href;
          return;
        }
        loading = true;
        loadingSince = Date.now();
        trigger.setAttribute("aria-busy", "true");
        try {
          countries = await loadCountries();
        } catch (err) {
          // no list, no dropdown: fall back to the plain hub navigation
          window.location.href = hubUrl.href;
          return;
        } finally {
          loading = false;
          trigger.removeAttribute("aria-busy");
        }
        buildPanel();
        if (caretTrigger) caretTrigger.setAttribute("aria-controls", "dm-panel");
      }
      openPanel();
    }));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

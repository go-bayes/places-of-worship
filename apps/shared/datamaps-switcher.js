/* datamaps-switcher.js — one-tap country switcher for the map surfaces.
   enhances the wordmark "Data maps" link (present on every country page
   and the global map) into a searchable dropdown listing every country
   data map, so moving between maps never needs the two-hop trip through
   the hub. the hub page (apps/regions/index.html) stays the single
   source of truth: the panel fetches and parses its map cards at first
   open, so a newly launched country appears here with no extra step.
   progressive enhancement: without javascript, or if the fetch fails,
   the link keeps navigating to the hub as before. */
(function () {
  "use strict";

  function init() {
    const trigger = document.getElementById("datamaps-link");
    if (!trigger) return;
    const hubUrl = new URL(trigger.getAttribute("href"), window.location.href);

    // signal the menu behaviour on the existing link
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    const caret = document.createElement("span");
    caret.className = "dm-caret";
    caret.setAttribute("aria-hidden", "true");
    caret.textContent = " ▾";
    trigger.appendChild(caret);

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

    // state: countries load once from the hub html on first open
    let countries = null;
    let panel = null;
    let listEl = null;
    let filterEl = null;
    let statusEl = null;
    let activeIndex = -1;
    let loading = false;
    let wasKeyboard = false;

    // fold case and accents so "cote" finds Côte d'Ivoire
    const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    // a page path counts as "here" when it names the same directory
    const normDir = (path) => path.replace(/index\.html$/, "").replace(/\/+$/, "/");
    const herePath = normDir(window.location.pathname);

    async function loadCountries() {
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
        out.push({ name: name, meta: meta, href: href.href, dir: normDir(href.pathname) });
      });
      // a partial parse means the hub markup drifted; fall back to the hub
      // rather than silently dropping countries from every switcher
      if (!out.length || out.length !== cards.length) throw new Error("hub parse mismatch");
      return out;
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
        if (target) window.location.href = target.href;
      }
    }

    function renderList(query) {
      const q = fold(query || "").trim();
      const shown = countries.filter((c) => !q || fold(c.name).includes(q));
      listEl.innerHTML = "";
      if (!shown.length) {
        listEl.innerHTML = '<div class="dm-empty">No country matches.</div>';
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
        listEl.appendChild(a);
      });
      setActive(-1);
    }

    // the wordmark pill is draggable on both surfaces, so the anchor
    // rect is measured at each open rather than fixed at load
    function placePanel() {
      const anchor = document.getElementById("wordmark") || trigger;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      let right = Math.max(12, window.innerWidth - rect.right);
      if (right + width > window.innerWidth - 12) right = 12;
      panel.style.right = right + "px";
      // a dragged pill can sit anywhere; open on whichever side has room
      const below = window.innerHeight - rect.bottom - 24;
      const above = rect.top - 24;
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

    // the wordmark pill is draggable; a drag with the panel open would
    // strand the panel at its old anchor, so any buttons-down move closes
    // it (a jiggly plain click nets out: the trailing click reopens)
    function onAnchorDragMove(e) {
      if (e.buttons) closePanel();
    }

    function openPanel() {
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      placePanel();
      filterEl.value = "";
      renderList("");
      // focusing the filter on touch devices pops the keyboard over the
      // list, so autofocus needs a keyboard activation or a fine pointer
      if (wasKeyboard || window.matchMedia("(pointer: fine)").matches) filterEl.focus();
      document.addEventListener("pointerdown", onOutside, true);
      document.addEventListener("keydown", onEscape, true);
      window.addEventListener("resize", closePanel);
      const anchor = document.getElementById("wordmark");
      if (anchor) anchor.addEventListener("pointermove", onAnchorDragMove);
    }

    function closePanel() {
      if (!panel || panel.hidden) return;
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("resize", closePanel);
      const anchor = document.getElementById("wordmark");
      if (anchor) anchor.removeEventListener("pointermove", onAnchorDragMove);
    }

    function onOutside(e) {
      if (panel.contains(e.target) || trigger.contains(e.target)) return;
      closePanel();
    }

    function onEscape(e) {
      if (e.key !== "Escape") return;
      closePanel();
      trigger.focus();
    }

    trigger.addEventListener("click", async (e) => {
      // modified activations keep their native new-tab/window behaviour
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      // keyboard activations report detail 0; remembered for the autofocus
      wasKeyboard = e.detail === 0;
      if (panel && !panel.hidden) { closePanel(); return; }
      if (!countries) {
        // a stalled fetch must not trap the user: the second activation
        // takes the plain hub navigation instead of waiting
        if (loading) { window.location.href = hubUrl.href; return; }
        loading = true;
        try {
          countries = await loadCountries();
        } catch (err) {
          // no list, no dropdown: fall back to the plain hub navigation
          window.location.href = hubUrl.href;
          return;
        } finally {
          loading = false;
        }
        buildPanel();
      }
      openPanel();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

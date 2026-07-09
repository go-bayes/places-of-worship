// overview.js — renders a country's overview page from window.OVERVIEW_CONFIG.
// one runtime, thin pages: the page is the public rendering of the repo
// record (research card, manifest, live REGION_CONFIG). it authors nothing;
// every string comes from the inline config. sections whose config key is
// absent collapse rather than render an empty shell.
// contract: docs/development/country-overview-page.md.
(function () {
  "use strict";

  var CONFIG = window.OVERVIEW_CONFIG || {};
  // the repo lives here; script and card links resolve into it on GitHub
  var GITHUB_BLOB = "https://github.com/go-bayes/places-of-worship/blob/main/";
  var GITHUB_REPO = "https://github.com/go-bayes/places-of-worship";

  // small DOM helpers so the render functions read as structure, not plumbing
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  // html() trusts its input: only author-controlled config strings reach it
  function html(tag, className, markup) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (markup != null) node.innerHTML = markup;
    return node;
  }
  function link(label, href, external) {
    var a = el("a", null, label);
    a.href = href;
    if (external) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    return a;
  }

  // header: country name, the fixed kicker, and the primary Open-the-map action
  function renderHeader() {
    var header = el("header", "overview-header");
    header.appendChild(el("div", "overview-kicker", "Research map overview"));
    header.appendChild(el("h1", "overview-title", CONFIG.countryName || CONFIG.countryCode || ""));
    var mapHref = CONFIG.mapHref || "./";
    var open = link("Open the map", mapHref, false);
    open.className = "overview-open-map";
    header.appendChild(open);
    return header;
  }

  function renderIntro() {
    if (!CONFIG.intro) return null;
    return el("p", "overview-intro", CONFIG.intro);
  }

  // the at-a-glance strip: only the facts the config actually supplies show
  function renderFacts() {
    var facts = CONFIG.facts;
    if (!facts) return null;
    var rows = [
      ["Waves", facts.waves],
      ["Geographies", facts.geographies],
      ["Metrics", facts.metrics],
      ["Places", facts.placeDots]
    ].filter(function (r) { return r[1]; });
    if (!rows.length) return null;
    var section = el("section", "overview-facts");
    var grid = el("dl", "overview-facts-grid");
    rows.forEach(function (r) {
      grid.appendChild(el("dt", "overview-fact-key", r[0]));
      grid.appendChild(el("dd", "overview-fact-val", r[1]));
    });
    section.appendChild(grid);
    return section;
  }

  // shared section wrapper: heading plus body, collapses if body is empty
  function renderSection(heading, body) {
    if (!body) return null;
    var section = el("section", "overview-section");
    section.appendChild(el("h2", "overview-section-title", heading));
    section.appendChild(body);
    return section;
  }

  // how to read this map: the honesty section. required for every country;
  // if the config omits it, that is an authoring error, not a collapse case
  function renderReading() {
    var reading = CONFIG.reading;
    if (!reading || !reading.length) return null;
    var list = el("ul", "overview-reading");
    reading.forEach(function (bullet) {
      // author-controlled prose; innerHTML lets a note carry emphasis or a link
      list.appendChild(html("li", null, bullet));
    });
    return renderSection("How to read this map", list);
  }

  // data sources and licences: one row per source the live map uses, plus the
  // boundary source, straight from the card's religious-data-over-time table
  function renderSources() {
    var sources = CONFIG.sources;
    if (!sources || !sources.length) return null;
    var table = el("table", "overview-sources");
    var thead = el("thead");
    var hrow = el("tr");
    ["Source", "Construct", "Years", "Licence"].forEach(function (h) {
      hrow.appendChild(el("th", null, h));
    });
    thead.appendChild(hrow);
    table.appendChild(thead);
    var tbody = el("tbody");
    sources.forEach(function (s) {
      var tr = el("tr");
      var nameCell = el("td", "overview-source-name");
      if (s.href) {
        nameCell.appendChild(link(s.name, s.href, true));
      } else {
        nameCell.textContent = s.name;
      }
      tr.appendChild(nameCell);
      tr.appendChild(el("td", null, s.construct || ""));
      tr.appendChild(el("td", null, s.years || ""));
      // licence may carry a link; author-controlled
      tr.appendChild(html("td", null, s.licence || ""));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    var wrap = el("div", "overview-table-wrap");
    wrap.appendChild(table);
    return renderSection("Data sources and licences", wrap);
  }

  // get the data yourself: mirrors the card's access section
  function renderAccess() {
    var a = CONFIG.accessData;
    if (!a) return null;
    var body = el("div", "overview-access");
    body.appendChild(el("p", "overview-access-lede",
      "This project does not redistribute source data; the map shows derived rates with attribution. To obtain the data from the source of record:"));
    var dl = el("dl", "overview-defs");
    function def(term, valueNode) {
      if (!valueNode) return;
      dl.appendChild(el("dt", null, term));
      var dd = el("dd");
      dd.appendChild(valueNode);
      dl.appendChild(dd);
    }
    if (a.sourceOfRecord) def("Source of record", html("span", null, a.sourceOfRecord));
    if (a.tables) def("Exact tables", html("span", null, a.tables));
    if (a.licence) def("Licence", html("span", null, a.licence));
    // one repo path, or several (some countries build across two scripts)
    var scripts = Array.isArray(a.script) ? a.script : (a.script ? [a.script] : []);
    if (scripts.length) {
      var scriptSpan = el("span");
      scripts.forEach(function (path, i) {
        if (i) scriptSpan.appendChild(document.createTextNode(" · "));
        var scriptHref = path.indexOf("http") === 0 ? path : GITHUB_BLOB + path;
        scriptSpan.appendChild(link(path, scriptHref, true));
      });
      def(scripts.length > 1 ? "Extraction scripts" : "Extraction script", scriptSpan);
    }
    if (a.manifests && a.manifests.length) {
      var span = el("span", "overview-manifests");
      a.manifests.forEach(function (m, i) {
        if (i) span.appendChild(document.createTextNode(" · "));
        var href = m.href && m.href.indexOf("http") === 0 ? m.href : GITHUB_BLOB + (m.href || "");
        span.appendChild(link(m.label, href, true));
      });
      def("Retrieval recipe and hashes", span);
    }
    if (a.note) body.appendChild(html("p", "overview-access-note", a.note));
    body.appendChild(dl);
    return renderSection("Get the data yourself", body);
  }

  // contribute: portal links where the country has them, or the pending words
  function renderContribute() {
    var c = CONFIG.contribute;
    if (!c) return null;
    var body = el("div", "overview-contribute");
    var list = el("div", "overview-link-row");
    var hasPortal = false;
    if (c.submit) {
      list.appendChild(actionLink("Submit evidence", c.submit, false));
      hasPortal = true;
    }
    if (c.review) {
      list.appendChild(actionLink("Review evidence", c.review, false));
      hasPortal = true;
    }
    if (c.osm) list.appendChild(actionLink("Correct a place on OpenStreetMap", c.osm, true));
    list.appendChild(actionLink("Project on GitHub", c.github || GITHUB_REPO, true));
    if (!hasPortal && c.pendingNote) {
      body.appendChild(el("p", "overview-contribute-pending", c.pendingNote));
    }
    body.appendChild(list);
    return renderSection("Contribute", body);
  }
  function actionLink(label, href, external) {
    var a = link(label, href, external);
    a.className = "overview-action";
    return a;
  }

  // footer: back to the hub, out to the global map, and to the country card
  function renderFooter() {
    var footer = el("footer", "overview-footer");
    var row = el("div", "overview-link-row");
    var f = CONFIG.footerLinks || {};
    row.appendChild(link("← Data maps", f.hub || "../", false));
    row.appendChild(link("Global map", f.global || "../../global/", false));
    var cc = (CONFIG.countryCode || "").toLowerCase();
    var cardHref = f.card || (GITHUB_BLOB + "research/countries/" + cc + "/README.md");
    row.appendChild(link("Country card on GitHub", cardHref, true));
    footer.appendChild(row);
    return footer;
  }

  function render() {
    var root = document.getElementById("overview-root") || document.body;
    var main = el("main", "overview");
    [
      renderHeader(),
      renderIntro(),
      renderFacts(),
      renderReading(),
      renderSources(),
      renderAccess(),
      renderContribute(),
      renderFooter()
    ].forEach(function (node) {
      if (node) main.appendChild(node);
    });
    root.appendChild(main);
    if (CONFIG.countryName) {
      document.title = "Places of Worship | " + CONFIG.countryName + " map overview";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();

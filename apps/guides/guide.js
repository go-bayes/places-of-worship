// guide navigation (the ui set's item 7, 2026-11-03). on a wide screen the
// contents are a sticky rail with the section in view marked; on a narrow
// one a sticky contents button opens the same list as a sheet; every
// section ends with links to the one before and the one after. the page
// reads in full without this script: the contents list stays at the top.
(function () {
  "use strict";
  const toc = document.getElementById("guide-contents");
  if (!toc) return;
  const tocLinks = [...toc.querySelectorAll('a[href^="#"]')];
  const entries = tocLinks
    .map((link, index) => ({
      id: link.getAttribute("href").slice(1),
      number: index + 1,
      title: link.textContent.trim(),
    }))
    .map((entry) => ({ ...entry, section: document.getElementById(entry.id) }))
    .filter((entry) => entry.section);

  // previous and next at the end of each section, numbered as the contents are
  entries.forEach((entry, index) => {
    const prev = entries[index - 1];
    const next = entries[index + 1];
    if (!prev && !next) return;
    const pager = document.createElement("nav");
    pager.className = "section-pager";
    pager.setAttribute("aria-label", "Previous and next sections");
    const link = (target, text, rel) => {
      const a = document.createElement("a");
      a.href = `#${target.id}`;
      a.rel = rel;
      a.textContent = text;
      return a;
    };
    if (prev) pager.appendChild(link(prev, `← ${prev.number}. ${prev.title}`, "prev"));
    if (next) pager.appendChild(link(next, `${next.number}. ${next.title} →`, "next"));
    entry.section.appendChild(pager);
  });

  // the narrow-screen sheet holds a copy of the contents list
  const bar = document.querySelector(".contents-bar");
  const toggle = bar?.querySelector(".contents-toggle");
  const current = bar?.querySelector(".contents-current");
  const sheet = document.getElementById("contents-sheet");
  const list = toc.querySelector("ol");
  if (bar && toggle && sheet && list) {
    sheet.appendChild(list.cloneNode(true));
    bar.hidden = false;
    const setOpen = (open) => {
      sheet.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    toggle.addEventListener("click", () => setOpen(sheet.hidden));
    sheet.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !sheet.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (!sheet.hidden && !bar.contains(event.target)) setOpen(false);
    });
  }

  // the section in view is marked in the rail and the sheet alike
  const allLinks = () => [...document.querySelectorAll('#guide-contents a[href^="#"], #contents-sheet a[href^="#"]')];
  const setCurrent = (id) => {
    const entry = entries.find((item) => item.id === id);
    if (!entry) return;
    allLinks().forEach((a) => {
      if (a.getAttribute("href") === `#${id}`) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
    if (current) current.textContent = `${entry.number}. ${entry.title}`;
  };
  if ("IntersectionObserver" in window) {
    // a thin band near the top of the window: the section crossing it is
    // the one being read
    const observer = new IntersectionObserver((seen) => {
      seen.forEach((item) => {
        if (item.isIntersecting) setCurrent(item.target.id);
      });
    }, { rootMargin: "-15% 0px -80% 0px" });
    entries.forEach((entry) => observer.observe(entry.section));
  }
  setCurrent(location.hash.slice(1) || entries[0]?.id);
})();

// theme: dark is the one theme (jb 2026-09-21: "the dark theme is
// beautiful. can we simply make that default with no options?"). runs in
// <head> before the stylesheets and marks <html> before paint, so the
// basemap code and any later reader see the same answer. the three-state
// control (r-u2, 2026-09-19) is retired; the api keeps its shape for callers.
//   window.PowTheme.get()        -> "dark"
//   window.PowTheme.effective()  -> "dark"
//   window.PowTheme.set()        -> "dark", nothing changes
//   window.PowTheme.bind()       -> nothing to wire
(function () {
    var root = document.documentElement;
    if (root) {
        root.setAttribute("data-theme", "dark");
        root.setAttribute("data-theme-effective", "dark");
    }
    window.PowTheme = {
        CHOICES: ["dark"],
        get: function () { return "dark"; },
        effective: function () { return "dark"; },
        set: function () { return "dark"; },
        bind: function () {},
    };
})();

// theme choice: dark, light or auto, with dark the default (proposed
// 2026-11-20, pending jb's ruling). r-u2's three-state control (2026-09-19)
// was retired on 2026-09-21 ("the dark theme is beautiful. can we simply
// make that default with no options?"); it returns so a contributor
// recording outdoors can switch to light, which reads in sunlight. nothing
// changes for anyone who does not choose. runs in <head> before the
// stylesheets and marks <html> before paint, so a light page never flashes
// dark and the basemap code reads the same answer. no dependencies.
//   window.PowTheme.get()        -> "dark" | "light" | "auto" (the choice)
//   window.PowTheme.effective()  -> "dark" | "light" (what paints)
//   window.PowTheme.set(choice)  -> stores, applies, fires pow-theme-change
//   window.PowTheme.bind(root)   -> wires [data-theme-choice] buttons
(function () {
    // a new key: the retired control's "pow-theme" may still hold a choice
    // from the day it was live, and reading it would change a screen its
    // owner never asked to change
    var KEY = "pow-theme-choice";
    // the one line to change if auto should be the default
    var DEFAULT_CHOICE = "dark";
    var CHOICES = ["dark", "light", "auto"];
    var root = document.documentElement;
    var query = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    function valid(choice) {
        return CHOICES.indexOf(choice) !== -1;
    }

    function stored() {
        try {
            var value = window.localStorage ? window.localStorage.getItem(KEY) : null;
            return valid(value) ? value : DEFAULT_CHOICE;
        } catch (error) {
            return DEFAULT_CHOICE;
        }
    }

    // the choice in hand: read from storage once at boot, then held here,
    // so a page whose storage is blocked still keeps a choice for its lifetime
    var current = stored();

    // auto follows the device; a browser that cannot say gets dark
    function effectiveFor(choice) {
        if (choice === "light" || choice === "dark") return choice;
        if (!query) return "dark";
        return query.matches ? "dark" : "light";
    }

    function apply(choice) {
        if (!root) return;
        root.setAttribute("data-theme", choice);
        root.setAttribute("data-theme-effective", effectiveFor(choice));
    }

    function syncButtons(scope, choice) {
        if (!scope || typeof scope.querySelectorAll !== "function") return;
        var buttons = scope.querySelectorAll("[data-theme-choice]");
        for (var i = 0; i < buttons.length; i += 1) {
            var on = buttons[i].getAttribute("data-theme-choice") === choice;
            buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
        }
    }

    function announce(choice) {
        var detail = { choice: choice, effective: effectiveFor(choice) };
        if (typeof window.CustomEvent === "function" && typeof window.dispatchEvent === "function") {
            window.dispatchEvent(new window.CustomEvent("pow-theme-change", { detail: detail }));
        }
        syncButtons(document, choice);
    }

    function set(choice) {
        var next = valid(choice) ? choice : DEFAULT_CHOICE;
        try {
            if (window.localStorage) window.localStorage.setItem(KEY, next);
        } catch (error) {
            // storage unavailable: the choice lives for this page only
        }
        current = next;
        apply(next);
        announce(next);
        return next;
    }

    function bind(scope) {
        var target = scope || document;
        if (!target || typeof target.querySelectorAll !== "function") return;
        var buttons = target.querySelectorAll("[data-theme-choice]");
        for (var i = 0; i < buttons.length; i += 1) {
            (function (button) {
                if (button.getAttribute("data-theme-bound") === "1") return;
                button.setAttribute("data-theme-bound", "1");
                button.addEventListener("click", function () {
                    set(button.getAttribute("data-theme-choice"));
                });
            })(buttons[i]);
        }
        syncButtons(target, current);
    }

    // the device's preference changes while auto is chosen: follow it
    function onDeviceChange() {
        if (current !== "auto") return;
        apply("auto");
        announce("auto");
    }
    if (query && typeof query.addEventListener === "function") {
        query.addEventListener("change", onDeviceChange);
    } else if (query && typeof query.addListener === "function") {
        query.addListener(onDeviceChange);
    }

    apply(current);
    if (typeof document.addEventListener === "function") {
        document.addEventListener("DOMContentLoaded", function () { bind(document); });
    }

    window.PowTheme = {
        KEY: KEY,
        DEFAULT: DEFAULT_CHOICE,
        CHOICES: CHOICES.slice(),
        get: function () { return current; },
        effective: function () { return effectiveFor(current); },
        set: set,
        bind: bind,
    };
})();

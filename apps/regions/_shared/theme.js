// theme choice (r-u2, confirmed 2026-09-19): three states, system, light
// and dark, kept on the device and applied to <html> before the page
// paints, so a dark page never flashes light. runs in <head>, before the
// stylesheets, with no dependencies.
//   window.PowTheme.get()        -> "system" | "light" | "dark" (the choice)
//   window.PowTheme.effective()  -> "light" | "dark" (what paints)
//   window.PowTheme.set(choice)  -> stores, applies, fires pow-theme-change
//   window.PowTheme.bind(root)   -> wires [data-theme-choice] buttons
(function () {
    var KEY = "pow-theme";
    var CHOICES = ["system", "light", "dark"];
    var root = document.documentElement;
    var query = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    function stored() {
        try {
            var value = window.localStorage ? window.localStorage.getItem(KEY) : null;
            return value === "light" || value === "dark" ? value : "system";
        } catch (error) {
            return "system";
        }
    }

    function effectiveFor(choice) {
        if (choice === "light" || choice === "dark") return choice;
        return query && query.matches ? "dark" : "light";
    }

    function apply(choice) {
        if (!root) return;
        if (choice === "system") root.removeAttribute("data-theme");
        else root.setAttribute("data-theme", choice);
        root.setAttribute("data-theme-effective", effectiveFor(choice));
    }

    function announce(choice) {
        var detail = { choice: choice, effective: effectiveFor(choice) };
        if (typeof window.CustomEvent === "function") {
            window.dispatchEvent(new window.CustomEvent("pow-theme-change", { detail: detail }));
        }
        syncButtons(document, choice);
    }

    function set(choice) {
        var next = CHOICES.indexOf(choice) === -1 ? "system" : choice;
        try {
            if (window.localStorage) {
                if (next === "system") window.localStorage.removeItem(KEY);
                else window.localStorage.setItem(KEY, next);
            }
        } catch (error) {
            // storage unavailable: the choice lives for this page only
        }
        apply(next);
        announce(next);
        return next;
    }

    function syncButtons(scope, choice) {
        if (!scope || typeof scope.querySelectorAll !== "function") return;
        var buttons = scope.querySelectorAll("[data-theme-choice]");
        for (var i = 0; i < buttons.length; i += 1) {
            var button = buttons[i];
            var on = button.getAttribute("data-theme-choice") === choice;
            button.setAttribute("aria-pressed", on ? "true" : "false");
        }
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
        syncButtons(target, stored());
    }

    // the device's preference changes while auto is chosen: follow it
    if (query && typeof query.addEventListener === "function") {
        query.addEventListener("change", function () {
            if (stored() === "system") {
                apply("system");
                announce("system");
            }
        });
    }

    apply(stored());
    if (typeof document.addEventListener === "function") {
        document.addEventListener("DOMContentLoaded", function () { bind(document); });
    }

    window.PowTheme = {
        KEY: KEY,
        CHOICES: CHOICES.slice(),
        get: stored,
        effective: function () { return effectiveFor(stored()); },
        set: set,
        bind: bind,
    };
})();

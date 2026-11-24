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
//   window.PowTheme.bind(root)   -> marks the pressed [data-theme-choice] button
// a press on any [data-theme-choice] button sets the choice, through one
// listener on the document
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

    // marks the pressed copy in a scope; presses are handled by the one
    // listener below, so binding never adds a handler and a copy built
    // later (the map data panel) needs only this
    function bind(scope) {
        syncButtons(scope || document, current);
    }

    function choiceButton(target) {
        var node = target;
        while (node && typeof node.getAttribute === "function") {
            if (node.getAttribute("data-theme-choice")) return node;
            node = node.parentNode;
        }
        return null;
    }

    // one delegated listener, registered here in <head>: a press works the
    // moment its button is parsed, even while a later script still loads.
    // it listens in the capture phase, because the map's panels stop a
    // click from bubbling (leaflet's disableClickPropagation)
    if (typeof document.addEventListener === "function") {
        document.addEventListener("click", function (event) {
            var button = choiceButton(event && event.target);
            if (button) set(button.getAttribute("data-theme-choice"));
        }, true);
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

    // the header copy is marked as soon as the parser adds it, before the
    // page's later scripts run and before first paint, so the pressed button
    // matches the painted theme; the watch ends with parsing
    function holdsChoice(node) {
        if (!node || node.nodeType !== 1) return false;
        if (typeof node.getAttribute === "function" && node.getAttribute("data-theme-choice")) return true;
        return typeof node.querySelector === "function" && Boolean(node.querySelector("[data-theme-choice]"));
    }
    var watcher = null;
    if (typeof window.MutationObserver === "function" && root) {
        watcher = new window.MutationObserver(function (records) {
            for (var i = 0; i < records.length; i += 1) {
                var added = records[i].addedNodes || [];
                for (var j = 0; j < added.length; j += 1) {
                    if (holdsChoice(added[j])) {
                        syncButtons(document, current);
                        return;
                    }
                }
            }
        });
        watcher.observe(root, { childList: true, subtree: true });
    }
    if (typeof document.addEventListener === "function") {
        document.addEventListener("DOMContentLoaded", function () {
            if (watcher) watcher.disconnect();
            bind(document);
        });
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

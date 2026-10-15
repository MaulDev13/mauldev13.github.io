// js/core/theme.js
//
// Light / dark theme management.
// - Persists the user's explicit choice in localStorage ("theme" = "light"|"dark").
// - When no explicit choice exists, the CSS falls back to the OS preference
//   via @media (prefers-color-scheme) (see tokens.css).
// - Keeps the navbar toggle icon in sync, including after HTMX swaps the navbar in.

(function () {

    const STORAGE_KEY = "theme";
    const DARK = "dark";
    const LIGHT = "light";

    /* =========================================================
       State helpers
    ========================================================= */

    function storedTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (_) {
            return null;
        }
    }

    function systemPrefersDark() {
        return window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    // The theme actually in effect right now.
    function effectiveTheme() {
        const saved = storedTheme();
        if (saved === DARK || saved === LIGHT) return saved;
        return systemPrefersDark() ? DARK : LIGHT;
    }

    /* =========================================================
       Apply
    ========================================================= */

    function applyTheme(theme) {
        // Setting data-theme makes the choice explicit and wins over the
        // system media query (tokens.css keys dark off both).
        document.documentElement.setAttribute("data-theme", theme);
        syncToggleIcon(theme);
    }

    function syncToggleIcon(theme) {
        const icon = document.querySelector("#theme-toggle .theme-toggle-icon");
        if (!icon) return;
        // Show the icon for the action the button performs.
        icon.textContent = theme === DARK ? "☀️" : "🌙";
    }

    /* =========================================================
       Toggle
    ========================================================= */

    function toggleTheme() {
        const next = effectiveTheme() === DARK ? LIGHT : DARK;
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch (_) { /* storage unavailable; still apply for this session */ }
        applyTheme(next);
    }

    /* =========================================================
       Wiring
    ========================================================= */

    // Apply the current theme immediately (the <head> inline script already
    // set data-theme to avoid a flash; this re-affirms and syncs the icon).
    applyTheme(effectiveTheme());

    // Toggle via event delegation — the navbar is injected by HTMX later.
    document.body.addEventListener("click", function (event) {
        if (event.target.closest("#theme-toggle")) {
            toggleTheme();
        }
    });

    // When HTMX swaps in the navbar (or any fragment), re-sync the icon.
    document.body.addEventListener("htmx:afterSwap", function () {
        syncToggleIcon(effectiveTheme());
    });

    // React to OS changes only while the user has made no explicit choice.
    if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)")
            .addEventListener("change", function () {
                if (!storedTheme()) applyTheme(effectiveTheme());
            });
    }

    // Optional global access.
    window.toggleTheme = toggleTheme;
    window.applyTheme = applyTheme;

})();

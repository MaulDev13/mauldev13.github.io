// js/core/loading.js

(function () {

    const loadingEl = document.getElementById("loading");

    if (!loadingEl) return;

    function showLoading() {
        loadingEl.classList.remove("hidden");
    }

    function hideLoading() {
        loadingEl.classList.add("hidden");
    }

    /* =========================================================
       HTMX Loading Events
    ========================================================= */

    document.body.addEventListener(
        "htmx:beforeRequest",
        showLoading
    );

    document.body.addEventListener(
        "htmx:afterRequest",
        hideLoading
    );

    /* =========================================================
       Optional global access
    ========================================================= */

    window.showLoading = showLoading;
    window.hideLoading = hideLoading;

})();
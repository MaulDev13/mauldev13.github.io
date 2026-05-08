// js/core/error.js

(function () {

    let isHandlingError = false;

    const loadingEl = document.getElementById("loading");

    /* =========================================================
       Helpers
    ========================================================= */

    function hideLoading() {
        loadingEl?.classList.add("hidden");
    }

    function resetErrorState() {
        isHandlingError = false;
    }

    /* =========================================================
       Error Page Loader
    ========================================================= */

    function safeLoadError(path) {

        if (isHandlingError) return;

        isHandlingError = true;

        htmx.ajax("GET", path, {
            target: "#content",
            swap: "innerHTML"
        });
    }

    /* =========================================================
       Error Router
    ========================================================= */

    function handleError(status) {

        if (status === 404) {
            safeLoadError("/pages/errors/404.html");
            return;
        }

        if (status >= 500) {
            safeLoadError("/pages/errors/500.html");
            return;
        }

        safeLoadError("/pages/errors/general.html");
    }

    /* =========================================================
       HTMX Error Events
    ========================================================= */

    document.body.addEventListener("htmx:responseError", (event) => {

        hideLoading();

        const status = event.detail.xhr.status;

        console.error("HTMX Error:", {
            status,
            response: event.detail.xhr.responseText
        });

        handleError(status);
    });

    document.body.addEventListener("htmx:sendError", () => {

        hideLoading();

        safeLoadError("/pages/errors/network.html");
    });

    /* =========================================================
       Reset lock after successful swap
    ========================================================= */

    document.body.addEventListener("htmx:afterSwap", resetErrorState);

    /* =========================================================
       Optional global exposure
    ========================================================= */

    window.handleError  = handleError;
    window.safeLoadError = safeLoadError;

})();
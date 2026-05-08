// js/core/router.js

(function () {

    const {
        API_BASE,
        BASE_PATH
    } = window.CONFIG;

    document.body.addEventListener("htmx:configRequest", function (event) {

        let path = event.detail.path;

        if (!path) return;

        // API request
        if (path.startsWith("/api")) {
            event.detail.path = API_BASE + path;
            return;
        }

        // Local page/component
        if (!path.startsWith("http")) {
            event.detail.path = BASE_PATH + path;
        }
    });

})();
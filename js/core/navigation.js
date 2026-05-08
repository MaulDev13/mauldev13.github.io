// js/core/navigation.js

(function () {

    /* =========================================================
       Active Navigation State
    ========================================================= */

    function clearActive() {

        document
            .querySelectorAll(".nav-btn")
            .forEach(btn => btn.classList.remove("is-active"));
    }

    function setActive(button) {

        if (!button) return;

        clearActive();

        button.classList.add("is-active");
    }

    /* =========================================================
       Click Delegation
    ========================================================= */

    document.body.addEventListener("click", function (event) {

        const button = event.target.closest(".nav-btn");

        if (!button) return;

        setActive(button);
    });

    /* =========================================================
       Optional Global Access
    ========================================================= */

    window.setActiveNav = setActive;
    window.clearActiveNav = clearActive;

})();
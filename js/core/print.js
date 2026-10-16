// js/core/print.js
//
// Browsers print the document <title> ("Maul Dev") in the page header.
// There is no CSS to remove that text directly, so we blank the title
// just before printing and restore it afterwards. Covers both the print
// dialog (beforeprint/afterprint) and the matchMedia('print') fallback.

(function () {

    let savedTitle = null;

    function clearTitle() {
        if (savedTitle === null) {
            savedTitle = document.title;
            // A single space keeps the title element valid while printing
            // nothing visible in the header.
            document.title = " ";
        }
    }

    function restoreTitle() {
        if (savedTitle !== null) {
            document.title = savedTitle;
            savedTitle = null;
        }
    }

    window.addEventListener("beforeprint", clearTitle);
    window.addEventListener("afterprint", restoreTitle);

    // Fallback for browsers that fire matchMedia('print') instead.
    if (window.matchMedia) {
        const mq = window.matchMedia("print");
        mq.addEventListener("change", function (e) {
            if (e.matches) clearTitle();
            else restoreTitle();
        });
    }

})();

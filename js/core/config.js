// js/core/config.js

window.CONFIG = {

    API_BASE: document
        .querySelector('meta[name="api-base"]')
        ?.getAttribute("content") || "",

    BASE_PATH: ""
};
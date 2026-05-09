/* =========================================================
   skill-tree.js
   Drag · Collapse · ERD Lines · Zoom · Camera
   ========================================================= */

// ── Constants ────────────────────────────────────────────

const STROKE_COLOR  = "#94a3b8";
const STROKE_WIDTH  = "1.5";
const DASH_ARRAY    = "6 3";
const MARKER_ID     = "crow-many";
const VIEWPORT_W    = 4000;
const VIEWPORT_H    = 4000;
const MIN_ZOOM      = 0.3;
const MAX_ZOOM      = 2.0;
const ZOOM_SPEED    = 0.001;

// ── State ────────────────────────────────────────────────

let activeNode      = null;
let offsetX         = 0;
let offsetY         = 0;
let zoomLevel       = 1;
let globalInited    = false;   // listeners global hanya sekali
let rafPending      = false;   // RAF throttle untuk drawLines

// =========================================================
// SVG — markers
// =========================================================

function initSVG() {

    const svg = document.getElementById("tree-lines");
    if (!svg) return;

    if (svg.querySelector(`#${MARKER_ID}`)) return; // sudah ada

    svg.innerHTML = `
        <defs>
            <marker id="${MARKER_ID}"
                viewBox="0 0 16 16" refX="14" refY="8"
                markerWidth="10" markerHeight="10" orient="auto">
                <line x1="2"  y1="4"  x2="14" y2="8"  stroke="${STROKE_COLOR}" stroke-width="1.5" fill="none"/>
                <line x1="2"  y1="12" x2="14" y2="8"  stroke="${STROKE_COLOR}" stroke-width="1.5" fill="none"/>
                <line x1="2"  y1="2"  x2="2"  y2="14" stroke="${STROKE_COLOR}" stroke-width="1.5" fill="none"/>
            </marker>
        </defs>`;
}

// =========================================================
// Connections — baca dari data-connect
// =========================================================

function readConnections() {

    const result = [];

    document.querySelectorAll("[data-connect]").forEach(node => {

        const attr = node.dataset.connect.trim();
        if (!attr) return;

        attr.split(/\s+/).forEach(targetId => {
            if (targetId && document.getElementById(targetId)) {
                result.push([node.id, targetId]);
            }
        });
    });

    return result;
}

// ── Port: sisi node yang paling dekat ke target ──────────

function getEdgePort(nodeEl, otherEl) {

    const nx = nodeEl.offsetLeft,  ny = nodeEl.offsetTop;
    const nw = nodeEl.offsetWidth, nh = nodeEl.offsetHeight;
    const dx = otherEl.offsetLeft - nx;
    const dy = otherEl.offsetTop  - ny;

    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0
            ? { x: nx + nw, y: ny + nh / 2 }
            : { x: nx,      y: ny + nh / 2 };
    }

    return dy >= 0
        ? { x: nx + nw / 2, y: ny + nh }
        : { x: nx + nw / 2, y: ny };
}

// ── Bezier path dengan controlOffset smooth ──────────────

function createEdge(portA, portB, svg) {

    const dx     = Math.abs(portB.x - portA.x);
    const dy     = Math.abs(portB.y - portA.y);
    const offset = Math.min(Math.max(dx, dy) * 0.3, 150);

    const d = dx >= dy
        ? `M${portA.x},${portA.y} C${portA.x + offset},${portA.y} ${portB.x - offset},${portB.y} ${portB.x},${portB.y}`
        : `M${portA.x},${portA.y} C${portA.x},${portA.y + offset} ${portB.x},${portB.y - offset} ${portB.x},${portB.y}`;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d",                d);
    path.setAttribute("fill",             "none");
    path.setAttribute("stroke",           STROKE_COLOR);
    path.setAttribute("stroke-width",     STROKE_WIDTH);
    path.setAttribute("stroke-dasharray", DASH_ARRAY);
    path.setAttribute("stroke-opacity",   "0.75");
    path.setAttribute("stroke-linecap",   "round");
    path.setAttribute("marker-end",       `url(#${MARKER_ID})`);
    path.classList.add("edge");

    svg.appendChild(path);
}

// ── drawLines — RAF throttled ─────────────────────────────
// Garis SELALU digambar — tidak peduli node collapsed atau tidak.
// Port dihitung dari ukuran node saat ini (collapsed = lebih kecil).

function drawLines() {

    if (rafPending) return;
    rafPending = true;

    requestAnimationFrame(() => {
        rafPending = false;

        const svg = document.getElementById("tree-lines");
        if (!svg) return;

        svg.querySelectorAll(".edge").forEach(el => el.remove());

        readConnections().forEach(([fromId, toId]) => {

            const fromEl = document.getElementById(fromId);
            const toEl   = document.getElementById(toId);
            if (!fromEl || !toEl) return;

            createEdge(
                getEdgePort(fromEl, toEl),
                getEdgePort(toEl, fromEl),
                svg
            );
        });
    });
}

// =========================================================
// Zoom — Ctrl+Wheel
// =========================================================

function initZoom() {

    const container = document.querySelector(".tree-container");
    if (!container) return;

    container.addEventListener("wheel", e => {

        if (!e.ctrlKey) return;
        e.preventDefault();

        zoomLevel = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, zoomLevel - e.deltaY * ZOOM_SPEED)
        );

        applyZoom();

    }, { passive: false });
}

function applyZoom() {

    const viewport = document.querySelector(".tree-viewport");
    if (!viewport) return;

    viewport.style.transform = `scale(${zoomLevel})`;

    const label = document.getElementById("zoom-level");
    if (label) label.textContent = Math.round(zoomLevel * 100) + "%";

    drawLines();
}

// Public API
window.setZoom = function (value) {
    zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    applyZoom();
};

// =========================================================
// Viewport — scroll ke tengah saat init
// =========================================================

function initViewport() {

    const container = document.querySelector(".tree-container");
    if (!container) return;

    container.scrollLeft = (VIEWPORT_W - container.clientWidth)  / 2;
    container.scrollTop  = (VIEWPORT_H - container.clientHeight) / 2;
}

// =========================================================
// Camera — scroll ke node tertentu
// =========================================================

function centerCamera(nodeId) {

    const container = document.querySelector(".tree-container");
    if (!container) return;

    let targetLeft, targetTop;

    if (nodeId) {

        const node = document.getElementById(nodeId);

        if (node) {
            // Posisi node di viewport space
            const nodeX = parseFloat(node.style.left) || 0;
            const nodeY = parseFloat(node.style.top)  || 0;
            const nw    = node.offsetWidth;
            const nh    = node.offsetHeight;

            // Scroll supaya center node = center container
            targetLeft = nodeX + nw / 2 - container.clientWidth  / 2;
            targetTop  = nodeY + nh / 2 - container.clientHeight / 2;
        }
    }

    // Fallback: tengah viewport
    if (targetLeft === undefined) {
        targetLeft = (VIEWPORT_W - container.clientWidth)  / 2;
        targetTop  = (VIEWPORT_H - container.clientHeight) / 2;
    }

    container.scrollTo({
        left:     Math.max(0, targetLeft),
        top:      Math.max(0, targetTop),
        behavior: "smooth",
    });
}

// =========================================================
// Nodes — posisi awal dari data-x/y
// =========================================================

function placeNodes() {

    // Offset dari tengah viewport
    const midX = VIEWPORT_W / 2;
    const midY = VIEWPORT_H / 2;

    document.querySelectorAll(".tree-node, .tree-node--circle, .tree-node--leaf").forEach(node => {

        const relX = parseFloat(node.dataset.x) || 0;
        const relY = parseFloat(node.dataset.y) || 0;

        node.style.left = (midX + relX) + "px";
        node.style.top  = (midY + relY) + "px";
    });
}

// =========================================================
// Drag
// =========================================================

function startDrag(node, clientX, clientY) {

    activeNode = node;

    const container  = document.querySelector(".tree-container");
    const canvasRect = container.getBoundingClientRect();

    // Koordinat kursor dalam ruang viewport (termasuk scroll + zoom)
    const cursorX = (clientX - canvasRect.left + container.scrollLeft) / zoomLevel;
    const cursorY = (clientY - canvasRect.top  + container.scrollTop)  / zoomLevel;

    offsetX = cursorX - (parseFloat(node.style.left) || 0);
    offsetY = cursorY - (parseFloat(node.style.top)  || 0);

    node.classList.add("dragging");
    node.style.zIndex = "999";
}

function moveActive(clientX, clientY) {

    if (!activeNode) return;

    const container  = document.querySelector(".tree-container");
    if (!container) return;

    const canvasRect = container.getBoundingClientRect();

    const x = (clientX - canvasRect.left + container.scrollLeft) / zoomLevel - offsetX;
    const y = (clientY - canvasRect.top  + container.scrollTop)  / zoomLevel - offsetY;

    // Soft bounds: node tidak keluar dari viewport
    activeNode.style.left = Math.max(0, Math.min(VIEWPORT_W - activeNode.offsetWidth,  x)) + "px";
    activeNode.style.top  = Math.max(0, Math.min(VIEWPORT_H - activeNode.offsetHeight, y)) + "px";

    drawLines();
}

function endActive() {

    if (!activeNode) return;

    activeNode.classList.remove("dragging");
    activeNode.style.zIndex = "";

    // Persist
    activeNode.dataset.x = parseFloat(activeNode.style.left);
    activeNode.dataset.y = parseFloat(activeNode.style.top);

    activeNode = null;
    drawLines();
}

// =========================================================
// Global listeners — sekali seumur halaman
// =========================================================

function initGlobalListeners() {

    if (globalInited) return;
    globalInited = true;

    document.addEventListener("mousemove", e => {
        if (activeNode) moveActive(e.clientX, e.clientY);
    });

    document.addEventListener("mouseup", () => endActive());

    document.addEventListener("touchmove", e => {
        if (activeNode) {
            e.preventDefault();
            moveActive(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });

    document.addEventListener("touchend", () => endActive());
}

// ── Named handlers ────────────────────────────────────────

function handleMouseDown(e) {
    if (e.target.closest(".tree-header, .tree-node__header, .tree-controls")) return;
    e.preventDefault();
    startDrag(this, e.clientX, e.clientY);
}

function handleTouchStart(e) {
    if (e.target.closest(".tree-header, .tree-node__header, .tree-controls")) return;
    startDrag(this, e.touches[0].clientX, e.touches[0].clientY);
}

function handleHeaderClick(e) {
    e.stopPropagation();

    // Support kedua class convention: .tree-header dan .tree-node__header
    const node = this.closest(".tree-node");
    if (!node) return;

    // Toggle collapsed state
    const isCollapsed = node.classList.toggle("is-collapsed");

    // Sembunyikan content (gunakan class .hidden yang ada di base.css)
    const content = node.querySelector(".tree-content, .tree-node__content");
    if (content) content.classList.toggle("hidden", isCollapsed);

    // Garis tetap digambar — port dihitung dari ukuran node saat ini
    drawLines();
}

// =========================================================
// Per-node init — dipanggil tiap HTMX swap
// =========================================================

function initNodes() {

    document.querySelectorAll(".tree-node, .tree-node--circle, .tree-node--leaf").forEach(node => {

        node.removeEventListener("mousedown",  handleMouseDown);
        node.removeEventListener("touchstart", handleTouchStart);
        node.addEventListener("mousedown",  handleMouseDown);
        node.addEventListener("touchstart", handleTouchStart, { passive: true });
    });
}

function initCollapse() {

    document.querySelectorAll(".tree-header, .tree-node__header").forEach(header => {

        header.style.cursor = "pointer";
        header.removeEventListener("click", handleHeaderClick);
        header.addEventListener("click", handleHeaderClick);
    });
}

// =========================================================
// Bootstrap
// =========================================================

function initSkillTree(anchorNodeId = null) {

    const svg = document.getElementById("tree-lines");
    if (!svg) return;

    initSVG();
    initGlobalListeners(); // sekali
    initNodes();           // tiap swap
    initCollapse();        // tiap swap
    initZoom();

    requestAnimationFrame(() => {
        placeNodes();
        initViewport();
        applyZoom();
        drawLines();

        // Scroll ke anchor setelah layout selesai
        if (anchorNodeId) {
            setTimeout(() => centerCamera(anchorNodeId), 100);
        }
    });
}

// =========================================================
// Public API
// =========================================================

window.initSkillTree        = initSkillTree;
window.drawLines            = drawLines;
window.setZoom              = window.setZoom; // sudah di-set di atas

window.focusOnNode = function (nodeId) {

    const node = document.getElementById(nodeId);
    if (!node) return;

    // Highlight singkat
    node.style.transition  = "box-shadow .15s ease";
    node.style.boxShadow   = "0 0 0 3px var(--primary, #14b8a6), 0 8px 24px rgba(0,0,0,.12)";

    setTimeout(() => {
        node.style.boxShadow  = "";
        node.style.transition = "";
    }, 800);

    centerCamera(nodeId);
};

window.resetCamera = function () {
    centerCamera(null);
};

// =========================================================
// HTMX lifecycle — hanya afterSwap
// =========================================================

document.body.addEventListener("htmx:afterSwap", () => {
    if (document.getElementById("tree-lines")) {
        initSkillTree();
    }
});
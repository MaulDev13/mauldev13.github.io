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

        const next = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, zoomLevel - e.deltaY * ZOOM_SPEED)
        );

        // Zoom di titik kursor supaya terasa natural.
        const rect = container.getBoundingClientRect();
        applyZoom(next, e.clientX - rect.left, e.clientY - rect.top);

    }, { passive: false });
}

// applyZoom(nextZoom?, anchorX?, anchorY?)
//   - anchorX/Y: titik (dalam koordinat container, px) yang posisinya
//     dipertahankan saat zoom. Default: tengah container.
//   Viewport memakai transform-origin: 0 0, jadi:
//     screen = point * zoom - scroll   →   point = (screen + scroll) / zoom
function applyZoom(nextZoom = zoomLevel, anchorX, anchorY) {

    const container = document.querySelector(".tree-container");
    const viewport  = document.querySelector(".tree-viewport");
    if (!viewport) return;

    const prevZoom = zoomLevel;
    const newZoom  = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));

    if (container) {
        const ax = (anchorX === undefined) ? container.clientWidth  / 2 : anchorX;
        const ay = (anchorY === undefined) ? container.clientHeight / 2 : anchorY;

        // Titik viewport yang berada di bawah anchor sebelum zoom.
        const pointX = (container.scrollLeft + ax) / prevZoom;
        const pointY = (container.scrollTop  + ay) / prevZoom;

        zoomLevel = newZoom;
        viewport.style.transform = `scale(${newZoom})`;

        // Setel ulang scroll supaya titik yang sama tetap di bawah anchor.
        container.scrollLeft = pointX * newZoom - ax;
        container.scrollTop  = pointY * newZoom - ay;
    } else {
        zoomLevel = newZoom;
        viewport.style.transform = `scale(${newZoom})`;
    }

    const label = document.getElementById("zoom-level");
    if (label) label.textContent = Math.round(newZoom * 100) + "%";

    drawLines();
}

// Public API
window.setZoom = function (value) {
    // Tombol/keyboard: zoom di tengah container.
    applyZoom(value);
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

            // Viewport di-scale dari origin 0 0, jadi koordinat node
            // dikali zoomLevel. Scroll supaya center node = center container.
            targetLeft = (nodeX + nw / 2) * zoomLevel - container.clientWidth  / 2;
            targetTop  = (nodeY + nh / 2) * zoomLevel - container.clientHeight / 2;
        }
    }

    // Fallback: tengah viewport (ikut skala)
    if (targetLeft === undefined) {
        targetLeft = (VIEWPORT_W / 2) * zoomLevel - container.clientWidth  / 2;
        targetTop  = (VIEWPORT_H / 2) * zoomLevel - container.clientHeight / 2;
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

        // Simpan posisi awal (relatif) sekali saja, untuk fitur Reset.
        if (node.dataset.ox === undefined) {
            node.dataset.ox = node.dataset.x || "0";
            node.dataset.oy = node.dataset.y || "0";
        }

        const relX = parseFloat(node.dataset.x) || 0;
        const relY = parseFloat(node.dataset.y) || 0;

        node.style.left = (midX + relX) + "px";
        node.style.top  = (midY + relY) + "px";
    });
}

// =========================================================
// Bounding box semua node (dalam viewport space)
// =========================================================

function getNodesBounds() {

    const nodes = document.querySelectorAll(".tree-node, .tree-node--circle, .tree-node--leaf");
    if (nodes.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
        const left   = parseFloat(node.style.left) || 0;
        const top    = parseFloat(node.style.top)  || 0;
        const right  = left + node.offsetWidth;
        const bottom = top  + node.offsetHeight;

        if (left   < minX) minX = left;
        if (top    < minY) minY = top;
        if (right  > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
    });

    return {
        minX, minY, maxX, maxY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
    };
}

// =========================================================
// Recenter — scroll supaya center bounding box = center container
// =========================================================

function centerOnAllNodes(smooth = true) {

    const container = document.querySelector(".tree-container");
    if (!container) return;

    // Container mungkin belum punya ukuran (panel baru saja di-unhide /
    // HTMX baru swap). Tunggu sampai ter-layout, lalu ulangi.
    if (container.clientWidth === 0 || container.clientHeight === 0) {
        requestAnimationFrame(() => centerOnAllNodes(smooth));
        return;
    }

    const bounds = getNodesBounds();
    if (!bounds) {
        // Fallback: tengah viewport
        container.scrollTo({
            left: (VIEWPORT_W - container.clientWidth)  / 2,
            top:  (VIEWPORT_H - container.clientHeight) / 2,
            behavior: smooth ? "smooth" : "auto",
        });
        return;
    }

    // Node diposisikan dalam ruang viewport; saat di-zoom, viewport
    // di-scale, jadi koordinat scroll ikut dikali zoomLevel.
    const targetLeft = bounds.centerX * zoomLevel - container.clientWidth  / 2;
    const targetTop  = bounds.centerY * zoomLevel - container.clientHeight / 2;

    container.scrollTo({
        left: Math.max(0, targetLeft),
        top:  Math.max(0, targetTop),
        behavior: smooth ? "smooth" : "auto",
    });
}

// =========================================================
// Reset layout — kembalikan semua node ke posisi awal
// =========================================================

function resetLayout() {

    const midX = VIEWPORT_W / 2;
    const midY = VIEWPORT_H / 2;

    document.querySelectorAll(".tree-node, .tree-node--circle, .tree-node--leaf").forEach(node => {

        const ox = parseFloat(node.dataset.ox) || 0;
        const oy = parseFloat(node.dataset.oy) || 0;

        // Kembalikan data-x/y ke nilai awal dan terapkan posisinya.
        node.dataset.x = String(ox);
        node.dataset.y = String(oy);

        node.style.left = (midX + ox) + "px";
        node.style.top  = (midY + oy) + "px";

        // Buka kembali node yang mungkin ter-collapse.
        node.classList.remove("is-collapsed");
        const content = node.querySelector(".tree-node__content, .tree-content");
        if (content) content.classList.remove("hidden");
    });

    drawLines();
    centerOnAllNodes(true);
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

        // Setelah layout selesai, pusatkan kamera ke seluruh node
        // (bukan ke node tunggal yang mungkin tidak ada di map ini).
        setTimeout(() => {
            if (anchorNodeId && document.getElementById(anchorNodeId)) {
                centerCamera(anchorNodeId);
            } else {
                centerOnAllNodes(false);
            }
        }, 60);
    });
}

// =========================================================
// Public API
// =========================================================

window.initSkillTree        = initSkillTree;
window.drawLines            = drawLines;
window.setZoom              = window.setZoom; // sudah di-set di atas
window.centerOnAllNodes     = centerOnAllNodes;
window.resetLayout          = resetLayout;

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
    centerOnAllNodes(true);
};

// =========================================================
// HTMX lifecycle — hanya afterSwap
// =========================================================

document.body.addEventListener("htmx:afterSwap", () => {
    if (document.getElementById("tree-lines")) {
        initSkillTree();
    }
});
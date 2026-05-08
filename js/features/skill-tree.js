/* =========================================================
   ui-interactive.js
   Skill Tree — Drag, Collapse, ERD Connections
   ========================================================= */

// ── Constants ────────────────────────────────────────────

const STROKE_COLOR = "#94a3b8";
const STROKE_WIDTH = "1.5";
const DASH_ARRAY   = "6 3";
const MARKER_ID    = "crow-many";

// ── State ────────────────────────────────────────────────

let activeNode   = null;
let offsetX      = 0;
let offsetY      = 0;
let globalInited = false; // guard: global listeners hanya didaftarkan sekali

// ── Init SVG markers ─────────────────────────────────────

function initSVG() {

    const svg = document.getElementById("tree-lines");
    if (!svg) return;

    svg.innerHTML = `
        <defs>
            <marker
                id="${MARKER_ID}"
                viewBox="0 0 16 16"
                refX="14" refY="8"
                markerWidth="10" markerHeight="10"
                orient="auto"
            >
                <line x1="2"  y1="4"  x2="14" y2="8"  stroke="${STROKE_COLOR}" stroke-width="1.5" fill="none"/>
                <line x1="2"  y1="12" x2="14" y2="8"  stroke="${STROKE_COLOR}" stroke-width="1.5" fill="none"/>
                <line x1="2"  y1="2"  x2="2"  y2="14" stroke="${STROKE_COLOR}" stroke-width="1.5" fill="none"/>
            </marker>
        </defs>
    `;
}

// ── Read connections dari data-connect ───────────────────

function readConnections() {

    const connections = [];

    document.querySelectorAll(".tree-node[data-connect]").forEach(node => {

        const targets = node.dataset.connect.trim().split(/\s+/);

        targets.forEach(targetId => {
            if (targetId && document.getElementById(targetId)) {
                connections.push([node.id, targetId]);
            }
        });
    });

    return connections;
}

// ── Tentukan sisi node mana yang jadi port keluar ────────

function getEdgePort(nodeEl, otherEl) {

    const nx = nodeEl.offsetLeft;
    const ny = nodeEl.offsetTop;
    const nw = nodeEl.offsetWidth;
    const nh = nodeEl.offsetHeight;

    const dx = otherEl.offsetLeft - nx;
    const dy = otherEl.offsetTop  - ny;

    const cx = nx + nw / 2;
    const cy = ny + nh / 2;

    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0
            ? { x: nx + nw, y: cy }
            : { x: nx,      y: cy };
    }

    return dy >= 0
        ? { x: cx, y: ny + nh }
        : { x: cx, y: ny };
}

// ── Buat satu path bezier ─────────────────────────────────

function createEdge(portA, portB, svg) {

    const midX = (portA.x + portB.x) / 2;
    const midY = (portA.y + portB.y) / 2;

    const dx = Math.abs(portB.x - portA.x);
    const dy = Math.abs(portB.y - portA.y);

    const d = dx >= dy
        ? `M${portA.x},${portA.y} C${midX},${portA.y} ${midX},${portB.y} ${portB.x},${portB.y}`
        : `M${portA.x},${portA.y} C${portA.x},${midY} ${portB.x},${midY} ${portB.x},${portB.y}`;

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

// ── Redraw semua garis ────────────────────────────────────

function drawLines() {

    const svg = document.getElementById("tree-lines");
    if (!svg) return;

    svg.querySelectorAll(".edge, .edge-label, .edge-label-bg").forEach(el => el.remove());

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
}

// ── Drag helpers ─────────────────────────────────────────

function startDrag(node, clientX, clientY) {

    activeNode = node;
    const rect = node.getBoundingClientRect();

    offsetX = clientX - rect.left;
    offsetY = clientY - rect.top;

    node.classList.add("dragging");
    node.style.zIndex = "999";
}

function moveActive(clientX, clientY) {

    if (!activeNode) return;

    const canvas = document.querySelector(".tree-container");
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    const x = clientX - rect.left - offsetX;
    const y = clientY - rect.top  - offsetY;

    const maxX = canvas.offsetWidth  - activeNode.offsetWidth;
    const maxY = canvas.offsetHeight - activeNode.offsetHeight;

    activeNode.style.left = Math.max(0, Math.min(maxX, x)) + "px";
    activeNode.style.top  = Math.max(0, Math.min(maxY, y)) + "px";

    drawLines();
}

function endActive() {

    if (!activeNode) return;

    activeNode.classList.remove("dragging");
    activeNode.style.zIndex = "";

    activeNode.dataset.x = parseFloat(activeNode.style.left);
    activeNode.dataset.y = parseFloat(activeNode.style.top);

    activeNode = null;
}

// ── Global listeners — hanya sekali ──────────────────────

function initGlobalListeners() {

    if (globalInited) return;
    globalInited = true;

    document.addEventListener("mousemove", e => moveActive(e.clientX, e.clientY));
    document.addEventListener("mouseup",   () => endActive());

    document.addEventListener("touchmove", e => {
        moveActive(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    document.addEventListener("touchend", () => endActive());
}

// ── Event handlers — named functions agar removeEventListener bekerja ──

function handleMouseDown(e) {

    // Klik di header → collapse, bukan drag
    if (e.target.closest(".tree-header")) return;

    e.preventDefault();
    startDrag(this, e.clientX, e.clientY);
}

function handleTouchStart(e) {

    startDrag(this, e.touches[0].clientX, e.touches[0].clientY);
}

function handleHeaderClick() {

    const content = this.nextElementSibling;
    if (!content) return;

    content.classList.toggle("hidden");
    drawLines();
}

// ── Per-node init — dipanggil ulang tiap HTMX swap ───────

function initNodes() {

    document.querySelectorAll(".tree-node").forEach(node => {

        // Posisi awal
        node.style.left = (parseFloat(node.dataset.x) || 0) + "px";
        node.style.top  = (parseFloat(node.dataset.y) || 0) + "px";

        // Hapus listener lama dulu (jaga dari double-attach)
        node.removeEventListener("mousedown",  handleMouseDown);
        node.removeEventListener("touchstart", handleTouchStart);

        node.addEventListener("mousedown",  handleMouseDown);
        node.addEventListener("touchstart", handleTouchStart, { passive: true });
    });
}

function initCollapse() {

    document.querySelectorAll(".tree-header").forEach(header => {

        header.style.cursor = "pointer";

        header.removeEventListener("click", handleHeaderClick);
        header.addEventListener("click", handleHeaderClick);
    });
}

// ── Bootstrap — dipanggil dari htmx:afterSwap ─────────────

function initSkillTree() {

    const svg = document.getElementById("tree-lines");
    if (!svg) return;

    initSVG();
    initGlobalListeners();
    initNodes();
    initCollapse();
    drawLines();
}

/* =========================================================
   Auto Bootstrap
========================================================= */

function bootstrapSkillTree() {

    if (!document.getElementById("tree-lines")) return;

    initSkillTree();
}

/* =========================================================
   HTMX Lifecycle
========================================================= */

document.body.addEventListener(
    "htmx:afterSwap",
    bootstrapSkillTree
);

/* =========================================================
   Optional Manual Access
========================================================= */

window.initSkillTree = initSkillTree;
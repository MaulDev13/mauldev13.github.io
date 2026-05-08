/* =========================================================
   skill-tree.js
   Skill Tree — Drag, Collapse, ERD Connections (Fixed)
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
let globalInited = false;
let dragFrame    = null; // Untuk RAF throttling

let zoomLevel = 1;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.6;
const ZOOM_SPEED = 0.001;

let hasCenteredCamera = false;

// ── Init SVG markers ─────────────────────────────────────

function initSVG() {
    const svg = document.getElementById("tree-lines");
    if (!svg) return;

    // Cek apakah markers sudah ada
    if (svg.querySelector(`#${MARKER_ID}`)) return;

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
        const connectAttr = node.dataset.connect.trim();
        if (!connectAttr) return;

        const targets = connectAttr.split(/\s+/);

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
    const dy = otherEl.offsetTop - ny;

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

    // Bezier curve yang lebih smooth
    const controlOffset = Math.min(Math.max(dx, dy) * 0.3, 150);
    
    let d;
    if (dx >= dy) {
        d = `M${portA.x},${portA.y} C${portA.x + controlOffset},${portA.y} ${portB.x - controlOffset},${portB.y} ${portB.x},${portB.y}`;
    } else {
        d = `M${portA.x},${portA.y} C${portA.x},${portA.y + controlOffset} ${portB.x},${portB.y - controlOffset} ${portB.x},${portB.y}`;
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", STROKE_COLOR);
    path.setAttribute("stroke-width", STROKE_WIDTH);
    path.setAttribute("stroke-dasharray", DASH_ARRAY);
    path.setAttribute("stroke-opacity", "0.75");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("marker-end", `url(#${MARKER_ID})`);
    path.classList.add("edge");

    svg.appendChild(path);
}

// ── Redraw semua garis (dengan debounce) ─────────────────

let drawLinesTimeout = null;

function drawLines() {
    // Clear previous timeout
    if (drawLinesTimeout) {
        cancelAnimationFrame(drawLinesTimeout);
    }
    
    drawLinesTimeout = requestAnimationFrame(() => {
        const svg = document.getElementById("tree-lines");
        if (!svg) return;

        // Hanya hapus edge, jangan hapus defs
        svg.querySelectorAll(".edge").forEach(el => el.remove());

        const connections = readConnections();
        
        connections.forEach(([fromId, toId]) => {
            const fromEl = document.getElementById(fromId);
            const toEl = document.getElementById(toId);

            if (!fromEl || !toEl) return;
            
            // Skip jika node collapsed atau hidden
            const fromContent = fromEl.querySelector('.tree-content');
            const toContent = toEl.querySelector('.tree-content');
            if (fromContent?.classList?.contains('hidden') || 
                toContent?.classList?.contains('hidden')) {
                return;
            }

            createEdge(
                getEdgePort(fromEl, toEl),
                getEdgePort(toEl, fromEl),
                svg
            );
        });
        
        drawLinesTimeout = null;
    });
}

// ── Zoom ─────────────────────────────────────────────────

function initZoom() {
    const container = document.querySelector(".tree-container");
    if (!container) return;

    container.addEventListener("wheel", e => {
        if (!e.ctrlKey) return;

        e.preventDefault();

        zoomLevel -= e.deltaY * ZOOM_SPEED;
        zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel));
        applyZoom();
    }, { passive: false });
}

function applyZoom() {
    const viewport = document.querySelector(".tree-viewport");
    if (!viewport) return;
    viewport.style.transform = `scale(${zoomLevel})`;
}

function setZoom(value) {
    zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    applyZoom();
}

// ── Collision Detection Helpers ──────────────────────────

function isColliding(rect1, rect2, padding = 20) {
    return !(
        rect1.right + padding < rect2.left ||
        rect1.left - padding > rect2.right ||
        rect1.bottom + padding < rect2.top ||
        rect1.top - padding > rect2.bottom
    );
}

function getNodeRect(node) {
    const left = parseFloat(node.style.left) || 0;
    const top = parseFloat(node.style.top) || 0;
    return {
        left: left,
        top: top,
        right: left + node.offsetWidth,
        bottom: top + node.offsetHeight
    };
}

function findNearestFreePosition(x, y, w, h, usedRects) {
    const step = 20;
    const maxRadius = 400;

    // Check original position first
    const originalRect = {
        left: x,
        top: y,
        right: x + w,
        bottom: y + h
    };
    
    let collides = false;
    for (const used of usedRects) {
        if (isColliding(originalRect, used, 30)) {
            collides = true;
            break;
        }
    }
    
    if (!collides) {
        return { x, y };
    }

    // Search spiral pattern
    for (let r = step; r <= maxRadius; r += step) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
            const nx = x + Math.cos(angle) * r;
            const ny = y + Math.sin(angle) * r;

            const rect = {
                left: nx,
                top: ny,
                right: nx + w,
                bottom: ny + h
            };

            let hasCollision = false;
            for (const used of usedRects) {
                if (isColliding(rect, used, 30)) {
                    hasCollision = true;
                    break;
                }
            }

            if (!hasCollision) {
                return { x: nx, y: ny };
            }
        }
    }

    // Fallback: offset gradually
    return { x: x + 50, y: y + 50 };
}

// ── Random Organic Layout (Fixed - no duplicate) ─────────

function randomizeInitialLayout() {
    const nodes = [...document.querySelectorAll(".tree-node")];
    const usedRects = [];

    nodes.forEach(node => {
        // Gunakan data-x/y yang sudah ada di HTML
        let baseX = parseFloat(node.dataset.x);
        let baseY = parseFloat(node.dataset.y);
        
        // Fallback jika tidak ada data-x/y
        if (isNaN(baseX)) baseX = 3000;
        if (isNaN(baseY)) baseY = 2400;

        const isRoot = node.id === "node-engineering" || node.id === "node-artificial-intelligence";
        
        // Root nodes have less random offset
        const rangeX = isRoot ? 60 : 200;
        const rangeY = isRoot ? 40 : 150;

        let x = baseX + (Math.random() * rangeX - rangeX / 2);
        let y = baseY + (Math.random() * rangeY - rangeY / 2);

        const w = node.offsetWidth;
        const h = node.offsetHeight;

        const pos = findNearestFreePosition(x, y, w, h, usedRects);

        node.style.left = pos.x + "px";
        node.style.top = pos.y + "px";

        const rect = {
            left: pos.x,
            top: pos.y,
            right: pos.x + w,
            bottom: pos.y + h
        };

        usedRects.push(rect);
        
        // Update dataset
        node.dataset.x = pos.x;
        node.dataset.y = pos.y;
    });
}   

// ── Drag Helpers (Fixed coordinate transformation) ───────

function startDrag(node, clientX, clientY) {
    activeNode = node;
    
    // Get canvas-relative position
    const canvas = document.querySelector(".tree-container");
    const canvasRect = canvas.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    
    // Calculate offset relative to node position in canvas space
    const canvasRelativeX = (clientX - canvasRect.left) / zoomLevel;
    const canvasRelativeY = (clientY - canvasRect.top) / zoomLevel;
    const nodeLeft = parseFloat(node.style.left) || 0;
    const nodeTop = parseFloat(node.style.top) || 0;
    
    offsetX = canvasRelativeX - nodeLeft;
    offsetY = canvasRelativeY - nodeTop;

    node.classList.add("dragging");
    node.style.zIndex = "999";
    node.style.cursor = "grabbing";
}

function moveActive(clientX, clientY) {
    if (!activeNode) return;

    const canvas = document.querySelector(".tree-container");
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    
    // Convert screen coordinates to canvas space (accounting for zoom)
    const canvasX = (clientX - canvasRect.left) / zoomLevel;
    const canvasY = (clientY - canvasRect.top) / zoomLevel;
    
    // Calculate new position
    let newLeft = canvasX - offsetX;
    let newTop = canvasY - offsetY;

    // huge soft bounds
    const maxX = 4500;
    const maxY = 4500;

    newLeft = Math.max(-2000, Math.min(maxX, newLeft));
    newTop = Math.max(-2000, Math.min(maxY, newTop));
    
    // Get bounds
    // const maxX = canvas.scrollWidth - activeNode.offsetWidth;
    // const maxY = canvas.scrollHeight - activeNode.offsetHeight;
    
    // Apply bounds
    newLeft = Math.max(0, Math.min(maxX, newLeft));
    newTop = Math.max(0, Math.min(maxY, newTop));
    
    // Check collision with other nodes
    const otherNodes = [...document.querySelectorAll(".tree-node")].filter(n => n !== activeNode);
    const otherRects = otherNodes.map(n => getNodeRect(n));
    
    const tentativeRect = {
        left: newLeft,
        top: newTop,
        right: newLeft + activeNode.offsetWidth,
        bottom: newTop + activeNode.offsetHeight
    };
    
    let hasCollision = false;
    for (const otherRect of otherRects) {
        if (isColliding(tentativeRect, otherRect, 20)) {
            hasCollision = true;
            break;
        }
    }
    
    if (hasCollision) {
        // Find nearest free position
        const freePos = findNearestFreePosition(newLeft, newTop, activeNode.offsetWidth, activeNode.offsetHeight, otherRects);
        newLeft = freePos.x;
        newTop = freePos.y;
    }
    
    // Apply position
    activeNode.style.left = newLeft + "px";
    activeNode.style.top = newTop + "px";
    
    expandViewportIfNeeded(activeNode);

    // Schedule redraw
    drawLines();
}

function endActive() {
    if (!activeNode) return;

    activeNode.classList.remove("dragging");
    activeNode.style.zIndex = "";
    activeNode.style.cursor = "";

    // Save position
    activeNode.dataset.x = parseFloat(activeNode.style.left);
    activeNode.dataset.y = parseFloat(activeNode.style.top);

    activeNode = null;
    
    // Final redraw
    drawLines();
}

function expandViewportIfNeeded(node) {
    const viewport = document.querySelector(".tree-viewport");
    if (!viewport) return;

    const x = parseFloat(node.style.left);
    const y = parseFloat(node.style.top);

    const buffer = 1000;

    if (x + 500 > viewport.offsetWidth - buffer) {
        viewport.style.width =
            viewport.offsetWidth + 2000 + "px";
    }

    if (y + 500 > viewport.offsetHeight - buffer) {
        viewport.style.height =
            viewport.offsetHeight + 2000 + "px";
    }
}

// ── Camera ──────────────────────────────────────────────

// ── Camera dengan anchor node ──────────────────────────────

function centerCamera(anchorNodeId = null) {
    const container = document.querySelector(".tree-container");
    const viewport = document.querySelector(".tree-viewport");

    if (!container || !viewport) return;

    let targetX, targetY;

    if (anchorNodeId) {
        // Center ke node tertentu
        const anchorNode = document.getElementById(anchorNodeId);
        if (anchorNode) {
            const nodeLeft = parseFloat(anchorNode.style.left) || 0;
            const nodeTop = parseFloat(anchorNode.style.top) || 0;
            const nodeWidth = anchorNode.offsetWidth;
            const nodeHeight = anchorNode.offsetHeight;
            
            // Node center position
            // Account for zoom level
            const nodeCenterX = (nodeLeft + nodeWidth / 2) * zoomLevel;
            const nodeCenterY = (nodeTop + nodeHeight / 2) * zoomLevel;
            
            // Container center
            const containerCenterX = container.clientWidth / 2;
            const containerCenterY = container.clientHeight / 2;
            
            // Scroll to center node
            // Convert back to scroll space
            targetX = (nodeCenterX - containerCenterX) / zoomLevel;
            targetY = (nodeCenterY - containerCenterY) / zoomLevel;
            
            console.log(`Centering on node: ${anchorNodeId}`, { targetX, targetY });
        } else {
            console.warn(`Anchor node ${anchorNodeId} not found, using default center`);
            targetX = (viewport.offsetWidth - container.clientWidth) / 2;
            targetY = (viewport.offsetHeight - container.clientHeight) / 2;
        }
    } else {
        // Default: center viewport
        targetX = (viewport.offsetWidth - container.clientWidth) / 2;
        targetY = (viewport.offsetHeight - container.clientHeight) / 2;
    }

    // Apply smooth scroll
    container.scrollTo({
        left: Math.max(0, targetX),
        top: Math.max(0, targetY),
        behavior: 'smooth'
    });

    hasCenteredCamera = true;
}

// ── Global listeners (only once) ────────────────────────

function initGlobalListeners() {
    if (globalInited) return;
    globalInited = true;

    // Mouse events
    document.addEventListener("mousemove", e => {
        if (activeNode) {
            e.preventDefault();
            moveActive(e.clientX, e.clientY);
        }
    });
    document.addEventListener("mouseup", () => endActive());

    // Touch events
    document.addEventListener("touchmove", e => {
        if (activeNode) {
            e.preventDefault();
            moveActive(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });
    document.addEventListener("touchend", () => endActive());
}

// ── Event handlers ──────────────────────────────────────

function handleMouseDown(e) {
    // Don't drag if clicking on header or controls
    if (e.target.closest(".tree-header") || e.target.closest(".tree-controls")) {
        return;
    }
    
    e.preventDefault();
    startDrag(this, e.clientX, e.clientY);
}

function handleTouchStart(e) {
    if (e.target.closest(".tree-header") || e.target.closest(".tree-controls")) {
        return;
    }
    
    e.preventDefault();
    startDrag(this, e.touches[0].clientX, e.touches[0].clientY);
}

function handleHeaderClick(e) {
    e.stopPropagation();
    const content = this.nextElementSibling;
    if (!content) return;

    content.classList.toggle("hidden");
    drawLines();
}

// ── Node initialization ─────────────────────────────────

function initNodes() {
    document.querySelectorAll(".tree-node").forEach(node => {
        // Remove old listeners to prevent duplicates
        node.removeEventListener("mousedown", handleMouseDown);
        node.removeEventListener("touchstart", handleTouchStart);
        
        // Add fresh listeners
        node.addEventListener("mousedown", handleMouseDown);
        node.addEventListener("touchstart", handleTouchStart, { passive: false });
        
        // Ensure initial position is set
        if (!node.style.left && node.dataset.x) {
            node.style.left = node.dataset.x + "px";
            node.style.top = node.dataset.y + "px";
        }
    });
}

function initCollapse() {
    document.querySelectorAll(".tree-header").forEach(header => {
        header.style.cursor = "pointer";
        header.removeEventListener("click", handleHeaderClick);
        header.addEventListener("click", handleHeaderClick);
    });
}

// ── Bootstrap (main entry point) ────────────────────────

let isInitialized = false;
let ANCHOR_NODE_ID = "node-engineering"; // Ganti sesuai kebutuhan

function initSkillTree(anchorId = null) {
    // Prevent double initialization
    if (isInitialized) {
        // Still re-attach event listeners (in case of DOM updates)
        initNodes();
        initCollapse();
        drawLines();
        
        // Re-center jika diperlukan
        if (anchorId || ANCHOR_NODE_ID) {
            setTimeout(() => centerCamera(anchorId || ANCHOR_NODE_ID), 100);
        }
        return;
    }
    
    const svg = document.getElementById("tree-lines");
    if (!svg) return;

    console.log("Initializing Skill Tree...");
    
    initSVG();
    initGlobalListeners();
    initNodes();
    initCollapse();
    initZoom();
    applyZoom();
    randomizeInitialLayout();
    
    // Center camera ke anchor node setelah layout selesai
    setTimeout(() => {
        centerCamera(anchorId || ANCHOR_NODE_ID);
    }, 150);
    
    drawLines();
    
    isInitialized = true;
    console.log("Skill Tree initialized successfully");
}

// ── Reset function (for cleanup) ────────────────────────

function resetSkillTree() {
    isInitialized = false;
    activeNode = null;
    
    // Re-initialize
    setTimeout(() => initSkillTree(), 100);
}

// ── HTMX Lifecycle ──────────────────────────────────────

function bootstrapSkillTree() {
    // Small delay to ensure DOM is fully ready
    setTimeout(() => {
        if (document.getElementById("tree-lines")) {
            initSkillTree();
        }
    }, 50);
}

// Listen for HTMX swaps
document.body.addEventListener("htmx:afterSwap", bootstrapSkillTree);
document.body.addEventListener("htmx:afterSettle", bootstrapSkillTree);

// Also run on initial page load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapSkillTree);
} else {
    bootstrapSkillTree();
}

// ── Public API untuk camera control ─────────────────────

function focusOnNode(nodeId) {
    if (!nodeId) return;
    
    const node = document.getElementById(nodeId);
    if (!node) {
        console.warn(`Node ${nodeId} not found`);
        return;
    }
    
    // Optional: highlight node briefly
    node.style.transition = "box-shadow 0.2s ease";
    const originalShadow = node.style.boxShadow;
    node.style.boxShadow = "0 0 0 3px #3b82f6, 0 10px 25px rgba(0,0,0,.08)";
    
    setTimeout(() => {
        node.style.boxShadow = originalShadow;
        setTimeout(() => {
            node.style.transition = "";
        }, 200);
    }, 800);
    
    // Center camera
    centerCamera(nodeId);
}

// Reset ke default anchor
function resetCameraToAnchor() {
    centerCamera(ANCHOR_NODE_ID);
}

// ── Expose ke window ───────────────────────────────────

window.initSkillTree = initSkillTree;
window.resetSkillTree = resetSkillTree;
window.setZoom = setZoom;
window.drawLines = drawLines;
window.focusOnNode = focusOnNode;
window.resetCameraToAnchor = resetCameraToAnchor;
// Inisialisasi & kontrol kamera (zoom ditangani di IIFE bawah — satu jalur saja)
(function() {

    window.resetCameraToAnchor = function() {
        if (window.centerOnAllNodes) window.centerOnAllNodes(true);
    };

    // Fit / reset kamera ke seluruh node
    document.getElementById('fit-btn')?.addEventListener('click', () => {
        if (window.centerOnAllNodes) window.centerOnAllNodes(true);
    });

    document.getElementById('reset-cam-btn')?.addEventListener('click', () => {
        if (window.resetCamera) window.resetCamera();
    });

    // Inisialisasi skill tree — kamera dipusatkan ke seluruh node.
    if (typeof initSkillTree === 'function') {
        initSkillTree();
    } else {
        console.warn('initSkillTree belum loaded, coba delay 100ms');
        setTimeout(() => {
            if (typeof initSkillTree === 'function') initSkillTree();
        }, 100);
    }
})();

// -----------------------------------------------------------------------------------

(function() {
    const container = document.querySelector('.tree-container');
    const viewport = document.querySelector('.tree-viewport');
    const zoomLevelSpan = document.getElementById('zoom-level');
    
    // VIEWPORT CONSTANTS
    const VIEWPORT_W = 4000;
    const VIEWPORT_H = 4000;

    // ZOOM CONSTANTS (satu sumber kebenaran)
    const ZOOM_MIN  = 0.3;
    const ZOOM_MAX  = 2.0;
    const ZOOM_STEP = 0.1;
    
    // =========================================================
    // ZOOM FUNCTIONS — satu jalur, step konsisten, animasi halus
    // =========================================================
    
    function updateZoomDisplay(zoom) {
        if (zoomLevelSpan) {
            zoomLevelSpan.textContent = Math.round(zoom * 100) + '%';
        }
    }

    // Terapkan level zoom baru (clamp + animasi transform di CSS).
    function setZoomLevel(target) {
        if (!window.setZoom) return;

        const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(target * 100) / 100));

        // Aktifkan transisi halus hanya untuk aksi tombol/keyboard.
        if (viewport) viewport.classList.add('is-zooming');

        window.setZoom(next);          // skill-tree.js: applyZoom + drawLines
        window.currentZoom = next;
        updateZoomDisplay(next);

        // Lepas kelas transisi setelah animasi selesai agar drag tetap responsif.
        clearTimeout(setZoomLevel._t);
        setZoomLevel._t = setTimeout(() => {
            if (viewport) viewport.classList.remove('is-zooming');
            if (window.drawLines) window.drawLines();
        }, 260);
    }

    function zoomIn()  { setZoomLevel((window.currentZoom || 1) + ZOOM_STEP); }
    function zoomOut() { setZoomLevel((window.currentZoom || 1) - ZOOM_STEP); }
    
    // Pan controls
    function pan(dx, dy) {
        if (!container) return;
        container.scrollBy({
            left: dx,
            top: dy,
            behavior: 'smooth'
        });
    }
    
    // =========================================================
    // ATTACH EVENT LISTENERS
    // =========================================================
    
    // Zoom buttons
    document.getElementById('zoom-in-btn')?.addEventListener('click', zoomIn);
    document.getElementById('zoom-out-btn')?.addEventListener('click', zoomOut);
    

    // Recenter: pusatkan kamera ke seluruh node (bounding box)
    document.getElementById('recenter-btn')?.addEventListener('click', () => {
        if (window.centerOnAllNodes) window.centerOnAllNodes(true);
    });

    // Reset: kembalikan posisi node ke layout awal (undo drag-and-drop)
    document.getElementById('reset-layout-btn')?.addEventListener('click', () => {
        if (window.resetLayout) window.resetLayout();
    });
    
    // Pan buttons
    document.getElementById('pan-up')?.addEventListener('click', () => pan(0, -100));
    document.getElementById('pan-down')?.addEventListener('click', () => pan(0, 100));
    document.getElementById('pan-left')?.addEventListener('click', () => pan(-100, 0));
    document.getElementById('pan-right')?.addEventListener('click', () => pan(100, 0));
    
    // Shortcut keyboard
    document.addEventListener('keydown', (e) => {
        // Ctrl + + untuk zoom in
        if ((e.ctrlKey || e.metaKey) && e.key === '=') {
            e.preventDefault();
            zoomIn();
        }
        // Ctrl + - untuk zoom out
        else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            zoomOut();
        }
        // Ctrl + 0 untuk recenter ke semua node
        else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            if (window.centerOnAllNodes) window.centerOnAllNodes(true);
        }
        // Tombol pan dengan arrow keys (tanpa modifier)
        else if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
            switch(e.key) {
                case 'ArrowUp': pan(0, -50); e.preventDefault(); break;
                case 'ArrowDown': pan(0, 50); e.preventDefault(); break;
                case 'ArrowLeft': pan(-50, 0); e.preventDefault(); break;
                case 'ArrowRight': pan(50, 0); e.preventDefault(); break;
            }
        }
    });
    
    // Track current zoom level — simpan nilai yang SUDAH di-clamp
    // supaya currentZoom tidak melenceng dari zoom asli saat mentok batas.
    if (window.setZoom) {
        const originalSetZoom = window.setZoom;
        window.setZoom = function(value) {
            const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
            window.currentZoom = clamped;
            updateZoomDisplay(clamped);
            originalSetZoom(clamped);
        };
    }
    
    // Inisialisasi skill tree
    if (typeof initSkillTree === 'function') {
        initSkillTree();
        // Set initial zoom display
        setTimeout(() => {
            updateZoomDisplay(window.currentZoom || 1);
        }, 100);
    }
    
    // Drag-to-pan untuk background
    let isPanning = false;
    let panStartX = 0, panStartY = 0;
    let panScrollLeft = 0, panScrollTop = 0;
    
    if (container) {
        container.addEventListener('mousedown', (e) => {
            // Jangan aktif jika klik di node atau kontrol
            if (e.target.closest('.tree-node, .tree-node--circle, .tree-node--leaf, .tree-controls, button')) return;
            
            isPanning = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            panScrollLeft = container.scrollLeft;
            panScrollTop = container.scrollTop;
            
            container.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            
            const dx = e.clientX - panStartX;
            const dy = e.clientY - panStartY;
            
            container.scrollLeft = panScrollLeft - dx;
            container.scrollTop = panScrollTop - dy;
        });
        
        document.addEventListener('mouseup', () => {
            if (isPanning) {
                isPanning = false;
                container.style.cursor = '';
            }
        });
        
        // Touch support
        container.addEventListener('touchstart', (e) => {
            if (e.target.closest('.tree-node, .tree-node--circle, .tree-node--leaf, .tree-controls, button')) return;
            
            isPanning = true;
            panStartX = e.touches[0].clientX;
            panStartY = e.touches[0].clientY;
            panScrollLeft = container.scrollLeft;
            panScrollTop = container.scrollTop;
            e.preventDefault();
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!isPanning) return;
            
            const dx = e.touches[0].clientX - panStartX;
            const dy = e.touches[0].clientY - panStartY;
            
            container.scrollLeft = panScrollLeft - dx;
            container.scrollTop = panScrollTop - dy;
        });
        
        document.addEventListener('touchend', () => {
            isPanning = false;
        });
    }
})();

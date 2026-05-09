// Inisialisasi & kontrol
(function() {
    // Fungsi helper zoom
    window.setZoomBtn = function(delta) {
        if (window.setZoom) {
            const newZoom = (parseFloat(document.getElementById('zoom-level')?.innerText) || 100) / 100 + delta;
            window.setZoom(newZoom);
        }
    };

    window.resetCameraToAnchor = function() {
        if (window.centerCamera) {
            window.centerCamera('node-engineering');
        }
    };

    // Fit / reset kamera ke node utama
    document.getElementById('fit-btn')?.addEventListener('click', () => {
        if (window.focusOnNode) window.focusOnNode('node-engineering');
    });

    document.getElementById('reset-cam-btn')?.addEventListener('click', () => {
        if (window.resetCamera) window.resetCamera();
    });

    document.getElementById('zoom-in-btn')?.addEventListener('click', () => window.setZoomBtn(0.1));
    document.getElementById('zoom-out-btn')?.addEventListener('click', () => window.setZoomBtn(-0.1));

    // Inisialisasi skill tree dengan anchor node engineering
    if (typeof initSkillTree === 'function') {
        initSkillTree('node-engineering');
    } else {
        console.warn('initSkillTree belum loaded, coba delay 100ms');
        setTimeout(() => {
            if (typeof initSkillTree === 'function') initSkillTree('node-engineering');
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
    
    // =========================================================
    // ZOOM FUNCTIONS
    // =========================================================
    
    function updateZoomDisplay(zoom) {
        if (zoomLevelSpan) {
            zoomLevelSpan.textContent = Math.round(zoom * 100) + '%';
        }
    }
    
    function zoomIn() {
        if (window.setZoom) {
            const currentZoom = window.currentZoom || 1;
            const newZoom = Math.min(2.0, currentZoom + 0.1);
            window.setZoom(newZoom);
            window.currentZoom = newZoom;
            updateZoomDisplay(newZoom);
        }
    }
    
    function zoomOut() {
        if (window.setZoom) {
            const currentZoom = window.currentZoom || 1;
            const newZoom = Math.max(0.3, currentZoom - 0.1);
            window.setZoom(newZoom);
            window.currentZoom = newZoom;
            updateZoomDisplay(newZoom);
        }
    }
    
    // Reset viewport ke center (tanpa mengubah zoom)
    function resetViewport() {
        if (!container) return;
        
        container.scrollTo({
            left: (VIEWPORT_W - container.clientWidth) / 2,
            top: (VIEWPORT_H - container.clientHeight) / 2,
            behavior: 'smooth'
        });
    }
    
    // Fit semua node ke viewport
    function fitAllNodes() {
        const nodes = document.querySelectorAll('.tree-node, .tree-node--circle, .tree-node--leaf');
        if (nodes.length === 0) return;
        
        // Dapatkan bounding box semua node
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        nodes.forEach(node => {
            const left = parseFloat(node.style.left) || 0;
            const top = parseFloat(node.style.top) || 0;
            const right = left + node.offsetWidth;
            const bottom = top + node.offsetHeight;
            
            minX = Math.min(minX, left);
            minY = Math.min(minY, top);
            maxX = Math.max(maxX, right);
            maxY = Math.max(maxY, bottom);
        });
        
        // Tambah padding
        const padding = 100;
        const nodesWidth = (maxX - minX) + padding * 2;
        const nodesHeight = (maxY - minY) + padding * 2;
        
        // Hitung zoom yang diperlukan
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        const zoomX = containerWidth / nodesWidth;
        const zoomY = containerHeight / nodesHeight;
        const fitZoom = Math.min(zoomX, zoomY, 1.5); // Maksimal 150%
        
        // Apply zoom
        if (window.setZoom) {
            window.setZoom(fitZoom);
            window.currentZoom = fitZoom;
            updateZoomDisplay(fitZoom);
        }
        
        // Scroll ke center bounding box
        setTimeout(() => {
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            
            container.scrollTo({
                left: centerX - container.clientWidth / 2,
                top: centerY - container.clientHeight / 2,
                behavior: 'smooth'
            });
        }, 100);
    }
    
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
    
    // Viewport buttons
    document.getElementById('reset-viewport-btn')?.addEventListener('click', resetViewport);
    document.getElementById('fit-view-btn')?.addEventListener('click', fitAllNodes);
    
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
        // Ctrl + 0 untuk reset viewport
        else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            resetViewport();
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
    
    // Track current zoom level
    if (window.setZoom) {
        const originalSetZoom = window.setZoom;
        window.setZoom = function(value) {
            window.currentZoom = value;
            updateZoomDisplay(value);
            originalSetZoom(value);
        };
    }
    
    // Inisialisasi skill tree
    if (typeof initSkillTree === 'function') {
        initSkillTree('node-engineering');
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

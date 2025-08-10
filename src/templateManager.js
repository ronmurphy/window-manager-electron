/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
console.log('Loading Window Template Manager...');

class WindowTemplateManager {
    constructor() {
        this.windows = new Map();
        this.maxOutputLines = 1000; // Configurable default
    }

    initialize() {
        console.log('Initializing WindowTemplateManager...');
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add your custom event listeners here
        window.addEventListener('themechange', async () => {
            await this.applyCurrentTheme();
        });
    }

    createWindow() {
        const windowId = 'window-template'; // You can make this dynamic
        const windowHtml = `
            <div class="window template-window" id="${windowId}">
                <div class="window-header">
                    <div class="window-title">
                        <span class="material-symbols-outlined">widgets</span>
                        Window Title
                    </div>
                    <div class="window-controls">
                        <button onclick="templateManager.toggleDevTools()" title="Developer Tools">
                            <span class="material-symbols-outlined">jump_to_element</span>
                        </button>
                        <button onclick="templateManager.minimizeWindow()" title="Minimize">
                            <span class="material-symbols-outlined">remove</span>
                        </button>
                        <button onclick="templateManager.closeWindow()" title="Close">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
                <div class="window-container">
                    <!-- Your window content goes here -->
                    <div class="content-area">
                        Window Content
                    </div>
                </div>
                <div class="resize-handle"></div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', windowHtml);
        const panel = document.getElementById(windowId);

        // Set initial size and position
        panel.style.width = '800px';
        panel.style.height = '500px';
        panel.style.left = '50px';
        panel.style.top = '50px';

        // Make window draggable and snappable using existing WindowManager
        makeDraggable(panel);
        this.setupResizing(panel);

        // Register with window management
        windows.set(windowId, {
            title: 'Template Window',
            minimized: false,
            isWidget: false
        });

        this.windows.set(windowId, panel);
        panel.style.display = 'block';
        
        // Bring window to front
        WindowManager.bringToFront(panel);

        // Apply current theme
        this.applyCurrentTheme();
    }

    setupResizing(panel) {
        const resizeHandle = panel.querySelector('.resize-handle');
        if (!resizeHandle) return;

        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        resizeHandle.addEventListener('mousedown', e => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(getComputedStyle(panel).width, 10);
            startHeight = parseInt(getComputedStyle(panel).height, 10);

            panel.style.transition = 'none';
            WindowManager.bringToFront(panel);

            e.stopPropagation();
        });

        document.addEventListener('mousemove', e => {
            if (!isResizing) return;

            const newWidth = Math.max(400, startWidth + (e.clientX - startX));
            const newHeight = Math.max(300, startHeight + (e.clientY - startY));
            
            panel.style.width = `${newWidth}px`;
            panel.style.height = `${newHeight}px`;
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
            panel.style.transition = '';
        });
    }

    async applyCurrentTheme() {
        const currentTheme = await window.getCurrentTheme();
        if (currentTheme) {
            const window = document.getElementById('window-template');
            if (window) {
                const titlebar = window.querySelector('.window-header');
                if (titlebar) {
                    updateTitlebarStyle(titlebar, currentTheme, false);
                }
            }
        }
    }

    // Window Control Methods
    closeWindow() {
        const panel = document.getElementById('window-template');
        if (panel) {
            panel.remove();
            windows.delete('window-template');
            this.windows.delete('window-template');
            DockManager.renderDock();
        }
    }

    minimizeWindow() {
        const panel = document.getElementById('window-template');
        if (panel) {
            panel.style.display = 'none';
            windows.get('window-template').minimized = true;
            DockManager.renderDock();
        }
    }

    toggleDevTools() {
        window.electronAPI.send('toggle-dev-tools');
    }

    // Public Methods
    show() {
        if (this.windows.has('window-template')) {
            const window = this.windows.get('window-template');
            window.style.display = 'block';
            windows.get('window-template').minimized = false;
            WindowManager.bringToFront(window);
        } else {
            this.createWindow();
        }
    }
}

// Initialize and export
window.WindowTemplateManager = WindowTemplateManager;
window.templateManager = new WindowTemplateManager();

console.log('Window Template Manager loaded and registered globally:', {
    class: typeof window.WindowTemplateManager !== 'undefined',
    instance: typeof window.templateManager !== 'undefined'
});
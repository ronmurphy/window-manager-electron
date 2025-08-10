/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
console.log('Loading File Manager...');

class FileManager {
    constructor() {
        this.windows = new Map();
        this.currentPath = '';
        this.history = [];
        this.historyIndex = -1;
    }

    initialize() {
        console.log('Initializing FileManager...');
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('themechange', async () => {
            await this.applyCurrentTheme();
        });
    }

    async createWindow() {
        const windowId = 'file-manager';
        const windowHtml = `
            <div class="window file-manager-window" id="${windowId}">
                <div class="window-header">
                    <div class="window-title">
                        <span class="material-symbols-outlined">folder_open</span>
                        File Manager
                    </div>
                    <div class="window-controls">
                        <button onclick="refreshWindow('${windowId}')" title="Refresh" class="control-button">
                        <span class="material-symbols-outlined">refresh</span>
                    </button>
                        <button onclick="terminalManager.show()" title="Terminal">
                            <span class="material-symbols-outlined">terminal</span>
                        </button>
                        <button onclick="fileManager.minimizeWindow()" title="Minimize">
                            <span class="material-symbols-outlined">remove</span>
                        </button>
                        <button onclick="fileManager.closeWindow()" title="Close">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
                <div class="file-manager-container">
                    <!-- Navigation Bar -->
                    <div class="navigation-bar">
                        <div class="nav-controls">
                            <button onclick="fileManager.navigateBack()" class="nav-button" title="Back">
                                <span class="material-symbols-outlined">arrow_back</span>
                            </button>
                            <button onclick="fileManager.navigateForward()" class="nav-button" title="Forward">
                                <span class="material-symbols-outlined">arrow_forward</span>
                            </button>
                            <button onclick="fileManager.navigateUp()" class="nav-button" title="Up">
                                <span class="material-symbols-outlined">arrow_upward</span>
                            </button>
                            <button onclick="fileManager.refreshDirectory()" class="nav-button" title="Refresh">
                                <span class="material-symbols-outlined">refresh</span>
                            </button>
                        </div>
                        <div class="path-container">
                            <div class="breadcrumb" id="breadcrumb"></div>
                            <input type="text" class="path-input" id="pathInput" placeholder="Enter path...">
                        </div>
                    </div>

                    <!-- Main Content Area -->
                    <div class="content-container">
                        <!-- Sidebar -->
                        <div class="sidebar">
                            <div class="quick-access">
                                <div class="section-title">Quick Access</div>
                                <button onclick="fileManager.navigateTo('home')" class="quick-button">
                                    <span class="material-symbols-outlined">home</span>
                                    Home
                                </button>
                                <button onclick="fileManager.navigateTo('desktop')" class="quick-button">
                                    <span class="material-symbols-outlined">desktop_windows</span>
                                    Desktop
                                </button>
                                <button onclick="fileManager.navigateTo('documents')" class="quick-button">
                                    <span class="material-symbols-outlined">description</span>
                                    Documents
                                </button>
                                <button onclick="fileManager.navigateTo('downloads')" class="quick-button">
                                    <span class="material-symbols-outlined">download</span>
                                    Downloads
                                </button>
                            </div>
                            <div class="drives">
                                <div class="section-title">Drives</div>
                                <div id="drivesList"></div>
                            </div>
                        </div>

                        <!-- File List Area -->
                        <div class="file-list-container">
                            <div class="file-list-header">
                                <div class="column-headers">
                                    <div class="header-name">Name</div>
                                    <div class="header-modified">Modified</div>
                                    <div class="header-type">Type</div>
                                    <div class="header-size">Size</div>
                                </div>
                            </div>
                            <div class="file-list" id="fileList"></div>
                        </div>
                    </div>

                    <!-- Status Bar -->
                    <div class="status-bar">
                        <div class="status-text" id="statusText">0 items</div>
                        <div class="selection-text" id="selectionText"></div>
                    </div>
                </div>
                <div class="resize-handle"></div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', windowHtml);
        const panel = document.getElementById(windowId);

        // Set initial size and position
        panel.style.width = '900px';
        panel.style.height = '600px';
        panel.style.left = '50px';
        panel.style.top = '50px';

        // Make window draggable and snappable
        makeDraggable(panel);
        this.setupResizing(panel);

        // Register with window management
        windows.set(windowId, {
            title: 'File Manager',
            minimized: false,
            isWidget: false
        });

        this.windows.set(windowId, panel);
        panel.style.display = 'block';

        // Bring window to front
        WindowManager.bringToFront(panel);

        // Initialize the file manager
        await this.initializeFileManager();

        // Apply current theme
        await this.applyCurrentTheme();
    }

    async initializeFileManager() {
        try {
            // Get initial directory (user's home directory)
            const homePath = await window.electronAPI.invoke('get-home-dir');
            await this.loadDirectory(homePath);

            // Set up path input handler
            const pathInput = document.getElementById('pathInput');
            pathInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    await this.loadDirectory(pathInput.value);
                }
            });

            // Initialize drives list
            await this.loadDrives();

        } catch (error) {
            console.error('Error initializing file manager:', error);
            this.showError('Failed to initialize file manager');
        }
    }

    async navigateTo(location) {
        try {
            const path = await window.electronAPI.fileSystem.getSpecialFolder(location);
            await this.loadDirectory(path);
        } catch (error) {
            console.error('Error navigating to location:', error);
            this.showError(`Failed to navigate to ${location}`);
        }
    }

    // Also update the loadDirectory method to use the new API:
    async loadDirectory(path) {
        try {
            // Normalize path for Windows
            const normalizedPath = path.replace(/\//g, '\\').replace(/\\+$/, '\\');

            // Show loading state
            this.setLoadingState(true);

            const files = await window.electronAPI.fileSystem.readDirectory(normalizedPath);
            this.currentPath = normalizedPath;

            this.updateFileList(files);
            this.updateBreadcrumb(normalizedPath);
            this.updateHistory(normalizedPath);

            const pathInput = document.getElementById('pathInput');
            if (pathInput) {
                pathInput.value = normalizedPath;
            }

            this.updateNavigationButtons();
        } catch (error) {
            console.error('Error loading directory:', error);
            this.showError(`Failed to load directory: ${error.message}`);
        } finally {
            this.setLoadingState(false);
        }
    }

    setLoadingState(isLoading) {
        const fileList = document.getElementById('fileList');
        if (fileList) {
            fileList.style.opacity = isLoading ? '0.5' : '1';
            fileList.style.pointerEvents = isLoading ? 'none' : 'auto';
        }
    }

    updateFileList(files) {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;

        fileList.innerHTML = files.map(file => `
            <div class="file-item ${file.isDirectory ? 'directory' : 'file'}" 
                 data-path="${file.path}"
                 ondblclick="fileManager.handleFileClick('${file.path}')">
                <span class="material-symbols-outlined">
                    ${file.isDirectory ? 'folder' : 'description'}
                </span>
                <div class="file-details">
                    <div class="file-name">${file.name}</div>
                    <div class="file-modified">${file.modified}</div>
                    <div class="file-type">${file.type}</div>
                    <div class="file-size">${file.size}</div>
                </div>
            </div>
        `).join('');

        this.updateStatus(files.length);
    }

    updateBreadcrumb(path) {
        const breadcrumb = document.getElementById('breadcrumb');
        const pathInput = document.getElementById('pathInput');

        if (breadcrumb && pathInput) {
            pathInput.value = path;

            const parts = path.split(/[\\/]/);
            breadcrumb.innerHTML = parts.map((part, index) => {
                const currentPath = parts.slice(0, index + 1).join('/');
                return `
                    <span class="breadcrumb-item" onclick="fileManager.loadDirectory('${currentPath}')">
                        ${part || 'Root'}
                    </span>
                    ${index < parts.length - 1 ? '<span class="separator">/</span>' : ''}
                `;
            }).join('');
        }
    }

    async loadDrives() {
        try {
            const drives = await window.electronAPI.invoke('get-drives');
            const drivesList = document.getElementById('drivesList');

            if (drivesList) {
                drivesList.innerHTML = drives.map(drive => `
                    <button onclick="fileManager.loadDirectory('${drive.path}')" class="drive-button">
                        <span class="material-symbols-outlined">hard_drive</span>
                        ${drive.label || drive.path}
                        <span class="drive-space">${drive.freeSpace}</span>
                    </button>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading drives:', error);
        }
    }

    async handleFileClick(path) {
        try {
            const stats = await window.electronAPI.fileSystem.getFileStats(path);
            if (stats.isDirectory) {
                await this.loadDirectory(path);
            } else {
                await window.electronAPI.fileSystem.openFile(path);
            }
        } catch (error) {
            console.error('Error handling file click:', error);
            this.showError(`Failed to open item: ${error.message}`);
        }
    }

    updateStatus(itemCount) {
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
        }
    }

    showError(message) {
        console.error(message);
        const statusText = document.getElementById('statusText');
        if (statusText) {
            const errorHtml = `
                <span style="color: var(--error-color, #ff4444);">
                    <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 16px;">
                        error
                    </span>
                    ${message}
                </span>
            `;
            statusText.innerHTML = errorHtml;

            setTimeout(() => {
                statusText.textContent = this.getDefaultStatus();
            }, 5000);
        }
    }

    getDefaultStatus() {
        const itemCount = document.querySelectorAll('.file-item').length;
        return `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
    }

    // Navigation methods
    navigateBack() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadDirectory(this.history[this.historyIndex]);
        }
    }

    navigateForward() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.loadDirectory(this.history[this.historyIndex]);
        }
    }

    async navigateUp() {
        if (this.currentPath) {
            const parentPath = await window.electronAPI.invoke('get-parent-directory', this.currentPath);
            if (parentPath !== this.currentPath) {
                await this.loadDirectory(parentPath);
            }
        }
    }

    updateNavigationButtons() {
        // Update back/forward buttons state
        const backBtn = document.querySelector('button[onclick="fileManager.navigateBack()"]');
        const forwardBtn = document.querySelector('button[onclick="fileManager.navigateForward()"]');

        if (backBtn) {
            backBtn.disabled = this.historyIndex <= 0;
        }
        if (forwardBtn) {
            forwardBtn.disabled = this.historyIndex >= this.history.length - 1;
        }
    }

    updateHistory(path) {
        // Remove any forward history when new path is added
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(path);
        this.historyIndex = this.history.length - 1;
    }

    async refreshDirectory() {
        if (this.currentPath) {
            await this.loadDirectory(this.currentPath);
        }
    }

    // Window management methods (from template)
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

            const newWidth = Math.max(800, startWidth + (e.clientX - startX));
            const newHeight = Math.max(600, startHeight + (e.clientY - startY));

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
            const window = document.getElementById('file-manager');
            if (window) {
                const titlebar = window.querySelector('.window-header');
                if (titlebar) {
                    updateTitlebarStyle(titlebar, currentTheme, false);
                }
            }
        }
    }

    refreshWindow(windowId) {
        const webview = document.querySelector(`#${windowId} webview`);
        if (webview) {
            webview.reload();
        }
    }

    closeWindow() {
        const panel = document.getElementById('file-manager');
        if (panel) {
            panel.remove();
            windows.delete('file-manager');
            this.windows.delete('file-manager');
            DockManager.renderDock();
        }
    }

    minimizeWindow() {
        const panel = document.getElementById('file-manager');
        if (panel) {
            panel.style.display = 'none';
            windows.get('file-manager').minimized = true;
            DockManager.renderDock();
        }
    }

    toggleDevTools() {
        window.electronAPI.send('toggle-dev-tools');
    }

    show() {
        if (this.windows.has('file-manager')) {
            const window = this.windows.get('file-manager');
            window.style.display = 'block';
            windows.get('file-manager').minimized = false;
            WindowManager.bringToFront(window);
        } else {
            this.createWindow();
        }
    }
}

// Initialize and export
window.FileManager = FileManager;
window.fileManager = new FileManager();

console.log('File Manager loaded and registered globally:', {
    class: typeof window.FileManager !== 'undefined',
    instance: typeof window.fileManager !== 'undefined'
});
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
console.log('Loading File Manager...');

class FileManagerOld {
    constructor() {
        this.windows = new Map();
        this.currentPath = '';
        this.history = [];
        this.historyIndex = -1;
        // Set default preferences - these will be overwritten
        this.labelPosition = 'bottom';
        this.currentView = 'list';
        this.showImagePreviews = false;
        this.recentFolders = [];
        this.windowPosition = {
            width: '900px',
            height: '600px',
            left: '50px',
            top: '50px'
        };
        this.pathMode = 'breadcrumb';
        this.tabs = new Map(); // Store tab information
        this.activeTabId = null;

        // Immediately load preferences
        this.initializePreferences();
    }

    togglePathMode() {
        const pathContainer = document.querySelector('.path-container');
        const pathInput = document.getElementById('pathInput');
        const currentPath = this.currentPath;

        if (pathContainer.dataset.mode === 'breadcrumb') {
            // Switch to input mode
            pathContainer.dataset.mode = 'input';
            pathInput.value = currentPath;
            pathInput.focus();
            pathInput.select();
        } else {
            // Switch to breadcrumb mode
            pathContainer.dataset.mode = 'breadcrumb';
            this.updateBreadcrumb(currentPath);
        }
    }

    async initializePreferences() {
        try {
            const storedPrefs = await window.electronAPI.store.get('fileManagerPreferences');
            console.log('Loading stored preferences:', storedPrefs);

            if (storedPrefs) {
                this.labelPosition = storedPrefs.labelPosition;
                this.currentView = storedPrefs.viewMode;
                this.showImagePreviews = storedPrefs.showImagePreviews;

                console.log('Initialized with stored preferences:', {
                    labelPosition: this.labelPosition,
                    currentView: this.currentView,
                    showImagePreviews: this.showImagePreviews
                });
            }
        } catch (error) {
            console.error('Error loading initial preferences:', error);
        }
    }

    async show() {
        if (this.windows.has('file-manager')) {
            const window = this.windows.get('file-manager');
            window.style.display = 'block';
            windows.get('file-manager').minimized = false;
            WindowManager.bringToFront(window);
        } else {
            // Wait for preferences to be loaded before creating window
            await this.createWindow();
        }
    }

    toggleLabelPosition() {
        const fileList = document.getElementById('fileList');
        this.labelPosition = this.labelPosition === 'bottom' ? 'top' : 'bottom';
        fileList.dataset.labelPosition = this.labelPosition;

        this.savePreferences();
    }


    setView(viewType) {
        console.log('Setting view to:', viewType);
        const fileList = document.getElementById('fileList');
        if (!fileList) return;

        const viewButtons = document.querySelectorAll('.view-button');

        // Update buttons
        viewButtons.forEach(button => {
            button.classList.remove('active');
            if (button.title.toLowerCase().includes(viewType)) {
                button.classList.add('active');
            }
        });

        // Update view
        fileList.classList.remove('list-view', 'grid-view');
        fileList.classList.add(`${viewType}-view`);
        this.currentView = viewType;

        // If grid view and previews are enabled, load previews
        if (viewType === 'grid' && this.showImagePreviews) {
            this.loadImagePreviews();
        }

        this.savePreferences();
    }

    toggleImagePreviews() {
        this.showImagePreviews = !this.showImagePreviews;
        const previewButton = document.querySelector('.view-button[title="Toggle Image Previews"]');
        const fileList = document.getElementById('fileList');

        if (this.showImagePreviews) {
            previewButton.classList.add('active');
            if (this.currentView === 'grid') {
                this.loadImagePreviews();
            }
        } else {
            previewButton.classList.remove('active');
            this.clearPreviews();
        }

        this.savePreferences();
    }

    async loadImagePreviews() {
        if (this.currentView !== 'grid' || !this.showImagePreviews) return;

        const imageItems = document.querySelectorAll(`
            .file-item[data-path$=".jpg"],
            .file-item[data-path$=".jpeg"],
            .file-item[data-path$=".png"],
            .file-item[data-path$=".gif"],
            .file-item[data-path$=".webp"],
            .file-item[data-path$=".bmp"]
        `);

        imageItems.forEach(async (item) => {
            const filePath = item.dataset.path;

            // Add loading state
            item.classList.add('loading-preview');

            try {
                // Store full name for tooltip
                const fileName = item.querySelector('.file-name').textContent;
                item.dataset.fullName = fileName;

                // Convert file path to URL
                const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;

                // Create an image to test loading
                const img = new Image();

                img.onload = () => {
                    item.dataset.preview = fileUrl;
                    item.style.setProperty('--preview-url', `url("${fileUrl}")`);
                    item.classList.remove('loading-preview');
                };

                img.onerror = () => {
                    item.classList.remove('loading-preview');
                    // Revert to default icon if image fails to load
                    item.removeAttribute('data-preview');
                    item.style.removeProperty('--preview-url');
                    console.error(`Failed to load preview for: ${filePath}`);
                };

                img.src = fileUrl;

            } catch (error) {
                item.classList.remove('loading-preview');
                console.error('Error loading preview:', error);
            }
        });
    }

    clearPreviews() {
        const imageItems = document.querySelectorAll('.file-item[data-preview]');
        imageItems.forEach(item => {
            delete item.dataset.preview;
            item.style.removeProperty('--preview-url');
        });
    }

    setupScrollHandler() {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;

        let scrollTimeout;

        fileList.addEventListener('scroll', () => {
            if (!scrollTimeout) {
                fileList.classList.add('scrolling');
            }

            clearTimeout(scrollTimeout);

            scrollTimeout = setTimeout(() => {
                fileList.classList.remove('scrolling');
                scrollTimeout = null;
            }, 150); // Adjust timeout as needed
        }, { passive: true }); // Improve scroll performance
    }

    setupPathInput() {
        const pathInput = document.getElementById('pathInput');
        if (pathInput) {
            pathInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    await this.loadDirectory(pathInput.value);
                    this.togglePathMode(); // Switch back to breadcrumb view
                }
            });

            pathInput.addEventListener('blur', () => {
                const pathContainer = document.querySelector('.path-container');
                if (pathContainer.dataset.mode === 'input') {
                    this.togglePathMode(); // Switch back to breadcrumb view
                }
            });
        }
    }

    async initialize() {
        console.log('Initializing FileManager...');
        this.setupEventListeners();
        this.setupPathInput();
        await this.loadPreferences(); // Separate preferences loading
        this.setupScrollHandler();
    }

    async loadPreferences() {
        try {
            const storedPrefs = await window.electronAPI.store.get('fileManagerPreferences');
            console.log('Loading stored preferences:', storedPrefs);

            if (storedPrefs) {
                this.labelPosition = storedPrefs.labelPosition;
                this.currentView = storedPrefs.viewMode;
                this.showImagePreviews = storedPrefs.showImagePreviews;
                this.recentFolders = storedPrefs.recentFolders || [];
                this.windowPosition = storedPrefs.windowPosition || this.windowPosition;

                console.log('Loaded recent folders:', this.recentFolders);
                console.log('Loaded window position:', this.windowPosition);
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
        }
    }

    async savePreferences() {
        try {
            const preferences = {
                labelPosition: this.labelPosition,
                viewMode: this.currentView,
                showImagePreviews: this.showImagePreviews,
                recentFolders: this.recentFolders,
                windowPosition: this.windowPosition
            };
            await window.electronAPI.store.set('fileManagerPreferences', preferences);
        } catch (error) {
            console.error('Error saving preferences:', error);
        }
    }

    // Add verification method
    async verifyPreferences() {
        const prefs = await window.electronAPI.store.get('fileManagerPreferences');
        console.log('Current stored preferences:', prefs);
        return prefs;
    }

    // Add this method to help with testing
    async testPreferences() {
        console.log('=== Testing Preferences ===');
        console.log('Current instance state:', {
            labelPosition: this.labelPosition,
            currentView: this.currentView,
            showImagePreviews: this.showImagePreviews
        });

        const storedPrefs = await this.verifyPreferences();
        console.log('Stored preferences:', storedPrefs);

        const fileList = document.getElementById('fileList');
        console.log('FileList current state:', {
            classList: fileList ? Array.from(fileList.classList) : null,
            labelPosition: fileList ? fileList.dataset.labelPosition : null
        });

        const viewButtons = document.querySelectorAll('.view-button');
        console.log('View buttons state:', Array.from(viewButtons).map(btn => ({
            title: btn.title,
            isActive: btn.classList.contains('active')
        })));

        return 'Test complete';
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
                    </div >
                        <div class="window-controls">
                            <button onclick="refreshWindow('${windowId}')" title="Refresh" class="control-button">
                               <span class="material-symbols-outlined">refresh</span>
                            </button>
                            <button onclick="fileManager.minimizeWindow()" title="Minimize">
                                <span class="material-symbols-outlined">remove</span>
                            </button>
                            <button onclick="fileManager.closeWindow()" title="Close">
                                <span class="material-symbols-outlined">close</span>
                            </button>
                        </div>
                    </div>

                                <!-- Add tab bar -->
            <div class="tab-bar" id="${windowId}-tabs">
                <div class="tab-list"></div>
                <button onclick="fileManager.addNewTab()" class="new-tab-btn">
                    <span class="material-symbols-outlined">add</span>
                </button>
            </div>

            <!-- Wrap existing content in tab container -->
            <div class="tab-container">
                <div class="tab-content" id="${windowId}-content"></div>
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
        <div class="path-container" data-mode="breadcrumb">
            <button class="path-toggle" onclick="fileManager.togglePathMode()" title="Toggle path view">
                <span class="material-symbols-outlined">sync_alt</span>
            </button>
            <div class="breadcrumb" id="breadcrumb"></div>
            <input type="text" class="path-input" id="pathInput" placeholder="Enter path..." />
        </div>

        <div class="tool-controls">
            <button onclick="fileManager.setView('list')" class="view-button active" title="List View">
                <span class="material-symbols-outlined">view_list</span>
            </button>
            <button onclick="fileManager.setView('grid')" class="view-button" title="Grid View">
                <span class="material-symbols-outlined">grid_view</span>
            </button>
            <button onclick="fileManager.toggleImagePreviews()" class="view-button" title="Toggle Image Previews">
                <span class="material-symbols-outlined">image</span>
            </button>
            <button onclick="terminalManager.show()" title="Terminal">
                <span class="material-symbols-outlined">terminal</span>
            </button>
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
        // panel.style.width = '900px';
        // panel.style.height = '600px';
        // panel.style.left = '50px';
        // panel.style.top = '50px';

        panel.style.width = this.windowPosition.width;
        panel.style.height = this.windowPosition.height;
        panel.style.left = this.windowPosition.left;
        panel.style.top = this.windowPosition.top;

        // Wait a frame to ensure DOM is ready
        await new Promise(resolve => requestAnimationFrame(resolve));

        // Initialize window functionality
        makeDraggable(panel);
        this.setupResizing(panel);

        // Register with window management
        windows.set(windowId, {
            title: 'File Manager',
            minimized: false,
            isWidget: false
        });
        this.windows.set(windowId, panel);

        // Show window and bring to front
        panel.style.display = 'block';
        WindowManager.bringToFront(panel);

        // Initialize file manager and theme
        await this.initializeFileManager();
        await this.applyCurrentTheme();

        // Apply all preferences in one go
        await this.applyPreferences();

        console.log('Window created and preferences applied:', {
            labelPosition: this.labelPosition,
            currentView: this.currentView,
            showImagePreviews: this.showImagePreviews
        });

        await this.addNewTab();

        return windowId;
    }

    async addNewTab() {
        const tabId = `tab-${Date.now()}`;
        const tabListEl = document.querySelector('.tab-list');
        const tabContentEl = document.getElementById('file-manager-content');
    
        // Create tab button
        const tabButton = document.createElement('div');
        tabButton.className = 'tab';
        tabButton.setAttribute('data-tab-id', tabId);
        tabButton.innerHTML = `
            <span class="tab-title">New Tab</span>
            <button class="tab-close" onclick="fileManager.closeTab('${tabId}')">×</button>
        `;
        tabButton.addEventListener('click', () => this.activateTab(tabId));
        tabListEl.appendChild(tabButton);
    
        // Create tab content
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-pane';
        tabContent.id = tabId;
        tabContent.innerHTML = `
            <div class="navigation-bar">
                <!-- ... navigation controls ... -->
            </div>
            <div class="content-container">
                <div class="sidebar">
                    <!-- ... sidebar content ... -->
                </div>
                <div class="file-list-container">
                    <!-- ... file list content ... -->
                </div>
            </div>
        `;
        tabContentEl.appendChild(tabContent);
    
        // Store tab info
        this.tabs.set(tabId, {
            id: tabId,
            path: '',
            viewMode: 'list',
            showImagePreviews: false
        });
    
        // Activate new tab
        this.activateTab(tabId);
    
        // Initialize the new tab's content
        await this.initializeFileManager(tabId);
    }
    
    async activateTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tabId === tabId) {
                tab.classList.add('active');
            }
        });
    
        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
            if (pane.id === tabId) {
                pane.classList.add('active');
            }
        });
    
        this.activeTabId = tabId;
        const tabInfo = this.tabs.get(tabId);
        
        // Restore tab's state
        if (tabInfo.path) {
            await this.loadDirectory(tabInfo.path, tabId);
        }
    }
    
    async closeTab(tabId) {
        const tabButton = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        const tabContent = document.getElementById(tabId);
        
        if (tabButton && tabContent) {
            // If closing active tab, activate another one
            if (this.activeTabId === tabId) {
                const remainingTabs = Array.from(this.tabs.keys())
                    .filter(id => id !== tabId);
                
                if (remainingTabs.length > 0) {
                    await this.activateTab(remainingTabs[0]);
                }
            }
    
            // Remove tab elements
            tabButton.remove();
            tabContent.remove();
            this.tabs.delete(tabId);
    
            // If last tab closed, create new one
            if (this.tabs.size === 0) {
                await this.addNewTab();
            }
        }
    }

    // async applyPreferences() {
    //     // Apply view mode and label position
    //     const fileList = document.getElementById('fileList');
    //     if (fileList) {
    //         fileList.classList.remove('list-view', 'grid-view');
    //         fileList.classList.add(`${this.currentView}-view`);
    //         fileList.dataset.labelPosition = this.labelPosition;
    //     }

    //     // Update view buttons
    //     const viewButtons = document.querySelectorAll('.view-button');
    //     viewButtons.forEach(button => {
    //         button.classList.remove('active');
    //         if (button.title.toLowerCase().includes(this.currentView)) {
    //             button.classList.add('active');
    //         }
    //     });

    //     // Apply image preview settings
    //     if (this.showImagePreviews) {
    //         const previewButton = document.querySelector('.view-button[title="Toggle Image Previews"]');
    //         if (previewButton) {
    //             previewButton.classList.add('active');
    //             if (this.currentView === 'grid') {
    //                 await this.loadImagePreviews();
    //             }
    //         }
    //     }

    //     console.log('Preferences applied:', {
    //         labelPosition: this.labelPosition,
    //         currentView: this.currentView,
    //         showImagePreviews: this.showImagePreviews
    //     });
    // }

    async applyPreferences() {
    try {
        const fileList = document.getElementById('fileList');
        if (fileList) {
            // Apply view mode
            fileList.classList.remove('list-view', 'grid-view');
            fileList.classList.add(`${this.currentView}-view`);
            fileList.dataset.labelPosition = this.labelPosition;

            // Update view buttons
            const viewButtons = document.querySelectorAll('.view-button');
            viewButtons.forEach(button => {
                button.classList.remove('active');
                if (button.title.toLowerCase().includes(this.currentView)) {
                    button.classList.add('active');
                }
            });

            // Apply image preview settings
            if (this.showImagePreviews) {
                const previewButton = document.querySelector('.view-button[title="Toggle Image Previews"]');
                if (previewButton) {
                    previewButton.classList.add('active');
                }
                // Force reload image previews if in grid view
                if (this.currentView === 'grid') {
                    await this.loadImagePreviews();
                }
            }
        }
    } catch (error) {
        console.error('Error applying preferences:', error);
    }
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

    async addToRecentFolders(path) {
        // Don't add if it's already the most recent
        if (this.recentFolders[0] === path) return;

        // Remove if it exists elsewhere in the list
        this.recentFolders = this.recentFolders.filter(folder => folder !== path);

        // Add to start of array
        this.recentFolders.unshift(path);

        // Keep only last 3
        this.recentFolders = this.recentFolders.slice(0, 3);

        // Update the UI
        this.updateRecentFoldersUI();

        // Save preferences
        await this.savePreferences();
    }

    updateRecentFoldersUI() {
        const quickAccess = document.querySelector('.quick-access');
        if (!quickAccess) return;

        // Remove existing recent folders section entirely
        const existingRecent = quickAccess.querySelector('.recent-folders');
        if (existingRecent) {
            existingRecent.remove();
        }

        // Only add recent folders section if we have any
        if (this.recentFolders.length > 0) {
            const recentSection = document.createElement('div');
            recentSection.className = 'recent-folders';

            this.recentFolders.forEach(path => {
                const folderName = path.split(/[\\/]/).pop();
                const button = document.createElement('button');
                button.className = 'quick-button recent-folder';
                button.innerHTML = `
                    <span class="material-symbols-outlined" 
                          style="color: var(--accent-color)">folder</span>
                    <span class="folder-name" title="${path}">${folderName}</span>
                `;
                button.onclick = () => this.loadDirectory(path);
                recentSection.appendChild(button);
            });

            // Insert after the last default quick access button
            const lastDefault = quickAccess.querySelector('.quick-button:not(.recent-folder):last-of-type');
            if (lastDefault) {
                lastDefault.after(recentSection);
            }
        }
    }

    // async loadDirectory(path) {
    //     try {
    //         const files = await window.electronAPI.fileSystem.readDirectory(path);
    //         this.currentPath = path;
    //         this.updateFileList(files);
    //         this.updateBreadcrumb(path);
    //         this.updateHistory(path);
    //         await this.addToRecentFolders(path);

    //         // Reapply view settings after loading directory
    //         const fileList = document.getElementById('fileList');
    //         if (fileList) {
    //             fileList.classList.remove('list-view', 'grid-view');
    //             fileList.classList.add(`${this.currentView}-view`);

    //             if (this.currentView === 'grid' && this.showImagePreviews) {
    //                 this.loadImagePreviews();
    //             }
    //         }
    //     } catch (error) {
    //         console.error('Error loading directory:', error);
    //         this.showError(`Failed to load directory: ${error.message}`);
    //     }
    // }

    async loadDirectory(path, tabId = null) {
        tabId = tabId || this.activeTabId;
        if (!tabId) return;
    
        try {
            const files = await window.electronAPI.fileSystem.readDirectory(path);
            
            // Update tab info
            const tabInfo = this.tabs.get(tabId);
            if (tabInfo) {
                tabInfo.path = path;
                // Update tab title to current folder name
                const folderName = path.split(/[\\/]/).pop() || path;
                const tabButton = document.querySelector(`.tab[data-tab-id="${tabId}"] .tab-title`);
                if (tabButton) {
                    tabButton.textContent = folderName;
                }
            }
    
            // Update content in the correct tab
            const tabPane = document.getElementById(tabId);
            if (tabPane) {
                this.updateFileList(files, tabPane);
                this.updateBreadcrumb(path, tabPane);
            }
        } catch (error) {
            console.error('Error loading directory:', error);
            this.showError(`Failed to load directory: ${error.message}`);
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
                drivesList.innerHTML = drives.map(drive => {
                    const circumference = 2 * Math.PI * 18;
                    const usagePercent = drive.rawSize ?
                        ((drive.rawSize - drive.rawFreeSpace) / drive.rawSize) * 100 : 0;
                    const dashOffset = circumference - (usagePercent / 100 * circumference);

                    // Format the drive name to include drive letter
                    const driveLetter = drive.path.charAt(0);
                    const driveLabel = drive.label || drive.path;
                    const displayName = driveLetter ? `${driveLetter}: ${driveLabel}` : driveLabel;

                    return `
                        <button onclick="fileManager.loadDirectory('${drive.path}')" class="drive-button">
                            <span class="material-symbols-outlined">hard_drive</span>
                            <div class="drive-info">
                                <span class="drive-name">${displayName}</span>
                                <span class="drive-space">${drive.freeSpace} free of ${drive.size}</span>
                            </div>
                            <div class="drive-indicator" title="${usagePercent.toFixed(1)}% used">
                                <svg width="40" height="40" viewBox="0 0 40 40">
                                    <circle cx="20" cy="20" r="18" 
                                            fill="none" 
                                            stroke="rgba(255,255,255,0.1)" 
                                            stroke-width="3"/>
                                    <circle cx="20" cy="20" r="18" 
                                            fill="none" 
                                            stroke="var(--accent-color)" 
                                            stroke-width="3"
                                            stroke-linecap="round"
                                            stroke-dasharray="${circumference}"
                                            stroke-dashoffset="${dashOffset}"
                                            class="progress-circle"/>
                                </svg>
                            </div>
                        </button>
                    `;
                }).join('');
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
            if (isResizing) {
                isResizing = false;
                panel.style.transition = '';

                // Save new position and size
                this.windowPosition = {
                    width: panel.style.width,
                    height: panel.style.height,
                    left: panel.style.left,
                    top: panel.style.top
                };
                this.savePreferences();
            }
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


    // Inside your FileManager class

    refreshWindow(windowId) {
        // Reload current directory
        if (this.currentPath) {
            this.loadDirectory(this.currentPath);
        } else {
            this.initializeFileManager();
        }
    }

    closeWindow() {
        // Save preferences before closing
        this.savePreferences();

        const panel = document.getElementById('file-manager');
        if (panel) {
            panel.remove();
            windows.delete('file-manager');
            this.windows.delete('file-manager');
            DockManager.renderDock();
        }
    }

    minimizeWindow() {
        this.savePreferences();

        const panel = document.getElementById('file-manager');
        if (panel) {
            panel.style.display = 'none';
            windows.get('file-manager').minimized = true;
            DockManager.renderDock();
        }
    }


} // End of class

// Make refreshWindow available globally
window.refreshWindow = (windowId) => {
    if (window.fileManager) {
        window.fileManager.refreshWindow(windowId);
    }
};

// Initialize and export
window.FileManagerOld = FileManagerOld;
window.fileManagerOld = new FileManagerOld();

console.log('Old File Manager loaded and registered globally:', {
    class: typeof window.FileManagerOld !== 'undefined',
    instance: typeof window.fileManagerOld !== 'undefined'
});
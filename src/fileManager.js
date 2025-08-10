/* eslint-disable no-case-declarations */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
console.log('Loading File Manager...');

class FileManager {
    constructor() {
        this.windows = new Map();
        this.currentPath = '';
        this.history = [];
        this.historyIndex = -1;
        // Set default preferences - these will be overwritten
        this.labelPosition = 'bottom';
        this.currentView = 'list';
        this.showImagePreviews = true;
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
        this.currentSort = {
            column: 'name',    // Default sort column
            ascending: true    // Default sort direction
        };
        this.imageViewer = {
            currentIndex: -1,
            images: [],
            scale: 1,
            minScale: 0.1,
            maxScale: 3
        };
        this.foldersFirst = true; // Default to folders first
        this.showHiddenFiles = false; // Default to not showing hidden files

        // Immediately load preferences
        this.initializePreferences();
        this.setupImageViewer();
    }

// Add new methods for image viewer
async setupImageViewer() {
    // Create viewer HTML if it doesn't exist
    if (!document.getElementById('file-manager-image-viewer')) {
        const viewerHTML = `
            <div id="file-manager-image-viewer" class="image-viewer-modal">
                <div class="image-viewer-content">
                    <div class="image-viewer-toolbar">
                        <div class="image-info">
                            <span class="image-name"></span>
                        </div>
                        <div class="image-actions">
                            <button class="set-wallpaper-btn" title="Set as Wallpaper">
                                <span class="material-symbols-outlined">wallpaper</span>
                            </button>
                            <button class="close-viewer-btn" title="Close">
                                <span class="material-symbols-outlined">close</span>
                            </button>
                        </div>
                    </div>
                    <div class="image-viewer-main">
                        <button class="nav-btn prev-btn" title="Previous">
                            <span class="material-symbols-outlined">chevron_left</span>
                        </button>
                        <div class="image-container">
                            <img src="" alt="" />
                        </div>
                        <button class="nav-btn next-btn" title="Next">
                            <span class="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', viewerHTML);
        this.setupImageViewerEvents();
    }
}

setupImageViewerEvents() {
    const viewer = document.getElementById('file-manager-image-viewer');
    const prevBtn = viewer.querySelector('.prev-btn');
    const nextBtn = viewer.querySelector('.next-btn');
    const closeBtn = viewer.querySelector('.close-viewer-btn');
    const wallpaperBtn = viewer.querySelector('.set-wallpaper-btn');
    const imageContainer = viewer.querySelector('.image-container');
    const img = viewer.querySelector('img');

    // Add zoom buttons to toolbar
    const actionsDiv = viewer.querySelector('.image-actions');
    actionsDiv.insertAdjacentHTML('afterbegin', `
        <button class="zoom-btn zoom-out" title="Zoom Out">
            <span class="material-symbols-outlined">zoom_out</span>
        </button>
        <button class="zoom-btn zoom-in" title="Zoom In">
            <span class="material-symbols-outlined">zoom_in</span>
        </button>
        <button class="zoom-btn zoom-fit" title="Fit to Screen">
            <span class="material-symbols-outlined">fit_screen</span>
        </button>
    `);

    // Navigation buttons
    prevBtn.onclick = () => this.showPreviousImage();
    nextBtn.onclick = () => this.showNextImage();
    closeBtn.onclick = () => this.closeImageViewer();
    wallpaperBtn.onclick = () => this.setAsWallpaper();

    // Zoom buttons
    viewer.querySelector('.zoom-in').onclick = () => this.zoomImage(0.1);
    viewer.querySelector('.zoom-out').onclick = () => this.zoomImage(-0.1);
    viewer.querySelector('.zoom-fit').onclick = () => this.fitImageToScreen();

    // Mouse wheel zoom
    imageContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.zoomImage(delta);
    });

    // Reset zoom when switching images
    const resetZoom = () => {
        this.imageViewer.scale = 1;
        this.updateImageScale();
    };

    prevBtn.addEventListener('click', resetZoom);
    nextBtn.addEventListener('click', resetZoom);

    // Handle keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!viewer.classList.contains('active')) return;
        
        switch(e.key) {
            case 'ArrowLeft':
                this.showPreviousImage();
                resetZoom();
                break;
            case 'ArrowRight':
                this.showNextImage();
                resetZoom();
                break;
            case 'Escape':
                this.closeImageViewer();
                break;
        }
    });

    // Click outside to close
    viewer.addEventListener('click', (e) => {
        if (e.target === viewer) {
            this.closeImageViewer();
        }
    });
}

// Add these new methods
zoomImage(delta) {
    const newScale = Math.max(
        this.imageViewer.minScale,
        Math.min(this.imageViewer.maxScale, this.imageViewer.scale + delta)
    );
    this.imageViewer.scale = newScale;
    this.updateImageScale();
}

fitImageToScreen() {
    const viewer = document.getElementById('file-manager-image-viewer');
    const container = viewer.querySelector('.image-container');
    const img = viewer.querySelector('img');

    if (img.naturalWidth && img.naturalHeight) {
        // Get actual container dimensions
        const containerRect = container.getBoundingClientRect();
        
        // Add padding for visual comfort
        const padding = 40; // 20px on each side
        const maxWidth = containerRect.width - padding;
        const maxHeight = containerRect.height - padding;

        // Calculate original aspect ratio
        const imageRatio = img.naturalWidth / img.naturalHeight;
        const containerRatio = maxWidth / maxHeight;

        // Determine which dimension is the constraint
        let newWidth, newHeight;
        
        if (imageRatio > containerRatio) {
            // Image is wider relative to container
            newWidth = maxWidth;
            newHeight = newWidth / imageRatio;
        } else {
            // Image is taller relative to container
            newHeight = maxHeight;
            newWidth = newHeight * imageRatio;
        }

        // Calculate scale based on the original dimensions
        this.imageViewer.scale = Math.min(
            newWidth / img.naturalWidth,
            newHeight / img.naturalHeight
        );

        console.log('Image scaling:', {
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            containerWidth: maxWidth,
            containerHeight: maxHeight,
            scale: this.imageViewer.scale
        });

        this.updateImageScale();
    }
}

updateImageScale() {
    const img = document.querySelector('#file-manager-image-viewer img');
    if (img) {
        // Apply transform and center the image
        img.style.transform = `scale(${this.imageViewer.scale})`;
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
        
        // Ensure image is centered
        img.style.position = 'absolute';
        img.style.left = '50%';
        img.style.top = '50%';
        img.style.transform = `translate(-50%, -50%) scale(${this.imageViewer.scale})`;
    }
}
showImageViewer(imagePath) {
    const viewer = document.getElementById('file-manager-image-viewer');
    const img = viewer.querySelector('img');
    const nameEl = viewer.querySelector('.image-name');
    
    // Get all images in current view
    const galleryImages = document.querySelectorAll('.gallery-image-item');
    this.imageViewer.images = Array.from(galleryImages).map(item => ({
        path: item.dataset.path,
        name: item.dataset.fullName || item.querySelector('.file-name').textContent
    }));
    
    // Find clicked image index
    this.imageViewer.currentIndex = this.imageViewer.images.findIndex(img => img.path === imagePath);
    
    // Reset zoom scale
    this.imageViewer.scale = 1;
    
    // Set initial image
    const currentImage = this.imageViewer.images[this.imageViewer.currentIndex];
    img.src = `file:///${currentImage.path.replace(/\\/g, '/')}`;
    nameEl.textContent = currentImage.name;
    
    // When image loads, fit it to screen
    img.onload = () => this.fitImageToScreen();
    
    viewer.classList.add('active');
}

showPreviousImage() {
    if (this.imageViewer.currentIndex > 0) {
        this.imageViewer.currentIndex--;
        this.updateViewerImage();
    }
}

showNextImage() {
    if (this.imageViewer.currentIndex < this.imageViewer.images.length - 1) {
        this.imageViewer.currentIndex++;
        this.updateViewerImage();
    }
}

updateViewerImage() {
    const viewer = document.getElementById('file-manager-image-viewer');
    const img = viewer.querySelector('img');
    const nameEl = viewer.querySelector('.image-name');
    const currentImage = this.imageViewer.images[this.imageViewer.currentIndex];
    
    img.src = `file:///${currentImage.path.replace(/\\/g, '/')}`;
    nameEl.textContent = currentImage.name;
}

async setAsWallpaper() {
    try {
        const currentImage = this.imageViewer.images[this.imageViewer.currentIndex];
        const imageUrl = `file:///${currentImage.path.replace(/\\/g, '/')}`;
        
        // Set as wallpaper
        const result = await window.electronAPI.setWallpaper(imageUrl);
        
        if (result.success) {
            // Add to wallpapers store
            const wallpapers = await window.electronAPI.store.get('wallpapers') || [];
            const newWallpaper = {
                id: `wallpaper-${Date.now()}`,
                name: currentImage.name,
                url: imageUrl,
                type: 'local'
            };
            
            // Avoid duplicates
            if (!wallpapers.some(w => w.url === imageUrl)) {
                wallpapers.push(newWallpaper);
                await window.electronAPI.store.set('wallpapers', wallpapers);
            }
            
            // Save as last wallpaper
            await window.electronAPI.invoke('save-last-wallpaper', imageUrl);
        }
    } catch (error) {
        console.error('Error setting wallpaper:', error);
    }
}

closeImageViewer() {
    const viewer = document.getElementById('file-manager-image-viewer');
    viewer.classList.remove('active');
}

    handleColumnClick(column) {
        // If clicking the same column, reverse the sort direction
        if (this.currentSort.column === column) {
            this.currentSort.ascending = !this.currentSort.ascending;
        } else {
            // New column, set it with ascending sort
            this.currentSort.column = column;
            this.currentSort.ascending = true;
        }
    
        // Update sort indicators in UI
        this.updateSortIndicators();
        
        // Use the new refresh method instead of full directory refresh
        this.refreshFileList();
    }
    
    updateSortIndicators() {
        const headers = document.querySelectorAll('.column-headers > div');
        headers.forEach(header => {
            const column = header.className.replace('header-', '');
            header.classList.remove('sort-asc', 'sort-desc');
            if (column === this.currentSort.column) {
                header.classList.add(this.currentSort.ascending ? 'sort-asc' : 'sort-desc');
            }
        });
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

    async refreshFileList() {
        const currentTabInfo = this.tabs.get(this.activeTabId);
        if (!currentTabInfo?.path) return;
    
        try {
            console.log('Refreshing file list for path:', currentTabInfo.path);
            const files = await window.electronAPI.fileSystem.readDirectory(currentTabInfo.path);
            await this.updateFileList(files);
        } catch (error) {
            console.error('Error refreshing file list:', error);
            this.showError('Failed to refresh file list');
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
        fileList.classList.remove('list-view', 'grid-view', 'gallery-view');
        fileList.classList.add(`${viewType}-view`);
        this.currentView = viewType;

        // Refresh the file list with the new view type
        this.refreshDirectory();

        this.savePreferences();
    }
// working gallery view
    // setupGalleryView(fileList) {
    //     // Clear existing content
    //     fileList.innerHTML = `
    //         <div class="gallery-container">
    //             <div class="gallery-top">
    //                 <div class="gallery-images"></div>
    //                 <div class="gallery-files"></div>
    //             </div>
    //             <div class="gallery-folders"></div>
    //         </div>
    //     `;

    //     const items = Array.from(document.querySelectorAll('.file-item'));
    //     const imageItems = items.filter(item => this.isImageFile(item.dataset.path));
    //     const folderItems = items.filter(item => item.classList.contains('directory'));
    //     const otherFiles = items.filter(item => 
    //         !item.classList.contains('directory') && 
    //         !this.isImageFile(item.dataset.path)
    //     );

    //     // Populate sections
    //     const imagesSection = fileList.querySelector('.gallery-images');
    //     const filesSection = fileList.querySelector('.gallery-files');
    //     const foldersSection = fileList.querySelector('.gallery-folders');

    //     // Setup image gallery
    //     imageItems.forEach(item => {
    //         const clone = item.cloneNode(true);
    //         this.setupImagePreview(clone);
    //         imagesSection.appendChild(clone);
    //     });

    //     // Setup files list
    //     otherFiles.forEach(item => {
    //         const clone = item.cloneNode(true);
    //         filesSection.appendChild(clone);
    //     });

    //     // Setup folders list
    //     folderItems.forEach(item => {
    //         const clone = item.cloneNode(true);
    //         foldersSection.appendChild(clone);
    //     });

    //     // Load image previews
    //     this.loadGalleryPreviews();
    // }

    isImageFile(path) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const ext = path.toLowerCase().slice(path.lastIndexOf('.'));
        return imageExtensions.includes(ext);
    }

    setupImagePreview(item) {
        if (this.isImageFile(item.dataset.path)) {
            item.classList.add('gallery-image-item');
            const fileUrl = `file:///${item.dataset.path.replace(/\\/g, '/')}`;
            item.dataset.preview = fileUrl;
            item.style.setProperty('--preview-url', `url("${fileUrl}")`);
        }
    }

    loadGalleryPreviews() {
        const imageItems = document.querySelectorAll('.gallery-image-item');
        imageItems.forEach(item => {
            const img = new Image();
            img.onload = () => {
                item.classList.add('preview-loaded');
            };
            img.onerror = () => {
                item.classList.remove('preview-loaded');
                console.error(`Failed to load preview for: ${item.dataset.path}`);
            };
            img.src = item.dataset.preview;
        });
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
        // Remove the view mode check since grid view always shows previews
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
                    item.classList.add('preview-loaded');
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

    async savePreferences() {
        try {
            const preferences = {
                labelPosition: this.labelPosition,
                viewMode: this.currentView,
                showImagePreviews: this.showImagePreviews,
                recentFolders: this.recentFolders,
                windowPosition: this.windowPosition,
                foldersFirst: this.foldersFirst,
                showHiddenFiles: this.showHiddenFiles
            };
            await window.electronAPI.store.set('fileManagerPreferences', preferences);
        } catch (error) {
            console.error('Error saving preferences:', error);
        }
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
                this.foldersFirst = storedPrefs.foldersFirst ?? true;
                this.showHiddenFiles = storedPrefs.showHiddenFiles ?? false;
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
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
<button onclick="fileManager.refreshFileList()" class="nav-button" title="Refresh">
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
    <button onclick="fileManager.setupListView()" class="view-button active" title="List View">
        <span class="material-symbols-outlined">view_list</span>
    </button>
    <button onclick="fileManager.setupGridView()" class="view-button" title="Grid View">
        <span class="material-symbols-outlined">grid_view</span>
    </button>
    <button onclick="fileManager.setupGalleryView()" class="view-button" title="Gallery View">
        <span class="material-symbols-outlined">photo_library</span>
    </button>
            <button onclick="fileManager.toggleFoldersFirst()" class="view-button folders-first-btn active" title="Folders First">
        <span class="material-symbols-outlined">folder_copy</span>
    </button>

    <button onclick="fileManager.toggleHiddenFiles()" class="view-button hidden-files-btn" title="Show Hidden Files">
    <span class="material-symbols-outlined">visibility</span>
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
        <div class="header-name" onclick="fileManager.handleColumnClick('name')">Name</div>
        <div class="header-modified" onclick="fileManager.handleColumnClick('modified')">Modified</div>
        <div class="header-type" onclick="fileManager.handleColumnClick('type')">Type</div>
        <div class="header-size" onclick="fileManager.handleColumnClick('size')">Size</div>
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


    toggleHiddenFiles() {
        this.showHiddenFiles = !this.showHiddenFiles;
        console.log('Hidden files toggled:', this.showHiddenFiles); // Debug log
        
        // Update button state
        const button = document.querySelector('.hidden-files-btn');
        if (button) {
            button.classList.toggle('active', this.showHiddenFiles);
        }
        
        this.refreshDirectory();
        this.savePreferences();
    }

    async setupListView() {

        const foldersFirstBtn = document.querySelector('.folders-first-btn');
        if (foldersFirstBtn) {
            foldersFirstBtn.style.opacity = '1';
            foldersFirstBtn.style.pointerEvents = 'auto';
            foldersFirstBtn.classList.toggle('active', this.foldersFirst);
        };
        console.log('Setting up list view');
        
        const fileList = document.getElementById('fileList');
        if (!fileList) return;
    
        // Reset the file list
        fileList.className = 'file-list';
        fileList.innerHTML = '';
        
        // Add list view class
        fileList.classList.add('list-view');
        
        // Update view state and buttons
        this.currentView = 'list';
        const viewButtons = document.querySelectorAll('.view-button');
        viewButtons.forEach(button => {
            button.classList.remove('active');
            if (button.title.toLowerCase().includes('list')) {
                button.classList.add('active');
            }
        });
    
        // Use the new refreshFileList method instead
        await this.refreshFileList();
    }
    
    async setupGridView() {

        const foldersFirstBtn = document.querySelector('.folders-first-btn');
        if (foldersFirstBtn) {
            foldersFirstBtn.style.opacity = '1';
            foldersFirstBtn.style.pointerEvents = 'auto';
            foldersFirstBtn.classList.toggle('active', this.foldersFirst);
        };

        console.log('Setting up grid view');
        
        const fileList = document.getElementById('fileList');
        if (!fileList) return;
    
        // Reset and set up grid view
        fileList.className = 'file-list';
        fileList.innerHTML = '';
        fileList.classList.add('grid-view');
        
        // Update view state and buttons
        this.currentView = 'grid';
        const viewButtons = document.querySelectorAll('.view-button');
        viewButtons.forEach(button => {
            button.classList.remove('active');
            if (button.title.toLowerCase().includes('grid')) {
                button.classList.add('active');
            }
        });
    
        // Refresh using our new method
        await this.refreshFileList();
    }
    
    // Update updateFileList to handle grid view
//     async updateFileList(files) {
//         const fileList = document.getElementById('fileList');
//         if (!fileList) return;
    
//         // Sort the files based on current sort settings
//         const sortedFiles = [...files].sort((a, b) => {
//             let comparison = 0;
//             switch (this.currentSort.column) {
//                 case 'name':
//                     comparison = a.name.localeCompare(b.name, undefined, {numeric: true});
//                     break;
//                 case 'modified':
//                     comparison = new Date(a.modified) - new Date(b.modified);
//                     break;
//                 case 'type':
//                     comparison = a.type.localeCompare(b.type);
//                     break;
//                 case 'size':
//                     if (a.isDirectory && !b.isDirectory) return -1;
//                     if (!a.isDirectory && b.isDirectory) return 1;
//                     if (a.isDirectory && b.isDirectory) return a.name.localeCompare(b.name);
//                     const sizeA = parseInt(a.size) || 0;
//                     const sizeB = parseInt(b.size) || 0;
//                     comparison = sizeA - sizeB;
//                     break;
//             }
//             return this.currentSort.ascending ? comparison : -comparison;
//         });
    
//         switch (this.currentView) {
//             case 'list':
//                 // Existing list view code
//                 fileList.innerHTML = sortedFiles.map(file => `
//                     <div class="file-item ${file.isDirectory ? 'directory' : 'file'}" 
//                          data-path="${file.path}"
//                          ondblclick="fileManager.handleFileClick('${file.path.replace(/\\/g, '\\\\')}')">
//                         <span class="material-symbols-outlined">
//                             ${file.isDirectory ? 'folder' : this.getFileIcon(file)}
//                         </span>
//                         <div class="file-details">
//                             <div class="file-name">${file.name}</div>
//                             <div class="file-modified">${file.modified}</div>
//                             <div class="file-type">${file.type}</div>
//                             <div class="file-size">${file.size}</div>
//                         </div>
//                     </div>
//                 `).join('');
//                 break;
    
// // In updateFileList method
// case 'grid':
//     fileList.innerHTML = sortedFiles.map(file => `
//         <div class="file-item ${file.isDirectory ? 'directory' : 'file'}" 
//              data-path="${file.path}"
//              data-full-name="${file.name}"
//              ondblclick="fileManager.handleFileClick('${file.path.replace(/\\/g, '\\\\')}')">
//             <div class="grid-item-content">
//                 <span class="material-symbols-outlined">
//                     ${file.isDirectory ? 'folder' : this.getFileIcon(file)}
//                 </span>
//                 <div class="file-details">
//                     <div class="file-name" title="${file.name}">${file.name}</div>
//                     <div class="file-info">
//                         <span class="file-type">${file.type}</span>
//                         <span class="file-size">${file.size}</span>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     `).join('');

//     // Always load image previews in grid view
//     this.loadImagePreviews();
//     break;

//     case 'gallery':
//         // Create gallery structure
//         fileList.innerHTML = `
//             <div class="gallery-container">
//                 <div class="gallery-top">
//                     <div class="gallery-images"></div>
//                     <div class="gallery-files"></div>
//                 </div>
//                 <div class="gallery-folders"></div>
//             </div>
//         `;

//         const galleryImages = fileList.querySelector('.gallery-images');
//         const galleryFiles = fileList.querySelector('.gallery-files');
//         const galleryFolders = fileList.querySelector('.gallery-folders');

//         // Process each file into appropriate section
//         sortedFiles.forEach(file => {
//             if (file.isDirectory) {
//                 galleryFolders.insertAdjacentHTML('beforeend', `
//                     <div class="file-item directory" 
//                          data-path="${file.path}"
//                          data-full-name="${file.name}"
//                          ondblclick="fileManager.handleFileClick('${file.path.replace(/\\/g, '\\\\')}')">
//                         <span class="material-symbols-outlined">folder</span>
//                         <div class="file-details">
//                             <div class="file-name">${file.name}</div>
//                         </div>
//                     </div>
//                 `);
//             } else if (this.isImageFile(file.path)) {
//                 galleryImages.insertAdjacentHTML('beforeend', `
//                     <div class="file-item gallery-image-item" 
//                          data-path="${file.path}"
//                          data-full-name="${file.name}"
//                          ondblclick="fileManager.showImageViewer('${file.path.replace(/\\/g, '\\\\')}')">
//                         <div class="file-details">
//                             <div class="file-name">${file.name}</div>
//                         </div>
//                     </div>
//                 `);
//             } else {
//                 galleryFiles.insertAdjacentHTML('beforeend', `
//                     <div class="file-item" 
//                          data-path="${file.path}"
//                          title="${file.name}"
//                          ondblclick="fileManager.handleFileClick('${file.path.replace(/\\/g, '\\\\')}')">
//                         <span class="material-symbols-outlined">${this.getFileIcon(file)}</span>
//                         <div class="file-details">
//                             <div class="file-name">${file.name}</div>
//                         </div>
//                     </div>
//                 `);
//             }
//         });

//         // Load image previews for gallery
//         const imageItems = galleryImages.querySelectorAll('.gallery-image-item');
//         imageItems.forEach(item => {
//             const filePath = item.dataset.path;
//             const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
//             item.style.setProperty('--preview-url', `url("${fileUrl}")`);
            
//             const img = new Image();
//             img.onload = () => {
//                 item.classList.add('preview-loaded');
//             };
//             img.onerror = () => {
//                 console.error(`Failed to load preview for: ${filePath}`);
//             };
//             img.src = fileUrl;
//         });
//         break;
// }

// this.updateStatus(sortedFiles.length);
// this.updateSortIndicators();
//     }

// Add new method to handle the toggle
toggleFoldersFirst() {
    if (this.currentView === 'gallery') return; // Ignore in gallery view
    
    this.foldersFirst = !this.foldersFirst;
    
    // Update button state
    const button = document.querySelector('.folders-first-btn');
    if (button) {
        button.classList.toggle('active', this.foldersFirst);
    }
    
    // Refresh the current view
    this.refreshFileList();
}

async updateFileList(files) {
    const fileList = document.getElementById('fileList');
    if (!fileList) return;

    // Filter hidden files FIRST, before any other processing
    const workingFiles = this.showHiddenFiles 
        ? files 
        : files.filter(file => !file.name.startsWith('.'));

    // Now sort the filtered files
    const sortedFiles = [...workingFiles].sort((a, b) => {
        let comparison = 0;
        
        // First check folders-first preference if enabled
        if (this.foldersFirst && this.currentView !== 'gallery') {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            if (a.isDirectory === b.isDirectory) {
                switch (this.currentSort.column) {
                    case 'name':
                        comparison = a.name.localeCompare(b.name, undefined, {numeric: true});
                        break;
                    case 'modified':
                        comparison = new Date(a.modified) - new Date(b.modified);
                        break;
                    case 'type':
                        comparison = a.type.localeCompare(b.type);
                        break;
                    case 'size':
                        const sizeA = parseInt(a.size) || 0;
                        const sizeB = parseInt(b.size) || 0;
                        comparison = sizeA - sizeB;
                        break;
                }
            }
        } else {
            switch (this.currentSort.column) {
                case 'name':
                    comparison = a.name.localeCompare(b.name, undefined, {numeric: true});
                    break;
                case 'modified':
                    comparison = new Date(a.modified) - new Date(b.modified);
                    break;
                case 'type':
                    comparison = a.type.localeCompare(b.type);
                    break;
                case 'size':
                    const sizeA = parseInt(a.size) || 0;
                    const sizeB = parseInt(b.size) || 0;
                    comparison = sizeA - sizeB;
                    break;
            }
        }
        return this.currentSort.ascending ? comparison : -comparison;
    });

    switch (this.currentView) {
        case 'list':
            // Show ALL files and folders in list view
            fileList.innerHTML = sortedFiles.map(file => `
                <div class="file-item ${file.isDirectory ? 'directory' : 'file'}" 
                     data-path="${file.path}"
                     ondblclick="fileManager.handleFileClick('${file.path.replace(/\\/g, '\\\\')}')">
                    <span class="material-symbols-outlined">
                        ${file.isDirectory ? 'folder' : this.getFileIcon(file)}
                    </span>
                    <div class="file-details">
                        <div class="file-name">${file.name}</div>
                        <div class="file-modified">${file.modified}</div>
                        <div class="file-type">${file.type}</div>
                        <div class="file-size">${file.size}</div>
                    </div>
                </div>
            `).join('');
            break;

        case 'grid':
            // Show ALL files and folders in grid view
            fileList.innerHTML = sortedFiles.map(file => `
                <div class="file-item ${file.isDirectory ? 'directory' : 'file'}" 
                     data-path="${file.path}"
                     data-full-name="${file.name}"
                     ondblclick="fileManager.handleFileClick('${file.path.replace(/\\/g, '\\\\')}')">
                    <div class="grid-item-content">
                        <span class="material-symbols-outlined">
                            ${file.isDirectory ? 'folder' : this.getFileIcon(file)}
                        </span>
                        <div class="file-details">
                            <div class="file-name" title="${file.name}">${file.name}</div>
                            <div class="file-info">
                                <span class="file-type">${file.type}</span>
                                <span class="file-size">${file.size}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');

            // If image previews are enabled, load them
            this.loadImagePreviews();
            break;

        case 'gallery':
            // Gallery view remains the same with separated sections
            fileList.innerHTML = `
                <div class="gallery-container">
                    <div class="gallery-top">
                        <div class="gallery-images"></div>
                        <div class="gallery-files"></div>
                    </div>
                    <div class="gallery-folders"></div>
                </div>
            `;

            const galleryImages = fileList.querySelector('.gallery-images');
            const galleryFiles = fileList.querySelector('.gallery-files');
            const galleryFolders = fileList.querySelector('.gallery-folders');

            // Process each file into appropriate section
            sortedFiles.forEach(file => {
                if (file.isDirectory) {
                    galleryFolders.insertAdjacentHTML('beforeend', `
                        <div class="file-item directory" 
                             data-path="${file.path}"
                             ondblclick="fileManager.handleFileClick('${file.path.replace(/\\/g, '\\\\')}')">
                            <span class="material-symbols-outlined">folder</span>
                            <div class="file-details">
                                <div class="file-name">${file.name}</div>
                            </div>
                        </div>
                    `);
                } else if (this.isImageFile(file.path)) {
                    galleryImages.insertAdjacentHTML('beforeend', `
                        <div class="file-item gallery-image-item" 
                             data-path="${file.path}"
                             data-full-name="${file.name}"
                             ondblclick="fileManager.showImageViewer('${file.path.replace(/\\/g, '\\\\')}')">
                            <div class="file-details">
                                <div class="file-name">${file.name}</div>
                            </div>
                        </div>
                    `);
                } else {
                    galleryFiles.insertAdjacentHTML('beforeend', `
                        <div class="file-item" 
                             data-path="${file.path}"
                             ondblclick="fileManager.handleFileClick('${file.path.replace(/\\/g, '\\\\')}')">
                            <span class="material-symbols-outlined">${this.getFileIcon(file)}</span>
                            <div class="file-details">
                                <div class="file-name">${file.name}</div>
                            </div>
                        </div>
                    `);
                }
            });

            // Load image previews for gallery
            const imageItems = galleryImages.querySelectorAll('.gallery-image-item');
            imageItems.forEach(item => {
                const filePath = item.dataset.path;
                const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
                item.style.setProperty('--preview-url', `url("${fileUrl}")`);
                
                const img = new Image();
                img.onload = () => {
                    item.classList.add('preview-loaded');
                };
                img.onerror = () => {
                    console.error(`Failed to load preview for: ${filePath}`);
                };
                img.src = fileUrl;
            });
            break;
    }

    this.updateStatus(sortedFiles.length);
    this.updateSortIndicators();
}
    
    async setupGalleryView() {

        const foldersFirstBtn = document.querySelector('.folders-first-btn');
        if (foldersFirstBtn) {
            foldersFirstBtn.style.opacity = '0.5';
            foldersFirstBtn.style.pointerEvents = 'none';
        };

        console.log('Setting up gallery view');
        
        const fileList = document.getElementById('fileList');
        if (!fileList) return;
    
        // Reset and set up gallery view
        fileList.className = 'file-list';
        fileList.innerHTML = '';
        fileList.classList.add('gallery-view');
        
        // Update view state and buttons
        this.currentView = 'gallery';
        const viewButtons = document.querySelectorAll('.view-button');
        viewButtons.forEach(button => {
            button.classList.remove('active');
            if (button.title.toLowerCase().includes('gallery')) {
                button.classList.add('active');
            }
        });
    
        // Refresh using our new method
        await this.refreshFileList();
    }

    getFileIcon(file) {
        if (file.isDirectory) return 'folder';
        
        // Determine icon based on file type
        if (this.isImageFile(file.path)) return 'image';
        
        const fileExtension = file.path.toLowerCase().split('.').pop();
        const iconMap = {
            pdf: 'picture_as_pdf',
            doc: 'description',
            docx: 'description',
            txt: 'article',
            md: 'article',
            mp3: 'audio_file',
            mp4: 'video_file',
            mov: 'video_file',
            zip: 'folder_zip',
            rar: 'folder_zip',
            '7z': 'folder_zip',
            exe: 'terminal',
            js: 'code',
            py: 'code',
            html: 'html',
            css: 'css'
        };
    
        return iconMap[fileExtension] || 'description';
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
window.FileManager = FileManager;
window.fileManager = new FileManager();

console.log('File Manager loaded and registered globally:', {
    class: typeof window.FileManager !== 'undefined',
    instance: typeof window.fileManager !== 'undefined'
});
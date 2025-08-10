/* eslint-disable no-undef */
// State management
let moduleManager;
let codeManager;
let terminalManager;
let windowCounter = 0;
const windows = new Map();
let isDockHidden = true;
let tabCounter = 0;
const tabGroups = new Map(); // Container ID -> Tab array
const AppState = {
    initialized: false,
    systemControlsInitialized: false
};


const css = `
/* Base styles for system controls */
.system-controls {
    border-radius: 12px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
}

.icon-button {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
}

/* Quick menu styles */
.quick-menu {
    position: fixed;
    border-radius: 12px;
    padding: 16px;
    min-width: 300px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    backdrop-filter: blur(10px);
    z-index: 10000;
}

.widget-quick-item {
    display: flex;
    align-items: center;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.window-counter {
    position: absolute;
    top: -5px;
    right: -5px;
    background: var(--accent-color);
    color: ${props => getContrastColor(props.theme.colors.accent)};
    border-radius: 10px;
    padding: 2px 6px;
    font-size: 12px;
    min-width: 18px;
    text-align: center;
}
`;

async function testFileSystem() {
    const result = await window.electronAPI.testFS();
    console.log('File system test result:', result);
}

async function captureAndSaveScreenshot() {
    try {
        const result = await window.electronAPI.takeScreenshot();
        if (result.success) {
            console.log('Screenshot saved successfully');
        } else if (result.canceled) {
            console.log('Screenshot was canceled');
        } else {
            console.error('Failed to save screenshot:', result.error);
        }
    } catch (error) {
        console.error('Error capturing screenshot:', error);
    }
}

window.electronAPI.onCaptureScreenshot(() => {
    captureAndSaveScreenshot();
});

async function clearWidgetStore() {
    await window.electronAPI.store.set('widgets', []);
    console.log('Widget store cleared');
}

function refreshContainer(containerId) {
    const activeTab = getActiveTab(containerId);
    if (activeTab) {
        const webview = activeTab.pane.querySelector('webview');
        if (webview) {
            webview.reload();
        }
    }
}

async function createWebContainer() {
    return new Promise(async (resolve) => {
        const containerId = `container-${Date.now()}`;
        const width = 800;
        const height = 600;
        const left = Math.max(10, window.innerWidth / 2 - width / 2);
        const top = Math.max(10, window.innerHeight / 2 - height / 2);

        console.log('Window dimensions:', {
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight
        });
        console.log('Setting container position:', { width, height, left, top });

        const windowHtml = `
            <div class="window web-container" id="${containerId}" style="transform: translate(0, 0) !important;">
                <div class="window-header">
                    <div class="window-title">
                        <span class="material-symbols-outlined">web</span>
                        Web Browser
                    </div>
                    <div class="window-controls">
                        <button onclick="refreshWindow('${containerId}')" title="Refresh" class="control-button">
                            <span class="material-symbols-outlined">refresh</span>
                        </button>
                        <button onclick="minimizeWindow('${containerId}')" title="Minimize" class="control-button">
                            <span class="material-symbols-outlined">remove</span>
                        </button>
                        <button onclick="closeWindow('${containerId}')" title="Close" class="control-button">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
                <div class="browser-controls">
                    <div class="tab-bar" id="${containerId}-tabs">
                        <button onclick="newTab('${containerId}')" class="new-tab-btn">
                            <span class="material-symbols-outlined">add</span>
                        </button>
                    </div>
                    <div class="url-controls">
                        <button class="nav-btn" onclick="goBack('${containerId}')" disabled>←</button>
                        <button class="nav-btn" onclick="goForward('${containerId}')" disabled>→</button>
                        <input type="text" class="url-input" id="${containerId}-url" 
                               placeholder="Enter URL or search terms"
                               onkeydown="if(event.key==='Enter')loadUrl('${containerId}',this.value)">
                    </div>
                </div>
                <div class="tab-content" id="${containerId}-content"></div>
                <div class="resize-handle"></div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', windowHtml);
        const containerEl = document.getElementById(containerId);

        // Apply theme
        (async () => {
            const currentTheme = await window.getCurrentTheme();
            if (currentTheme) {
                const titlebar = containerEl.querySelector('.window-header');
                if (titlebar) {
                    updateTitlebarStyle(titlebar, currentTheme, false);
                }
            }
        })();

        if (containerEl) {
            // Set initial position and size
            Object.assign(containerEl.style, {
                position: 'fixed',
                width: `${width}px`,
                height: `${height}px`,
                left: `${left}px`,
                top: `${top}px`,
                zIndex: '1000',
                backgroundColor: 'var(--window-bg)',
                boxShadow: '0 0 10px rgba(0,0,0,0.3)',
                borderRadius: '8px'
            });

            // Use makeDraggable for drag and snap functionality
            makeDraggable(containerEl);

            // Keep resize functionality
            const resizeHandle = containerEl.querySelector('.resize-handle');
            if (resizeHandle) {
                let isResizing = false;
                let startX;
                let startY;
                let startWidth;
                let startHeight;

                resizeHandle.addEventListener('mousedown', e => {
                    isResizing = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startWidth = parseInt(getComputedStyle(containerEl).width, 10);
                    startHeight = parseInt(getComputedStyle(containerEl).height, 10);

                    containerEl.style.transition = 'none';
                    WindowManager.bringToFront(containerEl);

                    // Prevent event from bubbling to makeDraggable
                    e.stopPropagation();
                });

                document.addEventListener('mousemove', e => {
                    if (!isResizing) return;
                    const newWidth = Math.max(800, startWidth + (e.clientX - startX));
                    const newHeight = Math.max(600, startHeight + (e.clientY - startY));
                    containerEl.style.width = `${newWidth}px`;
                    containerEl.style.height = `${newHeight}px`;
                });

                document.addEventListener('mouseup', () => {
                    isResizing = false;
                    containerEl.style.transition = '';
                });
            }
        }

        // Initialize tabs
        tabGroups.set(containerId, []);
        await newTab(containerId);

        // Register with window management
        windows.set(containerId, {
            title: 'Web Browser',
            minimized: false,
            isWidget: false
        });

        console.log(`Registered window ${containerId}:`, Array.from(windows.entries()));

        resolve(containerId);
    });
}


function setupWebContainerResizing(containerEl) {
    const handles = containerEl.querySelectorAll('.resize-handle');
    let startX, startY, startWidth, startHeight, startLeft, startTop;

    handles.forEach(handle => {
        handle.addEventListener('mousedown', initResize);
    });

    function initResize(e) {
        e.preventDefault();
        e.stopPropagation();

        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(getComputedStyle(containerEl).width, 10);
        startHeight = parseInt(getComputedStyle(containerEl).height, 10);
        startLeft = parseInt(getComputedStyle(containerEl).left, 10);
        startTop = parseInt(getComputedStyle(containerEl).top, 10);

        const handle = e.target;
        const resizeType = Array.from(handle.classList)
            .find(c => c !== 'resize-handle');

        document.addEventListener('mousemove', e => resize(e, resizeType));
        document.addEventListener('mouseup', stopResize);

        // Bring window to front when resizing
        WindowManager.bringToFront(containerEl);
    }

    function resize(e, resizeType) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const minWidth = 800;
        const minHeight = 600;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;

        switch (resizeType) {
            case 'right':
                newWidth = Math.max(minWidth, startWidth + dx);
                break;
            case 'left':
                newWidth = Math.max(minWidth, startWidth - dx);
                if (newWidth !== startWidth) {
                    newLeft = startLeft + (startWidth - newWidth);
                }
                break;
            case 'bottom':
                newHeight = Math.max(minHeight, startHeight + dy);
                break;
            case 'top':
                newHeight = Math.max(minHeight, startHeight - dy);
                if (newHeight !== startHeight) {
                    newTop = startTop + (startHeight - newHeight);
                }
                break;
            case 'bottom-right':
                newWidth = Math.max(minWidth, startWidth + dx);
                newHeight = Math.max(minHeight, startHeight + dy);
                break;
            case 'bottom-left':
                newWidth = Math.max(minWidth, startWidth - dx);
                newHeight = Math.max(minHeight, startHeight + dy);
                if (newWidth !== startWidth) {
                    newLeft = startLeft + (startWidth - newWidth);
                }
                break;
            case 'top-right':
                newWidth = Math.max(minWidth, startWidth + dx);
                newHeight = Math.max(minHeight, startHeight - dy);
                if (newHeight !== startHeight) {
                    newTop = startTop + (startHeight - newHeight);
                }
                break;
            case 'top-left':
                newWidth = Math.max(minWidth, startWidth - dx);
                newHeight = Math.max(minHeight, startHeight - dy);
                if (newWidth !== startWidth) {
                    newLeft = startLeft + (startWidth - newWidth);
                }
                if (newHeight !== startHeight) {
                    newTop = startTop + (startHeight - newHeight);
                }
                break;
        }

        containerEl.style.width = `${newWidth}px`;
        containerEl.style.height = `${newHeight}px`;
        containerEl.style.left = `${newLeft}px`;
        containerEl.style.top = `${newTop}px`;
    }

    function stopResize() {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
    }
}

// Add this function to handle resizing
function setupResizing(containerEl) {
    const resizeHandle = containerEl.querySelector('.resize-handle');
    if (!resizeHandle) return;

    let startX, startY, startWidth, startHeight;

    function startResize(e) {
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(getComputedStyle(containerEl).width, 10);
        startHeight = parseInt(getComputedStyle(containerEl).height, 10);

        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    }

    function resize(e) {
        const newWidth = Math.max(800, startWidth + e.clientX - startX);
        const newHeight = Math.max(600, startHeight + e.clientY - startY);

        containerEl.style.width = `${newWidth}px`;
        containerEl.style.height = `${newHeight}px`;

        // Bring window to front while resizing
        WindowManager.bringToFront(containerEl);
    }

    function stopResize() {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
    }

    resizeHandle.addEventListener('mousedown', startResize);
}

async function newTab(containerId, url = 'https://start.duckduckgo.com') {
    const tabId = `tab-${tabCounter++}`;
    const tabBar = document.getElementById(`${containerId}-tabs`);
    const tabContent = document.getElementById(`${containerId}-content`);

    // Add tab button
    const tabButton = document.createElement('div');
    tabButton.className = 'tab';
    tabButton.setAttribute('data-tab-id', tabId);
    tabButton.innerHTML = `
        <img class="tab-favicon" alt="">
        <span class="tab-title">New Tab</span>
        <button class="tab-close" onclick="closeTab('${containerId}', '${tabId}')">×</button>
    `;

    // Add click handler for tab switching
    tabButton.addEventListener('click', (e) => {
        // Don't switch tabs if clicking the close button
        if (!e.target.classList.contains('tab-close')) {
            activateTab(containerId, tabId);
        }
    });
    tabBar.insertBefore(tabButton, tabBar.lastElementChild);

    // Create tab pane
    const tabPane = document.createElement('div');
    tabPane.className = 'tab-pane';
    tabPane.id = tabId;

    // Create and configure webview
    const webview = document.createElement('webview');
    webview.setAttribute('src', url);
    webview.setAttribute('allowpopups', '');
    webview.setAttribute('webpreferences', 'contextIsolation=yes,javascript=yes,webSecurity=no');
    webview.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    webview.setAttribute('partition', 'persist:general');

    // Add webview to pane
    tabPane.appendChild(webview);
    tabContent.appendChild(tabPane);

    // Store tab info
    const tabs = tabGroups.get(containerId);
    const tab = { id: tabId, button: tabButton, pane: tabPane };
    tabs.push(tab);

    // Setup events after DOM insertion
    await new Promise(resolve => {
        webview.addEventListener('dom-ready', () => {
            console.log('Webview ready:', tabId);
            setupWebviewEvents(webview, containerId, tabId);
            resolve();
        }, { once: true });
    });

    // Activate new tab
    activateTab(containerId, tabId);
    return tabId;
}

function setupWebviewEvents(webview, containerId, tabId) {
    const tabButton = document.querySelector(`#${containerId}-tabs .tab[data-tab-id="${tabId}"]`);
    const urlInput = document.getElementById(`${containerId}-url`);

    // Add favicon container to tab
    const titleSpan = tabButton?.querySelector('.tab-title');
    if (titleSpan) {
        // Insert favicon element before the title
        const faviconEl = document.createElement('img');
        faviconEl.className = 'tab-favicon';
        titleSpan.parentNode.insertBefore(faviconEl, titleSpan);
    }

    function updateTabTitle(title) {
        const titleSpan = tabButton?.querySelector('.tab-title');
        if (titleSpan) {
            const truncatedTitle = title.length > 16 ? title.slice(0, 16) + '...' : title;
            titleSpan.textContent = truncatedTitle;
            titleSpan.title = title; // This creates the tooltip
            tabButton.title = title; // Also add tooltip to entire tab
        }
    }

    webview.addEventListener('dom-ready', () => {
        console.log('Webview ready:', tabId);
        const title = webview.getTitle();
        if (title) {
            updateTabTitle(title);
        }
    });

    let currentFavicon = '';
    const faviconEl = tabButton?.querySelector('.tab-favicon');

    webview.addEventListener('did-start-loading', () => {
        console.log('Started loading:', webview.getURL());
        tabButton?.classList.add('loading');
        if (faviconEl) {
            faviconEl.style.display = 'inline-block';
            faviconEl.src = ''; // Clear favicon while loading
        }
    });

    webview.addEventListener('did-stop-loading', () => {
        console.log('Finished loading:', webview.getURL());
        tabButton?.classList.remove('loading');
        // Favicon will be restored by page-favicon-updated event
    });

    webview.addEventListener('did-navigate', (e) => {
        console.log('Navigated to:', e.url);
        if (urlInput) {
            urlInput.value = e.url;
        }
    });

    webview.addEventListener('page-title-updated', (e) => {
        console.log('Title updated:', e.title);
        updateTabTitle(e.title);
    });



    webview.addEventListener('page-favicon-updated', (e) => {
        if (e.favicons && e.favicons.length > 0) {
            const newFavicon = e.favicons[0];
            if (newFavicon !== currentFavicon) {
                console.log('Favicon updated:', newFavicon);
                if (faviconEl) {
                    faviconEl.src = newFavicon;
                    faviconEl.style.display = 'inline';
                    currentFavicon = newFavicon;
                }
            }
        }
    });

    webview.addEventListener('page-title-updated', (e) => {
        console.log('Title updated:', e.title);
        const titleSpan = tabButton?.querySelector('.tab-title');
        if (titleSpan) {
            console.log('Setting updated title:', e.title);
            titleSpan.textContent = e.title;
        } else {
            console.log('Title span not found');
        }
    });

    webview.addEventListener('did-fail-load', (e) => {
        console.error('Failed to load:', e);
        const titleSpan = tabButton?.querySelector('.tab-title');
        if (titleSpan) {
            titleSpan.textContent = 'Error loading page';
        }
    });

    webview.addEventListener('new-window', (e) => {
        console.log('New window requested:', e.url);
        newTab(containerId, e.url);
    });

    // Add favicon handling
    webview.addEventListener('page-favicon-updated', (e) => {
        if (e.favicons && e.favicons.length > 0) {
            console.log('Favicon updated:', e.favicons[0]);
            // You could add a favicon element to the tab if desired
        }
    });
}

function updateNavigationState(containerId, webview) {
    const backBtn = document.querySelector(`#${containerId} .nav-btn[onclick="goBack('${containerId}')"]`);
    const forwardBtn = document.querySelector(`#${containerId} .nav-btn[onclick="goForward('${containerId}')"]`);

    if (backBtn) {
        backBtn.disabled = !webview.canGoBack();
    }
    if (forwardBtn) {
        forwardBtn.disabled = !webview.canGoForward();
    }
}

// Add these navigation functions
function goBack(containerId) {
    const activeTab = getActiveTab(containerId);
    if (activeTab) {
        const webview = activeTab.pane.querySelector('webview');
        if (webview && webview.canGoBack()) {
            webview.goBack();
        }
    }
}

function goForward(containerId) {
    const activeTab = getActiveTab(containerId);
    if (activeTab) {
        const webview = activeTab.pane.querySelector('webview');
        if (webview && webview.canGoForward()) {
            webview.goForward();
        }
    }
}

function getActiveTab(containerId) {
    const tabs = tabGroups.get(containerId);
    return tabs.find(tab => tab.pane.classList.contains('active'));
}

function activateTab(containerId, tabId) {
    console.log('Activating tab:', tabId, 'in container:', containerId);
    const tabs = tabGroups.get(containerId);
    if (!tabs) {
        console.error('No tab group found for container:', containerId);
        return;
    }

    const activeTab = tabs.find(tab => tab.id === tabId);
    if (!activeTab) {
        console.error('Tab not found:', tabId);
        return;
    }

    // Deactivate all tabs first
    tabs.forEach(tab => {
        tab.button.classList.remove('active');
        tab.pane.classList.remove('active');
    });

    // Activate the selected tab
    activeTab.button.classList.add('active');
    activeTab.pane.classList.add('active');

    // Update URL input
    const webview = activeTab.pane.querySelector('webview');
    const urlInput = document.getElementById(`${containerId}-url`);

    if (webview && urlInput) {
        // If webview is ready, update URL immediately
        if (webview.getURL) {
            try {
                urlInput.value = webview.getURL();
                updateNavigationState(containerId, webview);
            } catch (e) {
                console.log('Webview not ready yet, waiting for dom-ready event');
            }
        }

        // Also listen for future URL changes
        webview.addEventListener('did-navigate', (e) => {
            urlInput.value = e.url;
            updateNavigationState(containerId, webview);
        });
    }
}

function closeTab(containerId, tabId) {
    const tabs = tabGroups.get(containerId);
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);

    if (tabIndex === -1) return;

    const tab = tabs[tabIndex];
    tab.button.remove();
    tab.pane.remove();
    tabs.splice(tabIndex, 1);

    // If we closed the active tab, activate another one
    if (tab.pane.classList.contains('active')) {
        const newActiveTab = tabs[tabIndex] || tabs[tabIndex - 1];
        if (newActiveTab) {
            activateTab(containerId, newActiveTab.id);
        }
    }

    // If no tabs left, close the container
    if (tabs.length === 0) {
        closeContainer(containerId);
    }
}

function closeContainer(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.remove();
        tabGroups.delete(containerId);
    }
}

// URL transformation function
function transformUrl(url) {
    try {
        const urlObj = new URL(url);

        // YouTube handling
        if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
            // If it's the main YouTube site, use standard URL
            if (url === 'https://www.youtube.com/' || url === 'https://youtube.com/') {
                return {
                    url: 'https://www.youtube.com',
                    type: 'youtube-browser'
                };
            }

            // Handle video URLs
            let videoId = '';
            if (urlObj.hostname.includes('youtube.com')) {
                videoId = urlObj.searchParams.get('v');
            } else {
                videoId = urlObj.pathname.substring(1);
            }
            if (videoId) {
                return {
                    url: `https://www.youtube.com/embed/${videoId}`,
                    type: 'regular'
                };
            }
        }

        // Default return
        return {
            url: url,
            type: 'regular'
        };
    } catch (e) {
        return {
            url: url,
            type: 'regular'
        };
    }
}

function debugWindowState(windowId) {
    console.log('Window ID:', windowId);
    console.log('Window element:', document.getElementById(windowId));
    console.log('Window state:', windows.get(windowId));
    console.log('Windows Map:', Array.from(windows.entries()));
}

function showControlPanel() {
    let panel = document.getElementById('controlPanel');
    if (panel) {
        panel.style.display = 'block';
        return;
    }

    const windowId = 'controlPanel';
    const windowHtml = `
        <div class="window" id="${windowId}">
            <div class="window-header">
                <div class="window-title">
                    <span class="material-symbols-outlined">settings</span>
                    Control Panel
                </div>
                <div class="window-controls">
                    <button onclick="toggleControlPanelDevTools()" title="Developer Tools">
                        <span class="material-symbols-outlined">jump_to_element</span>
                    </button>
<button onclick="minimizeWindow('controlPanel')" title="Minimize">
    <span class="material-symbols-outlined">remove</span>
</button>
                    <button onclick="closeControlPanel()" title="Close">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
            </div>
            <div class="control-panel-container">
                <div class="control-panel-sidebar">
                    <div class="sidebar-tabs">
                        <div class="tab active" data-panel="appearance">
                            <span class="material-symbols-outlined">palette</span>
                            <span class="tab-text">Appearance</span>
                        </div>
                        <div class="tab" data-panel="widgets">
                            <span class="material-symbols-outlined">widgets</span>
                            <span class="tab-text">Widgets</span>
                        </div>
                        <div class="tab" data-panel="system">
                            <span class="material-symbols-outlined">memory</span>
                            <span class="tab-text">System</span>
                        </div>
                        <div class="tab" data-panel="settings">
                            <span class="material-symbols-outlined">settings</span>
                            <span class="tab-text">Settings</span>
                        </div>
                    </div>
                    <div class="resize-handle"></div>
                </div>
                <div class="control-panel-content">
                    <div id="appearance" class="panel-section active"></div>
                    <div id="widgets" class="panel-section"></div>
                    <div id="system" class="panel-section"></div>
                    <div id="settings" class="panel-section"></div>
                </div>
            </div>
        </div>
    `;

    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', windowHtml);
    panel = document.getElementById(windowId);
    const containerEl = document.getElementById(windowId);

    // Register with window management
    windows.set(windowId, {
        title: 'Control Panel',
        minimized: false,
        isWidget: false
    });

    console.log('Control Panel registered:', windows.get(windowId));
    console.log(`Registered window ${windowId}:`, Array.from(windows.entries()));

    // Set initial position and size
    panel.style.width = '900px';
    panel.style.height = '600px';
    panel.style.transform = 'none';
    panel.style.top = '50px';
    panel.style.left = '50px';
    panel.style.position = 'fixed';

    Object.assign(containerEl.style, {
        position: 'fixed',
        width: '900px',
        height: '600px',
        top: '50px',
        left: '50px',
        zIndex: '1000'
    });

    // Initialize dragging
    const header = panel.querySelector('.window-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;




    // Keep resize functionality
    const resizeHandle = containerEl.querySelector('.resize-handle');
    if (resizeHandle) {
        let isResizing = false;
        let startX;
        let startY;
        let startWidth;
        let startHeight;

        resizeHandle.addEventListener('mousedown', e => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(getComputedStyle(containerEl).width, 10);
            startHeight = parseInt(getComputedStyle(containerEl).height, 10);

            containerEl.style.transition = 'none';
            WindowManager.bringToFront(containerEl);

            // Prevent event from bubbling to makeDraggable
            e.stopPropagation();
        });

        document.addEventListener('mousemove', e => {
            if (!isResizing) return;
            const newWidth = Math.max(800, startWidth + (e.clientX - startX));
            const newHeight = Math.max(600, startHeight + (e.clientY - startY));
            containerEl.style.width = `${newWidth}px`;
            containerEl.style.height = `${newHeight}px`;
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
            containerEl.style.transition = '';
        });
    }

    // Use makeDraggable for drag and snap functionality
    makeDraggable(containerEl);


    requestAnimationFrame(() => {
        initControlPanelTabs();
        // Initial load of appearance panel
        loadPanelContent('appearance');
        panel.style.display = 'block';
    });

    // Initialize tabs
    initControlPanelTabs();

    panel.style.display = 'block';
}

async function initControlPanelTabs() {
    document.querySelectorAll('.sidebar-tabs .tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            // Remove active class from all tabs
            document.querySelectorAll('.sidebar-tabs .tab').forEach(t => {
                t.classList.remove('active');
            });

            // Add active class to clicked tab
            tab.classList.add('active');

            // Hide all panels
            document.querySelectorAll('.panel-section').forEach(panel => {
                panel.classList.remove('active');
            });

            // Show selected panel
            const targetPanel = document.getElementById(tab.dataset.panel);
            if (targetPanel) {
                targetPanel.classList.add('active');
                if (!targetPanel.dataset.loaded) {
                    await loadPanelContent(tab.dataset.panel);
                    targetPanel.dataset.loaded = 'true';
                }
            }
        });
    });

    // Load initial panel content
    await loadPanelContent('appearance');
}


// if (!panel || panel.dataset.loaded === 'true') return;

async function loadPanelContent(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    switch (panelId) {
        case 'appearance':
            await loadAppearancePanel(panel);
            break;
        case 'widgets':
            loadWidgetsPanel(panel);
            break;
        case 'system':
            loadSystemPanel(panel);
            break;
        case 'settings':
            loadSettingsPanel(panel);
            break;
    }

    panel.dataset.loaded = 'true';
}

// Window management functions
function closeControlPanel() {
    const panel = document.getElementById('controlPanel');
    if (panel) {
        panel.remove();
        windows.delete('controlPanel');
    }
}

function minimizeControlPanel() {
    const panel = document.getElementById('controlPanel');
    if (panel) {
        panel.style.display = 'none';
        windows.get('controlPanel').minimized = true;
        // updateDock();
        // DockManager.updateDock()
        DockManager.renderDock();
    }
}

function toggleControlPanelDevTools() {
    window.electronAPI.send('toggle-dev-tools');
}

function switchControlTab(tabId) {
    // Remove active class from all tabs and panels
    document.querySelectorAll('.tab-bar .tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

    // Add active class to selected tab and panel
    document.querySelector(`.tab-bar .tab[onclick*="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
}



async function loadAppearancePanel(panel) {
    console.log('Starting loadAppearancePanel');
    return new Promise((resolve) => {
        // Set initial HTML content


        panel.innerHTML = `
    <!-- Preview Section -->
    <div class="settings-section preview-section">
        <!-- Window Previews -->
        <div class="window-previews">
            <div class="preview-window">
                <div class="window-header">
                    <div class="window-title-group">
                        <input type="color" class="text-color-picker" 
                               value="#FFFFFF"
                               title="Click to change text color">
                        <span class="window-title">Normal Window</span>
                    </div>
                    <div class="window-controls">
                        <input type="color" class="titlebar-color-picker" 
                               value="#1E1E1E"
                               title="Click to change window color">
                        <button><span class="material-symbols-outlined">remove</span></button>
                        <button><span class="material-symbols-outlined">close</span></button>
                    </div>
                </div>
                <div class="window-preview-content">
                    <div class="accent-color-preview">
                        <span>Accent Color</span>
                        <input type="color" id="accentColor" value="#007BFF">
                    </div>
                </div>
            </div>

            <div class="preview-window widget">
                <div class="window-header">
                    <div class="window-title-group">
                        <input type="color" class="text-color-picker" 
                               value="#FFFFFF"
                               title="Click to change text color">
                        <span class="window-title">Widget Window</span>
                    </div>
                    <div class="window-controls">
                        <input type="color" class="titlebar-color-picker" 
                               value="#1E1E1E"
                               title="Click to change widget color">
                        <button><span class="material-symbols-outlined">remove</span></button>
                        <button><span class="material-symbols-outlined">close</span></button>
                    </div>
                </div>
                <div class="window-preview-content">Widget Content</div>
            </div>
        </div>

        <!-- Transparency Controls -->
        <div class="transparency-controls">
            <div class="transparency-option">
                <label>Window Transparency</label>
                <input type="range" id="windowTransparency" min="50" max="100" value="95">
                <span class="value-display">95%</span>
            </div>
            <div class="transparency-option">
                <label>Widget Transparency</label>
                <input type="range" id="widgetTransparency" min="50" max="100" value="90">
                <span class="value-display">90%</span>
            </div>
        </div>

        <!-- Theme Buttons -->
        <div class="theme-buttons">
            <button class="save-theme" onclick="window.themePreviewManager.saveAsTheme()">
                <span class="material-symbols-outlined">save</span>
                Save Theme
            </button>
        </div>
    </div>

<!-- Themes Section -->
    <div class="settings-section themes-section">
        <h2>Color Themes</h2>
        <div class="theme-grid" id="themeGrid"></div>
        <div class="theme-management">
            <button onclick="importTheme()" class="secondary-button">
                <span class="material-symbols-outlined">upload</span>
                Import Theme
            </button>
        </div>
    </div>

    <!-- Cursors Section -->
<!-- Update your cursor section -->
<div class="settings-section themes-section">
    <h2>Cursor Themes</h2>
    <div class="cursor-grid" id="cursorGrid"></div>
    <div class="theme-management">
        <button onclick="importCursor()" class="secondary-button">
            <span class="material-symbols-outlined">upload</span>
            Import Cursor
        </button>
    </div>
</div>

    <!-- Wallpaper Section -->
    <div class="settings-section wallpaper-section">
        <h2>Wallpaper</h2>
        <div class="wallpaper-controls">
            <div class="wallpaper-grid" id="wallpaperGrid"></div>
            <div class="wallpaper-actions">
                <button onclick="addLocalWallpaper()" class="action-button">
                    <span class="material-symbols-outlined">folder_open</span>
                    Add Local Image
                </button>
                <button onclick="addOnlineWallpaper()" class="action-button">
                    <span class="material-symbols-outlined">link</span>
                    Add Online Image
                </button>
            </div>
        </div>
    </div>
`;



        return new Promise((resolve) => {
            requestAnimationFrame(async () => {
                try {
                    if (!window.themePreviewManager) {
                        window.themePreviewManager = new ThemePreviewManager();
                    }

                    await window.themePreviewManager.initialize();
                    await window.refreshThemeGridDisplay();
                    await window.loadCurrentThemeValues();
                    await window.loadCursorGrid();

                    // loadWallpapers();

                    console.log('Panel initialization complete');
                    resolve();
                } catch (error) {
                    console.error('Error initializing appearance panel:', error);
                    resolve();
                }
            });
            loadWallpapers();
        });
    });


}

// async function loadWallpapers() {
//     try {
//         const wallpaperGrid = document.getElementById('wallpaperGrid');
//         if (!wallpaperGrid) return;

//         wallpaperGrid.innerHTML = '';

//         const wallpapers = await window.electronAPI.store.get('wallpapers') || [];
//         console.log('Loaded wallpapers from store:', wallpapers);

//         if (wallpapers.length === 0) {
//             wallpaperGrid.innerHTML = `
//                 <div class="empty-state">
//                     <span class="material-symbols-outlined">wallpaper</span>
//                     <p>No wallpapers added yet</p>
//                 </div>
//             `;
//             return;
//         }

//         wallpapers.forEach(wallpaper => {
//             const wallpaperItem = document.createElement('div');
//             wallpaperItem.className = 'wallpaper-item';

//             // For local files, convert path for display
//             if (wallpaper.type === 'local') {
//                 const filepath = wallpaper.url.replace('file:///', '');
//                 console.log('Loading local wallpaper from:', filepath);
//             }

//             wallpaperItem.innerHTML = `
//                 <img src="${wallpaper.url}" alt="${wallpaper.name}" 
//                      onerror="this.src='assets/broken-image.png'">
//                 <div class="wallpaper-overlay">
//                     <span class="wallpaper-name">${wallpaper.name}</span>
//                     <span class="material-symbols-outlined">
//                         ${wallpaper.type === 'local' ? 'hard_drive' : 'public'}
//                     </span>
//                 </div>
//                 <button onclick="deleteWallpaper('${wallpaper.id}')" class="delete-button">
//                     <span class="material-symbols-outlined">delete</span>
//                 </button>
//             `;

//             wallpaperItem.onclick = (e) => {
//                 // Don't apply wallpaper if clicking delete button
//                 if (!e.target.closest('.delete-button')) {
//                     applyWallpaper(wallpaper.url);
//                 }
//             };

//             wallpaperGrid.appendChild(wallpaperItem);
//         });
//     } catch (error) {
//         console.error('Error loading wallpapers:', error);
//     }
// }

// async function loadWallpapers() {
//     try {
//         const wallpaperGrid = document.getElementById('wallpaperGrid');
//         if (!wallpaperGrid) return;

//         wallpaperGrid.innerHTML = '';

//         // Add auto-apply section
//         const controlsSection = document.createElement('div');
//         controlsSection.className = 'wallpaper-controls-section';
//         controlsSection.innerHTML = `
//             <div class="wallpaper-settings">
//                 <label class="auto-apply-toggle">
//                     <input type="checkbox" id="autoApplyColors" 
//                            ${await window.electronAPI.store.get('autoApplyWallpaperColors') ? 'checked' : ''}>
//                     <span class="toggle-label">Auto-apply wallpaper colors</span>
//                 </label>
//                 <div class="extracted-colors" id="extractedColors"></div>
//             </div>
//         `;
        
//         wallpaperGrid.parentElement.insertBefore(controlsSection, wallpaperGrid);

//         // Set up auto-apply toggle handler
//         const autoApplyToggle = document.getElementById('autoApplyColors');
//         autoApplyToggle.addEventListener('change', async (e) => {
//             await window.electronAPI.store.set('autoApplyWallpaperColors', e.target.checked);
//             if (e.target.checked) {
//                 // Apply colors from current wallpaper if one is set
//                 const currentWallpaper = await window.electronAPI.store.get('lastWallpaper');
//                 if (currentWallpaper) {
//                     await window.themePreviewManager.handleWallpaperUpdate(currentWallpaper);
//                 }
//             }
//         });

async function loadWallpapers() {
    try {
        const wallpaperGrid = document.getElementById('wallpaperGrid');
        if (!wallpaperGrid) {
            console.log('Wallpaper grid not found, will try later');
            return;
        }

        // Clear existing content
        wallpaperGrid.innerHTML = '';

        // Create controls section first
        const controlsSection = document.createElement('div');
        controlsSection.className = 'wallpaper-controls-section';
        controlsSection.innerHTML = `
            <div class="wallpaper-settings">
                <label class="auto-apply-toggle">
                    <input type="checkbox" id="autoApplyColors" 
                           ${await window.electronAPI.store.get('autoApplyWallpaperColors') ? 'checked' : ''}>
                    <span class="toggle-label">Auto-apply wallpaper colors</span>
                </label>
                <div class="extracted-colors" id="extractedColors"></div>
            </div>
        `;

        // Add controls to DOM before setting up listeners
        wallpaperGrid.parentElement.insertBefore(controlsSection, wallpaperGrid);

        // Now set up the toggle handler after elements are in DOM
        const autoApplyToggle = document.getElementById('autoApplyColors');
        if (autoApplyToggle) {
            autoApplyToggle.addEventListener('change', async (e) => {
                await window.electronAPI.store.set('autoApplyWallpaperColors', e.target.checked);
                if (e.target.checked) {
                    const currentWallpaper = await window.electronAPI.store.get('lastWallpaper');
                    if (currentWallpaper) {
                        await window.themePreviewManager.handleWallpaperUpdate(currentWallpaper);
                    }
                }
            });
        }

        // Load wallpapers
        const wallpapers = await window.electronAPI.store.get('wallpapers') || [];
        
        if (wallpapers.length === 0) {
            wallpaperGrid.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">wallpaper</span>
                    <p>No wallpapers added yet</p>
                </div>
            `;
            return;
        }

        for (const wallpaper of wallpapers) {
            const wallpaperItem = document.createElement('div');
            wallpaperItem.className = 'wallpaper-item';
            wallpaperItem.innerHTML = `
                <img src="${wallpaper.url}" alt="${wallpaper.name}" 
                     onerror="this.src='assets/broken-image.png'">
                <div class="wallpaper-overlay">
                    <span class="wallpaper-name">${wallpaper.name}</span>
                    <span class="material-symbols-outlined">
                        ${wallpaper.type === 'local' ? 'hard_drive' : 'public'}
                    </span>
                </div>
                <button onclick="event.stopPropagation(); deleteWallpaper('${wallpaper.id}')" 
                        class="delete-button">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            `;

            wallpaperItem.onclick = async (e) => {
                if (!e.target.closest('.delete-button')) {
                    await applyWallpaper(wallpaper.url);
                    await window.themePreviewManager.handleWallpaperUpdate(wallpaper.url, wallpaper.name);
                }
            };

            wallpaperGrid.appendChild(wallpaperItem);
        }

        // If there's a current wallpaper, show its colors
        const currentWallpaper = await window.electronAPI.store.get('lastWallpaper');
        if (currentWallpaper) {
            await window.themePreviewManager.handleWallpaperUpdate(currentWallpaper);
        }

    } catch (error) {
        console.error('Error loading wallpapers:', error);
    }
}

// async function loadWallpapers() {
//     try {
//         const wallpaperGrid = document.getElementById('wallpaperGrid');
//         if (!wallpaperGrid) return;

//         wallpaperGrid.innerHTML = '';

//         // Add auto-apply section
//         const controlsSection = document.createElement('div');
//         controlsSection.className = 'wallpaper-controls-section';
//         controlsSection.innerHTML = `
//             <div class="wallpaper-settings">
//                 <label class="auto-apply-toggle">
//                     <input type="checkbox" id="autoApplyColors" 
//                            ${await window.electronAPI.store.get('autoApplyWallpaperColors') ? 'checked' : ''}>
//                     <span class="toggle-label">Auto-apply wallpaper colors</span>
//                 </label>
//                 <div class="extracted-colors" id="extractedColors"></div>
//             </div>
//         `;
        
//         wallpaperGrid.parentElement.insertBefore(controlsSection, wallpaperGrid);

//         // Set up auto-apply toggle handler
//         const autoApplyToggle = document.getElementById('autoApplyColors');
//         autoApplyToggle.addEventListener('change', async (e) => {
//             await window.electronAPI.store.set('autoApplyWallpaperColors', e.target.checked);
//             if (e.target.checked) {
//                 // Apply colors from current wallpaper if one is set
//                 const currentWallpaper = await window.electronAPI.store.get('lastWallpaper');
//                 if (currentWallpaper) {
//                     await applyWallpaperColors(currentWallpaper);
//                 }
//             }
//         });

//         // Load wallpapers
//         const wallpapers = await window.electronAPI.store.get('wallpapers') || [];
        
//         if (wallpapers.length === 0) {
//             wallpaperGrid.innerHTML = `
//                 <div class="empty-state">
//                     <span class="material-symbols-outlined">wallpaper</span>
//                     <p>No wallpapers added yet</p>
//                 </div>
//             `;
//             return;
//         }

//         for (const wallpaper of wallpapers) {
//             const wallpaperItem = document.createElement('div');
//             wallpaperItem.className = 'wallpaper-item';
//             wallpaperItem.innerHTML = `
//                 <img src="${wallpaper.url}" alt="${wallpaper.name}" 
//                      onerror="this.src='assets/broken-image.png'">
//                 <div class="wallpaper-overlay">
//                     <span class="wallpaper-name">${wallpaper.name}</span>
//                     <div class="wallpaper-actions">
//                         <button class="preview-colors-btn" title="Preview Colors"
//                                 onclick="event.stopPropagation(); previewWallpaperColors('${wallpaper.url}')">
//                             <span class="material-symbols-outlined">palette</span>
//                         </button>
//                         <span class="material-symbols-outlined">
//                             ${wallpaper.type === 'local' ? 'hard_drive' : 'public'}
//                         </span>
//                     </div>
//                 </div>
//                 <button onclick="event.stopPropagation(); deleteWallpaper('${wallpaper.id}')" 
//                         class="delete-button">
//                     <span class="material-symbols-outlined">delete</span>
//                 </button>
//             `;


//             // wallpaperItem.onclick = async () => {
//             //     await applyWallpaper(wallpaper.url, wallpaper.name);
//             // };

//                     // When adding wallpaper click handler:
//         wallpaperItem.onclick = async (e) => {
//             if (!e.target.closest('.delete-button')) {
//                 await applyWallpaper(wallpaper.url);
                
//                 // Theme preview will handle color display now
//                 const autoApplyToggle = document.getElementById('autoApplyColors');
//                 if (autoApplyToggle?.checked) {
//                     await window.themePreviewManager.handleWallpaperUpdate(wallpaper.url, wallpaper.name);
//                 }
//             }
//         };

//             wallpaperGrid.appendChild(wallpaperItem);
//         }

//         // If there's a current wallpaper, show its colors
//         const currentWallpaper = await window.electronAPI.store.get('lastWallpaper');
//         if (currentWallpaper) {
//             await displayExtractedColors(currentWallpaper);
//         }

//     } catch (error) {
//         console.error('Error loading wallpapers:', error);
//     }
// }


async function saveAndApplyTheme(theme, name) {
    try {
        const themeId = `theme-${Date.now()}`;
        const fullTheme = {
            ...theme,
            name,
            id: themeId
        };

        // Get existing themes
        const themes = await window.electronAPI.store.get('themes') || {};
        
        // Add new theme
        themes[themeId] = fullTheme;
        
        // Save themes
        await window.electronAPI.store.set('themes', themes);
        
        // Set as current theme
        await window.electronAPI.store.set('currentTheme', themeId);
        
        // Apply theme to UI
        window.applyThemeToUI(fullTheme);
        
        // Refresh theme grid
        await window.refreshThemeGridDisplay();
        
        console.log(`Theme "${name}" saved and applied`);
    } catch (error) {
        console.error('Error saving and applying theme:', error);
    }
}

// async function displayExtractedColors(wallpaperUrl) {
//     const extractedColorsDiv = document.getElementById('extractedColors');
//     if (!extractedColorsDiv) return;

//     const colors = await window.colorExtractor.extractColors(wallpaperUrl);
//     if (!colors || colors.length === 0) return;

//     const colorLabels = ['Window', 'Widget', 'Accent', 'Light', 'Dark'];
    
//     extractedColorsDiv.innerHTML = `
//         <div class="color-palette">
//             ${colors.map((color, index) => `
//                 <div class="color-swatch-container">
//                     <div class="color-swatch" 
//                          style="background-color: ${color};"
//                          title="${colorLabels[index]}: ${color}"
//                          onclick="applyColorToTheme('${color}', '${colorLabels[index].toLowerCase()}')">
//                     </div>
//                     <div class="color-label">${colorLabels[index]}</div>
//                 </div>
//             `).join('')}
//         </div>
//     `;
// }

function updateColorPickers(colors) {
    // Update each color picker with new values
    const colorMappings = {
        'normalWindow': ['#normalWindowColor', '--window-bg'],
        'widgetWindow': ['#widgetWindowColor', '--widget-bg'],
        'accent': ['#accentColor', '--accent-color'],
        'text': ['#textColor', '--text-color'],
        'textMuted': ['#textMutedColor', '--text-muted']
    };

    for (const [colorKey, [pickerId, cssVar]] of Object.entries(colorMappings)) {
        const picker = document.querySelector(pickerId);
        if (picker && colors[colorKey]) {
            picker.value = colors[colorKey];
            // Update CSS variable if it exists
            if (cssVar) {
                document.documentElement.style.setProperty(cssVar, colors[colorKey]);
            }
        }
    }
}

// Function to apply a clicked color to a specific theme element
// function applyColorToTheme(color, suggestedRole) {
//     const menuPosition = { x: event.clientX, y: event.clientY };
    
//     // Create the menu
//     const menu = document.createElement('div');
//     menu.className = 'color-apply-menu';
//     menu.innerHTML = `
//         <div class="menu-title">Apply color to:</div>
//         <button onclick="applyColorTo('normalWindow', '${color}')" 
//                 class="${suggestedRole === 'window' ? 'suggested' : ''}">
//             Window Background
//         </button>
//         <button onclick="applyColorTo('widgetWindow', '${color}')"
//                 class="${suggestedRole === 'widget' ? 'suggested' : ''}">
//             Widget Background
//         </button>
//         <button onclick="applyColorTo('accent', '${color}')"
//                 class="${suggestedRole === 'accent' ? 'suggested' : ''}">
//             Accent Color
//         </button>
//         <button onclick="applyColorTo('text', '${color}')"
//                 class="${suggestedRole === 'light' || suggestedRole === 'dark' ? 'suggested' : ''}">
//             Text Color
//         </button>
//     `;

//     // Position the menu
//     menu.style.left = `${menuPosition.x}px`;
//     menu.style.top = `${menuPosition.y}px`;
    
//     // Add to document
//     document.body.appendChild(menu);
    
//     // Ensure menu stays on screen
//     const rect = menu.getBoundingClientRect();
//     if (rect.right > window.innerWidth) {
//         menu.style.left = `${window.innerWidth - rect.width - 10}px`;
//     }
//     if (rect.bottom > window.innerHeight) {
//         menu.style.top = `${window.innerHeight - rect.height - 10}px`;
//     }
    
//     // Remove menu when clicking outside
//     const removeMenu = (e) => {
//         if (!menu.contains(e.target) && e.target !== event.target) {
//             menu.remove();
//             document.removeEventListener('click', removeMenu);
//         }
//     };
    
//     setTimeout(() => document.addEventListener('click', removeMenu), 0);
// }

// function applyColorTo(element, color) {
//     // Find the relevant color picker
//     const pickerMappings = {
//         normalWindow: '.preview-window:not(.widget) .titlebar-color-picker',
//         widgetWindow: '.preview-window.widget .titlebar-color-picker',
//         accent: '#accentColor',
//         text: '.preview-window:not(.widget) .text-color-picker'
//     };

//     const picker = document.querySelector(pickerMappings[element]);
//     if (picker) {
//         picker.value = color;
//         picker.dispatchEvent(new Event('input'));
        
//         // Update theme preview manager
//         if (window.themePreviewManager) {
//             window.themePreviewManager.currentPreview.colors[element] = color;
//             window.themePreviewManager.updatePreviewDisplay();
//         }
//     }

//     // Remove any open color menu
//     const menu = document.querySelector('.color-apply-menu');
//     if (menu) menu.remove();
// }

function promptWallpaperURL() {
    return new Promise(resolve => {
        const modal = document.getElementById('wallpaperUrlModal');
        const input = document.getElementById('wallpaperUrlInput');
        const preview = document.getElementById('wallpaperPreview');
        const previewBtn = document.getElementById('previewWallpaperBtn');
        const addBtn = document.getElementById('addWallpaperBtn');
        const cancelBtn = document.getElementById('cancelWallpaperBtn');

        modal.style.display = 'block';
        input.value = '';
        input.focus();
        preview.innerHTML = '';
        preview.classList.remove('active');
        addBtn.disabled = true;

        function validateUrl(url) {
            try {
                const parsed = new URL(url);
                return parsed.protocol === 'http:' || parsed.protocol === 'https:';
            } catch {
                return false;
            }
        }

        function showPreview() {
            const url = input.value.trim();
            if (!validateUrl(url)) {
                alert('Please enter a valid http:// or https:// URL');
                return;
            }

            preview.innerHTML = `
                <img src="${url}" 
                     alt="Wallpaper preview"
                     onload="this.parentElement.classList.add('active'); document.getElementById('addWallpaperBtn').disabled = false;"
                     onerror="this.parentElement.innerHTML = '<div class=\'error\'><span class=\'material-symbols-outlined\'>error</span><p>Failed to load image</p></div>'; this.parentElement.classList.add('active');">
            `;
        }

        previewBtn.onclick = showPreview;
        addBtn.onclick = () => {
            const url = input.value.trim();
            if (validateUrl(url)) {
                modal.style.display = 'none';
                resolve(url);
            }
        };

        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(null);
        };

        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                showPreview();
            }
        };
    });
}

async function addLocalWallpaper() {
    try {
        const result = await window.electronAPI.openFileDialog({
            filters: [
                {
                    name: 'Images',
                    extensions: ['jpg', 'jpeg', 'png', 'gif']
                }
            ]
        });

        if (result && result.path) {
            // Create proper file URL with normalized path
            // Replace backslashes with forward slashes for URLs
            const properPath = result.path.replace(/\\/g, '/');
            const wallpaper = {
                id: `wallpaper-${Date.now()}`,
                name: properPath.split('/').pop(), // Get filename
                url: `file:///${properPath}`,
                type: 'local'
            };

            console.log('Adding wallpaper:', wallpaper);

            const wallpapers = await window.electronAPI.store.get('wallpapers') || [];
            wallpapers.push(wallpaper);
            await window.electronAPI.store.set('wallpapers', wallpapers);
            loadWallpapers();
        }
    } catch (error) {
        console.error('Error adding local wallpaper:', error);
    }
}

async function addOnlineWallpaper() {
    try {
        const url = await promptWallpaperURL();
        if (!url) return;

        const wallpaper = {
            id: `wallpaper-${Date.now()}`,
            name: url.split('/').pop() || 'Online Wallpaper',
            url: url,
            type: 'online'
        };

        console.log('Adding online wallpaper:', wallpaper);

        const wallpapers = await window.electronAPI.store.get('wallpapers') || [];
        wallpapers.push(wallpaper);
        await window.electronAPI.store.set('wallpapers', wallpapers);
        loadWallpapers();

    } catch (error) {
        console.error('Error adding online wallpaper:', error);
        alert('Error adding wallpaper. Please check the URL and try again.');
    }
}

async function deleteWallpaper(id) {
    if (!confirm('Are you sure you want to delete this wallpaper?')) return;

    try {
        const wallpapers = await window.electronAPI.store.get('wallpapers') || [];
        const updatedWallpapers = wallpapers.filter(w => w.id !== id);
        await window.electronAPI.store.set('wallpapers', updatedWallpapers);
        loadWallpapers(); // Refresh the grid
    } catch (error) {
        console.error('Error deleting wallpaper:', error);
    }
}

// async function applyWallpaper(url) {
//     try {
//         const result = await window.electronAPI.setWallpaper(url);
//         if (result.success) {
//             // Save the wallpaper URL when successfully applied
//             await window.electronAPI.invoke('save-last-wallpaper', url);
//         } else {
//             console.error('Error setting wallpaper:', result.error);
//         }
//     } catch (error) {
//         console.error('Error applying wallpaper:', error);
//     }
// }

// async function applyWallpaper(url, name = '') {
//     try {
//         const result = await window.electronAPI.setWallpaper(url);
//         if (result.success) {
//             await window.electronAPI.invoke('save-last-wallpaper', url);
            
//             // Extract and display colors
//             const autoApplyToggle = document.getElementById('autoApplyColors');
//             if (autoApplyToggle?.checked) {
//                 await applyWallpaperColors(url, name);
//             } else {
//                 // Just display the colors without applying them
//                 await displayExtractedColors(url);
//             }
//         }
//     } catch (error) {
//         console.error('Error applying wallpaper:', error);
//     }
// }

async function applyWallpaper(url, name = '') {
    try {
        const result = await window.electronAPI.setWallpaper(url);
        if (result.success) {
            await window.electronAPI.invoke('save-last-wallpaper', url);
            
            // Use new ThemePreviewManager methods
            await window.themePreviewManager.handleWallpaperUpdate(url, name);
        }
    } catch (error) {
        console.error('Error applying wallpaper:', error);
    }
}



function getContrastColor(backgroundColor) {
    // Convert hex to RGB
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate perceptual luminance
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    // Calculate color difference using Delta E
    const deltaE = Math.sqrt(
        Math.pow(r - 255, 2) +
        Math.pow(g - 255, 2) +
        Math.pow(b - 255, 2)
    );

    // Determine the best contrast color based on luminance and color difference
    if (luminance > 0.7) {
        return '#000000'; // Dark text for very light backgrounds
    } else if (luminance < 0.3) {
        return '#FFFFFF'; // Light text for very dark backgrounds
    } else if (deltaE > 128) {
        return '#000000'; // Dark text for mid-range colors that are closer to black
    } else {
        return '#FFFFFF'; // Light text for mid-range colors that are closer to white
    }
}

async function applyTheme(themeId) {
    try {
        const themes = await window.electronAPI.store.get('themes');
        const theme = themes[themeId];

        if (theme) {
            await window.electronAPI.store.set('currentTheme', themeId);
            applyThemeToUI(theme);

            // Dispatch theme change event
            const event = new CustomEvent('themechange', { detail: theme });
            window.dispatchEvent(event);
        }
    } catch (error) {
        console.error('Error applying theme:', error);
    }
}

// Add this helper function to trigger theme updates
async function refreshTheme() {
    const theme = await window.getCurrentTheme();
    applyThemeToUI(theme);
}



async function loadThemeList() {
    const themes = await window.electronAPI.store.get('themes');
    const currentTheme = await window.electronAPI.store.get('currentTheme');
    const container = document.getElementById('themeList');

    container.innerHTML = Object.entries(themes).map(([id, theme]) => `
        <div class="theme-item ${currentTheme === id ? 'active' : ''}" 
             onclick="applyTheme('${id}')">
            <div class="theme-info">
                <div class="theme-name">${theme.name}</div>
            </div>
            <div class="theme-colors">
                <div class="theme-color" style="background: ${theme.colors.normalWindow}"></div>
                <div class="theme-color" style="background: ${theme.colors.widgetWindow}"></div>
                <div class="theme-color" style="background: ${theme.colors.accent}"></div>
            </div>
            ${currentTheme !== 'default' ? `
                <button onclick="event.stopPropagation(); deleteTheme('${id}')" 
                        class="icon-button danger">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            ` : ''}
        </div>
    `).join('');
}

async function saveCurrentAsTheme() {
    const name = await promptThemeName();
    if (!name) return;

    const id = 'theme-' + Date.now();
    const theme = {
        name,
        colors: {
            normalWindow: document.getElementById('normalWindowColor').value,
            widgetWindow: document.getElementById('widgetWindowColor').value,
            accent: document.getElementById('accentColor').value
        },
        transparency: {
            windows: parseInt(document.getElementById('windowTransparency').value) / 100,
            widgets: parseInt(document.getElementById('widgetTransparency').value) / 100
        }
    };

    const themes = await window.electronAPI.store.get('themes');
    themes[id] = theme;
    await window.electronAPI.store.set('themes', themes);
    loadThemeList();
}

function loadWidgetsPanel(panel) {
    panel.innerHTML = `
        <div class="settings-section">
            <h2>Installed Widgets</h2>
            <div id="installedWidgets" class="widget-grid"></div>
        </div>

        <div class="settings-section">
            <h2>Widget Management</h2>
            <div class="management-controls">
                <button onclick="scanAndImportWidgets()" class="action-button">
                    <span class="material-symbols-outlined">sync</span>
                    Scan for Widgets
                </button>
                <button id="importFolderBtn" class="action-button" title="Left-click: Scan last used folder&#13;Right-click: Select new folder">
                    <span class="material-symbols-outlined">folder_open</span>
                    Import Widget Folder
                </button>
                <button onclick="cleanupWidgets()" class="danger-button">
                    <span class="material-symbols-outlined">cleaning_services</span>
                    Clean Widget Storage
                </button>
            </div>
            <p class="hint-text">Tip: Right-click Import Widget Folder to select a different folder</p>
        </div>
    `;

    // Set up the import folder button with context handling
    const importBtn = document.getElementById('importFolderBtn');
    importBtn.addEventListener('mouseup', async (e) => {
        e.preventDefault();
        if (e.button === 2) { // Right click
            await moduleManager.importWidgetsFromFolder(true);
        } else { // Left click
            await moduleManager.importWidgetsFromFolder(false);
        }
        await refreshInstalledWidgets();
    });
    importBtn.addEventListener('contextmenu', (e) => e.preventDefault());

    refreshInstalledWidgets();
}

// Add the import folder function
// async function importWidgetFolder() {
//     try {
//         const folderPath = await window.electronAPI.selectFolder();
//         if (!folderPath) return;

//         const widgets = await window.electronAPI.scanWidgetFolder(folderPath);
//         console.log('Found widgets in folder:', widgets);

//         if (widgets.length > 0) {
//             for (const widget of widgets) {
//                 await moduleManager.addWidget(widget);
//             }
//             await refreshInstalledWidgets();
//         } else {
//             alert('No valid widgets found in the selected folder');
//         }
//     } catch (error) {
//         console.error('Error importing widget folder:', error);
//         alert('Error importing widgets from folder');
//     }
// }


async function refreshWidgetLists() {
    const installedWidgets = await window.electronAPI.store.get('widgets') || [];
    const container = document.getElementById('installedWidgets');

    if (container) {
        container.innerHTML = installedWidgets.map(widget => createWidgetCard(widget)).join('');
    }
}

async function refreshInstalledWidgets() {
    const installedWidgets = await window.electronAPI.store.get('widgets') || [];
    const container = document.getElementById('installedWidgets');

    if (!container) return;

    if (installedWidgets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">widgets</span>
                <p>No widgets installed. Click "Scan for Widgets" to find available widgets.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = installedWidgets.map(widget => createWidgetCard(widget)).join('');
}

function createWidgetCard(widget) {
    return `
        <div class="widget-card" data-widget-id="${widget.id}">
            <div class="widget-header">
                <span class="material-symbols-outlined widget-icon">${widget.icon || 'widgets'}</span>
                <div class="widget-info">
                    <h3 class="widget-title">${widget.name}</h3>
                    <p class="widget-description">${widget.description || ''}</p>
                </div>
            </div>
            
            <div class="widget-controls">
                <span class="widget-status">v${widget.version || '1.0.0'}</span>
                <div class="widget-actions">
                    <button onclick="launchWidgetFromPanel('${widget.id}')" class="action-button">
                        <span class="material-symbols-outlined">play_arrow</span>
                        Launch
                    </button>
                    <button onclick="toggleWidgetSettings('${widget.id}')" class="secondary-button">
                        <span class="material-symbols-outlined">settings</span>
                    </button>
                    <button onclick="deleteWidget('${widget.id}')" class="danger-button">
                        <span class="material-symbols-outlined">delete</span>
                        Delete
                    </button>
                </div>
            </div>
            
            <div id="settings-${widget.id}" class="widget-settings" style="display: none;">
                <div class="setting-row">
                    <label>Auto-start</label>
                    <input type="checkbox" 
    ${widget.settings?.autoload ? 'checked' : ''} 
    onchange="moduleManager.toggleAutostart('${widget.id}')"
>
                </div>
                <div class="setting-row">
                    <label>Position</label>
                    <button onclick="resetWidgetPosition('${widget.id}')" class="secondary-button">
                        Reset
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Add the delete function
async function deleteWidget(widgetId) {
    if (!confirm('Are you sure you want to delete this widget?')) {
        return;
    }

    try {
        // Get current widgets from store
        const widgets = await window.electronAPI.store.get('widgets') || [];

        // Filter out the widget to delete
        const updatedWidgets = widgets.filter(widget => widget.id !== widgetId);

        // Update the store
        await window.electronAPI.store.set('widgets', updatedWidgets);

        // Also remove from ModuleManager
        moduleManager.widgetsConfig.delete(widgetId);
        moduleManager.modules.delete(widgetId);

        // Refresh the widget list
        await refreshInstalledWidgets();

        // Close any open instances of the widget
        const windows = document.querySelectorAll('.window');
        windows.forEach(window => {
            if (window.dataset.widgetId === widgetId) {
                closeWindow(window.id);
            }
        });
    } catch (error) {
        console.error('Error deleting widget:', error);
    }
}



async function launchWidgetFromPanel(widgetId) {
    console.log('Launching widget:', widgetId);
    const widgets = await window.electronAPI.store.get('widgets');
    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
        console.log('Found widget:', widget);
        await createWindow(
            widget.name,
            widget.path,
            widget.settings?.position,
            true,  // isWidget flag
            widgetId
        );
    } else {
        console.error('Widget not found:', widgetId);
    }
}


async function scanAndImportWidgets() {
    try {
        // Get current base path
        const basePath = await window.electronAPI.store.get('widgetBasePath');
        if (!basePath) {
            console.log('No widget base path set, using default');
            // You might want to prompt user here to set path
        }

        console.log('Scanning for widgets in:', basePath);
        const widgets = await window.electronAPI.getWidgetsList();
        console.log('Found widgets:', widgets);

        if (widgets.length > 0) {
            for (const widget of widgets) {
                try {
                    await moduleManager.addWidget(widget);
                } catch (error) {
                    console.error(`Error adding widget ${widget.name}:`, error);
                }
            }
            await moduleManager.updateWidgetList();
            console.log('Widget scan complete');
        } else {
            console.log('No widgets found');
            alert('No widgets found in the widgets directory');
        }
    } catch (error) {
        console.error('Error scanning for widgets:', error);
        alert('Error scanning for widgets. Please check the console for details.');
    }
}

async function cleanupWidgets() {
    await moduleManager.cleanupWidgetStorage();
    await refreshInstalledWidgets();
}

async function launchWidget(widgetId) {
    const widgets = await window.electronAPI.store.get('widgets');
    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
        moduleManager.launchWidget(widget);
    }
}

function toggleWidgetSettings(widgetId) {
    const settings = document.getElementById(`settings-${widgetId}`);
    settings.style.display = settings.style.display === 'none' ? 'block' : 'none';
}

async function updateWidgetSetting(widgetId, setting, value) {
    const widgets = await window.electronAPI.store.get('widgets');
    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
        widget.settings[setting] = value;
        await window.electronAPI.store.set('widgets', widgets);
    }
}

async function resetWidgetPosition(widgetId) {
    const widgets = await window.electronAPI.store.get('widgets');
    const widget = widgets.find(w => w.id === widgetId);
    if (widget) {
        widget.settings.position = { x: 20, y: 20 };
        await window.electronAPI.store.set('widgets', widgets);
    }
}

function importWidgetFolder() {
    // Reuse your existing folder import functionality
    moduleManager.scanAndRegisterWidgets();
}

async function cleanupWidgets() {
    await moduleManager.cleanupWidgetStorage();
    refreshWidgetLists();
}

function updateColorValues() {
    document.querySelectorAll('.color-control input[type="color"]').forEach(input => {
        const valueSpan = input.nextElementSibling;
        valueSpan.textContent = input.value.toUpperCase();
        input.addEventListener('input', () => {
            valueSpan.textContent = input.value.toUpperCase();
        });
    });
}

function setupBackgroundPreview() {
    const bgUrl = document.getElementById('bgUrl');
    const preview = document.getElementById('bgPreview');
    const previewText = preview.querySelector('.preview-text');

    bgUrl.addEventListener('input', () => {
        if (bgUrl.value) {
            preview.style.backgroundImage = `url('${bgUrl.value}')`;
            previewText.style.display = 'none';
        } else {
            preview.style.backgroundImage = 'none';
            previewText.style.display = 'block';
        }
    });
}

function setBackground() {
    const url = document.getElementById('bgUrl').value;
    if (url) {
        document.body.style.backgroundImage = `url('${url}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
    }
}

function updateWindowColors() {
    const normalColor = document.getElementById('normalWindowColor').value;
    const widgetColor = document.getElementById('widgetWindowColor').value;

    document.documentElement.style.setProperty('--window-bg', normalColor + 'F2');
    document.documentElement.style.setProperty('--widget-bg', widgetColor + 'F2');
}

function updateAccentColor() {
    const accentColor = document.getElementById('accentColor').value;
    document.documentElement.style.setProperty('--accent-color', accentColor);
}

function updateTransparency() {
    const value = document.getElementById('transparencySlider').value;
    document.getElementById('transparencyValue').textContent = value + '%';

    const opacity = value / 100;
    document.documentElement.style.setProperty('--window-opacity', opacity);
}

async function loadSystemPanel(panel) {
    panel.innerHTML = `
        <div class="system-panel">
            <div class="panel-header">
                <h2>System Information</h2>
                <button onclick="refreshSystemInfo()" class="refresh-button">
                    <span class="material-symbols-outlined">refresh</span>
                </button>
            </div>
            <div class="system-grid" id="systemInfoContent">
                <div class="info-card">
                    <div class="card-header">
                        <span class="material-symbols-outlined">computer</span>
                        <h3>System</h3>
                    </div>
                    <div class="card-content" id="systemBasicInfo">
                        <p>Loading...</p>
                    </div>
                </div>
                
                <div class="info-card">
                    <div class="card-header">
                        <span class="material-symbols-outlined">memory</span>
                        <h3>CPU & Memory</h3>
                    </div>
                    <div class="card-content" id="cpuMemInfo">
                        <p>Loading...</p>
                    </div>
                </div>

                <div class="info-card">
                    <div class="card-header">
                        <span class="material-symbols-outlined">wallpaper</span>
                        <h3>Graphics</h3>
                    </div>
                    <div class="card-content" id="gpuInfo">
                        <p>Loading...</p>
                    </div>
                </div>

                <div class="info-card">
                    <div class="card-header">
                        <span class="material-symbols-outlined">storage</span>
                        <h3>Storage</h3>
                    </div>
                    <div class="card-content" id="storageInfo">
                        <p>Loading...</p>
                    </div>
                </div>

                <div class="info-card">
                    <div class="card-header">
                        <span class="material-symbols-outlined">lan</span>
                        <h3>Network</h3>
                    </div>
                    <div class="card-content" id="networkInfo">
                        <p>Loading...</p>
                    </div>
                </div>

                <div class="info-card">
                    <div class="card-header">
                        <span class="material-symbols-outlined">battery_full</span>
                        <h3>Battery</h3>
                    </div>
                    <div class="card-content" id="batteryInfo">
                        <p>Loading...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    refreshSystemInfo();
}

async function refreshSystemInfo() {
    try {
        const button = document.querySelector('.refresh-button .material-symbols-outlined');
        if (button) button.classList.add('refreshing');

        const systemInfo = await window.electronAPI.invoke('get-system-info');

        // Update each section separately
        updateSystemBasicInfo(systemInfo);
        updateCpuMemInfo(systemInfo);
        updateGpuInfo(systemInfo);
        updateStorageInfo(systemInfo);
        updateNetworkInfo(systemInfo);
        updateBatteryInfo(systemInfo);

        if (button) button.classList.remove('refreshing');
    } catch (error) {
        console.error('Error refreshing system info:', error);
        document.querySelectorAll('.card-content').forEach(content => {
            content.innerHTML = '<p class="error">Error loading information</p>';
        });
    }
}

// Helper functions to update each section...
function updateSystemBasicInfo(info) {
    console.log('System Info:', info.system);
    console.log('OS Info:', info.os);
    const content = document.getElementById('systemBasicInfo');
    content.innerHTML = `
        <p><strong>Manufacturer:</strong> ${info.system.manufacturer}</p>
        <p><strong>Model:</strong> ${info.system.model}</p>
        <p><strong>OS:</strong> ${info.os.distro} ${info.os.release}</p>
        <p><strong>Kernel:</strong> ${info.os.kernel}</p>
        <p><strong>Uptime:</strong> ${Math.floor(info.uptime / 3600)} hours</p>
    `;
}

function updateCpuMemInfo(info) {
    console.log('CPU Info:', info.cpu);
    console.log('Memory Info:', info.memory);
    const content = document.getElementById('cpuMemInfo');
    content.innerHTML = `
        <p><strong>CPU:</strong> ${info.cpu.manufacturer} ${info.cpu.brand}</p>
        <p><strong>Cores:</strong> ${info.cpu.cores}</p>
        <p><strong>Speed:</strong> ${info.cpu.speed} GHz</p>
        <p><strong>Total RAM:</strong> ${(info.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB</p>
        <p><strong>Available RAM:</strong> ${(info.memory.available / 1024 / 1024 / 1024).toFixed(2)} GB</p>
        <p><strong>Used RAM:</strong> ${((info.memory.total - info.memory.available) / 1024 / 1024 / 1024).toFixed(2)} GB</p>
    `;
}

function updateGpuInfo(info) {
    console.log('Graphics Info:', info.graphics);
    const content = document.getElementById('gpuInfo');
    content.innerHTML = info.graphics.controllers.map((gpu, index) => `
        <div class="gpu-info">
            <p><strong>GPU ${index + 1}:</strong> ${gpu.model}</p>
            <p><strong>Vendor:</strong> ${gpu.vendor}</p>
            <p><strong>VRAM:</strong> ${(gpu.vram || 0)} MB</p>
        </div>
    `).join('<hr>');
}


function updateStorageInfo(info) {
    const content = document.getElementById('storageInfo');
    content.innerHTML = info.fsSize.map(drive => {
        const totalGB = (drive.size / 1024 / 1024 / 1024).toFixed(2);
        const usedGB = (drive.used / 1024 / 1024 / 1024).toFixed(2);
        const freeGB = (drive.available / 1024 / 1024 / 1024).toFixed(2);
        const freePercentage = ((drive.available / drive.size) * 100).toFixed(1);

        // Find matching physical drive info
        const physicalDrive = info.disk.find(d =>
            d.size === drive.size ||
            Math.abs(d.size - drive.size) < 1024 * 1024 * 1024 // 1GB tolerance
        );

        return `
            <div class="disk-info">
                <p><strong>Drive:</strong> ${drive.fs} (${physicalDrive?.type || 'Unknown'})</p>
                <p><strong>Type:</strong> ${drive.type}</p>
                <p><strong>Usage:</strong> ${usedGB} GB of ${totalGB} GB
                   <span class="space-free">(${freePercentage}% free)</span></p>
                <div class="usage-bar">
                    <div class="usage-fill" style="width: ${100 - freePercentage}%;
                         background: ${freePercentage < 10 ? '#ff4444' :
                freePercentage < 25 ? '#ffa500' : '#4CAF50'};">
                    </div>
                </div>
            </div>
        `;
    }).join('<hr>');
}


function updateNetworkInfo(info) {
    console.log('Network Info:', info.network);
    const content = document.getElementById('networkInfo');
    content.innerHTML = info.network.map(net => {
        // Skip showing adapters with no MAC or all zeros MAC
        if (!net.mac || net.mac === '00:00:00:00:00:00') {
            return '';
        }
        // Only show interfaces with actual IP addresses
        if (!net.ip4) {
            return '';
        }
        return `
            <div class="network-info">
                <p><strong>Interface:</strong> ${net.iface}</p>
                <p><strong>IP Address:</strong> ${net.ip4}</p>
                <p><strong>MAC:</strong> ${net.mac}</p>
                <p><strong>Speed:</strong> ${net.speed ? `${net.speed} Mbps` : 'Not connected'}</p>
            </div>
        `;
    }).filter(html => html !== '').join('<hr>') || '<p>No active network connections</p>';
}

function updateBatteryInfo(info) {
    console.log('Battery Info:', info.battery);
    const content = document.getElementById('batteryInfo');
    if (info.battery.hasBattery) {
        content.innerHTML = `
            <p><strong>Level:</strong> ${info.battery.percent}%</p>
            <p><strong>Status:</strong> ${info.battery.isCharging ? "Charging" : "Not charging"}</p>
            <p><strong>Health:</strong> ${info.battery.health}%</p>
        `;
    } else {
        content.innerHTML = `
            <p class="no-battery">No battery detected</p>
        `;
    }
}


function createWindow(title, url, position = null, isWidget = false, widgetId = null) {

    let icon = 'web';  // default icon
    if (isWidget && widgetId) {
        const widget = moduleManager.widgetsConfig.get(widgetId);
        if (widget && widget.icon) {
            icon = widget.icon;
        }
    }

    const windowId = `window-${windowCounter++}`;
    const windowHtml = `
        <div class="window ${isWidget ? 'widget-window' : ''}" id="${windowId}"
             style="transform: translate(0, 0) !important;">
            <div class="window-header">
                <div class="window-title">
                    <span class="material-symbols-outlined">${icon}</span>
                    ${title}
                </div>
                <div class="window-controls">
                    <button onclick="refreshWindow('${windowId}')" title="Refresh" class="control-button">
                        <span class="material-symbols-outlined">refresh</span>
                    </button>
                    <button onclick="minimizeWindow('${windowId}')" title="Minimize" class="control-button">
                        <span class="material-symbols-outlined">remove</span>
                    </button>
                    <button onclick="closeWindow('${windowId}')" title="Close" class="control-button">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                
            </div>
            <div class="window-content">
                <webview
                    src="${url}"
                    allowpopups
                    partition="persist:general"
                    preload="./src/preload.js"
                    webpreferences="contextIsolation=yes,nodeIntegration=no"
                ></webview>
            </div>
            <div class="resize-handle"></div>
        </div>
    `;

    // Create window and get reference
    document.body.insertAdjacentHTML('beforeend', windowHtml);
    const windowEl = document.getElementById(windowId);

    // Initialize window in windows Map
    windows.set(windowId, {
        title,
        url,
        minimized: false,
        isWidget
    });

    console.log(`Registered window ${windowId}:`, Array.from(windows.entries()));

    // Apply theme and set up window management
    (async () => {
        try {
            // Apply theme
            const currentTheme = await window.getCurrentTheme();
            if (currentTheme) {
                const titlebar = windowEl.querySelector('.window-header');
                if (titlebar) {
                    updateTitlebarStyle(titlebar, currentTheme, isWidget);
                }
            }

            // Initialize window focus management
            WindowManager.setupWindow(windowEl);
        } catch (error) {
            console.error('Error initializing window:', error);
        }
    })();


    if (isWidget && widgetId) {
        // Get widget config first
        const widget = moduleManager.widgetsConfig.get(widgetId);

        // Set initial size from widget config
        if (widget && widget.settings.size) {
            windowEl.style.width = `${widget.settings.size.width}px`;
            windowEl.style.height = `${widget.settings.size.height}px`;
        } else {
            windowEl.style.width = '300px';  // fallback
            windowEl.style.height = '300px'; // fallback
        }

        // Set up observer for position and size changes
        const observer = new MutationObserver(() => {
            const rect = windowEl.getBoundingClientRect();
            const newState = {
                position: { x: rect.left, y: rect.top },
                size: { width: rect.width, height: rect.height }
            };

            // Only update if values have changed
            if (JSON.stringify(widget?.settings?.position) !== JSON.stringify(newState.position) ||
                JSON.stringify(widget?.settings?.size) !== JSON.stringify(newState.size)) {
                moduleManager.saveWidgetState(widgetId, newState);
            }
        });

        observer.observe(windowEl, {
            attributes: true,
            attributeFilter: ['style']
        });
    }

    // Initialize draggable behavior
    makeDraggable(windowEl);
    // this.setupResizing(panel);

    // Set initial position and size
    if (isWidget) {
        // windowEl.style.width = '250px';
        // windowEl.style.height = '100px';
        windowEl.style.transform = 'none';
        windowEl.style.top = position?.y ?? '20px';
        windowEl.style.left = position?.x ?? '20px';
    } else {
        const offset = (windowCounter % 10) * 30;
        windowEl.style.transform = 'none';
        windowEl.style.top = position?.y ?? `${50 + offset}px`;
        windowEl.style.left = position?.x ?? `${50 + offset}px`;
    }

    // Show window and update state
    windowEl.style.display = 'block';
    updateEmptyState();

    return windowId;
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        try {
            const content = await window.electronAPI.readFile(file.path);
            await createWindow(
                file.name,
                URL.createObjectURL(new Blob([content], { type: 'text/html' }))
            );
        } catch (error) {
            console.error('Error reading file:', error);
        }
    }
}

// Menu functions
function toggleChoiceMenu() {
    const menu = document.getElementById('choiceMenu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function toggleDock() {
    const dock = document.getElementById('dock');
    isDockHidden = !isDockHidden;
    dock.classList.toggle('hidden');
}

function openFilePicker() {
    document.getElementById('filePicker').click();
    document.getElementById('choiceMenu').style.display = 'none';
}

// URL handling
function showUrlPrompt() {
    console.log('showUrlPrompt called');
    document.getElementById('urlInputModal').style.display = 'block';
    document.getElementById('urlInput').focus();
    document.getElementById('choiceMenu').style.display = 'none';
}

function hideUrlPrompt() {
    console.log('hideUrlPrompt called');
    document.getElementById('urlInputModal').style.display = 'none';
    document.getElementById('urlInput').value = '';
}



async function createUrlWindow() {
    console.log('createUrlWindow called');
    const url = document.getElementById('urlInput').value.trim();
    if (!url) {
        alert('Please enter a URL');
        return;
    }
    console.log('Creating window for URL:', url);
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const transformed = transformUrl(fullUrl);
    try {
        if (transformed.type === 'youtube-browser') {
            await createYouTubeBrowser();
        } else {
            // Find existing container or create new one
            let containerId = Array.from(tabGroups.keys())[0];
            if (!containerId) {
                containerId = await createWebContainer();
            }
            // Add new tab with the transformed URL
            await newTab(containerId, transformed.url);
        }
        hideUrlPrompt();
    } catch (error) {
        console.error('Error creating URL window:', error);
    }
}

// Helper function to process URLs
function processUrl(url) {
    // If it's a search term (contains spaces or no dots)
    if (url.includes(' ') || !url.includes('.')) {
        return `https://start.duckduckgo.com/?q=${encodeURIComponent(url)}`;
    }

    // Add https if no protocol specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
    }

    return url;
}

function loadUrl(containerId, url) {
    console.log('Loading URL:', url);
    const activeTab = getActiveTab(containerId);
    if (activeTab) {
        const webview = activeTab.pane.querySelector('webview');
        if (webview) {
            try {
                let processedUrl = url;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    if (url.includes(' ') || !url.includes('.')) {
                        processedUrl = `https://start.duckduckgo.com/?q=${encodeURIComponent(url)}`;
                    } else {
                        processedUrl = `https://${url}`;
                    }
                }

                console.log('Loading processed URL:', processedUrl);
                if (webview.loadURL) {
                    webview.loadURL(processedUrl);
                } else {
                    webview.src = processedUrl;
                }
            } catch (error) {
                console.error('Error loading URL:', error);
                const searchUrl = `https://start.duckduckgo.com/?q=${encodeURIComponent(url)}`;
                if (webview.loadURL) {
                    webview.loadURL(searchUrl);
                } else {
                    webview.src = searchUrl;
                }
            }
        }
    }
}

// Window control functions
function refreshWindow(windowId) {
    const webview = document.querySelector(`#${windowId} webview`);
    if (webview) {
        webview.reload();
    }
}



// In renderer.js
function closeWindow(windowId) {
    const win = document.getElementById(windowId);
    // if (win) {
    //     // Check if it's a preview window and cleanup if needed
    //     if (windowId.startsWith('preview-') && window.codeManager) {
    //         window.codeManager.cleanupPreview(windowId);
    //     }

    win.remove();
    windows.delete(windowId);
    DockManager.renderDock();
    updateEmptyState();
    // }
}

// function closeWindow(windowId) {
//     const win = document.getElementById(windowId);
//     win.remove();
//     windows.delete(windowId);
//     // updateDock();
//     // DockManager.updateDock()
//     DockManager.renderDock();
//     updateEmptyState();
// }

function makeDraggable(element) {
    const isWidget = element.classList.contains('widget-window');
    const header = element.querySelector('.window-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let originalSize = null;
    let snapTimeout = null;
    const SNAP_DELAY = 200; // ms to hold before snap triggers
    const CORNER_THRESHOLD = Math.min(window.innerWidth, window.innerHeight) / 12; // More precise corner zones
    const EDGE_THRESHOLD = 30; // Smaller edge detection zone

    // Create snap preview overlay
    let snapOverlay = null;
    if (!isWidget) {
        snapOverlay = document.createElement('div');
        snapOverlay.className = 'snap-overlay';
        snapOverlay.style.display = 'none';
        document.body.appendChild(snapOverlay);
    }

    function saveOriginalSize() {
        if (!originalSize) {
            const rect = element.getBoundingClientRect();
            originalSize = {
                width: rect.width + 'px',
                height: rect.height + 'px',
                left: element.style.left,
                top: element.style.top
            };
        }
    }

    function restoreOriginalSize() {
        if (originalSize) {
            element.style.width = originalSize.width;
            element.style.height = originalSize.height;
            if (originalSize.left && originalSize.top) {
                element.style.left = originalSize.left;
                element.style.top = originalSize.top;
            }
            originalSize = null;
        }
    }

    function showSnapPreview(x, y) {
        if (!snapOverlay || isWidget) return;

        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        snapOverlay.style.transition = 'all 0.15s ease';
        snapOverlay.style.display = 'block';

        // Check corners first (they take priority)
        if (x < CORNER_THRESHOLD && y < CORNER_THRESHOLD) {
            // Top-left corner
            snapOverlay.style.left = '0';
            snapOverlay.style.top = '0';
            snapOverlay.style.width = '50%';
            snapOverlay.style.height = '50%';
        } else if (x > windowWidth - CORNER_THRESHOLD && y < CORNER_THRESHOLD) {
            // Top-right corner
            snapOverlay.style.left = '50%';
            snapOverlay.style.top = '0';
            snapOverlay.style.width = '50%';
            snapOverlay.style.height = '50%';
        } else if (x < CORNER_THRESHOLD && y > windowHeight - CORNER_THRESHOLD) {
            // Bottom-left corner
            snapOverlay.style.left = '0';
            snapOverlay.style.top = '50%';
            snapOverlay.style.width = '50%';
            snapOverlay.style.height = '50%';
        } else if (x > windowWidth - CORNER_THRESHOLD && y > windowHeight - CORNER_THRESHOLD) {
            // Bottom-right corner
            snapOverlay.style.left = '50%';
            snapOverlay.style.top = '50%';
            snapOverlay.style.width = '50%';
            snapOverlay.style.height = '50%';
        } else if (x < EDGE_THRESHOLD) {
            // Left edge
            snapOverlay.style.left = '0';
            snapOverlay.style.top = '0';
            snapOverlay.style.width = '50%';
            snapOverlay.style.height = '100%';
        } else if (x > windowWidth - EDGE_THRESHOLD) {
            // Right edge
            snapOverlay.style.left = '50%';
            snapOverlay.style.top = '0';
            snapOverlay.style.width = '50%';
            snapOverlay.style.height = '100%';
        } else if (y < EDGE_THRESHOLD) {
            // Top edge (full screen)
            snapOverlay.style.left = '0';
            snapOverlay.style.top = '0';
            snapOverlay.style.width = '100%';
            snapOverlay.style.height = '100%';
        } else {
            snapOverlay.style.display = 'none';
        }
    }

    function applySnap(x, y) {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        saveOriginalSize();
        element.classList.remove('snapped', 'snapped-left', 'snapped-right', 'snapped-top', 'snapped-full',
            'snapped-top-left', 'snapped-top-right', 'snapped-bottom-left', 'snapped-bottom-right');

        // Apply the snap based on position
        if (x < CORNER_THRESHOLD && y < CORNER_THRESHOLD) {
            element.style.left = '0';
            element.style.top = '0';
            element.style.width = '50%';
            element.style.height = '50%';
            element.classList.add('snapped', 'snapped-top-left');
        } else if (x > windowWidth - CORNER_THRESHOLD && y < CORNER_THRESHOLD) {
            element.style.left = '50%';
            element.style.top = '0';
            element.style.width = '50%';
            element.style.height = '50%';
            element.classList.add('snapped', 'snapped-top-right');
        } else if (x < CORNER_THRESHOLD && y > windowHeight - CORNER_THRESHOLD) {
            element.style.left = '0';
            element.style.top = '50%';
            element.style.width = '50%';
            element.style.height = '50%';
            element.classList.add('snapped', 'snapped-bottom-left');
        } else if (x > windowWidth - CORNER_THRESHOLD && y > windowHeight - CORNER_THRESHOLD) {
            element.style.left = '50%';
            element.style.top = '50%';
            element.style.width = '50%';
            element.style.height = '50%';
            element.classList.add('snapped', 'snapped-bottom-right');
        } else if (x < EDGE_THRESHOLD) {
            element.style.left = '0';
            element.style.top = '0';
            element.style.width = '50%';
            element.style.height = '100%';
            element.classList.add('snapped', 'snapped-left');
        } else if (x > windowWidth - EDGE_THRESHOLD) {
            element.style.left = '50%';
            element.style.top = '0';
            element.style.width = '50%';
            element.style.height = '100%';
            element.classList.add('snapped', 'snapped-right');
        } else if (y < EDGE_THRESHOLD) {
            element.style.left = '0';
            element.style.top = '0';
            element.style.width = '100%';
            element.style.height = '100%';
            element.classList.add('snapped', 'snapped-full');
        }
    }

    header.style.cursor = 'grab';

    header.addEventListener('mousedown', e => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

        isDragging = true;
        const rect = element.getBoundingClientRect();
        initialX = e.clientX - rect.left;
        initialY = e.clientY - rect.top;

        if (element.classList.contains('snapped')) {
            saveOriginalSize();
            element.classList.remove('snapped');
        }

        header.style.cursor = 'grabbing';
        element.style.transition = 'none';
        WindowManager.bringToFront(element);
        e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
        if (!isDragging) return;

        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        // Apply position
        element.style.left = `${currentX}px`;
        element.style.top = `${currentY}px`;

        // Clear any pending snap timeout
        if (snapTimeout) {
            clearTimeout(snapTimeout);
        }

        // Show preview immediately
        if (!e.altKey && !isWidget) {
            showSnapPreview(e.clientX, e.clientY);

            // Set timeout for actual snap
            snapTimeout = setTimeout(() => {
                if (isDragging && !e.altKey) {
                    applySnap(e.clientX, e.clientY);
                }
            }, SNAP_DELAY);
        }
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;

        isDragging = false;
        header.style.cursor = 'grab';
        element.style.transition = '';

        if (snapTimeout) {
            clearTimeout(snapTimeout);
        }

        if (snapOverlay) {
            snapOverlay.style.display = 'none';
        }
    });

    // Double-click maximize
    header.addEventListener('dblclick', () => {
        if (element.classList.contains('snapped-full')) {
            restoreOriginalSize();
            element.classList.remove('snapped', 'snapped-full');
        } else {
            saveOriginalSize();
            element.style.left = '0';
            element.style.top = '0';
            element.style.width = '100%';
            element.style.height = '100%';
            element.classList.add('snapped', 'snapped-full');
        }
    });

    // Cleanup
    element.addEventListener('remove', () => {
        if (snapOverlay && snapOverlay.parentNode) {
            snapOverlay.parentNode.removeChild(snapOverlay);
        }
    });
}

function updateEmptyState() {
    try {
        const emptyState = document.querySelector('.empty-state');
        if (!emptyState) return;

        const hasVisibleWindows = Array.from(windows.values()).some(w => !w.minimized);
        emptyState.style.display = hasVisibleWindows ? 'none' : 'block';
    } catch (error) {
        console.error('Error updating empty state:', error);
    }
}



// Function to retrieve icon name from the window content
function getIconName(windowId) {
    const windowContent = document.getElementById(windowId); // Assuming each window has a unique ID
    const iconElement = windowContent?.querySelector('.window-title .material-symbols-outlined');
    return iconElement ? iconElement.textContent.trim() : 'web_asset'; // Default icon if not found
}



const DockManager = {
    minimizedWindows: new Set(),
    observer: null,

    init() {
        const dock = document.getElementById('dock');

        // Remove any existing observers
        if (this.observer) {
            this.observer.disconnect();
        }

        // Set up click handler with event delegation
        dock.addEventListener('click', this.handleDockClick.bind(this));

        // Create new mutation observer to prevent rapid updates
        this.observer = new MutationObserver((mutations) => {
            console.log('Dock mutation detected:', mutations.length);
        });

        // Start observing with specific config
        this.observer.observe(dock, {
            childList: true,
            attributes: true,
            subtree: true,
            characterData: true
        });
    },

    handleDockClick(e) {
        const dockItem = e.target.closest('.dock-item');
        if (!dockItem) return;

        const windowId = dockItem.dataset.windowId;
        if (!windowId) return;

        // Prevent any event bubbling
        e.preventDefault();
        e.stopPropagation();

        console.log('Restoring window:', windowId);
        this.restoreWindow(windowId);
    },

    restoreWindow(windowId) {
        const win = document.getElementById(windowId);
        if (!win) return;

        win.style.display = 'block';
        win.style.visibility = 'visible';
        win.style.opacity = '1';

        const windowState = windows.get(windowId);
        if (windowState) {
            windowState.minimized = false;
            this.minimizedWindows.delete(windowId);
        }

        WindowManager.bringToFront(win);
        this.renderDock();
    },

    renderDock() {
        const dock = document.getElementById('dock');
        if (!dock) return;

        // Temporarily disconnect observer
        this.observer.disconnect();

        try {
            let minimizedCount = 0;
            const dockContent = [];

            windows.forEach((window, windowId) => {
                if (window.minimized) {
                    minimizedCount++;
                    const icon = getIconName(windowId);
                    dockContent.push(`
                        <div class="dock-item" data-window-id="${windowId}">
                            <span class="material-symbols-outlined">${icon}</span>
                            ${window.title}
                        </div>
                    `);
                }
            });

            // Update dock content only if necessary
            if (dock.children.length !== minimizedCount) {
                dock.innerHTML = dockContent.join('');
            }

            // Update dock visibility
            if (minimizedCount > 0 && isDockHidden) {
                dock.classList.remove('hidden');
                isDockHidden = false;
            } else if (minimizedCount === 0 && !isDockHidden) {
                dock.classList.add('hidden');
                isDockHidden = true;
            }

            // Update window counter
            const menuCounter = document.getElementById('menuWindowCounter');
            if (menuCounter) {
                menuCounter.textContent = windows.size;
            }
        } finally {
            // Reconnect observer
            this.observer.observe(dock, {
                childList: true,
                attributes: true,
                subtree: true,
                characterData: true
            });
        }
    }
};

// Update minimize function
function minimizeWindow(windowId) {
    const win = document.getElementById(windowId);
    if (!win) return;

    win.style.display = 'none';
    win.style.visibility = 'hidden';
    win.style.opacity = '0';

    const windowState = windows.get(windowId);
    if (windowState) {
        windowState.minimized = true;
        DockManager.minimizedWindows.add(windowId);
    }

    DockManager.renderDock();
    updateEmptyState();
}

function restoreWindow(windowId) {
    const win = document.getElementById(windowId);
    if (!win) return;

    win.style.display = 'block';
    win.style.visibility = 'visible';
    win.style.opacity = '1';

    const windowState = windows.get(windowId);
    if (windowState) {
        windowState.minimized = false;
        DockManager.requestDockUpdate();
    }

    WindowManager.bringToFront(win);
    updateEmptyState();
}

// Update toggleDock to not trigger updates
function toggleDock() {
    const dock = document.getElementById('dock');
    isDockHidden = !isDockHidden;
    dock.classList.toggle('hidden');
}


function updateSystemControls() {
    if (!AppState.systemControlsInitialized) {
        systemControls.init();
    } else {
        systemControls.updateWindowCount(); // Only update the window count
    }
}

async function handleNewBrowser() {
    try {
        await createWebContainer();
    } catch (error) {
        console.error('Error creating new browser:', error);
    }
}

// New Quick Menu function
function showQuickMenu(event) {
    console.log('Showing QuickMenu');
    event.stopPropagation(); // Prevent event bubbling

    // Remove existing menu if it exists
    const existingMenu = document.getElementById('quickMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    try {
        const menuHtml = `
        <div id="quickMenu" class="quick-menu">
            <div class="quick-menu-section">
                <h3>Quick Actions</h3>
                <div class="quick-actions">
                    <button onclick="showUrlPrompt()" class="action-button">
                        <span class="material-symbols-outlined">language</span>
                        Open URL
                    </button>
                    <button onclick="handleNewBrowser()" class="action-button">
                        <span class="material-symbols-outlined">web</span>
                        New Browser
                    </button>
                </div>
            </div>
           
            <div class="quick-menu-section">
                <h3>Installed Widgets</h3>
                <div class="widget-quick-list" id="widgetQuickList"></div>
            </div>
        </div>
    `;

        document.body.insertAdjacentHTML('beforeend', menuHtml);
        const quickMenu = document.getElementById('quickMenu');

        // Position the menu
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        // const quickMenu = document.getElementById('quickMenu');
        const systemControls = document.querySelector('.system-controls');
        const controlsRect = systemControls.getBoundingClientRect();

        // First position the menu off-screen to get its dimensions
        quickMenu.style.visibility = 'hidden';
        quickMenu.style.display = 'block';
        const menuRect = quickMenu.getBoundingClientRect();

        // Calculate optimal position
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        const padding = 20;

        // Calculate vertical position
        // const topPosition = windowHeight - menuRect.height - rect.height - (padding * 2);
        const topPosition = controlsRect.top - menuRect.height - rect.height - (padding * 8) + padding;

        // Calculate horizontal position
        // Align with system controls by subtracting its width
        const leftPosition = windowWidth - menuRect.width - padding - controlsRect.width;

        // Apply the calculated position
        quickMenu.style.left = `${leftPosition}px`;
        quickMenu.style.top = `${topPosition}px`;

        // Make the menu visible with animation
        quickMenu.style.visibility = 'visible';
        quickMenu.style.opacity = '0';
        quickMenu.style.transform = 'translateY(10px)';
        requestAnimationFrame(() => {
            quickMenu.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out';
            quickMenu.style.opacity = '1';
            quickMenu.style.transform = 'translateY(0)';
        });

        // Load widgets
        loadQuickWidgetList();

        // Click outside to close
        function handleClickOutside(e) {
            if (!quickMenu.contains(e.target) && e.target !== button) {
                quickMenu.remove();
                document.removeEventListener('click', handleClickOutside);
            }
        }

        // Delay adding the click listener to prevent immediate triggering
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);

    } catch (error) {
        console.error('Error showing QuickMenu:', error);
    }
}

async function loadQuickWidgetList() {
    try {
        console.log('Loading quick widget list');
        const widgets = await window.electronAPI.store.get('widgets') || [];
        const container = document.getElementById('widgetQuickList');

        if (!container) {
            console.error('Widget quick list container not found');
            return;
        }

        if (widgets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">widgets</span>
                    <p>No widgets installed</p>
                </div>
            `;
            return;
        }

        container.innerHTML = widgets.map(widget => `
            <div class="widget-quick-item" onclick="event.stopPropagation(); moduleManager.launchWidget('${widget.id}')">
                <span class="material-symbols-outlined">${widget.icon}</span>
                <div class="widget-quick-info">
                    <span class="widget-name">${widget.name}</span>
                    <span class="widget-version">v${widget.version || '1.0.0'}</span>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading quick widget list:', error);
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    if (AppState.initialized) {
        console.log('App already initialized');
        return;
    }

    console.log('DOM Content Loaded - Starting initialization');
    console.log('Checking ThemePreviewManager availability:', {
        onWindow: typeof window.ThemePreviewManager,
        global: typeof ThemePreviewManager,
    });

    try {
        // Initialize module manager first
        moduleManager = new ModuleManager();
        await moduleManager.initialize();

        // Check if ThemePreviewManager exists
        if (typeof window.ThemePreviewManager === 'undefined') {
            console.error('ThemePreviewManager not loaded - check script loading order');
            console.log('Available globals:', Object.keys(window));
            return;
        }

        console.log('Initializing theme system...');

        // Create theme manager once
        window.themePreviewManager = new window.ThemePreviewManager();

        // Get and apply current theme
        const currentTheme = await window.getCurrentTheme();
        console.log('Current theme:', currentTheme);

        if (currentTheme) {
            // Apply theme to UI
            await window.applyThemeToUI(currentTheme);

            // Set current theme in preview manager
            window.themePreviewManager.currentPreview = {
                colors: { ...currentTheme.colors },
                transparency: { ...currentTheme.transparency }
            };

            // Update preview display
            window.themePreviewManager.updatePreviewDisplay();
        }

        console.log('Cursor-themeManager-start')
        const currentCursor = await window.electronAPI.store.get('currentCursor');
        if (currentCursor) {
            document.body.style.cursor = `url('${currentCursor}'), auto`;
            console.log('Cursor-themeManager: url(', currentCursor, ')');
        }
        console.log('Cursor-themeManager-end')

        // Initialize system controls
        systemControls.init();

        // Add DockManager initialization here
        DockManager.init();  // <-- Move it here

        // Set up control stack behavior
        const controlStack = document.querySelector('.control-stack');
        if (controlStack) {
            let hideTimeout;

            controlStack.addEventListener('mouseenter', () => {
                clearTimeout(hideTimeout);
                controlStack.classList.add('active');
            });

            controlStack.addEventListener('mouseleave', () => {
                hideTimeout = setTimeout(() => {
                    controlStack.classList.remove('active');
                }, 500);
            });
        }

        // Restore last wallpaper
        try {
            const lastWallpaper = await window.electronAPI.store.get('lastWallpaper');
            if (lastWallpaper) {
                console.log('Restoring last wallpaper:', lastWallpaper);
                await applyWallpaper(lastWallpaper);
            }
        } catch (error) {
            console.error('Error restoring last wallpaper:', error);
        }

        try {
            // Initial theme application
            console.log('Initializing theme system...');
            const currentTheme = await window.getCurrentTheme();
            console.log('Current theme:', currentTheme);
            applyThemeToUI(currentTheme);

            // Set up theme change observer
            const themeChangeObserver = new MutationObserver(async () => {
                const theme = await window.getCurrentTheme();
                applyThemeToUI(theme);
            });

            // Observe theme-related elements if needed
            const themeContainer = document.documentElement;
            themeChangeObserver.observe(themeContainer, {
                attributes: true,
                attributeFilter: ['data-theme']
            });

        } catch (error) {
            console.error('Error initializing theme:', error);
        }


        window.addEventListener('themechange', () => {
            const currentTheme = window.getCurrentTheme(); // You'll need to implement this
            applyThemeToUI(currentTheme);
        });

        // Set up window observer
        let updateTimeout;
        const observer = new MutationObserver((mutations) => {
            // Clear any pending timeout
            clearTimeout(updateTimeout);

            // Set a new timeout
            updateTimeout = setTimeout(() => {
                const needsUpdate = mutations.some(mutation =>
                    mutation.type === 'childList' &&
                    (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
                );

                if (needsUpdate) {
                    systemControls.updateWindowCount();
                    // updateDock();
                    // DockManager.updateDock()
                    DockManager.renderDock();
                    updateEmptyState();
                }
            }, 100); // Debounce for 100ms
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // URL related buttons setup
        console.log('Setting up URL handlers');
        const openUrlBtn = document.getElementById('openUrlBtn');
        const openUrlConfirmBtn = document.getElementById('openUrlConfirmBtn');
        const openUrlCancelBtn = document.getElementById('openUrlCancelBtn');

        if (openUrlBtn) openUrlBtn.addEventListener('click', showUrlPrompt);
        if (openUrlConfirmBtn) openUrlConfirmBtn.addEventListener('click', createUrlWindow);
        if (openUrlCancelBtn) openUrlCancelBtn.addEventListener('click', hideUrlPrompt);

        // Other button handlers
        console.log('Setting up other button handlers');
        document.getElementById('openFileBtn')?.addEventListener('click', openFilePicker);
        document.getElementById('toggleDockBtn')?.addEventListener('click', toggleDock);
        document.getElementById('addButton')?.addEventListener('click', toggleChoiceMenu);

        // URL input Enter key handler
        document.getElementById('urlInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Enter pressed in URL input');
                createUrlWindow();
            }
        });

        // File picker handler
        document.getElementById('filePicker')?.addEventListener('change', handleFileSelect);

        // Click outside menu handling
        document.addEventListener('click', e => {
            const menu = document.getElementById('choiceMenu');
            const addButton = document.getElementById('addButton');
            if (menu && addButton && !menu.contains(e.target) && !addButton.contains(e.target)) {
                menu.style.display = 'none';
            }
        });

        // Module import modal setup
        console.log('Setting up module import handlers');
        const moduleModal = document.getElementById('moduleImportModal');
        const tabBtns = document.querySelectorAll('.import-tabs .tab-btn');

        if (moduleModal) {
            document.getElementById('importModuleBtn')?.addEventListener('click', () => {
                moduleModal.style.display = 'none';
            });

            document.getElementById('cancelImportBtn')?.addEventListener('click', () => {
                moduleModal.style.display = 'none';
            });

            moduleModal.addEventListener('click', (e) => {
                if (e.target === moduleModal) {
                    moduleModal.style.display = 'none';
                }
            });
        }

        // Tab buttons setup
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();

                document.querySelectorAll('.import-tabs .tab-btn')
                    .forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.modal .tab-content')
                    .forEach(content => content.classList.remove('active'));

                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab') + 'Tab';
                const tabContent = document.getElementById(tabId);
                if (tabContent) {
                    tabContent.classList.add('active');
                }
            });
        });

        // In your DOMContentLoaded handler in renderer.js
        console.log('Checking TerminalManager availability:', {
            onWindow: typeof window.TerminalManager,
            global: typeof TerminalManager
        });

        try {
            // Initialize module manager first (as you already have)
            moduleManager = new ModuleManager();
            await moduleManager.initialize();

            // Check for TerminalManager
            if (typeof window.TerminalManager === 'undefined') {
                console.error('TerminalManager not loaded - check script loading order');
                console.log('Available globals:', Object.keys(window));
                return;
            }

            console.log('Starting Terminal Manager init...');
            terminalManager = new TerminalManager();
            await terminalManager.initialize();
            console.log('Terminal init done.');

        } catch (error) {
            console.error('Error during initialization:', error);
        }


        console.log('Starting Code Manager init...');
        if (typeof window.CodeManager === 'undefined') {
            console.error('CodeManager not loaded - check script loading order');
            console.log('Available globals:', Object.keys(window));
            return;
        }

        // Use existing instance or create new one if necessary
        if (!window.codeManager?.initialized) {
            if (!window.codeManager) {
                window.codeManager = new CodeManager();
            }
            await window.codeManager.initialize();
        }
        console.log('Code Manager init done.');


        AppState.initialized = true;
        console.log('Initialization complete');

    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// Widget selection
document.querySelectorAll('.widget-item').forEach(item => {
    item.addEventListener('click', async () => {
        const widgetType = item.dataset.widget;
        console.log('Widget clicked:', widgetType);
        if (widgetType === 'clock') {
            console.log('Adding clock widget');
            const module = await moduleManager.addModule({
                name: 'Clock Widget',
                type: 'widget',
                path: 'widgets/clock/index.html',
                category: 'Widgets',
                icon: 'schedule',
                autolaunch: true  // Add this to launch immediately when added
            });
            document.getElementById('moduleImportModal').style.display = 'none';
        };
        if (widgetType === 'pipedreams') {
            console.log('Adding game widget');
            const module = await moduleManager.addModule({
                name: 'PipeDreams Widget',
                type: 'widget',
                path: 'widgets/pipedreams/index.html',
                category: 'Widgets',
                icon: 'valve',
                autolaunch: true  // Add this to launch immediately when added
            });
            document.getElementById('moduleImportModal').style.display = 'none';
        };
        if (widgetType === 'web') {
            console.log('Adding web widget');
            const module = await moduleManager.addModule({
                name: 'WebBrowser Widget',
                type: 'widget',
                path: 'widgets/web/index.html',
                category: 'Widgets',
                icon: 'home',
                autolaunch: true // Add this to launch immediately when added
            });
            document.getElementById('moduleImportModal').style.display = 'none';
        };
        if (widgetType === 'video') {
            console.log('Adding video widget');
            const module = await moduleManager.addModule({
                name: 'Video.JS Widget',
                type: 'widget',
                path: 'widgets/video/index.html',
                category: 'Widgets',
                icon: 'play_circle',
                autolaunch: true // Add this to launch immediately when added
            });
            document.getElementById('moduleImportModal').style.display = 'none';
        }
    });


});

document.getElementById('scanFolderBtn').addEventListener('click', async () => {
    try {
        const folderPath = await window.electronAPI.selectFolder();
        if (!folderPath) return;

        const widgets = await window.electronAPI.scanWidgetFolder(folderPath);
        console.log('Found widgets:', widgets);

        for (const widget of widgets) {
            await moduleManager.addWidget(widget);
        }

        // Refresh the widget list
        moduleManager.updateWidgetList();

    } catch (error) {
        console.error('Error scanning folder:', error);
    }
});

// Make necessary functions available globally
window.refreshWindow = refreshWindow;
window.minimizeWindow = minimizeWindow;
window.closeWindow = closeWindow;
window.restoreWindow = restoreWindow;

const systemControls = {
    init: function () {
        if (AppState.systemControlsInitialized) {
            return;
        }
        console.log('Initializing system controls');
        try {
            this.updateUI();
            this.initClock();
            AppState.systemControlsInitialized = true;
            console.log('System controls initialization complete');
        } catch (error) {
            console.error('Error initializing system controls:', error);
        }
    },

    initClock: function () {
        // Create clock element if it doesn't exist
        let clockEl = document.querySelector('.system-clock');
        if (!clockEl) {
            clockEl = document.createElement('div');
            clockEl.className = 'system-clock';

            // Insert clock before the first control-section
            const controlSection = document.querySelector('.control-section');
            if (controlSection && controlSection.parentNode) {
                controlSection.parentNode.insertBefore(clockEl, controlSection);
            }
        }

        // Update clock immediately and start interval
        this.updateClock(clockEl);
        setInterval(() => this.updateClock(clockEl), 1000);
    },

    updateClock: function (clockEl) {
        const now = new Date();

        let hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';

        // Convert to 12-hour format
        hours = hours % 12;
        hours = hours ? hours : 12; // Handle the case for hour 0 (midnight)

        clockEl.innerHTML = `
            <div class="time">${hours}:${minutes} ${ampm}</div>
            <div class="date">${now.toLocaleDateString()}</div>
        `;
    },

// <button class="icon-button" onclick="window.codeManager.createEditorWindow()" title="Code Editor">
//     <span class="material-symbols-outlined">code</span>
// </button>

    updateUI: function (quiet = false) {
        const controlStack = document.querySelector('.control-stack');
        if (!controlStack) return;

        if (!quiet) console.log('Updating system controls');




        controlStack.innerHTML = `
            <div class="system-controls">
                            <div class="system-clock"></div>
                <div class="control-section">
                    <button class="icon-button" onclick="showQuickMenu(event)" title="Quick Menu">
                        <span class="material-symbols-outlined">apps</span>
                    </button>
                    <button class="icon-button" onclick="toggleDock()" title="Open Windows">
                        <span class="material-symbols-outlined">window</span>
                        <span class="window-counter">${windows.size}</span>
                    </button>


        <button class="icon-button" onclick="fileManager.show()" title="Files">
    <span class="material-symbols-outlined">folder</span>
</button>
                </div>
                <div class="control-section">
                    <button id="devToolsBtn" class="icon-button" title="Control Panel / DevTools">
                        <span class="material-symbols-outlined">settings</span>
                    </button>
                    <button id="restartBtn" class="icon-button" title="Restart">
                        <span class="material-symbols-outlined">autorenew</span>
                    </button>
                    <button id="shutdownBtn" class="icon-button danger" title="Shutdown">
                        <span class="material-symbols-outlined">power_settings_new</span>
                    </button>
                </div>
            </div>
        `;

        this.setupEventListeners();
    },

    setupEventListeners: function () {
        document.getElementById('devToolsBtn')?.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                window.electronAPI.send('toggle-dev-tools');
            } else {
                showControlPanel();
            }
        });
        document.getElementById('restartBtn')?.addEventListener('click', () => {
            window.electronAPI.send('app-restart');
        });
        document.getElementById('shutdownBtn')?.addEventListener('click', () => {
            window.electronAPI.send('app-shutdown');
        });
    },

    updateWindowCount: function () {
        const counter = document.querySelector('.window-counter');
        if (counter) {
            counter.textContent = windows.size;
        }
    }
};

const WindowManager = {
    baseZIndex: 1000,
    topZIndex: 1000,

    bringToFront: function (windowEl) {
        if (!windowEl) return;

        // Update topZIndex if this window is already higher
        this.topZIndex = Math.max(this.topZIndex, parseInt(windowEl.style.zIndex || this.baseZIndex));

        // Set this window to be on top
        windowEl.style.zIndex = (++this.topZIndex).toString();

        // Update all other windows to be below this one
        this.updateOtherWindows(windowEl);

        // Add visual feedback for focused window
        this.updateFocusVisuals(windowEl);
    },

    updateOtherWindows: function (activeWindow) {
        const allWindows = document.querySelectorAll('.window, .widget-window');
        allWindows.forEach(window => {
            if (window !== activeWindow) {
                // Remove focus visual from other windows
                window.classList.remove('window-focused');

                const currentZ = parseInt(window.style.zIndex || this.baseZIndex);
                if (currentZ >= this.topZIndex) {
                    window.style.zIndex = (currentZ - 1).toString();
                }
            }
        });
    },

    updateFocusVisuals: function (windowEl) {
        // Remove focus class from all windows
        document.querySelectorAll('.window, .widget-window').forEach(win => {
            win.classList.remove('window-focused');
        });

        // Add focus class to active window
        windowEl.classList.add('window-focused');
    },

    setupWindow: function (windowEl) {
        // Set initial z-index
        windowEl.style.zIndex = (++this.topZIndex).toString();

        // Add focus handlers for the entire window
        windowEl.addEventListener('mousedown', (e) => {
            // Only handle if clicking the window itself or header
            if (e.target.closest('.window-header') || e.target === windowEl) {
                this.bringToFront(windowEl);
            }
        });

        // Focus on header drag start
        const header = windowEl.querySelector('.window-header');
        if (header) {
            header.addEventListener('mousedown', (e) => {
                // Ignore clicks on control buttons
                if (!e.target.closest('.window-controls')) {
                    this.bringToFront(windowEl);
                }
            });
        }

        // Make window focused when created
        this.bringToFront(windowEl);
    }
};
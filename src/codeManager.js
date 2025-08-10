/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
console.log('Loading Code Manager...');

class CodeManager {
    constructor() {

        if (window.codeManager instanceof CodeManager) {
            console.log('Returning existing CodeManager instance');
            return window.codeManager;
        }

        this.windows = new Map();
        this.tabs = new Map();
        this.currentTab = null;
        this.editors = new Map();
        this.initialized = false;

        // Language mappings
        this.languageMap = {
            'js': 'javascript',
            'html': 'htmlmixed',
            'css': 'css',
            'json': 'application/json',
            'md': 'markdown',
            'txt': null
        };

        // this.initialize();
        window.codeManager = this;
        return this;
    }


    async initialize() {
        console.log('Starting CodeManager initialization...');

        if (this.initialized) {
            console.log('CodeManager already initialized');
            return true;
        }

        try {
            // Reset state
            this.editors = new Map();
            this.tabs = new Map();
            this.currentTab = null;

            // Load dependencies first
            const loaded = await this.loadExternalDependencies();
            if (!loaded) {
                throw new Error('Failed to load external dependencies');
            }

            // Verify CodeMirror is available
            if (!this.codeMirror) {
                throw new Error('CodeMirror not available after loading dependencies');
            }

            this.setupEventListeners();
            this.initialized = true;
            console.log('CodeManager initialization complete');
            return true;
        } catch (error) {
            console.error('Error during initialization:', error);
            this.initialized = false;
            return false;
        }
    }

    async loadExternalDependencies() {
        try {
            // Debug start
            console.log('Starting to load dependencies...');

            // Load CodeMirror core
            this.codeMirror = window.electronAPI.requireModule('codemirror');
            if (!this.codeMirror) {
                throw new Error('Failed to load CodeMirror core module');
            }

            // Define all required modules
            const modules = [
                // Modes
                'codemirror/mode/javascript/javascript',
                'codemirror/mode/xml/xml',
                'codemirror/mode/css/css',
                'codemirror/mode/htmlmixed/htmlmixed',

                // Fold addons
                'codemirror/addon/fold/foldcode',
                'codemirror/addon/fold/foldgutter',
                'codemirror/addon/fold/brace-fold',

                // Edit addons
                'codemirror/addon/edit/matchbrackets',
                'codemirror/addon/edit/closebrackets',

                // Search addons
                'codemirror/addon/search/search',
                'codemirror/addon/search/searchcursor',
                'codemirror/addon/dialog/dialog',

                // Hint addons
                'codemirror/addon/hint/show-hint',
                'codemirror/addon/hint/javascript-hint',
                'codemirror/addon/hint/html-hint',
                'codemirror/addon/hint/css-hint',

                // Other addons
                'codemirror/addon/selection/active-line'
            ];

            // Load all modules
            for (const module of modules) {
                try {
                    const loaded = window.electronAPI.requireModule(module);
                    if (!loaded) {
                        console.warn(`Warning: Module ${module} may not have loaded properly`);
                    }
                } catch (err) {
                    console.warn(`Failed to load module ${module}:`, err);
                }
            }

            // Define required styles
            const styles = [
                // Core styles
                'codemirror/lib/codemirror.css',

                // Theme styles
                'codemirror/theme/monokai.css',
                'codemirror/theme/dracula.css',
                'codemirror/theme/material.css',
                'codemirror/theme/material-darker.css',
                'codemirror/theme/nord.css',

                // Addon styles
                'codemirror/addon/fold/foldgutter.css',
                'codemirror/addon/hint/show-hint.css',
                'codemirror/addon/dialog/dialog.css'
            ];

            // Load all styles
            for (const stylePath of styles) {
                try {
                    const absolutePath = window.electronAPI.resolveModulePath(stylePath);
                    if (absolutePath) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = absolutePath;
                        document.head.appendChild(link);
                    } else {
                        console.warn(`Warning: Could not resolve path for ${stylePath}`);
                    }
                } catch (err) {
                    console.warn(`Failed to load style ${stylePath}:`, err);
                }
            }

            // Verify CodeMirror initialization
            console.log('CodeMirror initialization check:', {
                hasCodeMirror: !!this.codeMirror,
                codeMirrorType: typeof this.codeMirror,
                hasConstructor: typeof this.codeMirror === 'function',
                availableMethods: Object.keys(this.codeMirror)
            });

            return true;

        } catch (error) {
            console.error('Error in loadExternalDependencies:', error);
            throw new Error(`Failed to load dependencies: ${error.message}`);
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

            // Refresh editor on resize
            if (this.currentTab) {
                const editor = this.editors.get(this.currentTab.id);
                if (editor) editor.refresh();
            }
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
            panel.style.transition = '';
        });
    }


    setupToolbarHandlers(panel) {
        // Give DOM time to be ready
        setTimeout(() => {
            if (!panel) {
                console.error('Panel not found for toolbar setup');
                return;
            }

            const toolbar = panel.querySelector('.toolbar');
            if (!toolbar) {
                console.error('Toolbar not found in panel');
                return;
            }

            const buttons = {
                newTabBtn: { element: toolbar.querySelector('#newTabBtn'), handler: () => this.newTab() },
                openFileBtn: { element: toolbar.querySelector('#openFileBtn'), handler: () => this.openFile() },
                saveFileBtn: { element: toolbar.querySelector('#saveFileBtn'), handler: () => this.saveCurrentTab() },
                formatBtn: { element: toolbar.querySelector('#formatBtn'), handler: () => this.formatCode() },
                runBtn: { element: toolbar.querySelector('#runBtn'), handler: () => this.runCurrentCode() },

            };

            const themeSelect = panel.querySelector('#themeSelect');
            if (themeSelect) {
                themeSelect.addEventListener('change', (e) => {
                    this.applyTheme(e.target.value);
                });
            }

            // Set up event listeners
            Object.entries(buttons).forEach(([id, { element, handler, type = 'click' }]) => {
                if (element) {
                    element.addEventListener(type, handler);
                } else {
                    console.warn(`Button ${id} not found in toolbar`);
                }
            });
        }, 100);
    }

    applyThemeToEditors(theme) {
        this.editors.forEach(editor => {
            if (editor && typeof editor.setOption === 'function') {
                try {
                    editor.setOption('theme', theme);
                } catch (error) {
                    console.error('Error setting editor theme:', error);
                }
            }
        });
    }


    // Window control methods
    minimizeEditor() {
        const panel = this.windows.get('code-editor');
        if (panel) {
            panel.style.display = 'none';
            windows.get('code-editor').minimized = true;
            DockManager.renderDock();
        }
    }

    closeEditor() {
        const panel = this.windows.get('code-editor');
        if (panel) {
            panel.remove();
            this.windows.delete('code-editor');
            windows.delete('code-editor');
            DockManager.renderDock();
        }
    }

    toggleDevTools() {
        window.electronAPI.send('toggle-dev-tools');
    }

    // In CodeManager class

    createEditorWindow() {
        const windowId = 'code-editor';

        // If window exists, show it and return
        const existingWindow = this.windows.get(windowId);
        if (existingWindow) {
            existingWindow.style.display = 'block';
            WindowManager.bringToFront(existingWindow);
            return existingWindow;
        }

        console.log('Creating new code editor window...');

        // Create window HTML
        const windowHtml = `
        <div class="window" id="${windowId}">
            <div class="window-header">
                <div class="window-title">
                    <span class="material-symbols-outlined">jump_to_element</span>
                    Code Editor
                </div>
                <div class="window-controls">
                    <button class="dev-tools-btn" title="Developer Tools">
                        <span class="material-symbols-outlined">jump_to_element</span>
                    </button>
                    <button class="minimize-btn" title="Minimize">
                        <span class="material-symbols-outlined">remove</span>
                    </button>
                    <button class="close-btn" title="Close">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
            </div>
            <div class="editor-container">
                <div class="toolbar">
                    <button id="newTabBtn">
                        <span class="material-symbols-outlined">add</span>
                    </button>
                    <button id="openFileBtn">
                        <span class="material-symbols-outlined">folder_open</span>
                    </button>
                    <button id="saveFileBtn">
                        <span class="material-symbols-outlined">save</span>
                    </button>
                    <button id="formatBtn" title="Format Code">
                        <span class="material-symbols-outlined">format_align_left</span>
                    </button>
                    <select id="themeSelect" class="theme-select">
                        <option value="monokai">Monokai</option>
                        <option value="dracula">Dracula</option>
                        <option value="material">Material</option>
                        <option value="material-darker">Material Dark</option>
                        <option value="nord">Nord</option>
                    </select>
                    <button id="runBtn" title="Run Code" class="run-button">
                        <span class="material-symbols-outlined">play_arrow</span>
                    </button>
                    <span id="fileType" class="file-type">No file</span>
                </div>
                <div class="tab-bar" id="tabBar"></div>
                <div class="tab-content" id="tabContent"></div>
            </div>
            <div class="resize-handle"></div>
        </div>
    `;

        document.body.insertAdjacentHTML('beforeend', windowHtml);
        const panel = document.getElementById(windowId);

        // Set initial size and position
        panel.style.width = '1000px';
        panel.style.height = '600px';
        panel.style.left = '50px';
        panel.style.top = '50px';

        // Setup window controls and handlers
        this.setupWindowControls(panel);
        this.setupToolbarHandlers(panel);
        makeDraggable(panel);
        this.setupResizing(panel);

        // Register with window management
        windows.set(windowId, {
            title: 'Code Editor',
            minimized: false,
            isWidget: false
        });

        this.windows.set(windowId, panel);

        // Initialize CodeManager if needed
        if (!this.initialized) {
            console.log('CodeManager not initialized, initializing...');
            this.initialize().then(() => {
                console.log('Creating first tab after initialization...');
                this.newTab().then(() => {
                    console.log('First tab created successfully');
                }).catch(err => {
                    console.error('Error creating first tab:', err);
                });
            }).catch(err => {
                console.error('Error initializing CodeManager:', err);
            });
        } else {
            console.log('Creating first tab...');
            this.newTab().catch(err => {
                console.error('Error creating first tab:', err);
            });
        }

        // Apply current theme
        this.applyCurrentTheme();

        // Bring window to front
        WindowManager.bringToFront(panel);

        return panel;
    }

    setupWindowControls(panel) {
        // Get control buttons
        const devToolsBtn = panel.querySelector('.dev-tools-btn');
        const minimizeBtn = panel.querySelector('.minimize-btn');
        const closeBtn = panel.querySelector('.close-btn');

        // Bind event handlers with proper 'this' context
        if (devToolsBtn) {
            devToolsBtn.addEventListener('click', () => this.toggleDevTools());
        }

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.minimizeEditor());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeEditor());
        }
    }



    async newTab(name = 'Untitled', content = '', path = null) {
        console.log('Creating new tab:', { name, path });

        // Ensure initialization
        if (!this.initialized) {
            console.log('CodeManager not initialized, initializing...');
            const initialized = await this.initialize();
            if (!initialized) {
                console.error('Failed to initialize CodeManager');
                return null;
            }
        }

        const tabId = `tab-${Date.now()}`;
        const language = this.detectLanguage(name);

        const tab = {
            id: tabId,
            name: name,
            content: content,
            path: path,
            isUnsaved: false,
            language: language
        };

        try {
            // Create tab elements first
            const elementsCreated = await this.createTabElements(tab);
            if (!elementsCreated) {
                throw new Error('Failed to create tab elements');
            }

            // Store tab info
            this.tabs.set(tabId, tab);
            this.currentTab = tab;

            // Initialize editor
            const editor = await this.initializeEditor(tab);
            if (!editor) {
                throw new Error('Failed to initialize editor');
            }

            // Update UI
            this.updateTabBar();

            // Activate the new tab immediately to ensure proper sizing
            await this.switchToTab(tabId);

            console.log('Tab created successfully:', tabId);
            return tab;
        } catch (error) {
            console.error('Error creating new tab:', error);
            // Cleanup on failure
            this.tabs.delete(tabId);
            if (this.currentTab?.id === tabId) {
                this.currentTab = null;
            }
            return null;
        }
    }

    async switchToTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;

        this.currentTab = tab;

        // Update tab and editor visibility
        document.querySelectorAll('.tab').forEach(el => {
            el.classList.toggle('active', el.getAttribute('data-tab-id') === tabId);
        });

        document.querySelectorAll('.editor').forEach(el => {
            const isActive = el.id === `editor-${tabId}`;
            el.classList.toggle('active', isActive);
            el.style.display = isActive ? 'block' : 'none';
        });

        // Refresh editor
        this.refreshEditor(tabId);

        this.updateFileInfo(tab);
    }

    detectLanguage(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        return this.languageMap[ext] || 'plaintext';
    }

    async createTabElements(tab) {
        try {
            const tabBar = document.getElementById('tabBar');
            const tabContent = document.getElementById('tabContent');

            if (!tabBar || !tabContent) {
                console.error('Tab containers not found');
                return false;
            }

            // Create tab button
            const tabEl = document.createElement('div');
            tabEl.className = `tab ${this.currentTab?.id === tab.id ? 'active' : ''}`;
            tabEl.setAttribute('data-tab-id', tab.id);
            tabEl.innerHTML = `
                <span class="tab-title ${tab.isUnsaved ? 'unsaved' : ''}">${tab.name}</span>
                <button class="close-tab">×</button>
            `;

            // Add click handlers
            tabEl.addEventListener('click', (e) => {
                if (!e.target.matches('.close-tab')) {
                    this.switchToTab(tab.id);
                }
            });

            const closeBtn = tabEl.querySelector('.close-tab');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeTab(tab.id);
                });
            }

            // Create editor container
            const editorContainer = document.createElement('div');
            editorContainer.className = `editor ${this.currentTab?.id === tab.id ? 'active' : ''}`;
            editorContainer.id = `editor-${tab.id}`;

            // Add elements to DOM
            tabBar.appendChild(tabEl);
            tabContent.appendChild(editorContainer);

            return true;
        } catch (error) {
            console.error('Error creating tab elements:', error);
            return false;
        }
    }



    checkEditorCapabilities(editor) {
        if (!editor) return false;

        // Add missing methods if necessary
        if (!editor.getValue) {
            editor.getValue = function () {
                if (this.state && this.state.doc) {
                    return this.state.doc.toString();
                }
                return this.display.view.map(line => line.text).join('\n');
            };
        }

        if (!editor.setValue) {
            editor.setValue = function (value) {
                const lines = value.split('\n');
                this.display.view = lines.map(text => ({ text }));
                if (this.state && this.state.doc) {
                    this.state.doc = value;
                }
                this.refresh();
            };
        }

        if (!editor.refresh) {
            editor.refresh = function () {
                try {
                    // Force redraw of editor content
                    this.display.input.reset(true);
                    this.display.update(true);
                    this.display.scrollbars.update(true);

                    // Refresh syntax highlighting
                    this.operation(() => {
                        for (let i = 0; i < this.display.viewTo; i++) {
                            if (this.display.view[i]) {
                                this.display.view[i].node.className = this.display.view[i].node.className;
                            }
                        }
                    });
                } catch (e) {
                    console.warn('Basic refresh failed, trying alternative:', e);
                    // Alternative refresh method
                    if (this.display && this.display.wrapper) {
                        const wrapper = this.display.wrapper;
                        wrapper.style.display = 'none';
                        setTimeout(() => wrapper.style.display = '', 1);
                    }
                }
            };
        }

        return true;
    }


    async initializeEditor(tab) {
        try {
            const editorContainer = document.getElementById(`editor-${tab.id}`);
            if (!editorContainer) {
                console.error('Editor container not found');
                return null;
            }

            let editor;
            try {
                // Basic initialization
                editor = this.codeMirror(editorContainer, {
                    value: tab.content || '',
                    mode: tab.language || 'javascript',
                    theme: 'monokai',
                    lineNumbers: true,
                    lineWrapping: false,
                    matchBrackets: true,
                    autoCloseBrackets: true,
                    styleActiveLine: true,
                    foldGutter: true,
                    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]
                });

                // Ensure all necessary methods exist
                if (!editor.getValue) {
                    editor.getValue = function () {
                        if (this.display && this.display.view) {
                            return this.display.view.map(line => line.text).join('\n');
                        }
                        return '';
                    };
                }

                if (!editor.setValue) {
                    editor.setValue = function (value) {
                        const lines = value.split('\n');
                        this.display.view = lines.map(text => ({ text }));
                    };
                }

                if (!editor.refresh) {
                    editor.refresh = function () {
                        if (this.display) {
                            try {
                                // Try to force a redraw of content
                                this.display.wrapper.style.display = 'none';
                                void this.display.wrapper.offsetHeight; // Force reflow
                                this.display.wrapper.style.display = '';
                            } catch (e) {
                                console.warn('Basic refresh failed:', e);
                            }
                        }
                    };
                }

                // Store editor instance
                this.editors.set(tab.id, editor);

                // Initial content setup if provided
                if (tab.content) {
                    editor.setValue(tab.content);
                }

                return editor;

            } catch (error) {
                console.error('Error creating editor:', error);
                return null;
            }

        } catch (error) {
            console.error('Error in initializeEditor:', error);
            return null;
        }
    }

    highlightSyntax(line) {
        // Basic syntax highlighting
        return line
            .replace(/(".*?")/g, '<span class="minimap-string">$1</span>')
            .replace(/('.*?')/g, '<span class="minimap-string">$1</span>')
            .replace(/\b(function|return|if|else|for|while|var|let|const)\b/g,
                '<span class="minimap-keyword">$1</span>')
            .replace(/\b(\d+)\b/g, '<span class="minimap-number">$1</span>')
            .replace(/(\/\/.*$)/g, '<span class="minimap-comment">$1</span>');
    }



    updateMinimapContent(editor, minimap) {
        try {
            // Direct access to editor content
            const content = editor.display.view.map(line => line.text).join('\n');
            const lines = content.split('\n');
            const minimapContent = lines
                .map(line => `<div class="minimap-line">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    }</div>`)
                .join('');
            minimap.innerHTML = minimapContent;
        } catch (e) {
            console.warn('Error updating minimap:', e);
        }
    }


    updateMinimap(editor) {
        try {
            if (!editor) return;

            const minimap = editor.getWrapperElement().querySelector('.minimap');
            if (!minimap) return;

            const content = editor.getValue();
            const lines = content.split('\n');

            // Clear existing content
            minimap.innerHTML = '';

            // Create lines container
            const linesContainer = document.createElement('div');
            linesContainer.className = 'minimap-lines';

            // Process each line
            lines.forEach((line, index) => {
                const lineElement = document.createElement('div');
                lineElement.className = 'minimap-line';

                // Get syntax highlighting information from CodeMirror
                const lineInfo = editor.getLineHandle(index);
                if (lineInfo && editor.getLineTokens) {
                    const tokens = editor.getLineTokens(index);
                    let lineContent = '';

                    tokens.forEach(token => {
                        const tokenText = token.string.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        if (token.type) {
                            lineContent += `<span class="cm-${token.type}">${tokenText}</span>`;
                        } else {
                            lineContent += tokenText;
                        }
                    });

                    lineElement.innerHTML = lineContent || '&nbsp;';
                } else {
                    // Fallback if token information is not available
                    lineElement.textContent = line || ' ';
                }

                linesContainer.appendChild(lineElement);
            });

            minimap.appendChild(linesContainer);
            this.syncMinimapScroll(editor);

        } catch (e) {
            console.warn('Error updating minimap:', e);
        }
    }

    syncMinimapScroll(editor) {
        const minimap = editor.getWrapperElement().querySelector('.minimap');
        if (!minimap) return;

        const info = editor.getScrollInfo();
        const ratio = info.top / (info.height - info.clientHeight);
        const minimapHeight = minimap.clientHeight;
        const minimapContent = minimap.firstElementChild;
        if (!minimapContent) return;

        const scrollableHeight = minimapContent.clientHeight - minimapHeight;

        if (scrollableHeight > 0) {
            minimapContent.style.transform = `translateY(-${ratio * scrollableHeight}px)`;
        }
    }

    enableMinimap(editor) {
        if (!editor) return;

        try {
            // Create minimap container
            const wrapper = editor.getWrapperElement();
            const minimap = document.createElement('div');
            minimap.className = 'minimap';
            wrapper.appendChild(minimap);

            // Update minimap content
            const updateMinimap = () => {
                const content = editor.getValue();
                const lines = content.split('\n');
                minimap.innerHTML = lines
                    .map(line => `<div class="minimap-line">${line}</div>`)
                    .join('');
            };

            editor.on('change', updateMinimap);
            updateMinimap();
        } catch (error) {
            console.warn('Minimap initialization failed:', error);
        }
    }


    // Add this helper method to verify editor instances
    verifyEditor(editor) {
        if (!editor) {
            console.error('Null or undefined editor instance');
            return false;
        }

        const expectedMethods = ['getValue', 'setValue', 'refresh', 'focus'];
        const missingMethods = expectedMethods.filter(method => typeof editor[method] !== 'function');

        if (missingMethods.length > 0) {
            console.warn('Editor missing methods:', missingMethods);
            return false;
        }

        return true;
    }

    async closeTab(tabId) {
        try {
            const tabs = Array.from(this.tabs.keys());
            const currentIndex = tabs.indexOf(tabId);

            if (currentIndex === -1) {
                console.warn('Tab not found for closing:', tabId);
                return;
            }

            const tab = this.tabs.get(tabId);

            // Remove tab elements
            const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
            const editorElement = document.getElementById(`editor-${tabId}`);

            if (tabElement) tabElement.remove();
            if (editorElement) editorElement.remove();

            // Clean up editor instance
            const editor = this.editors.get(tabId);
            if (editor) {
                try {
                    const wrapper = editor.getWrapperElement();
                    if (wrapper && wrapper.parentNode) {
                        wrapper.parentNode.removeChild(wrapper);
                    }
                } catch (e) {
                    console.warn('Editor cleanup warning:', e);
                }
            }

            // Remove from collections
            this.editors.delete(tabId);
            this.tabs.delete(tabId);

            // Determine which tab to activate next
            if (tabs.length > 1) {
                let nextTabId;

                if (currentIndex === tabs.length - 1) {
                    // If closing last tab, go to previous
                    nextTabId = tabs[currentIndex - 1];
                } else if (currentIndex === 0) {
                    // If closing first tab, go to next
                    nextTabId = tabs[1];
                } else {
                    // If closing middle tab, go to previous
                    nextTabId = tabs[currentIndex - 1];
                }

                if (nextTabId) {
                    await this.switchToTab(nextTabId);
                }
            } else {
                // If no tabs left, create a new one
                await this.newTab();
            }

            console.log('Tab closed successfully:', tabId);

        } catch (error) {
            console.error('Error closing tab:', error);
        }
    }

    updateTabBar() {
        const tabBar = document.getElementById('tabBar');
        if (!tabBar) return;

        // Update tab appearances
        this.tabs.forEach(tab => {
            const tabEl = document.querySelector(`[data-tab-id="${tab.id}"]`);
            if (tabEl) {
                const nameSpan = tabEl.querySelector('span');
                nameSpan.className = tab.isUnsaved ? 'unsaved' : '';
                nameSpan.textContent = tab.name;
            }
        });
    }

    updateFileInfo(tab) {
        try {
            const fileType = document.getElementById('fileType');
            if (!fileType) return;

            const editor = this.editors.get(tab.id);
            if (!editor) {
                fileType.textContent = `${tab.language?.toUpperCase() || 'TEXT'}`;
                return;
            }

            // Try to get cursor position if available
            let cursorInfo = '';
            try {
                if (typeof editor.getCursor === 'function') {
                    const pos = editor.getCursor();
                    cursorInfo = ` | Ln ${pos.line + 1}, Col ${pos.ch + 1}`;
                }
            } catch (e) {
                console.warn('Cursor position not available:', e);
            }

            fileType.textContent = `${tab.language?.toUpperCase() || 'TEXT'}${cursorInfo}`;
        } catch (error) {
            console.warn('Error updating file info:', error);
        }
    }

    updateCursorInfo(line, column) {
        const fileType = document.getElementById('fileType');
        if (fileType && this.currentTab) {
            fileType.textContent = `${this.currentTab.language.toUpperCase()} | Ln ${line}, Col ${column}`;
        }
    }



    async showUnsavedChangesDialog(tab) {
        return new Promise((resolve) => {
            const result = confirm(`${tab.name} has unsaved changes. Close anyway?`);
            resolve(result);
        });
    }

    closeWindow() {
        console.log('Closing code editor window...');
        const win = document.getElementById('code-editor');
        if (win) {
            // Clean up editors
            this.editors.forEach((editor, tabId) => {
                try {
                    console.log('Cleaning up editor:', tabId);
                    if (editor) {
                        // Clean up editor instance
                        const wrapper = editor.getWrapperElement();
                        if (wrapper && wrapper.parentNode) {
                            wrapper.parentNode.removeChild(wrapper);
                        }
                    }
                } catch (error) {
                    console.warn(`Error cleaning up editor ${tabId}:`, error);
                }
            });

            // Reset state
            this.editors.clear();
            this.tabs.clear();
            this.currentTab = null;
            this.initialized = false; // Force reinitialization on next open

            // Remove window
            win.remove();
            windows.delete('code-editor');
            this.windows.delete('code-editor');

            console.log('Code editor cleanup complete');
        }
    }

    async checkInitialization() {
        if (!this.initialized) {
            await this.initialize();
        }
        return this.initialized;
    }


    async openFile() {
        try {
            const result = await window.electronAPI.openFileDialog({
                filters: [
                    { name: 'Code Files', extensions: ['js', 'html', 'css', 'json', 'md', 'txt'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (result && result.path) {
                console.log('File opened:', result.path);
                const content = result.content;
                const fileName = result.path.split(/[/\\]/).pop();

                // Check if file is already open
                const existingTab = Array.from(this.tabs.values())
                    .find(tab => tab.path === result.path);

                if (existingTab) {
                    await this.switchToTab(existingTab.id);
                    // Force refresh of existing tab
                    this.refreshEditor(existingTab.id);
                    return;
                }

                // Create new tab with file content
                const tab = await this.newTab(fileName, content, result.path);
                if (tab) {
                    await this.switchToTab(tab.id);
                    // Force refresh of new tab
                    this.refreshEditor(tab.id);
                }
            }
        } catch (error) {
            console.error('Error opening file:', error);
        }
    }

    refreshEditor(tabId) {
        requestAnimationFrame(() => {
            const editor = this.editors.get(tabId);
            if (editor) {
                try {
                    if (editor.display) {
                        editor.display.wrapper.style.display = 'none';
                        void editor.display.wrapper.offsetHeight; // Force reflow
                        editor.display.wrapper.style.display = '';
                    }
                } catch (e) {
                    console.warn('Refresh fallback:', e);
                }
            }
        });
    }


    async saveCurrentTab(saveAs = false) {
        const editor = this.getCurrentEditor();
        if (!editor) return;

        try {
            const content = editor.getValue();

            if (!this.currentTab.path || saveAs) {
                // Show save dialog
                const result = await window.electronAPI.saveFileDialog({
                    defaultPath: this.currentTab.path || this.currentTab.name,
                    filters: [
                        { name: 'Code Files', extensions: ['js', 'html', 'css', 'json', 'md', 'txt'] }
                    ]
                });

                if (result?.filePath) {
                    this.currentTab.path = result.filePath;
                    this.currentTab.name = result.filePath.split(/[/\\]/).pop();
                    await window.electronAPI.writeFile(result.filePath, content);

                    // Update tab language based on new file extension
                    const ext = result.filePath.split('.').pop()?.toLowerCase();
                    this.currentTab.language = this.languageMap[ext] || 'plaintext';

                    // Update editor mode if needed
                    const editor = this.editors.get(this.currentTab.id);
                    if (editor && editor.setOption) {
                        editor.setOption('mode', this.currentTab.language);
                    }
                }
            } else {
                await window.electronAPI.writeFile(this.currentTab.path, content);
            }

            this.currentTab.isUnsaved = false;
            this.updateTabBar();
            this.showSuccess('File saved successfully');

        } catch (error) {
            console.error('Error saving file:', error);
            this.showError('Save Error', error.message);
        }
    }


    async runCurrentCode() {
        try {
            const editor = this.getCurrentEditor();
            if (!editor) {
                throw new Error('No active editor found');
            }

            const content = editor.getValue();
            if (content === undefined) {
                throw new Error('Could not get editor content');
            }

            const currentTab = this.currentTab;
            if (!currentTab) {
                throw new Error('No active tab found');
            }

            // Log state for debugging
            console.log('Running code with:', {
                tabId: currentTab.id,
                language: currentTab.language,
                contentLength: content?.length,
                editor: !!editor
            });

            switch (currentTab.language) {
                case 'javascript':
                    await this.runJavaScript(content, currentTab.name, currentTab.path);
                    break;
                case 'html':
                case 'htmlmixed':
                    await this.runHTML(content, currentTab.name, currentTab.path);
                    break;
                case 'css':
                    this.showError('Cannot run CSS directly', 'CSS files need to be linked to HTML.');
                    break;
                default:
                    this.showError('Unsupported file type', `Cannot run ${currentTab.language} files directly.`);
            }
        } catch (error) {
            console.error('Error running code:', error);
            this.showError('Runtime Error', error.message);
        }
    }

    async runJavaScript(code, fileName) {
        try {
            // Create a new window for output
            const windowId = await window.electronAPI.createWindow(
                `Run: ${fileName}`,
                `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Run: ${fileName}</title>
                    <style>
                        body {
                            background: var(--window-bg);
                            color: var(--text-color);
                            font-family: monospace;
                            padding: 20px;
                            margin: 0;
                        }
                        .output {
                            white-space: pre-wrap;
                            word-wrap: break-word;
                        }
                        .error {
                            color: #ff5555;
                        }
                    </style>
                </head>
                <body>
                    <div class="output"></div>
                    <script>
                        // Capture console output
                        const output = document.querySelector('.output');
                        const originalConsole = { ...console };
                        
                        function log(type, ...args) {
                            const line = document.createElement('div');
                            line.className = type;
                            line.textContent = args.map(arg => 
                                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
                            ).join(' ');
                            output.appendChild(line);
                            originalConsole[type](...args);
                        }

                        console.log = (...args) => log('log', ...args);
                        console.error = (...args) => log('error', ...args);
                        console.warn = (...args) => log('warn', ...args);
                        console.info = (...args) => log('info', ...args);

                        try {
                            ${code}
                        } catch (error) {
                            console.error('Runtime Error:', error.message);
                            console.error(error.stack);
                        }
                    </script>
                </body>
                </html>
                `,
                { x: 50, y: 50 }
            );

            // Launch terminal with Node.js if needed
            if (code.includes('require(') || code.includes('process.')) {
                await this.runInTerminal(code, fileName);
            }
        } catch (error) {
            throw new Error(`Failed to run JavaScript: ${error.message}`);
        }
    }


    async runHTML(code, fileName, filePath) {
        try {
            const windowId = `preview-${Date.now()}`;

            // If we have a file path, read the file from disk
            let contentToRun = code;
            if (filePath) {
                try {
                    contentToRun = await window.electronAPI.readFile(filePath);
                } catch (error) {
                    console.warn('Could not read file from disk, using editor content:', error);
                }
            }

            const windowHtml = this.createPreviewWindowHtml(windowId, fileName);
            document.body.insertAdjacentHTML('beforeend', windowHtml);
            const panel = document.getElementById(windowId);

            // Set up window
            this.setupPreviewWindow(panel, windowId, fileName);

            // Update preview content
            await this.updatePreviewContent(windowId, contentToRun, filePath);

            // Apply theme
            const currentTheme = await window.getCurrentTheme();
            if (currentTheme) {
                const titlebar = panel.querySelector('.window-header');
                if (titlebar) {
                    updateTitlebarStyle(titlebar, currentTheme, false);
                }
            }

            WindowManager.bringToFront(panel);

        } catch (error) {
            console.error('Error creating preview:', error);
            throw error;
        }
    }


    createPreviewWindowHtml(windowId, fileName) {
        return `
            <div class="window" id="${windowId}">
                <div class="window-header">
                    <div class="window-title">
                        <span class="material-symbols-outlined">preview</span>
                        Preview: ${fileName}
                    </div>
                    <div class="window-controls">
                        <button onclick="codeManager.refreshPreview('${windowId}')" title="Refresh Preview">
                            <span class="material-symbols-outlined">refresh</span>
                        </button>
                        <button onclick="minimizeWindow('${windowId}')" title="Minimize">
                            <span class="material-symbols-outlined">remove</span>
                        </button>
                        <button onclick="closeWindow('${windowId}')" title="Close">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
                <div class="preview-container">
                    <div id="preview-content-${windowId}" class="preview-content"></div>
                </div>
                <div class="resize-handle"></div>
            </div>
        `;
    }


    async setupPreviewWindow(panel, windowId, fileName) {
        // Set initial size and position
        panel.style.width = '80vw';  // 80% of viewport width
        panel.style.height = '80vh'; // 80% of viewport height
        panel.style.left = '10vw';   // Center horizontally
        panel.style.top = '10vh';    // Center vertically

        // Make window draggable and snappable
        makeDraggable(panel);
        this.setupResizing(panel);

        // Register with window management
        windows.set(windowId, {
            title: `Preview: ${fileName}`,
            minimized: false,
            isWidget: false,
            sourceTabId: this.currentTab?.id
        });

        // Ensure preview container takes full height
        const previewContainer = panel.querySelector('.preview-container');
        if (previewContainer) {
            previewContainer.style.height = 'calc(100% - 40px)'; // Adjust for header height
        }
    }


    // In runHTML method, update the htmlContent construction
    async updatePreviewContent(windowId, content, filePath) {
        try {
            const container = document.getElementById(`preview-content-${windowId}`);
            if (!container) {
                console.warn('No content container found');
                return;
            }

            // Set container styles explicitly
            container.style.cssText = `
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
            `;

            // Create webview with specific styles that should propagate to shadow DOM
            const webview = document.createElement('webview');
            webview.setAttribute('webpreferences', 'contextIsolation=yes');
            webview.setAttribute('nodeintegration', '');

            // Set explicit styles that should influence the shadow DOM
            webview.style.cssText = `
                display: flex !important;
                flex: 1 1 auto !important;
                width: 100% !important;
                height: 100% !important;
                border: 0 !important;
            `;

            // Clear container and add webview
            container.innerHTML = '';
            container.appendChild(webview);

            // Set source based on whether we have a file path
            if (filePath) {
                webview.src = `file://${filePath}`;
            } else {
                const htmlContent = `
                    <!DOCTYPE html>
                    <html style="height: 100%;">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <meta http-equiv="Content-Security-Policy" content="
                                default-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:;
                                script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:;
                                style-src 'self' 'unsafe-inline' https: http:;
                                img-src 'self' data: https: http:;
                                font-src 'self' https: http:;
                                connect-src 'self' https: http:;
                            ">
                            <style>
                                html, body {
                                    width: 100%;
                                    height: 100%;
                                    margin: 0;
                                    padding: 0;
                                    display: flex;
                                    flex-direction: column;
                                }
                            </style>
                        </head>
                        <body>${content}</body>
                    </html>
                `;
                webview.src = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
            }

            // Add load event listener to ensure styles are applied
            webview.addEventListener('dom-ready', () => {
                // This injects a style tag into the webview to ensure proper sizing
                webview.insertCSS(`
                    :host {
                        display: flex !important;
                        flex: 1 1 auto !important;
                        height: 100% !important;
                    }
                    iframe {
                        flex: 1 1 auto !important;
                        width: 100% !important;
                        height: 100% !important;
                        border: 0 !important;
                    }
                `);
            });

        } catch (error) {
            console.error('Error updating preview:', error);
            container.innerHTML = `
                <div class="preview-error">
                    <span class="material-symbols-outlined">error</span>
                    <h3>Error Previewing Content</h3>
                    <pre>${error.message}</pre>
                </div>
            `;
        }
    }



    async refreshPreview(windowId) {
        try {
            const previewData = await window.electronAPI.store.get(`preview-${windowId}`);
            if (!previewData?.sourceTabId) {
                console.warn('No source tab ID found for preview:', windowId);
                return;
            }

            // Get current code from editor
            const editor = this.editors.get(previewData.sourceTabId);
            if (!editor) {
                console.warn('No editor found for source tab:', previewData.sourceTabId);
                return;
            }

            console.log('Refreshing preview with new code from editor');
            const currentCode = editor.getValue();

            // Update store
            await window.electronAPI.store.set(`preview-${windowId}`, {
                ...previewData,
                code: currentCode,
                timestamp: Date.now()
            });

            // Update preview
            await this.updatePreviewContent(windowId);

        } catch (error) {
            console.error('Error refreshing preview:', error);
        }
    }

    // Add cleanup when closing window
    async cleanupPreview(windowId) {
        try {
            await window.electronAPI.store.delete(`preview-${windowId}`);
        } catch (error) {
            console.error('Error cleaning up preview:', error);
        }
    }

    async runInTerminal(code, fileName) {
        // Save to temporary file
        const tempFile = `temp-${Date.now()}.js`;
        await window.electronAPI.writeFile(tempFile, code);

        // Launch terminal if not exists
        if (!window.terminalManager) {
            console.error('Terminal manager not available');
            return;
        }

        // Show terminal and run code
        window.terminalManager.show();
        await window.terminalManager.executeCommand(`node "${tempFile}"`);

        // Clean up temp file after a delay
        setTimeout(async () => {
            try {
                await window.electronAPI.deleteFile(tempFile);
            } catch (error) {
                console.error('Error cleaning up temp file:', error);
            }
        }, 1000);
    }

    // UI Feedback
    showError(title, message) {
        // You can enhance this with a proper error dialog
        alert(`${title}\n${message}`);
    }

    showSuccess(message) {
        const fileType = document.getElementById('fileType');
        if (fileType) {
            const originalText = fileType.textContent;
            fileType.textContent = message;
            setTimeout(() => {
                fileType.textContent = originalText;
            }, 2000);
        }
    }



    async applyCurrentTheme() {
        try {
            const currentTheme = await window.getCurrentTheme();
            if (!currentTheme) return;

            const panel = this.windows.get('code-editor');
            if (!panel) {
                console.error('No editor panel found');
                return;
            }

            // Apply theme to window
            const titlebar = panel.querySelector('.window-header');
            if (titlebar) {
                updateTitlebarStyle(titlebar, currentTheme, false);
            }

            // Apply theme to editors
            const editorTheme = 'monokai'; // or get from settings
            this.applyThemeToEditors(editorTheme);

        } catch (error) {
            console.error('Error applying theme:', error);
        }
    }

    applyTheme(themeName) {
        const editor = this.getCurrentEditor();
        if (!editor) return;

        try {
            editor.setOption('theme', themeName);
            console.log(`Theme '${themeName}' applied to editor`);
        } catch (error) {
            console.error('Error applying theme:', error);
        }
    }

    applyEditorTheme(theme) {
        // Map app theme to CodeMirror theme
        const themeMap = {
            'default': 'monokai',
            'light': 'default',
            'dark': 'material-darker',
            'dracula': 'dracula',
            'nord': 'nord'
        };

        // Get the selected editor theme
        const themeSelect = document.getElementById('themeSelect');
        const editorTheme = themeSelect ? themeSelect.value : 'monokai';

        // Apply theme to all editors
        this.editors.forEach(editor => {
            editor.setOption('theme', editorTheme);

            // Update editor-specific elements
            const wrapper = editor.getWrapperElement();
            wrapper.style.backgroundColor = theme.colors.normalWindow + 'F2';

            // Update gutter colors
            const gutters = wrapper.querySelector('.CodeMirror-gutters');
            if (gutters) {
                gutters.style.backgroundColor = theme.colors.normalWindow + 'F2';
                gutters.style.borderRight = `1px solid ${theme.colors.accent}33`;
            }

            // Refresh editor to ensure proper rendering
            editor.refresh();
        });
    }

    updateToolbarTheme(theme) {
        const toolbar = document.querySelector('.toolbar');
        if (!toolbar) return;

        // Update toolbar background
        toolbar.style.backgroundColor = theme.colors.normalWindow + 'F2';
        toolbar.style.borderBottom = `1px solid ${theme.colors.accent}33`;

        // Update buttons
        toolbar.querySelectorAll('button').forEach(button => {
            button.style.color = theme.colors.text;
            button.style.borderColor = theme.colors.accent + '33';
        });

        // Update theme selector
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.style.backgroundColor = theme.colors.normalWindow + 'F2';
            themeSelect.style.color = theme.colors.text;
            themeSelect.style.borderColor = theme.colors.accent + '33';
        }
    }




    getCurrentEditor() {
        try {
            if (!this.currentTab) {
                console.warn('No current tab selected');
                return null;
            }

            const editor = this.editors.get(this.currentTab.id);
            if (!editor) {
                console.warn('No editor instance found for current tab:', this.currentTab.id);
                return null;
            }

            return editor;
        } catch (error) {
            console.error('Error in getCurrentEditor:', error);
            return null;
        }
    }

    async formatCode() {
        const editor = this.getCurrentEditor();
        if (!editor) return;

        try {
            const code = editor.getValue();
            let formatted = code;

            // Basic formatting based on language
            switch (this.currentTab.language) {
                case 'javascript':
                    formatted = await this.formatJavaScript(code);
                    break;
                case 'html':
                case 'htmlmixed':
                    formatted = await this.formatHTML(code);
                    break;
                case 'css':
                    formatted = await this.formatCSS(code);
                    break;
            }

            // Apply formatted code
            editor.setValue(formatted);

            // Auto-indent
            const lineCount = editor.lineCount();
            for (let i = 0; i < lineCount; i++) {
                if (typeof editor.indentLine === 'function') {
                    editor.indentLine(i);
                }
            }

            this.showSuccess('Code formatted');
        } catch (error) {
            console.error('Error formatting code:', error);
            this.showError('Format Error', error.message);
        }
    }

    formatIndentation(code) {
        const lines = code.split('\n');
        let indent = 0;
        const formatted = lines.map(line => {
            // Trim trailing whitespace
            line = line.trimEnd();

            // Decrease indent for lines that end a block
            if (line.match(/^[\t ]*(}|\)|\]|<\/.+>)[\t ]*$/)) {
                indent = Math.max(0, indent - 1);
            }

            // Add indentation
            const formatted = '    '.repeat(indent) + line.trim();

            // Increase indent for lines that start a block
            if (line.match(/[\t ]*({\([<]|\{|\(|\[|<[^/][^>]*>)[\t ]*$/)) {
                indent++;
            }

            return formatted;
        });

        return formatted.join('\n');
    }

    async formatJavaScript(code) {
        try {
            // Simple JS formatting rules
            return code
                // Add space after keywords
                .replace(/\b(if|for|while|switch|catch)\(/g, '$1 (')
                // Add space around operators
                .replace(/([+\-*/%=<>!&|])([\w\d{(/])/g, '$1 $2')
                .replace(/([\w\d})/])([+\-*/%=<>!&|])/g, '$1 $2')
                // Add newline after semicolons (except in for loops)
                .replace(/;(?!\s*(?:\d|\$|\w|\())([^\n])/g, ';\n$1')
                // Add newline after blocks
                .replace(/}(?!\s*(?:else|catch|finally))/g, '}\n')
                // Remove extra newlines
                .replace(/\n\s*\n\s*\n/g, '\n\n');
        } catch (error) {
            throw new Error('JavaScript formatting failed: ' + error.message);
        }
    }

    async formatHTML(code) {
        try {
            // Simple HTML formatting
            const formatted = code
                // Add newline after closing tags
                .replace(/>(\s*)</g, '>\n<')
                // Remove extra whitespace
                .replace(/\s+</g, '<')
                .replace(/>\s+/g, '>')
                // Add newline for self-closing tags
                .replace(/\/>/g, '/>\n');

            return formatted;
        } catch (error) {
            throw new Error('HTML formatting failed: ' + error.message);
        }
    }

    async formatCSS(code) {
        try {
            // Simple CSS formatting
            return code
                // Add newline after closing braces
                .replace(/}(?![\n\s]*$)/g, '}\n\n')
                // Add space after colons
                .replace(/:\s*/g, ': ')
                // Add space after commas
                .replace(/,\s*/g, ', ')
                // Remove extra newlines
                .replace(/\n\s*\n\s*\n/g, '\n\n')
                // Add newline before opening braces
                .replace(/\s*{\s*/g, ' {\n    ')
                // Add newline before closing braces
                .replace(/;\s*}/g, ';\n}');
        } catch (error) {
            throw new Error('CSS formatting failed: ' + error.message);
        }
    }

    setupThemeHandlers() {
        // Theme change listener
        window.addEventListener('themechange', async () => {
            await this.applyCurrentTheme();
        });

        // Editor theme selection
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                const theme = e.target.value;
                this.editors.forEach(editor => {
                    editor.setOption('theme', theme);
                    editor.refresh();
                });
            });
        }

        // Format button
        const formatBtn = document.getElementById('formatBtn');
        if (formatBtn) {
            formatBtn.addEventListener('click', () => this.formatCode());
        }
    }

    // Window Control Methods


    setupEventListeners() {
        // Theme change listener
        window.addEventListener('themechange', async () => {
            await this.applyCurrentTheme();
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.currentTab) return;

            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        this.saveCurrentTab(e.shiftKey);
                        break;
                    case 'o':
                        e.preventDefault();
                        this.openFile();
                        break;
                    case 'r':
                        e.preventDefault();
                        this.runCurrentCode();
                        break;
                }
            }
        });

        // Window resize handling
        window.addEventListener('resize', () => {
            this.windows.forEach(window => {
                if (window.style.display !== 'none') {
                    const editor = this.editors.get(this.currentTab?.id);
                    if (editor) editor.refresh();
                }
            });
        });
    }




}


// Make CodeManager available globally
if (!window.CodeManager) {
    window.CodeManager = CodeManager;
}

if (!window.codeManager) {
    window.codeManager = new CodeManager();
}

console.log('CodeManager availability check:', {
    class: typeof window.CodeManager !== 'undefined',
    instance: typeof window.codeManager !== 'undefined',
    hasCreateEditorWindow: window.codeManager ? typeof window.codeManager.createEditorWindow !== 'undefined' : false
});

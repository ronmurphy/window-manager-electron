/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

// Module manager class
const path = window.electronAPI.path;
const { join, dirname, normalize } = window.electronAPI.path;

class ModuleManager {
    constructor() {
        this.modules = new Map();
        this.widgetsConfig = new Map();
        this.widgetBasePath = 'widgets/';  // Default path
        this.initialize();
    }

    async initialize() {
        console.log('Initializing ModuleManager...');
        try {
            // Get process info if needed
            const processInfo = await window.electronAPI.getProcessInfo();
            const currentDir = await window.electronAPI.getCurrentDirectory();

            console.log('System Info:', {
                currentDir,
                processInfo
            });

            // Load the widget base path first
            this.widgetBasePath = await window.electronAPI.store.get('widgetBasePath') || 'widgets/';
            console.log('Retrieved from store - widgetBasePath:', this.widgetBasePath);

            await Promise.all([
                this.loadModules(),
                this.loadWidgetConfigs()
            ]);
            await this.cleanupWidgetStorage();
            await this.loadAutoStartWidgets();
            console.log('Initialization complete. Loaded widgets:',
                Array.from(this.widgetsConfig.values()));
        } catch (error) {
            console.error('Error during initialization:', error);
        }
    }

    async loadModules() {
        const savedModules = await window.electronAPI.store.get('modules') || [];
        savedModules.forEach(module => {
            this.modules.set(module.id, module);
        });
        this.updateModuleList();
    }

    async saveModules() {
        const moduleArray = Array.from(this.modules.values());
        await window.electronAPI.store.set('modules', moduleArray);
    }

    // Widget Configuration Methods
    async loadWidgetConfigs() {
        try {
            const widgets = await window.electronAPI.store.get('widgets') || [];
            console.log('Loading stored widgets:', widgets);

            widgets.forEach(widget => {
                this.widgetsConfig.set(widget.id, widget);
                this.modules.set(widget.id, {
                    ...widget,
                    type: 'widget'
                });
            });

            this.updateWidgetList();
            return widgets;
        } catch (error) {
            console.error('Error loading widget configs:', error);
            return [];
        }
    }

    async saveWidgetConfigs() {
        try {
            const widgetArray = Array.from(this.widgetsConfig.values());
            // console.log('Saving widgets to store:', widgetArray);

            await window.electronAPI.store.set('widgets', widgetArray);

            this.modules.clear();
            widgetArray.forEach(widget => {
                this.modules.set(widget.id, {
                    ...widget,
                    type: 'widget'
                });
            });

            this.updateModuleList();
            this.updateWidgetList();
        } catch (error) {
            console.error('Error saving widget configs:', error);
        }
    }

    async saveWidgetState(widgetId, state) {
        const widget = this.widgetsConfig.get(widgetId);
        if (!widget) return;

        widget.settings = {
            ...widget.settings,
            ...state
        };
        await this.saveWidgetConfigs();
    }

    async updateWidgetBasePath(newPath) {
        try {
            // Save the new base path
            await window.electronAPI.store.set('widgetBasePath', newPath);

            // Clear and reload widgets with new path
            this.widgetsConfig.clear();
            this.modules.clear();

            // Reload widgets from new location
            await this.loadWidgetConfigs();

            console.log('Widget base path updated to:', newPath);
            return true;
        } catch (error) {
            console.error('Error updating widget base path:', error);
            return false;
        }
    }


    async resolveWidgetPath(relativePath) {
        const appRoot = await window.electronAPI.getAppPath();
        return path.resolve(appRoot, this.widgetBasePath, relativePath);
    }


    async verifyAndSetWidgetPath(newPath) {
        try {
            // Normalize the path
            const normalizedPath = window.electronAPI.path.normalize(newPath);

            // Try to read the directory
            const testPath = await window.electronAPI.testPath(normalizedPath);
            if (!testPath.exists) {
                console.error('Widget path does not exist:', normalizedPath);
                return false;
            }

            // Set the new path
            this.widgetBasePath = normalizedPath;
            await window.electronAPI.store.set('widgetBasePath', normalizedPath);

            console.log('Successfully set widget path to:', normalizedPath);
            return true;
        } catch (error) {
            console.error('Error setting widget path:', error);
            return false;
        }
    }


    // In moduleManager.js, update the addWidget method
    async addWidget(widgetData) {
        console.log('Adding widget:', widgetData);
        const widgetId = widgetData.id || `widget-${Date.now()}`;

        try {
            // Basic path handling first
            const widgetPath = widgetData.path.replace(/\\/g, '/');
            const fullPath = widgetPath.startsWith('widgets/') ? widgetPath : `widgets/${widgetPath}`;

            // Try to load config file but don't require it
            let widgetConfig = {};
            try {
                const configPath = path.join(
                    path.dirname(fullPath),
                    'widget.json'
                );
                console.log('Checking for widget config at:', configPath);
                const configData = await window.electronAPI.readFile(configPath);
                widgetConfig = JSON.parse(configData);
                console.log('Found widget config:', widgetConfig);
            } catch (error) {
                console.log('No widget.json found, using provided data');
                widgetConfig = {
                    settings: {
                        size: { width: 250, height: 100 },
                        autoload: false
                    }
                };
            }

            // Handle both nested and flat config structures
            const size = widgetConfig.settings?.size || widgetConfig.size || { width: 250, height: 100 };
            const autoload = widgetConfig.settings?.autoload ?? widgetConfig.autoload ?? false;
            const position = widgetConfig.settings?.position || widgetConfig.position || { x: 20, y: 20 };

            const widget = {
                id: widgetId,
                name: widgetData.name || widgetConfig.name || 'Unnamed Widget',
                description: widgetData.description || widgetConfig.description || '',
                icon: widgetData.icon || widgetConfig.icon || 'widgets',
                path: fullPath,
                category: widgetData.category || widgetConfig.category || 'Widgets',
                settings: {
                    position: widgetData.position || position,
                    size: widgetData.size || size,
                    autoload: widgetData.autoload || autoload,
                    ...widgetData.settings
                },
                version: widgetConfig.version || widgetData.version || '1.0.0',
                lastUpdated: Date.now()
            };

            // Get current widgets
            const widgets = await window.electronAPI.store.get('widgets') || [];

            // Check for existing widget
            const existingIndex = widgets.findIndex(w =>
                w.name === widget.name || w.path === widget.path
            );

            if (existingIndex !== -1) {
                widgets[existingIndex] = widget;
            } else {
                widgets.push(widget);
            }

            // Save updated widgets list
            await window.electronAPI.store.set('widgets', widgets);

            // Update internal state
            this.widgetsConfig.set(widget.id, widget);
            this.modules.set(widget.id, {
                ...widget,
                type: 'widget'
            });

            console.log('Successfully added/updated widget:', widget);
            return widget;

        } catch (error) {
            console.error('Error adding widget:', error);
            throw error;
        }
    }

    // Add this method to update widget base path
    async setWidgetBasePath(newPath) {
        try {
            this.widgetBasePath = newPath;
            await window.electronAPI.store.set('widgetBasePath', newPath);
            console.log('Updated widget base path to:', newPath);
            return true;
        } catch (error) {
            console.error('Error updating widget base path:', error);
            return false;
        }
    }


    async addModule(moduleData) {
        console.log('Adding module:', moduleData);
        const module = {
            id: moduleData.id || `module-${Date.now()}`,
            name: moduleData.name,
            type: moduleData.type,
            path: moduleData.path,
            category: moduleData.category || 'Uncategorized',
            icon: moduleData.icon || 'web_asset',
            settings: moduleData.settings || {
                position: { x: 100, y: 100 },
                size: { width: 800, height: 600 },
                autoload: false
            }
        };

        this.modules.set(module.id, module);
        await this.saveModules();
        this.updateModuleList();

        if (moduleData.autolaunch) {
            console.log('Auto-launching module:', module);
            this.launchModule(module);
        }

        return module;
    }

    // Launch and Control Methods
    async launchWidget(widgetId) {
        const widgets = await window.electronAPI.store.get('widgets');
        const widget = widgets.find(w => w.id === widgetId);

        if (!widget) {
            console.error('Widget not found:', widgetId);
            return;
        }

        console.log('Launching widget:', widget);
        createWindow(
            widget.name,
            widget.path,
            widget.settings?.position,
            true,
            widgetId
        );
    }

    launchModule(module) {
        console.log('Launching module:', module);
        switch (module.type) {
            case 'widget':
                console.log('Launching widget with path:', module.path);
                try {
                    createWindow(
                        module.name,
                        module.path,
                        module.settings?.position,
                        true
                    );
                } catch (error) {
                    console.error('Error launching widget:', error);
                }
                break;
            case 'local-html':
                createWindow(module.name, module.path, module.settings.position);
                break;
            case 'youtube-embed':
                createWindow(module.name, `https://www.youtube.com/embed/${module.videoId}`, module.settings.position);
                break;
            default:
                console.error('Unknown module type:', module.type);
        }
    }

    // Widget Import and Cleanup Methods
    async importWidgetsFromFolder(showFolderPicker = true) {
        try {
            let folderPath;

            if (showFolderPicker) {
                folderPath = await window.electronAPI.selectFolder();
                if (!folderPath) return false;
            } else {
                folderPath = await window.electronAPI.store.get('lastWidgetFolder');
                if (!folderPath) {
                    alert('No widget folder set. Right-click to select a folder.');
                    return false;
                }
            }

            const widgets = await window.electronAPI.scanWidgetFolder(folderPath);
            console.log('Found widgets in folder:', widgets);

            if (widgets.length > 0) {
                if (showFolderPicker) {
                    await window.electronAPI.store.set('lastWidgetFolder', folderPath);
                }

                for (const widget of widgets) {
                    await this.addWidget(widget);
                }
                await this.updateWidgetList();
                return true;
            } else {
                alert('No valid widgets found in the selected folder');
                return false;
            }
        } catch (error) {
            console.error('Error importing widgets from folder:', error);
            alert('Error importing widgets from folder');
            return false;
        }
    }

    async cleanupWidgetStorage() {
        try {
            console.log('Starting widget storage cleanup...');
            const storedWidgets = await window.electronAPI.store.get('widgets') || [];
            const uniqueWidgets = new Map();

            storedWidgets.forEach(widget => {
                const key = widget.name;
                const existing = uniqueWidgets.get(key);
                if (!existing || widget.lastUpdated > existing.lastUpdated) {
                    uniqueWidgets.set(key, widget);
                }
            });

            const cleanedWidgets = Array.from(uniqueWidgets.values());
            console.log(`Cleaned up widgets: ${storedWidgets.length} -> ${cleanedWidgets.length}`);

            await window.electronAPI.store.set('widgets', cleanedWidgets);

            this.widgetsConfig.clear();
            this.modules.clear();

            cleanedWidgets.forEach(widget => {
                this.widgetsConfig.set(widget.id, widget);
                this.modules.set(widget.id, {
                    ...widget,
                    type: 'widget'
                });
            });

            this.updateWidgetList();
            this.updateModuleList();
        } catch (error) {
            console.error('Error cleaning up widget storage:', error);
        }
    }

    async cleanupStore() {
        try {
            console.log('Starting store cleanup...');
            const currentStore = await window.electronAPI.store.get();
            const uniqueWidgets = new Map();

            if (currentStore.modules) {
                currentStore.modules
                    .filter(m => m.type === 'widget')
                    .forEach(module => {
                        uniqueWidgets.set(module.name, module);
                    });
            }

            if (currentStore.widgets) {
                currentStore.widgets.forEach(widget => {
                    const key = widget.name;
                    const existing = uniqueWidgets.get(key);
                    if (!existing || widget.id > existing.id) {
                        uniqueWidgets.set(key, widget);
                    }
                });
            }

            const cleanStore = {
                widgets: Array.from(uniqueWidgets.values()),
                settings: currentStore.settings || {
                    theme: 'default',
                    buttonPosition: 'bottom-right',
                    showClock: true
                },
                layouts: currentStore.layouts || []
            };

            await window.electronAPI.store.set('widgets', cleanStore.widgets);
            await window.electronAPI.store.set('settings', cleanStore.settings);
            await window.electronAPI.store.set('layouts', cleanStore.layouts);

            if (currentStore.modules) {
                await window.electronAPI.store.delete('modules');
            }

            console.log('Store cleanup complete:');
            console.log(`- Widgets: ${cleanStore.widgets.length}`);

            return cleanStore;
        } catch (error) {
            console.error('Error cleaning store:', error);
            throw error;
        }
    }

    // UI Update Methods
    updateModuleList() {
        const launcher = document.getElementById('moduleLauncher');
        if (!launcher) return;

        const categories = new Map();
        this.modules.forEach(module => {
            if (!categories.has(module.category)) {
                categories.set(module.category, []);
            }
            categories.get(module.category).push(module);
        });

        launcher.innerHTML = '';
        categories.forEach((modules, category) => {
            const categoryEl = document.createElement('div');
            categoryEl.className = 'module-category';
            categoryEl.innerHTML = `
                <div class="category-header">${category}</div>
                <div class="category-modules"></div>
            `;

            const moduleList = categoryEl.querySelector('.category-modules');
            modules.forEach(module => {
                const moduleEl = document.createElement('div');
                moduleEl.className = 'module-item';
                moduleEl.innerHTML = `
                    <span class="material-symbols-outlined">${module.icon}</span>
                    <span class="module-name">${module.name}</span>
                `;
                moduleEl.onclick = () => this.launchModule(module);
                moduleList.appendChild(moduleEl);
            });

            launcher.appendChild(categoryEl);
        });
    }

    updateWidgetList() {
        const widgetTab = document.getElementById('widgetTab');
        if (!widgetTab) return;

        const widgetList = widgetTab.querySelector('.widget-list');
        if (!widgetList) return;

        widgetList.innerHTML = '';

        this.widgetsConfig.forEach(widget => {
            const widgetEl = document.createElement('div');
            widgetEl.className = 'widget-item';
            widgetEl.setAttribute('data-widget', widget.id);
            widgetEl.innerHTML = `
                <span class="material-symbols-outlined">${widget.icon}</span>
                <div class="widget-info">
                    <h3>${widget.name} <span class="widget-version">v${widget.version || '1.0.0'}</span></h3>
                    <p>${widget.description}</p>
                </div>
                <div class="widget-controls">
                    <label class="autostart-toggle">
                        <input type="checkbox" 
                               ${widget.settings?.autostart ? 'checked' : ''} 
                               onchange="moduleManager.toggleAutostart('${widget.id}')">
                        Auto-start
                    </label>
                </div>
            `;
            widgetEl.addEventListener('click', (e) => {
                if (!e.target.matches('input[type="checkbox"]')) {
                    this.launchWidget(widget.id);
                }
            });
            widgetList.appendChild(widgetEl);
        });
    }

    // Autostart Methods
    async toggleAutostart(widgetId) {
        const widgets = await window.electronAPI.store.get('widgets') || [];
        const widget = widgets.find(w => w.id === widgetId);

        if (widget) {
            widget.settings = widget.settings || {};
            widget.settings.autoload = !widget.settings.autoload;

            const updatedWidgets = widgets.map(w =>
                w.id === widgetId ? widget : w
            );

            await window.electronAPI.store.set('widgets', updatedWidgets);
            this.updateWidgetList();
        }
    }

    async loadAutoStartWidgets() {
        console.log('Loading auto-start widgets...');
        const widgets = Array.from(this.widgetsConfig.values());

        for (const widget of widgets) {
            if (widget.settings?.autostart) {
                console.log(`Auto-starting widget: ${widget.name}`);
                await this.launchWidget(widget.id);
            }
        }
    }

    // Built-in Widgets Methods
    getBuiltinWidgets() {
        return {
            clock: {
                name: 'Clock Widget',
                type: 'widget',
                path: 'widgets/clock/index.html',
                category: 'Widgets',
                icon: 'schedule',
                description: 'A customizable digital clock display',
                version: '1.0.0',
                settings: {
                    position: { x: 20, y: 20 },
                    size: { width: 250, height: 100 },
                    autoload: false
                }
            },
            pipedreams: {
                name: 'Pipe Game Widget',
                type: 'widget',
                path: 'widgets/pipedreams/index.html',
                category: 'Widgets',
                icon: 'valve',
                description: 'A game of managing pipe connections',
                version: '1.0.0',
                settings: {
                    position: { x: 20, y: 20 },
                    size: { width: 250, height: 250 },
                    autoload: false
                }
            },
            web: {
                name: 'WebBrowser Widget',
                type: 'widget',
                path: 'widgets/web/index.html',
                category: 'Widgets',
                icon: 'home',
                description: 'A simple tabbed web browser',
                version: '1.0.0',
                settings: {
                    position: { x: 20, y: 20 },
                    size: { width: 800, height: 600 },
                    autoload: false
                }
            },
            video: {
                name: 'Video.JS Widget',
                type: 'widget',
                path: 'widgets/video/index.html',
                category: 'Widgets',
                icon: 'play_circle',
                description: 'A simple video player',
                version: '1.0.0',
                settings: {
                    position: { x: 20, y: 20 },
                    size: { width: 1080, height: 720 },
                    autoload: false
                }
            }
        };
    }

    async loadBuiltinWidgets(autoLaunch = false) {
        const widgets = this.getBuiltinWidgets();

        // Add built-in widgets
        for (const [id, widget] of Object.entries(widgets)) {
            const widgetId = `widget-${id}`;
            if (!this.widgetsConfig.has(widgetId)) {
                await this.addWidget({
                    ...widget,
                    id: widgetId,
                    settings: {
                        ...widget.settings,
                        autoload: autoLaunch
                    }
                });
            }
        }
    }

    async refreshWidgetLists() {
        const installedWidgets = await window.electronAPI.store.get('widgets') || [];
        const builtinWidgets = Object.values(this.getBuiltinWidgets());

        const installedContainer = document.getElementById('installedWidgets');
        if (installedContainer) {
            installedContainer.innerHTML = installedWidgets.map(widget =>
                createWidgetCard(widget, true)).join('');
        }

        const builtinContainer = document.getElementById('builtinWidgets');
        if (builtinContainer) {
            builtinContainer.innerHTML = builtinWidgets.map(widget =>
                createWidgetCard(widget, false)).join('');
        }
    }
}

// Make ModuleManager available globally
window.ModuleManager = ModuleManager;
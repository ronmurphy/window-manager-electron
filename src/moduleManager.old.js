// Module manager class
class ModuleManager {
    constructor() {
        this.modules = new Map();
        this.loadModules();
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

    async addModule(moduleData) {
        console.log('Adding module:', moduleData);
        const module = {
            id: `module-${Date.now()}`,
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
        
        // Only auto-launch if specifically requested
        if (moduleData.autolaunch) {
            console.log('Auto-launching module:', module);
            this.launchModule(module);
        }
        
        return module;
    }

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
                        true  // isWidget flag
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


    async loadBuiltinWidgets(autoLaunch = false) {
        const widgets = {
            clock: {
                name: 'Clock Widget',
                type: 'widget',
                path: 'widgets/clock.html',
                category: 'Widgets',
                icon: 'schedule',
                settings: {
                    position: { x: 20, y: 20 },
                    size: { width: 250, height: 100 },
                    autoload: autoLaunch
                }
            },
            pipedreams: {
                name: 'Pipe Game Widget',
                type: 'widget',
                path: 'widgets/PipeDreams.html',
                category: 'Widgets',
                icon: 'valve',
                settings: {
                    position: { x: 20, y: 20 },
                    size: { width: 250, height: 250 },
                    autoload: autoLaunch
                }
            },
            web: {
                name: 'WebBrowser Widget',
                type: 'widget',
                path: 'widgets/web.html',
                category: 'Widgets',
                icon: 'home',
                settings: {
                    position: { x: 20, y: 20 },
                    size: { width: 800, height: 600 },  // Larger default size
                    autoload: autoLaunch
                }
            },
            video: {
                name: 'Video.JS Widget',
                type: 'widget',
                path: 'widgets/video.html',
                category: 'Widgets',
                icon: 'play_circle',
                settings: {
                    position: { x: 20, y: 20 },
                    size: { width: 1080, height: 720 },  // Larger default size
                    autoload: autoLaunch
                }
            }
        };
        
        // Add built-in widgets if they don't exist
        for (const [id, widget] of Object.entries(widgets)) {
            if (!this.modules.has(`widget-${id}`)) {
                const module = await this.addModule({
                    ...widget,
                    id: `widget-${id}`
                });
                
                // Only launch if autoLaunch is true
                if (autoLaunch && module.settings.autoload) {
                    this.launchModule(module);
                }
            }
        }
    }

}



// Export for use in renderer.js
window.ModuleManager = ModuleManager;
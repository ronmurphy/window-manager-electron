/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
console.log('Loading Theme Manager...');

// Define utility functions first
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

    if (luminance > 0.7) {
        return '#000000';
    } else if (luminance < 0.3) {
        return '#FFFFFF';
    } else if (deltaE > 128) {
        return '#000000';
    } else {
        return '#FFFFFF';
    }
}



function applyThemeToUI(theme) {
    if (!theme?.colors || !theme?.transparency) {
        console.error('Invalid theme structure:', theme);
        return;
    }

    const root = document.documentElement;

    const windowsOpacity = theme.transparency?.windows ?? 0.95;
    const widgetsOpacity = theme.transparency?.widgets ?? 0.90;

    const normalAlpha = Math.round(windowsOpacity * 255).toString(16).padStart(2, '0');
    const widgetAlpha = Math.round(widgetsOpacity * 255).toString(16).padStart(2, '0');

    root.style.setProperty('--window-bg', `${theme.colors.normalWindow}${normalAlpha}`);
    root.style.setProperty('--widget-bg', `${theme.colors.widgetWindow}${widgetAlpha}`);
    root.style.setProperty('--accent-color', theme.colors.accent);

    const normalTextColor = theme.colors.text || getContrastColor(theme.colors.normalWindow);
    const windowTextColor = theme.colors.text || getContrastColor(theme.colors.normalWindow);
    const widgetTextColor = theme.colors.textWidget || getContrastColor(theme.colors.widgetWindow);

    root.style.setProperty('--window-control-color', windowTextColor);
    root.style.setProperty('--widget-control-color', widgetTextColor);

    root.style.setProperty('--scrollbar-track', `${theme.colors.normalWindow}${normalAlpha}`);
    root.style.setProperty('--scrollbar-thumb', theme.colors.accent);
    root.style.setProperty('--scrollbar-thumb-hover', theme.colors.accent);

    // Update all existing windows
    document.querySelectorAll('.window:not(.widget-window)').forEach(window => {
        const titlebar = window.querySelector('.window-header');
        if (titlebar) {
            updateTitlebarStyle(titlebar, theme, false);
        }
    });

    document.querySelectorAll('.widget-window').forEach(widget => {
        const titlebar = widget.querySelector('.window-header');
        if (titlebar) {
            updateTitlebarStyle(titlebar, theme, true);
        }
    });


    root.style.setProperty('--text-on-normal', normalTextColor);
    root.style.setProperty('--text-on-widget', widgetTextColor);

    root.style.setProperty('--system-controls-bg', `${theme.colors.widgetWindow}${widgetAlpha}`);
    root.style.setProperty('--system-controls-text', widgetTextColor);
    root.style.setProperty('--system-controls-icon', theme.colors.accent);

    root.style.setProperty('--quick-menu-bg', `${theme.colors.widgetWindow}${widgetAlpha}`);
    root.style.setProperty('--quick-menu-text', widgetTextColor);
    root.style.setProperty('--quick-menu-hover', `${theme.colors.accent}33`);

    root.style.setProperty('--window-control-color', theme.colors.text || getContrastColor(theme.colors.normalWindow));
    root.style.setProperty('--widget-control-color', theme.colors.textWidget || getContrastColor(theme.colors.widgetWindow));
    root.style.setProperty('--control-hover-bg', `${theme.colors.accent}33`);
    root.style.setProperty('--control-hover-color', theme.colors.accent);

    updateDynamicStyles(theme, theme.colors.textWidget || getContrastColor(theme.colors.widgetWindow),
        theme.colors.text || getContrastColor(theme.colors.normalWindow));
}




// Theme preview and management system
class ThemePreviewManager {
    constructor() {
        this.currentPreview = {
            colors: {
                normalWindow: '#1E1E1E',
                widgetWindow: '#1E1E1E',
                accent: '#007BFF',
                text: null,
                textWidget: null
            },
            transparency: {
                windows: 0.95,
                widgets: 0.90
            }
        };
    }

    initialize() {
        console.log('Initializing ThemePreviewManager...');
        requestAnimationFrame(() => {
            this.updatePreviewDisplay();
            this.setupEventListeners();
            console.log('ThemePreviewManager initialization complete');
        });
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');

        // Titlebar color pickers
        document.querySelectorAll('.titlebar-color-picker').forEach(picker => {
            console.log('Found titlebar picker:', picker);
            picker.addEventListener('change', (e) => {
                const type = picker.closest('.preview-window').classList.contains('widget')
                    ? 'widgetWindow'
                    : 'normalWindow';
                console.log(`Updating ${type} color to:`, e.target.value);
                this.updateColor(type, e.target.value);
            });
        });

        // Text color pickers
        document.querySelectorAll('.text-color-picker').forEach(picker => {
            console.log('Found text picker:', picker);
            picker.addEventListener('change', (e) => {
                const type = picker.closest('.preview-window').classList.contains('widget')
                    ? 'textWidget'
                    : 'text';
                console.log(`Updating ${type} text color to:`, e.target.value);
                this.updateTextColor(type, e.target.value);
            });
        });

        const windowTransparency = document.getElementById('windowTransparency');
        const widgetTransparency = document.getElementById('widgetTransparency');

        if (windowTransparency) {
            windowTransparency.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                const display = e.target.nextElementSibling;
                if (display) {
                    display.textContent = `${value}%`;
                }
                this.currentPreview.transparency.windows = value / 100;
                this.updatePreviewDisplay();
                // Immediately apply the changes
                window.applyThemeToUI(this.currentPreview);
            });
        }

        if (widgetTransparency) {
            widgetTransparency.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                const display = e.target.nextElementSibling;
                if (display) {
                    display.textContent = `${value}%`;
                }
                this.currentPreview.transparency.widgets = value / 100;
                this.updatePreviewDisplay();
                // Immediately apply the changes
                window.applyThemeToUI(this.currentPreview);
            });
        }

        const accentColor = document.getElementById('accentColor');
        if (accentColor) {
            accentColor.addEventListener('change', (e) => {
                this.updateAccent(e.target.value);
            });
        }

        document.querySelectorAll('.text-color-picker').forEach(picker => {
            console.log('Found text picker:', picker);
            picker.addEventListener('change', (e) => {
                const type = picker.closest('.preview-window').classList.contains('widget')
                    ? 'textWidget'
                    : 'text';
                console.log(`Updating ${type} text color to:`, e.target.value);
                this.updateTextColor(type, e.target.value);
            });
        });
    }

    updateTextColor(type, color) {
        console.log(`Setting ${type} color to:`, color);
        this.currentPreview.colors[type] = color;
        this.updatePreviewDisplay();
    }

    updateColor(type, color) {
        this.currentPreview.colors[type] = color;
        this.updatePreviewDisplay();
    }

    updateTransparency(type, value) {
        this.currentPreview.transparency[type] = value;

        // Update the corresponding slider display
        const slider = document.getElementById(`${type}Transparency`);
        if (slider) {
            const display = slider.nextElementSibling;
            if (display) {
                display.textContent = `${Math.round(value * 100)}%`;
            }
        }

        this.updatePreviewDisplay();
    }

    updateAccent(color) {
        this.currentPreview.colors.accent = color;
        this.updatePreviewDisplay();
    }

    updatePreviewDisplay() {
        console.log('Updating preview display with:', this.currentPreview);
        const previewWindows = document.querySelectorAll('.preview-window');
        if (!previewWindows.length) {
            console.log('No preview windows found');
            return;
        }

        previewWindows.forEach(window => {
            const isWidget = window.classList.contains('widget');
            const bgColor = isWidget ?
                this.currentPreview.colors.widgetWindow :
                this.currentPreview.colors.normalWindow;
            const transparency = isWidget ?
                this.currentPreview.transparency.widgets :
                this.currentPreview.transparency.windows;



            const alpha = Math.round(transparency * 255).toString(16).padStart(2, '0');
            window.style.backgroundColor = `${bgColor}${alpha}`;




            console.log('Updating preview with:', this.currentPreview);
            const previewWindows = document.querySelectorAll('.preview-window');

            previewWindows.forEach(window => {
                const isWidget = window.classList.contains('widget');
                const bgColor = isWidget ?
                    this.currentPreview.colors.widgetWindow :
                    this.currentPreview.colors.normalWindow;
                const transparency = isWidget ?
                    this.currentPreview.transparency.widgets :
                    this.currentPreview.transparency.windows;

                const alpha = Math.round(transparency * 255).toString(16).padStart(2, '0');
                window.style.backgroundColor = `${bgColor}${alpha}`;
            });

            // Update text color
            const textColorType = isWidget ? 'textWidget' : 'text';
            const textColor = this.currentPreview.colors[textColorType] || getContrastColor(bgColor);

            // Apply text color to the title and control buttons
            const titleElement = window.querySelector('.window-title');
            const controlButtons = window.querySelectorAll('.window-controls button .material-symbols-outlined');

            if (titleElement) {
                titleElement.style.color = textColor;
            }

            controlButtons.forEach(button => {
                button.style.color = textColor;
            });

            // Add custom CSS variables for the accent color hover effect
            window.style.setProperty('--control-text-color', textColor);
            window.style.setProperty('--control-hover-color', this.currentPreview.colors.accent);
            window.style.setProperty('--control-hover-bg', `${this.currentPreview.colors.accent}33`);
        });

        // Update accent color display
        document.documentElement.style.setProperty('--preview-accent', this.currentPreview.colors.accent);
    }

    // Add to ThemePreviewManager class


    async applyToSystem() {
        console.log('Applying theme to system:', this.currentPreview);
        const theme = {
            ...this.currentPreview,
            name: 'Custom Theme',
            id: `theme-${Date.now()}`
        };

        try {
            // Apply to store
            const themes = await window.electronAPI.store.get('themes') || {};
            themes[theme.id] = theme;
            await window.electronAPI.store.set('themes', themes);
            await window.electronAPI.store.set('currentTheme', theme.id);

            // Apply theme to UI
            window.applyThemeToUI(theme);

            // Refresh using our grid display
            await refreshThemeGridDisplay();

            console.log('Theme applied successfully');
        } catch (error) {
            console.error('Error applying theme:', error);
        }
    }

    async saveAsTheme() {
        const name = await promptThemeName();
        if (!name) return;

        const theme = {
            ...this.currentPreview,
            name,
            id: `theme-${Date.now()}`
        };

        try {
            // Get existing themes
            const themes = await window.electronAPI.store.get('themes') || {};

            // Add new theme
            themes[theme.id] = theme;

            // Save themes to store
            await window.electronAPI.store.set('themes', themes);

            // Set as current theme
            await window.electronAPI.store.set('currentTheme', theme.id);

            // Apply theme to UI
            window.applyThemeToUI(theme);

            // Update existing windows
            await window.updateExistingWindows(theme);

            // Refresh theme grid
            await refreshThemeGridDisplay();

            console.log('Theme saved and applied:', theme);
        } catch (error) {
            console.error('Error saving and applying theme:', error);
        }
    }
}

// Theme grid management
function refreshThemeGrid() {
    const grid = document.getElementById('themeGrid');
    if (!grid) return;

    window.electronAPI.store.get('themes').then(themes => {
        grid.innerHTML = Object.entries(themes).map(([id, theme]) => `
            <div class="theme-item" onclick="previewTheme('${id}')">
                <div class="theme-preview" style="
                    background-color: ${theme.colors.normalWindow}${Math.round(theme.transparency.windows * 255).toString(16).padStart(2, '0')}
                ">
                    <div class="theme-preview-header" style="
                        background-color: ${theme.colors.widgetWindow}${Math.round(theme.transparency.widgets * 255).toString(16).padStart(2, '0')};
                        color: ${theme.colors.text || getContrastColor(theme.colors.widgetWindow)}
                    ">
                        ${theme.name}
                    </div>
                    <div class="theme-preview-content" style="
                        color: ${theme.colors.text || getContrastColor(theme.colors.normalWindow)}
                    ">
                        <span class="material-symbols-outlined" style="color: ${theme.colors.accent}">
                            palette
                        </span>
                    </div>
                </div>
                ${id !== 'default' ? `
                    <button class="delete-theme" onclick="event.stopPropagation(); deleteTheme('${id}')">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                ` : ''}
            </div>
        `).join('');
    });
}

async function previewTheme(id) {
    console.log('Previewing and applying theme:', id);
    try {
        const themes = await window.electronAPI.store.get('themes');
        const theme = themes[id];
        if (theme && window.themePreviewManager) {
            // Update preview with theme values
            window.themePreviewManager.currentPreview = {
                colors: { ...theme.colors },
                transparency: { ...theme.transparency }
            };
            window.themePreviewManager.updatePreviewDisplay();

            // Apply theme immediately
            await window.electronAPI.store.set('currentTheme', id);
            window.applyThemeToUI(theme);
            await window.updateExistingWindows(theme);

            console.log('Theme preview and apply completed');
        }
    } catch (error) {
        console.error('Error previewing and applying theme:', error);
    }
}

// In themeManager.js
async function deleteTheme(themeId) {
    console.log('Attempting to delete theme:', themeId);
    if (themeId === 'default') {
        console.warn('Cannot delete default theme');
        return;
    }

    if (!confirm('Are you sure you want to delete this theme?')) {
        return;
    }

    try {
        // Get current themes
        const themes = await window.electronAPI.store.get('themes') || {};

        // Check if trying to delete current theme
        const currentThemeId = await window.electronAPI.store.get('currentTheme');
        if (currentThemeId === themeId) {
            // Switch to default theme first
            await window.electronAPI.store.set('currentTheme', 'default');
            if (window.themePreviewManager) {
                const defaultTheme = themes['default'];
                window.themePreviewManager.currentPreview = {
                    colors: { ...defaultTheme.colors },
                    transparency: { ...defaultTheme.transparency }
                };
                window.themePreviewManager.updatePreviewDisplay();
            }
        }

        // Delete the theme
        delete themes[themeId];
        await window.electronAPI.store.set('themes', themes);

        // Refresh the display using our new grid system
        await refreshThemeGridDisplay();

        console.log('Theme deleted successfully');
    } catch (error) {
        console.error('Error deleting theme:', error);
    }
}

// Theme import/export
async function exportTheme(themeId) {
    const themes = await window.electronAPI.store.get('themes');
    const theme = themes[themeId];
    if (!theme) return;

    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();

    URL.revokeObjectURL(url);
}

async function importTheme() {
    try {
        const result = await window.electronAPI.openFileDialog({
            filters: [{ name: 'JSON Theme', extensions: ['json'] }]
        });

        if (result && result.content) {
            const theme = JSON.parse(result.content);
            theme.id = `theme-${Date.now()}`; // Ensure unique ID

            const themes = await window.electronAPI.store.get('themes') || {};
            themes[theme.id] = theme;
            await window.electronAPI.store.set('themes', themes);

            refreshThemeGrid();
        }
    } catch (error) {
        console.error('Error importing theme:', error);
    }
}

// Add these functions to themeManager.js
async function refreshThemeGridDisplay() {  // renamed from loadThemeList
    return new Promise((resolve) => {
        const tryLoad = async () => {
            const container = document.getElementById('themeGrid');
            if (!container) {
                console.log('Theme grid not found, retrying in next frame...');
                requestAnimationFrame(tryLoad);
                return;
            }

            try {
                console.log('Loading themes from store...');
                const themes = await window.electronAPI.store.get('themes') || {};
                console.log('Loaded themes:', themes);

                if (Object.keys(themes).length === 0) {
                    console.log('No themes found, showing empty state');
                    container.innerHTML = `
                        <div class="empty-state">
                            <span class="material-symbols-outlined">palette</span>
                            <p>No saved themes yet</p>
                        </div>
                    `;
                } else {
                    console.log('Rendering themes:', Object.keys(themes).length);
                    container.innerHTML = Object.entries(themes)
                        .map(([id, theme]) => createThemeCard(id, theme))
                        .join('');
                }
                resolve();
            } catch (error) {
                console.error('Error loading theme list:', error);
                resolve();
            }
        };

        setTimeout(tryLoad, 100);
    });
}


function createThemeCard(id, theme) {
    console.log('Creating theme card for:', theme.name);
    const windowAlpha = Math.round(theme.transparency.windows * 255).toString(16).padStart(2, '0');
    const widgetAlpha = Math.round(theme.transparency.widgets * 255).toString(16).padStart(2, '0');

    return `
        <div class="theme-item" onclick="previewTheme('${id}')">
            <div class="theme-preview">
                <div class="theme-colors">
                    <div class="color-row">
                        <div class="color-box" style="background-color: ${theme.colors.normalWindow}${windowAlpha}" title="Window Color"></div>
                        <div class="color-box" style="background-color: ${theme.colors.widgetWindow}${widgetAlpha}" title="Widget Color"></div>
                    </div>
                    <div class="color-row">
                        <div class="color-box" style="background-color: ${theme.colors.accent}" title="Accent Color"></div>
                        <div class="color-box" style="background-color: ${theme.colors.text || getContrastColor(theme.colors.normalWindow)}" title="Text Color"></div>
                    </div>
                </div>
                <div class="theme-title">
                    <span>${theme.name}</span>
                </div>
            </div>
            <div class="theme-actions">
                ${id !== 'default' ? `
                    <button class="delete-theme" onclick="event.stopPropagation(); window.deleteTheme('${id}')" title="Delete Theme">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}


async function loadCurrentThemeValues() {
    return new Promise((resolve) => {
        const tryLoad = async () => {
            try {
                const currentTheme = await window.getCurrentTheme();
                if (!currentTheme) return;

                // Normal window colors
                const normalWindowColor = document.querySelector('.preview-window:not(.widget) .titlebar-color-picker');
                const normalTextColor = document.querySelector('.preview-window:not(.widget) .text-color-picker');
                if (normalWindowColor) normalWindowColor.value = currentTheme.colors.normalWindow;
                if (normalTextColor) normalTextColor.value = currentTheme.colors.text ||
                    getContrastColor(currentTheme.colors.normalWindow);

                // Widget colors
                const widgetWindowColor = document.querySelector('.preview-window.widget .titlebar-color-picker');
                const widgetTextColor = document.querySelector('.preview-window.widget .text-color-picker');
                if (widgetWindowColor) widgetWindowColor.value = currentTheme.colors.widgetWindow;
                if (widgetTextColor) widgetTextColor.value = currentTheme.colors.textWidget ||
                    getContrastColor(currentTheme.colors.widgetWindow);

                // Accent color
                const accentColorPicker = document.getElementById('accentColor');
                if (accentColorPicker) accentColorPicker.value = currentTheme.colors.accent;

                // Transparency sliders
                const windowTransparency = document.getElementById('windowTransparency');
                const widgetTransparency = document.getElementById('widgetTransparency');

                if (windowTransparency) {
                    const value = Math.round(currentTheme.transparency.windows * 100);
                    windowTransparency.value = value;
                    const display = windowTransparency.nextElementSibling;
                    if (display) {
                        display.textContent = `${value}%`;
                    }
                }

                if (widgetTransparency) {
                    const value = Math.round(currentTheme.transparency.widgets * 100);
                    widgetTransparency.value = value;
                    const display = widgetTransparency.nextElementSibling;
                    if (display) {
                        display.textContent = `${value}%`;
                    }
                }

                // Update preview display
                if (window.themePreviewManager) {
                    window.themePreviewManager.currentPreview = {
                        colors: { ...currentTheme.colors },
                        transparency: { ...currentTheme.transparency }
                    };
                    window.themePreviewManager.updatePreviewDisplay();
                }
            } catch (error) {
                console.error('Error in loadCurrentThemeValues:', error);
            }
            resolve();
        };

        tryLoad();
    });
}


async function getCurrentTheme() {
    try {
        console.log('Getting current theme from store...');
        const currentThemeId = await window.electronAPI.store.get('currentTheme');
        const themes = await window.electronAPI.store.get('themes');
        console.log('Current theme ID:', currentThemeId);
        const theme = themes[currentThemeId] || themes['default'];
        console.log('Retrieved theme:', theme);
        return theme;
    } catch (error) {
        console.error('Error getting current theme:', error);
        // Return default theme as fallback
        return {
            name: 'Default Dark',
            colors: {
                normalWindow: '#1E1E1E',
                widgetWindow: '#1E1E1E',
                accent: '#007BFF',
                text: '#FFFFFF',
                textMuted: '#888888'
            },
            transparency: {
                windows: 0.95,
                widgets: 0.90
            }
        };
    }
}

async function updateExistingWindows(theme) {
    document.querySelectorAll('.window:not(.widget-window)').forEach(window => {
        const titlebar = window.querySelector('.window-header');
        if (titlebar) {
            updateTitlebarStyle(titlebar, theme, false);
        }
    });

    document.querySelectorAll('.widget-window').forEach(widget => {
        const titlebar = widget.querySelector('.window-header');
        if (titlebar) {
            updateTitlebarStyle(titlebar, theme, true);
        }
    });
}

function updateTitlebarStyle(titlebar, theme, isWidget) {
    const alpha = isWidget ?
        Math.round(theme.transparency.widgets * 255).toString(16).padStart(2, '0') :
        Math.round(theme.transparency.windows * 255).toString(16).padStart(2, '0');

    const bgColor = isWidget ? theme.colors.widgetWindow : theme.colors.normalWindow;
    const textColor = isWidget ?
        (theme.colors.textWidget || getContrastColor(theme.colors.widgetWindow)) :
        (theme.colors.text || getContrastColor(theme.colors.normalWindow));

    titlebar.style.backgroundColor = `${bgColor}${alpha}`;
    titlebar.style.borderBottom = `1px solid ${theme.colors.accent}30`;
    titlebar.style.color = textColor;

    // Update control buttons
    const controlButtons = titlebar.querySelectorAll('.window-controls button');
    controlButtons.forEach(button => {
        button.style.color = textColor;
    });
}

function updateColorPreviews() {
    document.querySelectorAll('.color-control').forEach(control => {
        const input = control.querySelector('input[type="color"]');
        const preview = control.querySelector('.color-preview');
        const value = control.querySelector('.color-value');

        if (input && preview && value) {
            preview.style.backgroundColor = input.value;
            value.textContent = input.value.toUpperCase();
        }
    });
}

function updateThemeColors() {
    const colors = {
        normalWindow: document.getElementById('normalWindowColor')?.value,
        widgetWindow: document.getElementById('widgetWindowColor')?.value,
        accent: document.getElementById('accentColor')?.value
    };

    if (window.themePreviewManager) {
        window.themePreviewManager.currentPreview.colors = {
            ...window.themePreviewManager.currentPreview.colors,
            ...colors
        };

        window.themePreviewManager.updatePreviewDisplay();
    }
}


function promptThemeName() {
    return new Promise((resolve) => {
        // Create modal HTML if it doesn't exist
        let modal = document.getElementById('themeNameModal');
        if (!modal) {
            const modalHtml = `
                <div id="themeNameModal" class="modal">
                    <div class="modal-content">
                        <h2>Save Theme</h2>
                        <div class="form-group">
                            <label>Theme Name</label>
                            <input type="text" id="themeNameInput" placeholder="Enter theme name">
                        </div>
                        <div class="modal-actions">
                            <button id="saveThemeBtn" class="action-button">Save</button>
                            <button id="cancelThemeBtn" class="secondary-button">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            modal = document.getElementById('themeNameModal');
        }

        const input = document.getElementById('themeNameInput');
        const saveBtn = document.getElementById('saveThemeBtn');
        const cancelBtn = document.getElementById('cancelThemeBtn');

        modal.style.display = 'block';
        input.value = 'My Theme';
        input.select();

        saveBtn.onclick = () => {
            const name = input.value.trim();
            if (name) {
                modal.style.display = 'none';
                resolve(name);
            }
        };

        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(null);
        };

        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        };
    });
}


function updateDynamicStyles(theme, widgetTextColor, normalTextColor) {
    // Create or update dynamic stylesheet
    let styleSheet = document.getElementById('dynamic-styles');
    if (!styleSheet) {
        styleSheet = document.createElement('style');
        styleSheet.id = 'dynamic-styles';
        document.head.appendChild(styleSheet);
    }

    styleSheet.textContent = `
        .system-controls {
            background: var(--system-controls-bg);
            color: var(--system-controls-text);
        }

        .system-controls .icon-button {
            color: var(--system-controls-icon);
        }

        .system-controls .icon-button:hover {
            background: ${theme.colors.accent}33;
        }

        .quick-menu {
            background: var(--quick-menu-bg);
            color: var(--quick-menu-text);
            border: 1px solid ${theme.colors.accent}33;
        }

        .widget-quick-item:hover {
            background: ${theme.colors.accent}1A;
        }

        .widget-quick-item .material-symbols-outlined {
            color: var(--system-controls-icon);
        }

        .widget-window .window-controls button:hover {
            background: ${theme.colors.accent}33;
        }

        .action-button {
            background: ${theme.colors.accent};
            color: ${getContrastColor(theme.colors.accent)};
        }

        .action-button:hover {
            background: ${theme.colors.accent}E6;
        }
    `;

    styleSheet.textContent += `
        .window:not(.widget-window) .window-controls button .material-symbols-outlined {
            color: var(--window-control-color);
        }

        .widget-window .window-controls button .material-symbols-outlined {
            color: var(--widget-control-color);
        }

        .window .window-controls button:hover {
            background-color: var(--control-hover-bg);
        }

        .window .window-controls button:hover .material-symbols-outlined {
            color: var(--control-hover-color);
        }

        .window .window-controls button:last-child:hover {
            background-color: rgba(255, 59, 48, 0.2);
        }

        .window .window-controls button:last-child:hover .material-symbols-outlined {
            color: rgb(255, 59, 48);
        }
    `;
}

// Update event listeners in setupEventListeners
const windowTransparency = document.getElementById('windowTransparency');
if (windowTransparency) {
    windowTransparency.addEventListener('input', (e) => {
        const value = e.target.value;
        const display = e.target.nextElementSibling;
        if (display) display.textContent = `${value}%`;
        this.updateTransparency('windows', parseInt(value) / 100);
    });
}

async function importCursor() {
    try {
        const result = await window.electronAPI.cursor.select();
        if (result.success) {
            const cursorData = {
                id: `cursor-${Date.now()}`,
                name: result.name,
                path: result.path.replace(/\\/g, '/'), // Normalize path separators
                originalPath: result.originalPath,
                type: 'custom'
            };

            const saveResult = await window.electronAPI.cursor.save(cursorData);
            if (saveResult.success) {
                await loadCursorGrid();
            } else {
                console.error('Failed to save cursor data:', saveResult.error);
            }
        }
    } catch (error) {
        console.error('Error importing cursor:', error);
    }
}


async function applyCursor(cursorPath) {
    try {
        const normalizedPath = cursorPath.replace(/\\/g, '/');
        const cursorUrl = `url('file:///${normalizedPath}'), auto`;
        
        console.log('Applying cursor with URL:', cursorUrl);

        await window.electronAPI.cursor.set(normalizedPath);

        // Create comprehensive cursor CSS
        const cursorCSS = `
    * {
        cursor: ${cursorUrl} !important;
    }
    
    /* Target tab structure specifically */
    .tab-content,
    .tab-content *,
    .tab-pane,
    .tab-pane *,
    .tab-content webview,
    .tab-content iframe {
        cursor: ${cursorUrl} !important;
    }
    
    /* Target webviews and their shadow DOM */
    webview, 
    webview::shadow-root, 
    webview::shadow-root *, 
    webview::-webkit-shadow-root,
    webview::-webkit-shadow-root * {
        cursor: ${cursorUrl} !important;
    }
    
    /* Target shadow root host and iframe specifically */
    :host {
        cursor: ${cursorUrl} !important;
    }
    
    /* Target iframes and their contents */
    iframe,
    iframe::content,
    iframe::shadow-root,
    iframe::shadow-root *,
    iframe::-webkit-shadow-root,
    iframe::-webkit-shadow-root * {
        cursor: ${cursorUrl} !important;
    }

    /* Ensure cursor applies to all window types and their children */
    .window, 
    .window *, 
    .widget-window, 
    .widget-window *,
    .web-container,
    .web-container * {
        cursor: ${cursorUrl} !important;
    }
    
    /* Container specific targeting */
    .tab-content,
    .tab-content > *,
    .tab-content webview,
    .tab-content webview::shadow-root,
    .tab-content webview::shadow-root iframe {
        cursor: ${cursorUrl} !important;
    }
    
    /* Exclude resize handles */
    .resize-handle {
        cursor: se-resize !important;
    }
`;

        // Add or update global style
        let cursorStyle = document.getElementById('global-cursor-style');
        if (!cursorStyle) {
            cursorStyle = document.createElement('style');
            cursorStyle.id = 'global-cursor-style';
            document.head.appendChild(cursorStyle);
        }
        cursorStyle.textContent = cursorCSS;

        // Apply to all webviews
        document.querySelectorAll('webview').forEach(webview => {
            webview.addEventListener('dom-ready', () => {
                try {
                    // Insert CSS into the webview's main content
                    webview.insertCSS(cursorCSS);
                    
                    // Insert CSS specifically for the shadow root iframe
                    webview.executeJavaScript(`
                        (function() {
                            const css = \`
                                * {
                                    cursor: ${cursorUrl} !important;
                                }
                                iframe {
                                    cursor: ${cursorUrl} !important;
                                }
                                :host {
                                    cursor: ${cursorUrl} !important;
                                }
                            \`;
                            
                            // Add style to main document
                            let style = document.getElementById('webview-cursor-style');
                            if (!style) {
                                style = document.createElement('style');
                                style.id = 'webview-cursor-style';
                                document.head.appendChild(style);
                            }
                            style.textContent = css;

                            // Handle any iframes within the webview
                            document.querySelectorAll('iframe').forEach(iframe => {
                                try {
                                    if (iframe.contentDocument) {
                                        let frameStyle = iframe.contentDocument.createElement('style');
                                        frameStyle.textContent = css;
                                        iframe.contentDocument.head.appendChild(frameStyle);
                                    }
                                } catch(e) {
                                    console.warn('Could not access iframe content:', e);
                                }
                            });

                            // Add style to shadow root if possible
                            if (document.querySelector('webview')) {
                                const shadowRoot = document.querySelector('webview').shadowRoot;
                                if (shadowRoot) {
                                    let shadowStyle = document.createElement('style');
                                    shadowStyle.textContent = css;
                                    shadowRoot.appendChild(shadowStyle);
                                }
                            }
                        })();
                    `);
                } catch (e) {
                    console.warn('Error applying cursor to webview:', e);
                }
            });
        });

        // Handle regular iframes
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                if (iframe.contentDocument) {
                    let iframeStyle = iframe.contentDocument.getElementById('iframe-cursor-style');
                    if (!iframeStyle) {
                        iframeStyle = iframe.contentDocument.createElement('style');
                        iframeStyle.id = 'iframe-cursor-style';
                        iframe.contentDocument.head.appendChild(iframeStyle);
                    }
                    iframeStyle.textContent = cursorCSS;
                }
            } catch (e) {
                console.warn('Could not access iframe content:', e);
            }
        });

        // Create MutationObserver to handle dynamically added elements
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.tagName === 'WEBVIEW') {
                        node.addEventListener('dom-ready', () => {
                            try {
                                node.insertCSS(cursorCSS);
                            } catch (e) {
                                console.warn('Error applying cursor to new webview:', e);
                            }
                        });
                    } else if (node.tagName === 'IFRAME') {
                        try {
                            if (node.contentDocument) {
                                let style = node.contentDocument.createElement('style');
                                style.textContent = cursorCSS;
                                node.contentDocument.head.appendChild(style);
                            }
                        } catch (e) {
                            console.warn('Could not access new iframe content:', e);
                        }
                    }
                });
            });
        });

        // Start observing for new elements
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

    } catch (error) {
        console.error('Error applying cursor:', error);
    }
}

function createCursorPreview(cursor) {
    const normalizedPath = cursor.path.replace(/\\/g, '/');
    const cursorUrl = `url('file:///${normalizedPath}'), auto`;
    
    // Check if the cursor file is an image
    const isImage = /\.(png|jpg|jpeg|gif)$/i.test(cursor.path);
    
    const previewContent = isImage ? `
        <div class="cursor-preview-content" style="cursor: ${cursorUrl}">
            <div class="cursor-preview-image">
                <img src="file:///${normalizedPath}" alt="${cursor.name}" 
                     style="max-width: 32px; height: auto; margin-bottom: 10px;">
            </div>
            <div class="cursor-preview-hover">
                <span class="material-symbols-outlined">mouse</span>
                <span class="hover-text">Hover to preview</span>
            </div>
        </div>
    ` : `
        <div class="cursor-preview-content" style="cursor: ${cursorUrl}">
            <span class="material-symbols-outlined">mouse</span>
            <span class="hover-text">Hover to preview</span>
        </div>
    `;

    return `
        <div class="cursor-item" onclick="applyCursor('${normalizedPath}')" 
             style="cursor: ${cursorUrl}">
            <div class="cursor-preview">
                ${previewContent}
            </div>
            <div class="cursor-info">
                <span>${cursor.name}</span>
            </div>
            <button class="delete-cursor-theme" 
                    onclick="event.stopPropagation(); deleteCursor('${cursor.id}')">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
    `;
}

async function loadCursorGrid() {
    const cursorGrid = document.getElementById('cursorGrid');
    if (!cursorGrid) return;

    try {
        const cursors = await window.electronAPI.cursor.get();
        
        if (cursors.length === 0) {
            cursorGrid.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined">mouse</span>
                    <p>No custom cursors added yet</p>
                </div>
            `;
            return;
        }

        cursorGrid.innerHTML = cursors.map(cursor => createCursorPreview(cursor)).join('');

    } catch (error) {
        console.error('Error loading cursors:', error);
    }
}

async function deleteCursor(cursorId) {
    if (!confirm('Are you sure you want to delete this cursor?')) return;

    try {
        const cursors = await window.electronAPI.cursor.get();
        const updatedCursors = cursors.filter(c => c.id !== cursorId);
        await window.electronAPI.store.set('cursors', updatedCursors);
        await loadCursorGrid();
    } catch (error) {
        console.error('Error deleting cursor:', error);
    }
}


function verifyColorPickers() {
    console.log('Verifying color pickers...');

    // Check normal window pickers
    const normalWindow = document.querySelector('.preview-window:not(.widget)');
    if (normalWindow) {
        console.log('Normal window titlebar picker:',
            normalWindow.querySelector('.titlebar-color-picker'));
        console.log('Normal window text picker:',
            normalWindow.querySelector('.text-color-picker'));
    }

    // Check widget window pickers
    const widgetWindow = document.querySelector('.preview-window.widget');
    if (widgetWindow) {
        console.log('Widget window titlebar picker:',
            widgetWindow.querySelector('.titlebar-color-picker'));
        console.log('Widget window text picker:',
            widgetWindow.querySelector('.text-color-picker'));
    }
}

// Initialize
let themePreviewManager;

// At the bottom of themeManager.js, right before exporting
console.log('Registering Theme Manager globals...');
console.log('ThemePreviewManager exists:', typeof ThemePreviewManager !== 'undefined');

window.ThemePreviewManager = ThemePreviewManager;
window.refreshThemeGridDisplay = refreshThemeGridDisplay;
window.deleteTheme = deleteTheme;
window.previewTheme = previewTheme;
window.loadCurrentThemeValues = loadCurrentThemeValues;
window.applyThemeToUI = applyThemeToUI;
window.updateDynamicStyles = updateDynamicStyles;
window.promptThemeName = promptThemeName;
window.getCurrentTheme = getCurrentTheme;
window.updateExistingWindows = updateExistingWindows;
window.updateTitlebarStyle = updateTitlebarStyle;
window.updateColorPreviews = updateColorPreviews;
window.updateThemeColors = updateThemeColors;
window.verifyColorPickers = verifyColorPickers;
window.loadCursorGrid = loadCursorGrid;

console.log('Theme Manager registration complete. Window.ThemePreviewManager:', typeof window.ThemePreviewManager);
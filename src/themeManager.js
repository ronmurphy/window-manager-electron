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

class ColorManager {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.colorCache = new Map();
    }

    async extractColors(imageUrl) {
        if (this.colorCache.has(imageUrl)) {
            return this.colorCache.get(imageUrl);
        }

        try {
            const img = await this.loadImage(imageUrl);
            const width = 200;
            const height = (img.height / img.width) * width;
            this.canvas.width = width;
            this.canvas.height = height;
            
            this.ctx.drawImage(img, 0, 0, width, height);
            const imageData = this.ctx.getImageData(0, 0, width, height).data;
            const colors = this.processImageData(imageData);
            
            this.colorCache.set(imageUrl, {
                colors,
                metadata: {
                    dominant: "Most prominent color from image",
                    shift: "Harmonious variation of dominant color",
                    accent: "Unique contrasting color",
                    light: "Brightest significant color",
                    dark: "Darkest significant color"
                }
            });
            
            return this.colorCache.get(imageUrl);
        } catch (error) {
            console.error('Error extracting colors:', error);
            return null;
        }
    }

    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

// Add to ColorManager class if not already present
rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

shiftColor(hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;

    return this.rgbToHex(
        Math.min(rgb.r + 30, 255),
        Math.min(rgb.g + 30, 255),
        Math.min(rgb.b + 30, 255)
    );
}

colorBrightness(hex) {
    const rgb = this.hexToRgb(hex);
    return rgb ? (rgb.r + rgb.g + rgb.b) / 3 : 0;
}

hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

async applyAllColors() {
    try {
        const container = document.getElementById('extractedColors');
        const swatches = container?.querySelectorAll('.color-swatch-container');
        
        if (!swatches?.length) return;
        
        const [window, widget, accent] = Array.from(swatches).map(
            swatch => swatch.dataset.color
        );

        await this.applyColorTo('normalWindow', window);
        await this.applyColorTo('widgetWindow', widget);
        await this.applyColorTo('accent', accent);

        this.showNotification('All colors applied', 'palette');
    } catch (error) {
        console.error('Error applying all colors:', error);
    }
}

// async applyAllColors() {
//     try {
//         const container = document.getElementById('extractedColors');
//         const swatches = container?.querySelectorAll('.color-swatch-container');
        
//         if (!swatches?.length) return;
        
//         const [window, widget, accent] = Array.from(swatches).map(
//             swatch => swatch.dataset.color
//         );

//         await this.applyColorTo('normalWindow', window);
//         await this.applyColorTo('widgetWindow', widget);
//         await this.applyColorTo('accent', accent);

//         this.showNotification('All colors applied', 'palette');
//     } catch (error) {
//         console.error('Error applying all colors:', error);
//     }
// }

// async applyColorTo(element, color) {
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
//         this.currentPreview.colors[element] = color;
//         this.updatePreviewDisplay();
        
//         this.showNotification(`Color applied to ${element}`, 'format_color_fill');
//     }
// }

// async applyColorTo(element, color) {
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
//         this.currentPreview.colors[element] = color;
//         this.updatePreviewDisplay();
        
//         this.showNotification(`Color applied to ${element}`, 'format_color_fill');
//     }
// }

async applyColorTo(element, color) {
    console.log('Applying color:', color, 'to element:', element); // Debug log
    const pickerMappings = {
        normalWindow: '.preview-window:not(.widget) .titlebar-color-picker',
        widgetWindow: '.preview-window.widget .titlebar-color-picker',
        accent: '#accentColor',
        text: '.preview-window:not(.widget) .text-color-picker'
    };

    const picker = document.querySelector(pickerMappings[element]);
    if (picker) {
        picker.value = color;
        picker.dispatchEvent(new Event('input'));
        
        // Update theme preview manager
        this.currentPreview.colors[element] = color;
        this.updatePreviewDisplay();
        
        this.showNotification(`Color applied to ${element}`, 'format_color_fill');
    }
}

positionColorMenu(menu) {
    const rect = menu.getBoundingClientRect();
    let x = event.clientX;
    let y = event.clientY;

    // Ensure menu stays within window bounds
    if (x + rect.width > window.innerWidth) {
        x = window.innerWidth - rect.width - 10;
    }
    if (y + rect.height > window.innerHeight) {
        y = window.innerHeight - rect.height - 10;
    }

    menu.style.left = `${x + 10}px`;
    menu.style.top = `${y + 10}px`;
}

// showNotification(message, icon = 'check_circle') {
//     const notification = document.createElement('div');
//     notification.className = 'color-notification';
//     notification.innerHTML = `
//         <span class="material-symbols-outlined">${icon}</span>
//         ${message}
//     `;
    
//     document.body.appendChild(notification);
//     setTimeout(() => {
//         notification.classList.add('fade-out');
//         setTimeout(() => notification.remove(), 300);
//     }, 2000);
// }

showNotification(message, icon = 'check_circle') {
    const notification = document.createElement('div');
    notification.className = 'color-notification';
    notification.innerHTML = `
        <span class="material-symbols-outlined">${icon}</span>
        ${message}
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Add debug check method
checkMethods() {
    console.log('Checking ThemePreviewManager methods:');
    console.log('applyAllColors:', typeof this.applyAllColors);
    console.log('applyColorTo:', typeof this.applyColorTo);
    console.log('showNotification:', typeof this.showNotification);
}


    getContrastColor(hex) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return '#FFFFFF';
        
        // Calculate relative luminance
        const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        return luminance > 0.5 ? '#000000' : '#FFFFFF';
    }

    processImageData(imageData) {
        const colorCounts = {};
        const colorArray = [];

        for (let i = 0; i < imageData.length; i += 4) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            const hex = this.rgbToHex(r, g, b);

            if (!colorCounts[hex]) {
                colorCounts[hex] = 0;
                colorArray.push(hex);
            }

            colorCounts[hex]++;
        }

        const mostCommon = colorArray.sort((a, b) => colorCounts[b] - colorCounts[a])[0];
        const secondMost = colorArray[1];
        const shiftedSecond = this.shiftColor(secondMost);
        const rarest = colorArray.sort((a, b) => colorCounts[a] - colorCounts[b])[0];
        const lightest = colorArray.sort((a, b) => this.colorBrightness(b) - this.colorBrightness(a))[0];
        const darkest = colorArray.sort((a, b) => this.colorBrightness(a) - this.colorBrightness(b))[0];

        return [mostCommon, shiftedSecond, rarest, lightest, darkest];
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
        this.colorManager = new ColorManager();
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

    // Define all methods before trying to bind them
    // async applyAllColors() {
    //     try {
    //         const container = document.getElementById('extractedColors');
    //         const swatches = container?.querySelectorAll('.color-swatch-container');
            
    //         if (!swatches?.length) return;
            
    //         const [window, widget, accent] = Array.from(swatches).map(
    //             swatch => swatch.dataset.color
    //         );

    //         await this.applyColorTo('normalWindow', window);
    //         await this.applyColorTo('widgetWindow', widget);
    //         await this.applyColorTo('accent', accent);

    //         this.showNotification('All colors applied', 'palette');
    //     } catch (error) {
    //         console.error('Error applying all colors:', error);
    //     }
    // }

    async applyAllColors() {
        try {
            const container = document.getElementById('extractedColors');
            const swatches = container?.querySelectorAll('.color-swatch-container');
            
            if (!swatches?.length) return;
            
            const [window, widget, accent] = Array.from(swatches).map(
                swatch => swatch.dataset.color
            );

            // Apply colors silently (without individual notifications)
            await Promise.all([
                this.applyColorToSilent('normalWindow', window),
                this.applyColorToSilent('widgetWindow', widget),
                this.applyColorToSilent('accent', accent)
            ]);

            // Show single notification for all changes
            this.showNotification('All colors applied to theme', 'palette');
        } catch (error) {
            console.error('Error applying all colors:', error);
        }
    }

    // Add this new "silent" version that doesn't show notifications
    async applyColorToSilent(element, color) {
        const pickerMappings = {
            normalWindow: '.preview-window:not(.widget) .titlebar-color-picker',
            widgetWindow: '.preview-window.widget .titlebar-color-picker',
            accent: '#accentColor',
            text: '.preview-window:not(.widget) .text-color-picker'
        };

        const picker = document.querySelector(pickerMappings[element]);
        if (picker) {
            picker.value = color;
            picker.dispatchEvent(new Event('input'));
            this.currentPreview.colors[element] = color;
            this.updatePreviewDisplay();
        }
    }

    async applyColorTo(element, color) {
        console.log('Applying color:', color, 'to element:', element);
        const pickerMappings = {
            normalWindow: '.preview-window:not(.widget) .titlebar-color-picker',
            widgetWindow: '.preview-window.widget .titlebar-color-picker',
            accent: '#accentColor',
            text: '.preview-window:not(.widget) .text-color-picker'
        };

        const picker = document.querySelector(pickerMappings[element]);
        if (picker) {
            picker.value = color;
            picker.dispatchEvent(new Event('input'));
            
            // Update theme preview manager
            this.currentPreview.colors[element] = color;
            this.updatePreviewDisplay();
            
            this.showNotification(`Color applied to ${element}`, 'format_color_fill');
        }
    }

    showNotification(message, icon = 'check_circle') {
        const notification = document.createElement('div');
        notification.className = 'color-notification';
        notification.innerHTML = `
            <span class="material-symbols-outlined">${icon}</span>
            ${message}
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    // Now initialize the bindings after all methods are defined
    initialize() {
        // Bind all methods
        this.applyAllColors = this.applyAllColors.bind(this);
        this.applyColorTo = this.applyColorTo.bind(this);
        this.showNotification = this.showNotification.bind(this);
        
        console.log('Methods after binding:', {
            applyAllColors: typeof this.applyAllColors,
            applyColorTo: typeof this.applyColorTo,
            showNotification: typeof this.showNotification
        });
    }

    async applyTheme(theme) {
        window.applyThemeToUI(theme);
        this.updatePreviewDisplay();
    }

    // And let's add the notification method
    showThemeAppliedNotification(themeName) {
        const notification = document.createElement('div');
        notification.className = 'color-notification';
        notification.innerHTML = `
            <span class="material-symbols-outlined">style</span>
            Theme "${themeName}" applied
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

async saveTheme(name, theme) {
        const themeId = `theme-${Date.now()}`;
        const fullTheme = {
            ...theme,
            name,
            id: themeId
        };

        try {
            const themes = await window.electronAPI.store.get('themes') || {};
            themes[themeId] = fullTheme;
            await window.electronAPI.store.set('themes', themes);
            await window.electronAPI.store.set('currentTheme', themeId);
            
            // Only refresh if control panel is open
            const controlPanel = document.getElementById('controlPanel');
            if (controlPanel && controlPanel.style.display !== 'none') {
                if (window.refreshThemeGridDisplay) {
                    await window.refreshThemeGridDisplay();
                }
            }
            
            return themeId;
        } catch (error) {
            console.error('Error saving theme:', error);
            return null;
        }
    }

    async shouldAutoApplyTheme() {
        const autoApplyToggle = document.getElementById('autoApplyColors');
        if (autoApplyToggle) {
            return autoApplyToggle.checked;
        }
        // Fallback to checking store directly
        return await window.electronAPI.store.get('autoApplyWallpaperColors') || false;
    }

    // Add these methods after the constructor
    async handleWallpaperUpdate(wallpaperUrl, wallpaperName = '') {
        const extractionResult = await this.colorManager.extractColors(wallpaperUrl);
        if (!extractionResult) return;

        const { colors, metadata } = extractionResult;
        await this.displayExtractedColors(colors, metadata);

        if (await this.shouldAutoApplyTheme()) {
            await this.generateAndApplyTheme(colors, wallpaperName);
        }
    }

    // async displayExtractedColors(colors, metadata) {
    //     const container = document.getElementById('extractedColors');
    //     if (!container) return;

    //     container.innerHTML = `
    //         <div class="extracted-colors-header">
    //             <span>Extracted Colors</span>
    //             <div class="color-actions">
    //                 <button class="apply-all-btn" onclick="themePreviewManager.applyAllColors()">
    //                     <span class="material-symbols-outlined">palette</span>
    //                     Apply All
    //                 </button>
    //             </div>
    //         </div>
    //         <div class="color-palette">
    //             ${colors.map((color, index) => this.createColorSwatch(color, Object.values(metadata)[index])).join('')}
    //         </div>
    //     `;

    //     // Animate swatches appearance
    //     requestAnimationFrame(() => {
    //         container.querySelectorAll('.color-swatch').forEach((swatch, i) => {
    //             swatch.style.animation = `fadeInScale 0.3s ${i * 0.1}s forwards`;
    //         });
    //     });
    // }

    // createColorSwatch(color, description) {
    //     return `
    //         <div class="color-swatch-container" data-color="${color}">
    //             <div class="color-swatch" 
    //                  style="background-color: ${color};"
    //                  title="${description}">
    //                 <div class="swatch-actions">
    //                     <button onclick="themePreviewManager.copyColorCode('${color}')" 
    //                             class="action-btn" title="Copy color code">
    //                         <span class="material-symbols-outlined">content_copy</span>
    //                     </button>
    //                     <button onclick="themePreviewManager.showColorMenu('${color}')" 
    //                             class="action-btn" title="Apply color">
    //                         <span class="material-symbols-outlined">format_color_fill</span>
    //                     </button>
    //                 </div>
    //             </div>
    //             <div class="color-info">
    //                 <span class="color-code">${color}</span>
    //                 <span class="color-description">${description}</span>
    //             </div>
    //         </div>
    //     `;
    // }

    

    createColorSwatch(color, description) {
        return `
            <div class="color-swatch-container" data-color="${color}">
                <div class="color-swatch" 
                     style="background-color: ${color};"
                     title="${description}">
                    <div class="swatch-actions">
                        <button onclick="window.themePreviewManager.copyColorCode('${color}')" 
                                class="action-btn" title="Copy color code">
                            <span class="material-symbols-outlined">content_copy</span>
                        </button>
                        <button onclick="window.themePreviewManager.showColorMenu('${color}')" 
                                class="action-btn" title="Apply color">
                            <span class="material-symbols-outlined">format_color_fill</span>
                        </button>
                    </div>
                </div>
                <div class="color-info">
                    <span class="color-code">${color}</span>
                    <span class="color-description">${description}</span>
                </div>
            </div>
        `;
    }

    // displayExtractedColors(colors, metadata) {
    //     const container = document.getElementById('extractedColors');
    //     if (!container) return;

    //     container.innerHTML = `
    //         <div class="extracted-colors-header">
    //             <span>Extracted Colors</span>
    //             <div class="color-actions">
    //                 <button onclick="window.themePreviewManager.applyAllColors()" class="apply-all-btn">
    //                     <span class="material-symbols-outlined">palette</span>
    //                     Apply All
    //                 </button>
    //             </div>
    //         </div>
    //         <div class="color-palette">
    //             ${colors.map((color, index) => this.createColorSwatch(color, Object.values(metadata)[index])).join('')}
    //         </div>
    //     `;

    //     // Animate swatches appearance
    //     requestAnimationFrame(() => {
    //         container.querySelectorAll('.color-swatch').forEach((swatch, i) => {
    //             swatch.style.animation = `fadeInScale 0.3s ${i * 0.1}s forwards`;
    //         });
    //     });
    // }

    displayExtractedColors(colors, metadata) {
        const container = document.getElementById('extractedColors');
        if (!container) return;

        container.innerHTML = `
            <div class="extracted-colors-header">
                <span>Extracted Colors</span>
                <div class="color-actions">
                    <button onclick="(function(){
                        const tm = window.themePreviewManager;
                        if (tm && typeof tm.applyAllColors === 'function') {
                            tm.applyAllColors().catch(console.error);
                        } else {
                            console.error('ThemePreviewManager or method not found');
                        }
                    })()" class="apply-all-btn">
                        <span class="material-symbols-outlined">palette</span>
                        Apply All
                    </button>
                </div>
            </div>
            <div class="color-palette">
                ${colors.map((color, index) => this.createColorSwatch(color, Object.values(metadata)[index])).join('')}
            </div>
        `;

        requestAnimationFrame(() => {
            container.querySelectorAll('.color-swatch').forEach((swatch, i) => {
                swatch.style.animation = `fadeInScale 0.3s ${i * 0.1}s forwards`;
            });
        });
    }

    async generateAndApplyTheme(colors, baseName = '') {
        const themeName = this.generateThemeName(baseName);
        const theme = this.createThemeFromColors(colors);

        await this.saveTheme(themeName, theme);
        await this.applyTheme(theme);
        this.showThemeAppliedNotification(themeName);
    }

    generateThemeName(baseName) {
        const name = baseName || 'Wallpaper Theme';
        return name.split('.')[0].substring(0, 16);
    }

    createThemeFromColors(colors) {
        const [dominant, shifted, accent, light, dark] = colors;
        return {
            colors: {
                normalWindow: dominant,
                widgetWindow: shifted,
                accent: accent,
                text: this.colorManager.getContrastColor(dominant),
                textWidget: this.colorManager.getContrastColor(shifted)
            },
            transparency: {
                windows: 0.95,
                widgets: 0.90
            }
        };
    }

    showColorMenu(color) {
        const menu = document.createElement('div');
        menu.className = 'color-apply-menu animate-in';
        menu.innerHTML = this.createColorMenuContent(color);
        
        document.body.appendChild(menu);
        
        // Position menu near click
        const event = window.event; // Get the current event
        if (event) {
            const x = event.clientX;
            const y = event.clientY;
            
            const rect = menu.getBoundingClientRect();
            let posX = x + 10;
            let posY = y + 10;

            // Keep menu in viewport
            if (posX + rect.width > window.innerWidth) {
                posX = window.innerWidth - rect.width - 10;
            }
            if (posY + rect.height > window.innerHeight) {
                posY = window.innerHeight - rect.height - 10;
            }

            menu.style.left = `${posX}px`;
            menu.style.top = `${posY}px`;
        }

        // Setup close handler
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.classList.add('animate-out');
                setTimeout(() => menu.remove(), 200);
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    // createColorMenuContent(color) {
    //     return `
    //         <div class="menu-header">
    //             <div class="color-preview" style="background-color: ${color}"></div>
    //             <span class="color-code">${color}</span>
    //         </div>
    //         <div class="menu-options">
    //             ${[
    //                 ['Window Background', 'normalWindow', 'window'],
    //                 ['Widget Background', 'widgetWindow', 'widgets'],
    //                 ['Accent Color', 'accent', 'palette'],
    //                 ['Text Color', 'text', 'text_fields']
    //             ].map(([label, key, icon]) => `
    //                 <button onclick="window.themePreviewManager.applyColorTo('${key}', '${color}')"
    //                         class="menu-option">
    //                     <span class="material-symbols-outlined">${icon}</span>
    //                     <span>${label}</span>
    //                 </button>
    //             `).join('')}
    //         </div>
    //     `;
    // }

    // createColorMenuContent(color) {
    //     const self = this;  // Store reference to ThemePreviewManager instance
    //     return `
    //         <div class="menu-header">
    //             <div class="color-preview" style="background-color: ${color}"></div>
    //             <span class="color-code">${color}</span>
    //         </div>
    //         <div class="menu-options">
    //             ${[
    //                 ['Window Background', 'normalWindow', 'window'],
    //                 ['Widget Background', 'widgetWindow', 'widgets'],
    //                 ['Accent Color', 'accent', 'palette'],
    //                 ['Text Color', 'text', 'text_fields']
    //             ].map(([label, key, icon]) => `
    //                 <button class="menu-option" 
    //                         data-color="${color}" 
    //                         data-target="${key}"
    //                         onclick="(function(e) { 
    //                             window.themePreviewManager.applyColorTo('${key}', '${color}')
    //                                 .catch(console.error);
    //                         })(event)">
    //                     <span class="material-symbols-outlined">${icon}</span>
    //                     <span>${label}</span>
    //                 </button>
    //             `).join('')}
    //         </div>
    //     `;
    // }

    createColorMenuContent(color) {
        return `
            <div class="menu-header">
                <div class="color-preview" style="background-color: ${color}"></div>
                <span class="color-code">${color}</span>
            </div>
            <div class="menu-options">
                ${[
                    ['Window Background', 'normalWindow', 'window'],
                    ['Widget Background', 'widgetWindow', 'widgets'],
                    ['Accent Color', 'accent', 'palette'],
                    ['Text Color', 'text', 'text_fields']
                ].map(([label, key, icon]) => `
                    <button class="menu-option" 
                            data-color="${color}" 
                            data-target="${key}"
                            onclick="(function(){
                                const tm = window.themePreviewManager;
                                if (tm && typeof tm.applyColorTo === 'function') {
                                    tm.applyColorTo('${key}', '${color}').catch(console.error);
                                } else {
                                    console.error('ThemePreviewManager or method not found');
                                }
                            })()">
                        <span class="material-symbols-outlined">${icon}</span>
                        <span>${label}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    getColorApplicationOptions(color) {
        return [
            ['Window Background', 'normalWindow'],
            ['Widget Background', 'widgetWindow'],
            ['Accent Color', 'accent'],
            ['Text Color', 'text']
        ].map(([label, key]) => `
            <button onclick="themePreviewManager.applyColorTo('${key}', '${color}')"
                    class="menu-option">
                <span class="material-symbols-outlined">${this.getOptionIcon(key)}</span>
                <span>${label}</span>
            </button>
        `).join('');
    }

    getOptionIcon(key) {
        const icons = {
            normalWindow: 'window',
            widgetWindow: 'widgets',
            accent: 'palette',
            text: 'text_fields'
        };
        return icons[key] || 'format_color_fill';
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

// window.ThemePreviewManager = ThemePreviewManager;
// window.refreshThemeGridDisplay = refreshThemeGridDisplay;
window.ThemePreviewManager = ThemePreviewManager;
window.themePreviewManager = new ThemePreviewManager(); // Create global instance
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

console.log('ThemePreviewManager methods:', Object.getOwnPropertyNames(ThemePreviewManager.prototype));
console.log('themePreviewManager instance:', window.themePreviewManager);
console.log('Theme Manager registration complete. Window.ThemePreviewManager:', typeof window.ThemePreviewManager);

// At the bottom of themeManager.js
// if (!window.themePreviewManager) {
//     console.log('Initializing ThemePreviewManager...');
//     window.themePreviewManager = new ThemePreviewManager();
    
//     // For debugging
//     window.debugThemeManager = () => {
//         console.log('ThemePreviewManager instance:', window.themePreviewManager);
//         console.log('Available methods:', Object.getOwnPropertyNames(ThemePreviewManager.prototype));
//         console.log('Current instance methods:', Object.getOwnPropertyNames(window.themePreviewManager));
//     };
// }
window.themePreviewManager.checkMethods();
// // Call debug immediately
// window.debugThemeManager();
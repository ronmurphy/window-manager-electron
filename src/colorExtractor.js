/* eslint-disable no-undef */
class ColorExtractor {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.colorCache = new Map();
    }

    async extractColors(imageUrl) {
        // Check cache first
        if (this.colorCache.has(imageUrl)) {
            return this.colorCache.get(imageUrl);
        }

        try {
            const img = await this.loadImage(imageUrl);
            
            // Set canvas size - use smaller dimensions for performance
            const width = 200;
            const height = (img.height / img.width) * width;
            this.canvas.width = width;
            this.canvas.height = height;
            
            // Draw image to canvas
            this.ctx.drawImage(img, 0, 0, width, height);
            
            // Get image data
            const imageData = this.ctx.getImageData(0, 0, width, height).data;
            const colors = this.processImageData(imageData);
            
            // Cache the results
            this.colorCache.set(imageUrl, colors);
            
            return colors;
        } catch (error) {
            console.error('Error extracting colors:', error);
            return [];
        }
    }

    processImageData(imageData) {
        const colorCounts = {};
        const colorArray = [];

        // Process pixels
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

        // Find most common color
        const mostCommon = colorArray.sort((a, b) => colorCounts[b] - colorCounts[a])[0];

        // Find second most common and shift it
        const secondMost = colorArray[1];
        const shiftedSecond = this.shiftColor(secondMost);

        // Find rarest color
        const rarest = colorArray.sort((a, b) => colorCounts[a] - colorCounts[b])[0];

        // Find lightest and darkest
        const lightest = colorArray.sort((a, b) => this.colorBrightness(b) - this.colorBrightness(a))[0];
        const darkest = colorArray.sort((a, b) => this.colorBrightness(a) - this.colorBrightness(b))[0];

        return [mostCommon, shiftedSecond, rarest, lightest, darkest];
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

    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    colorBrightness(hex) {
        const rgb = this.hexToRgb(hex);
        return rgb ? (rgb.r + rgb.g + rgb.b) / 3 : 0;
    }

    shiftColor(hex) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return hex;

        // Shift by 30 like in your original code
        const shifted = {
            r: Math.min(rgb.r + 30, 255),
            g: Math.min(rgb.g + 30, 255),
            b: Math.min(rgb.b + 30, 255)
        };

        return this.rgbToHex(shifted.r, shifted.g, shifted.b);
    }

    getContrastColor(hex) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return '#FFFFFF';
        
        // Calculate relative luminance
        const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        return luminance > 0.5 ? '#000000' : '#FFFFFF';
    }

    generateTheme(colors) {
        if (!colors || colors.length < 5) return null;

        const [dominant, shifted, accent, lightest, darkest] = colors;
        
        // Use dominant color for window background
        const windowBg = dominant;
        
        // Use shifted color for widget background
        const widgetBg = shifted;
        
        // Use rarest color as accent
        const accentColor = accent;
        
        // Use appropriate contrast colors for text
        const textColor = this.getContrastColor(windowBg);
        const widgetTextColor = this.getContrastColor(widgetBg);

        return {
            colors: {
                normalWindow: windowBg,
                widgetWindow: widgetBg,
                accent: accentColor,
                text: textColor,
                widgetText: widgetTextColor,
                textMuted: this.adjustAlpha(textColor, 0.6)
            },
            transparency: {
                windows: 0.95,
                widgets: 0.90
            }
        };
    }

    adjustAlpha(color, alpha) {
        const rgb = this.hexToRgb(color);
        if (!rgb) return color;
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }

    // Debug method to visualize extracted colors
    async visualizeColors(imageUrl) {
        const colors = await this.extractColors(imageUrl);
        console.log('Extracted colors:', colors);
        return colors.map(color => ({
            color,
            contrast: this.getContrastColor(color)
        }));
    }
}

// Initialize and export
window.ColorExtractor = ColorExtractor;
window.colorExtractor = new ColorExtractor();
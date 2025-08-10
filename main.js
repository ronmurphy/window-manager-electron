/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

const { app, BrowserWindow, globalShortcut, ipcMain, screen, session, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const si = require('systeminformation');
const { spawn } = require("child_process");


const { ElectronBlocker, fullLists } = require('@ghostery/adblocker-electron');
const { fetch } = require('cross-fetch');
const { readFileSync, writeFileSync } = require("original-fs");


let powershell;

// Global variables
let store;
let mainWindow;

// import { ElectronBlocker } from '@ghostery/adblocker-electron';
// import fetch from 'cross-fetch'; // required 'fetch'

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // Single app.whenReady() call
    app.whenReady().then(async () => {
        try {
            // Initialize store first
            await initializeStore();
            // await reinitializeStore();

            // Set up session permissions
            session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
                callback(true);
            });

            // Add CSP configuration here
            session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
                callback({
                    responseHeaders: {
                        ...details.responseHeaders,
                        'Content-Security-Policy': [
                            "default-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
                            "style-src 'self' 'unsafe-inline'; " +
                            "font-src 'self' data: https://fonts.gstatic.com; " +
                            "img-src 'self' data: blob:;"
                        ]
                    }
                });
            });

            // Create the main window
            await createWindow();

        } catch (error) {
            console.error('Error during app initialization:', error);
        }
    });

    app.on('window-all-closed', function () {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    app.on('will-quit', () => {
        globalShortcut.unregisterAll();
    });
}

// Store initialization
async function initializeStore() {
    const Store = await import('electron-store');
    store = new Store.default({
        defaults: {
            modules: [],
            settings: {
                theme: 'default',
                buttonPosition: 'bottom-right',
                showClock: true
            },
            layouts: [],
            currentTheme: 'default',
            themes: {
                'default': {
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
                },
                'light': {
                    name: 'Default Light',
                    colors: {
                        normalWindow: '#F0F0F0',
                        widgetWindow: '#FFFFFF',
                        accent: '#0066CC',
                        text: '#000000',
                        textMuted: '#666666'
                    },
                    transparency: {
                        windows: 0.98,
                        widgets: 0.95
                    }
                },
                'windows': {
                    name: 'Windows Modern',
                    colors: {
                        normalWindow: '#202020',
                        widgetWindow: '#2C2C2C',
                        accent: '#00B4FF',
                        text: '#FFFFFF',
                        textMuted: '#999999'
                    },
                    transparency: {
                        windows: 0.92,
                        widgets: 0.88
                    }
                },
                'macos': {
                    name: 'macOS Style',
                    colors: {
                        normalWindow: '#28282B',
                        widgetWindow: '#323236',
                        accent: '#FF9500',
                        text: '#FFFFFF',
                        textMuted: '#A0A0A0'
                    },
                    transparency: {
                        windows: 0.85,
                        widgets: 0.80
                    }
                }
            },
            wallpapers: []
        }
    });
}



// Window creation
async function createWindow() {

    // await enableAdBlocker();


    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // Set default webview permissions
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': ['default-src * data: blob: filesystem: about: ws: wss: \'unsafe-inline\' \'unsafe-eval\'']
            }
        });
    });

    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'src/preload.js'),
            webviewTag: true,
            sandbox: false,
            webSecurity: false,
            allowRunningInsecureContent: true,
            experimentalFeatures: true,
            titleBarStyle: 'hidden',
            enableWebSQL: false,
            additionalArguments: ['--enable-features=WebviewTag,WebNavigation'],
            permissions: [
                'webNavigation',
                'webRequest',
                'geolocation',
                'fullscreen',
                'notifications'
            ]
        },
        frame: false,
    });

    Menu.setApplicationMenu(null);

    mainWindow.webContents.openDevTools();

    // Set up webview permissions
    mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
        webContents.setWindowOpenHandler(() => ({ action: 'allow' }));

        const ses = webContents.session;
        ses.setPermissionRequestHandler((webContents, permission, callback) => {
            callback(true);
        });

        ses.webRequest.onBeforeRequest((details, callback) => {
            callback({ cancel: false });
        });
    });

    // Handle security warnings
    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
        event.preventDefault();
        callback(true);
    });


    // Enable web navigation
    mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        callback({ cancel: false });
    });

    // Log window position for debugging
    mainWindow.webContents.on('dom-ready', () => {
        console.log('Window position:', mainWindow.getPosition());
    });

    // Load the app
    mainWindow.loadFile('src/index.html');

    // Initialize the ad blocker
    let blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch); // ads only
    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch); // ads and tracking

    globalShortcut.register('CommandOrControl+Shift+S', () => {
        mainWindow.webContents.send('capture-screenshot');
    });
}

ipcMain.on('save-screenshot', async (event, imageBuffer) => {
    try {
        const result = await dialog.showSaveDialog({
            title: 'Save Screenshot',
            defaultPath: `screenshot-${Date.now()}.png`,
            filters: [{ name: 'Images', extensions: ['png'] }]
        });

        if (!result.canceled) {
            await fs.writeFile(result.filePath, imageBuffer);
        }
    } catch (error) {
        console.error('Error saving screenshot:', error);
    }
});

// IPC Handlers
ipcMain.handle('get-system-info', async () => {
    try {
        const [system, os, cpu, memory, graphics, disk, fsSize, network, battery] = await Promise.all([
            si.system(),
            si.osInfo(),
            si.cpu(),
            si.mem(),
            si.graphics(),
            si.diskLayout(),
            si.fsSize(),
            si.networkInterfaces(),
            si.battery()
        ]);

        return {
            system,
            os,
            cpu,
            memory,
            graphics,
            disk,
            fsSize,
            network,
            battery,
            uptime: os.uptime
        };
    } catch (error) {
        console.error('Error getting system info:', error);
        return null;
    }
});

// Store operations
ipcMain.handle('store:get', async (event, key) => {
    if (!store) return null;
    const value = store.get(key);
    console.log(`Retrieved from store - ${key}:`, value);
    return value;
});

ipcMain.handle('store:set', async (event, key, value) => {
    if (!store) return false;
    console.log(`Saving to store - ${key}:`, value);
    store.set(key, value);
    return true;
});

// In main.js - Add new IPC handlers
ipcMain.handle('get-app-path', () => {
    return app.getAppPath();
});

ipcMain.handle('test-path', async (event, testPath) => {
    try {
        await fs.access(testPath);
        return { exists: true };
    } catch {
        return { exists: false };
    }
});


ipcMain.handle('read-file', async (event, filePath) => {
    try {
        // Resolve the path relative to the app path
        const resolvedPath = path.resolve(app.getAppPath(), filePath);
        console.log('Reading file from:', resolvedPath);

        const content = await fs.readFile(resolvedPath, 'utf8');
        return content;
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        throw error;
    }
});

ipcMain.handle('test-fs', async () => {
    try {
        const testPath = path.join(app.getAppPath(), 'test.txt');
        await fs.writeFile(testPath, 'Test content');
        const content = await fs.readFile(testPath, 'utf8');
        await fs.unlink(testPath); // Clean up
        return { success: true, message: 'File system test passed' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Add this function to help with path resolution
function resolveWidgetPath(widgetPath) {
    const appRoot = app.getAppPath();
    return path.join(appRoot, widgetPath);
}

ipcMain.handle('write-file', async (event, path, content) => {
    await fs.writeFile(path, content, 'utf8');
    return true;
});

// Window management
ipcMain.handle('webview-navigate', async (event, url) => {
    try {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
            const webContents = window.webContents;
            await webContents.loadURL(url);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Navigation error:', error);
        return false;
    }
});

ipcMain.on('app-shutdown', () => {
    app.quit();
});

ipcMain.on('app-restart', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows.forEach(win => win.close());
    }
    app.relaunch();
    app.exit();
});

ipcMain.on('toggle-dev-tools', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        win.webContents.toggleDevTools();
    }
});

// Widget management
ipcMain.handle('get-widgets-list', async () => {
    try {
        const widgetsDir = path.join(__dirname, 'src', 'widgets');
        const entries = await fs.readdir(widgetsDir, { withFileTypes: true });

        const widgets = [];
        for (const entry of entries) {
            if (entry.isDirectory()) {
                try {
                    const configPath = path.join(widgetsDir, entry.name, 'widget.json');
                    const configData = await fs.readFile(configPath, 'utf8');
                    const config = JSON.parse(configData);
                    widgets.push({
                        name: config.name,
                        path: `widgets/${entry.name}/index.html`,
                        icon: config.icon,
                        description: config.description
                    });
                } catch (error) {
                    console.error(`Error loading widget ${entry.name}:`, error);
                }
            }
        }
        return widgets;
    } catch (error) {
        console.error('Error scanning widgets directory:', error);
        return [];
    }
});

// Dialog handlers
ipcMain.handle('open-file-dialog', async (event, options = {}) => {
    try {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: options.filters || [
                {
                    name: 'Images',
                    extensions: ['jpg', 'jpeg', 'png', 'gif']
                }
            ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
            return {
                path: result.filePaths[0],
                content: await fs.readFile(result.filePaths[0], 'utf8')
            };
        }
        return null;
    } catch (error) {
        console.error('Error in open-file-dialog:', error);
        throw error;
    }
});

ipcMain.handle('save-file-dialog', async (event, content) => {
    try {
        const result = await dialog.showSaveDialog({
            filters: [
                { name: 'Text Files', extensions: ['txt'] }
            ]
        });

        if (!result.canceled) {
            await fs.writeFile(result.filePath, content, 'utf8');
            return {
                path: result.filePath,
                success: true
            };
        }
        return { success: false };
    } catch (error) {
        console.error('Error in save-file-dialog:', error);
        throw error;
    }
});

// Wallpaper handling
ipcMain.handle('set-wallpaper', async (event, url) => {
    console.log('Main process: setting wallpaper to:', url);
    try {
        // Check if it's a local file path
        if (url.startsWith('file://')) {
            // Convert URL to proper file path format
            const filePath = url.replace('file:///', '').split('/').join(path.sep);
            console.log('Converted file path:', filePath);

            // Check if file exists
            try {
                await fs.access(filePath);
                // File exists, create proper file URL
                const properUrl = `file:///${filePath.split(path.sep).join('/')}`;
                console.log('Proper file URL:', properUrl);

                await mainWindow.webContents.executeJavaScript(`
                    document.body.style.backgroundImage = "url('${properUrl}')";
                    document.body.style.backgroundSize = "cover";
                    document.body.style.backgroundPosition = "center";
                    document.body.style.backgroundRepeat = "no-repeat";
                `);
                return { success: true };
            } catch (error) {
                console.error('File not found:', filePath);
                throw new Error(`File not found: ${filePath}`);
            }
        } else {
            // Handle web URLs normally
            await mainWindow.webContents.executeJavaScript(`
                document.body.style.backgroundImage = "url('${url}')";
                document.body.style.backgroundSize = "cover";
                document.body.style.backgroundPosition = "center";
                document.body.style.backgroundRepeat = "no-repeat";
            `);
            return { success: true };
        }
    } catch (error) {
        console.error('Error setting wallpaper:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-last-wallpaper', async (event, url) => {
    if (!store) return false;
    store.set('lastWallpaper', url);
    return true;
});

// Add these IPC handlers in main.js

ipcMain.handle('save-cursor', async (event, cursorData) => {
    try {
        const cursors = await store.get('cursors') || [];
        cursors.push({
            ...cursorData,
            path: cursorData.path.replace(/\\/g, '/') // Normalize path separators
        });
        await store.set('cursors', cursors);
        return { success: true };
    } catch (error) {
        console.error('Error saving cursor:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('set-cursor', async (event, cursorPath) => {
    try {
        await store.set('currentCursor', cursorPath);
        return { success: true };
    } catch (error) {
        console.error('Error setting cursor:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-cursors', async () => {
    try {
        return await store.get('cursors') || [];
    } catch (error) {
        console.error('Error getting cursors:', error);
        return [];
    }
});

// Add to file dialog handlers
ipcMain.handle('select-cursor-file', async () => {
    try {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Cursors', extensions: ['png', 'cur', 'ani'] }
            ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const cursorPath = result.filePaths[0];
            // Create cursors directory in app data
            const cursorsDir = path.join(app.getPath('userData'), 'cursors');
            await fs.mkdir(cursorsDir, { recursive: true });
            
            // Generate safe filename and path
            const originalName = path.basename(cursorPath);
            const safeName = encodeURIComponent(originalName).replace(/%20/g, '_');
            const destPath = path.join(cursorsDir, safeName);
            
            // Copy file to app's cursor directory
            await fs.copyFile(cursorPath, destPath);
            
            return {
                success: true,
                path: destPath,
                originalPath: cursorPath,
                name: originalName
            };
        }
        return { success: false };
    } catch (error) {
        console.error('Error handling cursor file:', error);
        return { success: false, error: error.message };
    }
});

// Folder operations
ipcMain.handle('scan-widget-folder', async (event, folderPath) => {
    try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        const widgets = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                try {
                    const configPath = path.join(folderPath, entry.name, 'widget.json');
                    const configData = await fs.readFile(configPath, 'utf8');
                    const config = JSON.parse(configData);
                    widgets.push({
                        name: config.name,
                        path: path.join(entry.name, 'index.html'),
                        icon: config.icon,
                        description: config.description
                    });
                } catch (error) {
                    console.error(`Error loading widget ${entry.name}:`, error);
                }
            }
        }
        return widgets;
    } catch (error) {
        console.error('Error scanning folder:', error);
        return [];
    }
});

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    return result.filePaths[0];
});

function startPowershell() {
    if (!powershell) {
        powershell = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "-"]);
        powershell.stdin.setDefaultEncoding('utf-8');

        powershell.stdout.on("data", (data) => {
            // Send the output back to renderer
            mainWindow.webContents.send("command-output", data.toString());
        });

        powershell.stderr.on("data", (data) => {
            // Handle PowerShell errors
            mainWindow.webContents.send("command-output", `Error: ${data.toString()}`);
        });

        powershell.on("exit", () => {
            powershell = null;
        });
    }
}

// Add IPC handler for commands
ipcMain.handle("send-command", async (event, command) => {
    try {
        if (!powershell) startPowershell();

        // Send command to PowerShell process
        powershell.stdin.write(`${command}\n`);

        return `> ${command}\n`;  // Echo command back in terminal UI
    } catch (error) {
        return `Error executing command: ${error.message}`;
    }
});

// Gracefully close PowerShell on app exit
app.on("before-quit", () => {
    if (powershell) powershell.kill();
});

ipcMain.handle('take-screenshot', async () => {
    try {
        const screenshot = await mainWindow.webContents.capturePage();
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Screenshot',
            defaultPath: `screenshot-${Date.now()}.png`,
            filters: [{ name: 'PNG Images', extensions: ['png'] }]
        });

        if (!result.canceled) {
            await fs.writeFile(result.filePath, screenshot.toPNG());
            return { success: true };
        }
        return { success: false, canceled: true };
    } catch (error) {
        console.error('Error handling screenshot:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-current-directory', () => {
    return process.cwd();
});

ipcMain.handle('get-process-info', () => {
    return {
        cwd: process.cwd(),
        platform: process.platform,
        arch: process.arch,
        versions: process.versions
    };
});

ipcMain.handle('create-window', async (event, title, content, position) => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        x: position?.x,
        y: position?.y,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        }
    });

    // Load content
    try {
        // Create temporary file for content
        const tempFile = path.join(app.getPath('temp'), `preview-${Date.now()}.html`);
        await fs.writeFile(tempFile, content);
        await win.loadFile(tempFile);

        // Clean up temp file after loading
        setTimeout(() => fs.unlink(tempFile).catch(console.error), 1000);

        return { success: true };
    } catch (error) {
        console.error('Error creating window:', error);
        throw error;
    }
});

ipcMain.handle('get-home-dir', () => {
    return os.homedir();
});

ipcMain.handle('read-directory', async (event, dirPath) => {
    try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        const itemDetails = await Promise.all(items.map(async (item) => {
            const fullPath = path.join(dirPath, item.name);
            const stats = await fs.stat(fullPath);
            
            return {
                name: item.name,
                path: fullPath,
                isDirectory: item.isDirectory(),
                modified: stats.mtime.toLocaleString(),
                size: item.isDirectory() ? '--' : formatFileSize(stats.size),
                type: item.isDirectory() ? 'Folder' : getFileType(item.name)
            };
        }));

        // Sort directories first, then files
        return itemDetails.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
    } catch (error) {
        console.error('Error reading directory:', error);
        throw error;
    }
});

ipcMain.handle('get-file-stats', async (event, filePath) => {
    try {
        const stats = await fs.stat(filePath);
        return {
            isDirectory: stats.isDirectory(),
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime
        };
    } catch (error) {
        console.error('Error getting file stats:', error);
        throw error;
    }
});

ipcMain.handle('open-file', async (event, filePath) => {
    try {
        await shell.openPath(filePath);
        return true;
    } catch (error) {
        console.error('Error opening file:', error);
        throw error;
    }
});

ipcMain.handle('get-drives', async () => {
    if (process.platform === 'win32') {
        try {
            // Use PowerShell for more reliable info
            const { stdout } = await new Promise((resolve, reject) => {
                const powershell = spawn('powershell.exe', [
                    '-NoProfile',
                    '-Command',
                    'Get-WmiObject Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace | ConvertTo-Json'
                ]);
                
                let output = '';
                powershell.stdout.on('data', (data) => output += data.toString());
                powershell.stderr.on('data', (data) => console.error('PowerShell Error:', data.toString()));
                
                powershell.on('close', (code) => {
                    if (code === 0) resolve({ stdout: output });
                    else reject(new Error(`Process exited with code ${code}`));
                });
            });

            const drives = JSON.parse(stdout);
            return (Array.isArray(drives) ? drives : [drives]).map(drive => ({
                path: drive.DeviceID + '\\',
                label: drive.VolumeName || drive.DeviceID,
                freeSpace: formatFileSize(parseInt(drive.FreeSpace)),
                size: formatFileSize(parseInt(drive.Size)),
                // Include raw values for progress calculation
                rawFreeSpace: parseInt(drive.FreeSpace),
                rawSize: parseInt(drive.Size)
            }));

        } catch (error) {
            console.error('Error getting drives:', error);
            return [];
        }
    } else {
        return [{ path: '/', label: 'Root', freeSpace: '', size: '' }];
    }
});

ipcMain.handle('get-parent-directory', (event, currentPath) => {
    return path.dirname(currentPath);
});

// Helper functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

ipcMain.handle('file-system-get-home', () => {
    return os.homedir();
});

ipcMain.handle('file-system-read-dir', async (event, dirPath) => {
    try {
        // Ensure proper path format for Windows
        // const normalizedPath = dirPath.replace(/\//g, '\\').replace(/\\+$/, '\\');
        const normalizedPath = path.normalize(dirPath);
        const entries = await fs.readdir(normalizedPath, { withFileTypes: true });

        // Get directory contents
        const items = await fs.readdir(normalizedPath, { withFileTypes: true });
        
        const itemDetails = await Promise.all(items.map(async (item) => {
            const fullPath = path.join(normalizedPath, item.name);
            
            // Basic info we can get without stats
            const baseInfo = {
                name: item.name,
                path: fullPath.replace(/\\/g, '/'),
                isDirectory: item.isDirectory(),
                modified: 'Unknown',
                size: item.isDirectory() ? '--' : 'Unknown',
                type: item.isDirectory() ? 'Folder' : getFileType(item.name)
            };

            try {
                // Try to get stats, but don't fail if we can't
                const stats = await fs.stat(fullPath);
                return {
                    ...baseInfo,
                    modified: stats.mtime.toLocaleString(),
                    size: item.isDirectory() ? '--' : formatFileSize(stats.size)
                };
            } catch (error) {
                // Return basic info if we can't get stats
                console.log(`Cannot access stats for ${fullPath}:`, error.code);
                return baseInfo;
            }
        }));

        // Filter out null entries and sort
        return itemDetails
            .filter(item => item !== null)
            .sort((a, b) => {
                // Directories first
                if (a.isDirectory !== b.isDirectory) {
                    return a.isDirectory ? -1 : 1;
                }
                // Case-insensitive natural sort for names
                return a.name.localeCompare(b.name, undefined, { 
                    numeric: true, 
                    sensitivity: 'base'
                });
            });

    } catch (error) {
        console.error('Error reading directory:', error);
        throw new Error(`Cannot read directory: ${error.message}`);
    }
});

// Helper function to check if a path is accessible
async function isPathAccessible(testPath) {
    try {
        await fs.access(testPath, fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
}

ipcMain.handle('file-system-get-stats', async (event, filePath) => {
    try {
        const stats = await fs.stat(filePath);
        return {
            isDirectory: stats.isDirectory(),
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime
        };
    } catch (error) {
        console.error('Error getting file stats:', error);
        throw error;
    }
});

ipcMain.handle('file-system-open', async (event, filePath) => {
    try {
        await shell.openPath(filePath);
        return true;
    } catch (error) {
        console.error('Error opening file:', error);
        throw error;
    }
});

ipcMain.handle('file-system-get-drives', async () => {
    if (process.platform === 'win32') {
        try {
            // Use more reliable drive detection
            const { execSync } = require('child_process');
            const output = execSync('wmic logicaldisk get deviceid, volumename, drivetype', { encoding: 'utf8' });
            
            const drives = output
                .trim()
                .split('\n')
                .slice(1)
                .map(line => {
                    const [deviceId, ...rest] = line.trim().split(/\s+/);
                    if (!deviceId) return null;
                    
                    return {
                        path: `${deviceId}\\`,  // Ensure proper Windows path format
                        label: rest.join(' ').trim() || deviceId,
                        isAccessible: true
                    };
                })
                .filter(drive => drive !== null);

            // Test drive accessibility
            for (const drive of drives) {
                try {
                    await fs.access(drive.path);
                } catch (error) {
                    drive.isAccessible = false;
                }
            }

            return drives;
        } catch (error) {
            console.error('Error detecting drives:', error);
            // Fallback method
            const drives = [];
            for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
                const drivePath = `${letter}:\\`;
                try {
                    await fs.access(drivePath);
                    drives.push({
                        path: drivePath,
                        label: `Local Disk (${letter}:)`,
                        isAccessible: true
                    });
                } catch {}
            }
            return drives;
        }
    } else {
        return [{ path: '/', label: 'Root', isAccessible: true }];
    }
});

ipcMain.handle('file-system-get-parent', (event, currentPath) => {
    return path.dirname(currentPath);
});

ipcMain.handle('file-system-get-special-folder', (event, name) => {
    switch (name) {
        case 'home':
            return app.getPath('home');
        case 'desktop':
            return app.getPath('desktop');
        case 'documents':
            return app.getPath('documents');
        case 'downloads':
            return app.getPath('downloads');
        default:
            return app.getPath('home');
    }
});

// In main.js
ipcMain.handle('path-to-file-url', (event, filepath) => {
    return `file:///${filepath.replace(/\\/g, '/')}`;
});

function getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (!ext) return 'File';
    
    const types = {
        '.txt': 'Text Document',
        '.pdf': 'PDF Document',
        '.doc': 'Word Document',
        '.docx': 'Word Document',
        '.xls': 'Excel Spreadsheet',
        '.xlsx': 'Excel Spreadsheet',
        '.png': 'PNG Image',
        '.jpg': 'JPEG Image',
        '.jpeg': 'JPEG Image',
        '.gif': 'GIF Image',
        '.webp': 'WEBP Image',
        '.mp3': 'MP3 Audio',
        '.mp4': 'MP4 Video',
        '.js': 'JavaScript File',
        '.html': 'HTML File',
        '.css': 'CSS File',
        '.json': 'JSON File',
        '.exe': 'Application',
        '.msi': 'Installer',
        '.zip': 'Archive',
        '.rar': 'Archive',
        '.7z': 'Archive',
        '.iso': 'Disk Image',
        '.dll': 'Library File',
        '.log': 'Log File',
        '.ini': 'Configuration File',
        '.bat': 'Batch File',
        '.ps1': 'PowerShell Script'
    };
    
    return types[ext] || `${ext.slice(1).toUpperCase()} File`;
}


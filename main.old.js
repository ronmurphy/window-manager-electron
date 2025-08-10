const { app, BrowserWindow, ipcMain, session } = require('electron');  // Add session
const path = require('path');
const { screen } = require('electron');

let store;

(async () => {
    const Store = await import('electron-store');
    store = new Store.default({
        defaults: {
            modules: [],
            settings: {
                theme: 'default',
                buttonPosition: 'bottom-right',
                showClock: true
            },
            layouts: []
        }
    });
})();

// IPC handlers for store
ipcMain.handle('store:get', async (event, key) => {
    if (!store) return null;
    return store.get(key);
});

ipcMain.handle('store:set', async (event, key, value) => {
    if (!store) return false;
    store.set(key, value);
    return true;
});

function createWindow() {
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

    const mainWindow = new BrowserWindow({
        width: width,
        height: height,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'src/preload.js'),
            webviewTag: true,
            sandbox: false,
            webSecurity: false,  // Changed to false for development
            allowRunningInsecureContent: true,
            experimentalFeatures: true
        }
    });

    // Set up webview permissions
    mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
        // Set webview-specific preferences
        webContents.setWindowOpenHandler(() => ({ action: 'allow' }));
        
        // Enable all permissions
        const ses = webContents.session;
        ses.setPermissionRequestHandler((webContents, permission, callback) => {
            callback(true);
        });

        // Allow loading content
        ses.webRequest.onBeforeRequest((details, callback) => {
            callback({ cancel: false });
        });
    });

    // Handle security warnings
    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
        event.preventDefault();
        callback(true);
    });

    // Enable DevTools for debugging
    mainWindow.webContents.on('did-frame-finish-load', () => {
        // mainWindow.webContents.openDevTools();
    });

    // Load the app
    mainWindow.loadFile('src/index.html');
}

app.whenReady().then(() => {
    // Set global permissions
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(true);
    });

    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle IPC messages
ipcMain.handle('read-file', async (event, filePath) => {
    const fs = require('fs').promises;
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return content;
    } catch (error) {
        throw error;
    }
});

// Handle webview navigation
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
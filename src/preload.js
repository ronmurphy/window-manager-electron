/* eslint-disable no-undef */

const { contextBridge, ipcRenderer, screen } = require('electron');  // Add screen here
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
    ipcRenderer: ipcRenderer,
    sendCommand: (command) => ipcRenderer.invoke('send-command', command),
    onCommandOutput: (callback) => ipcRenderer.on("command-output", (_, data) => callback(data)),
    send: (channel, data) => ipcRenderer.send(channel, data),
    store: {
        get: (key) => ipcRenderer.invoke('store:get', key),
        set: (key, value) => ipcRenderer.invoke('store:set', key, value)
    },
    getDisplayBounds: () => {
        const primaryDisplay = screen.getPrimaryDisplay();
        return primaryDisplay.workArea;
    },
    getWidgetsList: () => ipcRenderer.invoke('get-widgets-list'),
    scanWidgetFolder: (folderPath) => ipcRenderer.invoke('scan-widget-folder', folderPath),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
    cursor: {
        save: (cursorData) => ipcRenderer.invoke('save-cursor', cursorData),
        set: (cursorPath) => ipcRenderer.invoke('set-cursor', cursorPath),
        get: () => ipcRenderer.invoke('get-cursors'),
        select: () => ipcRenderer.invoke('select-cursor-file')
    },
    createWindow: (title, content, position) =>
        ipcRenderer.invoke('create-window', title, content, position),
    getPreloadPath: () => path.join(__dirname, 'preload.js'),
    resolvePath: (...args) => path.join(...args),
    setWallpaper: (url) => {
        console.log('Preload: sending set-wallpaper with URL:', url);
        return ipcRenderer.invoke('set-wallpaper', url);
    },
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    path: {
        join: (...args) => path.join(...args),
        dirname: (filepath) => path.dirname(filepath),
        basename: (filepath) => path.basename(filepath),
        extname: (filepath) => path.extname(filepath),  // Add this line
        normalize: (filepath) => {
            return filepath.split(path.sep).join('/');
        },
        toFileUrl: (filepath) => {
            const normalized = filepath.split(path.sep).join('/');
            return `file:///${normalized}`;
        },
        fromFileUrl: (fileUrl) => {
            return fileUrl.replace('file:///', '').split('/').join(path.sep);
        }
    },
    getDisplays: () => ipcRenderer.invoke('get-displays'),
    captureScreen: (bounds) => ipcRenderer.invoke('capture-screen', bounds),
    captureScreenshot: () => ipcRenderer.send('capture-screenshot'),
    onCaptureScreenshot: (callback) => ipcRenderer.on('capture-screenshot', callback),
    takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
    getAppPath: () => ipcRenderer.invoke('get-app-path'),
    getAbsolutePath: (relativePath) => {
        const appPath = app.getAppPath();
        return path.join(appPath, relativePath);
    },
    requireModule: (moduleName) => {
        try {
            return require(moduleName);
        } catch (error) {
            console.error(`Error requiring module ${moduleName}:`, error);
            return null;
        }
    },
    resolveModulePath: (moduleName) => {
        try {
            return require.resolve(moduleName);
        } catch (error) {
            console.error(`Error resolving module path ${moduleName}:`, error);
            return null;
        }
    },
    readFile: async (filePath) => {
        try {
            console.log('Attempting to read file:', filePath);
            return await ipcRenderer.invoke('read-file', filePath);
        } catch (error) {
            console.warn(`Could not read file at ${filePath}:`, error);
            throw error;
        }
    },
    getCurrentDirectory: () => ipcRenderer.invoke('get-current-directory'),
    getProcessInfo: () => ipcRenderer.invoke('get-process-info'),
    testPath: (path) => ipcRenderer.invoke('test-path', path),
    testFS: () => ipcRenderer.invoke('test-fs'),
    writeFile: async (filePath, content) => {
        try {
            return await ipcRenderer.invoke('write-file', filePath, content);
        } catch (error) {
            console.error('Error writing file:', error);
            throw error;
        }
    },
    // Dialog operations
    saveFileDialog: async (options) => {
        try {
            return await ipcRenderer.invoke('save-file-dialog', options);
        } catch (error) {
            console.error('Error in save dialog:', error);
            throw error;
        }
    },
    // Path operations
    resolveFilePath: (filePath) => {
        try {
            return path.resolve(filePath);
        } catch (error) {
            console.error('Error resolving path:', error);
            throw error;
        }
    },
    getDirname: (filePath) => {
        try {
            return path.dirname(filePath);
        } catch (error) {
            console.error('Error getting dirname:', error);
            throw error;
        }
    },
    // Preview window operations
    createPreviewWindow: async (title, content, position) => {
        try {
            return await ipcRenderer.invoke('create-preview-window', title, content, position);
        } catch (error) {
            console.error('Error creating preview window:', error);
            throw error;
        }
    },
    fileSystem: {
        getHomeDir: () => ipcRenderer.invoke('file-system-get-home'),
        readDirectory: (path) => ipcRenderer.invoke('file-system-read-dir', path),
        getFileStats: (path) => ipcRenderer.invoke('file-system-get-stats', path),
        openFile: (path) => ipcRenderer.invoke('file-system-open', path),
        getDrives: () => ipcRenderer.invoke('file-system-get-drives'),
        getParentDirectory: (path) => ipcRenderer.invoke('file-system-get-parent', path),
        getSpecialFolder: (name) => ipcRenderer.invoke('file-system-get-special-folder', name)
    },
    getHomeDir: () => ipcRenderer.invoke('get-home-dir'),
    readDirectory: (path) => ipcRenderer.invoke('read-directory', path),
    getFileStats: (path) => ipcRenderer.invoke('get-file-stats', path),
    openFile: (path) => ipcRenderer.invoke('open-file', path),
    getDrives: () => ipcRenderer.invoke('get-drives'),
    getParentDirectory: (path) => ipcRenderer.invoke('get-parent-directory', path),
    // Additional utility methods
    isDirectory: (path) => ipcRenderer.invoke('is-directory', path),
    getFileSize: (path) => ipcRenderer.invoke('get-file-size', path),
    getFileType: (path) => ipcRenderer.invoke('get-file-type', path),
    pathToFileUrl: (filepath) => {
        return ipcRenderer.invoke('path-to-file-url', filepath);
    }
});
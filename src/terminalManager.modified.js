/* eslint-disable no-case-declarations */
/* eslint-disable no-undef */
console.log('Loading Terminal Manager...');

class TerminalManager {
    constructor() {
        this.windows = new Map();
        this.currentCommand = '';
        this.commandHistory = [];
        this.historyIndex = -1;
        this.maxOutputLines = 1000;
    }

    initialize() {
        console.log('Initializing TerminalManager...');
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.electronAPI.onCommandOutput((output) => {
            this.handleCommandOutput(output);
        });
    }

    createTerminalWindow() {
        const windowId = 'terminal';
        const windowHtml = `
            <div class="window terminal-window" id="${windowId}">
                <div class="window-header">
                    <div class="window-title">
                        <span class="material-symbols-outlined">terminal</span>
                        Terminal
                    </div>
                    <div class="window-controls">
                        <button onclick="terminalManager.toggleDevTools()" title="Developer Tools">
                            <span class="material-symbols-outlined">jump_to_element</span>
                        </button>
                        <button onclick="terminalManager.minimizeTerminal()" title="Minimize">
                            <span class="material-symbols-outlined">remove</span>
                        </button>
                        <button onclick="terminalManager.closeTerminal()" title="Close">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                </div>
                <div class="terminal-container">
                    <div class="terminal-scroll-area">
                        <div class="terminal-output" id="terminalOutput"></div>
                    </div>
                    <div class="terminal-input-area">
                        <span class="terminal-prompt">></span>
                        <input type="text" id="terminal-input" placeholder="Enter command" />
                    </div>
                </div>
                <div class="resize-handle"></div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', windowHtml);
        const panel = document.getElementById(windowId);

        // Set initial size and position
        panel.style.width = '800px';
        panel.style.height = '500px';
        panel.style.left = '50px';
        panel.style.top = '50px';

        // Make window draggable and snappable using existing WindowManager
        makeDraggable(panel);
        this.setupResizing(panel);

        this.setupTerminalInput();

        // Register with window management
        windows.set(windowId, {
            title: 'Terminal',
            minimized: false,
            isWidget: false
        });

        this.windows.set(windowId, panel);
        panel.style.display = 'block';
        
        // Bring window to front
        WindowManager.bringToFront(panel);

        // Apply current theme
        this.applyCurrentTheme();
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

            const newWidth = Math.max(400, startWidth + (e.clientX - startX));
            const newHeight = Math.max(300, startHeight + (e.clientY - startY));
            
            panel.style.width = `${newWidth}px`;
            panel.style.height = `${newHeight}px`;
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
            panel.style.transition = '';
        });
    }

    async applyCurrentTheme() {
        const currentTheme = await window.getCurrentTheme();
        if (currentTheme) {
            const terminal = document.getElementById('terminal');
            if (terminal) {
                const titlebar = terminal.querySelector('.window-header');
                if (titlebar) {
                    updateTitlebarStyle(titlebar, currentTheme, false);
                }
            }
        }
    }

    setupTerminalInput() {
        const input = document.getElementById("terminal-input");
        const output = document.getElementById("terminalOutput");

        if (!input || !output) return;

        input.addEventListener("keydown", async (event) => {
            switch (event.key) {
                case "Enter":
                    const command = input.value.trim();
                    if (command) {
                        this.commandHistory.push(command);
                        this.historyIndex = this.commandHistory.length;
                        await this.executeCommand(command);
                        input.value = "";
                    }
                    break;

                case "ArrowUp":
                    event.preventDefault();
                    if (this.historyIndex > 0) {
                        this.historyIndex--;
                        input.value = this.commandHistory[this.historyIndex];
                    }
                    break;

                case "ArrowDown":
                    event.preventDefault();
                    if (this.historyIndex < this.commandHistory.length - 1) {
                        this.historyIndex++;
                        input.value = this.commandHistory[this.historyIndex];
                    } else {
                        this.historyIndex = this.commandHistory.length;
                        input.value = '';
                    }
                    break;
            }
        });
    }

    async neofetch() {
        const userAgent = navigator.userAgent;
        const platform = navigator.platform || "Unknown";
        const language = navigator.language || "Unknown";
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        const colorDepth = window.screen.colorDepth;
        const memory = navigator.deviceMemory || "Unknown";
        const cores = navigator.hardwareConcurrency || "Unknown";
        const onlineStatus = navigator.onLine ? "Online" : "Offline";

        // Try GPU info (Experimental)
        let gpuInfo = "Unavailable";
        if (navigator.gpu) {
            const adapter = await navigator.gpu.requestAdapter();
            gpuInfo = adapter ? adapter.name : "Unavailable";
        }

        const asciiArt = `
  _______  _______  _______  _______ 
 |       ||   _   ||       ||       |
 |    ___||  |_|  ||_     _||  _____|
 |   |___ |       |  |   |  | |_____ 
 |    ___||       |  |   |  |_____  |
 |   |    |   _   |  |   |   _____| |
 |___|    |__| |__|  |___|  |_______|
`;

        const info = `
${asciiArt}
User Agent: ${userAgent}
Platform: ${platform}
Language: ${language}
Screen: ${screenWidth}x${screenHeight} @ ${colorDepth}bit
Memory: ${memory} GB
CPU Cores: ${cores}
GPU: ${gpuInfo}
Online: ${onlineStatus}
`;

        this.handleCommandOutput(info);
    }

    // async executeCommand(command) {
    //     try {
    //         await window.electronAPI.sendCommand(command);
    //     } catch (error) {
    //         this.handleCommandOutput(`Error: ${error.message}\n`);
    //     }
    // }

    async executeCommand(command) {
        try {
            if (command.toLowerCase() === "neofetch") {
                await this.neofetch();
            } else {
                await window.electronAPI.sendCommand(command);
            }
        } catch (error) {
            this.handleCommandOutput(`Error: ${error.message}\n`);
        }
    }

    // handleCommandOutput(output) {
    //     const terminalOutput = document.getElementById('terminalOutput');
    //     if (!terminalOutput) return;

    //     const outputDiv = document.createElement("div");
    //     outputDiv.className = "terminal-output-line";
    //     outputDiv.textContent = output;
    //     terminalOutput.appendChild(outputDiv);

    //     // Limit the number of output lines
    //     while (terminalOutput.children.length > this.maxOutputLines) {
    //         terminalOutput.removeChild(terminalOutput.firstChild);
    //     }

    //     // Scroll to bottom
    //     const scrollArea = terminalOutput.parentElement;
    //     scrollArea.scrollTop = scrollArea.scrollHeight;
    // }

    
    handleCommandOutput(output) {
        const terminalOutput = document.getElementById('terminalOutput');
        if (!terminalOutput) return;

        const outputDiv = document.createElement("div");
        outputDiv.className = "terminal-output-line";
        outputDiv.textContent = output;
        terminalOutput.appendChild(outputDiv);

        // Limit the number of output lines
        while (terminalOutput.children.length > this.maxOutputLines) {
            terminalOutput.removeChild(terminalOutput.firstChild);
        }

        // Scroll to bottom
        const scrollArea = terminalOutput.parentElement;
        scrollArea.scrollTop = scrollArea.scrollHeight;
    }

    // Window Control Methods
    closeTerminal() {
        const panel = document.getElementById('terminal');
        if (panel) {
            panel.remove();
            windows.delete('terminal');
            this.windows.delete('terminal');
            DockManager.renderDock();
        }
    }

    minimizeTerminal() {
        const panel = document.getElementById('terminal');
        if (panel) {
            panel.style.display = 'none';
            windows.get('terminal').minimized = true;
            DockManager.renderDock();
        }
    }

    toggleDevTools() {
        window.electronAPI.send('toggle-dev-tools');
    }

    // Public Methods
    show() {
        if (this.windows.has('terminal')) {
            const terminal = this.windows.get('terminal');
            terminal.style.display = 'block';
            windows.get('terminal').minimized = false;
            WindowManager.bringToFront(terminal);
        } else {
            this.createTerminalWindow();
        }
    }
}

// Initialize and export
window.TerminalManager = TerminalManager;
window.terminalManager = new TerminalManager();

console.log('Terminal Manager loaded and registered globally:', {
    class: typeof window.TerminalManager !== 'undefined',
    instance: typeof window.terminalManager !== 'undefined'
});

// Event listener for theme changes
window.addEventListener('themechange', async () => {
    await window.terminalManager.applyCurrentTheme();
});

console.log('Terminal Manager loaded');
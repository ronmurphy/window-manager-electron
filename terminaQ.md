function showTerminal() {
    const windowId = 'terminal';
    const windowHtml = `
        <div class="window" id="${windowId}">
            <div class="window-header">
                <div class="window-title">
                    <span class="material-symbols-outlined">terminal</span>
                    Terminal
                </div>
                <div class="window-controls">
                    <button onclick="toggleTerminalDevTools()" title="Developer Tools">
                        <span class="material-symbols-outlined">code</span>
                    </button>
                    <button onclick="minimizeTerminal()" title="Minimize">
                        <span class="material-symbols-outlined">remove</span>
                    </button>
                    <button onclick="closeTerminal()" title="Close">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
            </div>
            <div class="terminal-container">
                <div class="terminal-output" id="terminalOutput"></div>
    <input type="text" id="terminal-input" placeholder="Enter command" />
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', windowHtml);
    const panel = document.getElementById(windowId);

    // Make window draggable
    const header = panel.querySelector('.window-header');
    let isDragging = false;
    let currentX, currentY, initialX, initialY;

    header.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

        isDragging = true;
        const rect = panel.getBoundingClientRect();
        initialX = e.clientX - rect.left;
        initialY = e.clientY - rect.top;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            panel.style.transform = `translate(${e.clientX - initialX}px, ${e.clientY - initialY}px)`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    document.addEventListener("DOMContentLoaded", () => {
        const terminalContainer = document.querySelector(".terminal-container");
    
        window.electronAPI.onCommandOutput((output) => {
            const outputDiv = document.createElement("div");
            outputDiv.className = "terminal-output";
            outputDiv.textContent = output;
            terminalContainer.appendChild(outputDiv);
            terminalContainer.scrollTop = terminalContainer.scrollHeight;
        });
    
        const input = document.getElementById("terminal-input");
    
        input.addEventListener("keydown", async (event) => {
            if (event.key === "Enter") {
                const command = input.value.trim();
                if (command) {
                    await window.electronAPI.sendCommand(command);
                    input.value = "";
                }
            }
        });
    });
    

    // Event listener for terminal input
    const terminalInput = document.getElementById('terminalInput');
    terminalInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const command = terminalInput.value.trim();
            terminalInput.value = '';
            const output = await window.electronAPI.sendCommand(command);
            updateTerminalOutput(`> ${command}\n${output}\n`);
        }
    });

    // Function to update terminal output
    function updateTerminalOutput(text) {
        const terminalOutput = document.getElementById('terminalOutput');
        terminalOutput.textContent += text;
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    // Register with window management
    windows.set(windowId, {
        title: 'Terminal',
        minimized: false,
        isWidget: false
    });
    panel.style.display = 'block';
}

things i tried in main.js.
// // Command handling
// ipcMain.handle('send-command', async (event, command) => {
//     const [cmd, ...args] = command.trim().split(" ");
//     try {
//         switch (cmd) {
//             case 'ls':
//             case 'dir':
//                 const files = await fs.readdir(process.cwd());
//                 return files.join('\n');

//             case 'touch':
//                 if (args.length === 0) return "Specify a file name";
//                 const filePath = path.join(process.cwd(), args[0]);
//                 await fs.writeFile(filePath, "");
//                 return `Created file ${args[0]}`;

//             case 'ping':
//                 return `Pinging ${args[0] || 'localhost'}... Success!`;

//             default:
//                 return `Command not recognized: ${cmd}`;
//         }
//     } catch (error) {
//         return `Error executing command: ${error.message}`;
//     }
// });

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

in preloader.js...
    sendCommand: (command) => ipcRenderer.invoke('send-command', command),
    onCommandOutput: (callback) => ipcRenderer.on("command-output", (_, data) => callback(data)),
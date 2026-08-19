"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = require("path");
const fs = require("fs");
const child_process_1 = require("child_process");
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1000,
        minHeight: 600,
        frame: true,
        titleBarStyle: 'default',
        backgroundColor: '#111214',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false,
        },
    });
    // In development, load from Vite local server
    if (process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// IPC Handler: Choose Folder / Import Files
// IPC Handler: Choose Folder / Import Files & Copy to Project Folder
electron_1.ipcMain.handle('dialog:open-directory', async (event, projectDir, dirKey, locationName) => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    const sourceDirPath = result.filePaths[0];
    const files = fs.readdirSync(sourceDirPath);
    const allowedExts = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp', '.bmp', '.gif', '.raw', '.cr2', '.nef', '.arw', '.dng', '.heic', '.heif'];
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const scannedFiles = files
        .filter(file => allowedExts.includes(path.extname(file).toLowerCase()))
        .sort(collator.compare);
    let finalDirPath = sourceDirPath;
    const imageFiles = [];
    // If projectDir is provided, we copy the images into the project folder
    if (projectDir && dirKey) {
        const safeLocationName = locationName ? locationName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'default';
        const relativeTargetSub = path.join('imported_images', safeLocationName, dirKey);
        const targetDir = path.join(projectDir, relativeTargetSub);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        for (const file of scannedFiles) {
            const srcPath = path.join(sourceDirPath, file);
            const destPath = path.join(targetDir, file);
            try {
                fs.copyFileSync(srcPath, destPath);
                imageFiles.push({
                    name: file,
                    path: destPath
                });
            }
            catch (err) {
                console.error(`Failed to copy ${file}:`, err);
            }
        }
        finalDirPath = targetDir;
    }
    else {
        // Fallback: reference original folder
        for (const file of scannedFiles) {
            imageFiles.push({
                name: file,
                path: path.join(sourceDirPath, file)
            });
        }
    }
    return {
        path: finalDirPath,
        files: imageFiles
    };
});
electron_1.ipcMain.handle('project:save', async (event, projectData, filePath) => {
    let targetPath = filePath;
    if (!targetPath) {
        const result = await electron_1.dialog.showSaveDialog(mainWindow, {
            title: 'Save Project',
            defaultPath: 'project.360pan',
            filters: [{ name: '360 Panorama Project', extensions: ['360pan'] }]
        });
        if (result.canceled || !result.filePath)
            return null;
        targetPath = result.filePath;
    }
    fs.writeFileSync(targetPath, JSON.stringify(projectData, null, 2));
    return targetPath;
});
electron_1.ipcMain.handle('project:load', async () => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        title: 'Open Project',
        filters: [{ name: '360 Panorama Project', extensions: ['360pan'] }],
        properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0)
        return null;
    const data = fs.readFileSync(result.filePaths[0], 'utf-8');
    return {
        filePath: result.filePaths[0],
        projectData: JSON.parse(data)
    };
});
electron_1.ipcMain.handle('stitch:run', async (event, config) => {
    return new Promise((resolve, reject) => {
        // Write temporary config file
        const configPath = path.join(config.projectDir, 'stitch_config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        // Resolve python path (virtual env python on Windows) using app.getAppPath()
        const pythonExe = path.join(electron_1.app.getAppPath(), 'python_engine/.venv/Scripts/python.exe');
        const scriptPath = path.join(electron_1.app.getAppPath(), 'python_engine/stitcher.py');
        const pyProcess = (0, child_process_1.spawn)(pythonExe, [scriptPath, configPath]);
        pyProcess.stdout.on('data', (data) => {
            const output = data.toString();
            // Progress pattern: PROGRESS:percentage:message
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.startsWith('PROGRESS:')) {
                    const parts = line.split(':');
                    if (parts.length >= 3) {
                        const percent = parseInt(parts[1]);
                        const msg = parts.slice(2).join(':').trim();
                        mainWindow?.webContents.send('stitch:progress', { percent, message: msg });
                    }
                }
            }
        });
        let stderrData = '';
        pyProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
            console.error(`Python stderr: ${data}`);
        });
        pyProcess.on('close', (code) => {
            // Clean up temporary config file
            try {
                if (fs.existsSync(configPath)) {
                    fs.unlinkSync(configPath);
                }
            }
            catch (err) {
                console.error(err);
            }
            if (code === 0) {
                try {
                    resolve({ status: 'SUCCESS', outputPath: config.outputPath });
                }
                catch (e) {
                    reject(new Error(`Failed to parse stitching result: ${e}`));
                }
            }
            else {
                reject(new Error(`Python process exited with code ${code}. Stderr: ${stderrData}`));
            }
        });
    });
});

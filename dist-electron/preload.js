"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    openDirectory: (projectDir, dirKey, locationName) => electron_1.ipcRenderer.invoke('dialog:open-directory', projectDir, dirKey, locationName),
    saveProject: (projectData, filePath) => electron_1.ipcRenderer.invoke('project:save', projectData, filePath),
    loadProject: () => electron_1.ipcRenderer.invoke('project:load'),
    runStitch: (config) => electron_1.ipcRenderer.invoke('stitch:run', config),
    onStitchProgress: (callback) => {
        const subscription = (_event, value) => callback(value);
        electron_1.ipcRenderer.on('stitch:progress', subscription);
        return () => electron_1.ipcRenderer.removeListener('stitch:progress', subscription);
    }
});

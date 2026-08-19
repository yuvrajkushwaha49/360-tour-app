import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: (projectDir?: string, dirKey?: string, locationName?: string) => 
    ipcRenderer.invoke('dialog:open-directory', projectDir, dirKey, locationName),
  saveProject: (projectData: any, filePath?: string) => ipcRenderer.invoke('project:save', projectData, filePath),
  loadProject: () => ipcRenderer.invoke('project:load'),
  runStitch: (config: { projectDir: string; directions: Record<string, string[]>; outputPath: string; resolution: number }) => 
    ipcRenderer.invoke('stitch:run', config),
  onStitchProgress: (callback: (data: { percent: number; message: string }) => void) => {
    const subscription = (_event: any, value: { percent: number; message: string }) => callback(value);
    ipcRenderer.on('stitch:progress', subscription);
    return () => ipcRenderer.removeListener('stitch:progress', subscription);
  }
});

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  downloadVideo: (params: { url: string; format: string; quality: string; outputFolder: string; cookiesPath?: string }) => 
    ipcRenderer.invoke('download-video', params),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  getDefaultDownloadPath: () => ipcRenderer.invoke('get-default-download-path'),
  onDownloadProgress: (callback: (progress: number) => void) => 
    ipcRenderer.on('download-progress', (_, progress) => callback(progress))
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

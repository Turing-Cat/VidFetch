import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { exec } from 'yt-dlp-exec'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function resolveFfmpegPath(): string | null {
  const executableName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

  if (is.dev) {
    const devBinary = join(__dirname, '../../node_modules/ffmpeg-static', executableName)
    if (existsSync(devBinary)) {
      return devBinary
    }
  } else {
    const bundledBinary = join(process.resourcesPath, 'bin', executableName)
    if (existsSync(bundledBinary)) {
      return bundledBinary
    }

    const unpackedBinary = join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', executableName)
    if (existsSync(unpackedBinary)) {
      return unpackedBinary
    }
  }

  console.warn('FFmpeg binary was not found in the expected locations. Falling back to system ffmpeg if available.')
  return null
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Fix PATH for macOS and Linux
  const { default: fixPath } = await import('fix-path')
  fixPath()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC Handlers
  ipcMain.handle('download-video', async (_, { url, format, quality, outputFolder, cookiesPath }) => {
    try {
      const outputTemplate = join(outputFolder, '%(title)s.%(ext)s')
      const ffmpegPath = resolveFfmpegPath()
      
      let formatString = 'bestvideo+bestaudio/best'
      if (format === 'mp3') {
        formatString = 'bestaudio/best'
      } else if (quality !== 'best') {
        const height = quality.replace('p', '').replace('k', '000') // Simple mapping, 4k -> 4000 (approx)
        // Better mapping: 4k is usually 2160, 8k is 4320.
        let h = height
        if (quality === '4k') h = '2160'
        if (quality === '8k') h = '4320'
        
        formatString = `bestvideo[height<=${h}]+bestaudio/best[height<=${h}]`
      }

      const flags: any = {
        output: outputTemplate,
        format: formatString,
        noPlaylist: true,
      }

      if (cookiesPath) {
        flags.cookies = cookiesPath
      }

      if (format === 'mp3') {
        flags.extractAudio = true
        flags.audioFormat = 'mp3'
      } else if (format === 'mkv') {
        flags.mergeOutputFormat = 'mkv'
      } else {
        flags.mergeOutputFormat = 'mp4'
      }

      // Add ffmpeg location
      if (ffmpegPath) {
        // In development, ffmpegPath is the absolute path to the binary
        // In production, we might need to handle asar paths
        flags.ffmpegLocation = ffmpegPath.replace('app.asar', 'app.asar.unpacked')
      }

      console.log(`Downloading ${url} to ${outputTemplate} with flags:`, flags)
      
      // Determine binary path based on environment
      let ytDlpBinaryPath: string | undefined
      if (is.dev) {
        const localBin = join(__dirname, '../../local_bin/yt-dlp')
        if (existsSync(localBin)) {
          ytDlpBinaryPath = localBin
        }
      } else {
        ytDlpBinaryPath = join(process.resourcesPath, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
      }

      console.log('Using yt-dlp binary at:', ytDlpBinaryPath || 'default (node_modules)')
      console.log('Using ffmpeg at:', ffmpegPath || 'system PATH')

      return new Promise((resolve, reject) => {
        const subprocess = exec(url, flags, {
          ytDlpBinaryPath: ytDlpBinaryPath
        } as any)

        subprocess.stdout?.on('data', (data: Buffer) => {
          const line = data.toString()
          console.log(line)
          
          // Parse progress
          // [download]  25.0% of 10.00MiB at 2.00MiB/s ETA 00:05
          const match = line.match(/\[download\]\s+(\d+\.?\d*)%/)
          if (match && match[1]) {
            const percent = parseFloat(match[1])
            // Send progress to renderer
            // We need to find the window to send to. 
            // For simplicity, we'll send to all windows or the focused one.
            BrowserWindow.getAllWindows().forEach(win => {
              win.webContents.send('download-progress', percent)
            })
          }
        })

        subprocess.stderr?.on('data', (data: Buffer) => {
          console.error(`stderr: ${data}`)
        })

        subprocess.on('close', (code: number) => {
          if (code === 0) {
            resolve({ success: true })
          } else {
            reject(new Error(`Process exited with code ${code}`))
          }
        })

        subprocess.on('error', (err: Error) => {
          reject(err)
        })
      })
    } catch (error: any) {
      console.error('Download failed:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('select-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (canceled) {
      return null
    } else {
      return filePaths[0]
    }
  })

  ipcMain.handle('select-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    })
    if (canceled) {
      return null
    } else {
      return filePaths[0]
    }
  })

  ipcMain.handle('get-default-download-path', () => {
    return app.getPath('downloads')
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

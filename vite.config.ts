import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

const projectRootDir = __dirname
const rendererRootDir = path.resolve(projectRootDir, 'src/renderer')

export default defineConfig({
  root: rendererRootDir,
  plugins: [
    vue(),
    electron({
      main: {
        entry: path.resolve(projectRootDir, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: path.resolve(projectRootDir, 'dist/main'),
            rollupOptions: {
              external: ['yt-dlp-exec', 'fix-path', 'ffmpeg-static']
            }
          },
        },
      },
      preload: {
        input: path.resolve(projectRootDir, 'src/preload/index.ts'),
        vite: {
          build: {
            outDir: path.resolve(projectRootDir, 'dist/preload'),
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(rendererRootDir, 'src'),
    },
  },
  build: {
    outDir: path.resolve(projectRootDir, 'dist/renderer'),
    emptyOutDir: true,
  }
})

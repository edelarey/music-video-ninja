import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'path'

const FFMPEG_CORE_FILES: Record<string, string> = {
  'ffmpeg-core.js': 'text/javascript',
  'ffmpeg-core.wasm': 'application/wasm',
  'ffmpeg-core.worker.js': 'text/javascript',
}

function ffmpegCoreSrcDir() {
  // ESM, not UMD: @ffmpeg/ffmpeg's class worker is type=module and loads core
  // with import(). UMD has no export default, and pthread workers created as
  // classic Workers must use the ESM worker (dynamic import) rather than the
  // UMD worker (importScripts), or blob workers throw
  // "Cannot use import statement outside a module".
  return path.resolve(__dirname, 'node_modules/@ffmpeg/core-mt/dist/esm')
}

function copyFfmpegCoreTo(destDir: string) {
  const srcDir = ffmpegCoreSrcDir()
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of Object.keys(FFMPEG_CORE_FILES)) {
    const src = path.join(srcDir, file)
    const dest = path.join(destDir, file)
    try {
      if (fs.statSync(dest).size === fs.statSync(src).size) continue
    } catch {
      // destination missing
    }
    fs.copyFileSync(src, dest)
  }
}

function sendFfmpegCoreFile(fileName: string, res: import('node:http').ServerResponse) {
  const mime = FFMPEG_CORE_FILES[fileName]
  if (!mime) return false
  const filePath = path.join(ffmpegCoreSrcDir(), fileName)
  if (!fs.existsSync(filePath)) return false
  const stat = fs.statSync(filePath)
  res.setHeader('Content-Type', mime)
  res.setHeader('Content-Length', String(stat.size))
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.setHeader('Cache-Control', 'no-store')
  fs.createReadStream(filePath).pipe(res)
  return true
}

function ffmpegCoreFileFromUrl(url: string | undefined) {
  if (!url) return null
  const pathname = url.split('?')[0] ?? ''
  const match = pathname.match(/^\/ffmpeg\/([^/]+)$/)
  return match?.[1] && match[1] in FFMPEG_CORE_FILES ? match[1] : null
}

function copyFfmpegCore(): Plugin {
  const destDir = path.resolve(__dirname, 'public/ffmpeg')
  const copy = () => copyFfmpegCoreTo(destDir)
  return {
    name: 'copy-ffmpeg-core',
    buildStart: copy,
    configureServer(server: ViteDevServer) {
      // Serve core files from node_modules before the SPA fallback. Vite can
      // miss files added to public/ after the server has already started.
      server.middlewares.use((req, res, next) => {
        const fileName = ffmpegCoreFileFromUrl(req.url)
        if (!fileName || req.method !== 'GET') {
          next()
          return
        }
        if (!sendFfmpegCoreFile(fileName, res)) next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [copyFfmpegCore(), vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    cors: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    fs: {
      allow: ['.']
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core-mt'],
  },
  assetsInclude: ['**/*.wasm'],
})

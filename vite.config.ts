import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {createHash} from 'crypto';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

/**
 * Fills public/sw.js with the list of built files and a version that changes
 * whenever the app changes. This is what lets the app open with no internet,
 * and lets phones pick up new versions when they are back online.
 */
function aclsServiceWorker(): Plugin {
  let outDir = 'dist';
  let publicDir = 'public';
  let bundleFiles: string[] = [];
  return {
    name: 'acls-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      bundleFiles = Object.keys(bundle);
    },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;

      const publicFiles = fs.existsSync(publicDir)
        ? fs.readdirSync(publicDir).filter((f) => f !== 'sw.js' && fs.statSync(path.join(publicDir, f)).isFile())
        : [];
      const files = [...bundleFiles.filter((f) => f !== 'index.html' && !f.endsWith('.map')), ...publicFiles];
      const urls = ['/', ...Array.from(new Set(files)).sort().map((f) => '/' + f.split(path.sep).join('/'))];

      const hash = createHash('sha256');
      hash.update(urls.join('\n'));
      hash.update(fs.readFileSync(path.join(outDir, 'index.html')));
      for (const f of publicFiles) hash.update(fs.readFileSync(path.join(publicDir, f)));
      hash.update(fs.readFileSync(path.join(publicDir, 'sw.js'))); // offline logic changes count too
      const version = hash.digest('hex').slice(0, 12);

      let sw = fs.readFileSync(swPath, 'utf8');
      const versionLine = "const CACHE_VERSION = 'dev'; /* __ACLS_CACHE_VERSION__ */";
      const urlsLine = "const PRECACHE_URLS = ['/']; /* __ACLS_PRECACHE_URLS__ */";
      if (!sw.includes(versionLine) || !sw.includes(urlsLine)) {
        throw new Error('acls-service-worker: placeholders not found in public/sw.js');
      }
      sw = sw
        .replace(versionLine, `const CACHE_VERSION = '${version}';`)
        .replace(urlsLine, `const PRECACHE_URLS = ${JSON.stringify(urls)};`);
      fs.writeFileSync(swPath, sw);
      console.log(`[acls-service-worker] ${urls.length} files precached, version ${version}`);
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), aclsServiceWorker()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            'vendor-icons': ['lucide-react'],
            'vendor-motion': ['motion'],
          },
        },
      },
    },
  };
});

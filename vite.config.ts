import { createReadStream } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const MANAGED_DIR = fileURLToPath(new URL('./managed', import.meta.url));

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : Promise.resolve([full]);
    }),
  );
  return nested.flat();
}

/**
 * Serves the compiled proving keys and zkir at `/managed/...`.
 *
 * The artefacts are build output that lives at the repository root, not in
 * `public/`, and copying them there would mean keeping two copies in step. In
 * dev they are streamed straight off disk; for a production build they are
 * emitted into the bundle.
 */
function compiledArtefacts(): Plugin {
  return {
    name: 'cepush:compiled-artefacts',
    configureServer(server) {
      server.middlewares.use('/managed', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
        // Refuse to walk out of the artefact directory.
        if (rel.includes('..')) return next();
        const file = join(MANAGED_DIR, rel);
        res.setHeader('Content-Type', 'application/octet-stream');
        createReadStream(file)
          .on('error', () => next())
          .pipe(res);
      });
    },
    async generateBundle() {
      for (const file of await walk(MANAGED_DIR)) {
        this.emitFile({
          type: 'asset',
          fileName: `managed/${relative(MANAGED_DIR, file).split(/[\/]/).join('/')}`,
          source: await readFile(file),
        });
      }
    },
  };
}
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [
    react(),
    compiledArtefacts(),
    // The ledger is compiled to WebAssembly.
    wasm(),
    // Midnight.js reaches for a handful of node built-ins; the private state
    // store in particular expects Buffer to exist.
    nodePolyfills({ include: ['buffer', 'process', 'util', 'events', 'stream'] }),
  ],
  resolve: {
    alias: {
      // See src/shims/isomorphic-ws.ts for why.
      'isomorphic-ws': fileURLToPath(new URL('./src/shims/isomorphic-ws.ts', import.meta.url)),
    },
  },
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // esnext handles the top-level await in the wasm glue natively, so no
    // transform plugin is needed.
    target: 'esnext',
    // The ledger WebAssembly is ten megabytes on its own. Warning about it on
    // every build would only teach us to ignore warnings.
    chunkSizeWarningLimit: 1536,
  },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/ledger-v8'],
    esbuildOptions: { target: 'esnext' },
  },
});

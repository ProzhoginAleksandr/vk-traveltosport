// vite.config.ts
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Хостинг VK отдаёт 403 на файлы с расширением .mjs, а воркер MapLibre
// собирается именно как .mjs. Поэтому рядом с оригиналом кладём копию с .js:
// код карты ссылается на неё, и воркер загружается.
const mapLibreWorkerAsJs = (): Plugin => ({
  name: 'maplibre-worker-as-js',
  generateBundle(_options, bundle) {
    for (const [fileName, item] of Object.entries(bundle)) {
      if (item.type === 'asset' && /maplibre-gl-worker.*\.mjs$/.test(fileName)) {
        this.emitFile({
          type: 'asset',
          fileName: fileName.replace(/\.mjs$/, '.js'),
          source: item.source,
        });
        // Оригинальный .mjs не нужен: код карты ссылается на .js-копию
        delete bundle[fileName];
      }
    }
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), mapLibreWorkerAsJs()],
  build: {
    outDir: 'build',
    target: 'es2022',
  },
  server: {
    port: 5173,
    host: true,
  },
});

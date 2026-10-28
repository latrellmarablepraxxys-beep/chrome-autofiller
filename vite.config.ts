import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        target: 'chrome111',
        sourcemap: false,
        rollupOptions: {
            input: {
                background: `${root}src/background.ts`,
                popup: `${root}popup.html`,
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name]-[hash].js',
                assetFileNames: '[name][extname]',
            },
        },
    },
});

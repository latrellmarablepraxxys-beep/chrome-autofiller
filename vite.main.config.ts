import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: false,
        target: 'chrome111',
        minify: 'esbuild',
        lib: {
            entry: 'src/main-world/index.ts',
            formats: ['iife'],
            name: 'PRXQAMainWorld',
            fileName: () => 'main-world.js',
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
});

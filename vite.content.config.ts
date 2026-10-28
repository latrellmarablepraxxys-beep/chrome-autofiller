import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: false,
        target: 'chrome111',
        minify: 'esbuild',
        lib: {
            entry: 'src/content/index.ts',
            formats: ['iife'],
            name: 'PRXQAContent',
            fileName: () => 'content.js',
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
});

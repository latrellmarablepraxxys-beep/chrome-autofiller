import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [vue()],
    root: 'harness',
    server: {
        port: 8093,
        strictPort: true,
    },
});

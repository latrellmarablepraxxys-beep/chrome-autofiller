import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const kitSource = fileURLToPath(new URL('./node_modules/@praxxys/vue-kit/src', import.meta.url));

export default defineConfig({
    plugins: [vue()],
    root: 'harness',
    resolve: {
        alias: {
            '@prx-kit': kitSource,
            '@/': `${kitSource}/`,
        },
    },
    optimizeDeps: {
        include: [
            'lodash',
            'lodash/debounce',
            'lodash/pickBy',
            'vue-multiselect',
            '@vueuse/core',
            '@vuepic/vue-datepicker',
            'lucide-vue-next',
            'reka-ui',
        ],
    },
    server: {
        port: 8093,
        strictPort: true,
    },
});

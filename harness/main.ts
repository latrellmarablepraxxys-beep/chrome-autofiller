import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
import '@praxxys/vue-kit/dist/vue-kit.css';

/**
 * The kit's searchable select expects the host application to provide `route()`
 * and `window.axios`. The harness supplies a deterministic stand-in so the
 * debounce and remote-option path can be exercised without a backend.
 */
const harnessWindow = window as Window & {
    route?: (name: string) => string;
    axios?: { get: (url: string) => Promise<{ data: unknown[] }> };
};

harnessWindow.route = (name: string) => `/harness/${name}`;
harnessWindow.axios = {
    get: async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));

        return {
            data: [
                { value: 1, label: 'Quezon City' },
                { value: 2, label: 'Makati City' },
                { value: 3, label: 'Cebu City' },
            ],
        };
    },
};

createApp(App).mount('#app');

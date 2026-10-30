import type { FillOptions, FillReport, RunMode } from '../shared/types';
import { renderHud, renderHudError } from './hud';

const GUARD = '__PRX_QA_CONTENT__';

type Resolver = (payload: { report?: FillReport; error?: string }) => void;

if (!window[GUARD]) {
    window[GUARD] = true;

    const pending = new Map<string, Resolver>();
    let lastRunAt = 0;

    // Page-level fallback for the Option/Alt+Shift+B chord. Chrome commands
    // are the primary path; this keeps the shortcut working if the command
    // assignment is missing or overridden. The debounce prevents a double fill
    // when both paths fire.
    window.addEventListener(
        'keydown',
        (event) => {
            if (!event.altKey || !event.shiftKey || event.metaKey || event.ctrlKey) return;
            if (event.code !== 'KeyB' && event.key.toLowerCase() !== 'b') return;

            event.preventDefault();
            void chrome.runtime.sendMessage({ type: 'RUN_SHORTCUT' }).catch(() => undefined);
        },
        true,
    );

    window.addEventListener('message', (event) => {
        if (event.source !== window) return;

        const data = event.data as
            | { source?: string; requestId?: string; report?: FillReport; error?: string }
            | undefined;

        if (!data || data.source !== 'PRX_QA_RESULT' || !data.requestId) return;

        const resolve = pending.get(data.requestId);
        if (!resolve) return;

        pending.delete(data.requestId);
        resolve({ report: data.report, error: data.error });
    });

    async function run(mode: RunMode, options: FillOptions): Promise<unknown> {
        const now = Date.now();
        if (now - lastRunAt < 1000) {
            return { ok: false, error: 'duplicate fill ignored' };
        }
        lastRunAt = now;

        const requestId =
            typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        const payload = await new Promise<{ report?: FillReport; error?: string }>((resolve) => {
            // "All fields" on a large admin form opens far more dropdowns and
            // pickers than "Required + content"; 60s was not enough headroom.
            const timer = setTimeout(() => {
                pending.delete(requestId);
                resolve({ error: 'autofill timed out' });
            }, 180_000);

            pending.set(requestId, (result) => {
                clearTimeout(timer);
                resolve(result);
            });

            window.postMessage(
                { source: 'PRX_QA_RUN', requestId, mode, options },
                window.location.origin,
            );
        });

        if (payload.report) {
            renderHud(payload.report);
            return { ok: true, report: payload.report };
        }

        renderHudError(payload.error ?? 'Unknown error');
        return { ok: false, error: payload.error ?? 'Unknown error' };
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type === 'ping') {
            sendResponse({ ok: true });
            return;
        }

        if (message?.type === 'run') {
            run(message.mode, message.options)
                .then(sendResponse)
                .catch((error) => sendResponse({ ok: false, error: String(error) }));
            return true;
        }
    });
}

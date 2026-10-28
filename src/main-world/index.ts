import { execute } from '../core/orchestrator';
import '../shared/bridge';

const GUARD = '__PRX_QA_EXECUTOR__';

if (!window[GUARD]) {
    window[GUARD] = true;

    window.addEventListener('message', async (event) => {
        if (event.source !== window) return;

        const data = event.data as
            | { source?: string; requestId?: string; mode?: 'fill' | 'inspect'; options?: unknown }
            | undefined;

        if (!data || data.source !== 'PRX_QA_RUN' || !data.requestId) return;

        try {
            const report = await execute(data.mode ?? 'fill', data.options as never);
            window.postMessage(
                { source: 'PRX_QA_RESULT', requestId: data.requestId, report },
                window.location.origin,
            );
        } catch (error) {
            window.postMessage(
                {
                    source: 'PRX_QA_RESULT',
                    requestId: data.requestId,
                    error: error instanceof Error ? error.message : String(error),
                },
                window.location.origin,
            );
        }
    });

    window.__PRX_QA_AUTOFILL__ = { execute };
}

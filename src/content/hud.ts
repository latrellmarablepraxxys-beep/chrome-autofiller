import type { FillReport } from '../shared/types';

const HOST_ID = 'prx-qa-hud';

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function removeExisting(): void {
    document.getElementById(HOST_ID)?.remove();
}

function mount(inner: string, report?: FillReport): void {
    removeExisting();

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:2147483647;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
        <style>
            .card {
                width: 360px;
                max-height: 70vh;
                overflow: auto;
                background: #111827;
                color: #f9fafb;
                border: 1px solid #374151;
                border-radius: 12px;
                box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
                font-size: 12px;
                line-height: 1.45;
            }
            .head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #374151; }
            .title { font-weight: 700; font-size: 13px; letter-spacing: 0.01em; }
            .counts { margin-left: auto; color: #c7d2fe; font-variant-numeric: tabular-nums; }
            .body { padding: 8px 14px 12px; }
            .row { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px solid rgba(55, 65, 81, 0.5); }
            .row:last-child { border-bottom: 0; }
            .label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .status { font-weight: 600; text-transform: lowercase; }
            .filled { color: #86efac; }
            .skipped { color: #fcd34d; }
            .failed { color: #fca5a5; }
            .detected { color: #93c5fd; }
            .reason { color: #9ca3af; font-size: 11px; }
            .actions { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid #374151; }
            button {
                all: unset;
                cursor: pointer;
                padding: 6px 10px;
                border-radius: 7px;
                background: #374151;
                color: #f9fafb;
                font-size: 11px;
                font-weight: 600;
            }
            button.primary { background: #6d28d9; }
            button:hover { filter: brightness(1.15); }
            .empty { color: #9ca3af; padding: 6px 0; }
        </style>
        <div class="card">
            <div class="head">
                <span class="title">PRAXXYS Autofill</span>
                <span class="counts">${escapeHtml(inner)}</span>
            </div>
            <div class="body">${body(report)}</div>
            <div class="actions">
                <button class="primary" data-action="copy">Copy report</button>
                <button data-action="close">Close</button>
            </div>
        </div>
    `;

    shadow.querySelector('[data-action="close"]')?.addEventListener('click', removeExisting);
    shadow.querySelector('[data-action="copy"]')?.addEventListener('click', async () => {
        if (!report) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = JSON.stringify(report, null, 2);
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
        }
    });

    document.documentElement.appendChild(host);

    const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            removeExisting();
            window.removeEventListener('keydown', onKey, true);
        }
    };
    window.addEventListener('keydown', onKey, true);
}

function body(report?: FillReport): string {
    if (!report) return '<div class="empty">No report.</div>';

    const problems = report.fields.filter((field) => field.status === 'failed');
    const notes = report.fields.filter((field) => field.status === 'skipped').slice(0, 3);
    const lines = report.mode === 'inspect' ? [] : [...problems, ...notes];

    if (!lines.length) {
        return `<div class="empty">${
            report.mode === 'inspect'
                ? `${report.detected} fields detected. Nothing was changed.`
                : 'All detected fields were filled.'
        }</div>`;
    }

    return lines
        .map(
            (field) => `
                <div class="row">
                    <span class="label" title="${escapeHtml(field.label)}">${escapeHtml(field.label)}</span>
                    <span class="status ${field.status}">${field.status}</span>
                </div>
                <div class="reason">${escapeHtml(field.reason ?? field.strategy ?? field.semantic)}</div>
            `,
        )
        .join('');
}

export function renderHud(report: FillReport): void {
    const summary =
        report.mode === 'inspect'
            ? `${report.detected} detected`
            : `${report.filled} filled · ${report.skipped} skipped · ${report.failed} failed`;

    mount(summary, report);
}

export function renderHudError(message: string): void {
    mount('error', undefined);
    const host = document.getElementById(HOST_ID);
    const bodyNode = host?.shadowRoot?.querySelector('.body');
    if (bodyNode) bodyNode.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
}

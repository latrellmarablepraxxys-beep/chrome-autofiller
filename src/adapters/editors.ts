import type { DetectedControl } from '../shared/types';
import { sleep, textOf } from '../shared/dom';
import { fail, ok, skip, type FieldOutcome } from './types';

interface EditorBridge {
    id: string;
    kind: 'ckeditor' | 'tiptap';
    el?: HTMLElement;
    get: () => string;
    set: (html: string) => void;
}

function findBridge(el: HTMLElement): EditorBridge | null {
    const registry = window.__PRX_QA__?.editors;
    if (!registry) return null;

    for (const editor of registry.values()) {
        const target = editor.el;
        if (!target) continue;
        if (target === el || target.contains(el) || el.contains(target)) return editor;
    }

    return null;
}

export async function fillEditor(control: DetectedControl, html: string): Promise<FieldOutcome> {
    const el = control.el;

    const bridge = findBridge(el);
    if (bridge) {
        try {
            bridge.set(html);
            await sleep(200);
            if (bridge.get().length > 20) {
                return ok(`bridge:${bridge.kind}`, 'rich HTML');
            }
        } catch {
            // fall through to DOM strategies
        }
    }

    if (await pasteHtml(el, html)) return ok('paste', 'rich HTML');

    try {
        el.focus();
        const applied = document.execCommand('insertHTML', false, html);
        await sleep(150);
        if (applied && textOf(el).length > 20) return ok('execCommand', 'rich HTML');
    } catch {
        // ignored
    }

    return fail('editor did not accept content');
}

async function pasteHtml(el: HTMLElement, html: string): Promise<boolean> {
    try {
        const transfer = new DataTransfer();
        transfer.setData('text/html', html);
        transfer.setData('text/plain', textOf(document.createElement('div')) || 'PRAXXYS QA sample content');

        el.focus();
        const event = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: transfer,
        });
        el.dispatchEvent(event);
        await sleep(250);

        return textOf(el).length > 20;
    } catch {
        return false;
    }
}

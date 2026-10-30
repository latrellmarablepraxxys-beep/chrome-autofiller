import { beforeEach, describe, expect, it } from 'vitest';
import { inScope } from '../src/core/orchestrator';
import type { ModuleContext } from '../src/core/module';
import type { DetectedControl, FillOptions } from '../src/shared/types';
import { DEFAULTS } from '../src/shared/types';

const module: ModuleContext = { kind: 'product', label: 'products', source: 'path' };

function options(scope: FillOptions['scope']): FillOptions {
    return { ...DEFAULTS, scope };
}

function control(partial: Partial<DetectedControl> = {}): DetectedControl {
    const el = document.createElement('input');
    document.body.appendChild(el);

    return {
        el,
        kind: 'text',
        label: 'Notes',
        name: 'notes',
        id: '',
        placeholder: '',
        required: false,
        key: `field-${Math.random().toString(16).slice(2)}`,
        accept: '',
        multiple: false,
        numeric: false,
        index: 0,
        ...partial,
    };
}

describe('scope', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('"All fields" includes every detected control', () => {
        const all = options('all');

        expect(inScope(control({ label: 'Notes' }), all, module)).toBe(true);
        expect(inScope(control({ label: 'Weight', kind: 'number' }), all, module)).toBe(true);
        expect(inScope(control({ label: 'Status', kind: 'native-select' }), all, module)).toBe(true);
    });

    it('"Required + content" skips ordinary optional fields', () => {
        const required = options('required');

        expect(inScope(control({ label: 'Notes' }), required, module)).toBe(false);
        expect(inScope(control({ label: 'Weight', kind: 'number' }), required, module)).toBe(false);
        expect(inScope(control({ label: 'Internal memo' }), required, module)).toBe(false);
    });

    it('"Required + content" keeps required, content, date, and link fields', () => {
        const required = options('required');

        expect(inScope(control({ label: 'Product Name', required: true }), required, module)).toBe(
            true,
        );
        expect(inScope(control({ label: 'Body', kind: 'ckeditor' }), required, module)).toBe(true);
        expect(inScope(control({ label: 'Body', kind: 'tiptap' }), required, module)).toBe(true);
        expect(inScope(control({ label: 'Published at', kind: 'date' }), required, module)).toBe(
            true,
        );
        expect(inScope(control({ label: 'Video Link' }), required, module)).toBe(true);
        expect(inScope(control({ label: 'Map URL', kind: 'url' }), required, module)).toBe(true);
    });

    it('"Required + content" fills an unselected radio group but not a filled one', () => {
        const required = options('required');

        const empty = document.createElement('div');
        empty.innerHTML = `
            <div role="radiogroup">
                <button type="button" role="radio" aria-checked="false"></button>
                <button type="button" role="radio" aria-checked="false"></button>
            </div>
        `;
        document.body.appendChild(empty);
        const emptyRadio = empty.querySelector<HTMLElement>('[role="radio"]')!;

        expect(
            inScope(
                control({ kind: 'radio', label: 'Gender', groupEl: empty, el: emptyRadio }),
                required,
                module,
            ),
        ).toBe(true);

        const filled = empty.cloneNode(true) as HTMLElement;
        filled.querySelector('[role="radio"]')!.setAttribute('aria-checked', 'true');
        document.body.appendChild(filled);
        const filledRadio = filled.querySelector<HTMLElement>('[role="radio"]')!;

        expect(
            inScope(
                control({ kind: 'radio', label: 'Gender', groupEl: filled, el: filledRadio }),
                required,
                module,
            ),
        ).toBe(false);
    });
});

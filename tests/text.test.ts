import { describe, expect, it } from 'vitest';
import type { DetectedControl } from '../src/shared/types';
import { fillText } from '../src/adapters/text';

function control(el: HTMLElement, partial: Partial<DetectedControl> = {}): DetectedControl {
    return {
        el,
        kind: 'number',
        label: 'PhilSys Number',
        name: 'philsys',
        id: 'philsys',
        placeholder: '',
        required: true,
        key: 'philsys',
        accept: '',
        multiple: false,
        numeric: true,
        index: 0,
        ...partial,
    };
}

describe('text adapter', () => {
    it('keeps a 16-digit identifier with a leading zero intact', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('inputmode', 'numeric');
        document.body.appendChild(input);

        const outcome = fillText(control(input), '0123456789012345');

        expect(outcome.status).toBe('filled');
        expect(input.value).toBe('0123456789012345');
    });

    it('still clamps ordinary numeric fields with min/max', () => {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = '10';
        document.body.appendChild(input);

        const outcome = fillText(control(input, { kind: 'number', label: 'Age' }), '42');

        expect(outcome.status).toBe('filled');
        expect(input.value).toBe('10');
    });
});

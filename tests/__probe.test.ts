import { beforeEach, describe, expect, it } from 'vitest';
import { isVisible } from '../src/shared/dom';
import { dpCellSelector, pickerMenu } from '../src/shared/picker';

/**
 * Coverage for the shared picker helpers. This file was created as a scratch
 * probe while diagnosing the vue-datepicker bug — rename it to
 * `tests/picker.test.ts` when convenient.
 */
describe('picker helpers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('resolves the popup through aria-controls', () => {
        document.body.innerHTML = `
            <input data-test-id="dp-input" aria-controls="dp-menu-1" />
            <div id="dp-menu-1" class="dp-menu"></div>
            <div class="dp-menu"></div>
        `;

        const input = document.querySelector<HTMLInputElement>('[data-test-id="dp-input"]')!;
        const owned = document.getElementById('dp-menu-1')!;

        expect(pickerMenu(input, isVisible)).toBe(owned);
    });

    it('falls back to the last visible calendar when aria-controls is missing', () => {
        document.body.innerHTML = `
            <input data-test-id="dp-input" />
            <div class="dp--outer-menu-wrap" hidden><span>stale</span></div>
            <div class="dp--outer-menu-wrap"><span>open</span></div>
        `;

        const input = document.querySelector<HTMLInputElement>('[data-test-id="dp-input"]')!;
        const menu = pickerMenu(input, isVisible);

        expect(menu?.textContent).toBe('open');
    });

    it('returns null when no calendar is open', () => {
        document.body.innerHTML = '<input data-test-id="dp-input" />';
        const input = document.querySelector<HTMLInputElement>('[data-test-id="dp-input"]')!;

        expect(pickerMenu(input, isVisible)).toBeNull();
    });

    it('builds the day-cell selector vue-datepicker actually renders', () => {
        document.body.innerHTML = `
            <div class="dp--calendar">
                <div data-test-id="dp-2026-10-15">15</div>
            </div>
        `;

        expect(document.querySelector(dpCellSelector('2026-10-15'))).not.toBeNull();
        expect(document.querySelector(dpCellSelector('2026-10-16'))).toBeNull();
    });
});

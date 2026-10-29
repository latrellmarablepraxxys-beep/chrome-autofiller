import { beforeEach, describe, expect, it } from 'vitest';
import { fillDatePicker } from '../src/adapters/datepicker';
import { scanControls } from '../src/core/scanner';
import type { DetectedControl } from '../src/shared/types';

function control(el: HTMLElement, partial: Partial<DetectedControl> = {}): DetectedControl {
    return {
        el,
        kind: 'date',
        label: 'Birthdate',
        name: 'birthdate',
        id: 'birthdate',
        placeholder: '',
        required: true,
        key: 'birthdate',
        accept: '',
        multiple: false,
        numeric: false,
        index: 0,
        ...partial,
    };
}

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

interface PickerOptions {
    readOnly?: boolean;
    visible?: Date;
    /** Prefix year/month overlay labels so the text matchers cannot use them. */
    unreadableOverlays?: boolean;
}

/**
 * Minimal stand-in for `@vuepic/vue-datepicker` (v13/v14 DOM). The popup only
 * renders the visible month, so reaching another month needs the header
 * overlays or the nav arrows — exactly like the real component.
 */
function mountPicker(options: PickerOptions = {}) {
    document.body.innerHTML = `
        <div class="dp--main">
            <div class="dp--input-wrap">
                <input
                    data-test-id="dp-input"
                    class="dp--input"
                    role="combobox"
                    aria-haspopup="dialog"
                    aria-expanded="false"
                    inputmode="none"
                    placeholder="MM/DD/YYYY"
                />
            </div>
        </div>
        <div class="dp--outer-menu-wrap dp--menu-wrapper" hidden></div>
    `;

    const input = document.querySelector<HTMLInputElement>('[data-test-id="dp-input"]')!;
    const menu = document.querySelector<HTMLElement>('.dp--outer-menu-wrap')!;

    const state = {
        visible: options.visible ?? new Date(2026, 9, 1),
        overlay: null as 'year' | 'month' | null,
        pending: null as Date | null,
        open: false,
    };

    if (options.readOnly) input.readOnly = true;

    const render = () => {
        const year = state.visible.getFullYear();
        const month = state.visible.getMonth();
        const monthShort = state.visible.toLocaleString('en-US', { month: 'short' });
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
            return `<div class="dp--cell" data-act="day" data-day="${day}" data-test-id="dp-${iso}">${day}</div>`;
        }).join('');

        const prefix = options.unreadableOverlays ? 'x' : '';
        const overlay =
            state.overlay === 'year'
                ? Array.from({ length: 56 }, (_, index) => 1980 + index)
                      .map(
                          (value) =>
                              `<div class="dp--overlay-cell" data-act="year" data-value="${value}">${prefix}${value}</div>`,
                      )
                      .join('')
                : state.overlay === 'month'
                  ? Array.from({ length: 12 }, (_, index) =>
                        new Date(2026, index, 1).toLocaleString('en-US', { month: 'long' }),
                    )
                        .map(
                            (name, index) =>
                                `<div class="dp--overlay-cell" data-act="month" data-value="${index}">${prefix}${name}</div>`,
                        )
                        .join('')
                  : '';

        menu.innerHTML = `
            <div class="dp--calendar-header">
                <button type="button" data-dp-element="action-prev" aria-label="Previous month"></button>
                <button type="button" data-act="month-trigger">${monthShort}</button>
                <button type="button" data-act="year-trigger">${year}</button>
                <button type="button" data-dp-element="action-next" aria-label="Next month"></button>
            </div>
            <div class="dp--calendar">${days}</div>
            <div class="dp--action-row">
                <button type="button" data-act="select" data-test-id="select-button">Select</button>
            </div>
            ${overlay ? `<div class="dp--overlay">${overlay}</div>` : ''}
        `;
    };

    const setOpen = (open: boolean) => {
        state.open = open;
        menu.hidden = !open;
        input.setAttribute('aria-expanded', String(open));
        if (open) render();
    };

    input.addEventListener('click', () => setOpen(!state.open));

    menu.addEventListener('click', (event) => {
        const el = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
        if (!el) return;

        switch (el.dataset.act) {
            case 'prev':
                state.visible = new Date(state.visible.getFullYear(), state.visible.getMonth() - 1, 1);
                render();
                return;
            case 'next':
                state.visible = new Date(state.visible.getFullYear(), state.visible.getMonth() + 1, 1);
                render();
                return;
            case 'year-trigger':
                state.overlay = 'year';
                render();
                return;
            case 'month-trigger':
                state.overlay = 'month';
                render();
                return;
            case 'year':
                state.visible = new Date(Number(el.dataset.value), state.visible.getMonth(), 1);
                state.overlay = 'month';
                render();
                return;
            case 'month':
                state.visible = new Date(state.visible.getFullYear(), Number(el.dataset.value), 1);
                state.overlay = null;
                render();
                return;
            case 'day':
                state.pending = new Date(
                    state.visible.getFullYear(),
                    state.visible.getMonth(),
                    Number(el.dataset.day),
                );
                return;
            case 'select':
                if (!state.pending) return;
                input.value = `${pad(state.pending.getMonth() + 1)}/${pad(
                    state.pending.getDate(),
                )}/${state.pending.getFullYear()}`;
                setOpen(false);
                return;
            default:
                return;
        }
    });

    return { input, menu, state };
}

describe('date picker detection', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('detects the v14 input as a date instead of a combobox', () => {
        mountPicker();

        const controls = scanControls();

        expect(controls.filter((item) => item.kind === 'date')).toHaveLength(1);
        expect(controls.some((item) => item.kind === 'reka-combobox')).toBe(false);
    });

    it('detects the legacy v12 input class', () => {
        document.body.innerHTML = `
            <div class="dp__input_wrap">
                <input class="dp__input" name="published_at" placeholder="MM/DD/YYYY" />
            </div>
        `;

        expect(scanControls()[0]?.kind).toBe('date');
    });

    it('skips inputs rendered inside the calendar popup', () => {
        const { menu } = mountPicker();
        menu.hidden = false;
        menu.innerHTML = '<div class="dp--tp-wrap"><input class="dp--time-input" name="hours" /></div>';

        expect(scanControls().some((item) => item.name === 'hours')).toBe(false);
    });

    it('still detects a native date input', () => {
        document.body.innerHTML = '<input type="date" name="published_at" />';
        expect(scanControls()[0]?.kind).toBe('date');
    });
});

describe('date picker filling', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('clicks the day cell and commits through the action row', async () => {
        const { input, menu } = mountPicker();

        const outcome = await fillDatePicker(control(input), '2026-10-15');

        expect(outcome.status).toBe('filled');
        expect(outcome.strategy).toBe('date-picker');
        expect(input.value).toBe('10/15/2026');
        expect(menu.hidden).toBe(true);
    });

    it('reaches another year through the header overlays', async () => {
        const { input } = mountPicker();

        const outcome = await fillDatePicker(control(input), '1990-03-12');

        expect(outcome.status).toBe('filled');
        expect(input.value).toBe('03/12/1990');
    }, 20000);

    it('falls back to the month arrows when overlay labels are unusable', async () => {
        const { input } = mountPicker({ unreadableOverlays: true });

        const outcome = await fillDatePicker(control(input), '2026-09-04');

        expect(outcome.status).toBe('filled');
        expect(input.value).toBe('09/04/2026');
    }, 20000);

    it('fills a readonly picker through the calendar instead of skipping it', async () => {
        const { input } = mountPicker({ readOnly: true });

        const outcome = await fillDatePicker(control(input), '2026-10-02');

        expect(outcome.status).toBe('filled');
        expect(input.value).toBe('10/02/2026');
    });

    it('keeps native date inputs on ISO values', async () => {
        const input = document.createElement('input');
        input.type = 'date';
        document.body.appendChild(input);

        const outcome = await fillDatePicker(control(input), '2026-10-29');

        expect(outcome.status).toBe('filled');
        expect(outcome.strategy).toBe('native-date');
        expect(input.value).toBe('2026-10-29');
    });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { chooseAllowedIso, fillDatePicker, readDateBounds } from '../src/adapters/datepicker';
import { scanControls } from '../src/core/scanner';
import { Rng } from '../src/shared/random';
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
        expect(document.activeElement).toBe(input);
    });

    it('pulls a native date input inside its min/max range', async () => {
        const input = document.createElement('input');
        input.type = 'date';
        input.min = '2026-11-01';
        input.max = '2026-11-30';
        document.body.appendChild(input);

        const outcome = await fillDatePicker(control(input), '2026-10-29');

        expect(outcome.status).toBe('filled');
        expect(input.value).toBe('2026-11-01');
    });
});

describe('allowed dates in the picker', () => {
    function mountMenu(): { input: HTMLInputElement; menu: HTMLElement } {
        document.body.innerHTML = `
            <div class="dp--main">
                <div class="dp--input-wrap">
                    <input data-test-id="dp-input" class="dp--input" value="" />
                </div>
            </div>
            <div class="dp--menu-wrapper">
                ${[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
                    .map((day) => {
                        const iso = `2026-10-${String(day).padStart(2, '0')}`;
                        // 10/04 is the day the faker would normally target: the
                        // app disallows it, so the adapter has to move.
                        const disabled = day === 4;
                        return `<div class="dp--cell${disabled ? ' dp--cell-disabled' : ''}" data-test-id="dp-${iso}">${day}</div>`;
                    })
                    .join('')}
            </div>
        `;

        return {
            input: document.querySelector<HTMLInputElement>('[data-test-id="dp-input"]')!,
            menu: document.querySelector<HTMLElement>('.dp--menu-wrapper')!,
        };
    }

    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('keeps a date the picker allows', () => {
        const { input, menu } = mountMenu();

        expect(chooseAllowedIso(menu, input, '2026-10-15', new Rng(1))).toBe('2026-10-15');
    });

    it('swaps a disabled day for a random day the picker allows', () => {
        const { input, menu } = mountMenu();
        const picks = new Set<string>();

        for (let seed = 1; seed <= 12; seed += 1) {
            const iso = chooseAllowedIso(menu, input, '2026-10-04', new Rng(seed));
            expect(iso).not.toBe('2026-10-04');
            expect(iso.startsWith('2026-10-')).toBe(true);
            picks.add(iso);
        }

        expect(picks.size).toBeGreaterThan(1);
    });

    it('reads the allowed range from the input when the page exposes it', () => {
        const { input, menu } = mountMenu();
        input.setAttribute('data-min-date', '2026-11-01');
        input.setAttribute('data-max-date', '2026-11-30');

        expect(readDateBounds(input, menu).min?.getMonth()).toBe(10);
        expect(readDateBounds(input, menu).max?.getDate()).toBe(30);
    });

    it('picks a random date inside a declared range', () => {
        const { input, menu } = mountMenu();
        input.setAttribute('min', '2026-11-01');
        input.setAttribute('max', '2026-11-05');
        const picks = new Set<string>();

        for (let seed = 1; seed <= 12; seed += 1) {
            const iso = chooseAllowedIso(menu, input, '2026-10-15', new Rng(seed));
            expect(iso >= '2026-11-01').toBe(true);
            expect(iso <= '2026-11-05').toBe(true);
            picks.add(iso);
        }

        expect(picks.size).toBeGreaterThan(1);
    });

    it('clamps to a one-sided range', () => {
        const { input, menu } = mountMenu();
        input.setAttribute('max', '2026-09-30');

        expect(chooseAllowedIso(menu, input, '2026-10-15', new Rng(3))).toBe('2026-09-30');
    });
});

describe('time picker filling', () => {
    interface TimeFake {
        inputs: HTMLInputElement[];
        menu: HTMLElement;
        start: HTMLInputElement;
        end?: HTMLInputElement;
    }

    /**
     * Stand-in for vue-datepicker in `time-picker` mode (v13/v14 DOM): one
     * `.dp--time-input` column set per range slot, with hour/minute overlays
     * and an AM/PM button, all driven by `data-test-id` toggles.
     */
    function mountTimePicker(options: { range?: boolean } = {}): TimeFake {
        const range = Boolean(options.range);
        document.body.innerHTML = `
            <div class="dp--main">
                <div class="dp--input-wrap">
                    <input data-test-id="dp-input" class="dp--input" role="combobox" aria-haspopup="dialog" aria-expanded="false" />
                </div>
                ${
                    range
                        ? '<div class="dp--input-wrap"><input data-test-id="dp-input" class="dp--input" role="combobox" aria-haspopup="dialog" aria-expanded="false" /></div>'
                        : ''
                }
            </div>
            <div class="dp--outer-menu-wrap dp--menu-wrapper" hidden></div>
        `;

        const inputs = Array.from(
            document.querySelectorAll<HTMLInputElement>('[data-test-id^="dp-input"]'),
        );
        const menu = document.querySelector<HTMLElement>('.dp--outer-menu-wrap')!;

        const times = [
            { hours: 9, minutes: 30, mer: 'AM' },
            { hours: 10, minutes: 30, mer: 'AM' },
        ];
        const overlay = { hours: false, minutes: false };
        const state = { open: false };

        const pad = (value: number) => String(value).padStart(2, '0');
        const display = (t: (typeof times)[number]) =>
            `${pad(t.hours % 12 || 12)}:${pad(t.minutes)} ${t.mer}`;

        // Build the DOM once and patch state in place (like Vue does), so the
        // adapter's element references stay live across interactions.
        const render = () => {
            if (!menu.dataset.built) {
                menu.dataset.built = '1';
                const orders = range ? [0, 1] : [0];
                menu.innerHTML = `
                    <div class="dp--tp-wrap">
                        ${orders
                            .map(
                                (order) => `
                            <div class="dp--time-input" data-time-root="${order}">
                                <div class="dp--time-col">
                                    <button type="button" data-act="hours-toggle" data-order="${order}" data-test-id="hours-toggle-overlay-btn-${order}" aria-expanded="false">00</button>
                                </div>
                                <div class="dp--time-col">
                                    <button type="button" data-act="minutes-toggle" data-order="${order}" data-test-id="minutes-toggle-overlay-btn-${order}" aria-expanded="false">00</button>
                                </div>
                                <button type="button" class="dp--pm-am-button" data-act="ampm" data-order="${order}">AM</button>
                                <div class="dp--overlay" data-overlay="hours" hidden>
                                    ${Array.from({ length: 12 }, (_, index) => index + 1)
                                        .map(
                                            (hour) =>
                                                `<div class="dp--overlay-cell" data-act="hour-cell" data-order="${order}" data-value="${hour}">${pad(hour)}</div>`,
                                        )
                                        .join('')}
                                </div>
                                <div class="dp--overlay" data-overlay="minutes" hidden>
                                    ${Array.from({ length: 60 }, (_, index) => index)
                                        .map(
                                            (minute) =>
                                                `<div class="dp--overlay-cell" data-act="minute-cell" data-order="${order}" data-value="${minute}">${pad(minute)}</div>`,
                                        )
                                        .join('')}
                                </div>
                            </div>
                        `,
                            )
                            .join('')}
                    </div>
                    <div class="dp--action-row">
                        <button type="button" data-act="select" data-test-id="select-button">Select</button>
                    </div>
                `;
            }

            const orders = range ? [0, 1] : [0];
            for (const order of orders) {
                const root = menu.querySelector<HTMLElement>(`[data-time-root="${order}"]`)!;
                const time = times[order];

                const hoursToggle = root.querySelector<HTMLElement>(
                    `[data-test-id="hours-toggle-overlay-btn-${order}"]`,
                )!;
                const minutesToggle = root.querySelector<HTMLElement>(
                    `[data-test-id="minutes-toggle-overlay-btn-${order}"]`,
                )!;

                hoursToggle.textContent = pad(time.hours % 12 || 12);
                hoursToggle.setAttribute('aria-expanded', String(overlay.hours));
                minutesToggle.textContent = pad(time.minutes);
                minutesToggle.setAttribute('aria-expanded', String(overlay.minutes));

                root.querySelector<HTMLElement>('.dp--pm-am-button')!.textContent = time.mer;
                root.querySelector<HTMLElement>('[data-overlay="hours"]')!.hidden = !overlay.hours;
                root.querySelector<HTMLElement>('[data-overlay="minutes"]')!.hidden = !overlay.minutes;

                inputs[order].value = display(time);
            }
        };

        const setOpen = (open: boolean) => {
            state.open = open;
            menu.hidden = !open;
            if (open) render();
        };

        inputs.forEach((input) => input.addEventListener('click', () => setOpen(!state.open)));

        menu.addEventListener('click', (event) => {
            const el = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
            if (!el) return;

            const order = Number(el.dataset.order ?? 0);
            const time = times[order];

            switch (el.dataset.act) {
                case 'hours-toggle':
                    overlay.minutes = false;
                    overlay.hours = !overlay.hours;
                    render();
                    return;
                case 'minutes-toggle':
                    overlay.hours = false;
                    overlay.minutes = !overlay.minutes;
                    render();
                    return;
                case 'ampm':
                    time.mer = time.mer === 'AM' ? 'PM' : 'AM';
                    time.hours = time.mer === 'PM' ? (time.hours % 12) + 12 : time.hours % 12;
                    render();
                    return;
                case 'hour-cell': {
                    const value = Number(el.dataset.value);
                    time.hours =
                        time.mer === 'PM'
                            ? value === 12
                                ? 12
                                : value + 12
                            : value === 12
                              ? 0
                              : value;
                    overlay.hours = false;
                    render();
                    return;
                }
                case 'minute-cell':
                    time.minutes = Number(el.dataset.value);
                    overlay.minutes = false;
                    render();
                    return;
                case 'select':
                    setOpen(false);
                    return;
                default:
                    return;
            }
        });

        return {
            inputs,
            menu,
            start: inputs[0],
            end: inputs[1] as HTMLInputElement | undefined,
        };
    }

    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('fills a time picker through the hour/minute overlays', async () => {
        const { start, menu } = mountTimePicker();

        const outcome = await fillDatePicker(control(start), '10:30 AM');

        expect(outcome.status).toBe('filled');
        expect(outcome.strategy).toBe('date-picker-time');
        expect(start.value).toBe('10:30 AM');
        expect(menu.hidden).toBe(true);
    }, 20000);

    it('fills both ends of a time range', async () => {
        const { start, end } = mountTimePicker({ range: true });

        const outcome = await fillDatePicker(control(start), '09:15 AM');

        expect(outcome.status).toBe('filled');
        expect(start.value).toBe('09:15 AM');
        expect(end?.value).toBe('10:15 AM');
    }, 20000);

    it('uses a sensible default when the value is not a time', async () => {
        const { start } = mountTimePicker();

        const outcome = await fillDatePicker(control(start), '2026-10-29');

        expect(outcome.status).toBe('filled');
        expect(start.value).toBe('09:30 AM');
    }, 20000);
});

/**
 * Selectors for `@vuepic/vue-datepicker`, verified against the published
 * bundles of v9/v10/v11/v12 and v13/v14 (the class prefix moved from
 * `dp__` to `dp--` in v13, and v14 added `role="combobox"` to the input).
 */

import { isVisible } from './dom';

/** The text input of a date picker, across all supported versions. */
export const DP_INPUT_SELECTOR = [
    '[data-test-id="dp-input"]',
    'input.dp__input',
    'input.dp--input',
    '.dp__input_wrap > input',
    '.dp--input-wrap > input',
].join(',');

/** The calendar popup. v13+ teleports it to <body>. */
export const DP_MENU_SELECTOR = [
    '.dp-menu',
    '.dp--outer-menu-wrap',
    '.dp--menu-wrapper',
    '.dp__menu',
    '.dp__outer_menu_wrap',
].join(',');

/**
 * Day cell for `iso`. v11+ marks the cell itself with `data-test-id`, while
 * v9/v10 put the ISO date on the wrapping `.dp__calendar_item` and bind the
 * click handler to its inner element.
 */
export function dpCellSelector(iso: string): string {
    return [
        `[data-test-id="dp-${iso}"]`,
        `.dp__calendar_item[id="${iso}"] > .dp__cell_inner`,
        `.dp__calendar_item[id="${iso}"]`,
    ].join(',');
}

/** ISO date behind a calendar cell, for either DOM shape. */
export function dpCellIso(cell: Element): string | null {
    const fromTestId = /^dp-(\d{4}-\d{2}-\d{2})$/.exec(cell.getAttribute('data-test-id') ?? '');
    if (fromTestId) return fromTestId[1];

    const owner = cell.closest('.dp__calendar_item') ?? cell;
    const id = owner.getAttribute('id') ?? '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(id)) return id;

    const fromString = /(\d{4}-\d{2}-\d{2})/.exec(owner.getAttribute('data-test-id') ?? '');
    return fromString ? fromString[1] : null;
}

/** True when the picker marks a day as unavailable (out of range, offset). */
export function dpCellDisabled(cell: Element): boolean {
    const nodes = [cell, cell.parentElement, cell.closest('.dp__calendar_item')].filter(
        (node): node is Element => node instanceof Element,
    );

    return nodes.some(
        (node) =>
            node.getAttribute('aria-disabled') === 'true' ||
            node.getAttribute('data-disabled') === 'true' ||
            node.classList.contains('dp__cell_disabled') ||
            node.classList.contains('dp--cell-disabled') ||
            node.classList.contains('dp__cell_offset') ||
            node.classList.contains('dp--cell-offset'),
    );
}

/** Every enabled day cell the picker currently renders. */
export function dpEnabledDayCells(menu: HTMLElement): HTMLElement[] {
    const cells = Array.from(
        menu.querySelectorAll<HTMLElement>('[data-test-id^="dp-"], .dp__calendar_item'),
    );

    return cells.filter(
        (cell) => Boolean(dpCellIso(cell)) && isVisible(cell) && !dpCellDisabled(cell),
    );
}

export const DP_SELECT_BUTTON = '[data-test-id="select-button"]';
export const DP_PREV_BUTTON = '[data-dp-element="action-prev"]';
export const DP_NEXT_BUTTON = '[data-dp-element="action-next"]';
export const DP_OVERLAY_CELL = '.dp--overlay-cell, .dp__overlay_cell';

/** One time column set (hours/minutes/seconds + AM/PM), per range slot. */
export const DP_TIME_INPUT = '.dp--time-input, .dp__time_input';
export const DP_PM_AM_BUTTON = '.dp--pm-am-button, .dp__pm_am_button';

export function dpTimeToggleSelector(type: 'hours' | 'minutes', order: number): string {
    return `[data-test-id="${type}-toggle-overlay-btn-${order}"]`;
}

export function isDatePickerInput(el: Element): boolean {
    return el instanceof HTMLElement && el.matches(DP_INPUT_SELECTOR);
}

/** True when the element lives inside an open calendar popup. */
export function insideDatePickerMenu(el: Element): boolean {
    return Boolean(el.closest(DP_MENU_SELECTOR));
}

/**
 * Locate the popup belonging to `input`: `aria-controls` when the picker
 * provides it, else the nearest container that holds a visible calendar
 * (v9/v10 render it next to the input), else the last visible calendar.
 */
export function pickerMenu(input: HTMLElement, isVisible: (el: Element) => boolean): HTMLElement | null {
    const controlled = input.getAttribute('aria-controls');
    if (controlled) {
        const menu = document.getElementById(controlled);
        if (menu && isVisible(menu)) return menu;
    }

    // Several pickers can live on one page; the nearest ancestor that owns a
    // visible menu is this input's own calendar.
    let node: HTMLElement | null = input;
    for (let depth = 0; depth < 4 && node; depth += 1) {
        const menus = Array.from(node.querySelectorAll<HTMLElement>(DP_MENU_SELECTOR)).filter(
            isVisible,
        );
        if (menus.length) return menus[menus.length - 1];
        node = node.parentElement;
    }

    const candidates = Array.from(document.querySelectorAll<HTMLElement>(DP_MENU_SELECTOR)).filter(
        isVisible,
    );

    return candidates.length ? candidates[candidates.length - 1] : null;
}

/**
 * Selectors for `@vuepic/vue-datepicker`, verified against the published
 * bundles of v9/v10/v11/v12 and v13/v14 (the class prefix moved from
 * `dp__` to `dp--` in v13, and v14 added `role="combobox"` to the input).
 */

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

/** Day cells carry a stable id: `dp-YYYY-MM-DD` (v11+). */
export function dpCellSelector(iso: string): string {
    return `[data-test-id="dp-${iso}"]`;
}

export const DP_SELECT_BUTTON = '[data-test-id="select-button"]';
export const DP_PREV_BUTTON = '[data-dp-element="action-prev"]';
export const DP_NEXT_BUTTON = '[data-dp-element="action-next"]';
export const DP_OVERLAY_CELL = '.dp--overlay-cell, .dp__overlay_cell';

export function isDatePickerInput(el: Element): boolean {
    return el instanceof HTMLElement && el.matches(DP_INPUT_SELECTOR);
}

/** True when the element lives inside an open calendar popup. */
export function insideDatePickerMenu(el: Element): boolean {
    return Boolean(el.closest(DP_MENU_SELECTOR));
}

/**
 * Locate the popup belonging to `input`: `aria-controls` when the picker
 * provides it, otherwise the last visible calendar on the page.
 */
export function pickerMenu(input: HTMLElement, isVisible: (el: Element) => boolean): HTMLElement | null {
    const controlled = input.getAttribute('aria-controls');
    if (controlled) {
        const menu = document.getElementById(controlled);
        if (menu && isVisible(menu)) return menu;
    }

    const candidates = Array.from(document.querySelectorAll<HTMLElement>(DP_MENU_SELECTOR)).filter(
        isVisible,
    );

    return candidates.length ? candidates[candidates.length - 1] : null;
}

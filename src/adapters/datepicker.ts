import type { DetectedControl } from '../shared/types';
import {
    clickSequence,
    isDisabled,
    isVisible,
    normalizeText,
    setNativeValue,
    sleep,
    waitFor,
} from '../shared/dom';
import {
    dateFromIso,
    dateLooksApplied,
    formatDateTokens,
    parseFormatHint,
    toIsoDate,
} from '../shared/dateformat';
import {
    DP_NEXT_BUTTON,
    DP_OVERLAY_CELL,
    DP_PREV_BUTTON,
    DP_SELECT_BUTTON,
    dpCellSelector,
    isDatePickerInput,
    pickerMenu,
} from '../shared/picker';
import { fail, ok, skip, type FieldOutcome } from './types';

/** Formats to try when a picker accepts typed text. */
const TEXT_FORMATS = [
    'MM/dd/yyyy',
    'MM-dd-yyyy',
    'dd/MM/yyyy',
    'MMM dd, yyyy',
    'dd MMM yyyy',
    'yyyy-MM-dd',
];

const MONTH_NAMES_LIST = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

const MONTH_NAMES = new Set(MONTH_NAMES_LIST);

function pressKey(el: HTMLElement, key: 'Enter' | 'Escape'): void {
    const keyCode = key === 'Enter' ? 13 : 27;
    const init = {
        key,
        code: key,
        keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
    } as KeyboardEventInit;

    el.dispatchEvent(new KeyboardEvent('keydown', init));
    el.dispatchEvent(new KeyboardEvent('keyup', init));
}

function currentMenu(input: HTMLElement): HTMLElement | null {
    return pickerMenu(input, isVisible);
}

async function openPicker(input: HTMLInputElement): Promise<HTMLElement | null> {
    const existing = currentMenu(input);
    if (existing && input.getAttribute('aria-expanded') !== 'false') return existing;

    clickSequence(input);
    return waitFor(() => currentMenu(input), 1800);
}

async function closePicker(input: HTMLInputElement): Promise<void> {
    if (!currentMenu(input)) return;
    pressKey(input, 'Escape');
    await sleep(140);
}

function headerButtons(menu: HTMLElement): HTMLElement[] {
    return Array.from(menu.querySelectorAll<HTMLElement>('button')).filter(isVisible);
}

function yearTrigger(menu: HTMLElement): HTMLElement | null {
    return (
        headerButtons(menu).find((button) => /^\d{4}$/.test(normalizeText(button.textContent))) ??
        null
    );
}

function monthTrigger(menu: HTMLElement): HTMLElement | null {
    return (
        headerButtons(menu).find((button) => {
            const text = normalizeText(button.textContent).toLowerCase();
            return text.length <= 9 && MONTH_NAMES.has(text);
        }) ?? null
    );
}

function overlayCell(menu: HTMLElement, matcher: (text: string) => boolean): HTMLElement | null {
    const cells = Array.from(menu.querySelectorAll<HTMLElement>(DP_OVERLAY_CELL)).filter(isVisible);
    return cells.find((cell) => matcher(normalizeText(cell.textContent))) ?? null;
}

function monthTexts(date: Date): Set<string> {
    return new Set([
        date.toLocaleString('en-US', { month: 'long' }).toLowerCase(),
        date.toLocaleString('en-US', { month: 'short' }).toLowerCase(),
    ]);
}

/** Click the day cell for `iso` when it is currently rendered. */
async function clickDayCell(iso: string): Promise<boolean> {
    const cell = await waitFor(() => {
        const found = document.querySelector<HTMLElement>(dpCellSelector(iso));
        return found && isVisible(found) ? found : null;
    }, 900);

    if (!cell) return false;

    clickSequence(cell);
    await sleep(240);
    return true;
}

/** Read the month the calendar is showing from its header toggles. */
function headerMonth(menu: HTMLElement): Date | null {
    const year = yearTrigger(menu);
    const month = monthTrigger(menu);
    if (!year || !month) return null;

    const yearValue = Number(normalizeText(year.textContent));
    const index = MONTH_NAMES_LIST.indexOf(normalizeText(month.textContent).toLowerCase());

    if (!Number.isFinite(yearValue) || index < 0) return null;

    return new Date(yearValue, index % 12, 1);
}

/** Walk the month arrows when the header overlays are unavailable. */
async function navigateMonths(menu: HTMLElement, iso: string, target: Date): Promise<boolean> {
    for (let step = 0; step < 36; step += 1) {
        const cell = document.querySelector<HTMLElement>(dpCellSelector(iso));
        if (cell && isVisible(cell)) {
            clickSequence(cell);
            await sleep(240);
            return true;
        }

        const shown = headerMonth(menu);
        if (!shown) return false;

        const delta =
            (target.getFullYear() - shown.getFullYear()) * 12 +
            (target.getMonth() - shown.getMonth());
        if (delta === 0) return false;

        const arrow = menu.querySelector<HTMLElement>(delta > 0 ? DP_NEXT_BUTTON : DP_PREV_BUTTON);
        if (!arrow || !isVisible(arrow)) return false;

        clickSequence(arrow);
        await sleep(170);
    }

    return false;
}

async function pickViaCalendar(
    menu: HTMLElement,
    iso: string,
): Promise<boolean> {
    if (await clickDayCell(iso)) return true;

    const target = dateFromIso(iso);
    if (!target) return false;

    // Far dates (birthdates) need the month/year overlays, not the arrows.
    const year = yearTrigger(menu);
    if (year) {
        clickSequence(year);
        await sleep(180);

        const cell = overlayCell(menu, (text) => text === String(target.getFullYear()));
        if (cell) {
            clickSequence(cell);
            await sleep(240);
        }
        if (await clickDayCell(iso)) return true;
    }

    const wanted = monthTexts(target);
    let month = overlayCell(menu, (text) => wanted.has(text.toLowerCase()));

    if (!month) {
        const trigger = monthTrigger(menu);
        if (trigger) {
            clickSequence(trigger);
            await sleep(180);
            month = overlayCell(menu, (text) => wanted.has(text.toLowerCase()));
        }
    }

    if (month) {
        clickSequence(month);
        await sleep(240);
        if (await clickDayCell(iso)) return true;
    }

    return navigateMonths(menu, iso, target);
}

/** The action row commits the selection unless `auto-apply` is on. */
async function commitPicker(input: HTMLInputElement): Promise<void> {
    const menu = currentMenu(input);
    if (!menu) return;

    const button = Array.from(menu.querySelectorAll<HTMLElement>(DP_SELECT_BUTTON)).find(isVisible);
    if (!button) return;

    clickSequence(button);
    await sleep(220);
}

async function fillViaText(
    input: HTMLInputElement,
    control: DetectedControl,
    iso: string,
): Promise<FieldOutcome> {
    const target = dateFromIso(iso);
    if (!target) return fail('invalid date');

    const hints = [
        parseFormatHint(control.placeholder),
        parseFormatHint(input.getAttribute('placeholder') ?? ''),
        parseFormatHint(input.getAttribute('aria-label') ?? ''),
    ].filter((hint): hint is string => Boolean(hint));

    const formats = Array.from(new Set([...hints, ...TEXT_FORMATS]));

    for (const pattern of formats) {
        input.focus();
        try {
            input.select();
        } catch {
            // ignored in non-layout environments
        }

        setNativeValue(input, formatDateTokens(target, pattern));
        pressKey(input, 'Enter');
        await sleep(90);

        const value = input.value;
        if (dateLooksApplied(value, iso)) return ok('date-text', value);
    }

    return fail('no accepted date format');
}

export async function fillDatePicker(
    control: DetectedControl,
    raw: string,
): Promise<FieldOutcome> {
    const el = control.el as HTMLInputElement;

    if (isDisabled(el)) return skip('disabled');

    const iso = toIsoDate(raw);
    if (!iso) return fail(`unparseable date: ${raw}`);

    if (el instanceof HTMLInputElement && el.type === 'date') {
        el.focus();
        setNativeValue(el, iso);
        return el.value ? ok('native-date', el.value) : fail('value did not apply');
    }

    const picker = isDatePickerInput(el);

    if (picker) {
        const menu = await openPicker(el);

        if (menu) {
            const applied = await pickViaCalendar(menu, iso);
            if (applied) {
                await commitPicker(el);
                await sleep(120);

                const value = el.value;
                if (value || dateLooksApplied(value, iso)) return ok('date-picker', value);
            }

            await closePicker(el);
        }
    }

    if (el.readOnly) {
        return picker ? fail('picker did not commit the date') : skip('read-only');
    }

    return fillViaText(el, control, iso);
}

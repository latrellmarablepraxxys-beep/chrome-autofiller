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
import { Rng, hashString } from '../shared/random';
import {
    DP_NEXT_BUTTON,
    DP_OVERLAY_CELL,
    DP_PREV_BUTTON,
    DP_SELECT_BUTTON,
    dpCellDisabled,
    dpCellIso,
    dpCellSelector,
    dpEnabledDayCells,
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

/** Click the day cell for `iso` when the picker currently renders it. */
async function clickDayCell(menu: HTMLElement, iso: string): Promise<boolean> {
    const cell = await waitFor(() => {
        const found = menu.querySelector<HTMLElement>(dpCellSelector(iso));
        return found && isVisible(found) && !dpCellDisabled(found) ? found : null;
    }, 900);

    if (!cell) return false;

    clickSequence(cell);
    await sleep(240);
    return true;
}

const DAY_MS = 86_400_000;

interface DateBounds {
    min?: Date;
    max?: Date;
}

function isoOf(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate(),
    ).padStart(2, '0')}`;
}

function boundFrom(node: Element | null, names: string[]): Date | null {
    if (!node) return null;

    for (const name of names) {
        const iso = toIsoDate(node.getAttribute(name) ?? '');
        const parsed = iso ? dateFromIso(iso) : null;
        if (parsed) return parsed;
    }

    return null;
}

/**
 * Allowed range, when the page exposes it. `@vuepic/vue-datepicker` does not
 * render min/max on the input by default, but apps that pass `minDate`/
 * `maxDate` often do, and the wrapper/menu may carry data attributes.
 */
export function readDateBounds(input: HTMLElement, menu: HTMLElement | null): DateBounds {
    const scopes = [input, input.parentElement, menu];
    const min =
        scopes
            .map((scope) => boundFrom(scope, ['min', 'data-min', 'data-min-date', 'aria-valuemin']))
            .find((value): value is Date => value !== null) ?? undefined;
    const max =
        scopes
            .map((scope) => boundFrom(scope, ['max', 'data-max', 'data-max-date', 'aria-valuemax']))
            .find((value): value is Date => value !== null) ?? undefined;

    if (min && max && min.getTime() > max.getTime()) return { min: max, max: min };
    return { min, max };
}

/** Uniform random ISO date inside a fully bounded range. */
function randomIsoInBounds(bounds: DateBounds, rng: Rng): string | null {
    if (!bounds.min || !bounds.max) return null;

    const start = Date.UTC(bounds.min.getFullYear(), bounds.min.getMonth(), bounds.min.getDate());
    const end = Date.UTC(bounds.max.getFullYear(), bounds.max.getMonth(), bounds.max.getDate());
    if (end < start) return null;

    const offset = rng.int(0, Math.floor((end - start) / DAY_MS));
    return new Date(start + offset * DAY_MS).toISOString().slice(0, 10);
}

/** Pull a date that is out of range back to the nearest allowed day. */
function clampIso(iso: string, bounds: DateBounds): string {
    if (bounds.min && iso < isoOf(bounds.min)) return isoOf(bounds.min);
    if (bounds.max && iso > isoOf(bounds.max)) return isoOf(bounds.max);
    return iso;
}

function enabledDayCells(menu: HTMLElement): string[] {
    return dpEnabledDayCells(menu)
        .map(dpCellIso)
        .filter((iso): iso is string => iso !== null);
}

/**
 * Choose the date to click. The preferred date comes from the semantic faker,
 * so it is kept whenever the picker allows it. Otherwise pick a random day the
 * picker does allow — inside the declared min/max range when the page exposes
 * one, else from the enabled days of the rendered month.
 */
export function chooseAllowedIso(
    menu: HTMLElement,
    input: HTMLInputElement,
    preferredIso: string,
    rng: Rng,
): string {
    const bounds = readDateBounds(input, menu);

    if (bounds.min || bounds.max) {
        const inRange = clampIso(preferredIso, bounds) === preferredIso;
        if (!inRange) {
            return randomIsoInBounds(bounds, rng) ?? clampIso(preferredIso, bounds);
        }
    }

    const cell = menu.querySelector<HTMLElement>(dpCellSelector(preferredIso));
    if (cell && !dpCellDisabled(cell) && isVisible(cell)) return preferredIso;

    // The preferred day is on screen but disabled (out of the picker's window):
    // swap it for a random day that this month does allow.
    if (cell && dpCellDisabled(cell)) {
        const pool = enabledDayCells(menu);
        if (pool.length) return pool[rng.int(0, pool.length - 1)];
    }

    return preferredIso;
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
        const cell = menu.querySelector<HTMLElement>(dpCellSelector(iso));
        if (cell && isVisible(cell) && !dpCellDisabled(cell)) {
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

/**
 * Last resort: walk to any month the picker allows and click a random day in
 * it. Future-restricted pickers (minDate ahead of today) have no enabled day in
 * the month the calendar opens on.
 */
async function pickAnyAllowedDay(menu: HTMLElement, rng: Rng): Promise<boolean> {
    for (const direction of [DP_NEXT_BUTTON, DP_PREV_BUTTON]) {
        for (let step = 0; step < 24; step += 1) {
            const pool = enabledDayCells(menu);
            if (pool.length) {
                const iso = pool[rng.int(0, pool.length - 1)];
                return clickDayCell(menu, iso);
            }

            const arrow = menu.querySelector<HTMLElement>(direction);
            if (!arrow || !isVisible(arrow) || isDisabled(arrow)) break;

            clickSequence(arrow);
            await sleep(170);
        }
    }

    return false;
}

/**
 * Restricted pickers disable the days outside their window; an unrestricted
 * picker renders every day of the month. The distinction keeps a navigation
 * failure from silently committing an unrelated month.
 */
function hasDisabledDays(menu: HTMLElement): boolean {
    return Array.from(menu.querySelectorAll<HTMLElement>('[data-test-id^="dp-"]')).some(dpCellDisabled);
}

async function pickViaCalendar(menu: HTMLElement, iso: string, rng: Rng): Promise<boolean> {
    if (await clickDayCell(menu, iso)) return true;

    const target = dateFromIso(iso);
    if (!target) return false;

    // Nearby months are cheaper and more reliable through the nav arrows.
    const shown = headerMonth(menu);
    const monthDelta = shown
        ? (target.getFullYear() - shown.getFullYear()) * 12 +
          (target.getMonth() - shown.getMonth())
        : null;

    if (monthDelta !== null && Math.abs(monthDelta) <= 24) {
        if (await navigateMonths(menu, iso, target)) return true;
    }

    // Far dates (birthdates) need the month/year overlays, not the arrows.
    const year = yearTrigger(menu);
    if (year) {
        clickSequence(year);
        await sleep(180);

        const cell = overlayCell(menu, (text) => text === String(target.getFullYear()));
        if (cell) {
            try {
                cell.scrollIntoView({ block: 'center' });
            } catch {
                // ignored when the overlay is not scrollable
            }
            clickSequence(cell);
            await sleep(240);
        }

        if (await clickDayCell(menu, iso)) return true;
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
        if (await clickDayCell(menu, iso)) return true;
    }

    if (await navigateMonths(menu, iso, target)) return true;

    if (!hasDisabledDays(menu)) return false;

    return pickAnyAllowedDay(menu, rng);
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
    rng: Rng = new Rng(hashString(raw)),
): Promise<FieldOutcome> {
    const el = control.el as HTMLInputElement;

    if (isDisabled(el)) return skip('disabled');

    const iso = toIsoDate(raw);
    if (!iso) return fail(`unparseable date: ${raw}`);

    if (el instanceof HTMLInputElement && el.type === 'date') {
        const bounds = readDateBounds(el, null);
        const value = bounds.min || bounds.max ? clampIso(iso, bounds) : iso;

        el.focus();
        setNativeValue(el, value);
        // Some browsers blank the value when it falls outside min/max.
        return el.value ? ok('native-date', el.value) : fail('value outside allowed range');
    }

    const picker = isDatePickerInput(el);

    if (picker) {
        const menu = await openPicker(el);

        if (menu) {
            const targetIso = chooseAllowedIso(menu, el, iso, rng);
            const applied = await pickViaCalendar(menu, targetIso, rng);
            if (applied) {
                await commitPicker(el);
                await sleep(120);

                const value = el.value;
                if (value || dateLooksApplied(value, targetIso)) {
                    return ok('date-picker', value);
                }
            }

            await closePicker(el);
        }
    }

    if (el.readOnly) {
        return picker ? fail('picker did not commit the date') : skip('read-only');
    }

    return fillViaText(el, control, iso);
}

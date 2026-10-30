import { slugify } from './slug';

export function normalizeText(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function cleanLabel(value: string): string {
    return normalizeText(value.replace(/\*/g, ''));
}

export function visibilityReason(el: Element): string | null {
    const element = el as HTMLElement;
    if (!element.isConnected) return 'detached';
    if (element.hidden) return 'hidden';
    if (element.closest('[inert]')) return 'inert ancestor';
    if (element.closest('[aria-hidden="true"]')) return 'aria-hidden ancestor';
    if (element.closest('[hidden]')) return 'hidden ancestor';

    const style = window.getComputedStyle(element);
    if (style.display === 'none') return 'display:none';
    if (style.visibility === 'hidden') return 'visibility:hidden';
    if (style.opacity === '0') return 'opacity:0';

    return null;
}

export function isVisible(el: Element): boolean {
    return visibilityReason(el) === null;
}

export function isDisabled(el: Element): boolean {
    const element = el as HTMLInputElement;
    const dataDisabled = element.getAttribute('data-disabled');
    return (
        element.disabled === true ||
        element.getAttribute('aria-disabled') === 'true' ||
        element.hasAttribute('disabled') ||
        (dataDisabled !== null && dataDisabled !== 'false')
    );
}

const OPEN_MENU_SELECTOR = [
    '[role="listbox"]',
    '[role="menu"]',
    '.vs__dropdown-menu',
    '.multiselect__content-wrapper',
    '[data-slot="select-content"]',
    '[data-slot="combobox-content"]',
].join(',');

export function openDropdownMenus(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(OPEN_MENU_SELECTOR)).filter(isVisible);
}

/**
 * A dropdown left open can make the rest of the page aria-hidden, which would
 * hide every other field from the scanner. Close it on the control that owns
 * it, without sending Escape to the page when nothing is open (that would close
 * a surrounding dialog).
 */
export function closeOpenDropdowns(trigger?: HTMLElement | null): void {
    if (!openDropdownMenus().length) return;

    const target =
        trigger ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : document.body);

    target.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }),
    );
}

function cssEscape(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(value);
    }
    return value.replace(/["\\]/g, '\\$&');
}

export function readLabel(el: HTMLElement): string {
    const ariaLabel = el.getAttribute('aria-label');
    const genericAction =
        /^(show popup|open|close|toggle|select|choose|show options|open menu|expand|show|search for option|search|search options|filter|filter options)$/i;
    if (ariaLabel && !genericAction.test(normalizeText(ariaLabel))) {
        return normalizeText(ariaLabel);
    }

    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
        const text = labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ');
        if (normalizeText(text)) return normalizeText(text);
    }

    if (el.id) {
        const forLabel = document.querySelector(`label[for="${cssEscape(el.id)}"]`);
        if (forLabel) return normalizeText(forLabel.textContent);
    }

    const wrapping = el.closest('label');
    if (wrapping) return normalizeText(wrapping.textContent);

    let node: HTMLElement | null = el;
    for (let depth = 0; depth < 5 && node; depth += 1) {
        const label = node.querySelector('label');
        if (label && !label.contains(el)) return normalizeText(label.textContent);
        node = node.parentElement;
    }

    return normalizeText(el.getAttribute('placeholder'));
}

export function fieldKey(el: HTMLElement, label: string, index: number): string {
    const explicit =
        el.getAttribute('data-prx-field') ??
        el.getAttribute('data-testid') ??
        el.getAttribute('test-id');
    if (explicit) return explicit;

    const name = el.getAttribute('name');
    if (name) return name;
    if (el.id) return el.id;

    const slug = slugify(cleanLabel(label));
    if (slug) return slug;

    return `field-${index}`;
}

export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    const prototype =
        el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    descriptor?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function setSelectValue(el: HTMLSelectElement, value: string): void {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    descriptor?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function clickSequence(el: HTMLElement): void {
    try {
        el.scrollIntoView({ block: 'center', behavior: 'auto' });
    } catch {
        // ignored in non-layout environments
    }

    const rect = el.getBoundingClientRect();
    const base: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        button: 0,
    };

    if (typeof PointerEvent !== 'undefined') {
        el.dispatchEvent(
            new PointerEvent('pointerdown', {
                ...base,
                pointerId: 1,
                isPrimary: true,
                pointerType: 'mouse',
            }),
        );
    }
    el.dispatchEvent(new MouseEvent('mousedown', base));

    if (typeof PointerEvent !== 'undefined') {
        el.dispatchEvent(
            new PointerEvent('pointerup', {
                ...base,
                pointerId: 1,
                isPrimary: true,
                pointerType: 'mouse',
            }),
        );
    }
    el.dispatchEvent(new MouseEvent('mouseup', base));
    el.dispatchEvent(new MouseEvent('click', base));
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor<T>(
    probe: () => T | null | undefined | false,
    timeout = 2000,
    interval = 60,
): Promise<T | null> {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        const value = probe();
        if (value) return value as T;
        await sleep(interval);
    }
    return null;
}

export function textOf(el: Element | null | undefined): string {
    return normalizeText(el?.textContent ?? '');
}

export function isEditableContent(el: HTMLElement): boolean {
    return el.isContentEditable || el.getAttribute('contenteditable') === 'true';
}

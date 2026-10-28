import type { DetectedControl } from '../shared/types';
import { clickSequence, isDisabled, isVisible, sleep, textOf, waitFor } from '../shared/dom';
import { pickOption, visibleOptions } from './option-picker';
import { fail, ok, skip, type DropdownIntent, type FieldOutcome } from './types';

function closeDropdown(trigger: HTMLElement): void {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

function pressKey(target: HTMLElement | null | undefined, key: string): void {
    const element = target ?? document.body;
    const keyCode =
        key === 'Enter' ? 13 : key === 'Escape' ? 27 : key === 'ArrowDown' ? 40 : key === 'ArrowUp' ? 38 : 0;

    element.dispatchEvent(
        new KeyboardEvent('keydown', {
            key,
            code: key,
            keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true,
        }),
    );
}

function isSelectTrigger(el: HTMLElement): boolean {
    return el.matches('[data-slot="select-trigger"]') || Boolean(el.closest('[data-slot="select-trigger"]'));
}

function looksUnset(text: string): boolean {
    const value = text.trim().toLowerCase();
    return (
        value.length === 0 ||
        /^(select|choose|pick|--|na$|none$|n\/a$)/.test(value) ||
        value.includes('select an option')
    );
}

/**
 * shadcn/reka Select. Pointer clicks open the listbox reliably, but selecting
 * an item does not commit with synthetic pointer events. Keyboard navigation
 * (open with Enter, move with arrows, commit with Enter) is the reliable path.
 */
async function fillRekaSelect(trigger: HTMLElement, intent: DropdownIntent): Promise<FieldOutcome> {
    const before = textOf(trigger);

    // Idempotency: a filled select shows a value, an empty one shows its
    // placeholder ("Select an option", "NA", ...). Do not reopen filled selects
    // unless the profile explicitly asks for a value.
    if (!looksUnset(before) && intent.labels.length === 0) {
        return skip('already selected');
    }

    pressKey(document.activeElement as HTMLElement | null, 'Escape');
    await sleep(100);

    trigger.focus();
    pressKey(trigger, 'Enter');

    let options = await waitFor(() => {
        const found = visibleOptions('[role="option"]');
        return found.length ? found : null;
    }, 2500);

    if (!options) {
        pressKey(trigger, 'ArrowDown');
        options = await waitFor(() => {
            const found = visibleOptions('[role="option"]');
            return found.length ? found : null;
        }, 3500);
    }

    if (!options?.length) {
        closeDropdown(document.activeElement as HTMLElement | null ?? trigger);
        return fail('no options', true);
    }

    const target = pickOption(options, intent);
    if (!target) {
        closeDropdown(document.activeElement as HTMLElement | null ?? trigger);
        return fail('no usable option', true);
    }

    if (target.getAttribute('aria-selected') === 'true' && intent.labels.length === 0) {
        closeDropdown(document.activeElement as HTMLElement | null ?? trigger);
        return ok('already selected', textOf(target));
    }

    let active = document.activeElement as HTMLElement | null;
    if (!active || active.getAttribute('role') !== 'option') {
        options[0].focus();
        active = options[0];
        await sleep(40);
    }

    const currentIndex = Math.max(0, options.indexOf(active));
    const targetIndex = Math.max(0, options.indexOf(target));
    const step = targetIndex >= currentIndex ? 'ArrowDown' : 'ArrowUp';

    for (let index = 0; index < Math.abs(targetIndex - currentIndex); index += 1) {
        pressKey(active, step);
        await sleep(40);
        active = (document.activeElement as HTMLElement | null) ?? active;
    }

    pressKey(active, 'Enter');
    await sleep(300);

    const after = textOf(trigger);
    if (after !== before && after.length > 0) {
        return ok('reka-keyboard', after);
    }

    // Last resort: click the option we already located.
    const stillOpen = document.querySelectorAll('[role="option"]').length > 0;
    if (stillOpen) {
        clickSequence(target);
        await sleep(250);
        const clicked = textOf(trigger);
        if (clicked !== before && clicked.length > 0) return ok('reka-click', clicked);
    }

    return fail('selection did not apply', true);
}

async function fillRekaPopover(trigger: HTMLElement, intent: DropdownIntent): Promise<FieldOutcome> {
    if (trigger.getAttribute('aria-expanded') === 'true') {
        closeDropdown(trigger);
        await sleep(80);
    }

    const container =
        trigger.closest<HTMLElement>('[data-slot="combobox"], [data-slot="select"]') ?? trigger;
    const input = container.querySelector<HTMLInputElement>('input');
    const before = textOf(container);
    const beforeValue = input?.value ?? '';

    clickSequence(trigger);

    const listbox = await waitFor(
        () =>
            visibleOptions('[role="listbox"]').pop() ??
            visibleOptions('[role="menu"]').pop() ??
            null,
        1500,
    );

    if (!listbox) return fail('dropdown did not open', true);

    const options = await waitFor(() => {
        const found = Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]')).filter(
            isVisible,
        );
        return found.length ? found : null;
    }, 4000);

    if (!options?.length) {
        closeDropdown(trigger);
        return fail('no options', true);
    }

    const target = pickOption(options, intent);
    if (!target) {
        closeDropdown(trigger);
        return fail('no usable option', true);
    }

    clickSequence(target);
    await sleep(220);

    const after = textOf(container);
    const afterValue = input?.value ?? '';
    const listClosed = visibleOptions('[role="option"]').length === 0;

    if (after === before && afterValue === beforeValue && !listClosed) {
        closeDropdown(trigger);
        return fail('selection did not apply', true);
    }

    if (!listClosed) closeDropdown(trigger);

    return ok('reka-option', textOf(target));
}

export async function fillReka(
    control: DetectedControl,
    intent: DropdownIntent,
): Promise<FieldOutcome> {
    const trigger = control.el;
    if (isDisabled(trigger)) return skip('disabled');

    return isSelectTrigger(trigger)
        ? fillRekaSelect(trigger, intent)
        : fillRekaPopover(trigger, intent);
}

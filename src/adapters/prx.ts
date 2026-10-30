import type { DetectedControl } from '../shared/types';
import {
    clickSequence,
    isDisabled,
    isVisible,
    setNativeValue,
    sleep,
    textOf,
    waitFor,
} from '../shared/dom';
import { pickOption, visibleOptions } from './option-picker';
import { fail, ok, skip, type DropdownIntent, type FieldOutcome } from './types';

const PRX_OPTION = '[data-testid*="-option-"]';

/**
 * PrxSelect renders a reka Combobox inside a Popover. The popover trigger is
 * the combobox button, so options commit on click instead of the keyboard path
 * used by a standalone reka Select.
 */
export async function fillPrxSelect(
    control: DetectedControl,
    intent: DropdownIntent,
): Promise<FieldOutcome> {
    const trigger = control.el;
    if (isDisabled(trigger)) return skip('disabled');

    const before = textOf(trigger);
    clickSequence(trigger);

    const options = await waitFor(() => {
        const found = visibleOptions('[role="option"]');
        return found.length ? found : null;
    }, 2500);

    if (!options?.length) {
        await closePrxPopover(trigger);
        return fail('no options', true);
    }

    const target = pickOption(options, intent);
    if (!target) {
        await closePrxPopover(trigger);
        return fail('no usable option', true);
    }

    clickSequence(target);
    await sleep(220);
    await closePrxPopover(trigger);

    const after = textOf(trigger);
    if (after === before || after.length === 0) {
        return fail('selection did not apply', true);
    }

    return ok('prx-select', after);
}

/**
 * PrxSearchableSelect is a plain div and input rather than a reka primitive.
 * Options are buttons that appear in a sibling popup, and remote options are
 * fetched after a debounce, so the waits are longer than the native path.
 */
export async function fillPrxSearchableSelect(
    control: DetectedControl,
    intent: DropdownIntent,
): Promise<FieldOutcome> {
    const root = control.el;
    const input = root.querySelector<HTMLInputElement>('input');
    if (isDisabled(root) || (input && isDisabled(input))) return skip('disabled');
    if (!input) return fail('no search input');

    const container = root.parentElement ?? root;
    const before = textOf(root);

    clickSequence(root);
    input.focus();

    if (intent.labels.length) {
        setNativeValue(input, intent.labels[0]);
        await sleep(450);
    }

    const options = await waitFor(() => {
        const found = Array.from(container.querySelectorAll<HTMLElement>(PRX_OPTION)).filter(isVisible);
        return found.length ? found : null;
    }, 3500);

    if (!options?.length) {
        await closePrxPopover(input);
        return fail('no options', true);
    }

    const target = pickOption(options, intent);
    if (!target) {
        await closePrxPopover(input);
        return fail('no usable option', true);
    }

    const chosen = textOf(target);
    clickSequence(target);
    await sleep(180);
    await closePrxPopover(input);

    const after = textOf(root);
    if (after === before || !after) {
        return fail('selection did not apply', true);
    }

    return ok('prx-searchable-select', chosen);
}

/**
 * Both vue-kit widgets leave their popup open unless the component decides to
 * close it. Close only when options are still visible so no stray Escape
 * reaches a surrounding dialog.
 */
async function closePrxPopover(target: HTMLElement): Promise<void> {
    const optionsVisible =
        visibleOptions('[role="option"]').length > 0 ||
        visibleOptions(PRX_OPTION).length > 0;
    if (!optionsVisible) return;

    const source = document.activeElement instanceof HTMLElement ? document.activeElement : target;
    source.dispatchEvent(
        new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true,
            cancelable: true,
        }),
    );
    await sleep(80);
}

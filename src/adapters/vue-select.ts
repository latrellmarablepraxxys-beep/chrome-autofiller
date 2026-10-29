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
import { pickOption } from './option-picker';
import { fail, ok, skipRetry, type DropdownIntent, type FieldOutcome } from './types';

function isVueSelectDisabled(root: HTMLElement): boolean {
    const wrapper = root.closest<HTMLElement>('.v-select');
    if (wrapper?.classList.contains('vs--disabled')) return true;

    return Boolean(root.querySelector<HTMLInputElement>('.vs__search')?.disabled);
}

export async function fillVueSelect(
    control: DetectedControl,
    intent: DropdownIntent,
): Promise<FieldOutcome> {
    const root = control.el;
    if (isDisabled(root) || isVueSelectDisabled(root)) return skipRetry('disabled');

    const wrapper = root.closest<HTMLElement>('.v-select') ?? root.parentElement ?? root;

    clickSequence(root);

    const menu = await waitFor(
        () => wrapper.querySelector<HTMLElement>('.vs__dropdown-menu'),
        1500,
    );
    if (!menu) return fail('dropdown did not open', true);

    const search = root.querySelector<HTMLInputElement>('.vs__search');
    if (search && intent.labels.length) {
        search.focus();
        setNativeValue(search, intent.labels[0]);
        await sleep(750);
    }

    const options = await waitFor(() => {
        const found = Array.from(
            wrapper.querySelectorAll<HTMLElement>('.vs__dropdown-option'),
        ).filter(isVisible);
        return found.length ? found : null;
    }, 3000);

    if (!options?.length) return fail('no options', true);

    const chosen: HTMLElement[] = [];
    const selected = new Set<HTMLElement>();
    const count = Math.max(1, Math.min(intent.count, options.length));

    for (let index = 0; index < count; index += 1) {
        const option = pickOption(options, intent, selected);
        if (!option) break;
        selected.add(option);
        chosen.push(option);
        clickSequence(option);
        await sleep(90);
    }

    if (!chosen.length) return fail('no usable option', true);

    if (chosen.length) {
        // vue-select normally closes on select; close it explicitly if it is
        // still open so the next adapter cannot pick its options.
        await sleep(120);
        const openMenu = wrapper.querySelector<HTMLElement>('.vs__dropdown-menu');
        if (openMenu && isVisible(openMenu)) {
            (search ?? root).dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
            );
            await sleep(120);
            if (isVisible(openMenu)) {
                (search ?? root).dispatchEvent(
                    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
                );
            }
        }
    }

    return ok('vue-select', chosen.map((option) => textOf(option)).join(', '));
}

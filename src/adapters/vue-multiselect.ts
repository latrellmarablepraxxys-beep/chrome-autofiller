import type { DetectedControl } from '../shared/types';
import { clickSequence, isDisabled, isVisible, sleep, textOf, waitFor } from '../shared/dom';
import { pickOption } from './option-picker';
import { fail, ok, skip, type DropdownIntent, type FieldOutcome } from './types';

export async function fillVueMultiselect(
    control: DetectedControl,
    intent: DropdownIntent,
): Promise<FieldOutcome> {
    const root = control.el;
    if (isDisabled(root)) return skip('disabled');

    const trigger = root.querySelector<HTMLElement>('.multiselect__tags') ?? root;
    clickSequence(trigger);

    const menu = await waitFor(
        () => root.querySelector<HTMLElement>('.multiselect__content-wrapper'),
        1200,
    );
    if (!menu) return fail('dropdown did not open', true);

    const options = await waitFor(() => {
        const found = Array.from(root.querySelectorAll<HTMLElement>('.multiselect__option')).filter(
            isVisible,
        );
        return found.length ? found : null;
    }, 2000);

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
        const menu = root.querySelector<HTMLElement>('.multiselect__content-wrapper');
        if (menu && isVisible(menu)) {
            trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }
        await sleep(60);
    }

    return ok('vue-multiselect', chosen.map((option) => textOf(option)).join(', '));
}

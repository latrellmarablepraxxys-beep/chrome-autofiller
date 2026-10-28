import { Rng } from '../shared/random';
import { isVisible, textOf } from '../shared/dom';
import type { DropdownIntent } from './types';

export function pickOption(
    options: HTMLElement[],
    intent: DropdownIntent,
    exclude: Set<HTMLElement> = new Set(),
): HTMLElement | null {
    const usable = options.filter((option) => {
        if (exclude.has(option)) return false;
        if (option.getAttribute('aria-disabled') === 'true') return false;
        if (option.hasAttribute('disabled')) return false;
        if (option.classList.contains('multiselect__option--disabled')) return false;
        if (option.classList.contains('multiselect__option--selected')) return false;
        const text = textOf(option).toLowerCase();
        return text.length > 0 && text !== 'no option found.' && text !== 'no results found.';
    });

    if (!usable.length) return null;

    for (const label of intent.labels) {
        const needle = label.toLowerCase();
        const exact = usable.find((option) => textOf(option).toLowerCase() === needle);
        if (exact) return exact;
        const partial = usable.find((option) => textOf(option).toLowerCase().includes(needle));
        if (partial) return partial;
    }

    if (intent.policy === 'random') {
        const rng = new Rng(intent.seed);
        return usable[rng.int(0, usable.length - 1)];
    }

    return usable[0];
}

export function visibleOptions(selector: string, root: ParentNode = document): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(isVisible);
}

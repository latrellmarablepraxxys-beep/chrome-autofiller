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
        if (!text) return false;
        if (text === 'no option found.' || text === 'no results found.') return false;
        // Placeholder rows ("Select an option") are not choices.
        if (/^(select|choose|pick) an? (option|item|value)$/.test(text)) return false;
        return true;
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
        // "Random" should visibly change a field that already holds a value, so
        // prefer options that are not selected yet — unless nothing else exists.
        const unselected = usable.filter((option) => !isSelected(option));
        const pool = unselected.length ? unselected : usable;
        return pool[rng.int(0, pool.length - 1)];
    }

    return usable[0];
}

function isSelected(option: HTMLElement): boolean {
    return (
        option.getAttribute('aria-selected') === 'true' ||
        option.getAttribute('data-state') === 'checked' ||
        option.classList.contains('multiselect__option--selected')
    );
}

export function visibleOptions(selector: string, root: ParentNode = document): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(isVisible);
}

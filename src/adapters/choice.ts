import type { DetectedControl } from '../shared/types';
import { clickSequence, isDisabled, normalizeText, setSelectValue, sleep, waitFor } from '../shared/dom';
import type { Rng } from '../shared/random';
import { NEGATIVE_TOGGLE, POSITIVE_TOGGLE, normalizeForMatch } from '../core/lexicon';
import { fail, ok, skip, type FieldOutcome } from './types';

const radioGroups = new WeakMap<Element, string>();
let groupCounter = 0;

function groupKey(container: Element): string {
    let key = radioGroups.get(container);
    if (!key) {
        groupCounter += 1;
        key = `radio-group-${groupCounter}`;
        radioGroups.set(container, key);
    }
    return key;
}

function isChecked(el: HTMLElement): boolean {
    if (el instanceof HTMLInputElement) return el.checked;
    return (
        el.getAttribute('aria-checked') === 'true' ||
        el.getAttribute('data-state') === 'checked'
    );
}

function optionLabelFor(el: HTMLElement, group: HTMLElement): string {    if (el.id) {
        const label = document.querySelector(`label[for="${el.id.replace(/"/g, '\\"')}"]`);
        if (label?.textContent) return normalizeText(label.textContent);
    }

    let node: HTMLElement | null = el.parentElement;
    while (node && node !== group) {
        const text = normalizeText(node.textContent);
        if (text && text.length <= 80) return text;
        node = node.parentElement;
    }

    return '';
}

export function fillNativeSelect(control: DetectedControl, labels: string[]): FieldOutcome {
    const el = control.el as HTMLSelectElement;
    if (isDisabled(el)) return skip('disabled');

    const options = Array.from(el.options).filter(
        (option) => !option.disabled && option.value !== '' && option.textContent?.trim(),
    );

    if (!options.length) return fail('no select options', true);

    const normalized = labels.map((label) => label.toLowerCase());
    const match =
        options.find((option) => normalized.includes(option.textContent!.trim().toLowerCase())) ??
        options.find((option) =>
            normalized.some((label) => option.textContent!.toLowerCase().includes(label)),
        ) ??
        options[0];

    setSelectValue(el, match.value);
    if (el.value !== match.value) return fail('select value did not apply');

    return ok(`native-select:${match.textContent?.trim()}`, match.textContent?.trim());
}

export async function fillToggle(
    control: DetectedControl,
    desired: boolean,
): Promise<FieldOutcome> {
    const el = control.el;
    if (isDisabled(el)) return skip('disabled');

    const label = normalizeForMatch(control.label);
    if (NEGATIVE_TOGGLE.test(label)) return skip('negative toggle left off');
    if (!POSITIVE_TOGGLE.test(label)) return skip('ambiguous toggle');
    if (!desired) return skip('left off');

    const checked = isChecked(el);
    if (checked !== desired) {
        if (el instanceof HTMLInputElement) el.click();
        else clickSequence(el);
    }

    const applied = await waitFor(() => (isChecked(el) === desired ? true : null), 400);

    return applied ? ok('switch', String(desired)) : fail('switch did not change');
}

export async function fillRadio(
    control: DetectedControl,
    groups: Set<string>,
): Promise<FieldOutcome> {
    const el = control.el;
    if (isDisabled(el)) return skip('disabled');

    const native = el instanceof HTMLInputElement;
    const container = el.closest('[role="radiogroup"]');
    const key = (native ? el.name : '') || (container ? groupKey(container) : control.key);

    if (groups.has(key)) return skip('radio group already filled');
    groups.add(key);

    if (!isChecked(el)) {
        if (native) el.click();
        else clickSequence(el);
    }

    // Reka updates aria-checked on the next tick, so poll instead of reading
    // immediately after the click.
    const applied = await waitFor(() => (isChecked(el) ? true : null), 400);

    return applied
        ? ok(native ? 'radio' : 'reka-radio', control.optionLabel ?? control.label)
        : fail('radio did not select');
}

function shuffle<T>(items: T[], rng: Rng): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = rng.int(0, index);
        [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
}

function isToggleOn(el: HTMLElement): boolean {
    return (
        el.getAttribute('aria-pressed') === 'true' ||
        el.getAttribute('data-state') === 'on' ||
        el.getAttribute('data-state') === 'checked'
    );
}

export async function fillToggleGroup(
    control: DetectedControl,
    rng: Rng,
): Promise<FieldOutcome> {
    const group =
        control.groupEl ??
        control.el.closest<HTMLElement>('[data-slot="toggle-group"], [role="group"]');
    if (!group) return fail('no toggle group');

    const items = Array.from(
        group.querySelectorAll<HTMLElement>('button[aria-pressed], button[data-state]'),
    ).filter((item) => !isDisabled(item));

    if (!items.length) return fail('no toggle options', true);
    if (items.some(isToggleOn)) return skip('already selected');

    const multiple =
        group.getAttribute('aria-multiselectable') === 'true' ||
        group.getAttribute('data-type') === 'multiple';
    const count = multiple ? Math.min(2, items.length) : 1;
    const picks = shuffle(items, rng).slice(0, count);

    for (const item of picks) {
        clickSequence(item);
        await sleep(80);
    }

    const labels = items
        .filter(isToggleOn)
        .map((item) => normalizeText(item.textContent))
        .filter(Boolean);

    return labels.length
        ? ok('toggle-group', labels.join(', '))
        : fail('toggle did not change');
}

export function fillButtonChoice(control: DetectedControl, rng: Rng): FieldOutcome {    const group = control.groupEl;
    if (!group) return fail('no button group');

    const buttons = Array.from(
        group.querySelectorAll<HTMLButtonElement>(':scope > button'),
    ).filter((button) => !isDisabled(button));

    if (!buttons.length) return fail('no button options', true);

    // The selected BaseButton renders its check icon; don't flip an existing choice.
    if (buttons.some((button) => button.querySelector('svg'))) {
        return skip('already selected');
    }

    const target = buttons[rng.int(0, buttons.length - 1)];
    clickSequence(target);

    return ok('button-choice', normalizeText(target.textContent));
}

export async function fillCheckbox(
    control: DetectedControl,
    groups: Set<string>,
    rng: Rng,
    allowOptional = false,
): Promise<FieldOutcome> {    const el = control.el;
    if (isDisabled(el)) return skip('disabled');

    // Multi-select groups pick 1-2 random options. Required groups always get
    // a selection; optional groups do too when Scope is "All fields".
    if (control.groupEl && (control.groupRequired || allowOptional)) {
        const group = control.groupEl;
        const key = groupKey(group);
        if (groups.has(key)) return skip('checkbox group already filled');
        groups.add(key);

        const boxes = Array.from(
            group.querySelectorAll<HTMLElement>('[role="checkbox"], input[type="checkbox"]'),
        ).filter((box) => !isDisabled(box));

        if (boxes.some(isChecked)) {
            const labels = boxes
                .filter(isChecked)
                .map((box) => optionLabelFor(box, group))
                .filter(Boolean);
            return { status: 'skipped', reason: 'already selected', preview: labels.join(', ') };
        }

        const unchecked = boxes.filter((box) => !isChecked(box));
        const nonNone = unchecked.filter(
            (box) =>
                !/^(none|no disability|not applicable|n\/a|none of the above)/i.test(
                    optionLabelFor(box, group),
                ),
        );
        const pool = nonNone.length ? nonNone : unchecked;

        if (!pool.length) return fail('no checkbox options');

        const shuffled = shuffle(pool, rng);
        const count = Math.min(rng.int(1, 2), shuffled.length);
        const picks = shuffled.slice(0, count);

        for (const box of picks) {
            if (box instanceof HTMLInputElement) box.click();
            else clickSequence(box);
            await sleep(90);
        }

        const applied = await waitFor(() => (boxes.some(isChecked) ? true : null), 600);
        const labels = boxes
            .filter(isChecked)
            .map((box) => optionLabelFor(box, group))
            .filter(Boolean);

        return applied
            ? ok('checkbox-group', labels.join(', '))
            : fail('checkbox did not change');
    }

    const label = normalizeForMatch(control.label);
    if (NEGATIVE_TOGGLE.test(label)) return skip('negative checkbox left off');
    if (!POSITIVE_TOGGLE.test(label) && !control.required && !allowOptional) {
        return skip('ambiguous checkbox');
    }

    if (!isChecked(el)) {
        if (el instanceof HTMLInputElement) el.click();
        else clickSequence(el);
    }

    const applied = await waitFor(() => (isChecked(el) ? true : null), 400);

    return applied
        ? ok(el instanceof HTMLInputElement ? 'checkbox' : 'reka-checkbox', 'true')
        : fail('checkbox did not change');
}

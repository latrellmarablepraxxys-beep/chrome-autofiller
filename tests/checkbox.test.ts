import { beforeEach, describe, expect, it } from 'vitest';
import type { DetectedControl } from '../src/shared/types';
import { Rng } from '../src/shared/random';
import { fillCheckbox } from '../src/adapters/choice';

const LABELS = [
    'Blindness',
    'Hearing Disability',
    'Low Vision',
    'Physical Disability',
    'Speech & Language Disability',
    'Intellectual Disability',
    'Learning Disability',
    'Psychosocial Disability',
];

function control(el: HTMLElement, group: HTMLElement, index: number): DetectedControl {
    return {
        el,
        kind: 'checkbox',
        label: `disabilities: ${LABELS[index]}`,
        name: '',
        id: '',
        placeholder: '',
        required: true,
        key: `disabilities-${index}`,
        accept: '',
        multiple: false,
        numeric: false,
        optionLabel: LABELS[index],
        groupEl: group,
        groupLabel: 'disabilities *',
        groupRequired: true,
        index,
    };
}

describe('checkbox groups', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="flex flex-col gap-3">
                <label>disabilities *</label>
                ${LABELS.map(
                    (label, index) => `
                    <div class="row">
                        <span>${label}</span>
                        <button type="button" role="checkbox" id="cb${index}" aria-checked="false"></button>
                        <label for="cb${index}">${label}</label>
                    </div>`,
                ).join('')}
            </div>
        `;

        document.querySelectorAll<HTMLElement>('[role="checkbox"]').forEach((box) => {
            box.addEventListener('click', () => {
                const checked = box.getAttribute('aria-checked') === 'true';
                box.setAttribute('aria-checked', String(!checked));
            });
        });
    });

    it('checks a random 1-2 options and reports them', async () => {
        const group = document.querySelector<HTMLElement>('.flex.flex-col')!;
        const boxes = Array.from(document.querySelectorAll<HTMLElement>('[role="checkbox"]'));
        const outcome = await fillCheckbox(control(boxes[0], group, 0), new Set(), new Rng(1));

        expect(outcome.status).toBe('filled');
        const checked = boxes.filter((box) => box.getAttribute('aria-checked') === 'true');
        expect(checked.length).toBeGreaterThanOrEqual(1);
        expect(checked.length).toBeLessThanOrEqual(2);
        expect(outcome.preview).toBeTruthy();
    });

    it('varies the selection across seeds', async () => {
        const group = document.querySelector<HTMLElement>('.flex.flex-col')!;
        const selections = new Set<string>();

        for (let seed = 1; seed <= 8; seed += 1) {
            const boxes = Array.from(document.querySelectorAll<HTMLElement>('[role="checkbox"]'));
            boxes.forEach((box) => box.setAttribute('aria-checked', 'false'));
            await fillCheckbox(control(boxes[0], group, 0), new Set(), new Rng(seed));
            selections.add(
                boxes
                    .filter((box) => box.getAttribute('aria-checked') === 'true')
                    .map((box) => box.id)
                    .sort()
                    .join(','),
            );
        }

        expect(selections.size).toBeGreaterThan(1);
    });

    it('does not change an already-checked group', async () => {
        const group = document.querySelector<HTMLElement>('.flex.flex-col')!;
        const boxes = Array.from(document.querySelectorAll<HTMLElement>('[role="checkbox"]'));
        boxes[2].setAttribute('aria-checked', 'true');

        const outcome = await fillCheckbox(control(boxes[0], group, 0), new Set(), new Rng(3));
        expect(outcome.status).toBe('skipped');
        expect(outcome.reason).toBe('already selected');
        expect(boxes.filter((box) => box.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    });
});

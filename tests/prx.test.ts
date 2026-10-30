import { beforeEach, describe, expect, it } from 'vitest';
import { fillPrxSearchableSelect, fillPrxSelect } from '../src/adapters/prx';
import { scanControls } from '../src/core/scanner';
import type { DetectedControl } from '../src/shared/types';
import type { DropdownIntent } from '../src/adapters/types';

function intent(partial: Partial<DropdownIntent> = {}): DropdownIntent {
    return { labels: [], policy: 'first', seed: 7, count: 1, ...partial };
}

function control(el: HTMLElement): DetectedControl {
    return {
        el,
        kind: 'prx-select',
        label: 'Region',
        name: '',
        id: '',
        placeholder: '',
        required: true,
        key: 'region',
        accept: '',
        multiple: false,
        numeric: false,
        index: 0,
    };
}

function mountPrxSelect(): { trigger: HTMLButtonElement; popup: HTMLElement } {
    document.body.innerHTML = `
        <div class="space-y-1">
            <label>Region <span class="text-destructive">*</span></label>
            <button
                type="button"
                role="combobox"
                aria-expanded="false"
                data-testid="region-selector"
            >Select region</button>
        </div>
        <div class="popup" hidden>
            <div role="option" tabindex="-1">Alpha</div>
            <div role="option" tabindex="-1">Beta</div>
            <div role="option" tabindex="-1">Gamma</div>
        </div>
    `;

    const trigger = document.querySelector<HTMLButtonElement>('[data-testid="region-selector"]')!;
    const popup = document.querySelector<HTMLElement>('.popup')!;

    trigger.addEventListener('click', () => {
        popup.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
    });

    popup.querySelectorAll<HTMLElement>('[role="option"]').forEach((option) => {
        option.addEventListener('click', () => {
            trigger.textContent = option.textContent;
            popup.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
        });
    });

    return { trigger, popup };
}

function mountPrxSearchableSelect(): { root: HTMLElement; input: HTMLInputElement; popup: HTMLElement } {
    document.body.innerHTML = `
        <div class="space-y-1">
            <label>Business Type <span class="text-destructive">*</span></label>
            <div class="relative">
                <div data-testid="business-type-selector">
                    <input type="text" placeholder="Select business type" />
                </div>
                <div data-state="open" hidden>
                    <button type="button" data-testid="business-type-option-corporation">Corporation</button>
                    <button type="button" data-testid="business-type-option-partnership">Partnership</button>
                    <button type="button" data-testid="business-type-option-sole">Sole Proprietorship</button>
                </div>
            </div>
        </div>
    `;

    const root = document.querySelector<HTMLElement>('[data-testid="business-type-selector"]')!;
    const input = root.querySelector<HTMLInputElement>('input')!;
    const popup = document.querySelector<HTMLElement>('[data-state="open"]')!;

    const open = () => {
        popup.hidden = false;
    };

    root.addEventListener('click', open);
    input.addEventListener('focus', open);

    popup.querySelectorAll<HTMLButtonElement>('button').forEach((option) => {
        option.addEventListener('click', () => {
            const selected = document.createElement('span');
            selected.textContent = option.textContent;
            root.appendChild(selected);
            popup.hidden = true;
        });
    });

    return { root, input, popup };
}

describe('praxxys vue kit detection', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('detects PrxSelect from its combobox trigger', () => {
        mountPrxSelect();

        const regions = scanControls().filter((item) => item.kind === 'prx-select');

        expect(regions).toHaveLength(1);
        expect(regions[0].flavor).toBe('prx-vue-kit');
        expect(regions[0].label).toBe('Region');
        expect(regions[0].required).toBe(true);
    });

    it('detects PrxSearchableSelect once instead of reporting its input', () => {
        mountPrxSearchableSelect();

        const controls = scanControls();
        const businessType = controls.find((item) => item.kind === 'prx-searchable-select');

        expect(businessType?.flavor).toBe('prx-vue-kit');
        expect(controls.filter((item) => item.kind === 'text')).toHaveLength(0);
    });

    it('separates shadcn wrappers from bare reka primitives', () => {
        document.body.innerHTML = `
            <button data-slot="select-trigger" role="combobox" aria-expanded="false">One</button>
            <button role="combobox" aria-expanded="false">Two</button>
        `;

        const flavors = scanControls().map((item) => item.flavor);

        expect(flavors).toEqual(['shadcn', 'reka']);
    });
});

describe('praxxys vue kit filling', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('picks a PrxSelect option and verifies the trigger text', async () => {
        const { trigger } = mountPrxSelect();

        const outcome = await fillPrxSelect(control(trigger), intent());

        expect(outcome.status).toBe('filled');
        expect(outcome.strategy).toBe('prx-select');
        expect(trigger.textContent).toBe('Alpha');
    });

    it('picks a PrxSearchableSelect option from the sibling popup', async () => {
        const { root } = mountPrxSearchableSelect();

        const outcome = await fillPrxSearchableSelect(
            { ...control(root), kind: 'prx-searchable-select', label: 'Business Type' },
            intent(),
        );

        expect(outcome.status).toBe('filled');
        expect(outcome.strategy).toBe('prx-searchable-select');
        expect(outcome.preview).toBe('Corporation');
    });

    it('uses a profile label before the first option', async () => {
        const { trigger } = mountPrxSelect();

        const outcome = await fillPrxSelect(control(trigger), intent({ labels: ['gamma'] }));

        expect(outcome.status).toBe('filled');
        expect(trigger.textContent).toBe('Gamma');
    });
});

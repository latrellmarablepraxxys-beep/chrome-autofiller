import { beforeEach, describe, expect, it } from 'vitest';
import { fillNativeSelect } from '../src/adapters/choice';
import { pickOption } from '../src/adapters/option-picker';
import type { DropdownIntent } from '../src/adapters/types';
import type { DetectedControl } from '../src/shared/types';

function intent(partial: Partial<DropdownIntent> = {}): DropdownIntent {
    return { labels: [], policy: 'first', seed: 7, count: 1, ...partial };
}

function option(text: string, attributes: Record<string, string> = {}): HTMLElement {
    const el = document.createElement('div');
    el.setAttribute('role', 'option');
    el.textContent = text;
    for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
    return el;
}

function nativeControl(select: HTMLSelectElement): DetectedControl {
    return {
        el: select,
        kind: 'native-select',
        label: 'Status',
        name: 'status',
        id: 'status',
        placeholder: '',
        required: false,
        key: 'status',
        accept: '',
        multiple: false,
        numeric: false,
        index: 0,
    };
}

describe('pickOption', () => {
    it('returns the first usable option, skipping disabled and placeholder rows', () => {
        const options = [
            option('Select an option'),
            option('No results found.'),
            option('Beverages', { 'aria-disabled': 'true' }),
            option('Bakery'),
            option('Condiments'),
        ];

        expect(pickOption(options, intent())?.textContent).toBe('Bakery');
    });

    it('returns null when every option is unusable', () => {
        const options = [option('Select an option'), option('Disabled', { disabled: '' })];

        expect(pickOption(options, intent({ policy: 'random' }))).toBeNull();
    });

    it('random is seeded: the same seed picks the same option', () => {
        const options = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((label) => option(label));
        const pick = intent({ policy: 'random', seed: 42 });

        expect(pickOption(options, pick)?.textContent).toBe(pickOption(options, pick)?.textContent);
    });

    it('random is not stuck on the first valid option', () => {
        const options = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map((label) => option(label));
        const picks = new Set<string>();

        for (let seed = 1; seed <= 20; seed += 1) {
            picks.add(pickOption(options, intent({ policy: 'random', seed }))?.textContent ?? '');
        }

        expect(picks.size).toBeGreaterThan(1);
        expect(picks.has('Alpha')).toBe(true);
    });

    it('random never lands on a disabled option', () => {
        const options = [
            option('Alpha', { 'aria-disabled': 'true' }),
            option('Beta'),
            option('Gamma', { 'aria-disabled': 'true' }),
            option('Delta'),
        ];

        for (let seed = 1; seed <= 20; seed += 1) {
            expect(['Beta', 'Delta']).toContain(
                pickOption(options, intent({ policy: 'random', seed }))?.textContent,
            );
        }
    });

    it('random prefers an option that is not already selected', () => {
        const options = [
            option('Alpha', { 'aria-selected': 'true' }),
            option('Beta'),
            option('Gamma'),
        ];

        for (let seed = 1; seed <= 20; seed += 1) {
            expect(['Beta', 'Gamma']).toContain(
                pickOption(options, intent({ policy: 'random', seed }))?.textContent,
            );
        }
    });

    it('profile labels beat the policy: exact match, then partial', () => {
        const options = [option('Beverages'), option('Bakery'), option('Condiments')];

        expect(
            pickOption(options, intent({ policy: 'random', labels: ['bakery'] }))?.textContent,
        ).toBe('Bakery');
        expect(
            pickOption(options, intent({ policy: 'random', labels: ['condi'] }))?.textContent,
        ).toBe('Condiments');
    });

    it('skips options picked earlier in the same field', () => {
        const options = [option('Coffee'), option('Dessert'), option('Seasonal')];
        const picked = options[0];

        expect(
            pickOption(options, intent({ policy: 'first' }), new Set([picked]))?.textContent,
        ).toBe('Dessert');
    });
});

describe('native selects honour the dropdown policy', () => {
    let select: HTMLSelectElement;

    beforeEach(() => {
        document.body.innerHTML = `
            <select id="status" name="status">
                <option value="">Select status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
                <option value="never" disabled>Never</option>
            </select>
        `;

        select = document.querySelector<HTMLSelectElement>('select')!;
        select.value = '';
    });

    it('first takes the first valid option and ignores the placeholder', () => {
        const outcome = fillNativeSelect(nativeControl(select), intent());

        expect(outcome.status).toBe('filled');
        expect(outcome.preview).toBe('Active');
        expect(select.value).toBe('active');
    });

    it('random changes the value instead of always taking the first option', () => {
        const chosen = new Set<string>();
        const strategies = new Set<string>();

        for (let seed = 1; seed <= 20; seed += 1) {
            select.value = '';
            const outcome = fillNativeSelect(
                nativeControl(select),
                intent({ policy: 'random', seed }),
            );

            expect(outcome.status).toBe('filled');
            expect(select.value).not.toBe('');
            expect(select.value).not.toBe('never');
            chosen.add(select.value);
            strategies.add(outcome.strategy ?? '');
        }

        expect(chosen.size).toBeGreaterThan(1);
        expect([...strategies].some((strategy) => strategy.startsWith('native-select-random'))).toBe(
            true,
        );
    });

    it('random is deterministic for a seed', () => {
        select.value = '';
        const first = fillNativeSelect(nativeControl(select), intent({ policy: 'random', seed: 9 }));
        select.value = '';
        const second = fillNativeSelect(nativeControl(select), intent({ policy: 'random', seed: 9 }));

        expect(second.preview).toBe(first.preview);
    });

    it('random avoids the value that is already selected', () => {
        for (let seed = 1; seed <= 20; seed += 1) {
            select.value = 'active';
            fillNativeSelect(nativeControl(select), intent({ policy: 'random', seed }));
            expect(['draft', 'archived']).toContain(select.value);
        }
    });

    it('a profile label wins over the policy', () => {
        const outcome = fillNativeSelect(
            nativeControl(select),
            intent({ policy: 'random', labels: ['archived'] }),
        );

        expect(outcome.preview).toBe('Archived');
        expect(select.value).toBe('archived');
    });
});

describe('native multi-selects choose a set', () => {
    function mount(): HTMLSelectElement {
        document.body.innerHTML = `
            <select id="tags" name="tags" multiple>
                <option value="coffee">Coffee</option>
                <option value="dessert">Dessert</option>
                <option value="seasonal">Seasonal</option>
                <option value="promo">Promo</option>
            </select>
        `;

        return document.querySelector<HTMLSelectElement>('select')!;
    }

    it('selects the requested number of options and replaces the old selection', () => {
        const select = mount();
        select.options[3].selected = true;

        const outcome = fillNativeSelect(
            { ...nativeControl(select), multiple: true },
            intent({ count: 2 }),
        );

        expect(outcome.status).toBe('filled');
        expect(outcome.strategy).toBe('native-select-multiple');
        expect(select.selectedOptions).toHaveLength(2);
        expect(select.options[3].selected).toBe(false);
    });

    it('honours a profile label before the policy', () => {
        const select = mount();

        fillNativeSelect(
            { ...nativeControl(select), multiple: true },
            intent({ count: 1, labels: ['seasonal'] }),
        );

        expect(select.selectedOptions[0]?.textContent).toBe('Seasonal');
    });
});

describe('vue-select and vue-multiselect policies', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="field">
                <label>Author</label>
                <div class="v-select">
                    <div class="vs__dropdown-toggle">
                        <input class="vs__search" placeholder="Search author" />
                    </div>
                    <ul class="vs__dropdown-menu" hidden style="list-style: none; padding: 0">
                        <li class="vs__dropdown-option">Maria Santos</li>
                        <li class="vs__dropdown-option">Jose Reyes</li>
                        <li class="vs__dropdown-option">Ana Dela Cruz</li>
                    </ul>
                </div>
            </div>
            <div class="field">
                <label>Tags</label>
                <div class="multiselect">
                    <div class="multiselect__tags">
                        <span class="tags"></span>
                        <input class="multiselect__input" placeholder="Select tags" />
                    </div>
                    <div class="multiselect__content-wrapper" hidden>
                        <ul class="multiselect__content" style="list-style: none; margin: 0; padding: 0">
                            <li class="multiselect__option">Coffee</li>
                            <li class="multiselect__option">Dessert</li>
                            <li class="multiselect__option">Seasonal</li>
                            <li class="multiselect__option">Promo</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;

        const vSelect = document.querySelector<HTMLElement>('.v-select')!;
        const vToggle = vSelect.querySelector<HTMLElement>('.vs__dropdown-toggle')!;
        const vMenu = vSelect.querySelector<HTMLElement>('.vs__dropdown-menu')!;
        const vSearch = vSelect.querySelector<HTMLInputElement>('.vs__search')!;

        vToggle.addEventListener('click', () => {
            vMenu.hidden = false;
            vSearch.focus();
        });

        vSelect.querySelectorAll<HTMLElement>('.vs__dropdown-option').forEach((item) => {
            item.addEventListener('click', () => {
                vSearch.value = item.textContent ?? '';
                vMenu.hidden = true;
            });
        });

        const multi = document.querySelector<HTMLElement>('.multiselect')!;
        const multiMenu = multi.querySelector<HTMLElement>('.multiselect__content-wrapper')!;
        const multiTags = multi.querySelector<HTMLElement>('.tags')!;
        const multiTagsBar = multi.querySelector<HTMLElement>('.multiselect__tags')!;

        multiTagsBar.addEventListener('click', () => {
            multiMenu.hidden = false;
        });
        multiTagsBar.addEventListener('keydown', (event) => {
            if ((event as KeyboardEvent).key === 'Escape') multiMenu.hidden = true;
        });

        multi.querySelectorAll<HTMLElement>('.multiselect__option').forEach((item) => {
            item.addEventListener('click', () => {
                if (item.classList.contains('multiselect__option--selected')) return;
                item.classList.add('multiselect__option--selected');
                const tag = document.createElement('span');
                tag.className = 'tag';
                tag.textContent = item.textContent;
                multiTags.appendChild(tag);
            });
        });
    });

    function vueSelectControl(): DetectedControl {
        return {
            el: document.querySelector<HTMLElement>('.vs__dropdown-toggle')!,
            kind: 'vue-select',
            label: 'Author',
            name: '',
            id: '',
            placeholder: '',
            required: false,
            key: 'author',
            accept: '',
            multiple: false,
            numeric: false,
            index: 0,
        };
    }

    function multiselectControl(): DetectedControl {
        return {
            el: document.querySelector<HTMLElement>('.multiselect')!,
            kind: 'vue-multiselect',
            label: 'Tags',
            name: '',
            id: '',
            placeholder: '',
            required: false,
            key: 'tags',
            accept: '',
            multiple: true,
            numeric: false,
            index: 1,
        };
    }

    it('vue-select picks beyond the first option under random and closes its menu', async () => {
        const { fillVueSelect } = await import('../src/adapters/vue-select');
        const picks = new Set<string>();

        for (let seed = 1; seed <= 8; seed += 1) {
            document.querySelector<HTMLElement>('.vs__dropdown-menu')!.hidden = true;
            const outcome = await fillVueSelect(
                vueSelectControl(),
                intent({ policy: 'random', seed }),
            );

            expect(outcome.status).toBe('filled');
            expect(document.querySelector<HTMLElement>('.vs__dropdown-menu')!.hidden).toBe(true);
            picks.add(outcome.preview ?? '');
        }

        expect(picks.size).toBeGreaterThan(1);
    });

    it('vue-select honours a profile label', async () => {
        const { fillVueSelect } = await import('../src/adapters/vue-select');
        const outcome = await fillVueSelect(
            vueSelectControl(),
            intent({ policy: 'random', labels: ['jose reyes'] }),
        );

        expect(outcome.preview).toBe('Jose Reyes');
    });

    it('vue-multiselect picks two distinct random options', async () => {
        const { fillVueMultiselect } = await import('../src/adapters/vue-multiselect');
        const outcome = await fillVueMultiselect(
            multiselectControl(),
            intent({ policy: 'random', seed: 3, count: 2 }),
        );

        expect(outcome.status).toBe('filled');
        const picked = (outcome.preview ?? '').split(', ').filter(Boolean);
        expect(picked).toHaveLength(2);
        expect(new Set(picked).size).toBe(2);
    });
});

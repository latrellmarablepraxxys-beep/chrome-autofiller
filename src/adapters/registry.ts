import type { ControlKind, WidgetFlavor } from '../shared/types';
import { isDatePickerInput } from '../shared/picker';

export interface WidgetDefinition {
    id: string;
    flavor: WidgetFlavor;
    kind: ControlKind;
    /** Selector that adds this widget's nodes to the scan. */
    probe: string;
    /** Returns true when the scanned node is this widget's root. */
    match: (el: HTMLElement) => boolean;
}

/**
 * Composite widgets own their inner inputs. The scanner skips candidates that
 * live below one of these roots so an input is not reported twice.
 */
export const WIDGET_OWNERS = [
    '.vs__dropdown-toggle',
    '.multiselect',
    '[data-testid$="-selector"]',
] as const;

function hasTestIdSuffix(el: HTMLElement, suffix: string): boolean {
    return (el.getAttribute('data-testid') ?? '').endsWith(suffix);
}

/**
 * A toggle group is one user-facing field. Only the first toggle reports the
 * group; the guards keep unrelated button rows from being claimed.
 */
function isFirstToggleInGroup(el: HTMLElement, groupSelector: string): boolean {
    const group = el.closest<HTMLElement>(groupSelector);
    if (!group || !el.closest('form')) return false;

    return group.querySelector('button[aria-pressed], button[data-state]') === el;
}

/**
 * Resolution order matters: kit-specific and wrapper markers must win over the
 * generic reka roles, otherwise the wrong open/commit strategy is used.
 */
export const WIDGETS: WidgetDefinition[] = [
    {
        id: 'prx-searchable-select',
        flavor: 'prx-vue-kit',
        kind: 'prx-searchable-select',
        probe: '[data-testid$="-selector"]',
        match: (el) =>
            el.tagName === 'DIV' && hasTestIdSuffix(el, '-selector') && el.querySelector('input') !== null,
    },
    {
        id: 'prx-select',
        flavor: 'prx-vue-kit',
        kind: 'prx-select',
        probe: '[data-testid$="-selector"]',
        match: (el) =>
            el.tagName === 'BUTTON' &&
            el.getAttribute('role') === 'combobox' &&
            hasTestIdSuffix(el, '-selector'),
    },
    {
        id: 'vue-select',
        flavor: 'vue-select',
        kind: 'vue-select',
        probe: '.vs__dropdown-toggle',
        match: (el) => el.matches('.vs__dropdown-toggle'),
    },
    {
        id: 'vue-multiselect',
        flavor: 'vue-multiselect',
        kind: 'vue-multiselect',
        probe: '.multiselect',
        match: (el) => el.matches('.multiselect'),
    },
    {
        id: 'vue-datepicker',
        flavor: 'vue-datepicker',
        kind: 'date',
        probe: [
            '[data-test-id="dp-input"]',
            'input.dp__input',
            'input.dp--input',
            '.dp__input_wrap > input',
            '.dp--input-wrap > input',
        ].join(','),
        match: (el) => isDatePickerInput(el),
    },
    {
        id: 'shadcn-select',
        flavor: 'shadcn',
        kind: 'reka-combobox',
        probe: '[data-slot="select-trigger"]',
        match: (el) => el.matches('[data-slot="select-trigger"]'),
    },
    {
        id: 'shadcn-combobox-trigger',
        flavor: 'shadcn',
        kind: 'reka-combobox',
        probe: '[data-slot="combobox-trigger"]',
        match: (el) => el.matches('[data-slot="combobox-trigger"]'),
    },
    {
        id: 'shadcn-combobox-input',
        flavor: 'shadcn',
        kind: 'reka-combobox',
        probe: '[data-slot="combobox"] input[role="combobox"]',
        match: (el) => el.matches('input[role="combobox"]'),
    },
    {
        id: 'shadcn-toggle-group',
        flavor: 'shadcn',
        kind: 'toggle-group',
        probe: '[data-slot="toggle-group"] button',
        match: (el) => isFirstToggleInGroup(el, '[data-slot="toggle-group"]'),
    },
    {
        id: 'shadcn-checkbox',
        flavor: 'shadcn',
        kind: 'checkbox',
        probe: '[data-slot="checkbox"]',
        match: (el) => el.matches('[data-slot="checkbox"]'),
    },
    {
        id: 'shadcn-switch',
        flavor: 'shadcn',
        kind: 'switch',
        probe: '[data-slot="switch"]',
        match: (el) => el.matches('[data-slot="switch"]'),
    },
    {
        id: 'shadcn-radio',
        flavor: 'shadcn',
        kind: 'radio',
        probe: '[data-slot="radio-group-item"]',
        match: (el) => el.matches('[data-slot="radio-group-item"]'),
    },
    {
        id: 'reka-combobox',
        flavor: 'reka',
        kind: 'reka-combobox',
        probe: 'button[role="combobox"], input[role="combobox"][aria-expanded]',
        match: (el) =>
            el.matches('button[role="combobox"]') ||
            (el.matches('input[role="combobox"]') && el.hasAttribute('aria-expanded')),
    },
    {
        id: 'reka-switch',
        flavor: 'reka',
        kind: 'switch',
        probe: '[role="switch"]',
        match: (el) => el.matches('[role="switch"]'),
    },
    {
        id: 'reka-radio',
        flavor: 'reka',
        kind: 'radio',
        probe: '[role="radio"]',
        match: (el) => el.matches('[role="radio"]'),
    },
    {
        id: 'reka-checkbox',
        flavor: 'reka',
        kind: 'checkbox',
        probe: '[role="checkbox"]',
        match: (el) => el.matches('[role="checkbox"]'),
    },
    {
        id: 'reka-toggle-group',
        flavor: 'reka',
        kind: 'toggle-group',
        probe: '[role="group"] button[aria-pressed]',
        match: (el) => isFirstToggleInGroup(el, '[role="group"]'),
    },
];

/**
 * Selectors used for dropdown retry and option counting.
 */
export const DROPDOWN_KINDS: ControlKind[] = [
    'native-select',
    'reka-combobox',
    'prx-select',
    'prx-searchable-select',
    'vue-multiselect',
    'vue-select',
];

/**
 * Returns the widget whose root is `el`, or null for native controls.
 */
export function widgetFor(el: HTMLElement): WidgetDefinition | null {
    return WIDGETS.find((widget) => widget.match(el)) ?? null;
}

/**
 * True when `el` sits inside a composite widget instead of being its root.
 */
export function isOwnedByWidget(el: HTMLElement): boolean {
    return WIDGET_OWNERS.some((selector) => {
        const root = el.closest<HTMLElement>(selector);
        return root !== null && root !== el;
    });
}

/**
 * Selector list used by the scanner. Native tags are appended by the scanner.
 */
export function widgetProbes(): string[] {
    return [...new Set(WIDGETS.map((widget) => widget.probe))];
}

/**
 * Human-readable family for the inspect overlay and report rows.
 */
export function flavorFor(el: HTMLElement, kind: ControlKind): WidgetFlavor {
    const widget = widgetFor(el);
    if (widget) return widget.flavor;

    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        return 'native';
    }

    if (kind === 'reka-combobox' || kind === 'toggle-group' || kind === 'switch' || kind === 'radio' || kind === 'checkbox') {
        return el.closest('[data-slot]') ? 'shadcn' : 'reka';
    }

    return 'native';
}

import type { ControlKind, DetectedControl } from '../shared/types';
import { cleanLabel, fieldKey, isDisabled, isVisible, normalizeText, readLabel } from '../shared/dom';
import { insideDatePickerMenu, isDatePickerInput } from '../shared/picker';

const CANDIDATE_SELECTOR = [
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[role="combobox"]',
    '[role="switch"]',
    '[role="radio"]',
    '[role="checkbox"]',
    '[data-slot="combobox-trigger"]',
    'button[aria-haspopup="listbox"]',
    '[data-slot="toggle-group"] button',
    '[role="group"] button[aria-pressed]',
    '.multiselect',
    '.vs__dropdown-toggle',
].join(',');

const SKIP_ANCESTORS = [
    '.ck-toolbar',
    '.tiptap-toolbar',
    '.dp__menu',
    '.dp__calendar',
    '[role="listbox"]',
    '[role="menu"]',
    '[data-prx-skip]',
].join(',');

function insideSkipped(el: Element): boolean {
    if (insideDatePickerMenu(el)) return true;
    return Boolean(el.closest(SKIP_ANCESTORS));
}

function kindFor(el: HTMLElement): ControlKind | null {
    // vue-datepicker renders a plain text input whose only hints are its
    // classes/`data-test-id`; v14 also gives it role="combobox", which would
    // otherwise be claimed by the Reka combobox branch below.
    if (isDatePickerInput(el)) return 'date';

    if (el.matches('.multiselect')) return 'vue-multiselect';
    if (el.matches('.vs__dropdown-toggle')) return 'vue-select';

    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
        if (el.closest('.ck-editor')) return 'ckeditor';
        if (
            el.classList.contains('tiptap') ||
            el.classList.contains('ProseMirror') ||
            el.closest('.tiptap-editor')
        ) {
            return 'tiptap';
        }
        return null;
    }

    if (el.matches('[role="switch"]')) return 'switch';
    if (el.matches('[role="radio"]')) return 'radio';
    if (el.matches('[role="checkbox"]')) return 'checkbox';
    if (el.matches('[data-slot="combobox-trigger"], button[aria-haspopup="listbox"]')) {
        return 'reka-combobox';
    }
    if (el.matches('[data-slot="toggle-group"] button, [role="group"] button[aria-pressed]')) {
        const group = el.closest('[data-slot="toggle-group"], [role="group"]');
        if (
            !group ||
            group.querySelector('button[aria-pressed], button[data-state]') !== el
        ) {
            return null;
        }
        if (!el.closest('form')) return null;
        return 'toggle-group';
    }
    if (el.matches('[role="combobox"]')) {
        // Only dropdown triggers. Reka's CommandInput is also role=combobox.
        if (el.tagName === 'BUTTON' || el.hasAttribute('aria-haspopup')) {
            return 'reka-combobox';
        }

        // Input-only reka Combobox (no separate trigger).
        if (el instanceof HTMLInputElement && el.hasAttribute('aria-expanded')) {
            const wrapper = el.closest('[data-slot="combobox"]');
            if (wrapper && !wrapper.querySelector('[data-slot="combobox-trigger"]')) {
                return 'reka-combobox';
            }
        }

        return null;
    }

    if (el instanceof HTMLSelectElement) return 'native-select';

    if (el instanceof HTMLTextAreaElement) return 'textarea';

    if (el instanceof HTMLInputElement) {
        switch (el.type) {
            case 'file':
                return 'file';
            case 'checkbox':
                return 'checkbox';
            case 'radio':
                return 'radio';
            case 'hidden':
            case 'submit':
            case 'button':
            case 'reset':
            case 'image':
            case 'search':
                return null;
            case 'email':
                return 'email';
            case 'tel':
                return 'tel';
            case 'url':
                return 'url';
            case 'number':
                return 'number';
            case 'date':
                return 'date';
            case 'time':
                return 'time';
            case 'password':
                return 'password';
            default: {
                const inputmode = (el.getAttribute('inputmode') ?? '').toLowerCase();
                if (inputmode === 'numeric' || inputmode === 'decimal') return 'number';

                const pattern = el.getAttribute('pattern') ?? '';
                if (pattern.includes('0-9') || pattern.includes('\\d')) return 'number';

                return 'text';
            }
        }
    }

    return null;
}

function isInsideOtherControl(el: HTMLElement): boolean {    if (el.matches('.vs__dropdown-toggle')) return false;
    if (el.matches('.multiselect')) return false;

    const owner = el.closest('.vs__dropdown-toggle, .multiselect, .ck-toolbar, .tiptap-toolbar, .dp__menu');
    if (!owner) return false;

    return owner !== el;
}

function radioGroupLabel(el: HTMLElement): string {
    if (!el.matches('[role="radio"]')) return '';

    const group = el.closest('[role="radiogroup"]');
    const parent = group?.parentElement;
    if (!parent) return '';

    for (const child of Array.from(parent.children)) {
        if (child === group) continue;
        if (child.tagName === 'LABEL') return normalizeText(child.textContent);
    }

    return '';
}

interface CheckboxContext {    group: HTMLElement;
    groupLabel: string;
    optionLabel: string;
}

function checkboxContext(el: HTMLElement): CheckboxContext | null {
    if (!el.matches('[role="checkbox"], input[type="checkbox"]')) return null;

    let group = el.parentElement;
    while (group && group !== document.body) {
        const count = group.querySelectorAll('[role="checkbox"], input[type="checkbox"]').length;
        if (count >= 2) break;
        group = group.parentElement;
    }

    if (!group || group === document.body) return null;

    const directLabel =
        Array.from(group.children).find((child) => child.tagName === 'LABEL')?.textContent ?? '';
    const groupLabel = normalizeText(directLabel);

    // Unrelated checkboxes often share a <form>; only treat a container as a
    // group when it has its own group label (e.g. "Type of Disability *").
    if (!groupLabel) return null;

    let node: HTMLElement | null = el.parentElement;
    let optionLabel = '';

    while (node && node !== group) {
        const text = normalizeText(node.textContent);
        if (text && text !== groupLabel && text.length <= 80) {
            optionLabel = text;
            break;
        }
        node = node.parentElement;
    }

    return { group, groupLabel, optionLabel };
}

function toggleGroupLabel(group: HTMLElement): string {
    const parent = group.parentElement;
    if (!parent) return '';

    for (const child of Array.from(parent.children)) {
        if (child === group) continue;
        if (child.tagName === 'LABEL' || child.tagName === 'P') return normalizeText(child.textContent);
    }

    const label = parent.querySelector('label');
    if (label && !label.contains(group)) return normalizeText(label.textContent);

    return '';
}

function toControl(el: HTMLElement, index: number): DetectedControl | null {
    if (insideSkipped(el)) return null;
    if (isInsideOtherControl(el)) return null;

    const kind = kindFor(el);
    if (!kind) return null;

    if (kind === 'file') {
        const hiddenAncestor = el.parentElement?.closest('[hidden], [aria-hidden="true"]');
        if (hiddenAncestor) return null;
    } else if (!isVisible(el)) {
        return null;
    }

    const inner = el.querySelector<HTMLInputElement>('input');
    const labelText = readLabel(el);
    const checkbox = kind === 'checkbox' ? checkboxContext(el) : null;
    const radioGroup = el.closest<HTMLElement>('[role="radiogroup"]');
    const toggleGroup =
        kind === 'toggle-group'
            ? el.closest<HTMLElement>('[data-slot="toggle-group"], [role="group"]')
            : null;
    const groupLabel =
        radioGroupLabel(el) ||
        checkbox?.groupLabel ||
        (toggleGroup ? toggleGroupLabel(toggleGroup) : '') ||
        '';
    const required = Boolean(
        (el as HTMLInputElement).required ||
            el.getAttribute('aria-required') === 'true' ||
            /\*\s*$/.test(labelText) ||
            /\*\s*$/.test(groupLabel),
    );

    const optionLabel =
        kind === 'toggle-group'
            ? normalizeText(el.textContent)
            : checkbox?.optionLabel || cleanLabel(labelText);
    const label = groupLabel
        ? kind === 'toggle-group'
            ? cleanLabel(groupLabel)
            : `${cleanLabel(groupLabel)}: ${optionLabel}`
        : optionLabel;

    const numeric =
        kind === 'number' ||
        ['numeric', 'decimal'].includes((el.getAttribute('inputmode') ?? '').toLowerCase());
    const name = el.getAttribute('name') ?? inner?.getAttribute('name') ?? '';
    const id = el.id || inner?.id || '';
    const placeholder = normalizeText(
        el.getAttribute('placeholder') ?? inner?.getAttribute('placeholder') ?? '',
    );

    return {
        el,
        kind,
        label,
        name,
        id,
        placeholder,
        required,
        key: fieldKey(el, label, index),
        accept: (el as HTMLInputElement).accept ?? inner?.accept ?? '',
        multiple: Boolean((el as HTMLInputElement).multiple ?? inner?.multiple),
        numeric,
        optionLabel,
        groupEl: checkbox?.group ?? radioGroup ?? toggleGroup ?? undefined,
        groupLabel: groupLabel || undefined,
        groupRequired: /\*\s*$/.test(groupLabel),
        index,
    };
}

function activeDialog(): HTMLElement | null {
    const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'),
    );

    return dialogs.reverse().find((dialog) => isVisible(dialog)) ?? null;
}

export function scanControls(): DetectedControl[] {
    const dialog = activeDialog();
    const root: ParentNode = dialog ?? document;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR));
    const controls: DetectedControl[] = [];
    const usedKeys = new Map<string, number>();
    let index = 0;

    for (const node of nodes) {
        const control = toControl(node, index);
        if (!control) continue;

        const base = control.key;
        const seen = usedKeys.get(base) ?? 0;
        usedKeys.set(base, seen + 1);
        control.key = seen === 0 ? base : `${base}-${seen + 1}`;
        control.index = index;
        index += 1;
        controls.push(control);
    }

    // Button-only choice groups (e.g. the address "Label as" buttons) are not
    // native controls. Detect the safe, label-scoped groups only.
    for (const button of Array.from(root.querySelectorAll<HTMLElement>('form button'))) {
        if (isDisabled(button)) continue;

        const container = button.parentElement;
        if (!container) continue;

        const siblings = Array.from(container.querySelectorAll<HTMLElement>(':scope > button')).filter(
            (item) => !isDisabled(item),
        );
        if (siblings.length < 2 || siblings[0] !== button) continue;

        const groupText = normalizeText(container.parentElement?.textContent ?? '');
        if (!/label as|address type/i.test(groupText)) continue;

        const groupLabel = /label as/i.test(groupText) ? 'Label as' : 'Address type';
        const key = fieldKey(button, groupLabel, index);
        const seen = usedKeys.get(key) ?? 0;
        usedKeys.set(key, seen + 1);

        controls.push({
            el: button,
            kind: 'button-choice',
            label: groupLabel,
            name: '',
            id: '',
            placeholder: '',
            required: /\*/.test(groupText),
            key: seen === 0 ? key : `${key}-${seen + 1}`,
            accept: '',
            multiple: false,
            numeric: false,
            optionLabel: normalizeText(button.textContent),
            groupEl: container,
            groupLabel,
            groupRequired: /\*/.test(groupText),
            index,
        });
        index += 1;
    }

    return controls;
}

export function annotateControl(el: HTMLElement, label: string): void {
    ensureInspectStyle();
    if (!el.hasAttribute('data-prx-title')) {
        el.setAttribute('data-prx-title', el.getAttribute('title') ?? '');
    }
    el.setAttribute('data-prx-inspect', 'true');
    el.setAttribute('title', `PRAXXYS autofill: ${label}`);
}

export function clearInspection(): void {
    document.querySelectorAll('[data-prx-inspect]').forEach((el) => {
        const previous = el.getAttribute('data-prx-title') ?? '';
        el.removeAttribute('data-prx-inspect');
        el.removeAttribute('data-prx-title');
        if (previous) el.setAttribute('title', previous);
        else el.removeAttribute('title');
    });
}

function ensureInspectStyle(): void {
    if (document.getElementById('prx-qa-inspect-style')) return;

    const style = document.createElement('style');
    style.id = 'prx-qa-inspect-style';
    style.textContent =
        '[data-prx-inspect]{outline:2px dashed #7c3aed !important;outline-offset:2px}';
    document.head.appendChild(style);
}
